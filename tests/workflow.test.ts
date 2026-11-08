import { describe, expect, it } from 'vitest';
import {
  APPLICATION_TRANSITIONS, EXERCISE_TRANSITIONS, WorkflowError,
  assertApplicationTransition, assertExerciseTransition,
  canTransitionApplication, canTransitionExercise,
  computeCompleteness, stageForStatus,
} from '@/lib/workflow';
import { APPLICATION_STATUS, EXERCISE_STATUS, STAGES, WORKFLOW_STAGES } from '@/lib/constants';

const A = APPLICATION_STATUS;
const E = EXERCISE_STATUS;

describe('recruitment exercise lifecycle (Module 2.1)', () => {
  it('follows draft → approval → publication', () => {
    expect(canTransitionExercise(E.DRAFT, E.PENDING_APPROVAL)).toBe(true);
    expect(canTransitionExercise(E.PENDING_APPROVAL, E.APPROVED)).toBe(true);
    expect(canTransitionExercise(E.APPROVED, E.PUBLISHED)).toBe(true);
  });

  it('cannot publish straight from draft without approval', () => {
    expect(canTransitionExercise(E.DRAFT, E.PUBLISHED)).toBe(false);
    expect(() => assertExerciseTransition(E.DRAFT, E.PUBLISHED)).toThrow(WorkflowError);
  });

  it('allows suspension and resumption of a published exercise', () => {
    expect(canTransitionExercise(E.PUBLISHED, E.SUSPENDED)).toBe(true);
    expect(canTransitionExercise(E.SUSPENDED, E.PUBLISHED)).toBe(true);
  });

  it('allows closure then archiving, and nothing after archiving', () => {
    expect(canTransitionExercise(E.PUBLISHED, E.CLOSED)).toBe(true);
    expect(canTransitionExercise(E.CLOSED, E.ARCHIVED)).toBe(true);
    expect(EXERCISE_TRANSITIONS[E.ARCHIVED]).toEqual([]);
  });

  it('returns a rejected exercise to draft', () => {
    expect(canTransitionExercise(E.PENDING_APPROVAL, E.DRAFT)).toBe(true);
  });
});

describe('application lifecycle (Modules 2.3 – 2.8)', () => {
  it('walks the full ten-stage happy path', () => {
    const path = [
      A.DRAFT, A.SUBMITTED, A.UNDER_SCREENING, A.QUALIFIED, A.SHORTLISTED,
      A.EXAM_SCHEDULED, A.EXAM_COMPLETED, A.INTERVIEW_SCHEDULED,
      A.INTERVIEW_COMPLETED, A.SELECTED,
    ];
    for (let i = 0; i < path.length - 1; i += 1) {
      expect(
        canTransitionApplication(path[i], path[i + 1]),
        `${path[i]} → ${path[i + 1]}`,
      ).toBe(true);
    }
  });

  it('refuses to skip screening', () => {
    expect(canTransitionApplication(A.SUBMITTED, A.SHORTLISTED)).toBe(false);
    expect(canTransitionApplication(A.SUBMITTED, A.SELECTED)).toBe(false);
  });

  it('refuses to select a candidate who has not been assessed', () => {
    expect(canTransitionApplication(A.QUALIFIED, A.SELECTED)).toBe(false);
    expect(canTransitionApplication(A.SHORTLISTED, A.SELECTED)).toBe(false);
  });

  it('allows a correction request and the return to screening', () => {
    expect(canTransitionApplication(A.UNDER_SCREENING, A.RESUBMISSION_REQUIRED)).toBe(true);
    expect(canTransitionApplication(A.RESUBMISSION_REQUIRED, A.UNDER_SCREENING)).toBe(true);
  });

  it('treats a concluded outcome as terminal', () => {
    expect(APPLICATION_TRANSITIONS[A.SELECTED]).toEqual([]);
    expect(APPLICATION_TRANSITIONS[A.NOT_SELECTED]).toEqual([]);
    expect(APPLICATION_TRANSITIONS[A.WITHDRAWN]).toEqual([]);
  });

  it('permits withdrawal before assessment but not after selection', () => {
    expect(canTransitionApplication(A.DRAFT, A.WITHDRAWN)).toBe(true);
    expect(canTransitionApplication(A.SUBMITTED, A.WITHDRAWN)).toBe(true);
    expect(canTransitionApplication(A.SELECTED, A.WITHDRAWN)).toBe(false);
  });

  it('treats a same-status change as a permitted no-op', () => {
    expect(canTransitionApplication(A.QUALIFIED, A.QUALIFIED)).toBe(true);
  });

  it('names the transition in the error it raises', () => {
    expect(() => assertApplicationTransition(A.DRAFT, A.SELECTED)).toThrow(/DRAFT.*SELECTED/);
  });
});

