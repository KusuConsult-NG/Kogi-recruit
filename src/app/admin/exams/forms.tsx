'use client';

import { useState } from 'react';
import {
  changePaperStatus, createExamPaper, createQuestionBank, importQuestions,
  savePaperSection, saveQuestion, setSectionQuestions, updateExamPaper, updateQuestionBank,
} from '@/actions/exams';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Field, readable } from '@/components/ui';
import {
  DIFFICULTIES, EXAM_SUBJECTS, OPTION_LABELS, PAPER_KINDS, QUESTION_TYPES,
} from '@/lib/constants';

/* ---------------------------------------------------------------------------
 * Question banks
 * ------------------------------------------------------------------------- */

export interface BankValues {
  id?: string;
  title: string;
  code: string;
  subject: string;
  description: string;
  active: boolean;
}

export function QuestionBankForm({ initial }: { initial?: BankValues }) {
  const editing = Boolean(initial?.id);
  return (
    <ActionForm action={editing ? updateQuestionBank : createQuestionBank} className="space-y-4">
      {(state) => (
        <>
          {editing ? <input type="hidden" name="id" value={initial!.id} /> : null}
          <Field label="Bank title" name="title" required error={state.errors?.title}>
            <input
              id="title"
              name="title"
              required
              defaultValue={initial?.title}
              className="input"
              placeholder="General aptitude — numerical reasoning"
            />
          </Field>
          <div className="space-y-4">
            <Field label="Short code" name="code" required error={state.errors?.code}>
              <input
                id="code"
                name="code"
                required
                defaultValue={initial?.code}
                className="input font-mono uppercase"
                placeholder="APT-NUM"
              />
            </Field>
            <Field label="Subject" name="subject" required error={state.errors?.subject}>
              <select id="subject" name="subject" required className="select" defaultValue={initial?.subject ?? 'APTITUDE'}>
                {EXAM_SUBJECTS.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Description" name="description" error={state.errors?.description}>
            <textarea id="description" name="description" rows={2} defaultValue={initial?.description} className="textarea" />
          </Field>
          <label className="flex items-center gap-2 text-sm text-ink-800">
            <input type="checkbox" name="active" className="checkbox" defaultChecked={initial?.active ?? true} />
            Active — questions may be drawn from this bank
          </label>
          <SubmitButton pendingLabel="Saving…">{editing ? 'Save bank' : 'Create bank'}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

/* ---------------------------------------------------------------------------
 * Questions
 * ------------------------------------------------------------------------- */

export interface QuestionValues {
  id: string;
  type: string;
  stem: string;
  topic: string;
  difficulty: string;
  marks: number;
  explanation: string;
  active: boolean;
  options: Array<{ text: string; correct: boolean }>;
}

/**
 * Set a single question. The answer options are indexed, and the radio or
 * checkbox beside each marks it as a correct answer.
 */
export function QuestionForm({
  bankId,
  initial,
  onDone,
}: {
  bankId: string;
  initial?: QuestionValues;
  onDone?: () => void;
}) {
  const [type, setType] = useState(initial?.type ?? 'SINGLE_CHOICE');
  const multi = type === 'MULTI_CHOICE';
  const visibleOptions = type === 'TRUE_FALSE' ? 2 : OPTION_LABELS.length;
  const defaults =
    initial?.options ??
    (type === 'TRUE_FALSE'
      ? [{ text: 'True', correct: false }, { text: 'False', correct: false }]
      : []);

  return (
    <ActionForm
      action={saveQuestion}
      resetOnSuccess={!initial}
      className="space-y-4"
      onSubmit={onDone ? () => onDone() : undefined}
    >
      {(state) => (
        <>
          <input type="hidden" name="bankId" value={bankId} />
          {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.4fr_1fr_5.5rem_1.4fr]">
            <Field label="Question type" name={`type-${initial?.id ?? 'new'}`} required error={state.errors?.type}>
              <select
                id={`type-${initial?.id ?? 'new'}`}
                name="type"
                required
                className="select"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {QUESTION_TYPES.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Difficulty" name={`difficulty-${initial?.id ?? 'new'}`} error={state.errors?.difficulty}>
              <select
                id={`difficulty-${initial?.id ?? 'new'}`}
                name="difficulty"
                className="select"
                defaultValue={initial?.difficulty ?? 'MEDIUM'}
              >
                {DIFFICULTIES.map((d) => <option key={d} value={d}>{readable(d)}</option>)}
              </select>
            </Field>
            <Field label="Marks" name={`marks-${initial?.id ?? 'new'}`} error={state.errors?.marks}>
              <input
                id={`marks-${initial?.id ?? 'new'}`}
                name="marks"
                type="number"
                step="0.25"
                min="0.25"
                defaultValue={initial?.marks ?? 1}
                className="input"
              />
            </Field>
            <Field label="Topic" name={`topic-${initial?.id ?? 'new'}`} error={state.errors?.topic}>
              <input id={`topic-${initial?.id ?? 'new'}`} name="topic" defaultValue={initial?.topic} className="input" />
            </Field>
          </div>

          <Field label="Question" name={`stem-${initial?.id ?? 'new'}`} required error={state.errors?.stem}>
            <textarea
              id={`stem-${initial?.id ?? 'new'}`}
              name="stem"
              rows={2}
              required
              defaultValue={initial?.stem}
              className="textarea min-h-[64px]"
              placeholder="Which Local Government Area is the capital of Kogi State situated in?"
            />
          </Field>

          <fieldset>
            <legend className="micro-label mb-2">
              Answer options — {multi ? 'tick every correct answer' : 'mark the one correct answer'}
            </legend>
            <div className="space-y-2">
              {Array.from({ length: visibleOptions }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type={multi ? 'checkbox' : 'radio'}
                      name="correct"
                      value={String(i)}
                      className={multi ? 'checkbox' : 'radio'}
                      defaultChecked={defaults[i]?.correct ?? false}
                      aria-label={`Option ${OPTION_LABELS[i]} is correct`}
                    />
                    <span className="w-4 font-mono text-xs font-semibold text-ink-600">{OPTION_LABELS[i]}</span>
                  </label>
                  <input
                    name={`option_${i}`}
                    defaultValue={defaults[i]?.text ?? ''}
                    className="input"
                    placeholder={i < 2 ? `Option ${OPTION_LABELS[i]} (required)` : `Option ${OPTION_LABELS[i]} (optional)`}
                    aria-label={`Option ${OPTION_LABELS[i]}`}
                  />
                </div>
              ))}
            </div>
            {state.errors?.options ? <p className="error-text">{state.errors.options}</p> : null}
            {state.errors?.correct ? <p className="error-text">{state.errors.correct}</p> : null}
          </fieldset>

          <Field
            label="Explanation"
            name={`explanation-${initial?.id ?? 'new'}`}
            error={state.errors?.explanation}
            hint="Kept on the record for moderation; never shown to a candidate during a test."
          >
            <input
              id={`explanation-${initial?.id ?? 'new'}`}
              name="explanation"
              defaultValue={initial?.explanation}
              className="input"
            />
          </Field>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 pt-4">
            <label className="flex items-center gap-2 text-sm text-ink-800">
              <input type="checkbox" name="active" className="checkbox" defaultChecked={initial?.active ?? true} />
              In use
            </label>
            <SubmitButton className={initial ? 'btn-secondary btn-sm' : 'btn-primary'} pendingLabel="Saving…">
              {initial ? 'Save question' : 'Add question to bank'}
            </SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/** Paste many questions at once in the Commission's plain-text format. */
export function QuestionImportForm({ bankId }: { bankId: string }) {
  return (
    <ActionForm action={importQuestions} resetOnSuccess className="space-y-4">
      {(state) => (
        <>
          <input type="hidden" name="bankId" value={bankId} />
          <div className="rounded-sm border border-ink-200 bg-ink-50 p-3">
            <p className="micro-label mb-1.5">Format</p>
            <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-ink-700">{`In which Local Government Area is Lokoja situated?
*Lokoja
Okene
Idah
Ankpa

The rivers Niger and Benue meet at which city?
*Lokoja
Ajaokuta`}</pre>
            <p className="mt-2 text-xs leading-relaxed text-ink-600">
              One blank line between questions. The question comes first, then the options, each on its
              own line. Mark a correct option with an asterisk. Two or more asterisks make it a
              multiple-answer question.
            </p>
          </div>
          <Field label="Questions" name="payload" required error={state.errors?.payload}>
            <textarea id="payload" name="payload" rows={12} required className="textarea font-mono text-xs" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Marks per question" name="import-marks">
              <input id="import-marks" name="marks" type="number" step="0.25" min="0.25" defaultValue={1} className="input" />
            </Field>
            <Field label="Difficulty" name="import-difficulty">
              <select id="import-difficulty" name="difficulty" className="select" defaultValue="MEDIUM">
                {DIFFICULTIES.map((d) => <option key={d} value={d}>{readable(d)}</option>)}
              </select>
            </Field>
            <Field label="Topic" name="import-topic">
              <input id="import-topic" name="topic" className="input" placeholder="Optional" />
            </Field>
          </div>
          <SubmitButton className="btn-secondary" pendingLabel="Importing…">Import questions</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

/* ---------------------------------------------------------------------------
 * Papers
 * ------------------------------------------------------------------------- */

export interface PaperValues {
  id?: string;
  title: string;
  code: string;
  kind: string;
  instructions: string;
  durationMinutes: number;
  passMark: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResultToCandidate: boolean;
}

export function ExamPaperForm({ initial, locked }: { initial?: PaperValues; locked?: boolean }) {
  const editing = Boolean(initial?.id);
  if (locked) {
    return (
      <p className="text-sm text-ink-600">
        Candidates have already sat this paper, so its settings are locked to preserve the record.
        Copy the paper to produce a revised version.
      </p>
    );
  }
  return (
    <ActionForm action={editing ? updateExamPaper : createExamPaper} className="space-y-4">
      {(state) => (
        <>
          {editing ? <input type="hidden" name="id" value={initial!.id} /> : null}
          <Field label="Paper title" name="title" required error={state.errors?.title}>
            <input
              id="title"
              name="title"
              required
              defaultValue={initial?.title}
              className="input"
              placeholder="2026 Junior Cadre Aptitude Test"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Paper code" name="code" required error={state.errors?.code}>
              <input
                id="code"
                name="code"
                required
                defaultValue={initial?.code}
                className="input font-mono uppercase"
                placeholder="APT-2026-JC"
              />
            </Field>
            <Field label="Kind of paper" name="kind" required error={state.errors?.kind}>
              <select id="kind" name="kind" required className="select" defaultValue={initial?.kind ?? 'APTITUDE_TEST'}>
                {PAPER_KINDS.map((k) => <option key={k.code} value={k.code}>{k.label}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Duration (minutes)"
              name="durationMinutes"
              required
              error={state.errors?.durationMinutes}
              hint="The clock starts when the candidate begins and the paper submits itself when it runs out."
            >
              <input
                id="durationMinutes"
                name="durationMinutes"
                type="number"
                min={5}
                max={480}
                required
                defaultValue={initial?.durationMinutes ?? 60}
                className="input"
              />
            </Field>
            <Field
              label="Pass mark (%)"
              name="passMark"
              required
              error={state.errors?.passMark}
            >
              <input
                id="passMark"
                name="passMark"
                type="number"
                min={0}
                max={100}
                step="0.5"
                required
                defaultValue={initial?.passMark ?? 50}
                className="input"
              />
            </Field>
          </div>
          <Field
            label="Instructions to candidates"
            name="instructions"
            error={state.errors?.instructions}
            hint="Shown on the cover page before the clock starts."
          >
            <textarea id="instructions" name="instructions" rows={4} defaultValue={initial?.instructions} className="textarea" />
          </Field>
          <fieldset className="space-y-2 border-t border-ink-200 pt-4">
            <legend className="micro-label mb-1">Conduct of the paper</legend>
            <label className="flex items-center gap-2 text-sm text-ink-800">
              <input type="checkbox" name="shuffleQuestions" className="checkbox" defaultChecked={initial?.shuffleQuestions ?? true} />
              Present the questions in a different order for each candidate
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-800">
              <input type="checkbox" name="shuffleOptions" className="checkbox" defaultChecked={initial?.shuffleOptions ?? true} />
              Shuffle the answer options
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-800">
              <input
                type="checkbox"
                name="showResultToCandidate"
                className="checkbox"
                defaultChecked={initial?.showResultToCandidate ?? false}
              />
              Show the candidate their score immediately after submission
            </label>
          </fieldset>
          <SubmitButton pendingLabel="Saving…">{editing ? 'Save paper' : 'Create paper'}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function PaperSectionForm({
  paperId,
  banks,
  initial,
}: {
  paperId: string;
  banks: Array<{ id: string; title: string; code: string; questionCount: number }>;
  initial?: { id: string; title: string; description: string; bankId: string; drawCount: string; marksPerQuestion: number };
}) {
  const [bankId, setBankId] = useState(initial?.bankId ?? '');
  const bank = banks.find((b) => b.id === bankId);
  return (
    <ActionForm action={savePaperSection} resetOnSuccess={!initial} className="space-y-4">
      {(state) => (
        <>
          <input type="hidden" name="paperId" value={paperId} />
          {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
          <Field label="Section title" name={`sec-title-${initial?.id ?? 'new'}`} required error={state.errors?.title}>
            <input
              id={`sec-title-${initial?.id ?? 'new'}`}
              name="title"
              required
              defaultValue={initial?.title}
              className="input"
              placeholder="Section A — Numerical reasoning"
            />
          </Field>
          <Field label="Instructions for the section" name={`sec-desc-${initial?.id ?? 'new'}`} error={state.errors?.description}>
            <input
              id={`sec-desc-${initial?.id ?? 'new'}`}
              name="description"
              defaultValue={initial?.description}
              className="input"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Question bank" name={`sec-bank-${initial?.id ?? 'new'}`} error={state.errors?.bankId}>
              <select
                id={`sec-bank-${initial?.id ?? 'new'}`}
                name="bankId"
                className="select"
                value={bankId}
                onChange={(e) => setBankId(e.target.value)}
              >
                <option value="">Questions chosen by hand</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} ({b.questionCount})
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Draw at random"
              name={`sec-draw-${initial?.id ?? 'new'}`}
              error={state.errors?.drawCount}
              hint={bank ? `${bank.questionCount} available` : 'Needs a bank'}
            >
              <input
                id={`sec-draw-${initial?.id ?? 'new'}`}
                name="drawCount"
                type="number"
                min={1}
                max={bank?.questionCount ?? 200}
                defaultValue={initial?.drawCount}
                disabled={!bankId}
                className="input"
                placeholder="e.g. 20"
              />
            </Field>
            <Field label="Marks per question" name={`sec-marks-${initial?.id ?? 'new'}`} error={state.errors?.marksPerQuestion}>
              <input
                id={`sec-marks-${initial?.id ?? 'new'}`}
                name="marksPerQuestion"
                type="number"
                step="0.25"
                min="0.25"
                defaultValue={initial?.marksPerQuestion ?? 1}
                className="input"
              />
            </Field>
          </div>
          <SubmitButton className="btn-secondary" pendingLabel="Saving…">
            {initial ? 'Save section' : 'Add section'}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

/** Choose named questions for a section instead of drawing them at random. */
export function SectionQuestionPicker({
  sectionId,
  questions,
  selectedIds,
}: {
  sectionId: string;
  questions: Array<{ id: string; stem: string; difficulty: string; marks: number }>;
  selectedIds: string[];
}) {
  const selected = new Set(selectedIds);
  return (
    <ActionForm action={setSectionQuestions} className="space-y-3">
      {(state) => (
        <>
          <input type="hidden" name="sectionId" value={sectionId} />
          {state.errors?.questionIds ? <p className="error-text">{state.errors.questionIds}</p> : null}
          <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-sm border border-ink-200 bg-white p-3">
            {questions.length === 0 ? (
              <p className="text-sm text-ink-500">This bank holds no active questions yet.</p>
            ) : (
              questions.map((q) => (
                <label key={q.id} className="flex items-start gap-2.5 rounded-sm px-1 py-1 hover:bg-kogi-50">
                  <input
                    type="checkbox"
                    name="questionIds"
                    value={q.id}
                    defaultChecked={selected.has(q.id)}
                    className="checkbox mt-0.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.8125rem] leading-snug text-ink-900">{q.stem}</span>
                    <span className="mt-0.5 block text-xs text-ink-500">
                      {q.difficulty.toLowerCase()} · {q.marks} mark{q.marks === 1 ? '' : 's'}
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
          <SubmitButton className="btn-secondary btn-sm" pendingLabel="Saving…">
            Set these questions on the section
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function PaperStatusForm({
  paperId,
  to,
  label,
  tone = 'btn-secondary',
  confirm,
}: {
  paperId: string;
  to: string;
  label: string;
  tone?: string;
  confirm?: string;
}) {
  return (
    <ActionForm
      action={changePaperStatus}
      className="inline"
      onSubmit={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}
    >
      {() => (
        <>
          <input type="hidden" name="id" value={paperId} />
          <input type="hidden" name="status" value={to} />
          <SubmitButton className={`${tone} btn-sm`} pendingLabel="Working…">{label}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
