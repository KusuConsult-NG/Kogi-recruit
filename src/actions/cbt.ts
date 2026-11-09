'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { flashOk, setFlash } from '@/lib/flash';
import { requireApplicant, requirePermission } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/rbac';
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { APPLICATION_STATUS, SITTING_STATUS } from '@/lib/constants';
import {
  assemblePaper, CbtError, drawQuestions, isExpired, markAnswer, markSitting,
  parseSelected, scaleToSchedule, seededRandom, serialiseSelected, totalMarks,
  type EnginePaperQuestion, type EngineQuestion,
} from '@/lib/cbt';
import { applyStatusChange } from '@/lib/application-service';
import type { ActionState } from './public';

const QUESTION_SHAPE = {
  id: true,
  type: true,
  stem: true,
  marks: true,
  options: { select: { id: true, label: true, text: true, correct: true, position: true } },
} as const;

/**
 * Resolve the questions a paper puts in front of one candidate. Sections that
 * name their questions contribute those; sections that draw from a bank
 * contribute a random selection, seeded on the sitting so a reload is stable.
 */
async function resolvePaperQuestions(paperId: string, seed: string): Promise<EnginePaperQuestion[]> {
  const sections = await prisma.examPaperSection.findMany({
    where: { paperId },
    orderBy: { position: 'asc' },
    include: {
      questions: {
        orderBy: { position: 'asc' },
        include: { question: { select: QUESTION_SHAPE } },
      },
    },
  });

  const out: EnginePaperQuestion[] = [];
  const used = new Set<string>();

  for (const section of sections) {
    if (section.drawCount && section.bankId) {
      const pool = await prisma.question.findMany({
        where: { bankId: section.bankId, active: true, id: { notIn: Array.from(used) } },
        select: QUESTION_SHAPE,
      });
      if (pool.length < section.drawCount) {
        throw new CbtError(
          `Section "${section.title}" needs ${section.drawCount} questions but only ${pool.length} are available.`,
        );
      }
      const rand = seededRandom(`${seed}:${section.id}`);
      for (const q of drawQuestions(pool as EngineQuestion[], section.drawCount, rand)) {
        used.add(q.id);
        out.push({
          questionId: q.id,
          sectionTitle: section.title,
          marks: section.marksPerQuestion > 0 ? section.marksPerQuestion : q.marks,
          question: q,
        });
      }
    } else {
      for (const entry of section.questions) {
        if (!entry.question || used.has(entry.questionId)) continue;
        used.add(entry.questionId);
        out.push({
          questionId: entry.questionId,
          sectionTitle: section.title,
          marks: entry.marks > 0 ? entry.marks : entry.question.marks,
          question: entry.question as EngineQuestion,
        });
      }
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// OFFICER SIDE - releasing an online test to candidates
// ---------------------------------------------------------------------------

/**
 * Create a sitting for every allocated candidate on an online examination.
 * The paper itself is assembled when the candidate starts, so a candidate
 * added later is covered too.
 */
export async function releaseOnlineTest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.EXAM_MANAGE);
  const scheduleId = String(formData.get('scheduleId') ?? '');
  const schedule = await prisma.examSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      paper: { select: { id: true, title: true, status: true } },
      candidates: { select: { id: true, sitting: { select: { id: true } } } },
    },
  });
  if (!schedule) return { ok: false, message: 'That examination could not be found.' };
  if (schedule.mode === 'CENTRE') {
    return { ok: false, message: 'This examination is centre-based, so there is no online test to release.' };
  }
  if (!schedule.paper) return { ok: false, message: 'Attach a published paper to this examination first.' };
  if (schedule.paper.status !== 'PUBLISHED') {
    return { ok: false, message: 'The attached paper is not published.' };
  }
  if (schedule.candidates.length === 0) {
    return { ok: false, message: 'Allocate candidates to this examination before releasing the test.' };
  }

  const pending = schedule.candidates.filter((c) => !c.sitting);
  if (pending.length === 0) {
    return { ok: false, message: 'Every allocated candidate already has a sitting for this examination.' };
  }

  await prisma.examSitting.createMany({
    data: pending.map((c) => ({
      candidateId: c.id,
      paperId: schedule.paper!.id,
      status: SITTING_STATUS.NOT_STARTED,
    })),
  });

  await recordAudit({
    action: AUDIT_ACTIONS.EXAM_UPDATED,
    actor: user,
    entityType: 'ExamSchedule',
    entityId: scheduleId,
    summary: `Released the online test "${schedule.paper.title}" to ${pending.length} candidate(s)`,
    metadata: { released: pending.length },
  });

  revalidatePath(`/admin/examinations/${scheduleId}`);
  return flashOk(`Online test released to ${pending.length} candidate(s).`);
}

