'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { flashOk, setFlash } from '@/lib/flash';
import { requireApplicant } from '@/lib/auth';
import {
  applicantProfileSchema, educationSchema, employmentSchema, nextOfKinSchema,
  parseForm, refereeSchema, submitApplicationSchema,
} from '@/lib/validation';
import { applicationReference } from '@/lib/ids';
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { sendTemplated, TEMPLATES } from '@/lib/notifications';
import { storeFile, deleteStoredFile, UploadError } from '@/lib/storage';
import { APPLICATION_STATUS, DOCUMENT_TYPES } from '@/lib/constants';
import { assertApplicationTransition, WorkflowError } from '@/lib/workflow';
import {
  applyStatusChange, exerciseAcceptsApplications, isEditable, refreshCompleteness,
} from '@/lib/application-service';
import { formatDateTime } from '@/lib/format';
import type { ActionState } from './public';

async function ownedApplication(applicationId: string) {
  const user = await requireApplicant();
  const application = await prisma.application.findFirst({
    where: { id: applicationId, applicantId: user.id },
    include: { exercise: { include: { requirements: true } } },
  });
  if (!application) throw new Error('Application not found.');
  return { user, application };
}

/** Module 2.2 - applicant profile management. */
export async function saveProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireApplicant();
  const parsed = parseForm(applicantProfileSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;
  const fullName = [d.surname, d.firstName, d.middleName].filter(Boolean).join(' ');

  await prisma.$transaction([
    prisma.applicantProfile.update({
      where: { userId: user.id },
      data: {
        surname: d.surname,
        firstName: d.firstName,
        middleName: d.middleName || null,
        gender: d.gender,
        dateOfBirth: d.dateOfBirth,
        maritalStatus: d.maritalStatus,
        nin: d.nin || null,
        phone: d.phone,
        altPhone: d.altPhone || null,
        residentialAddress: d.residentialAddress,
        city: d.city,
        stateOfResidence: d.stateOfResidence,
        stateOfOrigin: d.stateOfOrigin,
        lga: d.lga,
        disability: d.disability || null,
        profileComplete: true,
      },
    }),
    prisma.user.update({ where: { id: user.id }, data: { fullName, phone: d.phone } }),
  ]);

  const drafts = await prisma.application.findMany({
    where: { applicantId: user.id, status: { in: [APPLICATION_STATUS.DRAFT, APPLICATION_STATUS.RESUBMISSION_REQUIRED, APPLICATION_STATUS.INCOMPLETE] } },
    select: { id: true },
  });
  for (const draft of drafts) await refreshCompleteness(draft.id);

  await recordAudit({
    action: AUDIT_ACTIONS.USER_UPDATED,
    actor: user,
    entityType: 'ApplicantProfile',
    entityId: user.id,
    summary: 'Applicant updated their profile',
  });

  revalidatePath('/portal');
  revalidatePath('/portal/profile');
  return flashOk('Your profile has been saved.');
}

