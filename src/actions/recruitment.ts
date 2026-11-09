'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { flashOk, setFlash } from '@/lib/flash';
import { requirePermission } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/rbac';
import {
  documentRequirementSchema, exerciseSchema, parseForm, vacancySchema,
} from '@/lib/validation';
import { exerciseReference } from '@/lib/ids';
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { DOCUMENT_TYPES, EXERCISE_STATUS } from '@/lib/constants';
import { assertExerciseTransition, WorkflowError } from '@/lib/workflow';
import type { ActionState } from './public';

/** Module 2.1 - create a recruitment exercise. */
export async function createExercise(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.EXERCISE_MANAGE);
  const parsed = parseForm(exerciseSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;

  let reference = d.reference?.trim();
  if (!reference) {
    const count = await prisma.recruitmentExercise.count();
    reference = exerciseReference(count + 1);
  }
  const clash = await prisma.recruitmentExercise.findUnique({ where: { reference } });
  if (clash) {
    return { ok: false, errors: { reference: 'That reference number is already in use.' }, message: 'Reference number already in use.' };
  }

  const exercise = await prisma.recruitmentExercise.create({
    data: {
      title: d.title,
      reference,
      description: d.description,
      guidelines: d.guidelines || null,
      eligibility: d.eligibility || null,
      opensAt: d.opensAt,
      closesAt: d.closesAt,
      maxApplications: d.maxApplications,
      requireExam: d.requireExam,
      requireInterview: d.requireInterview,
      status: EXERCISE_STATUS.DRAFT,
      createdById: user.id,
      // Sensible default document requirements; fully editable afterwards.
      requirements: {
        create: ['PASSPORT_PHOTO', 'BIRTH_CERTIFICATE', 'EDUCATIONAL_CERTIFICATE', 'LGA_CERTIFICATE', 'NIN']
          .map((code, index) => {
            const t = DOCUMENT_TYPES.find((x) => x.code === code)!;
            return {
              code: t.code,
              label: t.label,
              required: true,
              maxSizeMb: t.maxMb,
              acceptTypes: t.accept,
              position: index,
            };
          }),
      },
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.EXERCISE_CREATED,
    actor: user,
    entityType: 'RecruitmentExercise',
    entityId: exercise.id,
    summary: `Created recruitment exercise "${exercise.title}" (${reference})`,
  });

  revalidatePath('/admin/exercises');
  redirect(`/admin/exercises/${exercise.id}`);
}

export async function updateExercise(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.EXERCISE_MANAGE);
  const id = String(formData.get('id') ?? '');
  const existing = await prisma.recruitmentExercise.findUnique({ where: { id } });
  if (!existing) return { ok: false, message: 'Recruitment exercise not found.' };
  if ([EXERCISE_STATUS.CLOSED, EXERCISE_STATUS.ARCHIVED].includes(existing.status as never)) {
    return { ok: false, message: 'A closed or archived exercise cannot be edited.' };
  }

  const parsed = parseForm(exerciseSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;

  if (d.reference && d.reference !== existing.reference) {
    const clash = await prisma.recruitmentExercise.findUnique({ where: { reference: d.reference } });
    if (clash) return { ok: false, errors: { reference: 'That reference number is already in use.' }, message: 'Reference number already in use.' };
  }

  await prisma.recruitmentExercise.update({
    where: { id },
    data: {
      title: d.title,
      reference: d.reference || existing.reference,
      description: d.description,
      guidelines: d.guidelines || null,
      eligibility: d.eligibility || null,
      opensAt: d.opensAt,
      closesAt: d.closesAt,
      maxApplications: d.maxApplications,
      requireExam: d.requireExam,
      requireInterview: d.requireInterview,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.EXERCISE_UPDATED,
    actor: user,
    entityType: 'RecruitmentExercise',
    entityId: id,
    summary: `Updated recruitment exercise "${d.title}"`,
  });

  revalidatePath(`/admin/exercises/${id}`);
  return flashOk('Recruitment exercise updated.');
}

/** Exercise lifecycle: submit for approval, approve, publish, suspend, close, archive. */
export async function changeExerciseStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const to = String(formData.get('status') ?? '');
  const note = String(formData.get('note') ?? '').trim();

  const needsApprovalRight = [EXERCISE_STATUS.APPROVED, EXERCISE_STATUS.PUBLISHED].includes(to as never);
  const user = await requirePermission(
    needsApprovalRight ? PERMISSIONS.EXERCISE_APPROVE : PERMISSIONS.EXERCISE_MANAGE,
  );

  const exercise = await prisma.recruitmentExercise.findUnique({
    where: { id },
    include: { vacancies: { where: { active: true }, select: { id: true } } },
  });
  if (!exercise) return { ok: false, message: 'Recruitment exercise not found.' };

  try {
    assertExerciseTransition(exercise.status, to);
  } catch (error) {
    return { ok: false, message: error instanceof WorkflowError ? error.message : 'Invalid status change.' };
  }

  if (to === EXERCISE_STATUS.PENDING_APPROVAL && exercise.vacancies.length === 0) {
    return { ok: false, message: 'Add at least one approved vacancy before submitting this exercise for approval.' };
  }
  if (to === EXERCISE_STATUS.SUSPENDED && !note) {
    return { ok: false, message: 'State the reason for suspending this exercise.' };
  }

  const now = new Date();
  const data: Record<string, unknown> = { status: to };
  if (to === EXERCISE_STATUS.APPROVED) {
    data.approvedById = user.id;
    data.approvedAt = now;
  }
  if (to === EXERCISE_STATUS.PUBLISHED) {
    data.publishedAt = exercise.publishedAt ?? now;
    data.suspendedReason = null;
  }
  if (to === EXERCISE_STATUS.SUSPENDED) data.suspendedReason = note;
  if (to === EXERCISE_STATUS.CLOSED) data.closedAt = now;
  if (to === EXERCISE_STATUS.ARCHIVED) data.archivedAt = now;

  await prisma.recruitmentExercise.update({ where: { id }, data });

  if (to === EXERCISE_STATUS.PENDING_APPROVAL) {
    await prisma.approvalRequest.create({
      data: {
        entityType: 'EXERCISE',
        entityId: id,
        exerciseId: id,
        action: 'APPROVE_EXERCISE',
        requestedById: user.id,
        requestedByName: user.fullName,
        note: note || null,
      },
    });
  }
  if ([EXERCISE_STATUS.APPROVED, EXERCISE_STATUS.DRAFT].includes(to as never)) {
    await prisma.approvalRequest.updateMany({
      where: { entityType: 'EXERCISE', entityId: id, status: 'PENDING' },
      data: {
        status: to === EXERCISE_STATUS.APPROVED ? 'APPROVED' : 'REJECTED',
        decidedById: user.id,
        decidedByName: user.fullName,
        decidedAt: now,
        note: note || null,
      },
    });
  }

  const actionMap: Record<string, string> = {
    [EXERCISE_STATUS.PENDING_APPROVAL]: AUDIT_ACTIONS.EXERCISE_SUBMITTED,
    [EXERCISE_STATUS.APPROVED]: AUDIT_ACTIONS.EXERCISE_APPROVED,
    [EXERCISE_STATUS.PUBLISHED]: AUDIT_ACTIONS.EXERCISE_PUBLISHED,
    [EXERCISE_STATUS.SUSPENDED]: AUDIT_ACTIONS.EXERCISE_SUSPENDED,
    [EXERCISE_STATUS.CLOSED]: AUDIT_ACTIONS.EXERCISE_CLOSED,
    [EXERCISE_STATUS.ARCHIVED]: AUDIT_ACTIONS.EXERCISE_ARCHIVED,
    [EXERCISE_STATUS.DRAFT]: AUDIT_ACTIONS.EXERCISE_REJECTED,
  };
  await recordAudit({
    action: actionMap[to] ?? AUDIT_ACTIONS.EXERCISE_UPDATED,
    actor: user,
    entityType: 'RecruitmentExercise',
    entityId: id,
    summary: `Exercise "${exercise.title}" moved from ${exercise.status} to ${to}${note ? ` — ${note}` : ''}`,
    metadata: { from: exercise.status, to, note },
    sensitive: needsApprovalRight,
  });

  revalidatePath('/admin/exercises');
  revalidatePath(`/admin/exercises/${id}`);
  revalidatePath('/recruitment');
  return flashOk(`Exercise status changed to ${to.replace(/_/g, ' ').toLowerCase()}.`);
}

/** Module 2.1 - vacancy management. */
export async function createVacancy(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.EXERCISE_MANAGE);
  const exerciseId = String(formData.get('exerciseId') ?? '');
  const exercise = await prisma.recruitmentExercise.findUnique({ where: { id: exerciseId } });
  if (!exercise) return { ok: false, message: 'Recruitment exercise not found.' };
  if ([EXERCISE_STATUS.CLOSED, EXERCISE_STATUS.ARCHIVED].includes(exercise.status as never)) {
    return { ok: false, message: 'Vacancies cannot be changed on a closed or archived exercise.' };
  }

  const parsed = parseForm(vacancySchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;

  const vacancy = await prisma.vacancy.create({
    data: {
      exerciseId,
      jobTitle: d.jobTitle,
      gradeLevel: d.gradeLevel,
      departmentId: d.departmentId || null,
      agency: d.agency || null,
      positions: d.positions,
      description: d.description || null,
      qualifications: d.qualifications,
      experience: d.experience || null,
      minAge: d.minAge ?? null,
      maxAge: d.maxAge ?? null,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.EXERCISE_UPDATED,
    actor: user,
    entityType: 'Vacancy',
    entityId: vacancy.id,
    summary: `Added vacancy "${d.jobTitle}" (${d.gradeLevel}, ${d.positions} post(s)) to ${exercise.reference}`,
  });

  revalidatePath(`/admin/exercises/${exerciseId}`);
  return flashOk('Vacancy added.');
}

export async function toggleVacancy(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.EXERCISE_MANAGE);
  const id = String(formData.get('id') ?? '');
  const vacancy = await prisma.vacancy.findUnique({ where: { id } });
  if (!vacancy) return;
  await prisma.vacancy.update({ where: { id }, data: { active: !vacancy.active } });
  await recordAudit({
    action: AUDIT_ACTIONS.EXERCISE_UPDATED,
    actor: user,
    entityType: 'Vacancy',
    entityId: id,
    summary: `${vacancy.active ? 'Deactivated' : 'Reactivated'} vacancy "${vacancy.jobTitle}"`,
  });
  revalidatePath(`/admin/exercises/${vacancy.exerciseId}`);
}

export async function deleteVacancy(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.EXERCISE_MANAGE);
  const id = String(formData.get('id') ?? '');
  const vacancy = await prisma.vacancy.findUnique({
    where: { id },
    include: { _count: { select: { applications: true } } },
  });
  if (!vacancy) return;
  if (vacancy._count.applications > 0) {
    // Applications exist; deactivate instead of destroying records.
    await prisma.vacancy.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.vacancy.delete({ where: { id } });
  }
  await recordAudit({
    action: AUDIT_ACTIONS.EXERCISE_UPDATED,
    actor: user,
    entityType: 'Vacancy',
    entityId: id,
    summary: `Removed vacancy "${vacancy.jobTitle}"${vacancy._count.applications > 0 ? ' (deactivated: applications exist)' : ''}`,
  });
  revalidatePath(`/admin/exercises/${vacancy.exerciseId}`);
}