/** Close an overdue sitting on the officer's instruction and mark what was answered. */
export async function forceSubmitSitting(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.EXAM_MANAGE);
  const id = String(formData.get('id') ?? '');
  const sitting = await prisma.examSitting.findUnique({
    where: { id },
    include: { candidate: { select: { scheduleId: true, examNumber: true } } },
  });
  if (!sitting || sitting.status === SITTING_STATUS.SUBMITTED) return;

  await finaliseSitting(id, 'OFFICER');

  await recordAudit({
    action: AUDIT_ACTIONS.CBT_SITTING_SUBMITTED,
    actor: user,
    entityType: 'ExamSitting',
    entityId: id,
    summary: `Closed the online sitting for candidate ${sitting.candidate.examNumber} on the officer's instruction`,
  });

  revalidatePath(`/admin/examinations/${sitting.candidate.scheduleId}`);
}

// ---------------------------------------------------------------------------
// CANDIDATE SIDE
// ---------------------------------------------------------------------------

function windowMessage(schedule: {
  opensAt: Date | null;
  closesAt: Date | null;
}): string | null {
  const now = new Date();
  if (schedule.opensAt && now < schedule.opensAt) {
    return 'This test is not open yet. Come back at the time stated on your invitation.';
  }
  if (schedule.closesAt && now > schedule.closesAt) {
    return 'The window for this test has closed.';
  }
  return null;
}

/** Begin a sitting: assemble the candidate's paper and start the clock. */
export async function startSitting(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireApplicant();
  const sittingId = String(formData.get('sittingId') ?? '');

  const sitting = await prisma.examSitting.findUnique({
    where: { id: sittingId },
    include: {
      paper: true,
      candidate: {
        include: {
          application: { select: { id: true, applicantId: true, reference: true, status: true } },
          schedule: { select: { id: true, title: true, opensAt: true, closesAt: true, durationMinutes: true, status: true } },
        },
      },
      _count: { select: { items: true } },
    },
  });

  if (!sitting || sitting.candidate.application.applicantId !== user.id) {
    return { ok: false, message: 'That test could not be found on your record.' };
  }
  if (sitting.status === SITTING_STATUS.SUBMITTED || sitting.status === SITTING_STATUS.EXPIRED) {
    return { ok: false, message: 'You have already sat this test.' };
  }
  if (sitting.candidate.schedule.status === 'CANCELLED') {
    return { ok: false, message: 'This examination has been cancelled.' };
  }

  const blocked = windowMessage(sitting.candidate.schedule);
  if (blocked) return { ok: false, message: blocked };

  // Already started and still running: carry on where the candidate left off.
  if (sitting.status === SITTING_STATUS.IN_PROGRESS && sitting._count.items > 0) {
    redirect(`/examination/${sittingId}`);
  }

  let assembled;
  try {
    const questions = await resolvePaperQuestions(sitting.paperId, sittingId);
    assembled = assemblePaper(questions, {
      seed: sittingId,
      shuffleQuestions: sitting.paper.shuffleQuestions,
      shuffleOptions: sitting.paper.shuffleOptions,
    });
  } catch (error) {
    if (error instanceof CbtError) {
      return {
        ok: false,
        message: `${error.message} Please report this to the Commission's examination officer.`,
      };
    }
    throw error;
  }

  const minutes = sitting.candidate.schedule.durationMinutes ?? sitting.paper.durationMinutes;
  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + minutes * 60_000);
  const header = await headers();

  await prisma.$transaction([
    prisma.examSittingQuestion.deleteMany({ where: { sittingId } }),
    prisma.examSittingQuestion.createMany({
      data: assembled.map((item) => ({
        sittingId,
        questionId: item.questionId,
        sectionTitle: item.sectionTitle,
        position: item.position,
        marks: item.marks,
        optionOrder: item.optionOrder.join(','),
      })),
    }),
    prisma.examSitting.update({
      where: { id: sittingId },
      data: {
        status: SITTING_STATUS.IN_PROGRESS,
        startedAt,
        expiresAt,
        totalMarks: totalMarks(assembled),
        rawScore: 0,
        answeredCount: 0,
        ipAddress: header.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        userAgent: header.get('user-agent')?.slice(0, 300) ?? null,
      },
    }),
    prisma.examCandidate.update({
      where: { id: sitting.candidateId },
      data: { attendance: 'PRESENT' },
    }),
  ]);

  await recordAudit({
    action: AUDIT_ACTIONS.CBT_SITTING_STARTED,
    actor: { id: user.id, fullName: user.fullName, role: user.role },
    entityType: 'ExamSitting',
    entityId: sittingId,
    summary: `Started the online test "${sitting.candidate.schedule.title}" (${assembled.length} questions, ${minutes} minutes)`,
  });

  redirect(`/examination/${sittingId}`);
}

