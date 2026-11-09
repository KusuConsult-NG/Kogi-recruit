import { describe, it, expect } from 'vitest';
import {
  assemblePaper, CbtError, drawQuestions, isExpired, markAnswer, markSitting,
  parseQuestionText, parseSelected, remainingSeconds, scaleToSchedule,
  seededRandom, serialiseSelected, shuffle, totalMarks,
  type EnginePaperQuestion, type EngineQuestion,
} from '@/lib/cbt';
import {
  examPaperSchema, paperSectionSchema, questionBankSchema, questionSchema,
  ministrySchema, recruitmentUnitSchema, unitMemberSchema,
} from '@/lib/validation';
import { fieldErrors } from '@/lib/validation';

function question(id: string, correct: string[], type = 'SINGLE_CHOICE'): EngineQuestion {
  return {
    id,
    type,
    stem: `Question ${id}`,
    marks: 1,
    options: ['a', 'b', 'c', 'd'].map((suffix, i) => ({
      id: `${id}-${suffix}`,
      label: ['A', 'B', 'C', 'D'][i],
      text: `Option ${suffix}`,
      correct: correct.includes(`${id}-${suffix}`),
      position: i,
    })),
  };
}

function entry(q: EngineQuestion, marks = 1, section = 'Section A'): EnginePaperQuestion {
  return { questionId: q.id, sectionTitle: section, marks, question: q };
}

describe('the seeded generator', () => {
  it('is deterministic for the same seed', () => {
    const a = Array.from({ length: 10 }, seededRandom('sitting-1'));
    const b = Array.from({ length: 10 }, seededRandom('sitting-1'));
    expect(a).toEqual(b);
  });

  it('differs between seeds', () => {
    const a = Array.from({ length: 10 }, seededRandom('sitting-1'));
    const b = Array.from({ length: 10 }, seededRandom('sitting-2'));
    expect(a).not.toEqual(b);
  });

  it('shuffles without losing or duplicating items', () => {
    const items = Array.from({ length: 40 }, (_, i) => i);
    const out = shuffle(items, seededRandom('x'));
    expect(out).toHaveLength(40);
    expect(new Set(out).size).toBe(40);
    expect([...out].sort((p, q) => p - q)).toEqual(items);
  });
});

describe('drawing questions from a bank', () => {
  const pool = Array.from({ length: 20 }, (_, i) => question(`q${i}`, [`q${i}-a`]));

  it('draws the number asked for, without repeats', () => {
    const drawn = drawQuestions(pool, 7, seededRandom('s'));
    expect(drawn).toHaveLength(7);
    expect(new Set(drawn.map((q) => q.id)).size).toBe(7);
  });

  it('returns the whole pool when more are asked for than exist', () => {
    expect(drawQuestions(pool, 50, seededRandom('s'))).toHaveLength(20);
  });

  it('draws the same questions for the same candidate', () => {
    const first = drawQuestions(pool, 5, seededRandom('cand-1')).map((q) => q.id);
    const again = drawQuestions(pool, 5, seededRandom('cand-1')).map((q) => q.id);
    expect(first).toEqual(again);
  });
});

