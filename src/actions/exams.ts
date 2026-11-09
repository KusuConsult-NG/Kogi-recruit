'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { flashOk } from '@/lib/flash';
import { requirePermission } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/rbac';
import {
  bulkQuestionSchema, examPaperSchema, paperSectionSchema, parseForm,
  questionBankSchema, questionSchema,
} from '@/lib/validation';
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { OPTION_LABELS, PAPER_STATUS } from '@/lib/constants';
import { parseQuestionText } from '@/lib/cbt';
import type { ActionState } from './public';

// ---------------------------------------------------------------------------
// QUESTION BANKS
// ---------------------------------------------------------------------------

export async function createQuestionBank(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.EXAM_SET);
  const parsed = parseForm(questionBankSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;

  const clash = await prisma.questionBank.findUnique({ where: { code: d.code }, select: { id: true } });
  if (clash) {
    return { ok: false, errors: { code: 'That code is already in use.' }, message: 'Code already in use.' };
  }

  const bank = await prisma.questionBank.create({
    data: {
      title: d.title,
      code: d.code,
      subject: d.subject,
      description: d.description || null,
      active: d.active,
      createdById: user.id,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.QUESTION_BANK_CREATED,
    actor: user,
    entityType: 'QuestionBank',
    entityId: bank.id,
    summary: `Created question bank "${d.title}" (${d.code})`,
  });

  revalidatePath('/admin/exams/banks');
  redirect(`/admin/exams/banks/${bank.id}`);
}

export async function updateQuestionBank(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.EXAM_SET);
  const id = String(formData.get('id') ?? '');
  const existing = await prisma.questionBank.findUnique({ where: { id } });
  if (!existing) return { ok: false, message: 'That question bank could not be found.' };

  const parsed = parseForm(questionBankSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;

  const clash = await prisma.questionBank.findFirst({
    where: { code: d.code, id: { not: id } },
    select: { id: true },
  });
  if (clash) {
    return { ok: false, errors: { code: 'That code is already in use.' }, message: 'Code already in use.' };
  }

  await prisma.questionBank.update({
    where: { id },
    data: {
      title: d.title,
      code: d.code,
      subject: d.subject,
      description: d.description || null,
      active: d.active,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.QUESTION_BANK_UPDATED,
    actor: user,
    entityType: 'QuestionBank',
    entityId: id,
    summary: `Updated question bank "${d.title}" (${d.code})`,
  });

  revalidatePath('/admin/exams/banks');
  revalidatePath(`/admin/exams/banks/${id}`);
  return flashOk('Question bank saved.');
}

export async function deleteQuestionBank(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.EXAM_SET);
  const id = String(formData.get('id') ?? '');
  const bank = await prisma.questionBank.findUnique({
    where: { id },
    include: { _count: { select: { questions: true, sections: true } } },
  });
  if (!bank) return;

  if (bank._count.sections > 0) {
    await prisma.questionBank.update({ where: { id }, data: { active: false } });
    await recordAudit({
      action: AUDIT_ACTIONS.QUESTION_BANK_UPDATED,
      actor: user,
      entityType: 'QuestionBank',
      entityId: id,
      summary: `Retired question bank "${bank.title}" (it is used by examination papers)`,
    });
    revalidatePath('/admin/exams/banks');
    return;
  }

  await prisma.questionBank.delete({ where: { id } });
  await recordAudit({
    action: AUDIT_ACTIONS.QUESTION_BANK_UPDATED,
    actor: user,
    entityType: 'QuestionBank',
    entityId: id,
    summary: `Deleted question bank "${bank.title}" and its ${bank._count.questions} question(s)`,
  });
  revalidatePath('/admin/exams/banks');
  redirect('/admin/exams/banks');
}

// ---------------------------------------------------------------------------
// QUESTIONS
// ---------------------------------------------------------------------------

function collectOptions(formData: FormData): { texts: string[]; correct: string[] } {
  const texts: string[] = [];
  for (let i = 0; i < OPTION_LABELS.length; i += 1) {
    texts.push(String(formData.get(`option_${i}`) ?? ''));
  }
  const correct = formData.getAll('correct').map((v) => String(v));
  return { texts, correct };
}

/** Officers set questions one at a time, or import many at once. */
export async function saveQuestion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.EXAM_SET);
  const bankId = String(formData.get('bankId') ?? '');
  const id = String(formData.get('id') ?? '');
  const bank = await prisma.questionBank.findUnique({ where: { id: bankId }, select: { id: true, title: true } });
  if (!bank) return { ok: false, message: 'That question bank could not be found.' };

  const { texts, correct } = collectOptions(formData);
  const parsed = questionSchema.safeParse({
    type: formData.get('type') ?? 'SINGLE_CHOICE',
    stem: formData.get('stem') ?? '',
    topic: formData.get('topic') ?? '',
    difficulty: formData.get('difficulty') ?? 'MEDIUM',
    marks: formData.get('marks') ?? 1,
    explanation: formData.get('explanation') ?? '',
    active: formData.get('active') ?? 'on',
    options: texts,
    correct,
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_form';
      if (!errors[key]) errors[key] = issue.message;
    }
    return { ok: false, errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;

  // Options are rebuilt from the form each time, keeping labels in order.
  const filled = d.options
    .map((text, index) => ({ text: text.trim(), index }))
    .filter((o) => o.text.length > 0);
  const correctSet = new Set(Array.isArray(d.correct) ? d.correct : d.correct ? [d.correct] : []);
  if (!filled.some((o) => correctSet.has(String(o.index)))) {
    return {
      ok: false,
      errors: { correct: 'The option marked correct is empty. Mark one of the completed options.' },
      message: 'Mark the correct answer.',
    };
  }

  const optionData = filled.map((o, position) => ({
    label: OPTION_LABELS[position] ?? String(position + 1),
    text: o.text,
    correct: correctSet.has(String(o.index)),
    position,
  }));

  if (id) {
    const existing = await prisma.question.findUnique({ where: { id }, select: { id: true, bankId: true } });
    if (!existing || existing.bankId !== bankId) return { ok: false, message: 'That question could not be found.' };
    await prisma.$transaction([
      prisma.questionOption.deleteMany({ where: { questionId: id } }),
      prisma.question.update({
        where: { id },
        data: {
          type: d.type,
          stem: d.stem,
          topic: d.topic || null,
          difficulty: d.difficulty,
          marks: d.marks,
          explanation: d.explanation || null,
          active: d.active,
          options: { create: optionData },
        },
      }),
    ]);
  } else {
    const max = await prisma.question.aggregate({ where: { bankId }, _max: { position: true } });
    await prisma.question.create({
      data: {
        bankId,
        type: d.type,
        stem: d.stem,
        topic: d.topic || null,
        difficulty: d.difficulty,
        marks: d.marks,
        explanation: d.explanation || null,
        active: d.active,
        position: (max._max.position ?? 0) + 1,
        createdById: user.id,
        options: { create: optionData },
      },
    });
  }

  await recordAudit({
    action: id ? AUDIT_ACTIONS.QUESTION_UPDATED : AUDIT_ACTIONS.QUESTION_CREATED,
    actor: user,
    entityType: 'Question',
    entityId: id || undefined,
    summary: `${id ? 'Updated' : 'Set'} a question in "${bank.title}"`,
    metadata: { bankId, type: d.type, marks: d.marks },
  });

  revalidatePath(`/admin/exams/banks/${bankId}`);
  return flashOk(`Question ${id ? 'updated' : 'added'}.`);
}

export async function deleteQuestion(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.EXAM_SET);
  const id = String(formData.get('id') ?? '');
  const question = await prisma.question.findUnique({
    where: { id },
    include: { _count: { select: { paperEntries: true, sittingItems: true } } },
  });
  if (!question) return;

  if (question._count.sittingItems > 0) {
    // Candidates have already answered it, so the record must be kept.
    await prisma.question.update({ where: { id }, data: { active: false } });
    await recordAudit({
      action: AUDIT_ACTIONS.QUESTION_UPDATED,
      actor: user,
      entityType: 'Question',
      entityId: id,
      summary: 'Withdrew a question from use (candidates have already answered it)',
    });
  } else {
    await prisma.question.delete({ where: { id } });
    await recordAudit({
      action: AUDIT_ACTIONS.QUESTION_DELETED,
      actor: user,
      entityType: 'Question',
      entityId: id,
      summary: 'Deleted a question',
    });
  }
  revalidatePath(`/admin/exams/banks/${question.bankId}`);
}

