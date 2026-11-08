'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { flashOk, setFlash } from '@/lib/flash';
import { requirePermission } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/rbac';
import { documentReviewSchema, parseForm, screeningSchema } from '@/lib/validation';
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { sendTemplated, TEMPLATES } from '@/lib/notifications';
import { APPLICATION_STATUS, SCREENING_OUTCOMES } from '@/lib/constants';
import { assertApplicationTransition, WorkflowError } from '@/lib/workflow';
import { applyStatusChange, refreshCompleteness } from '@/lib/application-service';
import { runAutoChecks, yearsOfExperience } from '@/lib/screening';
import { age, formatDate } from '@/lib/format';
import type { ActionState } from './public';

/** Module 2.5 - assign applications to screening officers (bulk). */
export async function assignScreening(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.SCREENING_ASSIGN);
  const officerId = String(formData.get('officerId') ?? '');
  const ids = formData.getAll('applicationIds').map(String).filter(Boolean);

  if (!officerId) return { ok: false, message: 'Select a screening officer.' };
  if (ids.length === 0) return { ok: false, message: 'Select at least one application to assign.' };

  const officer = await prisma.user.findUnique({ where: { id: officerId } });
  if (!officer || !officer.active) return { ok: false, message: 'That officer account is not available.' };

  const applications = await prisma.application.findMany({
    where: {
      id: { in: ids },
      status: { in: [APPLICATION_STATUS.SUBMITTED, APPLICATION_STATUS.UNDER_SCREENING, APPLICATION_STATUS.RESUBMISSION_REQUIRED] },
    },
    select: { id: true, status: true, reference: true },
  });
  if (applications.length === 0) {
    return { ok: false, message: 'None of the selected applications are at a stage where they can be assigned.' };
  }

  for (const app of applications) {
    await prisma.screeningAssignment.upsert({
      where: { applicationId_officerId: { applicationId: app.id, officerId } },
      create: { applicationId: app.id, officerId, assignedById: user.id },
      update: { assignedAt: new Date(), completedAt: null, assignedById: user.id },
    });
    if (app.status !== APPLICATION_STATUS.UNDER_SCREENING) {
      try {
        assertApplicationTransition(app.status, APPLICATION_STATUS.UNDER_SCREENING);
        await applyStatusChange({
          applicationId: app.id,
          toStatus: APPLICATION_STATUS.UNDER_SCREENING,
          actor: user,
          remarks: `Assigned to ${officer.fullName} for screening`,
        });
      } catch {
        /* leave status as is */
      }
    }
  }

  await recordAudit({
    action: AUDIT_ACTIONS.SCREENING_ASSIGNED,
    actor: user,
    entityType: 'ScreeningAssignment',
    summary: `Assigned ${applications.length} application(s) to ${officer.fullName} for screening`,
    metadata: { officerId, count: applications.length },
  });

  revalidatePath('/admin/screening');
  revalidatePath('/admin/applications');
  return flashOk(`${applications.length} application(s) assigned to ${officer.fullName}.`);
}

