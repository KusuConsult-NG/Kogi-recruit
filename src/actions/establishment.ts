'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { flashOk } from '@/lib/flash';
import { requirePermission } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/rbac';
import {
  ministryDepartmentSchema, ministrySchema, parseForm, recruitmentUnitSchema,
  unitMemberSchema,
} from '@/lib/validation';
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { ROLES, UNIT_MEMBER_ROLE_LABELS } from '@/lib/constants';
import type { ActionState } from './public';

// ---------------------------------------------------------------------------
// MINISTRIES, DEPARTMENTS AND AGENCIES
// ---------------------------------------------------------------------------

/** Create an employing MDA. Vacancies are raised against these records. */
export async function createMinistry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.MDA_MANAGE);
  const parsed = parseForm(ministrySchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;

  const clash = await prisma.ministry.findFirst({
    where: { OR: [{ code: d.code }, { name: d.name }] },
    select: { code: true, name: true },
  });
  if (clash) {
    return clash.code === d.code
      ? { ok: false, errors: { code: 'That code is already in use.' }, message: 'Code already in use.' }
      : { ok: false, errors: { name: 'An MDA with that name already exists.' }, message: 'Name already in use.' };
  }

  const maxPosition = await prisma.ministry.aggregate({ _max: { position: true } });

  const ministry = await prisma.ministry.create({
    data: {
      name: d.name,
      shortName: d.shortName || null,
      code: d.code,
      kind: d.kind,
      mandate: d.mandate || null,
      description: d.description || null,
      headName: d.headName || null,
      headTitle: d.headTitle || null,
      email: d.email || null,
      phone: d.phone || null,
      website: d.website || null,
      address: d.address || null,
      lga: d.lga || null,
      establishedYear: d.establishedYear ?? null,
      staffStrength: d.staffStrength ?? null,
      published: d.published,
      active: d.active,
      position: (maxPosition._max.position ?? 0) + 1,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.MDA_CREATED,
    actor: user,
    entityType: 'Ministry',
    entityId: ministry.id,
    summary: `Added ${d.kind.toLowerCase().replace(/_/g, ' ')} "${d.name}" (${d.code}) to the establishment register`,
  });

  revalidatePath('/admin/establishment/ministries');
  revalidatePath('/ministries');
  redirect(`/admin/establishment/ministries/${ministry.id}`);
}

export async function updateMinistry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.MDA_MANAGE);
  const id = String(formData.get('id') ?? '');
  const existing = await prisma.ministry.findUnique({ where: { id } });
  if (!existing) return { ok: false, message: 'That MDA could not be found.' };

  const parsed = parseForm(ministrySchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;

  const clash = await prisma.ministry.findFirst({
    where: { id: { not: id }, OR: [{ code: d.code }, { name: d.name }] },
    select: { code: true },
  });
  if (clash) {
    return clash.code === d.code
      ? { ok: false, errors: { code: 'That code is already in use.' }, message: 'Code already in use.' }
      : { ok: false, errors: { name: 'An MDA with that name already exists.' }, message: 'Name already in use.' };
  }

  await prisma.ministry.update({
    where: { id },
    data: {
      name: d.name,
      shortName: d.shortName || null,
      code: d.code,
      kind: d.kind,
      mandate: d.mandate || null,
      description: d.description || null,
      headName: d.headName || null,
      headTitle: d.headTitle || null,
      email: d.email || null,
      phone: d.phone || null,
      website: d.website || null,
      address: d.address || null,
      lga: d.lga || null,
      establishedYear: d.establishedYear ?? null,
      staffStrength: d.staffStrength ?? null,
      published: d.published,
      active: d.active,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.MDA_UPDATED,
    actor: user,
    entityType: 'Ministry',
    entityId: id,
    summary: `Updated the establishment record for "${d.name}" (${d.code})`,
  });

  revalidatePath('/admin/establishment/ministries');
  revalidatePath(`/admin/establishment/ministries/${id}`);
  revalidatePath('/ministries');
  return flashOk('Establishment record saved.');
}

export async function deleteMinistry(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.MDA_MANAGE);
  const id = String(formData.get('id') ?? '');
  const ministry = await prisma.ministry.findUnique({
    where: { id },
    include: { _count: { select: { vacancies: true } } },
  });
  if (!ministry) return;

  if (ministry._count.vacancies > 0) {
    // Vacancies reference this MDA, so the record is retired rather than destroyed.
    await prisma.ministry.update({ where: { id }, data: { active: false, published: false } });
  } else {
    await prisma.ministry.delete({ where: { id } });
  }

  await recordAudit({
    action: AUDIT_ACTIONS.MDA_DELETED,
    actor: user,
    entityType: 'Ministry',
    entityId: id,
    summary:
      ministry._count.vacancies > 0
        ? `Retired "${ministry.name}" (vacancies exist, so the record was kept)`
        : `Removed "${ministry.name}" from the establishment register`,
  });

  revalidatePath('/admin/establishment/ministries');
  revalidatePath('/ministries');
  if (ministry._count.vacancies === 0) redirect('/admin/establishment/ministries');
}