describe('assembling a candidate’s paper', () => {
  const entries = Array.from({ length: 12 }, (_, i) => entry(question(`q${i}`, [`q${i}-b`])));

  it('numbers the questions from one, in order', () => {
    const items = assemblePaper(entries, { seed: 's1', shuffleQuestions: false, shuffleOptions: false });
    expect(items.map((i) => i.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(items[0].questionId).toBe('q0');
  });

  it('keeps every question when the order is shuffled', () => {
    const items = assemblePaper(entries, { seed: 's1', shuffleQuestions: true, shuffleOptions: false });
    expect(new Set(items.map((i) => i.questionId)).size).toBe(12);
  });

  it('gives the same paper when a candidate reloads', () => {
    const a = assemblePaper(entries, { seed: 'sitting-9', shuffleQuestions: true, shuffleOptions: true });
    const b = assemblePaper(entries, { seed: 'sitting-9', shuffleQuestions: true, shuffleOptions: true });
    expect(a).toEqual(b);
  });

  it('gives different candidates different papers', () => {
    const a = assemblePaper(entries, { seed: 'sitting-1', shuffleQuestions: true, shuffleOptions: true });
    const b = assemblePaper(entries, { seed: 'sitting-2', shuffleQuestions: true, shuffleOptions: true });
    expect(a.map((i) => i.questionId)).not.toEqual(b.map((i) => i.questionId));
  });

  it('shuffles the answer options but keeps all of them', () => {
    const items = assemblePaper(entries, { seed: 's', shuffleQuestions: false, shuffleOptions: true });
    for (const item of items) {
      expect(item.optionOrder).toHaveLength(4);
      expect(new Set(item.optionOrder).size).toBe(4);
    }
  });

  it('falls back to the question’s own marks when the section sets none', () => {
    const q = question('qx', ['qx-a']);
    q.marks = 2.5;
    const items = assemblePaper([entry(q, 0)], { seed: 's', shuffleQuestions: false, shuffleOptions: false });
    expect(items[0].marks).toBe(2.5);
  });

  it('refuses to assemble an empty paper', () => {
    expect(() => assemblePaper([], { seed: 's', shuffleQuestions: false, shuffleOptions: false }))
      .toThrow(CbtError);
  });
});

describe('marking a single answer', () => {
  const single = question('q1', ['q1-c']);
  const multi = question('q2', ['q2-a', 'q2-c'], 'MULTI_CHOICE');

  it('awards the marks for the correct option', () => {
    expect(markAnswer(single, ['q1-c'], 2)).toEqual({ correct: true, awarded: 2 });
  });

  it('awards nothing for a wrong option', () => {
    expect(markAnswer(single, ['q1-a'], 2)).toEqual({ correct: false, awarded: 0 });
  });

  it('awards nothing for a blank answer', () => {
    expect(markAnswer(single, [], 2)).toEqual({ correct: false, awarded: 0 });
  });

  it('refuses two answers to a single-answer question', () => {
    expect(markAnswer(single, ['q1-c', 'q1-a'], 2)).toEqual({ correct: false, awarded: 0 });
  });

  it('awards a multiple-answer question only when every correct option is chosen', () => {
    expect(markAnswer(multi, ['q2-a', 'q2-c'], 3)).toEqual({ correct: true, awarded: 3 });
    expect(markAnswer(multi, ['q2-c', 'q2-a'], 3)).toEqual({ correct: true, awarded: 3 });
  });

  it('awards nothing for a partial multiple answer', () => {
    expect(markAnswer(multi, ['q2-a'], 3)).toEqual({ correct: false, awarded: 0 });
  });

  it('awards nothing when a wrong option is added to the correct ones', () => {
    expect(markAnswer(multi, ['q2-a', 'q2-c', 'q2-b'], 3)).toEqual({ correct: false, awarded: 0 });
  });

  it('ignores a duplicated selection', () => {
    expect(markAnswer(single, ['q1-c', 'q1-c'], 1)).toEqual({ correct: true, awarded: 1 });
  });
});

describe('totalling a sitting', () => {
  it('totals marks, answers and the percentage', () => {
    const result = markSitting([
      { marks: 1, awarded: 1, selected: 'a' },
      { marks: 1, awarded: 0, selected: 'b' },
      { marks: 2, awarded: 2, selected: 'c' },
      { marks: 1, awarded: 0, selected: null },
    ]);
    expect(result.totalMarks).toBe(5);
    expect(result.rawScore).toBe(3);
    expect(result.percentage).toBe(60);
    expect(result.answeredCount).toBe(3);
    expect(result.correctCount).toBe(2);
  });

  it('reports nought per cent for an untouched paper', () => {
    const result = markSitting([
      { marks: 1, awarded: 0, selected: null },
      { marks: 1, awarded: 0, selected: '' },
    ]);
    expect(result.rawScore).toBe(0);
    expect(result.percentage).toBe(0);
    expect(result.answeredCount).toBe(0);
  });

  it('does not divide by zero on an empty paper', () => {
    expect(markSitting([]).percentage).toBe(0);
  });

  it('rounds the percentage to one decimal place at most', () => {
    const result = markSitting(Array.from({ length: 3 }, (_, i) => ({ marks: 1, awarded: i === 0 ? 1 : 0, selected: 'x' })));
    expect(result.percentage).toBeCloseTo(33.33, 1);
  });

  it('totals the marks of the assembled items', () => {
    expect(totalMarks([{ marks: 1 }, { marks: 2.5 }, { marks: 0.5 }])).toBe(4);
  });
});

describe('scaling a sitting onto the examination’s total marks', () => {
  it('scales a percentage onto a hundred-mark examination', () => {
    expect(scaleToSchedule(60, 100)).toBe(60);
  });

  it('scales onto an examination marked out of a different total', () => {
    expect(scaleToSchedule(50, 60)).toBe(30);
    expect(scaleToSchedule(80, 25)).toBe(20);
  });

  it('scales a perfect paper to the full marks', () => {
    expect(scaleToSchedule(100, 100)).toBe(100);
  });
});

describe('the sitting clock', () => {
  const now = new Date('2026-03-01T10:00:00Z');

  it('reports the seconds left', () => {
    expect(remainingSeconds(new Date('2026-03-01T10:10:00Z'), now)).toBe(600);
  });

  it('never reports a negative time', () => {
    expect(remainingSeconds(new Date('2026-03-01T09:50:00Z'), now)).toBe(0);
  });

  it('treats a sitting with no expiry as having no time', () => {
    expect(remainingSeconds(null, now)).toBe(0);
  });

  it('recognises an expired sitting', () => {
    expect(isExpired(new Date('2026-03-01T09:59:59Z'), now)).toBe(true);
    expect(isExpired(new Date('2026-03-01T10:00:01Z'), now)).toBe(false);
    expect(isExpired(null, now)).toBe(false);
  });
});

describe('storing a candidate’s selection', () => {
  it('round-trips a single selection', () => {
    expect(parseSelected(serialiseSelected(['a']))).toEqual(['a']);
  });

  it('round-trips several selections', () => {
    expect(parseSelected(serialiseSelected(['a', 'b']))).toEqual(['a', 'b']);
  });

  it('stores nothing for an empty selection', () => {
    expect(serialiseSelected([])).toBeNull();
    expect(parseSelected(null)).toEqual([]);
    expect(parseSelected('')).toEqual([]);
  });

  it('drops duplicates and blanks', () => {
    expect(serialiseSelected(['a', 'a', '', 'b'])).toBe('a,b');
  });
});

describe('importing questions in the Commission’s plain-text format', () => {
  it('reads a block of single-answer questions', () => {
    const { questions, errors } = parseQuestionText(
      `In which Local Government Area is Lokoja situated?\n*Lokoja\nOkene\nIdah\nAnkpa\n\nWhich two rivers meet at Lokoja?\n*The Niger and the Benue\nThe Niger and the Osun\nThe Benue and the Gongola\nThe Niger and the Kaduna`,
    );
    expect(errors).toEqual([]);
    expect(questions).toHaveLength(2);
    expect(questions[0].type).toBe('SINGLE_CHOICE');
    expect(questions[0].options.filter((o) => o.correct)).toHaveLength(1);
    expect(questions[0].options[0].text).toBe('Lokoja');
  });

  it('reads a two-option question as true or false', () => {
    const { questions } = parseQuestionText('Kogi State has 21 Local Government Areas.\n*True\nFalse');
    expect(questions[0].type).toBe('TRUE_FALSE');
  });

  it('reads two asterisks as a multiple-answer question', () => {
    const { questions } = parseQuestionText('Which are rivers?\n*Niger\n*Benue\nLokoja\nOkene');
    expect(questions[0].type).toBe('MULTI_CHOICE');
    expect(questions[0].options.filter((o) => o.correct)).toHaveLength(2);
  });

  it('strips an option letter typed in front of the text', () => {
    const { questions } = parseQuestionText('Capital?\n*A. Lokoja\nB. Okene\nC. Idah');
    expect(questions[0].options[0].text).toBe('Lokoja');
    expect(questions[0].options[1].text).toBe('Okene');
  });

  it('reports a question with no correct option, and imports the rest', () => {
    const { questions, errors } = parseQuestionText(
      'Good question?\n*Yes\nNo\n\nBad question?\nMaybe\nPerhaps',
    );
    expect(questions).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/asterisk/);
  });

  it('reports a question with too few options', () => {
    const { questions, errors } = parseQuestionText('Lonely question?\n*Only option');
    expect(questions).toHaveLength(0);
    expect(errors[0]).toMatch(/at least two/);
  });

  it('reads nothing from empty input', () => {
    expect(parseQuestionText('   ').questions).toHaveLength(0);
  });

  it('copes with Windows line endings', () => {
    const { questions } = parseQuestionText('Capital?\r\n*Lokoja\r\nOkene\r\nIdah');
    expect(questions).toHaveLength(1);
  });
});

describe('setting a question (Module 2.6)', () => {
  const base = {
    type: 'SINGLE_CHOICE',
    stem: 'In which Local Government Area is Lokoja situated?',
    topic: 'Kogi State',
    difficulty: 'EASY',
    marks: '1',
    explanation: '',
    active: 'on',
    options: ['Lokoja', 'Okene', 'Idah', 'Ankpa', '', ''],
  };

  it('accepts a question with one option marked correct', () => {
    expect(questionSchema.safeParse({ ...base, correct: '0' }).success).toBe(true);
  });

  it('refuses a question with no correct option marked', () => {
    const r = questionSchema.safeParse({ ...base, correct: undefined });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).correct).toMatch(/correct answer/i);
  });

  it('refuses two correct options on a single-answer question', () => {
    const r = questionSchema.safeParse({ ...base, correct: ['0', '1'] });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).correct).toMatch(/Only one option/);
  });

  it('accepts two correct options on a multiple-answer question', () => {
    expect(questionSchema.safeParse({ ...base, type: 'MULTI_CHOICE', correct: ['0', '1'] }).success).toBe(true);
  });

  it('refuses fewer than two options', () => {
    const r = questionSchema.safeParse({ ...base, options: ['Only one', '', '', '', '', ''], correct: '0' });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).options).toMatch(/two/);
  });

  it('requires exactly two options for a true-or-false question', () => {
    const r = questionSchema.safeParse({ ...base, type: 'TRUE_FALSE', correct: '0' });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).options).toMatch(/exactly two/);
  });

  it('requires the question text', () => {
    expect(questionSchema.safeParse({ ...base, stem: '', correct: '0' }).success).toBe(false);
  });

  it('refuses marks below a quarter', () => {
    expect(questionSchema.safeParse({ ...base, marks: '0', correct: '0' }).success).toBe(false);
  });
});