/** Module 2.3 - start a new application for an open exercise. */
export async function startApplication(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireApplicant();
  const exerciseId = String(formData.get('exerciseId') ?? '');
  const vacancyId = String(formData.get('vacancyId') ?? '');

  const exercise = await prisma.recruitmentExercise.findUnique({
    where: { id: exerciseId },
    include: { vacancies: { where: { active: true } } },
  });
  if (!exercise) return { ok: false, message: 'That recruitment exercise could not be found.' };

  const open = exerciseAcceptsApplications(exercise);
  if (!open.ok) return { ok: false, message: open.reason };

  if (!vacancyId) {
    return { ok: false, message: 'Select the position you wish to apply for.', errors: { vacancyId: 'Select a position.' } };
  }
  const vacancy = exercise.vacancies.find((v) => v.id === vacancyId);
  if (!vacancy) return { ok: false, message: 'That position is not available in this exercise.' };

  const profile = await prisma.applicantProfile.findUnique({ where: { userId: user.id } });
  if (!profile?.profileComplete) {
    return {
      ok: false,
      message: 'Complete your applicant profile before starting an application.',
    };
  }

  const existingCount = await prisma.application.count({
    where: { applicantId: user.id, exerciseId, status: { not: APPLICATION_STATUS.WITHDRAWN } },
  });
  if (existingCount >= exercise.maxApplications) {
    return {
      ok: false,
      message:
        exercise.maxApplications === 1
          ? 'You have already applied to this recruitment exercise.'
          : `You may submit at most ${exercise.maxApplications} applications to this exercise.`,
    };
  }

  const duplicate = await prisma.application.findFirst({
    where: { applicantId: user.id, exerciseId, vacancyId },
  });
  if (duplicate) {
    return { ok: false, message: 'You already have an application for this position.' };
  }

  const application = await prisma.application.create({
    data: {
      reference: applicationReference(exercise.reference),
      applicantId: user.id,
      exerciseId,
      vacancyId,
      status: APPLICATION_STATUS.DRAFT,
    },
  });
  await prisma.applicationStatusHistory.create({
    data: {
      applicationId: application.id,
      toStatus: APPLICATION_STATUS.DRAFT,
      stage: 'APPLICATION',
      changedById: user.id,
      changedByName: user.fullName,
      remarks: `Application started for ${vacancy.jobTitle}`,
    },
  });
  await refreshCompleteness(application.id);

  await recordAudit({
    action: AUDIT_ACTIONS.APPLICATION_CREATED,
    actor: user,
    entityType: 'Application',
    entityId: application.id,
    summary: `Application ${application.reference} started for ${vacancy.jobTitle}`,
  });

  redirect(`/portal/applications/${application.id}`);
}

export async function addEducation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, application } = await ownedApplication(String(formData.get('applicationId') ?? ''));
  if (!isEditable(application.status)) return { ok: false, message: 'This application can no longer be edited.' };

  const parsed = parseForm(educationSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;
  if (d.startYear && d.endYear && d.endYear < d.startYear) {
    return { ok: false, errors: { endYear: 'The end year cannot be before the start year.' }, message: 'Check the years entered.' };
  }
  const count = await prisma.applicationEducation.count({ where: { applicationId: application.id } });
  await prisma.applicationEducation.create({
    data: {
      applicationId: application.id,
      institution: d.institution,
      qualification: d.qualification,
      course: d.course || null,
      grade: d.grade || null,
      startYear: d.startYear ?? null,
      endYear: d.endYear ?? null,
      certificateNo: d.certificateNo || null,
      position: count,
    },
  });
  await refreshCompleteness(application.id);
  await recordAudit({
    action: AUDIT_ACTIONS.APPLICATION_UPDATED,
    actor: user,
    entityType: 'Application',
    entityId: application.id,
    summary: `Added qualification ${d.qualification} from ${d.institution}`,
  });
  revalidatePath(`/portal/applications/${application.id}`);
  return flashOk('Qualification added.');
}

export async function addEmployment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, application } = await ownedApplication(String(formData.get('applicationId') ?? ''));
  if (!isEditable(application.status)) return { ok: false, message: 'This application can no longer be edited.' };

  const parsed = parseForm(employmentSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;
  if (d.startDate && d.endDate && d.endDate < d.startDate) {
    return { ok: false, errors: { endDate: 'The end date cannot be before the start date.' }, message: 'Check the dates entered.' };
  }
  const count = await prisma.applicationEmployment.count({ where: { applicationId: application.id } });
  await prisma.applicationEmployment.create({
    data: {
      applicationId: application.id,
      employer: d.employer,
      jobTitle: d.jobTitle,
      responsibilities: d.responsibilities || null,
      startDate: d.startDate ?? null,
      endDate: d.current ? null : (d.endDate ?? null),
      current: Boolean(d.current),
      position: count,
    },
  });
  await refreshCompleteness(application.id);
  await recordAudit({
    action: AUDIT_ACTIONS.APPLICATION_UPDATED,
    actor: user,
    entityType: 'Application',
    entityId: application.id,
    summary: `Added employment record: ${d.jobTitle} at ${d.employer}`,
  });
  revalidatePath(`/portal/applications/${application.id}`);
  return flashOk('Employment record added.');
}

