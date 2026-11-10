/** Shared domain constants for the Kogi State Civil Service Commission Portal. */

export const COMMISSION = {
  name: 'Kogi State Civil Service Commission',
  shortName: 'Kogi CSC',
  state: 'Kogi State',
  motto: 'Confluence of Merit, Service and Integrity',
  address: 'Civil Service Commission Secretariat, Lokoja, Kogi State, Nigeria',
  email: 'info@kogicsc.kg.gov.ng',
  phone: '+234 800 000 0000',
  vendor: 'Edumanager Information System Ltd.',
  vendorEmail: 'edumanagerinfosys@gmail.com',
  vendorSite: 'www.edumanagerinfo.com',
} as const;

// --- Roles (Module 5) ----------------------------------------------------
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  COMMISSION_ADMIN: 'COMMISSION_ADMIN',
  RECRUITMENT_DIRECTOR: 'RECRUITMENT_DIRECTOR',
  RECRUITMENT_OFFICER: 'RECRUITMENT_OFFICER',
  SCREENING_OFFICER: 'SCREENING_OFFICER',
  DOCUMENT_OFFICER: 'DOCUMENT_OFFICER',
  EXAMINATION_OFFICER: 'EXAMINATION_OFFICER',
  INTERVIEW_PANEL: 'INTERVIEW_PANEL',
  CONTENT_OFFICER: 'CONTENT_OFFICER',
  REPORTING_OFFICER: 'REPORTING_OFFICER',
  APPLICANT: 'APPLICANT',
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Administrator',
  COMMISSION_ADMIN: 'Commission Administrator',
  RECRUITMENT_DIRECTOR: 'Recruitment Director / Coordinator',
  RECRUITMENT_OFFICER: 'Recruitment Officer',
  SCREENING_OFFICER: 'Screening Officer',
  DOCUMENT_OFFICER: 'Document Verification Officer',
  EXAMINATION_OFFICER: 'Examination Officer',
  INTERVIEW_PANEL: 'Interview Panel Member',
  CONTENT_OFFICER: 'Public Relations / Portal Content Officer',
  REPORTING_OFFICER: 'Management and Reporting Officer',
  APPLICANT: 'Applicant',
};

export const STAFF_ROLES: Role[] = (Object.keys(ROLE_LABELS) as Role[]).filter(
  (r) => r !== ROLES.APPLICANT,
);

// --- Exercise status (Module 2.1) ----------------------------------------
export const EXERCISE_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  PUBLISHED: 'PUBLISHED',
  SUSPENDED: 'SUSPENDED',
  CLOSED: 'CLOSED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type ExerciseStatus = (typeof EXERCISE_STATUS)[keyof typeof EXERCISE_STATUS];

export const EXERCISE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Awaiting Approval',
  APPROVED: 'Approved (not yet published)',
  PUBLISHED: 'Published / Open',
  SUSPENDED: 'Suspended',
  CLOSED: 'Closed',
  ARCHIVED: 'Archived',
};

// --- Application status (Module 2.3 / 2.5 / 6) ---------------------------
export const APPLICATION_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_SCREENING: 'UNDER_SCREENING',
  INCOMPLETE: 'INCOMPLETE',
  RESUBMISSION_REQUIRED: 'RESUBMISSION_REQUIRED',
  QUALIFIED: 'QUALIFIED',
  DISQUALIFIED: 'DISQUALIFIED',
  SHORTLISTED: 'SHORTLISTED',
  EXAM_SCHEDULED: 'EXAM_SCHEDULED',
  EXAM_COMPLETED: 'EXAM_COMPLETED',
  INTERVIEW_SCHEDULED: 'INTERVIEW_SCHEDULED',
  INTERVIEW_COMPLETED: 'INTERVIEW_COMPLETED',
  SELECTED: 'SELECTED',
  NOT_SELECTED: 'NOT_SELECTED',
  WITHDRAWN: 'WITHDRAWN',
} as const;
export type ApplicationStatus =
  (typeof APPLICATION_STATUS)[keyof typeof APPLICATION_STATUS];

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft (not submitted)',
  SUBMITTED: 'Submitted',
  UNDER_SCREENING: 'Under Screening',
  INCOMPLETE: 'Incomplete',
  RESUBMISSION_REQUIRED: 'Correction Requested',
  QUALIFIED: 'Qualified',
  DISQUALIFIED: 'Disqualified',
  SHORTLISTED: 'Shortlisted',
  EXAM_SCHEDULED: 'Examination Scheduled',
  EXAM_COMPLETED: 'Examination Completed',
  INTERVIEW_SCHEDULED: 'Interview Scheduled',
  INTERVIEW_COMPLETED: 'Interview Completed',
  SELECTED: 'Successful',
  NOT_SELECTED: 'Unsuccessful',
  WITHDRAWN: 'Withdrawn',
};

