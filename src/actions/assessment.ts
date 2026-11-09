'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { flashOk, setFlash } from '@/lib/flash';
import { requirePermission, requireUser } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import {
  examCentreSchema, examScheduleSchema, interviewScheduleSchema,
  panelSchema, parseForm, selectionListSchema,
} from '@/lib/validation';
import { examNumber } from '@/lib/ids';
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { sendTemplated, TEMPLATES } from '@/lib/notifications';
import { APPLICATION_STATUS, DEFAULT_INTERVIEW_CRITERIA } from '@/lib/constants';
import { assertApplicationTransition } from '@/lib/workflow';
import { applyStatusChange } from '@/lib/application-service';
import {
  consolidatePanelScores, finalScore, parseBulkScores, parseCriteria,
  rankEntries, totalInterviewScore, validateScore, ScoreError,
} from '@/lib/scoring';
import { formatDate } from '@/lib/format';
import type { ActionState } from './public';

// ---------------------------------------------------------------------------
// MODULE 2.6 - EXAMINATION AND ASSESSMENT
// ---------------------------------------------------------------------------

export async function createExamSchedule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.EXAM_MANAGE);
  const exerciseId = String(formData.get('exerciseId') ?? '');
  const parsed = parseForm(examScheduleSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;
  const exercise = await prisma.recruitmentExercise.findUnique({ where: { id: exerciseId } });
  if (!exercise) return { ok: false, message: 'Recruitment exercise not found.' };

  const schedule = await prisma.examSchedule.create({
    data: {
      exerciseId,
      title: d.title,
      examDate: d.examDate,
      startTime: d.startTime,
      endTime: d.endTime || null,
      totalMarks: d.totalMarks,
      passMark: d.passMark,
      instructions: d.instructions || null,
      createdById: user.id,
    },
  });
  await recordAudit({
    action: AUDIT_ACTIONS.EXAM_CREATED,
    actor: user,
    entityType: 'ExamSchedule',
    entityId: schedule.id,
    summary: `Created examination "${d.title}" on ${formatDate(d.examDate)} for ${exercise.reference}`,
  });
  revalidatePath('/admin/examinations');
  redirect(`/admin/examinations/${schedule.id}`);
}

export async function addExamCentre(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.EXAM_MANAGE);
  const scheduleId = String(formData.get('scheduleId') ?? '');
  const parsed = parseForm(examCentreSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;
  await prisma.examCentre.create({
    data: {
      scheduleId,
      name: d.name,
      address: d.address || null,
      lga: d.lga || null,
      capacity: d.capacity,
      supervisor: d.supervisor || null,
    },
  });
  await recordAudit({
    action: AUDIT_ACTIONS.EXAM_UPDATED,
    actor: user,
    entityType: 'ExamCentre',
    entityId: scheduleId,
    summary: `Added examination centre "${d.name}" (capacity ${d.capacity})`,
  });
  revalidatePath(`/admin/examinations/${scheduleId}`);
  return flashOk('Examination centre added.');
}

export async function deleteExamCentre(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.EXAM_MANAGE);
  const id = String(formData.get('id') ?? '');
  const centre = await prisma.examCentre.findUnique({
    where: { id },
    include: { _count: { select: { candidates: true } } },
  });
  if (!centre || centre._count.candidates > 0) return;
  await prisma.examCentre.delete({ where: { id } });
  await recordAudit({
    action: AUDIT_ACTIONS.EXAM_UPDATED,
    actor: user,
    entityType: 'ExamCentre',
    entityId: id,
    summary: `Removed examination centre "${centre.name}"`,
  });
  revalidatePath(`/admin/examinations/${centre.scheduleId}`);
}

/**
 * Allocate the next examination number for a year.
 *
 * Examination numbers identify a candidate across the whole portal, so the
 * sequence continues from the highest number already issued for that year
 * rather than restarting for each schedule.
 */
async function nextExamSequence(year: number): Promise<number> {
  const prefix = `KGE/${year}/`;
  const latest = await prisma.examCandidate.findFirst({
    where: { examNumber: { startsWith: prefix } },
    orderBy: { examNumber: 'desc' },
    select: { examNumber: true },
  });
  if (!latest) return 0;
  const tail = Number(latest.examNumber.slice(prefix.length));
  return Number.isFinite(tail) ? tail : 0;
}

