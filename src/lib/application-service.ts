/** Shared application helpers used by both applicant and officer flows. */
import 'server-only';
import { prisma } from './db';
import { computeCompleteness, stageForStatus, type CompletenessResult } from './workflow';
import { APPLICATION_STATUS } from './constants';
import { recordAudit, AUDIT_ACTIONS } from './audit';
import type { SessionUser } from './auth';

export const APPLICATION_DETAIL_INCLUDE = {
  exercise: {
    include: { requirements: { orderBy: { position: 'asc' as const } }, formFields: { where: { enabled: true }, orderBy: { position: 'asc' as const } } },
  },
  vacancy: { include: { department: { select: { name: true } } } },
  applicant: { include: { applicantProfile: true } },
  education: { orderBy: { position: 'asc' as const } },
  employment: { orderBy: { position: 'asc' as const } },
  referees: true,
  nextOfKin: true,
  documents: { orderBy: { createdAt: 'asc' as const }, include: { requirement: true } },
  screenings: { orderBy: { createdAt: 'desc' as const }, include: { officer: { select: { fullName: true, role: true } } } },
  statusHistory: { orderBy: { createdAt: 'desc' as const } },
} as const;

/** Recompute and persist an application's completeness. */
export async function refreshCompleteness(applicationId: string): Promise<CompletenessResult> {
  const app = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: {
      exercise: { include: { requirements: true } },
      applicant: { include: { applicantProfile: true } },
      education: { select: { id: true } },
      employment: { select: { id: true } },
      referees: { select: { id: true } },
      nextOfKin: { select: { id: true } },
      documents: { select: { requirementId: true, docType: true, reviewStatus: true } },
    },
  });

  const requiredReqs = app.exercise.requirements.filter((r) => r.required);
  const uploadedCodes = new Set(
    app.documents
      .filter((d) => d.reviewStatus !== 'REJECTED')
      .map((d) => d.docType),
  );
  const requiredUploaded = requiredReqs.filter((r) => uploadedCodes.has(r.code)).length;

  const profile = app.applicant.applicantProfile;
  const hasProfile = Boolean(
    profile &&
      profile.surname &&
      profile.firstName &&
      profile.gender &&
      profile.dateOfBirth &&
      profile.phone &&
      profile.residentialAddress &&
      profile.stateOfOrigin &&
      profile.lga,
  );

  const result = computeCompleteness({
    hasProfile,
    vacancySelected: Boolean(app.vacancyId),
    educationCount: app.education.length,
    employmentCount: app.employment.length,
    refereeCount: app.referees.length,
    hasNextOfKin: Boolean(app.nextOfKin),
    requiredDocsTotal: requiredReqs.length,
    requiredDocsUploaded: requiredUploaded,
    declaration: app.declaration,
    consent: app.consent,
  });

  await prisma.application.update({
    where: { id: applicationId },
    data: { completeness: result.percent },
  });
  return result;
}

/**
 * Change an application's status, maintaining stage, history and audit trail.
 * Transition legality is enforced by the caller via assertApplicationTransition.
 */
export async function applyStatusChange(opts: {
  applicationId: string;
  toStatus: string;
  actor?: SessionUser | null;
  remarks?: string;
  extra?: Record<string, unknown>;
}): Promise<void> {
  const current = await prisma.application.findUniqueOrThrow({
    where: { id: opts.applicationId },
    select: { status: true, reference: true },
  });
  const stage = stageForStatus(opts.toStatus);

  await prisma.$transaction([
    prisma.application.update({
      where: { id: opts.applicationId },
      data: { status: opts.toStatus, stage, ...(opts.extra ?? {}) },
    }),
    prisma.applicationStatusHistory.create({
      data: {
        applicationId: opts.applicationId,
        fromStatus: current.status,
        toStatus: opts.toStatus,
        stage,
        changedById: opts.actor?.id ?? null,
        changedByName: opts.actor?.fullName ?? 'System',
        remarks: opts.remarks ?? null,
      },
    }),
  ]);

  await recordAudit({
    action: AUDIT_ACTIONS.APPLICATION_STATUS_CHANGED,
    actor: opts.actor ?? null,
    entityType: 'Application',
    entityId: opts.applicationId,
    summary: `Application ${current.reference}: ${current.status} → ${opts.toStatus}`,
    metadata: { from: current.status, to: opts.toStatus, remarks: opts.remarks },
  });
}

/** Whether an exercise is currently open for new applications. */
export function exerciseAcceptsApplications(exercise: {
  status: string;
  opensAt: Date;
  closesAt: Date;
}, now = new Date()): { ok: boolean; reason?: string } {
  if (exercise.status !== 'PUBLISHED') {
    return { ok: false, reason: 'This recruitment exercise is not open for applications.' };
  }
  if (exercise.opensAt > now) {
    return { ok: false, reason: 'Applications for this exercise have not yet opened.' };
  }
  if (exercise.closesAt <= now) {
    return { ok: false, reason: 'The closing date for this exercise has passed.' };
  }
  return { ok: true };
}

export const EDITABLE_STATUSES: string[] = [
  APPLICATION_STATUS.DRAFT,
  APPLICATION_STATUS.RESUBMISSION_REQUIRED,
  APPLICATION_STATUS.INCOMPLETE,
];

export function isEditable(status: string): boolean {
  return EDITABLE_STATUSES.includes(status);
}