export const STAGES = {
  APPLICATION: 'APPLICATION',
  SCREENING: 'SCREENING',
  SHORTLIST: 'SHORTLIST',
  EXAMINATION: 'EXAMINATION',
  INTERVIEW: 'INTERVIEW',
  SELECTION: 'SELECTION',
  CLOSED: 'CLOSED',
} as const;

/** The ten stages of the end-to-end recruitment workflow (proposal §6). */
export const WORKFLOW_STAGES = [
  { n: 1, key: 'PLANNING', name: 'Recruitment Planning', description: 'Identify approved vacancies, configure eligibility criteria and authorise the recruitment exercise.' },
  { n: 2, key: 'PUBLICATION', name: 'Vacancy Publication', description: 'Publish vacancies, guidelines and application dates.' },
  { n: 3, key: 'REGISTRATION', name: 'Applicant Registration', description: 'Applicants create accounts and complete profiles.' },
  { n: 4, key: 'SUBMISSION', name: 'Application Submission', description: 'Applicants complete forms, upload documents and submit applications.' },
  { n: 5, key: 'SCREENING', name: 'Preliminary Screening', description: 'Officers review eligibility and document completeness and record outcomes.' },
  { n: 6, key: 'SHORTLIST', name: 'Shortlisting', description: 'Qualified candidates are shortlisted, reviewed and approved.' },
  { n: 7, key: 'EXAMINATION', name: 'Examination and Assessment', description: 'Where applicable, an aptitude test or examination is set. It is sat at a centre, or online in the applicant portal under a timed sitting that is marked automatically.' },
  { n: 8, key: 'INTERVIEW', name: 'Interview', description: 'Candidates are scheduled and panel assessments recorded.' },
  { n: 9, key: 'SELECTION', name: 'Final Selection', description: 'Results are consolidated and authorised recruitment outcomes documented.' },
  { n: 10, key: 'CLOSURE', name: 'Closure and Archiving', description: 'Applicants are notified, records archived, reports generated and exercise closed.' },
] as const;

// --- Documents (Module 2.4) ---------------------------------------------
export const DOCUMENT_TYPES = [
  { code: 'PASSPORT_PHOTO', label: 'Passport Photograph', accept: 'image/jpeg,image/png', maxMb: 2 },
  { code: 'BIRTH_CERTIFICATE', label: 'Birth Certificate / Declaration of Age', accept: 'application/pdf,image/jpeg,image/png', maxMb: 5 },
  { code: 'NIN', label: 'NIN Evidence (NIN Slip)', accept: 'application/pdf,image/jpeg,image/png', maxMb: 5 },
  { code: 'EDUCATIONAL_CERTIFICATE', label: 'Educational Certificate(s)', accept: 'application/pdf,image/jpeg,image/png', maxMb: 8 },
  { code: 'TRANSCRIPT', label: 'Academic Transcript', accept: 'application/pdf', maxMb: 8 },
  { code: 'NYSC', label: 'NYSC Discharge / Exemption Certificate', accept: 'application/pdf,image/jpeg,image/png', maxMb: 5 },
  { code: 'PROFESSIONAL_CERTIFICATE', label: 'Professional Certificate(s)', accept: 'application/pdf,image/jpeg,image/png', maxMb: 8 },
  { code: 'EMPLOYMENT_RECORD', label: 'Employment Record / Letter', accept: 'application/pdf,image/jpeg,image/png', maxMb: 5 },
  { code: 'LGA_CERTIFICATE', label: 'Certificate of State / LGA of Origin', accept: 'application/pdf,image/jpeg,image/png', maxMb: 5 },
  { code: 'OTHER', label: 'Other Commission-specified Document', accept: 'application/pdf,image/jpeg,image/png', maxMb: 8 },
] as const;

