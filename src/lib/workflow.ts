/**
 * Recruitment workflow rules (proposal §6) - permitted state transitions,
 * application completeness and stage derivation.
 * Configurable rules assist officers; final decisions remain with
 * authorised Commission officers.
 */
import { APPLICATION_STATUS, EXERCISE_STATUS, STAGES } from './constants';

const A = APPLICATION_STATUS;
const E = EXERCISE_STATUS;

/** Permitted recruitment exercise lifecycle transitions. */
export const EXERCISE_TRANSITIONS: Record<string, string[]> = {
  [E.DRAFT]: [E.PENDING_APPROVAL, E.ARCHIVED],
  [E.PENDING_APPROVAL]: [E.APPROVED, E.DRAFT],
  [E.APPROVED]: [E.PUBLISHED, E.DRAFT, E.ARCHIVED],
  [E.PUBLISHED]: [E.SUSPENDED, E.CLOSED],
  [E.SUSPENDED]: [E.PUBLISHED, E.CLOSED],
  [E.CLOSED]: [E.ARCHIVED, E.PUBLISHED],
  [E.ARCHIVED]: [],
};

export function canTransitionExercise(from: string, to: string): boolean {
  return (EXERCISE_TRANSITIONS[from] ?? []).includes(to);
}

/** Permitted application lifecycle transitions. */
export const APPLICATION_TRANSITIONS: Record<string, string[]> = {
  [A.DRAFT]: [A.SUBMITTED, A.WITHDRAWN],
  [A.SUBMITTED]: [A.UNDER_SCREENING, A.WITHDRAWN],
  [A.UNDER_SCREENING]: [
    A.QUALIFIED, A.DISQUALIFIED, A.INCOMPLETE, A.RESUBMISSION_REQUIRED, A.WITHDRAWN,
  ],
  [A.INCOMPLETE]: [A.RESUBMISSION_REQUIRED, A.DISQUALIFIED, A.UNDER_SCREENING],
  [A.RESUBMISSION_REQUIRED]: [A.UNDER_SCREENING, A.DISQUALIFIED, A.WITHDRAWN],
  [A.QUALIFIED]: [A.SHORTLISTED, A.NOT_SELECTED, A.UNDER_SCREENING],
  [A.DISQUALIFIED]: [A.UNDER_SCREENING],
  [A.SHORTLISTED]: [A.EXAM_SCHEDULED, A.INTERVIEW_SCHEDULED, A.NOT_SELECTED],
  [A.EXAM_SCHEDULED]: [A.EXAM_COMPLETED, A.NOT_SELECTED],
  [A.EXAM_COMPLETED]: [A.INTERVIEW_SCHEDULED, A.SELECTED, A.NOT_SELECTED],
  [A.INTERVIEW_SCHEDULED]: [A.INTERVIEW_COMPLETED, A.NOT_SELECTED],
  [A.INTERVIEW_COMPLETED]: [A.SELECTED, A.NOT_SELECTED],
  [A.SELECTED]: [],
  [A.NOT_SELECTED]: [],
  [A.WITHDRAWN]: [],
};

export function canTransitionApplication(from: string, to: string): boolean {
  if (from === to) return true;
  return (APPLICATION_TRANSITIONS[from] ?? []).includes(to);
}

export class WorkflowError extends Error {}

export function assertApplicationTransition(from: string, to: string): void {
  if (!canTransitionApplication(from, to)) {
    throw new WorkflowError(`An application cannot move from "${from}" to "${to}".`);
  }
}

export function assertExerciseTransition(from: string, to: string): void {
  if (!canTransitionExercise(from, to)) {
    throw new WorkflowError(`A recruitment exercise cannot move from "${from}" to "${to}".`);
  }
}

/** Recruitment stage implied by an application status. */
export function stageForStatus(status: string): string {
  switch (status) {
    case A.DRAFT:
    case A.SUBMITTED:
      return STAGES.APPLICATION;
    case A.UNDER_SCREENING:
    case A.INCOMPLETE:
    case A.RESUBMISSION_REQUIRED:
    case A.DISQUALIFIED:
      return STAGES.SCREENING;
    case A.QUALIFIED:
    case A.SHORTLISTED:
      return STAGES.SHORTLIST;
    case A.EXAM_SCHEDULED:
    case A.EXAM_COMPLETED:
      return STAGES.EXAMINATION;
    case A.INTERVIEW_SCHEDULED:
    case A.INTERVIEW_COMPLETED:
      return STAGES.INTERVIEW;
    case A.SELECTED:
    case A.NOT_SELECTED:
      return STAGES.SELECTION;
    case A.WITHDRAWN:
      return STAGES.CLOSED;
    default:
      return STAGES.APPLICATION;
  }
}

export interface CompletenessInput {
  hasProfile: boolean;
  vacancySelected: boolean;
  educationCount: number;
  employmentCount: number;
  refereeCount: number;
  hasNextOfKin: boolean;
  requiredDocsTotal: number;
  requiredDocsUploaded: number;
  declaration: boolean;
  consent: boolean;
}

export interface CompletenessResult {
  /** Weighted completeness of the whole application, 0–100. */
  percent: number;
  /** Everything still outstanding, mandatory or not, for display. */
  missing: string[];
  /**
   * Whether every mandatory section other than the declaration is in place.
   * The declaration and consent are given on the submission form itself and
   * are validated there, so they are not a precondition for submitting.
   */
  canSubmit: boolean;
}

/**
 * Weighted application completeness used by the applicant dashboard
 * and by preliminary screening completeness checks.
 *
 * `declaration` counts towards the percentage but not towards `canSubmit`:
 * the applicant gives it on the submission form, so requiring it beforehand
 * would leave the submit control permanently disabled.
 */
export function computeCompleteness(input: CompletenessInput): CompletenessResult {
  const checks: Array<{
    label: string;
    ok: boolean;
    weight: number;
    required: boolean;
    givenOnSubmission?: boolean;
  }> = [
    { label: 'Personal and contact details', ok: input.hasProfile, weight: 20, required: true },
    { label: 'Position applied for', ok: input.vacancySelected, weight: 10, required: true },
    { label: 'Educational qualification', ok: input.educationCount > 0, weight: 20, required: true },
    { label: 'Employment history', ok: input.employmentCount > 0, weight: 8, required: false },
    { label: 'Referee details', ok: input.refereeCount > 0, weight: 7, required: false },
    { label: 'Next of kin details', ok: input.hasNextOfKin, weight: 5, required: false },
    {
      label:
        input.requiredDocsTotal > 0
          ? `Required documents (${input.requiredDocsUploaded}/${input.requiredDocsTotal})`
          : 'Required documents',
      ok: input.requiredDocsTotal === 0 || input.requiredDocsUploaded >= input.requiredDocsTotal,
      weight: 25,
      required: true,
    },
    { label: 'Declaration and consent', ok: input.declaration && input.consent, weight: 5, required: false, givenOnSubmission: true },
  ];

  const total = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.reduce((s, c) => s + (c.ok ? c.weight : 0), 0);
  const missing = checks.filter((c) => !c.ok).map((c) => c.label);
  const canSubmit = checks.filter((c) => c.required).every((c) => c.ok);

  return { percent: Math.round((earned / total) * 100), missing, canSubmit };
}