/** Assign shortlisted candidates to an examination, allocating centres automatically. */
export async function assignExamCandidates(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.EXAM_MANAGE);
  const scheduleId = String(formData.get('scheduleId') ?? '');
  const ids = formData.getAll('applicationIds').map(String).filter(Boolean);
  const notify = formData.get('notify') === 'true';

  if (ids.length === 0) return { ok: false, message: 'Select at least one shortlisted candidate.' };

  const schedule = await prisma.examSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      exercise: { select: { id: true, title: true } },
      centres: { orderBy: { name: 'asc' }, include: { _count: { select: { candidates: true } } } },
      _count: { select: { candidates: true } },
    },
  });
  if (!schedule) return { ok: false, message: 'Examination schedule not found.' };
  if (schedule.centres.length === 0) {
    return { ok: false, message: 'Add at least one examination centre before assigning candidates.' };
  }

  const applications = await prisma.application.findMany({
    where: { id: { in: ids }, exerciseId: schedule.exercise.id, status: APPLICATION_STATUS.SHORTLISTED },
    include: {
      applicant: { select: { email: true, phone: true, fullName: true, applicantProfile: { select: { firstName: true, surname: true, lga: true } } } },
      vacancy: { select: { jobTitle: true, gradeLevel: true } },
    },
  });
  if (applications.length === 0) {
    return { ok: false, message: 'None of the selected applications are shortlisted for this exercise.' };
  }

  // Remaining capacity per centre, preferring the applicant's own LGA.
  const capacity = new Map(
    schedule.centres.map((c) => [c.id, c.capacity - c._count.candidates]),
  );
  const year = schedule.examDate.getFullYear();
  let seq = await nextExamSequence(year);
  let assigned = 0;
  let notified = 0;
  const overflow: string[] = [];

  for (const app of applications) {
    const existing = await prisma.examCandidate.findUnique({
      where: { scheduleId_applicationId: { scheduleId, applicationId: app.id } },
    });
    if (existing) continue;

    const lga = app.applicant.applicantProfile?.lga;
    const preferred = schedule.centres.find((c) => c.lga && lga && c.lga === lga && (capacity.get(c.id) ?? 0) > 0);
    const centre = preferred ?? schedule.centres.find((c) => (capacity.get(c.id) ?? 0) > 0);
    if (!centre) {
      overflow.push(app.reference);
      continue;
    }
    capacity.set(centre.id, (capacity.get(centre.id) ?? 0) - 1);
    seq += 1;

    const seatNumber = `${centre.name.slice(0, 3).toUpperCase()}-${String((centre.capacity - (capacity.get(centre.id) ?? 0))).padStart(3, '0')}`;

    // Retry on the remote chance that two officers allocate at the same moment.
    let candidate: Awaited<ReturnType<typeof prisma.examCandidate.create>> | null = null;
    for (let attempt = 0; attempt < 5 && !candidate; attempt += 1) {
      try {
        candidate = await prisma.examCandidate.create({
          data: {
            scheduleId,
            applicationId: app.id,
            centreId: centre.id,
            examNumber: examNumber(seq, schedule.examDate),
            seatNumber,
          },
        });
      } catch (error) {
        if (
          typeof error === 'object' && error !== null &&
          (error as { code?: string }).code === 'P2002'
        ) {
          seq = Math.max(seq + 1, (await nextExamSequence(year)) + 1);
          continue;
        }
        throw error;
      }
    }
    if (!candidate) {
      overflow.push(app.reference);
      continue;
    }

    try {
      assertApplicationTransition(app.status, APPLICATION_STATUS.EXAM_SCHEDULED);
      await applyStatusChange({
        applicationId: app.id,
        toStatus: APPLICATION_STATUS.EXAM_SCHEDULED,
        actor: user,
        remarks: `Scheduled for ${schedule.title} at ${centre.name}`,
      });
    } catch {
      /* already at or past this stage */
    }

    if (notify) {
      await sendTemplated(
        TEMPLATES.EXAM_INVITATION,
        { userId: app.applicantId, email: app.applicant.email, phone: app.applicant.phone },
        {
          name: app.applicant.applicantProfile
            ? `${app.applicant.applicantProfile.firstName} ${app.applicant.applicantProfile.surname}`
            : app.applicant.fullName,
          examNumber: candidate.examNumber,
          exercise: schedule.exercise.title,
          date: formatDate(schedule.examDate),
          time: schedule.startTime,
          centre: centre.name,
          address: centre.address ?? 'See the Commission notice board',
        },
      );
      await prisma.examCandidate.update({ where: { id: candidate.id }, data: { notifiedAt: new Date() } });
      notified += 1;
    }
    assigned += 1;
  }

  await recordAudit({
    action: AUDIT_ACTIONS.EXAM_CANDIDATES_ASSIGNED,
    actor: user,
    entityType: 'ExamSchedule',
    entityId: scheduleId,
    summary: `Assigned ${assigned} candidate(s) to examination "${schedule.title}"${notified ? `; ${notified} notified` : ''}`,
    metadata: { assigned, notified, overflow },
  });

  revalidatePath(`/admin/examinations/${scheduleId}`);
  return flashOk(`${assigned} candidate(s) assigned${notified ? ` and ${notified} notified` : ''}.${overflow.length ? ` ${overflow.length} could not be placed — centre capacity exhausted.` : ''}`);
}

export async function recordExamAttendanceAndScore(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.EXAM_SCORE);
  const candidateId = String(formData.get('candidateId') ?? '');
  const attendance = String(formData.get('attendance') ?? 'PENDING');
  const scoreRaw = String(formData.get('score') ?? '').trim();
  const remarks = String(formData.get('remarks') ?? '').trim();

  const candidate = await prisma.examCandidate.findUnique({
    where: { id: candidateId },
    include: { schedule: true, application: { select: { id: true, reference: true, status: true } } },
  });
  if (!candidate) return { ok: false, message: 'Candidate not found.' };

  let score: number | null = null;
  if (attendance === 'PRESENT' && scoreRaw !== '') {
    try {
      score = validateScore(scoreRaw, candidate.schedule.totalMarks);
    } catch (error) {
      return { ok: false, errors: { score: error instanceof ScoreError ? error.message : 'Invalid score.' }, message: 'Check the score entered.' };
    }
  }
  if (attendance === 'ABSENT') score = null;

  await prisma.examCandidate.update({
    where: { id: candidateId },
    data: {
      attendance,
      score,
      remarks: remarks || null,
      scoreEnteredById: score !== null ? user.id : null,
      scoreEnteredAt: score !== null ? new Date() : null,
      validated: false,
    },
  });
  if (score !== null) {
    await prisma.application.update({ where: { id: candidate.applicationId }, data: { examScore: score } });
  }

  await recordAudit({
    action: AUDIT_ACTIONS.EXAM_SCORE_RECORDED,
    actor: user,
    entityType: 'ExamCandidate',
    entityId: candidateId,
    summary: `Examination ${candidate.examNumber} (${candidate.application.reference}): attendance ${attendance}${score !== null ? `, score ${score}/${candidate.schedule.totalMarks}` : ''}`,
    metadata: { attendance, score, remarks },
    sensitive: true,
  });

  revalidatePath(`/admin/examinations/${candidate.scheduleId}`);
  return flashOk('Examination record saved.');
}

