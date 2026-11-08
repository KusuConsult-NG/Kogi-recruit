import { describe, expect, it } from 'vitest';
import {
  highestQualification, parseMinimumExperience, qualificationRank,
  requiredQualifications, runAutoChecks, yearsOfExperience,
} from '@/lib/screening';

describe('qualification ranking (Module 2.5)', () => {
  it('ranks qualifications in ascending order of level', () => {
    expect(qualificationRank('SSCE/WASSCE/NECO')).toBeLessThan(qualificationRank('OND'));
    expect(qualificationRank('OND')).toBeLessThan(qualificationRank('HND'));
    expect(qualificationRank('HND')).toBeLessThan(qualificationRank('M.Sc / M.A / MBA'));
    expect(qualificationRank('M.Sc / M.A / MBA')).toBeLessThan(qualificationRank('Ph.D'));
  });

  it('treats an HND and a first degree as equivalent', () => {
    expect(qualificationRank('HND')).toBe(qualificationRank('B.Sc / B.A / B.Eng'));
  });

  it('returns zero for an unknown qualification', () => {
    expect(qualificationRank('Certificate of Attendance')).toBe(0);
  });

  it('picks the highest qualification held', () => {
    expect(highestQualification(['SSCE/WASSCE/NECO', 'OND', 'HND'])).toBe('HND');
    expect(highestQualification(['B.Sc / B.A / B.Eng', 'Ph.D'])).toBe('Ph.D');
    expect(highestQualification([])).toBeNull();
  });

  it('extracts the qualifications named in a free-text requirement', () => {
    const found = requiredQualifications('A degree (B.Sc) in Accounting, plus NYSC discharge certificate');
    expect(found).toContain('B.Sc / B.A / B.Eng');
  });
});

describe('experience calculation', () => {
  it('totals years across employment records', () => {
    const years = yearsOfExperience(
      [
        { startDate: '2018-01-01', endDate: '2020-01-01' },
        { startDate: '2021-01-01', endDate: '2024-01-01' },
      ],
      new Date('2026-01-01'),
    );
    expect(years).toBeCloseTo(5, 1);
  });

  it('counts a current post up to today', () => {
    const years = yearsOfExperience(
      [{ startDate: '2022-01-01', current: true }],
      new Date('2026-01-01'),
    );
    expect(years).toBeCloseTo(4, 1);
  });

  it('ignores records with no start date or an invalid range', () => {
    expect(yearsOfExperience([{ endDate: '2024-01-01' }])).toBe(0);
    expect(yearsOfExperience([{ startDate: '2024-01-01', endDate: '2020-01-01' }])).toBe(0);
  });

  it('returns zero for no employment history', () => {
    expect(yearsOfExperience([])).toBe(0);
  });

  it('reads a minimum from a free-text experience requirement', () => {
    expect(parseMinimumExperience('Minimum of 3 years post-qualification experience')).toBe(3);
    expect(parseMinimumExperience('At least 5 yrs relevant experience')).toBe(5);
    expect(parseMinimumExperience('No previous experience required.')).toBeNull();
    expect(parseMinimumExperience(null)).toBeNull();
  });
});

describe('preliminary screening checks (Module 2.5)', () => {
  const vacancy = {
    qualifications: 'A degree (B.Sc) in any discipline plus NYSC discharge certificate',
    minAge: 18,
    maxAge: 35,
    experience: 'Minimum of 2 years relevant experience',
    positions: 10,
  };
  const good = {
    completenessPercent: 100,
    applicantAge: 27,
    vacancy,
    qualifications: ['B.Sc / B.A / B.Eng'],
    experienceYears: 3,
    requiredDocsTotal: 5,
    requiredDocsVerifiedOrPending: 5,
    rejectedDocs: 0,
  };

  it('suggests passing a fully compliant application', () => {
    const r = runAutoChecks(good);
    expect(r.suggestedOutcome).toBe('PASSED');
    expect(r.suggestedClassification).toBe('QUALIFIED');
    expect(r.failCount).toBe(0);
    expect(r.checks).toHaveLength(5);
  });

  it('suggests a correction when a document was rejected', () => {
    const r = runAutoChecks({ ...good, rejectedDocs: 1 });
    expect(r.suggestedOutcome).toBe('RESUBMISSION_REQUIRED');
    expect(r.suggestedClassification).toBe('INCOMPLETE');
    expect(r.checks.find((c) => c.key === 'documents')?.pass).toBe(false);
  });

  it('suggests a correction when the application is incomplete', () => {
    const r = runAutoChecks({ ...good, completenessPercent: 70 });
    expect(r.suggestedOutcome).toBe('RESUBMISSION_REQUIRED');
    expect(r.checks.find((c) => c.key === 'completeness')?.pass).toBe(false);
  });

  it('suggests failing an under-qualified applicant', () => {
    const r = runAutoChecks({ ...good, qualifications: ['SSCE/WASSCE/NECO'] });
    expect(r.suggestedOutcome).toBe('FAILED');
    expect(r.suggestedClassification).toBe('UNDER_QUALIFIED');
  });

  it('suggests failing an applicant short of the required experience', () => {
    const r = runAutoChecks({ ...good, experienceYears: 1 });
    expect(r.suggestedOutcome).toBe('FAILED');
    expect(r.suggestedClassification).toBe('UNDER_QUALIFIED');
    expect(r.checks.find((c) => c.key === 'experience')?.pass).toBe(false);
  });

  it('suggests disqualifying an applicant outside the age range', () => {
    const over = runAutoChecks({ ...good, applicantAge: 44 });
    expect(over.suggestedOutcome).toBe('FAILED');
    expect(over.suggestedClassification).toBe('DISQUALIFIED');

    const under = runAutoChecks({ ...good, applicantAge: 16 });
    expect(under.checks.find((c) => c.key === 'age')?.pass).toBe(false);
  });

  it('fails the age check when no date of birth was supplied', () => {
    const r = runAutoChecks({ ...good, applicantAge: null });
    const check = r.checks.find((c) => c.key === 'age');
    expect(check?.pass).toBe(false);
    expect(check?.detail).toMatch(/Date of birth not supplied/);
  });

  it('marks checks advisory where the vacancy sets no limit', () => {
    const r = runAutoChecks({
      ...good,
      vacancy: { ...vacancy, minAge: null, maxAge: null, experience: null },
    });
    expect(r.checks.find((c) => c.key === 'age')?.advisory).toBe(true);
    expect(r.checks.find((c) => c.key === 'experience')?.advisory).toBe(true);
    expect(r.suggestedOutcome).toBe('PASSED');
  });

  it('asks an officer to review a free-text qualification requirement it cannot parse', () => {
    const r = runAutoChecks({
      ...good,
      vacancy: { ...vacancy, qualifications: 'Such qualifications as the Commission may approve' },
    });
    const check = r.checks.find((c) => c.key === 'qualification');
    expect(check?.advisory).toBe(true);
    expect(check?.detail).toMatch(/needs officer review/);
  });

  it('records a reason against every check', () => {
    for (const check of runAutoChecks(good).checks) {
      expect(check.detail.length).toBeGreaterThan(0);
      expect(check.label.length).toBeGreaterThan(0);
    }
  });
});