/** Import many questions at once from the Commission's plain-text format. */
export async function importQuestions(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.EXAM_SET);
  const bankId = String(formData.get('bankId') ?? '');
  const bank = await prisma.questionBank.findUnique({ where: { id: bankId }, select: { id: true, title: true } });
  if (!bank) return { ok: false, message: 'That question bank could not be found.' };

  const parsed = parseForm(bulkQuestionSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Paste the questions to import.' };
  }

  const marks = Number(formData.get('marks') ?? 1) || 1;
  const difficulty = String(formData.get('difficulty') ?? 'MEDIUM');
  const topic = String(formData.get('topic') ?? '').trim();

  const { questions, errors } = parseQuestionText(parsed.data.payload);
  if (questions.length === 0) {
    return {
      ok: false,
      errors: { payload: errors[0] ?? 'No questions could be read from that text.' },
      message: 'Nothing was imported.',
    };
  }

  const max = await prisma.question.aggregate({ where: { bankId }, _max: { position: true } });
  let position = max._max.position ?? 0;

  for (const q of questions) {
    position += 1;
    await prisma.question.create({
      data: {
        bankId,
        type: q.type,
        stem: q.stem,
        topic: topic || null,
        difficulty: ['EASY', 'MEDIUM', 'HARD'].includes(difficulty) ? difficulty : 'MEDIUM',
        marks,
        position,
        createdById: user.id,
        options: {
          create: q.options.map((o, i) => ({
            label: OPTION_LABELS[i] ?? String(i + 1),
            text: o.text,
            correct: o.correct,
            position: i,
          })),
        },
      },
    });
  }

  await recordAudit({
    action: AUDIT_ACTIONS.QUESTIONS_IMPORTED,
    actor: user,
    entityType: 'QuestionBank',
    entityId: bankId,
    summary: `Imported ${questions.length} question(s) into "${bank.title}"`,
    metadata: { imported: questions.length, rejected: errors.length },
  });

  revalidatePath(`/admin/exams/banks/${bankId}`);
  const note =
    errors.length > 0
      ? `${questions.length} question(s) imported. ${errors.length} block(s) were skipped: ${errors.slice(0, 3).join(' ')}`
      : `${questions.length} question(s) imported.`;
  return flashOk(note);
}