/** Bulk score upload: CSV of examNumber,score[,remarks]. */
export async function bulkUploadExamScores(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.EXAM_SCORE);
  const scheduleId = String(formData.get('scheduleId') ?? '');
  const file = formData.get('file');
  const pasted = String(formData.get('csv') ?? '');

  const schedule = await prisma.examSchedule.findUnique({
    where: { id: scheduleId },
    include: { candidates: { select: { id: true, examNumber: true, applicationId: true } } },
  });
  if (!schedule) return { ok: false, message: 'Examination schedule not found.' };

  let csv = pasted;
  if (file instanceof File && file.size > 0) {
    if (file.size > 2 * 1024 * 1024) return { ok: false, message: 'The score sheet must be 2MB or smaller.' };
    csv = new TextDecoder().decode(await file.arrayBuffer());
  }
  if (!csv.trim()) return { ok: false, message: 'Paste the scores or attach a CSV score sheet.' };

  const { rows, errors } = parseBulkScores(csv, schedule.totalMarks);
  const byExamNumber = new Map(schedule.candidates.map((c) => [c.examNumber.toUpperCase(), c]));

  let applied = 0;
  const unmatched: string[] = [];
  for (const row of rows) {
    const candidate = byExamNumber.get(row.identifier.toUpperCase());
    if (!candidate) {
      unmatched.push(row.identifier);
      continue;
    }
    await prisma.examCandidate.update({
      where: { id: candidate.id },
      data: {
        score: row.score,
        attendance: 'PRESENT',
        remarks: row.remarks ?? null,
        scoreEnteredById: user.id,
        scoreEnteredAt: new Date(),
        validated: false,
      },
    });
    await prisma.application.update({ where: { id: candidate.applicationId }, data: { examScore: row.score } });
    applied += 1;
  }

  await recordAudit({
    action: AUDIT_ACTIONS.EXAM_SCORE_RECORDED,
    actor: user,
    entityType: 'ExamSchedule',
    entityId: scheduleId,
    summary: `Bulk score upload for "${schedule.title}": ${applied} score(s) applied`,
    metadata: { applied, unmatched, parseErrors: errors },
    sensitive: true,
  });

  revalidatePath(`/admin/examinations/${scheduleId}`);
  const problems = [
    errors.length ? `${errors.length} line(s) could not be read (line ${errors.slice(0, 3).map((e) => e.line).join(', ')}…)` : '',
    unmatched.length ? `${unmatched.length} examination number(s) not found: ${unmatched.slice(0, 5).join(', ')}` : '',
  ].filter(Boolean);

  return {
    ok: applied > 0,
    message: `${applied} score(s) applied.${problems.length ? ` ${problems.join('. ')}.` : ''}`,
  };
}