/**
 * Save one answer and move to the next question.
 *
 * This always ends in a redirect, so it is a plain form action: a candidate
 * under a clock should never be left looking at a form that did nothing.
 */
export async function saveAnswer(formData: FormData): Promise<void> {
  const user = await requireApplicant();
  const itemId = String(formData.get('itemId') ?? '');
  const selected = formData.getAll('selected').map((v) => String(v)).filter(Boolean);
  const nextPosition = String(formData.get('next') ?? '');

  const item = await prisma.examSittingQuestion.findUnique({
    where: { id: itemId },
    include: {
      question: { select: { type: true, options: { select: { id: true, correct: true } } } },
      sitting: {
        include: {
          candidate: { include: { application: { select: { applicantId: true } } } },
        },
      },
    },
  });

  if (!item || item.sitting.candidate.application.applicantId !== user.id) {
    await setFlash('That question could not be found on your test.', 'error');
    redirect('/portal/tests');
  }
  if (item.sitting.status !== SITTING_STATUS.IN_PROGRESS) {
    await setFlash('This test is no longer open for answers.', 'warning');
    redirect(`/examination/${item.sittingId}/result`);
  }
  if (isExpired(item.sitting.expiresAt)) {
    await finaliseSitting(item.sittingId, 'TIMER');
    redirect(`/examination/${item.sittingId}/result`);
  }

  // Only options actually shown to this candidate may be chosen.
  const allowed = new Set(parseSelected(item.optionOrder));
  const chosen = selected.filter((id) => allowed.has(id));
  const single = item.question.type !== 'MULTI_CHOICE';
  const finalChoice = single ? chosen.slice(0, 1) : chosen;

  const marked = markAnswer(item.question, finalChoice, item.marks);

  await prisma.examSittingQuestion.update({
    where: { id: itemId },
    data: {
      selected: serialiseSelected(finalChoice),
      correct: finalChoice.length > 0 ? marked.correct : null,
      awarded: marked.awarded,
      answeredAt: finalChoice.length > 0 ? new Date() : null,
    },
  });

  const answered = await prisma.examSittingQuestion.count({
    where: { sittingId: item.sittingId, NOT: { selected: null } },
  });
  await prisma.examSitting.update({
    where: { id: item.sittingId },
    data: { answeredCount: answered },
  });

  const target = nextPosition || String(item.position);
  redirect(`/examination/${item.sittingId}?q=${encodeURIComponent(target)}`);
}

/** Flag a question for review before submitting. */
export async function toggleFlag(formData: FormData): Promise<void> {
  const user = await requireApplicant();
  const itemId = String(formData.get('itemId') ?? '');
  const item = await prisma.examSittingQuestion.findUnique({
    where: { id: itemId },
    include: {
      sitting: { include: { candidate: { include: { application: { select: { applicantId: true } } } } } },
    },
  });
  if (!item || item.sitting.candidate.application.applicantId !== user.id) return;
  if (item.sitting.status !== SITTING_STATUS.IN_PROGRESS) return;
  await prisma.examSittingQuestion.update({ where: { id: itemId }, data: { flagged: !item.flagged } });
  redirect(`/examination/${item.sittingId}?q=${item.position}`);
}

/** Submit the test. The candidate's answers are already marked as they go. */
export async function submitSitting(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireApplicant();
  const sittingId = String(formData.get('sittingId') ?? '');
  const sitting = await prisma.examSitting.findUnique({
    where: { id: sittingId },
    include: { candidate: { include: { application: { select: { applicantId: true } } } } },
  });
  if (!sitting || sitting.candidate.application.applicantId !== user.id) {
    return { ok: false, message: 'That test could not be found on your record.' };
  }
  if (sitting.status === SITTING_STATUS.SUBMITTED || sitting.status === SITTING_STATUS.EXPIRED) {
    redirect(`/examination/${sittingId}/result`);
  }
  if (sitting.status !== SITTING_STATUS.IN_PROGRESS) {
    return { ok: false, message: 'This test has not been started.' };
  }

  const expired = isExpired(sitting.expiresAt);
  const result = await finaliseSitting(sittingId, expired ? 'TIMER' : 'CANDIDATE');

  await recordAudit({
    action: expired ? AUDIT_ACTIONS.CBT_SITTING_EXPIRED : AUDIT_ACTIONS.CBT_SITTING_SUBMITTED,
    actor: { id: user.id, fullName: user.fullName, role: user.role },
    entityType: 'ExamSitting',
    entityId: sittingId,
    summary: expired
      ? 'The allotted time ran out and the test was submitted automatically'
      : `Submitted the online test (${result.answeredCount} of ${result.itemCount} questions answered)`,
  });

  await setFlash(
    expired
      ? 'The allotted time ran out, so your test was submitted automatically.'
      : 'Your test has been submitted. Thank you.',
    expired ? 'warning' : 'success',
  );
  redirect(`/examination/${sittingId}/result`);
}