export const DOCUMENT_REVIEW_STATUS = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  RESUBMISSION_REQUIRED: 'RESUBMISSION_REQUIRED',
} as const;

// --- Qualifications -----------------------------------------------------
export const QUALIFICATIONS = [
  'FSLC', 'SSCE/WASSCE/NECO', 'OND', 'NCE', 'HND', 'B.Sc / B.A / B.Eng',
  'PGD', 'M.Sc / M.A / MBA', 'Ph.D', 'Professional Certification', 'Trade Test',
] as const;

export const GRADE_LEVELS = [
  'GL 03', 'GL 04', 'GL 05', 'GL 06', 'GL 07', 'GL 08',
  'GL 09', 'GL 10', 'GL 12', 'GL 13', 'GL 14', 'GL 15',
] as const;

/** The 21 Local Government Areas of Kogi State. */
export const KOGI_LGAS = [
  'Adavi', 'Ajaokuta', 'Ankpa', 'Bassa', 'Dekina', 'Ibaji', 'Idah',
  'Igalamela-Odolu', 'Ijumu', 'Kabba/Bunu', 'Kogi', 'Lokoja', 'Mopa-Muro',
  'Ofu', 'Ogori/Magongo', 'Okehi', 'Okene', 'Olamaboro', 'Omala', 'Yagba East',
  'Yagba West',
] as const;

export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'Federal Capital Territory', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano',
  'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun',
  'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe',
  'Zamfara',
] as const;

export const GENDERS = ['Male', 'Female'] as const;
export const MARITAL_STATUS = ['Single', 'Married', 'Divorced', 'Widowed'] as const;

export const ARTICLE_TYPES = [
  { code: 'NEWS', label: 'News' },
  { code: 'ANNOUNCEMENT', label: 'Official Announcement' },
  { code: 'CIRCULAR', label: 'Circular' },
  { code: 'NOTICE', label: 'Public Notice' },
  { code: 'RECRUITMENT_NOTICE', label: 'Recruitment Notice' },
] as const;

export const SCREENING_OUTCOMES = {
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  RESUBMISSION_REQUIRED: 'RESUBMISSION_REQUIRED',
} as const;

export const SCREENING_CLASSIFICATIONS = {
  QUALIFIED: 'QUALIFIED',
  UNDER_QUALIFIED: 'UNDER_QUALIFIED',
  INCOMPLETE: 'INCOMPLETE',
  DISQUALIFIED: 'DISQUALIFIED',
} as const;

export const DEFAULT_INTERVIEW_CRITERIA = [
  { key: 'knowledge', label: 'Job Knowledge & Technical Competence', maxScore: 30 },
  { key: 'communication', label: 'Communication Skills', maxScore: 20 },
  { key: 'analytical', label: 'Analytical & Problem Solving', maxScore: 20 },
  { key: 'conduct', label: 'Conduct, Comportment & Attitude', maxScore: 15 },
  { key: 'suitability', label: 'Overall Suitability for the Position', maxScore: 15 },
] as const;

// --- Establishment: Ministries, Departments and Agencies ----------------
export const MDA_KINDS = [
  { code: 'MINISTRY', label: 'Ministry' },
  { code: 'EXTRA_MINISTERIAL', label: 'Extra-Ministerial Department' },
  { code: 'AGENCY', label: 'Agency' },
  { code: 'PARASTATAL', label: 'Parastatal / Corporation' },
  { code: 'BOARD', label: 'Board' },
  { code: 'COMMISSION', label: 'Commission' },
] as const;