/** Validate recorded scores and move candidates to the next stage. */
export async function validateExamScores(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.EXAM_MANAGE);
  const scheduleId = String(formData.get('scheduleId') ?? '');
  const publishResults = formData.get('publishResults') === 'true';

  const schedule = await prisma.examSchedule.findUnique({
    where: { id: scheduleId },
    include: { candidates: { include: { application: { select: { id: true, status: true, reference: true } } } } },
  });
  if (!schedule) return { ok: false, message: 'Examination schedule not found.' };

  const missing = schedule.candidates.filter((c) => c.attendance === 'PENDING');
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Record attendance for all ${schedule.candidates.length} candidates first. ${missing.length} still pending.`,
    };
  }
  const scored = schedule.candidates.filter((c) => c.attendance === 'PRESENT');
  const unscored = scored.filter((c) => c.score === null);
  if (unscored.length > 0) {
    return { ok: false, message: `${unscored.length} candidate(s) marked present have no score recorded.` };
  }

  let advanced = 0;
  for (const candidate of schedule.candidates) {
    await prisma.examCandidate.update({ where: { id: candidate.id }, data: { validated: true } });
    try {
      assertApplicationTransition(candidate.application.status, APPLICATION_STATUS.EXAM_COMPLETED);
      await applyStatusChange({
        applicationId: candidate.applicationId,
        toStatus: APPLICATION_STATUS.EXAM_COMPLETED,
        actor: user,
        remarks:
          candidate.attendance === 'ABSENT'
            ? 'Absent from the written examination'
            : `Examination completed with a score of ${candidate.score}/${schedule.totalMarks}`,
      });
      advanced += 1;
    } catch {
      /* already past this stage */
    }
  }

  await prisma.examSchedule.update({
    where: { id: scheduleId },
    data: { status: 'COMPLETED', resultsPublishedAt: publishResults ? new Date() : null },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.EXAM_SCORES_VALIDATED,
    actor: user,
    entityType: 'ExamSchedule',
    entityId: scheduleId,
    summary: `Validated examination "${schedule.title}": ${schedule.candidates.length} record(s), ${advanced} advanced${publishResults ? '; results released to candidates' : ''}`,
    sensitive: true,
  });

  revalidatePath(`/admin/examinations/${scheduleId}`);
  return flashOk(`Examination validated. ${advanced} candidate(s) moved to examination completed${publishResults ? ' and scores released to candidates' : ''}.`);
}

// ---------------------------------------------------------------------------
// MODULE 2.7 - INTERVIEW MANAGEMENT
// ---------------------------------------------------------------------------

export async function createInterviewSchedule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.INTERVIEW_MANAGE);
  const exerciseId = String(formData.get('exerciseId') ?? '');
  const parsed = parseForm(interviewScheduleSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;
  const exercise = await prisma.recruitmentExercise.findUnique({ where: { id: exerciseId } });
  if (!exercise) return { ok: false, message: 'Recruitment exercise not found.' };

  const schedule = await prisma.interviewSchedule.create({
    data: {
      exerciseId,
      title: d.title,
      interviewDate: d.interviewDate,
      startTime: d.startTime,
      endTime: d.endTime || null,
      venue: d.venue,
      slotMinutes: d.slotMinutes,
      totalMarks: d.totalMarks,
      passMark: d.passMark,
      criteria: JSON.stringify(DEFAULT_INTERVIEW_CRITERIA),
      createdById: user.id,
    },
  });
  await recordAudit({
    action: AUDIT_ACTIONS.INTERVIEW_CREATED,
    actor: user,
    entityType: 'InterviewSchedule',
    entityId: schedule.id,
    summary: `Created interview "${d.title}" on ${formatDate(d.interviewDate)} at ${d.venue}`,
  });
  revalidatePath('/admin/interviews');
  redirect(`/admin/interviews/${schedule.id}`);
}

export async function saveInterviewCriteria(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.INTERVIEW_MANAGE);
  const scheduleId = String(formData.get('scheduleId') ?? '');
  const labels = formData.getAll('criterionLabel').map(String);
  const maxScores = formData.getAll('criterionMax').map((v) => Number(v));

  const criteria = labels
    .map((label, i) => ({
      key: label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40),
      label: label.trim(),
      maxScore: maxScores[i] ?? 0,
    }))
    .filter((c) => c.label && c.maxScore > 0);

  if (criteria.length === 0) return { ok: false, message: 'Define at least one assessment criterion.' };
  const keys = new Set(criteria.map((c) => c.key));
  if (keys.size !== criteria.length) return { ok: false, message: 'Criterion names must be distinct.' };

  const total = criteria.reduce((s, c) => s + c.maxScore, 0);
  await prisma.interviewSchedule.update({
    where: { id: scheduleId },
    data: { criteria: JSON.stringify(criteria), totalMarks: total },
  });
  await recordAudit({
    action: AUDIT_ACTIONS.INTERVIEW_CREATED,
    actor: user,
    entityType: 'InterviewSchedule',
    entityId: scheduleId,
    summary: `Updated interview assessment framework (${criteria.length} criteria, total ${total} marks)`,
  });
  revalidatePath(`/admin/interviews/${scheduleId}`);
  return flashOk(`Assessment framework saved. Total marks: ${total}.`);
}

export async function createPanel(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.INTERVIEW_MANAGE);
  const scheduleId = String(formData.get('scheduleId') ?? '');
  const parsed = parseForm(panelSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const memberIds = formData.getAll('memberIds').map(String).filter(Boolean);
  const chairId = String(formData.get('chairId') ?? '');

  if (memberIds.length === 0) return { ok: false, message: 'Assign at least one panel member.' };

  const panel = await prisma.interviewPanel.create({
    data: {
      scheduleId,
      name: parsed.data.name,
      roomVenue: parsed.data.roomVenue || null,
      members: {
        create: memberIds.map((userId) => ({ userId, isChair: userId === chairId })),
      },
    },
  });
  await recordAudit({
    action: AUDIT_ACTIONS.INTERVIEW_PANEL_ASSIGNED,
    actor: user,
    entityType: 'InterviewPanel',
    entityId: panel.id,
    summary: `Created interview panel "${parsed.data.name}" with ${memberIds.length} member(s)`,
  });
  revalidatePath(`/admin/interviews/${scheduleId}`);
  return flashOk('Interview panel created.');
}

export async function deletePanel(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.INTERVIEW_MANAGE);
  const id = String(formData.get('id') ?? '');
  const panel = await prisma.interviewPanel.findUnique({
    where: { id },
    include: { _count: { select: { candidates: true } } },
  });
  if (!panel || panel._count.candidates > 0) return;
  await prisma.interviewPanel.delete({ where: { id } });
  await recordAudit({
    action: AUDIT_ACTIONS.INTERVIEW_PANEL_ASSIGNED,
    actor: user,
    entityType: 'InterviewPanel',
    entityId: id,
    summary: `Removed interview panel "${panel.name}"`,
  });
  revalidatePath(`/admin/interviews/${panel.scheduleId}`);
}

/** Schedule candidates for interview, allocating panels and time slots. */
export async function assignInterviewCandidates(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.INTERVIEW_MANAGE);
  const scheduleId = String(formData.get('scheduleId') ?? '');
  const ids = formData.getAll('applicationIds').map(String).filter(Boolean);
  const notify = formData.get('notify') === 'true';

  if (ids.length === 0) return { ok: false, message: 'Select at least one candidate.' };

  const schedule = await prisma.interviewSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      exercise: { select: { id: true, title: true } },
      panels: { include: { _count: { select: { candidates: true } } } },
      _count: { select: { candidates: true } },
    },
  });
  if (!schedule) return { ok: false, message: 'Interview schedule not found.' };
  if (schedule.panels.length === 0) {
    return { ok: false, message: 'Create at least one interview panel before scheduling candidates.' };
  }

  const eligibleStatuses = [APPLICATION_STATUS.EXAM_COMPLETED, APPLICATION_STATUS.SHORTLISTED];
  const applications = await prisma.application.findMany({
    where: { id: { in: ids }, exerciseId: schedule.exercise.id, status: { in: eligibleStatuses } },
    include: {
      applicant: { select: { email: true, phone: true, fullName: true, applicantProfile: { select: { firstName: true, surname: true } } } },
      vacancy: { select: { jobTitle: true, gradeLevel: true } },
    },
  });
  if (applications.length === 0) {
    return {
      ok: false,
      message: 'None of the selected applications are at a stage where they can be scheduled for interview.',
    };
  }

  const panelLoad = new Map(schedule.panels.map((p) => [p.id, p._count.candidates]));
  const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
  let assigned = 0;
  let notified = 0;

  for (const app of applications) {
    const existing = await prisma.interviewCandidate.findUnique({
      where: { scheduleId_applicationId: { scheduleId, applicationId: app.id } },
    });
    if (existing) continue;

    // Round-robin onto the least loaded panel.
    const panelId = Array.from(panelLoad.entries()).sort((a, b) => a[1] - b[1])[0][0];
    const slotIndex = panelLoad.get(panelId) ?? 0;
    panelLoad.set(panelId, slotIndex + 1);

    const minutesFromStart = slotIndex * schedule.slotMinutes;
    const slotHour = startHour + Math.floor((startMinute + minutesFromStart) / 60);
    const slotMin = (startMinute + minutesFromStart) % 60;
    const slotTime = `${String(slotHour % 24).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;

    await prisma.interviewCandidate.create({
      data: { scheduleId, applicationId: app.id, panelId, slotTime },
    });

    try {
      assertApplicationTransition(app.status, APPLICATION_STATUS.INTERVIEW_SCHEDULED);
      await applyStatusChange({
        applicationId: app.id,
        toStatus: APPLICATION_STATUS.INTERVIEW_SCHEDULED,
        actor: user,
        remarks: `Scheduled for interview on ${formatDate(schedule.interviewDate)} at ${slotTime}`,
      });
    } catch {
      /* already scheduled */
    }

    if (notify) {
      await sendTemplated(
        TEMPLATES.INTERVIEW_INVITATION,
        { userId: app.applicantId, email: app.applicant.email, phone: app.applicant.phone },
        {
          name: app.applicant.applicantProfile
            ? `${app.applicant.applicantProfile.firstName} ${app.applicant.applicantProfile.surname}`
            : app.applicant.fullName,
          reference: app.reference,
          exercise: schedule.exercise.title,
          position: app.vacancy ? `${app.vacancy.jobTitle} (${app.vacancy.gradeLevel})` : 'the advertised position',
          date: formatDate(schedule.interviewDate),
          time: slotTime,
          venue: schedule.venue,
        },
      );
      await prisma.interviewCandidate.updateMany({
        where: { scheduleId, applicationId: app.id },
        data: { notifiedAt: new Date() },
      });
      notified += 1;
    }
    assigned += 1;
  }

  await recordAudit({
    action: AUDIT_ACTIONS.INTERVIEW_CREATED,
    actor: user,
    entityType: 'InterviewSchedule',
    entityId: scheduleId,
    summary: `Scheduled ${assigned} candidate(s) for interview "${schedule.title}"${notified ? `; ${notified} notified` : ''}`,
  });

  revalidatePath(`/admin/interviews/${scheduleId}`);
  return flashOk(`${assigned} candidate(s) scheduled${notified ? ` and ${notified} notified` : ''}.`);
}