/** Module 2.5 - record a screening outcome for one application. */
export async function recordScreening(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.SCREENING_PERFORM);
  const applicationId = String(formData.get('applicationId') ?? '');
  const parsed = parseForm(screeningSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      exercise: { include: { requirements: true } },
      vacancy: true,
      applicant: { include: { applicantProfile: true } },
      education: true,
      employment: true,
      documents: true,
    },
  });
  if (!application) return { ok: false, message: 'Application not found.' };

  if (d.outcome === SCREENING_OUTCOMES.FAILED && !d.remarks) {
    return { ok: false, errors: { remarks: 'Record the reason for this decision.' }, message: 'Remarks are required when an application fails screening.' };
  }
  if (d.outcome === SCREENING_OUTCOMES.RESUBMISSION_REQUIRED && !d.remarks) {
    return { ok: false, errors: { remarks: 'State what the applicant must correct.' }, message: 'Remarks are required when requesting a correction.' };
  }

  const required = application.exercise.requirements.filter((r) => r.required);
  const uploadedCodes = new Set(application.documents.map((x) => x.docType));
  const autoChecks = runAutoChecks({
    completenessPercent: application.completeness,
    applicantAge: age(application.applicant.applicantProfile?.dateOfBirth),
    vacancy: application.vacancy,
    qualifications: application.education.map((e) => e.qualification),
    experienceYears: yearsOfExperience(application.employment),
    requiredDocsTotal: required.length,
    requiredDocsVerifiedOrPending: required.filter((r) => uploadedCodes.has(r.code)).length,
    rejectedDocs: application.documents.filter((x) => ['REJECTED', 'RESUBMISSION_REQUIRED'].includes(x.reviewStatus)).length,
  });

  const classification =
    d.classification ??
    (d.outcome === SCREENING_OUTCOMES.PASSED ? 'QUALIFIED' : autoChecks.suggestedClassification);

  await prisma.screeningRecord.create({
    data: {
      applicationId,
      officerId: user.id,
      completenessPass: d.completenessPass,
      eligibilityPass: d.eligibilityPass,
      qualificationPass: d.qualificationPass,
      experiencePass: d.experiencePass,
      documentsPass: d.documentsPass,
      outcome: d.outcome,
      classification,
      remarks: d.remarks || null,
      autoChecks: JSON.stringify(autoChecks.checks),
    },
  });

  await prisma.screeningAssignment.updateMany({
    where: { applicationId, officerId: user.id },
    data: { completedAt: new Date() },
  });

  const toStatus =
    d.outcome === SCREENING_OUTCOMES.PASSED
      ? APPLICATION_STATUS.QUALIFIED
      : d.outcome === SCREENING_OUTCOMES.RESUBMISSION_REQUIRED
        ? APPLICATION_STATUS.RESUBMISSION_REQUIRED
        : APPLICATION_STATUS.DISQUALIFIED;

  try {
    assertApplicationTransition(application.status, toStatus);
  } catch (error) {
    return { ok: false, message: error instanceof WorkflowError ? error.message : 'Invalid status change.' };
  }

  await applyStatusChange({
    applicationId,
    toStatus,
    actor: user,
    remarks: d.remarks || `Screening outcome: ${d.outcome}`,
    extra: { screeningOutcome: d.outcome, screeningAt: new Date() },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.SCREENING_RECORDED,
    actor: user,
    entityType: 'Application',
    entityId: applicationId,
    summary: `Screening outcome ${d.outcome} (${classification}) recorded for ${application.reference}`,
    metadata: { outcome: d.outcome, classification, remarks: d.remarks },
    sensitive: true,
  });

  const profile = application.applicant.applicantProfile;
  const recipient = {
    userId: application.applicantId,
    email: application.applicant.email,
    phone: application.applicant.phone,
  };
  const vars = {
    name: profile ? `${profile.firstName} ${profile.surname}` : application.applicant.fullName,
    reference: application.reference,
    exercise: application.exercise.title,
  };

  if (d.outcome === SCREENING_OUTCOMES.RESUBMISSION_REQUIRED) {
    const problemDocs = application.documents
      .filter((x) => ['REJECTED', 'RESUBMISSION_REQUIRED'].includes(x.reviewStatus))
      .map((x) => `• ${x.label}: ${x.reviewNotes ?? 'requires resubmission'}`)
      .join('\n');
    await sendTemplated(TEMPLATES.DOCUMENT_CORRECTION_REQUEST, recipient, {
      ...vars,
      documents: problemDocs || '• See the officer remarks below.',
      remarks: d.remarks ?? '',
      deadline: formatDate(application.exercise.closesAt),
    });
  } else {
    await sendTemplated(TEMPLATES.APPLICATION_STATUS_UPDATE, recipient, {
      ...vars,
      status: toStatus.replace(/_/g, ' ').toLowerCase(),
      remarks: d.remarks ?? '',
    });
  }

  revalidatePath(`/admin/applications/${applicationId}`);
  revalidatePath('/admin/screening');
  return flashOk(`Screening outcome recorded: ${d.outcome.replace(/_/g, ' ').toLowerCase()}.`);
}

