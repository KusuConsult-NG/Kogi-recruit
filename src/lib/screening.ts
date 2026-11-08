/**
 * Module 2.5 - configurable preliminary screening rules.
 * These checks ASSIST officers; the final decision is always recorded
 * by an authorised Commission officer.
 */
import { QUALIFICATIONS } from './constants';

/** Qualification ranking used for "meets or exceeds" comparisons. */
const QUALIFICATION_RANK: Record<string, number> = {
  FSLC: 1,
  'SSCE/WASSCE/NECO': 2,
  'Trade Test': 2,
  OND: 3,
  NCE: 3,
  HND: 4,
  'B.Sc / B.A / B.Eng': 4,
  PGD: 5,
  'M.Sc / M.A / MBA': 6,
  'Ph.D': 7,
  'Professional Certification': 4,
};

export function qualificationRank(q: string): number {
  return QUALIFICATION_RANK[q] ?? 0;
}

export function highestQualification(quals: string[]): string | null {
  if (quals.length === 0) return null;
  return quals.reduce((best, q) => (qualificationRank(q) > qualificationRank(best) ? q : best));
}

/** Years of experience derived from employment history, ignoring overlaps crudely. */
export function yearsOfExperience(
  employment: Array<{ startDate?: Date | string | null; endDate?: Date | string | null; current?: boolean }>,
  at = new Date(),
): number {
  let months = 0;
  for (const job of employment) {
    if (!job.startDate) continue;
    const start = new Date(job.startDate);
    if (Number.isNaN(start.getTime())) continue;
    const end = job.current || !job.endDate ? at : new Date(job.endDate);
    if (Number.isNaN(end.getTime()) || end < start) continue;
    months += (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  }
  return Math.max(0, Math.round((months / 12) * 10) / 10);
}

export interface AutoCheckInput {
  completenessPercent: number;
  applicantAge: number | null;
  vacancy: {
    qualifications: string;
    minAge?: number | null;
    maxAge?: number | null;
    experience?: string | null;
    positions: number;
  } | null;
  qualifications: string[];
  experienceYears: number;
  requiredDocsTotal: number;
  requiredDocsVerifiedOrPending: number;
  rejectedDocs: number;
}

export interface AutoCheck {
  key: string;
  label: string;
  pass: boolean;
  detail: string;
  advisory?: boolean;
}

export interface AutoCheckResult {
  checks: AutoCheck[];
  suggestedOutcome: 'PASSED' | 'FAILED' | 'RESUBMISSION_REQUIRED';
  suggestedClassification: 'QUALIFIED' | 'UNDER_QUALIFIED' | 'INCOMPLETE' | 'DISQUALIFIED';
  passCount: number;
  failCount: number;
}

/** Extract the minimum years of experience mentioned in a free-text requirement. */
export function parseMinimumExperience(text?: string | null): number | null {
  if (!text) return null;
  const match = text.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:year|yr)/i);
  return match ? Number(match[1]) : null;
}

/** Match a vacancy's free-text qualification requirement against named qualifications. */
export function requiredQualifications(text: string): string[] {
  const found = QUALIFICATIONS.filter((q) =>
    text.toLowerCase().includes(q.toLowerCase().split(' /')[0].toLowerCase()),
  );
  return found as unknown as string[];
}

export function runAutoChecks(input: AutoCheckInput): AutoCheckResult {
  const checks: AutoCheck[] = [];

  checks.push({
    key: 'completeness',
    label: 'Application completeness',
    pass: input.completenessPercent >= 100,
    detail: `${input.completenessPercent}% of mandatory sections completed.`,
  });

  const docsOk =
    input.requiredDocsTotal === 0 ||
    input.requiredDocsVerifiedOrPending >= input.requiredDocsTotal;
  checks.push({
    key: 'documents',
    label: 'Required documents attached',
    pass: docsOk && input.rejectedDocs === 0,
    detail:
      input.rejectedDocs > 0
        ? `${input.rejectedDocs} document(s) were rejected and require resubmission.`
        : `${input.requiredDocsVerifiedOrPending} of ${input.requiredDocsTotal} required documents attached.`,
  });

  const required = input.vacancy ? requiredQualifications(input.vacancy.qualifications) : [];
  const highestHeld = highestQualification(input.qualifications);
  const minRequiredRank = required.length
    ? Math.min(...required.map(qualificationRank))
    : 0;
  const qualificationPass = highestHeld
    ? qualificationRank(highestHeld) >= minRequiredRank
    : false;
  checks.push({
    key: 'qualification',
    label: 'Minimum qualification',
    pass: qualificationPass,
    detail: highestHeld
      ? required.length
        ? `Holds ${highestHeld}; requirement references ${required.join(', ')}.`
        : `Holds ${highestHeld}; vacancy requirement is free-text and needs officer review.`
      : 'No educational qualification recorded.',
    advisory: required.length === 0,
  });

  const minExp = parseMinimumExperience(input.vacancy?.experience);
  checks.push({
    key: 'experience',
    label: 'Minimum experience',
    pass: minExp === null ? true : input.experienceYears >= minExp,
    detail:
      minExp === null
        ? `No explicit minimum stated; applicant has ${input.experienceYears} year(s).`
        : `Requires ${minExp} year(s); applicant has ${input.experienceYears} year(s).`,
    advisory: minExp === null,
  });

  const minAge = input.vacancy?.minAge ?? null;
  const maxAge = input.vacancy?.maxAge ?? null;
  let agePass = true;
  let ageDetail = 'No age limits configured for this vacancy.';
  if (minAge !== null || maxAge !== null) {
    if (input.applicantAge === null) {
      agePass = false;
      ageDetail = 'Date of birth not supplied.';
    } else {
      agePass =
        (minAge === null || input.applicantAge >= minAge) &&
        (maxAge === null || input.applicantAge <= maxAge);
      ageDetail = `Applicant is ${input.applicantAge}; permitted range ${minAge ?? 'any'}–${maxAge ?? 'any'}.`;
    }
  }
  checks.push({
    key: 'age',
    label: 'Age eligibility',
    pass: agePass,
    detail: ageDetail,
    advisory: minAge === null && maxAge === null,
  });

  const blocking = checks.filter((c) => !c.advisory);
  const failed = blocking.filter((c) => !c.pass);
  const passCount = checks.filter((c) => c.pass).length;

  let suggestedOutcome: AutoCheckResult['suggestedOutcome'] = 'PASSED';
  let suggestedClassification: AutoCheckResult['suggestedClassification'] = 'QUALIFIED';

  if (input.rejectedDocs > 0 || !docsOk || input.completenessPercent < 100) {
    suggestedOutcome = 'RESUBMISSION_REQUIRED';
    suggestedClassification = 'INCOMPLETE';
  } else if (failed.some((c) => c.key === 'qualification' || c.key === 'experience')) {
    suggestedOutcome = 'FAILED';
    suggestedClassification = 'UNDER_QUALIFIED';
  } else if (failed.some((c) => c.key === 'age')) {
    suggestedOutcome = 'FAILED';
    suggestedClassification = 'DISQUALIFIED';
  } else if (failed.length > 0) {
    suggestedOutcome = 'FAILED';
    suggestedClassification = 'DISQUALIFIED';
  }

  return {
    checks,
    suggestedOutcome,
    suggestedClassification,
    passCount,
    failCount: checks.length - passCount,
  };
}