/** A panel member records their own score sheet for one candidate. */
export async function recordInterviewScore(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!hasPermission(user, PERMISSIONS.INTERVIEW_SCORE)) {
    return { ok: false, message: 'You are not authorised to record interview scores.' };
  }
  const candidateId = String(formData.get('candidateId') ?? '');
  const attendance = String(formData.get('attendance') ?? 'PRESENT');
  const remarks = String(formData.get('remarks') ?? '').trim();

  const candidate = await prisma.interviewCandidate.findUnique({
    where: { id: candidateId },
    include: {
      schedule: true,
      panel: { include: { members: { select: { userId: true } } } },
      application: { select: { id: true, reference: true, status: true } },
    },
  });
  if (!candidate) return { ok: false, message: 'Candidate not found.' };

  // Separation of duties: only a member of the candidate's own panel records a
  // score. An officer who manages interviews but does not sit on the panel
  // schedules and consolidates, but does not assess.
  const isPanelMember = candidate.panel?.members.some((m) => m.userId === user.id) ?? false;
  if (!isPanelMember) {
    return {
      ok: false,
      message: 'Only a member of the panel assigned to this candidate may record a score.',
    };
  }

  if (attendance === 'ABSENT') {
    await prisma.interviewCandidate.update({
      where: { id: candidateId },
      data: { attendance: 'ABSENT', consolidatedScore: null, remarks: remarks || 'Absent from interview' },
    });
    await recordAudit({
      action: AUDIT_ACTIONS.INTERVIEW_SCORE_RECORDED,
      actor: user,
      entityType: 'InterviewCandidate',
      entityId: candidateId,
      summary: `Candidate ${candidate.application.reference} marked absent from interview`,
      sensitive: true,
    });
    revalidatePath(`/admin/interviews/${candidate.scheduleId}`);
    return flashOk('Candidate marked absent.');
  }

  const criteria = parseCriteria(candidate.schedule.criteria, [...DEFAULT_INTERVIEW_CRITERIA]);
  const raw: Record<string, unknown> = {};
  for (const c of criteria) raw[c.key] = formData.get(`score_${c.key}`);

  let result;
  try {
    result = totalInterviewScore(criteria, raw);
  } catch (error) {
    return { ok: false, message: error instanceof ScoreError ? error.message : 'Check the scores entered.' };
  }

  await prisma.interviewScore.upsert({
    where: { candidateId_memberId: { candidateId, memberId: user.id } },
    create: {
      candidateId,
      memberId: user.id,
      scores: JSON.stringify(result.normalised),
      total: result.total,
      remarks: remarks || null,
    },
    update: {
      scores: JSON.stringify(result.normalised),
      total: result.total,
      remarks: remarks || null,
    },
  });

  const allScores = await prisma.interviewScore.findMany({ where: { candidateId }, select: { total: true } });
  const consolidated = consolidatePanelScores(allScores.map((s) => s.total));

  await prisma.interviewCandidate.update({
    where: { id: candidateId },
    data: { attendance: 'PRESENT', consolidatedScore: consolidated },
  });
  if (consolidated !== null) {
    await prisma.application.update({
      where: { id: candidate.applicationId },
      data: { interviewScore: consolidated },
    });
  }

  await recordAudit({
    action: AUDIT_ACTIONS.INTERVIEW_SCORE_RECORDED,
    actor: user,
    entityType: 'InterviewCandidate',
    entityId: candidateId,
    summary: `Interview score ${result.total}/${candidate.schedule.totalMarks} recorded for ${candidate.application.reference}; panel mean ${consolidated}`,
    metadata: { scores: result.normalised, total: result.total, consolidated },
    sensitive: true,
  });

  revalidatePath(`/admin/interviews/${candidate.scheduleId}`);
  return flashOk(`Your score of ${result.total}/${candidate.schedule.totalMarks} has been recorded. Panel mean: ${consolidated}.`);
}

