/** Module 2.6 / 2.7 / 2.8 - score validation and consolidation. */

export class ScoreError extends Error {}

/** Validate a single score against a maximum. An absent score is not treated as zero. */
export function validateScore(value: unknown, totalMarks: number): number {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    throw new ScoreError('A score is required.');
  }
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) throw new ScoreError('Score must be a number.');
  if (n < 0) throw new ScoreError('Score cannot be negative.');
  if (n > totalMarks) throw new ScoreError(`Score cannot exceed the total mark of ${totalMarks}.`);
  return Math.round(n * 100) / 100;
}

export interface Criterion {
  key: string;
  label: string;
  maxScore: number;
}

export function parseCriteria(json?: string | null, fallback: Criterion[] = []): Criterion[] {
  if (!json) return fallback;
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.every((c) => c && typeof c.key === 'string')) {
      return parsed as Criterion[];
    }
  } catch {
    /* fall through */
  }
  return fallback;
}

/** Validate a per-criterion interview score sheet and return its total. */
export function totalInterviewScore(
  criteria: Criterion[],
  scores: Record<string, unknown>,
): { total: number; normalised: Record<string, number> } {
  const normalised: Record<string, number> = {};
  let total = 0;
  for (const c of criteria) {
    const value = validateScore(scores[c.key] ?? 0, c.maxScore);
    normalised[c.key] = value;
    total += value;
  }
  return { total: Math.round(total * 100) / 100, normalised };
}

/** Mean of all panel member scores for one candidate. */
export function consolidatePanelScores(memberTotals: number[]): number | null {
  if (memberTotals.length === 0) return null;
  const sum = memberTotals.reduce((a, b) => a + b, 0);
  return Math.round((sum / memberTotals.length) * 100) / 100;
}

/** Weighted final score from examination and interview components. */
export function finalScore(opts: {
  examScore?: number | null;
  interviewScore?: number | null;
  examWeight: number;
  interviewWeight: number;
}): number | null {
  const { examScore, interviewScore, examWeight, interviewWeight } = opts;
  const parts: Array<{ score: number; weight: number }> = [];
  if (typeof examScore === 'number' && examWeight > 0) parts.push({ score: examScore, weight: examWeight });
  if (typeof interviewScore === 'number' && interviewWeight > 0) {
    parts.push({ score: interviewScore, weight: interviewWeight });
  }
  if (parts.length === 0) return null;
  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  const weighted = parts.reduce((s, p) => s + p.score * p.weight, 0);
  return Math.round((weighted / totalWeight) * 100) / 100;
}

/** Rank entries by final score (descending); equal scores share a rank. */
export function rankEntries<T extends { finalScore?: number | null }>(
  entries: T[],
): Array<T & { rank: number }> {
  const sorted = [...entries].sort((a, b) => (b.finalScore ?? -1) - (a.finalScore ?? -1));
  let lastScore: number | null = null;
  let lastRank = 0;
  return sorted.map((entry, index) => {
    const score = entry.finalScore ?? null;
    const rank = score !== null && score === lastScore ? lastRank : index + 1;
    lastScore = score;
    lastRank = rank;
    return { ...entry, rank };
  });
}

/** Parse a pasted/uploaded bulk score sheet (CSV: identifier,score[,remarks]). */
export interface BulkScoreRow {
  identifier: string;
  score: number;
  remarks?: string;
  line: number;
}
export interface BulkScoreParse {
  rows: BulkScoreRow[];
  errors: Array<{ line: number; message: string }>;
}

export function parseBulkScores(csv: string, totalMarks: number): BulkScoreParse {
  const rows: BulkScoreRow[] = [];
  const errors: Array<{ line: number; message: string }> = [];
  const lines = csv.split(/\r?\n/);

  lines.forEach((raw, i) => {
    const line = i + 1;
    const text = raw.trim();
    if (!text) return;
    if (i === 0 && /identifier|exam|reference|candidate/i.test(text) && /score/i.test(text)) return;
    const parts = text.split(/[,;\t]/).map((p) => p.trim());
    if (parts.length < 2) {
      errors.push({ line, message: 'Expected at least an identifier and a score.' });
      return;
    }
    const [identifier, scoreText, ...rest] = parts;
    if (!identifier) {
      errors.push({ line, message: 'Missing candidate identifier.' });
      return;
    }
    try {
      rows.push({
        identifier,
        score: validateScore(scoreText, totalMarks),
        remarks: rest.join(', ') || undefined,
        line,
      });
    } catch (error) {
      errors.push({ line, message: error instanceof Error ? error.message : 'Invalid score.' });
    }
  });

  return { rows, errors };
}

export function passFail(score: number | null | undefined, passMark: number): 'PASS' | 'FAIL' | 'PENDING' {
  if (typeof score !== 'number') return 'PENDING';
  return score >= passMark ? 'PASS' : 'FAIL';
}