export async function addReferee(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, application } = await ownedApplication(String(formData.get('applicationId') ?? ''));
  if (!isEditable(application.status)) return { ok: false, message: 'This application can no longer be edited.' };

  const parsed = parseForm(refereeSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;
  const count = await prisma.applicationReferee.count({ where: { applicationId: application.id } });
  if (count >= 3) return { ok: false, message: 'You may list at most three referees.' };

  await prisma.applicationReferee.create({
    data: {
      applicationId: application.id,
      name: d.name,
      occupation: d.occupation || null,
      organisation: d.organisation || null,
      email: d.email || null,
      phone: d.phone || null,
      address: d.address || null,
    },
  });
  await refreshCompleteness(application.id);
  await recordAudit({
    action: AUDIT_ACTIONS.APPLICATION_UPDATED,
    actor: user,
    entityType: 'Application',
    entityId: application.id,
    summary: `Added referee ${d.name}`,
  });
  revalidatePath(`/portal/applications/${application.id}`);
  return flashOk('Referee added.');
}

export async function saveNextOfKin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, application } = await ownedApplication(String(formData.get('applicationId') ?? ''));
  if (!isEditable(application.status)) return { ok: false, message: 'This application can no longer be edited.' };

  const parsed = parseForm(nextOfKinSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;
  await prisma.nextOfKin.upsert({
    where: { applicationId: application.id },
    create: {
      applicationId: application.id,
      name: d.name,
      relationship: d.relationship,
      phone: d.phone,
      email: d.email || null,
      address: d.address || null,
    },
    update: {
      name: d.name,
      relationship: d.relationship,
      phone: d.phone,
      email: d.email || null,
      address: d.address || null,
    },
  });
  await refreshCompleteness(application.id);
  await recordAudit({
    action: AUDIT_ACTIONS.APPLICATION_UPDATED,
    actor: user,
    entityType: 'Application',
    entityId: application.id,
    summary: 'Saved next-of-kin details',
  });
  revalidatePath(`/portal/applications/${application.id}`);
  return flashOk('Next-of-kin details saved.');
}

/** Save the free-text skills summary and any configurable form field answers. */
export async function saveAdditionalDetails(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, application } = await ownedApplication(String(formData.get('applicationId') ?? ''));
  if (!isEditable(application.status)) return { ok: false, message: 'This application can no longer be edited.' };

  const fields = await prisma.formField.findMany({
    where: { exerciseId: application.exerciseId, enabled: true },
  });
  const extra: Record<string, string> = {};
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const value = String(formData.get(`field_${field.key}`) ?? '').trim();
    if (field.required && !value) errors[`field_${field.key}`] = `${field.label} is required.`;
    if (value) extra[field.key] = value.slice(0, 2000);
  }
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, message: 'Please complete the required additional fields.' };
  }

  await prisma.application.update({
    where: { id: application.id },
    data: {
      skills: String(formData.get('skills') ?? '').trim().slice(0, 2000) || null,
      extraData: Object.keys(extra).length ? JSON.stringify(extra) : null,
    },
  });
  await recordAudit({
    action: AUDIT_ACTIONS.APPLICATION_UPDATED,
    actor: user,
    entityType: 'Application',
    entityId: application.id,
    summary: 'Saved additional application details',
  });
  revalidatePath(`/portal/applications/${application.id}`);
  return flashOk('Additional details saved.');
}