describe('question banks and papers (Module 2.6)', () => {
  it('accepts a bank with a valid code', () => {
    const r = questionBankSchema.safeParse({
      title: 'Numerical reasoning', code: 'apt-num', subject: 'NUMERICAL', description: '', active: 'on',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.code).toBe('APT-NUM');
  });

  it('refuses a bank code with spaces or punctuation', () => {
    const r = questionBankSchema.safeParse({
      title: 'Numerical', code: 'APT NUM!', subject: 'NUMERICAL', description: '', active: 'on',
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).code).toMatch(/capital letters/i);
  });

  it('accepts a paper with a sensible duration and pass mark', () => {
    const r = examPaperSchema.safeParse({
      title: '2026 Entry Aptitude Test', code: 'APT-2026', kind: 'APTITUDE_TEST',
      instructions: '', durationMinutes: '45', passMark: '50',
      shuffleQuestions: 'on', shuffleOptions: 'on', showResultToCandidate: '',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.durationMinutes).toBe(45);
      expect(r.data.shuffleQuestions).toBe(true);
      expect(r.data.showResultToCandidate).toBe(false);
    }
  });

  it('refuses a paper shorter than five minutes or longer than eight hours', () => {
    const short = examPaperSchema.safeParse({
      title: 'Too short', code: 'X1', kind: 'APTITUDE_TEST', instructions: '',
      durationMinutes: '2', passMark: '50', shuffleQuestions: '', shuffleOptions: '', showResultToCandidate: '',
    });
    expect(short.success).toBe(false);
    const long = examPaperSchema.safeParse({
      title: 'Too long', code: 'X2', kind: 'APTITUDE_TEST', instructions: '',
      durationMinutes: '600', passMark: '50', shuffleQuestions: '', shuffleOptions: '', showResultToCandidate: '',
    });
    expect(long.success).toBe(false);
  });

  it('accepts a section that draws questions at random', () => {
    const r = paperSectionSchema.safeParse({
      title: 'Section A', description: '', bankId: 'bank-1', drawCount: '8', marksPerQuestion: '1',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.drawCount).toBe(8);
  });

  it('treats a blank draw count as not supplied', () => {
    const r = paperSectionSchema.safeParse({
      title: 'Section A', description: '', bankId: 'bank-1', drawCount: '', marksPerQuestion: '1',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.drawCount).toBeUndefined();
  });
});

describe('the establishment register and the recruitment unit', () => {
  const ministry = {
    name: 'Ministry of Education, Science and Technology',
    shortName: 'Education',
    code: 'moe',
    kind: 'MINISTRY',
    mandate: '', description: '', headName: 'Mrs. Hauwa Audu Ozigi',
    headTitle: 'Permanent Secretary', email: '', phone: '', website: '',
    address: '', lga: 'Lokoja', establishedYear: '', staffStrength: '',
    published: 'on', active: 'on',
  };

  it('accepts an MDA and upper-cases its code', () => {
    const r = ministrySchema.safeParse(ministry);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.code).toBe('MOE');
  });

  it('requires a name and a code', () => {
    expect(ministrySchema.safeParse({ ...ministry, name: '' }).success).toBe(false);
    expect(ministrySchema.safeParse({ ...ministry, code: 'M' }).success).toBe(false);
  });

  it('treats a blank year and staff strength as not supplied', () => {
    const r = ministrySchema.safeParse(ministry);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.establishedYear).toBeUndefined();
      expect(r.data.staffStrength).toBeUndefined();
    }
  });

  it('refuses an unknown classification', () => {
    expect(ministrySchema.safeParse({ ...ministry, kind: 'DEPARTMENTAL' }).success).toBe(false);
  });

  it('accepts a recruitment unit', () => {
    const r = recruitmentUnitSchema.safeParse({
      name: 'Recruitment and Appointments Unit', code: 'rau', mandate: 'Manages recruitment.',
      description: '', email: '', phone: '', office: 'Room 204', active: 'on',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.code).toBe('RAU');
  });

  it('requires an officer and defaults the unit role to member', () => {
    expect(unitMemberSchema.safeParse({ userId: '', unitRole: 'MEMBER', notes: '' }).success).toBe(false);
    const r = unitMemberSchema.safeParse({ userId: 'user-1', notes: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.unitRole).toBe('MEMBER');
  });

  it('refuses an unknown role on the unit', () => {
    expect(unitMemberSchema.safeParse({ userId: 'user-1', unitRole: 'CHAIRMAN', notes: '' }).success).toBe(false);
  });
});