/** Consolidate panel assessments and close the interview stage. */
export async function consolidateInterviews(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.INTERVIEW_MANAGE);
  const scheduleId = String(formData.get('scheduleId') ?? '');

  const schedule = await prisma.interviewSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      candidates: {
        include: { scores: { select: { total: true } }, application: { select: { id: true, status: true, reference: true } } },
      },
    },
  });
  if (!schedule) return { ok: false, message: 'Interview schedule not found.' };

  const pending = schedule.candidates.filter((c) => c.attendance === 'PENDING');
  if (pending.length > 0) {
    return { ok: false, message: `${pending.length} candidate(s) have no attendance recorded.` };
  }
  const unscored = schedule.candidates.filter((c) => c.attendance === 'PRESENT' && c.scores.length === 0);
  if (unscored.length > 0) {
    return { ok: false, message: `${unscored.length} candidate(s) marked present have no panel scores.` };
  }

  let advanced = 0;
  for (const candidate of schedule.candidates) {
    const consolidated = consolidatePanelScores(candidate.scores.map((s) => s.total));
    await prisma.interviewCandidate.update({
      where: { id: candidate.id },
      data: { consolidatedScore: consolidated },
    });
    if (consolidated !== null) {
      await prisma.application.update({
        where: { id: candidate.applicationId },
        data: { interviewScore: consolidated },
      });
    }
    try {
      assertApplicationTransition(candidate.application.status, APPLICATION_STATUS.INTERVIEW_COMPLETED);
      await applyStatusChange({
        applicationId: candidate.applicationId,
        toStatus: APPLICATION_STATUS.INTERVIEW_COMPLETED,
        actor: user,
        remarks:
          candidate.attendance === 'ABSENT'
            ? 'Absent from interview'
            : `Interview completed; consolidated score ${consolidated}/${schedule.totalMarks}`,
      });
      advanced += 1;
    } catch {
      /* already past */
    }
  }

  await prisma.interviewSchedule.update({ where: { id: scheduleId }, data: { status: 'COMPLETED' } });
  await recordAudit({
    action: AUDIT_ACTIONS.INTERVIEW_SCORE_RECORDED,
    actor: user,
    entityType: 'InterviewSchedule',
    entityId: scheduleId,
    summary: `Consolidated interview "${schedule.title}": ${schedule.candidates.length} candidate(s), ${advanced} advanced`,
    sensitive: true,
  });

  revalidatePath(`/admin/interviews/${scheduleId}`);
  return flashOk(`Interview assessments consolidated. ${advanced} candidate(s) advanced.`);
}