/** Module 2.4 - secure document upload with type and size validation. */
export async function uploadDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, application } = await ownedApplication(String(formData.get('applicationId') ?? ''));
  if (!isEditable(application.status)) {
    return { ok: false, message: 'Documents cannot be changed at this stage of your application.' };
  }

  const requirementId = String(formData.get('requirementId') ?? '');
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Select a file to upload.' };
  }

  const requirement = requirementId
    ? application.exercise.requirements.find((r) => r.id === requirementId)
    : undefined;
  const docTypeRaw = requirement?.code ?? String(formData.get('docType') ?? 'OTHER');
  const known = DOCUMENT_TYPES.find((t) => t.code === docTypeRaw);
  const docType = known?.code ?? 'OTHER';
  const label = requirement?.label ?? known?.label ?? 'Other document';

  const acceptTypes = (requirement?.acceptTypes ?? known?.accept ?? 'application/pdf,image/jpeg,image/png')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const maxBytes = (requirement?.maxSizeMb ?? known?.maxMb ?? 5) * 1024 * 1024;

  let stored;
  try {
    stored = await storeFile(file, { acceptTypes, maxBytes });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof UploadError ? error.message : 'The file could not be uploaded.',
    };
  }

  // Supersede any previous upload for the same requirement, keeping review history.
  const previous = await prisma.applicantDocument.findFirst({
    where: { applicationId: application.id, docType, supersededById: null },
    orderBy: { version: 'desc' },
  });

  const document = await prisma.applicantDocument.create({
    data: {
      applicationId: application.id,
      requirementId: requirement?.id ?? null,
      docType,
      label,
      storedName: stored.storedName,
      originalName: stored.originalName,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      checksum: stored.checksum,
      version: (previous?.version ?? 0) + 1,
    },
  });

  if (previous) {
    await prisma.applicantDocument.update({
      where: { id: previous.id },
      data: { supersededById: document.id },
    });
    await deleteStoredFile(previous.storedName);
    await prisma.applicantDocument.delete({ where: { id: previous.id } }).catch(() => undefined);
  }

  await refreshCompleteness(application.id);
  await recordAudit({
    action: AUDIT_ACTIONS.DOCUMENT_UPLOADED,
    actor: user,
    entityType: 'ApplicantDocument',
    entityId: document.id,
    summary: `Uploaded ${label} (${stored.originalName}) to application ${application.reference}`,
    metadata: { sizeBytes: stored.sizeBytes, mimeType: stored.mimeType, version: document.version },
  });

  revalidatePath(`/portal/applications/${application.id}`);
  revalidatePath('/portal/documents');
  return flashOk(`${label} uploaded successfully.`);
}

export async function deleteDocument(formData: FormData): Promise<void> {
  const documentId = String(formData.get('documentId') ?? '');
  const user = await requireApplicant();
  const document = await prisma.applicantDocument.findFirst({
    where: { id: documentId, application: { applicantId: user.id } },
    include: { application: { select: { id: true, status: true, reference: true } } },
  });
  if (!document) return;
  if (!isEditable(document.application.status)) return;

  await deleteStoredFile(document.storedName);
  await prisma.applicantDocument.delete({ where: { id: document.id } });
  await refreshCompleteness(document.application.id);
  await recordAudit({
    action: AUDIT_ACTIONS.DOCUMENT_DELETED,
    actor: user,
    entityType: 'ApplicantDocument',
    entityId: document.id,
    summary: `Removed ${document.label} from application ${document.application.reference}`,
  });
  revalidatePath(`/portal/applications/${document.application.id}`);
}

export async function removeEntry(formData: FormData): Promise<void> {
  const kind = String(formData.get('kind') ?? '');
  const id = String(formData.get('id') ?? '');
  const user = await requireApplicant();

  const where = { id, application: { applicantId: user.id } } as const;
  let applicationId: string | null = null;

  if (kind === 'education') {
    const row = await prisma.applicationEducation.findFirst({ where, select: { applicationId: true, application: { select: { status: true } } } });
    if (row && isEditable(row.application.status)) {
      await prisma.applicationEducation.delete({ where: { id } });
      applicationId = row.applicationId;
    }
  } else if (kind === 'employment') {
    const row = await prisma.applicationEmployment.findFirst({ where, select: { applicationId: true, application: { select: { status: true } } } });
    if (row && isEditable(row.application.status)) {
      await prisma.applicationEmployment.delete({ where: { id } });
      applicationId = row.applicationId;
    }
  } else if (kind === 'referee') {
    const row = await prisma.applicationReferee.findFirst({ where, select: { applicationId: true, application: { select: { status: true } } } });
    if (row && isEditable(row.application.status)) {
      await prisma.applicationReferee.delete({ where: { id } });
      applicationId = row.applicationId;
    }
  }

  if (applicationId) {
    await refreshCompleteness(applicationId);
    await recordAudit({
      action: AUDIT_ACTIONS.APPLICATION_UPDATED,
      actor: user,
      entityType: 'Application',
      entityId: applicationId,
      summary: `Removed ${kind} entry`,
    });
    revalidatePath(`/portal/applications/${applicationId}`);
  }
}

