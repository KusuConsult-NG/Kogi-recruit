/**
 * Computer-based testing engine.
 *
 * These are pure functions: assembling a candidate's paper, ordering and
 * shuffling, marking a single answer and totalling a sitting. The server
 * actions in src/actions/exams.ts and src/actions/cbt.ts persist the results.
 */

export interface EngineOption {
  id: string;
  label: string;
  text: string;
  correct: boolean;
  position: number;
}

export interface EngineQuestion {
  id: string;
  type: string;
  stem: string;
  marks: number;
  options: EngineOption[];
}

export interface EnginePaperQuestion {
  questionId: string;
  sectionTitle: string;
  marks: number;
  question: EngineQuestion;
}

export interface AssembledItem {
  questionId: string;
  sectionTitle: string;
  position: number;
  marks: number;
  optionOrder: string[];
}

export class CbtError extends Error {}

/**
 * Deterministic pseudo-random generator so a candidate who reloads the page
 * sees the same paper, and so tests are repeatable.
 */
export function seededRandom(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Draw `count` questions from a pool, spreading difficulty where possible. */
export function drawQuestions(
  pool: EngineQuestion[],
  count: number,
  rand: () => number,
): EngineQuestion[] {
  if (count >= pool.length) return shuffle(pool, rand);
  return shuffle(pool, rand).slice(0, count);
}

/**
 * Build the ordered list of items a single candidate will sit, applying the
 * paper's shuffle settings against a per-sitting seed.
 */
export function assemblePaper(
  questions: EnginePaperQuestion[],
  options: { seed: string; shuffleQuestions: boolean; shuffleOptions: boolean },
): AssembledItem[] {
  if (questions.length === 0) {
    throw new CbtError('This paper has no questions, so it cannot be sat.');
  }
  const rand = seededRandom(options.seed);
  const ordered = options.shuffleQuestions ? shuffle(questions, rand) : questions;

  return ordered.map((entry, index) => {
    const opts = [...entry.question.options].sort((a, b) => a.position - b.position);
    const arranged = options.shuffleOptions ? shuffle(opts, rand) : opts;
    return {
      questionId: entry.questionId,
      sectionTitle: entry.sectionTitle,
      position: index + 1,
      marks: entry.marks > 0 ? entry.marks : entry.question.marks,
      optionOrder: arranged.map((o) => o.id),
    };
  });
}

export function totalMarks(items: Array<{ marks: number }>): number {
  return round2(items.reduce((sum, i) => sum + i.marks, 0));
}

/**
 * Mark one answer. A single-answer question needs the one correct option.
 * A multiple-answer question is all-or-nothing: every correct option and no
 * incorrect one, which is the Commission's standing instruction for
 * objective papers.
 */
export function markAnswer(
  question: { type: string; options: Array<{ id: string; correct: boolean }> },
  selected: string[],
  marks: number,
): { correct: boolean; awarded: number } {
  const correctIds = question.options.filter((o) => o.correct).map((o) => o.id).sort();
  const chosen = Array.from(new Set(selected.filter(Boolean))).sort();
  if (chosen.length === 0) return { correct: false, awarded: 0 };
  if (question.type !== 'MULTI_CHOICE' && chosen.length > 1) {
    return { correct: false, awarded: 0 };
  }
  const same =
    chosen.length === correctIds.length && chosen.every((id, i) => id === correctIds[i]);
  return { correct: same, awarded: same ? round2(marks) : 0 };
}

export interface MarkedSitting {
  rawScore: number;
  totalMarks: number;
  percentage: number;
  answeredCount: number;
  correctCount: number;
}

/** Total a sitting from its already-marked items. */
export function markSitting(
  items: Array<{ marks: number; awarded: number; selected?: string | null }>,
): MarkedSitting {
  const total = totalMarks(items);
  const raw = round2(items.reduce((s, i) => s + (i.awarded ?? 0), 0));
  const answered = items.filter((i) => (i.selected ?? '').trim().length > 0).length;
  const correctCount = items.filter((i) => (i.awarded ?? 0) > 0).length;
  return {
    rawScore: raw,
    totalMarks: total,
    percentage: total > 0 ? round2((raw / total) * 100) : 0,
    answeredCount: answered,
    correctCount,
  };
}

/** Scale a sitting percentage onto the examination schedule's total marks. */
export function scaleToSchedule(percentage: number, scheduleTotalMarks: number): number {
  return round2((percentage / 100) * scheduleTotalMarks);
}

export function parseSelected(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}

export function serialiseSelected(ids: string[]): string | null {
  const clean = Array.from(new Set(ids.filter(Boolean)));
  return clean.length > 0 ? clean.join(',') : null;
}

/** Seconds left in a sitting; never negative. */
export function remainingSeconds(expiresAt: Date | null | undefined, now = new Date()): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
}

export function isExpired(expiresAt: Date | null | undefined, now = new Date()): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() <= now.getTime();
}

/**
 * Parse pasted or uploaded questions in the Commission's plain-text format:
 *
 *   What is the capital of Kogi State?
 *   *Lokoja
 *   Okene
 *   Idah
 *   Ankpa
 *
 * A blank line separates questions; an asterisk marks a correct option.
 * Multiple asterisks make it a multiple-answer question.
 */
export interface ParsedQuestion {
  stem: string;
  type: string;
  options: Array<{ text: string; correct: boolean }>;
}

export function parseQuestionText(input: string): {
  questions: ParsedQuestion[];
  errors: string[];
} {
  const blocks = input
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const questions: ParsedQuestion[] = [];
  const errors: string[] = [];

  blocks.forEach((block, index) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const stem = lines.shift() ?? '';
    const n = index + 1;
    if (!stem) {
      errors.push(`Question ${n}: the question text is missing.`);
      return;
    }
    if (lines.length < 2) {
      errors.push(`Question ${n}: give at least two answer options.`);
      return;
    }
    const options = lines.map((line) => {
      const correct = line.startsWith('*');
      const text = (correct ? line.slice(1) : line).replace(/^[A-Fa-f][).]\s*/, '').trim();
      return { text, correct };
    });
    if (options.some((o) => !o.text)) {
      errors.push(`Question ${n}: one of the options is empty.`);
      return;
    }
    const correctCount = options.filter((o) => o.correct).length;
    if (correctCount === 0) {
      errors.push(`Question ${n}: mark the correct option with an asterisk, for example "*Lokoja".`);
      return;
    }
    questions.push({
      stem,
      type: correctCount > 1 ? 'MULTI_CHOICE' : options.length === 2 ? 'TRUE_FALSE' : 'SINGLE_CHOICE',
      options,
    });
  });

  return { questions, errors };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