// ---------------------------------------------------------------------------
// EXAMINATION PAPERS
// ---------------------------------------------------------------------------

export async function createExamPaper(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.EXAM_SET);
  const parsed = parseForm(examPaperSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;

  const clash = await prisma.examPaper.findUnique({ where: { code: d.code }, select: { id: true } });
  if (clash) return { ok: false, errors: { code: 'That code is already in use.' }, message: 'Code already in use.' };

  const paper = await prisma.examPaper.create({
    data: {
      title: d.title,
      code: d.code,
      kind: d.kind,
      instructions: d.instructions || null,
      durationMinutes: d.durationMinutes,
      passMark: d.passMark,
      shuffleQuestions: d.shuffleQuestions,
      shuffleOptions: d.shuffleOptions,
      showResultToCandidate: d.showResultToCandidate,
      status: PAPER_STATUS.DRAFT,
      createdById: user.id,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.PAPER_CREATED,
    actor: user,
    entityType: 'ExamPaper',
    entityId: paper.id,
    summary: `Created examination paper "${d.title}" (${d.code})`,
  });

  revalidatePath('/admin/exams/papers');
  redirect(`/admin/exams/papers/${paper.id}`);
}

export async function updateExamPaper(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.EXAM_SET);
  const id = String(formData.get('id') ?? '');
  const existing = await prisma.examPaper.findUnique({
    where: { id },
    include: { _count: { select: { sittings: true } } },
  });
  if (!existing) return { ok: false, message: 'That paper could not be found.' };
  if (existing._count.sittings > 0) {
    return {
      ok: false,
      message: 'Candidates have already sat this paper, so its settings can no longer be changed. Copy it instead.',
    };
  }

  const parsed = parseForm(examPaperSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;

  const clash = await prisma.examPaper.findFirst({ where: { code: d.code, id: { not: id } }, select: { id: true } });
  if (clash) return { ok: false, errors: { code: 'That code is already in use.' }, message: 'Code already in use.' };

  await prisma.examPaper.update({
    where: { id },
    data: {
      title: d.title,
      code: d.code,
      kind: d.kind,
      instructions: d.instructions || null,
      durationMinutes: d.durationMinutes,
      passMark: d.passMark,
      shuffleQuestions: d.shuffleQuestions,
      shuffleOptions: d.shuffleOptions,
      showResultToCandidate: d.showResultToCandidate,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.PAPER_UPDATED,
    actor: user,
    entityType: 'ExamPaper',
    entityId: id,
    summary: `Updated examination paper "${d.title}"`,
  });

  revalidatePath(`/admin/exams/papers/${id}`);
  return flashOk('Paper saved.');
}

export async function savePaperSection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.EXAM_SET);
  const paperId = String(formData.get('paperId') ?? '');
  const id = String(formData.get('id') ?? '');
  const paper = await prisma.examPaper.findUnique({ where: { id: paperId }, select: { id: true, title: true } });
  if (!paper) return { ok: false, message: 'That paper could not be found.' };

  const parsed = parseForm(paperSectionSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;

  if (d.bankId) {
    const bank = await prisma.questionBank.findUnique({
      where: { id: d.bankId },
      include: { _count: { select: { questions: true } } },
    });
    if (!bank) return { ok: false, errors: { bankId: 'That question bank could not be found.' }, message: 'Bank not found.' };
    if (d.drawCount && d.drawCount > bank._count.questions) {
      return {
        ok: false,
        errors: { drawCount: `That bank holds only ${bank._count.questions} question(s).` },
        message: 'Not enough questions in the bank.',
      };
    }
  } else if (d.drawCount) {
    return {
      ok: false,
      errors: { bankId: 'Choose the bank the questions should be drawn from.' },
      message: 'A bank is required to draw questions randomly.',
    };
  }

  const data = {
    paperId,
    title: d.title,
    description: d.description || null,
    bankId: d.bankId || null,
    drawCount: d.drawCount ?? null,
    marksPerQuestion: d.marksPerQuestion,
  };

  if (id) {
    await prisma.examPaperSection.update({ where: { id }, data });
  } else {
    const max = await prisma.examPaperSection.aggregate({ where: { paperId }, _max: { position: true } });
    await prisma.examPaperSection.create({ data: { ...data, position: (max._max.position ?? 0) + 1 } });
  }

  await recordAudit({
    action: AUDIT_ACTIONS.PAPER_UPDATED,
    actor: user,
    entityType: 'ExamPaperSection',
    entityId: id || undefined,
    summary: `${id ? 'Updated' : 'Added'} section "${d.title}" on paper "${paper.title}"`,
  });

  revalidatePath(`/admin/exams/papers/${paperId}`);
  return flashOk(`Section ${id ? 'updated' : 'added'}.`);
}

export async function deletePaperSection(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.EXAM_SET);
  const id = String(formData.get('id') ?? '');
  const section = await prisma.examPaperSection.findUnique({ where: { id }, select: { id: true, paperId: true, title: true } });
  if (!section) return;
  await prisma.examPaperSection.delete({ where: { id } });
  await recordAudit({
    action: AUDIT_ACTIONS.PAPER_UPDATED,
    actor: user,
    entityType: 'ExamPaperSection',
    entityId: id,
    summary: `Removed section "${section.title}" from a paper`,
  });
  revalidatePath(`/admin/exams/papers/${section.paperId}`);
}