export const MDA_KIND_LABELS: Record<string, string> = Object.fromEntries(
  MDA_KINDS.map((k) => [k.code, k.label]),
);

export const MDA_HEAD_TITLES = [
  'Permanent Secretary',
  'Director-General',
  'Executive Secretary',
  'General Manager',
  'Managing Director',
  'Registrar',
  'Chairman',
  'Head of Department',
] as const;

// --- Recruitment unit ---------------------------------------------------
export const UNIT_MEMBER_ROLES = [
  { code: 'COORDINATOR', label: 'Unit Coordinator' },
  { code: 'DEPUTY_COORDINATOR', label: 'Deputy Coordinator' },
  { code: 'SECRETARY', label: 'Unit Secretary' },
  { code: 'SCREENING_LEAD', label: 'Screening Lead' },
  { code: 'EXAMINATION_LEAD', label: 'Examination Lead' },
  { code: 'INTERVIEW_LEAD', label: 'Interview Lead' },
  { code: 'RECORDS_OFFICER', label: 'Records Officer' },
  { code: 'MEMBER', label: 'Unit Member' },
] as const;

export const UNIT_MEMBER_ROLE_LABELS: Record<string, string> = Object.fromEntries(
  UNIT_MEMBER_ROLES.map((r) => [r.code, r.label]),
);

// --- Computer based testing ---------------------------------------------
export const QUESTION_TYPES = [
  { code: 'SINGLE_CHOICE', label: 'Single answer' },
  { code: 'MULTI_CHOICE', label: 'Multiple answers' },
  { code: 'TRUE_FALSE', label: 'True or false' },
] as const;

export const QUESTION_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  QUESTION_TYPES.map((t) => [t.code, t.label]),
);

export const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;

export const EXAM_SUBJECTS = [
  { code: 'GENERAL', label: 'General Paper' },
  { code: 'APTITUDE', label: 'Aptitude / Reasoning' },
  { code: 'NUMERICAL', label: 'Numerical Reasoning' },
  { code: 'VERBAL', label: 'Verbal Reasoning' },
  { code: 'ENGLISH', label: 'Use of English' },
  { code: 'CURRENT_AFFAIRS', label: 'Current Affairs' },
  { code: 'CIVIL_SERVICE_RULES', label: 'Civil Service Rules & Public Administration' },
  { code: 'COMPUTER_LITERACY', label: 'Computer Appreciation' },
  { code: 'PROFESSIONAL', label: 'Professional / Technical Subject' },
] as const;

export const EXAM_SUBJECT_LABELS: Record<string, string> = Object.fromEntries(
  EXAM_SUBJECTS.map((s) => [s.code, s.label]),
);

export const PAPER_KINDS = [
  { code: 'APTITUDE_TEST', label: 'Aptitude Test' },
  { code: 'QUALIFYING_EXAM', label: 'Qualifying Examination' },
  { code: 'PROMOTION_EXAM', label: 'Promotion Examination' },
  { code: 'TRADE_TEST', label: 'Trade Test' },
] as const;

export const PAPER_KIND_LABELS: Record<string, string> = Object.fromEntries(
  PAPER_KINDS.map((k) => [k.code, k.label]),
);

export const PAPER_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  RETIRED: 'RETIRED',
} as const;

export const EXAM_MODES = [
  { code: 'CENTRE', label: 'Centre-based (paper)', description: 'Candidates attend a physical centre and scores are entered by officers.' },
  { code: 'CBT', label: 'Computer-based test (online)', description: 'Candidates sit the paper online in the applicant portal and it is marked automatically.' },
  { code: 'HYBRID', label: 'Hybrid', description: 'Candidates are allocated to centres and sit the paper on a computer under supervision.' },
] as const;

export const EXAM_MODE_LABELS: Record<string, string> = Object.fromEntries(
  EXAM_MODES.map((m) => [m.code, m.label]),
);

export const SITTING_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  EXPIRED: 'EXPIRED',
} as const;

export const SITTING_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  SUBMITTED: 'Submitted',
  EXPIRED: 'Expired (auto-submitted)',
};

export const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