/**
 * Submit a sitting because its time ran out.
 *
 * The countdown in the candidate's browser posts this when it reaches zero.
 * It is a plain form action so no client wrapper sits between the clock and
 * the server, and the server checks the expiry itself, so a tampered clock
 * gains nothing: an early post is simply treated as the candidate submitting.
 */
export async function autoSubmitSitting(formData: FormData): Promise<void> {
  const user = await requireApplicant();
  const sittingId = String(formData.get('sittingId') ?? '');
  const sitting = await prisma.examSitting.findUnique({
    where: { id: sittingId },
    include: { candidate: { include: { application: { select: { applicantId: true } } } } },
  });
  if (!sitting || sitting.candidate.application.applicantId !== user.id) {
    redirect('/portal/tests');
  }
  if (sitting.status !== SITTING_STATUS.IN_PROGRESS) {
    redirect(`/examination/${sittingId}/result`);
  }

  const expired = isExpired(sitting.expiresAt);
  await finaliseSitting(sittingId, expired ? 'TIMER' : 'CANDIDATE');

  await recordAudit({
    action: expired ? AUDIT_ACTIONS.CBT_SITTING_EXPIRED : AUDIT_ACTIONS.CBT_SITTING_SUBMITTED,
    actor: { id: user.id, fullName: user.fullName, role: user.role },
    entityType: 'ExamSitting',
    entityId: sittingId,
    summary: expired
      ? 'The allotted time ran out and the test was submitted automatically'
      : 'Submitted the online test',
  });

  await setFlash(
    expired
      ? 'The allotted time ran out, so your test was submitted automatically.'
      : 'Your test has been submitted. Thank you.',
    expired ? 'warning' : 'success',
  );
  redirect(`/examination/${sittingId}/result`);
}

/**
 * Total a sitting, store the result and write the scaled score back to the
 * candidate's examination record so the existing selection workflow picks it up.
 */
export async function finaliseSitting(
  sittingId: string,
  submittedBy: 'CANDIDATE' | 'TIMER' | 'OFFICER',
): Promise<{ answeredCount: number; itemCount: number; percentage: number }> {
  const sitting = await prisma.examSitting.findUnique({
    where: { id: sittingId },
    include: {
      items: { select: { marks: true, awarded: true, selected: true } },
      candidate: {
        include: {
          schedule: { select: { id: true, totalMarks: true, passMark: true } },
          application: { select: { id: true, status: true, reference: true } },
        },
      },
    },
  });
  if (!sitting) throw new CbtError('That sitting could not be found.');

  const marked = markSitting(sitting.items);
  const now = new Date();
  const scaled = scaleToSchedule(marked.percentage, sitting.candidate.schedule.totalMarks);

  await prisma.$transaction([
    prisma.examSitting.update({
      where: { id: sittingId },
      data: {
        status: submittedBy === 'TIMER' ? SITTING_STATUS.EXPIRED : SITTING_STATUS.SUBMITTED,
        submittedAt: now,
        submittedBy,
        rawScore: marked.rawScore,
        totalMarks: marked.totalMarks,
        percentage: marked.percentage,
        answeredCount: marked.answeredCount,
        autoMarkedAt: now,
      },
    }),
    prisma.examCandidate.update({
      where: { id: sitting.candidateId },
      data: {
        attendance: 'PRESENT',
        score: scaled,
        scoreEnteredAt: now,
        validated: false,
        remarks: `Marked automatically: ${marked.rawScore} of ${marked.totalMarks} (${marked.percentage}%)`,
      },
    }),
    prisma.application.update({
      where: { id: sitting.candidate.application.id },
      data: { examScore: scaled },
    }),
  ]);

  // Advance the application to "examination completed" where the workflow allows it.
  if (sitting.candidate.application.status === APPLICATION_STATUS.EXAM_SCHEDULED) {
    try {
      await applyStatusChange({
        applicationId: sitting.candidate.application.id,
        toStatus: APPLICATION_STATUS.EXAM_COMPLETED,
        remarks: 'Online test submitted and marked automatically.',
      });
    } catch {
      // The workflow engine refused the move; the score is still recorded.
    }
  }

  return {
    answeredCount: marked.answeredCount,
    itemCount: sitting.items.length,
    percentage: marked.percentage,
  };
}