/** Pick named questions into a section (as opposed to drawing them randomly). */
export async function setSectionQuestions(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.EXAM_SET);
  const sectionId = String(formData.get('sectionId') ?? '');
  const section = await prisma.examPaperSection.findUnique({
    where: { id: sectionId },
    select: { id: true, paperId: true, title: true, bankId: true, marksPerQuestion: true },
  });
  if (!section) return { ok: false, message: 'That section could not be found.' };

  const ids = formData.getAll('questionIds').map((v) => String(v)).filter(Boolean);
  if (ids.length === 0) {
    return { ok: false, errors: { questionIds: 'Select at least one question.' }, message: 'No questions selected.' };
  }

  const questions = await prisma.question.findMany({
    where: { id: { in: ids }, active: true },
    select: { id: true, marks: true },
  });
  if (questions.length !== ids.length) {
    return { ok: false, message: 'One or more of the selected questions is no longer available.' };
  }

  await prisma.$transaction([
    prisma.examPaperQuestion.deleteMany({ where: { sectionId } }),
    prisma.examPaperQuestion.createMany({
      data: questions.map((q, position) => ({
        sectionId,
        questionId: q.id,
        marks: section.marksPerQuestion > 0 ? section.marksPerQuestion : q.marks,
        position,
      })),
    }),
    prisma.examPaperSection.update({ where: { id: sectionId }, data: { drawCount: null } }),
  ]);

  await recordAudit({
    action: AUDIT_ACTIONS.PAPER_UPDATED,
    actor: user,
    entityType: 'ExamPaperSection',
    entityId: sectionId,
    summary: `Set ${questions.length} question(s) on section "${section.title}"`,
  });

  revalidatePath(`/admin/exams/papers/${section.paperId}`);
  return flashOk(`${questions.length} question(s) set on this section.`);
}

