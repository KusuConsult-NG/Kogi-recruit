import { z } from 'zod';
import {
  GENDERS, MARITAL_STATUS, NIGERIAN_STATES, QUALIFICATIONS, GRADE_LEVELS,
  ROLES, ARTICLE_TYPES,
} from './constants';

const nonEmpty = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);


/**
 * An HTML form submits an untouched optional field as an empty string.
 * These helpers treat that as "not supplied" rather than coercing it to 0
 * or to an invalid date, which would otherwise fail validation.
 */
const blankToUndefined = (v: unknown) =>
  v === '' || v === null || v === undefined ? undefined : v;

const optionalNumber = (opts: { min?: number; max?: number; int?: boolean } = {}) => {
  let schema = z.coerce.number();
  if (opts.int) schema = schema.int();
  if (opts.min !== undefined) schema = schema.min(opts.min);
  if (opts.max !== undefined) schema = schema.max(opts.max);
  return z.preprocess(blankToUndefined, schema.optional());
};

const optionalDate = (message = 'Enter a valid date.') =>
  z.preprocess(blankToUndefined, z.coerce.date({ errorMap: () => ({ message }) }).optional());

const optionalBoolean = () =>
  z.preprocess((v) => v === 'true' || v === 'on' || v === true, z.boolean());

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Email address is required.')
  .email('Enter a valid email address.');