export async function saveMinistryDepartment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.MDA_MANAGE);
  const ministryId = String(formData.get('ministryId') ?? '');
  const id = String(formData.get('id') ?? '');
  const ministry = await prisma.ministry.findUnique({ where: { id: ministryId }, select: { id: true, name: true } });
  if (!ministry) return { ok: false, message: 'That MDA could not be found.' };

  const parsed = parseForm(ministryDepartmentSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;

  const clash = await prisma.ministryDepartment.findFirst({
    where: { ministryId, name: d.name, ...(id ? { id: { not: id } } : {}) },
    select: { id: true },
  });
  if (clash) {
    return { ok: false, errors: { name: 'That department is already recorded for this MDA.' }, message: 'Duplicate department.' };
  }

  const data = {
    ministryId,
    name: d.name,
    code: d.code || null,
    kind: d.kind,
    headName: d.headName || null,
  };

  if (id) {
    await prisma.ministryDepartment.update({ where: { id }, data });
  } else {
    const max = await prisma.ministryDepartment.aggregate({ where: { ministryId }, _max: { position: true } });
    await prisma.ministryDepartment.create({ data: { ...data, position: (max._max.position ?? 0) + 1 } });
  }

  await recordAudit({
    action: AUDIT_ACTIONS.MDA_UPDATED,
    actor: user,
    entityType: 'MinistryDepartment',
    entityId: id || undefined,
    summary: `${id ? 'Updated' : 'Added'} department "${d.name}" in ${ministry.name}`,
  });

  revalidatePath(`/admin/establishment/ministries/${ministryId}`);
  return flashOk(`Department ${id ? 'updated' : 'added'}.`);
}

export async function deleteMinistryDepartment(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.MDA_MANAGE);
  const id = String(formData.get('id') ?? '');
  const dept = await prisma.ministryDepartment.findUnique({
    where: { id },
    include: { _count: { select: { vacancies: true } }, ministry: { select: { id: true, name: true } } },
  });
  if (!dept) return;
  if (dept._count.vacancies > 0) {
    await recordAudit({
      action: AUDIT_ACTIONS.MDA_UPDATED,
      actor: user,
      entityType: 'MinistryDepartment',
      entityId: id,
      summary: `Kept department "${dept.name}" (vacancies reference it)`,
    });
    revalidatePath(`/admin/establishment/ministries/${dept.ministry.id}`);
    return;
  }
  await prisma.ministryDepartment.delete({ where: { id } });
  await recordAudit({
    action: AUDIT_ACTIONS.MDA_UPDATED,
    actor: user,
    entityType: 'MinistryDepartment',
    entityId: id,
    summary: `Removed department "${dept.name}" from ${dept.ministry.name}`,
  });
  revalidatePath(`/admin/establishment/ministries/${dept.ministry.id}`);
}

// ---------------------------------------------------------------------------
// RECRUITMENT UNIT
// ---------------------------------------------------------------------------