/** Module 2.5 - bulk screening of straightforward cases. */
export async function bulkScreen(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.SCREENING_PERFORM);
  const ids = formData.getAll('applicationIds').map(String).filter(Boolean);
  const outcome = String(formData.get('outcome') ?? '');
  const remarks = String(formData.get('remarks') ?? '').trim();

  if (ids.length === 0) return { ok: false, message: 'Select at least one application.' };
  if (!['PASSED', 'FAILED', 'RESUBMISSION_REQUIRED'].includes(outcome)) {
    return { ok: false, message: 'Choose a screening outcome.' };
  }
  if (outcome !== 'PASSED' && !remarks) {
    return { ok: false, message: 'Remarks are required when failing applications or requesting corrections.' };
  }

  const toStatus =
    outcome === 'PASSED'
      ? APPLICATION_STATUS.QUALIFIED
      : outcome === 'RESUBMISSION_REQUIRED'
        ? APPLICATION_STATUS.RESUBMISSION_REQUIRED
        : APPLICATION_STATUS.DISQUALIFIED;

  const applications = await prisma.application.findMany({
    where: { id: { in: ids } },
    include: {
      exercise: { select: { title: true } },
      applicant: { select: { email: true, phone: true, fullName: true, applicantProfile: { select: { firstName: true, surname: true } } } },
    },
  });

  let processed = 0;
  const skipped: string[] = [];

  for (const app of applications) {
    try {
      assertApplicationTransition(app.status, toStatus);
    } catch {
      skipped.push(app.reference);
      continue;
    }
    await prisma.screeningRecord.create({
      data: {
        applicationId: app.id,
        officerId: user.id,
        completenessPass: outcome === 'PASSED',
        eligibilityPass: outcome === 'PASSED',
        qualificationPass: outcome === 'PASSED',
        experiencePass: outcome === 'PASSED',
        documentsPass: outcome === 'PASSED',
        outcome,
        classification: outcome === 'PASSED' ? 'QUALIFIED' : outcome === 'RESUBMISSION_REQUIRED' ? 'INCOMPLETE' : 'DISQUALIFIED',
        remarks: remarks || `Bulk screening outcome: ${outcome}`,
      },
    });
    await applyStatusChange({
      applicationId: app.id,
      toStatus,
      actor: user,
      remarks: remarks || `Bulk screening outcome: ${outcome}`,
      extra: { screeningOutcome: outcome, screeningAt: new Date() },
    });
    await prisma.screeningAssignment.updateMany({
      where: { applicationId: app.id, officerId: user.id },
      data: { completedAt: new Date() },
    });
    await sendTemplated(
      TEMPLATES.APPLICATION_STATUS_UPDATE,
      { userId: app.applicantId, email: app.applicant.email, phone: app.applicant.phone },
      {
        name: app.applicant.applicantProfile
          ? `${app.applicant.applicantProfile.firstName} ${app.applicant.applicantProfile.surname}`
          : app.applicant.fullName,
        reference: app.reference,
        exercise: app.exercise.title,
        status: toStatus.replace(/_/g, ' ').toLowerCase(),
        remarks,
      },
    );
    processed += 1;
  }

  await recordAudit({
    action: AUDIT_ACTIONS.SCREENING_RECORDED,
    actor: user,
    entityType: 'Application',
    summary: `Bulk screening: ${processed} application(s) marked ${outcome}`,
    metadata: { outcome, processed, skipped },
    sensitive: true,
  });

  revalidatePath('/admin/screening');
  revalidatePath('/admin/applications');
  return flashOk(`${processed} application(s) screened.${skipped.length ? ` ${skipped.length} skipped (not at a valid stage): ${skipped.slice(0, 5).join(', ')}${skipped.length > 5 ? '…' : ''}` : ''}`);
}

