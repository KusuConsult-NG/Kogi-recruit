import { describe, expect, it } from 'vitest';
import {
  applicantProfileSchema, educationSchema, emailSchema, enquirySchema,
  exerciseSchema, fieldErrors, formToObject, loginSchema, ninSchema,
  parseForm, passwordSchema, phoneSchema, registerSchema, screeningSchema,
  examScheduleSchema, interviewScheduleSchema, vacancySchema, selectionListSchema,
  employmentSchema, articleSchema, taskSchema,
} from '@/lib/validation';

function fd(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(values)) form.append(k, v);
  return form;
}

describe('field validators', () => {
  it('normalises and validates an email address', () => {
    expect(emailSchema.parse('  Officer@Kogicsc.KG.GOV.NG ')).toBe('officer@kogicsc.kg.gov.ng');
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
    expect(emailSchema.safeParse('').success).toBe(false);
  });

  it('accepts Nigerian telephone formats and rejects others', () => {
    for (const ok of ['08031234567', '07012345678', '09087654321', '+2348031234567', '2348031234567']) {
      expect(phoneSchema.safeParse(ok).success, ok).toBe(true);
    }
    for (const bad of ['0803123456', '1234567890', '+447700900000', '080312345678', 'abcdefghijk']) {
      expect(phoneSchema.safeParse(bad).success, bad).toBe(false);
    }
  });

  it('requires a password of at least eight characters with a letter and a number', () => {
    expect(passwordSchema.safeParse('Kogi2026').success).toBe(true);
    expect(passwordSchema.safeParse('short1').success).toBe(false);
    expect(passwordSchema.safeParse('alllettersonly').success).toBe(false);
    expect(passwordSchema.safeParse('12345678').success).toBe(false);
  });

  it('requires an eleven-digit NIN', () => {
    expect(ninSchema.safeParse('12345678901').success).toBe(true);
    expect(ninSchema.safeParse('1234567890').success).toBe(false);
    expect(ninSchema.safeParse('1234567890A').success).toBe(false);
  });
});

describe('applicant registration (Module 2.2)', () => {
  const valid = {
    surname: 'Adeyemi', firstName: 'Grace', middleName: 'Oiza',
    email: 'grace.adeyemi@example.com', phone: '08031234567',
    password: 'Kogi2026', confirmPassword: 'Kogi2026', consent: 'on',
  };

  it('accepts a complete registration', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects mismatched passwords, naming the field', () => {
    const r = registerSchema.safeParse({ ...valid, confirmPassword: 'Different1' });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).confirmPassword).toMatch(/do not match/);
  });

  it('requires the privacy notice to be accepted', () => {
    const r = registerSchema.safeParse({ ...valid, consent: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).consent).toMatch(/privacy notice/);
  });

  it('requires a surname and first name', () => {
    expect(registerSchema.safeParse({ ...valid, surname: '' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, firstName: '   ' }).success).toBe(false);
  });
});

describe('applicant profile (Module 2.2)', () => {
  const valid = {
    surname: 'Audu', firstName: 'Joseph', middleName: '',
    gender: 'Male', dateOfBirth: '1995-04-12', maritalStatus: 'Single',
    nin: '12345678901', phone: '08031234567', altPhone: '',
    residentialAddress: '14 Ganaja Road, Lokoja', city: 'Lokoja',
    stateOfResidence: 'Kogi', stateOfOrigin: 'Kogi', lga: 'Lokoja', disability: '',
  };

  it('accepts a complete profile', () => {
    expect(applicantProfileSchema.safeParse(valid).success).toBe(true);
  });

  it('allows an optional NIN to be left blank', () => {
    expect(applicantProfileSchema.safeParse({ ...valid, nin: '' }).success).toBe(true);
  });

  it('rejects an unknown State', () => {
    expect(applicantProfileSchema.safeParse({ ...valid, stateOfOrigin: 'Atlantis' }).success).toBe(false);
  });

  it('requires a residential address and LGA', () => {
    expect(applicantProfileSchema.safeParse({ ...valid, residentialAddress: '' }).success).toBe(false);
    expect(applicantProfileSchema.safeParse({ ...valid, lga: '' }).success).toBe(false);
  });
});