export async function createRecruitmentUnit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.UNIT_MANAGE);
  const parsed = parseForm(recruitmentUnitSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;

  const clash = await prisma.recruitmentUnit.findFirst({
    where: { OR: [{ code: d.code }, { name: d.name }] },
    select: { code: true },
  });
  if (clash) {
    return clash.code === d.code
      ? { ok: false, errors: { code: 'That code is already in use.' }, message: 'Code already in use.' }
      : { ok: false, errors: { name: 'A unit with that name already exists.' }, message: 'Name already in use.' };
  }

  const unit = await prisma.recruitmentUnit.create({
    data: {
      name: d.name,
      code: d.code,
      mandate: d.mandate || null,
      description: d.description || null,
      email: d.email || null,
      phone: d.phone || null,
      office: d.office || null,
      active: d.active,
      createdById: user.id,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.UNIT_CREATED,
    actor: user,
    entityType: 'RecruitmentUnit',
    entityId: unit.id,
    summary: `Established the recruitment unit "${d.name}" (${d.code})`,
  });

  revalidatePath('/admin/establishment/units');
  redirect(`/admin/establishment/units/${unit.id}`);
}

export async function updateRecruitmentUnit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.UNIT_MANAGE);
  const id = String(formData.get('id') ?? '');
  const existing = await prisma.recruitmentUnit.findUnique({ where: { id } });
  if (!existing) return { ok: false, message: 'That recruitment unit could not be found.' };

  const parsed = parseForm(recruitmentUnitSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;

  const clash = await prisma.recruitmentUnit.findFirst({
    where: { id: { not: id }, OR: [{ code: d.code }, { name: d.name }] },
    select: { code: true },
  });
  if (clash) {
    return clash.code === d.code
      ? { ok: false, errors: { code: 'That code is already in use.' }, message: 'Code already in use.' }
      : { ok: false, errors: { name: 'A unit with that name already exists.' }, message: 'Name already in use.' };
  }

  await prisma.recruitmentUnit.update({
    where: { id },
    data: {
      name: d.name,
      code: d.code,
      mandate: d.mandate || null,
      description: d.description || null,
      email: d.email || null,
      phone: d.phone || null,
      office: d.office || null,
      active: d.active,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.UNIT_UPDATED,
    actor: user,
    entityType: 'RecruitmentUnit',
    entityId: id,
    summary: `Updated the recruitment unit "${d.name}"`,
  });

  revalidatePath('/admin/establishment/units');
  revalidatePath(`/admin/establishment/units/${id}`);
  return flashOk('Recruitment unit saved.');
}

/** Add an officer to the unit that manages recruitment. */
export async function addUnitMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.UNIT_MANAGE);
  const unitId = String(formData.get('unitId') ?? '');
  const unit = await prisma.recruitmentUnit.findUnique({ where: { id: unitId }, select: { id: true, name: true } });
  if (!unit) return { ok: false, message: 'That recruitment unit could not be found.' };

  const parsed = parseForm(unitMemberSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;

  const officer = await prisma.user.findUnique({
    where: { id: d.userId },
    select: { id: true, fullName: true, role: true, active: true },
  });
  if (!officer) return { ok: false, errors: { userId: 'That officer could not be found.' }, message: 'Officer not found.' };
  if (officer.role === ROLES.APPLICANT) {
    return { ok: false, errors: { userId: 'Applicants cannot be members of the recruitment unit.' }, message: 'Not a member of staff.' };
  }
  if (!officer.active) {
    return { ok: false, errors: { userId: 'That account is deactivated.' }, message: 'Account deactivated.' };
  }

  const existing = await prisma.recruitmentUnitMember.findUnique({
    where: { unitId_userId: { unitId, userId: d.userId } },
  });
  if (existing && existing.active) {
    return { ok: false, errors: { userId: 'That officer is already a member of this unit.' }, message: 'Already a member.' };
  }

  if (existing) {
    await prisma.recruitmentUnitMember.update({
      where: { id: existing.id },
      data: { active: true, endedAt: null, unitRole: d.unitRole, notes: d.notes || null, assignedAt: new Date() },
    });
  } else {
    await prisma.recruitmentUnitMember.create({
      data: { unitId, userId: d.userId, unitRole: d.unitRole, notes: d.notes || null },
    });
  }

  await recordAudit({
    action: AUDIT_ACTIONS.UNIT_MEMBER_ASSIGNED,
    actor: user,
    entityType: 'RecruitmentUnitMember',
    entityId: d.userId,
    summary: `Assigned ${officer.fullName} to ${unit.name} as ${UNIT_MEMBER_ROLE_LABELS[d.unitRole] ?? d.unitRole}`,
  });

  revalidatePath(`/admin/establishment/units/${unitId}`);
  return flashOk(`${officer.fullName} added to the unit.`);
}

export async function removeUnitMember(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.UNIT_MANAGE);
  const id = String(formData.get('id') ?? '');
  const member = await prisma.recruitmentUnitMember.findUnique({
    where: { id },
    include: { user: { select: { fullName: true } }, unit: { select: { id: true, name: true } } },
  });
  if (!member) return;

  await prisma.recruitmentUnitMember.update({
    where: { id },
    data: { active: false, endedAt: new Date() },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.UNIT_MEMBER_REMOVED,
    actor: user,
    entityType: 'RecruitmentUnitMember',
    entityId: id,
    summary: `Removed ${member.user.fullName} from ${member.unit.name}`,
  });

  revalidatePath(`/admin/establishment/units/${member.unit.id}`);
}

/** Put a recruitment exercise under the management of a unit. */
export async function assignExerciseToUnit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.EXERCISE_MANAGE);
  const exerciseId = String(formData.get('exerciseId') ?? '');
  const unitId = String(formData.get('unitId') ?? '');

  const exercise = await prisma.recruitmentExercise.findUnique({
    where: { id: exerciseId },
    select: { id: true, reference: true },
  });
  if (!exercise) return { ok: false, message: 'Recruitment exercise not found.' };

  let unitName = 'no unit';
  if (unitId) {
    const unit = await prisma.recruitmentUnit.findUnique({ where: { id: unitId }, select: { name: true, active: true } });
    if (!unit) return { ok: false, errors: { unitId: 'That recruitment unit could not be found.' }, message: 'Unit not found.' };
    if (!unit.active) return { ok: false, errors: { unitId: 'That unit is not active.' }, message: 'Unit not active.' };
    unitName = unit.name;
  }

  await prisma.recruitmentExercise.update({
    where: { id: exerciseId },
    data: { unitId: unitId || null },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.EXERCISE_UPDATED,
    actor: user,
    entityType: 'RecruitmentExercise',
    entityId: exerciseId,
    summary: `Assigned exercise ${exercise.reference} to ${unitName}`,
  });

  revalidatePath(`/admin/exercises/${exerciseId}`);
  return flashOk(unitId ? `Exercise assigned to ${unitName}.` : 'Exercise unassigned from the recruitment unit.');
}