// ---------------------------------------------------------------------------
// MODULE 2.8 - FINAL SELECTION AND RECRUITMENT OUTCOME
// ---------------------------------------------------------------------------

export async function createSelectionList(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.SELECTION_PREPARE);
  const exerciseId = String(formData.get('exerciseId') ?? '');
  const parsed = parseForm(selectionListSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;

  const exercise = await prisma.recruitmentExercise.findUnique({
    where: { id: exerciseId },
    include: { vacancies: { where: { active: true }, select: { id: true, positions: true, jobTitle: true } } },
  });
  if (!exercise) return { ok: false, message: 'Recruitment exercise not found.' };

  const candidates = await prisma.application.findMany({
    where: {
      exerciseId,
      status: { in: [APPLICATION_STATUS.INTERVIEW_COMPLETED, APPLICATION_STATUS.EXAM_COMPLETED] },
    },
    select: { id: true, examScore: true, interviewScore: true, vacancyId: true },
  });
  if (candidates.length === 0) {
    return { ok: false, message: 'No candidates have completed assessment for this exercise yet.' };
  }

  const scored = candidates.map((c) => ({
    ...c,
    finalScore: finalScore({
      examScore: c.examScore,
      interviewScore: c.interviewScore,
      examWeight: d.examWeight,
      interviewWeight: d.interviewWeight,
    }),
  }));
  const ranked = rankEntries(scored);

  // Provisional outcome: fill each vacancy's approved number of posts by rank.
  const remaining = new Map(exercise.vacancies.map((v) => [v.id, v.positions]));
  const entries = ranked.map((entry) => {
    let outcome: string = 'NOT_SELECTED';
    if (entry.finalScore !== null && entry.vacancyId) {
      const left = remaining.get(entry.vacancyId) ?? 0;
      if (left > 0) {
        outcome = 'SELECTED';
        remaining.set(entry.vacancyId, left - 1);
      } else {
        outcome = 'RESERVE';
      }
    }
    return {
      applicationId: entry.id,
      examScore: entry.examScore,
      interviewScore: entry.interviewScore,
      finalScore: entry.finalScore,
      rank: entry.rank,
      outcome,
    };
  });

  const list = await prisma.selectionList.create({
    data: {
      exerciseId,
      title: d.title,
      examWeight: d.examWeight,
      interviewWeight: d.interviewWeight,
      preparedById: user.id,
      entries: { create: entries },
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.SELECTION_PREPARED,
    actor: user,
    entityType: 'SelectionList',
    entityId: list.id,
    summary: `Prepared selection list "${d.title}" with ${entries.length} candidate(s) (${entries.filter((e) => e.outcome === 'SELECTED').length} provisionally selected)`,
    metadata: { examWeight: d.examWeight, interviewWeight: d.interviewWeight },
  });

  revalidatePath('/admin/selection');
  redirect(`/admin/selection/${list.id}`);
}

export async function setSelectionOutcome(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.SELECTION_PREPARE);
  const entryId = String(formData.get('entryId') ?? '');
  const outcome = String(formData.get('outcome') ?? '');
  const remarks = String(formData.get('remarks') ?? '').trim();
  if (!['SELECTED', 'NOT_SELECTED', 'RESERVE', 'PENDING'].includes(outcome)) return;

  const entry = await prisma.selectionEntry.findUnique({
    where: { id: entryId },
    include: { selectionList: { select: { id: true, status: true, title: true } }, application: { select: { reference: true } } },
  });
  if (!entry || entry.selectionList.status !== 'DRAFT') return;

  await prisma.selectionEntry.update({
    where: { id: entryId },
    data: { outcome, remarks: remarks || null },
  });
  await recordAudit({
    action: AUDIT_ACTIONS.SELECTION_PREPARED,
    actor: user,
    entityType: 'SelectionEntry',
    entityId: entryId,
    summary: `Set provisional outcome ${outcome} for ${entry.application.reference} on "${entry.selectionList.title}"`,
    sensitive: true,
  });
  revalidatePath(`/admin/selection/${entry.selectionList.id}`);
}