/** Module 2.4 - document verification by a document officer. */
export async function reviewDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.DOCUMENT_REVIEW);
  const documentId = String(formData.get('documentId') ?? '');
  const parsed = parseForm(documentReviewSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;

  if (d.outcome !== 'VERIFIED' && !d.notes) {
    return {
      ok: false,
      errors: { notes: 'Record the deficiency so the applicant knows what to correct.' },
      message: 'Reasons are required when rejecting a document or requesting resubmission.',
    };
  }

  const document = await prisma.applicantDocument.findUnique({
    where: { id: documentId },
    include: { application: { select: { id: true, reference: true } } },
  });
  if (!document) return { ok: false, message: 'Document not found.' };

  await prisma.$transaction([
    prisma.applicantDocument.update({
      where: { id: documentId },
      data: {
        reviewStatus: d.outcome,
        reviewNotes: d.notes || null,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    }),
    prisma.documentReview.create({
      data: { documentId, officerId: user.id, outcome: d.outcome, notes: d.notes || null },
    }),
  ]);

  await refreshCompleteness(document.application.id);
  await recordAudit({
    action: AUDIT_ACTIONS.DOCUMENT_REVIEWED,
    actor: user,
    entityType: 'ApplicantDocument',
    entityId: documentId,
    summary: `Document "${document.label}" on ${document.application.reference} marked ${d.outcome}`,
    metadata: { outcome: d.outcome, notes: d.notes },
    sensitive: true,
  });

  revalidatePath(`/admin/applications/${document.application.id}`);
  revalidatePath('/admin/documents');
  return flashOk(`Document marked ${d.outcome.replace(/_/g, ' ').toLowerCase()}.`);
}

/** Module 2.5 - prepare a shortlist from qualified applications. */
export async function createShortlist(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.SHORTLIST_PREPARE);
  const exerciseId = String(formData.get('exerciseId') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const ids = formData.getAll('applicationIds').map(String).filter(Boolean);

  if (!title) return { ok: false, message: 'Give the shortlist a title.' };
  if (ids.length === 0) return { ok: false, message: 'Select at least one qualified application.' };

  const exercise = await prisma.recruitmentExercise.findUnique({ where: { id: exerciseId } });
  if (!exercise) return { ok: false, message: 'Recruitment exercise not found.' };

  const eligible = await prisma.application.findMany({
    where: { id: { in: ids }, exerciseId, status: APPLICATION_STATUS.QUALIFIED },
    select: { id: true },
  });
  if (eligible.length === 0) {
    return { ok: false, message: 'None of the selected applications are marked as qualified.' };
  }

  const shortlist = await prisma.shortlist.create({
    data: {
      exerciseId,
      title,
      preparedById: user.id,
      entries: { create: eligible.map((e, i) => ({ applicationId: e.id, rank: i + 1 })) },
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.SHORTLIST_CREATED,
    actor: user,
    entityType: 'Shortlist',
    entityId: shortlist.id,
    summary: `Prepared shortlist "${title}" with ${eligible.length} candidate(s) for ${exercise.reference}`,
  });

  revalidatePath('/admin/shortlists');
  return flashOk(`Shortlist created with ${eligible.length} candidate(s)${eligible.length < ids.length ? ` (${ids.length - eligible.length} skipped — not qualified)` : ''}. Submit it for approval when ready.`);
}

/** Shortlist approval workflow with candidate notification. */
export async function decideShortlist(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const shortlistId = String(formData.get('shortlistId') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const note = String(formData.get('note') ?? '').trim();

  const user = await requirePermission(
    decision === 'SUBMIT' ? PERMISSIONS.SHORTLIST_PREPARE : PERMISSIONS.SHORTLIST_APPROVE,
  );

  const shortlist = await prisma.shortlist.findUnique({
    where: { id: shortlistId },
    include: {
      exercise: { select: { id: true, title: true, reference: true } },
      entries: {
        include: {
          application: {
            include: {
              applicant: { select: { email: true, phone: true, fullName: true, applicantProfile: { select: { firstName: true, surname: true } } } },
              vacancy: { select: { jobTitle: true, gradeLevel: true } },
            },
          },
        },
      },
    },
  });
  if (!shortlist) return { ok: false, message: 'Shortlist not found.' };

  if (decision === 'SUBMIT') {
    if (shortlist.status !== 'DRAFT') return { ok: false, message: 'Only a draft shortlist can be submitted for approval.' };
    await prisma.shortlist.update({ where: { id: shortlistId }, data: { status: 'PENDING_APPROVAL' } });
    await prisma.approvalRequest.create({
      data: {
        entityType: 'SHORTLIST',
        entityId: shortlistId,
        exerciseId: shortlist.exerciseId,
        action: 'APPROVE_SHORTLIST',
        requestedById: user.id,
        requestedByName: user.fullName,
        note: note || null,
      },
    });
    await recordAudit({
      action: AUDIT_ACTIONS.SHORTLIST_SUBMITTED,
      actor: user,
      entityType: 'Shortlist',
      entityId: shortlistId,
      summary: `Shortlist "${shortlist.title}" submitted for approval`,
    });
    revalidatePath('/admin/shortlists');
    return flashOk('Shortlist submitted for approval.');
  }

  if (decision === 'REJECT') {
    if (shortlist.status !== 'PENDING_APPROVAL') return { ok: false, message: 'Only a shortlist awaiting approval can be rejected.' };
    if (!note) return { ok: false, message: 'State the reason for rejecting the shortlist.' };
    await prisma.shortlist.update({
      where: { id: shortlistId },
      data: { status: 'DRAFT', rejectionNote: note },
    });
    await prisma.approvalRequest.updateMany({
      where: { entityType: 'SHORTLIST', entityId: shortlistId, status: 'PENDING' },
      data: { status: 'REJECTED', decidedById: user.id, decidedByName: user.fullName, decidedAt: new Date(), note },
    });
    await recordAudit({
      action: AUDIT_ACTIONS.SHORTLIST_REJECTED,
      actor: user,
      entityType: 'Shortlist',
      entityId: shortlistId,
      summary: `Shortlist "${shortlist.title}" returned to the preparing officer — ${note}`,
      sensitive: true,
    });
    revalidatePath('/admin/shortlists');
    return flashOk('Shortlist returned to the preparing officer.');
  }

  if (decision !== 'APPROVE') return { ok: false, message: 'Unknown decision.' };
  if (shortlist.status !== 'PENDING_APPROVAL') {
    return { ok: false, message: 'Only a shortlist awaiting approval can be approved.' };
  }

  const now = new Date();
  let notified = 0;
  for (const entry of shortlist.entries) {
    const app = entry.application;
    try {
      assertApplicationTransition(app.status, APPLICATION_STATUS.SHORTLISTED);
    } catch {
      continue;
    }
    await applyStatusChange({
      applicationId: app.id,
      toStatus: APPLICATION_STATUS.SHORTLISTED,
      actor: user,
      remarks: `Shortlisted under "${shortlist.title}" (approved)`,
      extra: { shortlisted: true },
    });
    await sendTemplated(
      TEMPLATES.SHORTLIST_NOTIFICATION,
      { userId: app.applicantId, email: app.applicant.email, phone: app.applicant.phone },
      {
        name: app.applicant.applicantProfile
          ? `${app.applicant.applicantProfile.firstName} ${app.applicant.applicantProfile.surname}`
          : app.applicant.fullName,
        reference: app.reference,
        exercise: shortlist.exercise.title,
        position: app.vacancy ? `${app.vacancy.jobTitle} (${app.vacancy.gradeLevel})` : 'the advertised position',
      },
    );
    notified += 1;
  }

  await prisma.shortlist.update({
    where: { id: shortlistId },
    data: { status: 'APPROVED', approvedById: user.id, approvedAt: now, notifiedAt: now, rejectionNote: null },
  });
  await prisma.approvalRequest.updateMany({
    where: { entityType: 'SHORTLIST', entityId: shortlistId, status: 'PENDING' },
    data: { status: 'APPROVED', decidedById: user.id, decidedByName: user.fullName, decidedAt: now, note: note || null },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.SHORTLIST_APPROVED,
    actor: user,
    entityType: 'Shortlist',
    entityId: shortlistId,
    summary: `Shortlist "${shortlist.title}" approved; ${notified} candidate(s) shortlisted and notified`,
    metadata: { notified, total: shortlist.entries.length },
    sensitive: true,
  });

  revalidatePath('/admin/shortlists');
  revalidatePath('/admin/applications');
  return flashOk(`Shortlist approved. ${notified} candidate(s) marked shortlisted and notified.`);
}

export async function removeShortlistEntry(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.SHORTLIST_PREPARE);
  const id = String(formData.get('entryId') ?? '');
  const entry = await prisma.shortlistEntry.findUnique({
    where: { id },
    include: { shortlist: { select: { id: true, status: true, title: true } } },
  });
  if (!entry || entry.shortlist.status !== 'DRAFT') return;
  await prisma.shortlistEntry.delete({ where: { id } });
  await recordAudit({
    action: AUDIT_ACTIONS.SHORTLIST_CREATED,
    actor: user,
    entityType: 'Shortlist',
    entityId: entry.shortlist.id,
    summary: `Removed a candidate from shortlist "${entry.shortlist.title}"`,
  });
  revalidatePath(`/admin/shortlists/${entry.shortlist.id}`);
}