/** Publish a paper so it can be attached to an examination schedule. */
export async function changePaperStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.EXAM_SET);
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  const paper = await prisma.examPaper.findUnique({
    where: { id },
    include: {
      sections: { include: { _count: { select: { questions: true } } } },
      _count: { select: { schedules: true } },
    },
  });
  if (!paper) return { ok: false, message: 'That paper could not be found.' };
  if (!Object.values(PAPER_STATUS).includes(status as never)) {
    return { ok: false, message: 'That status is not recognised.' };
  }

  if (status === PAPER_STATUS.PUBLISHED) {
    if (paper.sections.length === 0) {
      return { ok: false, message: 'Add at least one section before publishing this paper.' };
    }
    const empty = paper.sections.filter((s) => !s.drawCount && s._count.questions === 0);
    if (empty.length > 0) {
      return {
        ok: false,
        message: `Section "${empty[0].title}" has no questions and does not draw any from a bank.`,
      };
    }
  }

  if (status === PAPER_STATUS.RETIRED && paper._count.schedules > 0) {
    const live = await prisma.examSchedule.count({
      where: { paperId: id, status: { in: ['SCHEDULED', 'ONGOING'] } },
    });
    if (live > 0) {
      return { ok: false, message: 'This paper is attached to an examination that has not finished. Cancel or complete it first.' };
    }
  }

  await prisma.examPaper.update({
    where: { id },
    data: {
      status,
      publishedAt: status === PAPER_STATUS.PUBLISHED ? (paper.publishedAt ?? new Date()) : paper.publishedAt,
    },
  });

  await recordAudit({
    action: status === PAPER_STATUS.PUBLISHED ? AUDIT_ACTIONS.PAPER_PUBLISHED : AUDIT_ACTIONS.PAPER_RETIRED,
    actor: user,
    entityType: 'ExamPaper',
    entityId: id,
    summary: `${status === PAPER_STATUS.PUBLISHED ? 'Published' : status === PAPER_STATUS.RETIRED ? 'Retired' : 'Returned to draft'} examination paper "${paper.title}"`,
  });

  revalidatePath('/admin/exams/papers');
  revalidatePath(`/admin/exams/papers/${id}`);
  return flashOk(
    status === PAPER_STATUS.PUBLISHED
      ? 'Paper published. It can now be attached to an examination.'
      : status === PAPER_STATUS.RETIRED
        ? 'Paper retired.'
        : 'Paper returned to draft.',
  );
}

/** Duplicate a paper, so a sat paper can be revised without altering records. */
export async function copyExamPaper(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.EXAM_SET);
  const id = String(formData.get('id') ?? '');
  const paper = await prisma.examPaper.findUnique({
    where: { id },
    include: { sections: { include: { questions: true }, orderBy: { position: 'asc' } } },
  });
  if (!paper) return;

  let code = `${paper.code}-C`;
  for (let i = 2; await prisma.examPaper.findUnique({ where: { code }, select: { id: true } }); i += 1) {
    code = `${paper.code}-C${i}`;
  }

  const copy = await prisma.examPaper.create({
    data: {
      title: `${paper.title} (copy)`,
      code,
      kind: paper.kind,
      instructions: paper.instructions,
      durationMinutes: paper.durationMinutes,
      passMark: paper.passMark,
      shuffleQuestions: paper.shuffleQuestions,
      shuffleOptions: paper.shuffleOptions,
      showResultToCandidate: paper.showResultToCandidate,
      status: PAPER_STATUS.DRAFT,
      createdById: user.id,
      sections: {
        create: paper.sections.map((s) => ({
          title: s.title,
          description: s.description,
          bankId: s.bankId,
          drawCount: s.drawCount,
          marksPerQuestion: s.marksPerQuestion,
          position: s.position,
          questions: {
            create: s.questions.map((q) => ({ questionId: q.questionId, marks: q.marks, position: q.position })),
          },
        })),
      },
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.PAPER_CREATED,
    actor: user,
    entityType: 'ExamPaper',
    entityId: copy.id,
    summary: `Copied examination paper "${paper.title}" as ${code}`,
  });

  revalidatePath('/admin/exams/papers');
  redirect(`/admin/exams/papers/${copy.id}`);
}