/** Final selection approval, candidate notification and exercise closure. */
export async function decideSelectionList(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const listId = String(formData.get('selectionListId') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const note = String(formData.get('note') ?? '').trim();

  const user = await requirePermission(
    decision === 'SUBMIT' ? PERMISSIONS.SELECTION_PREPARE : PERMISSIONS.SELECTION_APPROVE,
  );

  const list = await prisma.selectionList.findUnique({
    where: { id: listId },
    include: {
      exercise: { select: { id: true, title: true, reference: true, status: true } },
      entries: {
        orderBy: { rank: 'asc' },
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
  if (!list) return { ok: false, message: 'Selection list not found.' };

  if (decision === 'SUBMIT') {
    if (list.status !== 'DRAFT') return { ok: false, message: 'Only a draft selection list can be submitted for approval.' };
    if (list.entries.some((e) => e.outcome === 'PENDING')) {
      return { ok: false, message: 'Every candidate must have a provisional outcome before submission.' };
    }
    await prisma.selectionList.update({ where: { id: listId }, data: { status: 'PENDING_APPROVAL' } });
    await prisma.approvalRequest.create({
      data: {
        entityType: 'SELECTION',
        entityId: listId,
        exerciseId: list.exerciseId,
        action: 'APPROVE_SELECTION',
        requestedById: user.id,
        requestedByName: user.fullName,
        note: note || null,
      },
    });
    await recordAudit({
      action: AUDIT_ACTIONS.SELECTION_SUBMITTED,
      actor: user,
      entityType: 'SelectionList',
      entityId: listId,
      summary: `Selection list "${list.title}" submitted for Commission approval`,
    });
    revalidatePath('/admin/selection');
    return flashOk('Selection list submitted for approval.');
  }

  if (decision === 'REJECT') {
    if (list.status !== 'PENDING_APPROVAL') return { ok: false, message: 'Only a list awaiting approval can be rejected.' };
    if (!note) return { ok: false, message: 'State the reason for returning the selection list.' };
    await prisma.selectionList.update({ where: { id: listId }, data: { status: 'DRAFT', rejectionNote: note } });
    await prisma.approvalRequest.updateMany({
      where: { entityType: 'SELECTION', entityId: listId, status: 'PENDING' },
      data: { status: 'REJECTED', decidedById: user.id, decidedByName: user.fullName, decidedAt: new Date(), note },
    });
    await recordAudit({
      action: AUDIT_ACTIONS.SELECTION_REJECTED,
      actor: user,
      entityType: 'SelectionList',
      entityId: listId,
      summary: `Selection list "${list.title}" returned — ${note}`,
      sensitive: true,
    });
    revalidatePath('/admin/selection');
    return flashOk('Selection list returned to the preparing officer.');
  }

  if (decision !== 'APPROVE') return { ok: false, message: 'Unknown decision.' };
  if (list.status !== 'PENDING_APPROVAL') {
    return { ok: false, message: 'Only a list awaiting approval can be approved.' };
  }

  const now = new Date();
  let selected = 0;
  let unsuccessful = 0;

  for (const entry of list.entries) {
    const app = entry.application;
    const toStatus = entry.outcome === 'SELECTED' ? APPLICATION_STATUS.SELECTED : APPLICATION_STATUS.NOT_SELECTED;
    try {
      assertApplicationTransition(app.status, toStatus);
    } catch {
      continue;
    }
    await applyStatusChange({
      applicationId: app.id,
      toStatus,
      actor: user,
      remarks: `Recruitment outcome approved under "${list.title}" (rank ${entry.rank ?? '—'})`,
      extra: { selected: entry.outcome === 'SELECTED', finalScore: entry.finalScore },
    });

    const name = app.applicant.applicantProfile
      ? `${app.applicant.applicantProfile.firstName} ${app.applicant.applicantProfile.surname}`
      : app.applicant.fullName;
    await sendTemplated(
      entry.outcome === 'SELECTED' ? TEMPLATES.SELECTION_SUCCESSFUL : TEMPLATES.SELECTION_UNSUCCESSFUL,
      { userId: app.applicantId, email: app.applicant.email, phone: app.applicant.phone },
      {
        name,
        reference: app.reference,
        exercise: list.exercise.title,
        position: app.vacancy ? `${app.vacancy.jobTitle} (${app.vacancy.gradeLevel})` : 'the advertised position',
      },
    );
    if (entry.outcome === 'SELECTED') selected += 1;
    else unsuccessful += 1;
  }

  await prisma.selectionList.update({
    where: { id: listId },
    data: { status: 'APPROVED', approvedById: user.id, approvedAt: now, notifiedAt: now, rejectionNote: null },
  });
  await prisma.approvalRequest.updateMany({
    where: { entityType: 'SELECTION', entityId: listId, status: 'PENDING' },
    data: { status: 'APPROVED', decidedById: user.id, decidedByName: user.fullName, decidedAt: now, note: note || null },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.SELECTION_APPROVED,
    actor: user,
    entityType: 'SelectionList',
    entityId: listId,
    summary: `Selection list "${list.title}" approved: ${selected} successful, ${unsuccessful} unsuccessful; all candidates notified`,
    metadata: { selected, unsuccessful, approvedBy: user.fullName, approvedAt: now.toISOString() },
    sensitive: true,
  });

  revalidatePath('/admin/selection');
  revalidatePath('/admin/applications');
  return flashOk(`Selection approved. ${selected} successful candidate(s) and ${unsuccessful} unsuccessful candidate(s) have been notified.`);
}

/** Stage 10 - close and archive a concluded exercise. */
export async function archiveSelectionList(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.SELECTION_APPROVE);
  const listId = String(formData.get('selectionListId') ?? '');
  const list = await prisma.selectionList.findUnique({
    where: { id: listId },
    include: { exercise: { select: { id: true, status: true, title: true } } },
  });
  if (!list) return { ok: false, message: 'Selection list not found.' };
  if (list.status !== 'APPROVED') return { ok: false, message: 'Only an approved selection list can be archived.' };

  await prisma.selectionList.update({
    where: { id: listId },
    data: { status: 'ARCHIVED', archivedAt: new Date() },
  });
  if (['PUBLISHED', 'SUSPENDED'].includes(list.exercise.status)) {
    await prisma.recruitmentExercise.update({
      where: { id: list.exerciseId },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
  }

  await recordAudit({
    action: AUDIT_ACTIONS.EXERCISE_ARCHIVED,
    actor: user,
    entityType: 'SelectionList',
    entityId: listId,
    summary: `Archived recruitment records for "${list.exercise.title}" and closed the exercise`,
    sensitive: true,
  });

  revalidatePath('/admin/selection');
  revalidatePath('/admin/exercises');
  return flashOk('Recruitment records archived and the exercise closed.');
}