describe('recruitment exercise configuration (Module 2.1)', () => {
  const valid = {
    title: '2026 Recruitment Exercise', reference: 'KGCSC/REC/2026/001',
    description: 'A recruitment exercise for the Kogi State Civil Service.',
    guidelines: '', eligibility: '',
    opensAt: '2026-03-01T09:00', closesAt: '2026-04-15T17:00',
    maxApplications: '1', requireExam: 'true', requireInterview: 'true',
  };

  it('accepts a valid exercise', () => {
    expect(exerciseSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a closing date before the opening date', () => {
    const r = exerciseSchema.safeParse({ ...valid, closesAt: '2026-02-01T09:00' });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).closesAt).toMatch(/after the opening date/);
  });

  it('requires a title and description', () => {
    expect(exerciseSchema.safeParse({ ...valid, title: '' }).success).toBe(false);
    expect(exerciseSchema.safeParse({ ...valid, description: '' }).success).toBe(false);
  });
});

describe('vacancy configuration (Module 2.1)', () => {
  const valid = {
    jobTitle: 'Administrative Officer II', gradeLevel: 'GL 08', departmentId: '',
    agency: '', positions: '35', description: '',
    qualifications: 'A degree from a recognised university.', experience: '',
    minAge: '18', maxAge: '35',
  };

  it('accepts a valid vacancy', () => {
    expect(vacancySchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a maximum age below the minimum', () => {
    const r = vacancySchema.safeParse({ ...valid, minAge: '40', maxAge: '30' });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).maxAge).toMatch(/not be lower/);
  });

  it('rejects an unknown grade level and zero posts', () => {
    expect(vacancySchema.safeParse({ ...valid, gradeLevel: 'GL 99' }).success).toBe(false);
    expect(vacancySchema.safeParse({ ...valid, positions: '0' }).success).toBe(false);
  });

  it('requires qualification requirements to be stated', () => {
    expect(vacancySchema.safeParse({ ...valid, qualifications: '' }).success).toBe(false);
  });
});

describe('assessment configuration (Modules 2.6 – 2.8)', () => {
  it('rejects an examination pass mark above the total marks', () => {
    const r = examScheduleSchema.safeParse({
      title: 'Aptitude Test', examDate: '2026-05-01', startTime: '09:00',
      endTime: '11:00', totalMarks: '100', passMark: '120', instructions: '',
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).passMark).toMatch(/cannot exceed/);
  });

  it('requires times in HH:MM form', () => {
    const r = examScheduleSchema.safeParse({
      title: 'Aptitude Test', examDate: '2026-05-01', startTime: '9am',
      totalMarks: '100', passMark: '50',
    });
    expect(r.success).toBe(false);
  });

  it('requires an interview venue', () => {
    const r = interviewScheduleSchema.safeParse({
      title: 'Oral Interview', interviewDate: '2026-06-01', startTime: '09:00',
      venue: '', slotMinutes: '20', totalMarks: '100', passMark: '50',
    });
    expect(r.success).toBe(false);
  });

  it('requires at least one weighted component on a selection list', () => {
    const r = selectionListSchema.safeParse({ title: 'Final list', examWeight: '0', interviewWeight: '0' });
    expect(r.success).toBe(false);
    expect(selectionListSchema.safeParse({ title: 'Final list', examWeight: '60', interviewWeight: '40' }).success).toBe(true);
  });
});

describe('screening decisions (Module 2.5)', () => {
  it('accepts a recorded outcome', () => {
    const r = screeningSchema.safeParse({
      completenessPass: 'true', eligibilityPass: 'true', qualificationPass: 'true',
      experiencePass: 'true', documentsPass: 'true', outcome: 'PASSED',
      classification: 'QUALIFIED', remarks: 'All criteria met.',
    });
    expect(r.success).toBe(true);
  });

  it('rejects an unrecognised outcome', () => {
    expect(screeningSchema.safeParse({ outcome: 'MAYBE' }).success).toBe(false);
  });
});