/** Module 2.4 - configure which documents an exercise requires. */
export async function saveDocumentRequirement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.EXERCISE_MANAGE);
  const exerciseId = String(formData.get('exerciseId') ?? '');
  const parsed = parseForm(documentRequirementSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;
  const count = await prisma.documentRequirement.count({ where: { exerciseId } });

  await prisma.documentRequirement.upsert({
    where: { exerciseId_code: { exerciseId, code: d.code } },
    create: {
      exerciseId,
      code: d.code,
      label: d.label,
      required: d.required,
      description: d.description || null,
      maxSizeMb: d.maxSizeMb,
      acceptTypes: d.acceptTypes,
      position: count,
    },
    update: {
      label: d.label,
      required: d.required,
      description: d.description || null,
      maxSizeMb: d.maxSizeMb,
      acceptTypes: d.acceptTypes,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.EXERCISE_UPDATED,
    actor: user,
    entityType: 'DocumentRequirement',
    entityId: exerciseId,
    summary: `Configured required document "${d.label}"`,
  });

  revalidatePath(`/admin/exercises/${exerciseId}`);
  return flashOk('Document requirement saved.');
}

export async function deleteDocumentRequirement(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.EXERCISE_MANAGE);
  const id = String(formData.get('id') ?? '');
  const req = await prisma.documentRequirement.findUnique({ where: { id } });
  if (!req) return;
  await prisma.documentRequirement.delete({ where: { id } });
  await recordAudit({
    action: AUDIT_ACTIONS.EXERCISE_UPDATED,
    actor: user,
    entityType: 'DocumentRequirement',
    entityId: id,
    summary: `Removed required document "${req.label}"`,
  });
  revalidatePath(`/admin/exercises/${req.exerciseId}`);
}