describe('stage derivation', () => {
  it('maps every application status to a stage', () => {
    for (const status of Object.values(A)) {
      expect(Object.values(STAGES)).toContain(stageForStatus(status));
    }
  });

  it('places each status in the expected stage', () => {
    expect(stageForStatus(A.DRAFT)).toBe(STAGES.APPLICATION);
    expect(stageForStatus(A.UNDER_SCREENING)).toBe(STAGES.SCREENING);
    expect(stageForStatus(A.SHORTLISTED)).toBe(STAGES.SHORTLIST);
    expect(stageForStatus(A.EXAM_SCHEDULED)).toBe(STAGES.EXAMINATION);
    expect(stageForStatus(A.INTERVIEW_COMPLETED)).toBe(STAGES.INTERVIEW);
    expect(stageForStatus(A.SELECTED)).toBe(STAGES.SELECTION);
    expect(stageForStatus(A.WITHDRAWN)).toBe(STAGES.CLOSED);
  });

  it('documents all ten workflow stages from the proposal', () => {
    expect(WORKFLOW_STAGES).toHaveLength(10);
    expect(WORKFLOW_STAGES.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(WORKFLOW_STAGES[0].name).toBe('Recruitment Planning');
    expect(WORKFLOW_STAGES[9].name).toBe('Closure and Archiving');
  });
});

describe('application completeness (Module 2.3)', () => {
  const complete = {
    hasProfile: true,
    vacancySelected: true,
    educationCount: 1,
    employmentCount: 1,
    refereeCount: 1,
    hasNextOfKin: true,
    requiredDocsTotal: 5,
    requiredDocsUploaded: 5,
    declaration: true,
    consent: true,
  };

  it('reports 100% and permits submission when everything is supplied', () => {
    const r = computeCompleteness(complete);
    expect(r.percent).toBe(100);
    expect(r.canSubmit).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it('blocks submission when a mandatory document is missing', () => {
    const r = computeCompleteness({ ...complete, requiredDocsUploaded: 4 });
    expect(r.canSubmit).toBe(false);
    expect(r.percent).toBeLessThan(100);
    expect(r.missing.join(' ')).toMatch(/Required documents \(4\/5\)/);
  });

  it('lists the declaration as outstanding but does not block submission', () => {
    // The declaration and consent are given on the submission form, which
    // validates them; see the regression suite at the end of this file.
    const r = computeCompleteness({ ...complete, declaration: false, consent: false });
    expect(r.missing).toContain('Declaration and consent');
    expect(r.canSubmit).toBe(true);
    expect(r.percent).toBeLessThan(100);
  });

  it('blocks submission with no qualification recorded', () => {
    const r = computeCompleteness({ ...complete, educationCount: 0 });
    expect(r.canSubmit).toBe(false);
    expect(r.missing).toContain('Educational qualification');
  });

  it('blocks submission when no position is selected', () => {
    expect(computeCompleteness({ ...complete, vacancySelected: false }).canSubmit).toBe(false);
  });

  it('still permits submission without optional sections, below 100%', () => {
    const r = computeCompleteness({
      ...complete, employmentCount: 0, refereeCount: 0, hasNextOfKin: false,
    });
    expect(r.canSubmit).toBe(true);
    expect(r.percent).toBe(80);
    expect(r.missing).toEqual([
      'Employment history', 'Referee details', 'Next of kin details',
    ]);
  });

  it('treats an exercise with no document requirements as satisfied', () => {
    const r = computeCompleteness({ ...complete, requiredDocsTotal: 0, requiredDocsUploaded: 0 });
    expect(r.canSubmit).toBe(true);
    expect(r.percent).toBe(100);
  });

  it('never reports a percentage outside 0–100', () => {
    const empty = computeCompleteness({
      hasProfile: false, vacancySelected: false, educationCount: 0, employmentCount: 0,
      refereeCount: 0, hasNextOfKin: false, requiredDocsTotal: 3, requiredDocsUploaded: 0,
      declaration: false, consent: false,
    });
    expect(empty.percent).toBe(0);
    expect(empty.canSubmit).toBe(false);
  });
});

describe('the declaration does not block submission (regression)', () => {
  const ready = {
    hasProfile: true,
    vacancySelected: true,
    educationCount: 1,
    employmentCount: 0,
    refereeCount: 0,
    hasNextOfKin: false,
    requiredDocsTotal: 5,
    requiredDocsUploaded: 5,
    declaration: false,
    consent: false,
  };

  it('permits submission before the declaration is given', () => {
    // The declaration and consent are given on the submission form itself, so
    // requiring them beforehand would leave the submit control permanently
    // disabled and the applicant unable to submit at all.
    const r = computeCompleteness(ready);
    expect(r.canSubmit).toBe(true);
    expect(r.missing).toContain('Declaration and consent');
    expect(r.percent).toBeLessThan(100);
  });

  it('counts the declaration towards full completeness once given', () => {
    const before = computeCompleteness(ready).percent;
    const after = computeCompleteness({ ...ready, declaration: true, consent: true }).percent;
    expect(after).toBeGreaterThan(before);
  });

  it('reaches 100% only when every section is complete', () => {
    const r = computeCompleteness({
      ...ready, employmentCount: 1, refereeCount: 1, hasNextOfKin: true,
      declaration: true, consent: true,
    });
    expect(r.percent).toBe(100);
    expect(r.missing).toEqual([]);
  });

  it('still blocks submission when a mandatory section is missing', () => {
    expect(computeCompleteness({ ...ready, educationCount: 0 }).canSubmit).toBe(false);
    expect(computeCompleteness({ ...ready, requiredDocsUploaded: 3 }).canSubmit).toBe(false);
    expect(computeCompleteness({ ...ready, vacancySelected: false }).canSubmit).toBe(false);
    expect(computeCompleteness({ ...ready, hasProfile: false }).canSubmit).toBe(false);
  });
});