/** Module 2.3 - final submission with validation of all mandatory fields. */
export async function submitApplication(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, application } = await ownedApplication(String(formData.get('applicationId') ?? ''));

  if (!isEditable(application.status)) {
    return { ok: false, message: 'This application has already been submitted.' };
  }
  const open = exerciseAcceptsApplications(application.exercise);
  if (!open.ok) return { ok: false, message: open.reason };

  const parsed = parseForm(submitApplicationSchema, formData);
  if (!parsed.success) {
    return { ok: false, errors: parsed.errors, message: 'You must confirm the declaration and consent before submitting.' };
  }

  await prisma.application.update({
    where: { id: application.id },
    data: { declaration: true, consent: true },
  });
  const completeness = await refreshCompleteness(application.id);
  if (!completeness.canSubmit) {
    return {
      ok: false,
      message: `Your application is not yet complete. Outstanding: ${completeness.missing.join('; ')}.`,
    };
  }

  try {
    assertApplicationTransition(application.status, APPLICATION_STATUS.SUBMITTED);
  } catch (error) {
    return { ok: false, message: error instanceof WorkflowError ? error.message : 'Unable to submit.' };
  }

  const submittedAt = new Date();
  await applyStatusChange({
    applicationId: application.id,
    toStatus: APPLICATION_STATUS.SUBMITTED,
    actor: user,
    remarks: 'Application submitted by applicant',
    extra: { submittedAt },
  });
  await recordAudit({
    action: AUDIT_ACTIONS.APPLICATION_SUBMITTED,
    actor: user,
    entityType: 'Application',
    entityId: application.id,
    summary: `Application ${application.reference} submitted`,
  });

  const detail = await prisma.application.findUniqueOrThrow({
    where: { id: application.id },
    include: {
      vacancy: { select: { jobTitle: true, gradeLevel: true } },
      exercise: { select: { title: true } },
      applicant: { select: { email: true, phone: true, applicantProfile: { select: { firstName: true, surname: true } } } },
    },
  });

  await sendTemplated(
    TEMPLATES.APPLICATION_ACKNOWLEDGEMENT,
    { userId: user.id, email: detail.applicant.email, phone: detail.applicant.phone },
    {
      name: `${detail.applicant.applicantProfile?.firstName ?? ''} ${detail.applicant.applicantProfile?.surname ?? ''}`.trim(),
      reference: detail.reference,
      exercise: detail.exercise.title,
      position: detail.vacancy ? `${detail.vacancy.jobTitle} (${detail.vacancy.gradeLevel})` : 'Not specified',
      submittedAt: formatDateTime(submittedAt),
    },
  );

  revalidatePath('/portal');
  revalidatePath(`/portal/applications/${application.id}`);
  return flashOk(`Your application has been submitted. Your reference number is ${application.reference}. An acknowledgement has been sent to you.`);
}

export async function withdrawApplication(formData: FormData): Promise<void> {
  const { user, application } = await ownedApplication(String(formData.get('applicationId') ?? ''));
  try {
    assertApplicationTransition(application.status, APPLICATION_STATUS.WITHDRAWN);
  } catch {
    return;
  }
  await applyStatusChange({
    applicationId: application.id,
    toStatus: APPLICATION_STATUS.WITHDRAWN,
    actor: user,
    remarks: String(formData.get('reason') ?? 'Withdrawn by applicant'),
    extra: { withdrawnAt: new Date() },
  });
  await recordAudit({
    action: AUDIT_ACTIONS.APPLICATION_WITHDRAWN,
    actor: user,
    entityType: 'Application',
    entityId: application.id,
    summary: `Application ${application.reference} withdrawn by applicant`,
  });
  revalidatePath('/portal');
  redirect('/portal/applications?withdrawn=1');
}

export async function markNotificationRead(formData: FormData): Promise<void> {
  const user = await requireApplicant();
  const id = String(formData.get('notificationId') ?? '');
  await prisma.notification.updateMany({
    where: { id, userId: user.id, readAt: null },
    data: { readAt: new Date(), status: 'READ' },
  });
  revalidatePath('/portal/notifications');
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await requireApplicant();
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date(), status: 'READ' },
  });
  revalidatePath('/portal/notifications');
}