/** Module 2.3 - configurable application form fields. */
export async function saveFormField(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.EXERCISE_MANAGE);
  const exerciseId = String(formData.get('exerciseId') ?? '');
  const key = String(formData.get('key') ?? '').trim().replace(/[^a-zA-Z0-9_]/g, '');
  const label = String(formData.get('label') ?? '').trim();
  const section = String(formData.get('section') ?? 'OTHER');
  const inputType = String(formData.get('inputType') ?? 'text');
  const optionsRaw = String(formData.get('options') ?? '').trim();
  const required = formData.get('required') === 'true';
  const helpText = String(formData.get('helpText') ?? '').trim();

  if (!key || !label) {
    return { ok: false, message: 'A field key and label are both required.' };
  }
  if (inputType === 'select' && !optionsRaw) {
    return { ok: false, message: 'Provide a comma-separated list of options for a select field.' };
  }

  const count = await prisma.formField.count({ where: { exerciseId } });
  await prisma.formField.upsert({
    where: { exerciseId_key: { exerciseId, key } },
    create: {
      exerciseId, key, label, section, inputType,
      options: optionsRaw ? JSON.stringify(optionsRaw.split(',').map((o) => o.trim()).filter(Boolean)) : null,
      required, helpText: helpText || null, position: count,
    },
    update: {
      label, section, inputType,
      options: optionsRaw ? JSON.stringify(optionsRaw.split(',').map((o) => o.trim()).filter(Boolean)) : null,
      required, helpText: helpText || null,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.EXERCISE_UPDATED,
    actor: user,
    entityType: 'FormField',
    entityId: exerciseId,
    summary: `Configured application form field "${label}"`,
  });

  revalidatePath(`/admin/exercises/${exerciseId}`);
  return flashOk('Application form field saved.');
}

export async function deleteFormField(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.EXERCISE_MANAGE);
  const id = String(formData.get('id') ?? '');
  const field = await prisma.formField.findUnique({ where: { id } });
  if (!field) return;
  await prisma.formField.delete({ where: { id } });
  await recordAudit({
    action: AUDIT_ACTIONS.EXERCISE_UPDATED,
    actor: user,
    entityType: 'FormField',
    entityId: id,
    summary: `Removed application form field "${field.label}"`,
  });
  revalidatePath(`/admin/exercises/${field.exerciseId}`);
}