/** Nigerian phone number: 0XXXXXXXXXX or +234XXXXXXXXXX. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^(?:\+?234|0)[789][01]\d{8}$/, 'Enter a valid Nigerian telephone number.');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password is too long.')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter.')
  .regex(/\d/, 'Password must contain at least one number.');

export const ninSchema = z
  .string()
  .trim()
  .regex(/^\d{11}$/, 'A National Identification Number is 11 digits.');

// --- Authentication ------------------------------------------------------
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required.'),
});

export const registerSchema = z
  .object({
    surname: nonEmpty('Surname', 80),
    firstName: nonEmpty('First name', 80),
    middleName: z.string().trim().max(80).optional().or(z.literal('')),
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    consent: z.literal('on', { errorMap: () => ({ message: 'You must accept the privacy notice.' }) }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'The passwords entered do not match.',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'The passwords entered do not match.',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Your current password is required.'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'The passwords entered do not match.',
    path: ['confirmPassword'],
  });

// --- Applicant profile (Module 2.2) --------------------------------------
export const applicantProfileSchema = z.object({
  surname: nonEmpty('Surname', 80),
  firstName: nonEmpty('First name', 80),
  middleName: z.string().trim().max(80).optional().or(z.literal('')),
  gender: z.enum(GENDERS),
  dateOfBirth: z.coerce.date({ errorMap: () => ({ message: 'Enter a valid date of birth.' }) }),
  maritalStatus: z.enum(MARITAL_STATUS),
  nin: ninSchema.optional().or(z.literal('')),
  phone: phoneSchema,
  altPhone: phoneSchema.optional().or(z.literal('')),
  residentialAddress: nonEmpty('Residential address', 300),
  city: nonEmpty('City / Town', 100),
  stateOfResidence: z.enum(NIGERIAN_STATES),
  stateOfOrigin: z.enum(NIGERIAN_STATES),
  lga: nonEmpty('Local Government Area', 100),
  disability: z.string().trim().max(200).optional().or(z.literal('')),
});

// --- Application (Module 2.3) -------------------------------------------
export const educationSchema = z.object({
  institution: nonEmpty('Institution', 200),
  qualification: z.enum(QUALIFICATIONS),
  course: z.string().trim().max(150).optional().or(z.literal('')),
  grade: z.string().trim().max(60).optional().or(z.literal('')),
  startYear: optionalNumber({ int: true, min: 1950, max: 2100 }),
  endYear: optionalNumber({ int: true, min: 1950, max: 2100 }),
  certificateNo: z.string().trim().max(80).optional().or(z.literal('')),
});

export const employmentSchema = z.object({
  employer: nonEmpty('Employer', 200),
  jobTitle: nonEmpty('Job title', 150),
  responsibilities: z.string().trim().max(1000).optional().or(z.literal('')),
  startDate: optionalDate('Enter a valid start date.'),
  endDate: optionalDate('Enter a valid end date.'),
  current: optionalBoolean(),
});

export const refereeSchema = z.object({
  name: nonEmpty('Referee name', 150),
  occupation: z.string().trim().max(120).optional().or(z.literal('')),
  organisation: z.string().trim().max(200).optional().or(z.literal('')),
  email: emailSchema.optional().or(z.literal('')),
  phone: phoneSchema.optional().or(z.literal('')),
  address: z.string().trim().max(300).optional().or(z.literal('')),
});

export const nextOfKinSchema = z.object({
  name: nonEmpty('Next of kin name', 150),
  relationship: nonEmpty('Relationship', 60),
  phone: phoneSchema,
  email: emailSchema.optional().or(z.literal('')),
  address: z.string().trim().max(300).optional().or(z.literal('')),
});

export const submitApplicationSchema = z.object({
  declaration: z.literal('on', {
    errorMap: () => ({ message: 'You must confirm the declaration before submitting.' }),
  }),
  consent: z.literal('on', {
    errorMap: () => ({ message: 'You must give consent for your data to be processed.' }),
  }),
});

// --- Exercises and vacancies (Module 2.1) -------------------------------
export const exerciseSchema = z
  .object({
    title: nonEmpty('Exercise title', 200),
    reference: z.string().trim().max(60).optional().or(z.literal('')),
    description: nonEmpty('Description', 4000),
    guidelines: z.string().trim().max(8000).optional().or(z.literal('')),
    eligibility: z.string().trim().max(4000).optional().or(z.literal('')),
    opensAt: z.coerce.date({ errorMap: () => ({ message: 'Enter a valid opening date.' }) }),
    closesAt: z.coerce.date({ errorMap: () => ({ message: 'Enter a valid closing date.' }) }),
    maxApplications: z.coerce.number().int().min(1).max(10).default(1),
    requireExam: optionalBoolean(),
    requireInterview: optionalBoolean(),
  })
  .refine((d) => d.closesAt > d.opensAt, {
    message: 'The closing date must be after the opening date.',
    path: ['closesAt'],
  });

export const vacancySchema = z
  .object({
    jobTitle: nonEmpty('Job title', 200),
    gradeLevel: z.enum(GRADE_LEVELS),
    departmentId: z.string().trim().optional().or(z.literal('')),
    agency: z.string().trim().max(200).optional().or(z.literal('')),
    positions: z.coerce.number().int().min(1, 'At least one position is required.').max(10000),
    description: z.string().trim().max(4000).optional().or(z.literal('')),
    qualifications: nonEmpty('Qualification requirements', 2000),
    experience: z.string().trim().max(2000).optional().or(z.literal('')),
    minAge: optionalNumber({ int: true, min: 15, max: 70 }),
    maxAge: optionalNumber({ int: true, min: 15, max: 70 }),
  })
  .refine((d) => d.minAge === undefined || d.maxAge === undefined || d.maxAge >= d.minAge, {
    message: 'The maximum age must not be lower than the minimum age.',
    path: ['maxAge'],
  });

export const documentRequirementSchema = z.object({
  code: nonEmpty('Document type', 60),
  label: nonEmpty('Document label', 150),
  required: optionalBoolean(),
  description: z.string().trim().max(400).optional().or(z.literal('')),
  maxSizeMb: z.coerce.number().int().min(1).max(20).default(5),
  acceptTypes: z.string().trim().min(1).default('application/pdf,image/jpeg,image/png'),
});

// --- Screening (Module 2.5) ---------------------------------------------
export const screeningSchema = z.object({
  completenessPass: optionalBoolean(),
  eligibilityPass: optionalBoolean(),
  qualificationPass: optionalBoolean(),
  experiencePass: optionalBoolean(),
  documentsPass: optionalBoolean(),
  outcome: z.enum(['PASSED', 'FAILED', 'RESUBMISSION_REQUIRED']),
  classification: z.enum(['QUALIFIED', 'UNDER_QUALIFIED', 'INCOMPLETE', 'DISQUALIFIED']).optional(),
  remarks: z.string().trim().max(2000).optional().or(z.literal('')),
});

export const documentReviewSchema = z.object({
  outcome: z.enum(['VERIFIED', 'REJECTED', 'RESUBMISSION_REQUIRED']),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});

// --- Examination (Module 2.6) -------------------------------------------
export const examScheduleSchema = z
  .object({
    title: nonEmpty('Examination title', 200),
    examDate: z.coerce.date({ errorMap: () => ({ message: 'Enter a valid examination date.' }) }),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Enter a start time as HH:MM.'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Enter an end time as HH:MM.').optional().or(z.literal('')),
    totalMarks: z.coerce.number().min(1).max(1000).default(100),
    passMark: z.coerce.number().min(0).max(1000).default(50),
    instructions: z.string().trim().max(4000).optional().or(z.literal('')),
  })
  .refine((d) => d.passMark <= d.totalMarks, {
    message: 'The pass mark cannot exceed the total marks.',
    path: ['passMark'],
  });

export const examCentreSchema = z.object({
  name: nonEmpty('Centre name', 200),
  address: z.string().trim().max(300).optional().or(z.literal('')),
  lga: z.string().trim().max(100).optional().or(z.literal('')),
  capacity: z.coerce.number().int().min(1).max(10000).default(100),
  supervisor: z.string().trim().max(150).optional().or(z.literal('')),
});

// --- Interview (Module 2.7) ---------------------------------------------
export const interviewScheduleSchema = z
  .object({
    title: nonEmpty('Interview title', 200),
    interviewDate: z.coerce.date({ errorMap: () => ({ message: 'Enter a valid interview date.' }) }),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Enter a start time as HH:MM.'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Enter an end time as HH:MM.').optional().or(z.literal('')),
    venue: nonEmpty('Venue', 250),
    slotMinutes: z.coerce.number().int().min(5).max(180).default(20),
    totalMarks: z.coerce.number().min(1).max(1000).default(100),
    passMark: z.coerce.number().min(0).max(1000).default(50),
  })
  .refine((d) => d.passMark <= d.totalMarks, {
    message: 'The pass mark cannot exceed the total marks.',
    path: ['passMark'],
  });

export const panelSchema = z.object({
  name: nonEmpty('Panel name', 150),
  roomVenue: z.string().trim().max(200).optional().or(z.literal('')),
});

// --- Selection (Module 2.8) --------------------------------------------
export const selectionListSchema = z
  .object({
    title: nonEmpty('Selection list title', 200),
    examWeight: z.coerce.number().min(0).max(100).default(50),
    interviewWeight: z.coerce.number().min(0).max(100).default(50),
  })
  .refine((d) => d.examWeight + d.interviewWeight > 0, {
    message: 'At least one component must carry weight.',
    path: ['examWeight'],
  });

// --- Content (Module 1) -------------------------------------------------
export const articleSchema = z.object({
  type: z.enum(ARTICLE_TYPES.map((t) => t.code) as [string, ...string[]]),
  title: nonEmpty('Title', 250),
  summary: z.string().trim().max(600).optional().or(z.literal('')),
  body: nonEmpty('Content', 40000),
  publishedAt: optionalDate('Enter a valid publication date.'),
});

export const pageContentSchema = z.object({
  title: nonEmpty('Title', 200),
  subtitle: z.string().trim().max(300).optional().or(z.literal('')),
  body: nonEmpty('Content', 40000),
  published: optionalBoolean(),
});

export const departmentSchema = z.object({
  name: nonEmpty('Name', 200),
  code: z.string().trim().max(30).optional().or(z.literal('')),
  kind: z.enum(['DEPARTMENT', 'UNIT']).default('DEPARTMENT'),
  parentId: z.string().trim().optional().or(z.literal('')),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  headName: z.string().trim().max(150).optional().or(z.literal('')),
  headTitle: z.string().trim().max(150).optional().or(z.literal('')),
  email: emailSchema.optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  published: optionalBoolean(),
});

export const leadershipSchema = z.object({
  name: nonEmpty('Name', 150),
  position: nonEmpty('Position', 150),
  bio: z.string().trim().max(4000).optional().or(z.literal('')),
  email: emailSchema.optional().or(z.literal('')),
  published: optionalBoolean(),
});

export const faqSchema = z.object({
  question: nonEmpty('Question', 400),
  answer: nonEmpty('Answer', 4000),
  category: z.string().trim().max(60).default('GENERAL'),
  published: optionalBoolean(),
});

export const enquirySchema = z.object({
  name: nonEmpty('Your name', 150),
  email: emailSchema,
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  subject: nonEmpty('Subject', 200),
  message: nonEmpty('Message', 4000),
});

export const enquiryResponseSchema = z.object({
  response: nonEmpty('Response', 4000),
  status: z.enum(['NEW', 'IN_PROGRESS', 'RESPONDED', 'CLOSED']).default('RESPONDED'),
});

export const downloadSchema = z.object({
  title: nonEmpty('Title', 200),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  category: z.enum(['FORM', 'GUIDELINE', 'PUBLICATION', 'CIRCULAR']).default('FORM'),
  published: optionalBoolean(),
});

// --- Users (Module 5) ---------------------------------------------------
export const staffUserSchema = z.object({
  fullName: nonEmpty('Full name', 150),
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal('')),
  role: z.enum(Object.values(ROLES) as [string, ...string[]]),
  title: z.string().trim().max(100).optional().or(z.literal('')),
  staffNumber: z.string().trim().max(60).optional().or(z.literal('')),
  departmentId: z.string().trim().optional().or(z.literal('')),
  active: optionalBoolean(),
});

// --- Notifications (Module 7) ------------------------------------------
export const notificationBatchSchema = z.object({
  title: nonEmpty('Batch title', 200),
  channel: z.enum(['EMAIL', 'SMS', 'BOTH']).default('EMAIL'),
  subject: nonEmpty('Subject', 250),
  body: nonEmpty('Message', 8000),
  exerciseId: z.string().trim().optional().or(z.literal('')),
  audienceStatus: z.string().trim().optional().or(z.literal('')),
});

// --- Administrative records (Module 4) ---------------------------------
export const taskSchema = z.object({
  title: nonEmpty('Task title', 200),
  description: z.string().trim().max(4000).optional().or(z.literal('')),
  assigneeId: z.string().trim().optional().or(z.literal('')),
  departmentId: z.string().trim().optional().or(z.literal('')),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED']).default('OPEN'),
  dueDate: optionalDate('Enter a valid due date.'),
});

export const correspondenceSchema = z.object({
  direction: z.enum(['INCOMING', 'OUTGOING']).default('INCOMING'),
  subject: nonEmpty('Subject', 250),
  body: z.string().trim().max(8000).optional().or(z.literal('')),
  party: nonEmpty('Party / Correspondent', 200),
  classification: z.enum(['GENERAL', 'CONFIDENTIAL', 'RESTRICTED']).default('GENERAL'),
  status: z.enum(['OPEN', 'ACTIONED', 'FILED', 'CLOSED']).default('OPEN'),
  receivedAt: optionalDate('Enter a valid date.'),
});

export const repositoryDocumentSchema = z.object({
  title: nonEmpty('Title', 200),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  classification: z.enum(['GENERAL', 'CONFIDENTIAL', 'RESTRICTED']).default('GENERAL'),
  category: z.string().trim().max(60).default('RECORD'),
  tags: z.string().trim().max(300).optional().or(z.literal('')),
});

/** Convert FormData into a plain object for zod parsing. */
export function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue;
    if (key.endsWith('[]')) {
      const k = key.slice(0, -2);
      (out[k] as string[]) = [...((out[k] as string[]) ?? []), String(value)];
    } else if (key in out) {
      const existing = out[key];
      out[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Flatten zod errors into { field: message } for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  errors?: Record<string, string>;
}

export function parseForm<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData,
): ParseResult<z.infer<T>> {
  const result = schema.safeParse(formToObject(formData));
  if (result.success) return { success: true, data: result.data };
  return { success: false, errors: fieldErrors(result.error) };
}
