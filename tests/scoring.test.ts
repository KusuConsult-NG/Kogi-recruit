import { describe, expect, it } from 'vitest';
import {
  ScoreError, consolidatePanelScores, finalScore, parseBulkScores,
  parseCriteria, passFail, rankEntries, totalInterviewScore, validateScore,
} from '@/lib/scoring';
import { DEFAULT_INTERVIEW_CRITERIA } from '@/lib/constants';

describe('score validation (Modules 2.6 / 2.7)', () => {
  it('accepts a score within range and rounds to two decimals', () => {
    expect(validateScore(72, 100)).toBe(72);
    expect(validateScore('68.456', 100)).toBe(68.46);
    expect(validateScore(0, 100)).toBe(0);
    expect(validateScore(100, 100)).toBe(100);
  });

  it('rejects a score above the total marks', () => {
    expect(() => validateScore(101, 100)).toThrow(ScoreError);
    expect(() => validateScore(101, 100)).toThrow(/cannot exceed the total mark of 100/);
  });

  it('rejects a negative score', () => {
    expect(() => validateScore(-1, 100)).toThrow(/cannot be negative/);
  });

  it('rejects a non-numeric score', () => {
    expect(() => validateScore('absent', 100)).toThrow(/must be a number/);
    expect(() => validateScore(undefined, 100)).toThrow(ScoreError);
  });
});

describe('interview score sheets (Module 2.7)', () => {
  const criteria = [...DEFAULT_INTERVIEW_CRITERIA];

  it('totals the criteria to 100 marks by default', () => {
    expect(criteria.reduce((s, c) => s + c.maxScore, 0)).toBe(100);
  });

  it('totals a complete score sheet', () => {
    const { total, normalised } = totalInterviewScore(criteria, {
      knowledge: 25, communication: 18, analytical: 16, conduct: 12, suitability: 13,
    });
    expect(total).toBe(84);
    expect(normalised.knowledge).toBe(25);
  });

  it('treats a missing criterion as zero', () => {
    const { total } = totalInterviewScore(criteria, { knowledge: 30 });
    expect(total).toBe(30);
  });

  it('rejects a criterion score above its maximum', () => {
    expect(() =>
      totalInterviewScore(criteria, { knowledge: 31, communication: 0, analytical: 0, conduct: 0, suitability: 0 }),
    ).toThrow(ScoreError);
  });

  it('parses a stored criteria definition and falls back when invalid', () => {
    const stored = JSON.stringify([{ key: 'a', label: 'Aptitude', maxScore: 60 }]);
    expect(parseCriteria(stored, criteria)).toHaveLength(1);
    expect(parseCriteria('not json', criteria)).toEqual(criteria);
    expect(parseCriteria(null, criteria)).toEqual(criteria);
  });

  it('consolidates panel members by their mean', () => {
    expect(consolidatePanelScores([80, 70, 75])).toBe(75);
    expect(consolidatePanelScores([81, 76])).toBe(78.5);
    expect(consolidatePanelScores([])).toBeNull();
  });
});

describe('final score and ranking (Module 2.8)', () => {
  it('applies the approved weighting', () => {
    expect(finalScore({ examScore: 80, interviewScore: 60, examWeight: 50, interviewWeight: 50 })).toBe(70);
    expect(finalScore({ examScore: 80, interviewScore: 60, examWeight: 70, interviewWeight: 30 })).toBe(74);
  });

  it('uses whichever component is present', () => {
    expect(finalScore({ examScore: 80, interviewScore: null, examWeight: 50, interviewWeight: 50 })).toBe(80);
    expect(finalScore({ examScore: null, interviewScore: 65, examWeight: 50, interviewWeight: 50 })).toBe(65);
  });

  it('returns null when neither component is available', () => {
    expect(finalScore({ examScore: null, interviewScore: null, examWeight: 50, interviewWeight: 50 })).toBeNull();
  });

  it('ignores a component carrying no weight', () => {
    expect(finalScore({ examScore: 10, interviewScore: 90, examWeight: 0, interviewWeight: 100 })).toBe(90);
  });

  it('ranks candidates by final score, highest first', () => {
    const ranked = rankEntries([
      { id: 'a', finalScore: 62 },
      { id: 'b', finalScore: 88 },
      { id: 'c', finalScore: 74 },
    ]);
    expect(ranked.map((r) => r.id)).toEqual(['b', 'c', 'a']);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('gives equal scores the same rank', () => {
    const ranked = rankEntries([
      { id: 'a', finalScore: 80 },
      { id: 'b', finalScore: 80 },
      { id: 'c', finalScore: 70 },
    ]);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(1);
    expect(ranked[2].rank).toBe(3);
  });

  it('ranks unscored candidates last', () => {
    const ranked = rankEntries([{ id: 'a', finalScore: null }, { id: 'b', finalScore: 50 }]);
    expect(ranked[0].id).toBe('b');
  });

  it('reports pass, fail or pending against the pass mark', () => {
    expect(passFail(60, 50)).toBe('PASS');
    expect(passFail(50, 50)).toBe('PASS');
    expect(passFail(49.9, 50)).toBe('FAIL');
    expect(passFail(null, 50)).toBe('PENDING');
    expect(passFail(undefined, 50)).toBe('PENDING');
  });
});

describe('bulk score upload (Module 2.6)', () => {
  it('parses a CSV score sheet with a header row', () => {
    const { rows, errors } = parseBulkScores(
      'Examination Number,Score,Remarks\nKGE/2026/000001,72\nKGE/2026/000002,65,Late arrival',
      100,
    );
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ identifier: 'KGE/2026/000001', score: 72 });
    expect(rows[1].remarks).toBe('Late arrival');
  });

  it('accepts semicolon and tab separators and skips blank lines', () => {
    const { rows } = parseBulkScores('KGE/1;80\n\nKGE/2\t55\n', 100);
    expect(rows.map((r) => r.score)).toEqual([80, 55]);
  });

  it('reports the line number of an invalid score without discarding valid rows', () => {
    const { rows, errors } = parseBulkScores('KGE/1,80\nKGE/2,250\nKGE/3,60', 100);
    expect(rows).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(2);
    expect(errors[0].message).toMatch(/cannot exceed/);
  });

  it('reports a row missing its score', () => {
    const { errors } = parseBulkScores('KGE/1', 100);
    expect(errors[0].message).toMatch(/at least an identifier and a score/);
  });

  it('returns nothing for empty input', () => {
    expect(parseBulkScores('', 100)).toEqual({ rows: [], errors: [] });
  });
});