describe('form parsing helpers', () => {
  it('converts FormData into a plain object', () => {
    const form = fd({ name: 'Grace', email: 'grace@example.com' });
    expect(formToObject(form)).toEqual({ name: 'Grace', email: 'grace@example.com' });
  });

  it('collects repeated fields into an array', () => {
    const form = new FormData();
    form.append('applicationIds', 'a');
    form.append('applicationIds', 'b');
    expect(formToObject(form).applicationIds).toEqual(['a', 'b']);
  });

  it('ignores file entries', () => {
    const form = new FormData();
    form.append('title', 'Circular');
    form.append('file', new File(['x'], 'x.pdf', { type: 'application/pdf' }));
    expect(formToObject(form)).toEqual({ title: 'Circular' });
  });

  it('returns typed data on success and field errors on failure', () => {
    const ok = parseForm(loginSchema, fd({ email: 'a@b.com', password: 'secret' }));
    expect(ok.success).toBe(true);
    expect(ok.data?.email).toBe('a@b.com');

    const bad = parseForm(loginSchema, fd({ email: 'nope', password: '' }));
    expect(bad.success).toBe(false);
    expect(bad.errors?.email).toBeTruthy();
    expect(bad.errors?.password).toBeTruthy();
  });

  it('validates a public enquiry', () => {
    const r = parseForm(enquirySchema, fd({
      name: 'Daniel Okoh', email: 'daniel@example.com', phone: '',
      subject: 'Recruitment fraud report', message: 'Someone demanded payment.',
    }));
    expect(r.success).toBe(true);
  });

  it('rejects an education entry without an institution', () => {
    expect(educationSchema.safeParse({ institution: '', qualification: 'HND' }).success).toBe(false);
  });
});

describe('empty optional form fields (HTML form behaviour)', () => {
  it('treats blank optional years as not supplied', () => {
    const r = educationSchema.safeParse({
      institution: 'Kogi State University, Anyigba',
      qualification: 'B.Sc / B.A / B.Eng',
      course: '', grade: '', startYear: '', endYear: '', certificateNo: '',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.startYear).toBeUndefined();
      expect(r.data.endYear).toBeUndefined();
    }
  });

  it('still validates a supplied year', () => {
    expect(educationSchema.safeParse({
      institution: 'X', qualification: 'HND', startYear: '1800',
    }).success).toBe(false);
    expect(educationSchema.safeParse({
      institution: 'X', qualification: 'HND', startYear: '2015', endYear: '2019',
    }).success).toBe(true);
  });

  it('treats blank optional vacancy age limits as not supplied', () => {
    const r = vacancySchema.safeParse({
      jobTitle: 'Clerical Officer', gradeLevel: 'GL 06', positions: '45',
      qualifications: 'SSCE with five credits.', minAge: '', maxAge: '',
      departmentId: '', agency: '', description: '', experience: '',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.minAge).toBeUndefined();
  });

  it('treats blank optional employment dates as not supplied', () => {
    const r = employmentSchema.safeParse({
      employer: 'Kogi State Ministry of Education', jobTitle: 'Clerk',
      responsibilities: '', startDate: '', endDate: '',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.startDate).toBeUndefined();
      expect(r.data.current).toBe(false);
    }
  });

  it('reads an unchecked checkbox as false and a checked one as true', () => {
    const unchecked = employmentSchema.safeParse({ employer: 'E', jobTitle: 'J' });
    expect(unchecked.success && unchecked.data.current).toBe(false);
    const checked = employmentSchema.safeParse({ employer: 'E', jobTitle: 'J', current: 'true' });
    expect(checked.success && checked.data.current).toBe(true);
  });

  it('reads screening checkboxes as booleans', () => {
    const r = screeningSchema.safeParse({ outcome: 'PASSED', completenessPass: 'true' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.completenessPass).toBe(true);
      expect(r.data.eligibilityPass).toBe(false);
    }
  });

  it('treats a blank publication date as not supplied', () => {
    const r = articleSchema.safeParse({
      type: 'NEWS', title: 'Headline', summary: '', body: 'Body text', publishedAt: '',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.publishedAt).toBeUndefined();
  });

  it('treats a blank task due date as not supplied', () => {
    const r = taskSchema.safeParse({ title: 'Task', description: '', dueDate: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.dueDate).toBeUndefined();
  });
});
