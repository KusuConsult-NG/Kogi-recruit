/**
 * Seeds portal content and a complete sample recruitment exercise with
 * applicants at every stage of the ten-stage workflow.
 */
import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  APPLICATION_STATUS, DEFAULT_INTERVIEW_CRITERIA, DOCUMENT_TYPES,
  EXERCISE_STATUS, KOGI_LGAS, ROLES,
} from '../src/lib/constants';
import { finalScore, rankEntries } from '../src/lib/scoring';
import { stageForStatus } from '../src/lib/workflow';

interface SeedContext {
  staff: Record<string, string>;
  departments: Record<string, string>;
  screener2: { id: string };
  extraPanel: string[];
  hash: string;
  applicantHash: string;
  establishment: {
    ministries: Record<string, string>;
    ministryDepartments: Record<string, string>;
    unitId: string;
    paperId: string;
    bankIds: Record<string, string>;
  };
}

const A = APPLICATION_STATUS;

function slugify(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}
function pad(n: number, w = 6): string {
  return String(n).padStart(w, '0');
}
function days(d: number): Date {
  return new Date(Date.now() + d * 86400_000);
}
function yearsAgo(y: number, month = 5, day = 12): Date {
  return new Date(new Date().getFullYear() - y, month, day);
}
/** Deterministic pseudo-random so repeated seeds produce the same data. */
function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

const SURNAMES = ['Adeyemi', 'Onoja', 'Yakubu', 'Ocheje', 'Egwuda', 'Momoh', 'Audu', 'Bello', 'Jimoh', 'Abah', 'Ameh', 'Ogbaji', 'Suleiman', 'Lawal', 'Idachaba', 'Achimugu', 'Salami', 'Edoka', 'Ogwuche', 'Attah', 'Danjuma', 'Okpanachi', 'Ilemona', 'Negedu', 'Owoicho', 'Ejembi', 'Ayegba', 'Usman', 'Shaibu', 'Oyibo'];
const FIRST_M = ['Emmanuel', 'Daniel', 'Samuel', 'Joseph', 'Michael', 'Victor', 'Ibrahim', 'Hassan', 'Peter', 'John', 'Abdul', 'Solomon', 'Timothy', 'Paul', 'Isaac'];
const FIRST_F = ['Grace', 'Fatima', 'Blessing', 'Aisha', 'Ruth', 'Patience', 'Hadiza', 'Mary', 'Esther', 'Rebecca', 'Zainab', 'Comfort', 'Joy', 'Elizabeth', 'Hannah'];
const INSTITUTIONS = ['Kogi State University, Anyigba', 'Federal University Lokoja', 'Ahmadu Bello University, Zaria', 'University of Jos', 'Kogi State Polytechnic, Lokoja', 'Federal Polytechnic, Idah', 'University of Abuja', 'Benue State University, Makurdi'];
const COURSES = ['Public Administration', 'Accounting', 'Economics', 'Business Administration', 'Computer Science', 'Statistics', 'Law', 'Mass Communication', 'Political Science', 'Sociology'];
const EMPLOYERS = ['Kogi State Ministry of Education', 'Lokoja Local Government Council', 'Zenith Bank Plc', 'National Youth Service Corps', 'Dekina Local Government Council', 'Confluence Microfinance Bank', 'Kogi State Universal Basic Education Board', 'Private practice'];

export async function seedRecruitment(prisma: PrismaClient, ctx: SeedContext): Promise<void> {
  const { staff, departments, establishment } = ctx;
  const rand = rng(20260211);

  // -------------------------------------------------------------------------
  // MODULE 1 - News, announcements, circulars and notices
  // -------------------------------------------------------------------------
  const articles = [
    {
      type: 'ANNOUNCEMENT',
      title: '2026 Kogi State Civil Service Recruitment Exercise now open for applications',
      summary: 'The Commission invites suitably qualified candidates to apply online for 148 approved vacancies across six cadres. Applications close in six weeks.',
      body: `The ${'Kogi State Civil Service Commission'} hereby invites applications from suitably qualified candidates for appointment into the Kogi State Civil Service under the 2026 Civil Service Recruitment Exercise.\n\n## Approved vacancies\n\nA total of **148 approved positions** are advertised across six cadres, from Grade Level 06 to Grade Level 09, in the Commission's departments and in participating ministries, departments and agencies.\n\n## How to apply\n\n1. Create an applicant account on this portal.\n2. Complete your personal and contact details in full.\n3. Select the position you wish to apply for and complete the application form.\n4. Upload every required document clearly scanned.\n5. Confirm the declaration and submit before the closing date.\n\n## Important\n\n**No payment of any kind is required** at any stage of this exercise. The Commission does not operate through agents or intermediaries. Any demand for payment should be reported immediately to ${'info@kogicsc.kg.gov.ng'}.\n\nOnly shortlisted candidates will be invited to the written examination. All communication is sent to the email address and telephone number on your applicant account.`,
      status: 'PUBLISHED',
      publishedAt: days(-30),
      authorId: staff[ROLES.CONTENT_OFFICER],
    },
    {
      type: 'RECRUITMENT_NOTICE',
      title: 'Written examination schedule for shortlisted candidates',
      summary: 'Shortlisted candidates in the 2026 exercise are to sit the written aptitude test at designated centres across the State. Examination numbers and centre allocations have been issued.',
      body: `Shortlisted candidates for the 2026 Civil Service Recruitment Exercise are hereby invited to the written aptitude test.\n\n## Arrangements\n\n- Each candidate has been issued an **examination number** and allocated to a centre.\n- Candidates should report to their allocated centre at least **45 minutes** before the reporting time.\n- A valid means of identification and a printed copy of the examination invitation are required for admission.\n- Candidates allocated to a centre in their Local Government Area of origin where capacity permitted.\n\nExamination numbers, dates, reporting times and centre details are available on each candidate's applicant dashboard and were sent by email and SMS.\n\nCandidates who do not receive an invitation were not shortlisted at this stage. Screening outcomes and the reasons recorded are visible on each applicant's dashboard.`,
      status: 'PUBLISHED',
      publishedAt: days(-12),
      authorId: staff[ROLES.EXAMINATION_OFFICER],
    },
    {
      type: 'CIRCULAR',
      title: 'Circular KGCSC/CIR/2026/004 — Verification of credentials for newly appointed officers',
      summary: 'All ministries, departments and agencies are to ensure that the credentials of newly appointed officers are verified with the awarding institutions before assumption of duty.',
      body: `## To: All Permanent Secretaries, Heads of Department and Heads of Agency\n\n### Verification of credentials\n\nFollowing the conclusion of recruitment exercises, all ministries, departments and agencies are reminded that the credentials of newly appointed officers must be verified directly with the awarding institutions **before the officer assumes duty**.\n\n### Required action\n\n1. Obtain the originals of all certificates presented by the officer.\n2. Write to the awarding institution for confirmation, quoting the certificate number.\n3. File the institution's written confirmation in the officer's personal file.\n4. Report any discrepancy to the Commission immediately.\n\nAppointments are made subject to the verification of credentials. Any appointment founded on a false or unverified credential is liable to withdrawal.\n\nThis circular takes immediate effect.`,
      status: 'PUBLISHED',
      publishedAt: days(-21),
      authorId: staff[ROLES.COMMISSION_ADMIN],
    },
    {
      type: 'NOTICE',
      title: 'Public notice: beware of recruitment fraud',
      summary: 'The Commission does not charge any fee for recruitment and does not operate through agents. Report any demand for payment.',
      body: `The attention of the public is drawn to persons and groups falsely claiming to offer employment in the Kogi State Civil Service in exchange for payment.\n\n## The Commission's position\n\n- **No fee of any kind** is charged for registration, application, screening, examination, interview or appointment.\n- The Commission does **not** operate through agents, consultants or intermediaries.\n- Vacancies are advertised **only** on this portal and through official Commission channels.\n- All official communication comes from an address ending in **@kogicsc.kg.gov.ng**.\n\n## Report fraud\n\nAny person who is approached with a demand for payment should report it immediately to ${'info@kogicsc.kg.gov.ng'} with any evidence available, or to the nearest police station.\n\nThe Commission will prosecute any officer found to have solicited payment.`,
      status: 'PUBLISHED',
      publishedAt: days(-45),
      authorId: staff[ROLES.CONTENT_OFFICER],
    },
    {
      type: 'NEWS',
      title: 'Commission deploys integrated recruitment management portal',
      summary: 'The new portal provides online applications, digital document management, screening, examination and interview administration, reporting and a complete audit trail.',
      body: `The ${'Kogi State Civil Service Commission'} has deployed an integrated Civil Service Recruitment Management System as part of the digital transformation of public service administration in Kogi State.\n\n## What the portal provides\n\n- Online vacancy publication and application\n- Applicant registration, dashboards and application tracking\n- Secure digital document upload, review and verification\n- Screening, shortlisting and approval workflows\n- Examination and interview administration\n- Final selection, recruitment reporting and analytics\n- Role-based access control and a complete audit trail\n\n## Benefits\n\nThe Commission expects improved recruitment administration, greater transparency and accountability, substantially reduced paperwork, faster processing, better management information and a markedly improved applicant experience.\n\nThe platform was developed and deployed by Edumanager Information System Ltd.`,
      status: 'PUBLISHED',
      publishedAt: days(-60),
      authorId: staff[ROLES.CONTENT_OFFICER],
    },
    {
      type: 'NEWS',
      title: 'Promotion exercise for officers on Grade Levels 07 to 12 concluded',
      summary: 'The Commission has concluded the promotion exercise for officers on Grade Levels 07 to 12. Results have been communicated to the relevant ministries.',
      body: `The Commission has concluded its promotion exercise for officers on Grade Levels 07 to 12.\n\nCandidates were assessed on their annual performance evaluation reports, seniority, the availability of vacancies on the approved establishment and performance at the promotion interview, in accordance with the approved criteria.\n\nResults have been communicated to the relevant ministries, departments and agencies for implementation. Officers are advised to direct enquiries through their respective establishment units.`,
      status: 'PUBLISHED',
      publishedAt: days(-75),
      authorId: staff[ROLES.CONTENT_OFFICER],
    },
    {
      type: 'ANNOUNCEMENT',
      title: 'Draft: forthcoming teaching service recruitment',
      summary: 'A draft announcement awaiting approval before publication.',
      body: `The Commission is preparing a recruitment exercise for the teaching service in collaboration with the Kogi State Universal Basic Education Board.\n\nThis draft is held pending the confirmation of approved vacancies and the authorisation of the exercise.`,
      status: 'PENDING_APPROVAL',
      publishedAt: null,
      authorId: staff[ROLES.CONTENT_OFFICER],
    },
  ];

  for (const a of articles) {
    await prisma.article.create({
      data: {
        type: a.type, title: a.title, slug: slugify(a.title), summary: a.summary,
        body: a.body, status: a.status, publishedAt: a.publishedAt,
        authorId: a.authorId,
        publishedById: a.status === 'PUBLISHED' ? staff[ROLES.COMMISSION_ADMIN] : null,
        viewCount: a.status === 'PUBLISHED' ? Math.floor(rand() * 2400) + 120 : 0,
      },
    });
  }
  // The draft awaiting approval has a live approval request.
  const pendingArticle = await prisma.article.findFirst({ where: { status: 'PENDING_APPROVAL' } });
  if (pendingArticle) {
    await prisma.approvalRequest.create({
      data: {
        entityType: 'ARTICLE', entityId: pendingArticle.id, action: 'PUBLISH_CONTENT',
        requestedById: staff[ROLES.CONTENT_OFFICER], requestedByName: 'Victor K. Ogbaji',
        note: 'Awaiting confirmation of approved vacancies from SUBEB before publication.',
      },
    });
  }
  console.log(`  ✓ ${articles.length} news items, circulars and notices`);

  // -------------------------------------------------------------------------
  // MODULE 1 - Downloads (small generated PDFs so the files really exist)
  // -------------------------------------------------------------------------
  const { mkdir, writeFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const uploadRoot = path.resolve(process.env.UPLOAD_DIR || './storage/uploads');
  const seedDir = path.join(uploadRoot, 'seed');
  await mkdir(seedDir, { recursive: true });

  /** A minimal, valid single-page PDF. */
  function makePdf(title: string, lines: string[]): Buffer {
    const esc = (s: string) => s.replace(/([()\\])/g, '\\$1');
    const content = [
      'BT /F1 16 Tf 56 760 Td (' + esc(title) + ') Tj ET',
      ...lines.map((l, i) => `BT /F1 10 Tf 56 ${730 - i * 16} Td (${esc(l)}) Tj ET`),
    ].join('\n');
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];
    objects.forEach((o, i) => {
      offsets.push(pdf.length);
      pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
    });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const o of offsets) pdf += `${String(o).padStart(10, '0')} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(pdf, 'latin1');
  }

  const downloads = [
    { title: 'Application Guidelines — 2026 Civil Service Recruitment Exercise', category: 'GUIDELINE', description: 'Step-by-step guidance on registering, completing the application form and uploading documents.', lines: ['1. Create an applicant account on the Commission portal.', '2. Complete your personal and contact details in full.', '3. Select the position you wish to apply for.', '4. Enter your qualifications and employment history.', '5. Upload every required document, clearly scanned.', '6. Confirm the declaration and submit before the closing date.', '', 'No payment of any kind is required at any stage.'] },
    { title: 'Approved Application Form (offline reference copy)', category: 'FORM', description: 'A reference copy of the fields captured by the online application form. Applications are accepted online only.', lines: ['Section A — Personal information', 'Section B — Contact details', 'Section C — State and Local Government of origin', 'Section D — Educational and professional qualifications', 'Section E — Employment history and experience', 'Section F — Referees', 'Section G — Next of kin', 'Section H — Declaration and consent'] },
    { title: 'Guide to Required Documents', category: 'GUIDELINE', description: 'The documents required in support of an application, with accepted formats and size limits.', lines: [] },
    { title: 'Circular KGCSC/CIR/2026/004 — Verification of Credentials', category: 'CIRCULAR', description: 'Circular to all ministries, departments and agencies on the verification of credentials before assumption of duty.', lines: ['All credentials must be verified with the awarding institution', 'before the officer assumes duty.', '', 'Appointments are made subject to verification of credentials.'] },
    { title: 'Commission Annual Report (extract)', category: 'PUBLICATION', description: 'Extract from the Commission\'s annual report covering recruitment, promotion and discipline activity.', lines: ['Recruitment exercises conducted', 'Promotion exercises concluded', 'Disciplinary cases considered', 'Workforce statistics by cadre and grade level'] },
  ] as Array<{ title: string; category: string; description: string; lines: string[] }>;
  downloads[2].lines = [
    'Passport photograph (JPEG or PNG, up to 2MB)',
    'Birth certificate or declaration of age (PDF or image, up to 5MB)',
    'Evidence of National Identification Number (up to 5MB)',
    'Educational certificates (PDF or image, up to 8MB)',
    'NYSC discharge or exemption certificate where applicable',
    'Professional certificates where applicable',
    'Certificate of State or Local Government of origin',
    '',
    'Scan documents clearly. Unreadable documents are returned for correction.',
  ];

  for (const d of downloads) {
    const buf = makePdf(d.title, d.lines);
    const storedName = `seed/${slugify(d.title)}.pdf`;
    await writeFile(path.join(uploadRoot, storedName), buf);
    await prisma.downloadItem.create({
      data: {
        title: d.title, description: d.description, category: d.category,
        storedName, originalName: `${slugify(d.title)}.pdf`,
        mimeType: 'application/pdf', sizeBytes: buf.length,
        downloads: Math.floor(rand() * 600) + 20, published: true,
      },
    });
  }
  console.log(`  ✓ ${downloads.length} downloadable documents`);

  // -------------------------------------------------------------------------
  // MODULE 2.1 - Recruitment exercises
  // -------------------------------------------------------------------------
  const exercise = await prisma.recruitmentExercise.create({
    data: {
      title: '2026 Kogi State Civil Service Recruitment Exercise',
      reference: 'KGCSC/REC/2026/001',
      description: `The ${'Kogi State Civil Service Commission'} invites applications from suitably qualified candidates for appointment into the Kogi State Civil Service.\n\nA total of 148 approved positions are advertised across six cadres, from Grade Level 06 to Grade Level 09, in the Commission's departments and in participating ministries, departments and agencies.\n\nOnly shortlisted candidates will be invited to the written aptitude test. **No payment of any kind is required** at any stage of this exercise.`,
      eligibility: `Applicants must satisfy **all** of the following:\n\n- Be a Nigerian citizen, with preference given to indigenes of Kogi State in accordance with approved quotas.\n- Hold the minimum qualification stated for the position applied for.\n- Be between the ages stated for the position applied for as at the closing date.\n- Have completed the National Youth Service programme, or hold a valid exemption or exclusion certificate, where applicable to the qualification held.\n- Be of good character and not have been convicted of any criminal offence.\n- Be certified medically fit for appointment into the public service.\n\nApplicants already in the Kogi State Civil Service should apply through their establishment units.`,
      guidelines: `## How to apply\n\n1. Create an applicant account on this portal. You need only one account.\n2. Complete your personal and contact details in full, including your State and Local Government Area of origin.\n3. Select **one** position from the advertised vacancies.\n4. Complete the application form: qualifications, employment history, referees and next of kin.\n5. Upload every required document, clearly scanned.\n6. Read and confirm the declaration and the data-processing consent, then submit.\n\n## After submission\n\nYou receive an acknowledgement with a unique application reference. Keep it safe. Your dashboard shows the progress of your application at every stage.\n\n## Document standards\n\n- Scan or photograph documents so that all text is legible.\n- PDF is preferred for certificates; JPEG or PNG for the passport photograph.\n- Observe the size limit stated for each document.\n- Where an officer requests a correction, re-upload the affected document before the closing date.\n\n## Important\n\n- Each applicant may submit **one** application to this exercise.\n- Late applications cannot be accepted; the portal closes automatically on the closing date.\n- **No payment of any kind is required.** Report any demand for payment to the Commission.\n- Giving false information is grounds for disqualification and for the withdrawal of any appointment made.`,
      status: EXERCISE_STATUS.PUBLISHED,
      opensAt: days(-30),
      closesAt: days(12),
      maxApplications: 1,
      requireExam: true,
      requireInterview: true,
      createdById: staff[ROLES.RECRUITMENT_OFFICER],
      approvedById: staff[ROLES.RECRUITMENT_DIRECTOR],
      approvedAt: days(-32),
      publishedAt: days(-30),
    },
  });

  await prisma.approvalRequest.create({
    data: {
      entityType: 'EXERCISE', entityId: exercise.id, exerciseId: exercise.id,
      action: 'APPROVE_EXERCISE', requestedById: staff[ROLES.RECRUITMENT_OFFICER],
      requestedByName: 'Daniel E. Ameh', status: 'APPROVED',
      decidedById: staff[ROLES.RECRUITMENT_DIRECTOR], decidedByName: 'Grace A. Onoja',
      decidedAt: days(-32), note: 'Approved vacancies confirmed with the Office of the Head of Service.',
      createdAt: days(-34),
    },
  });

  // A second exercise awaiting approval, and a closed historical one.
  const draftExercise = await prisma.recruitmentExercise.create({
    data: {
      title: 'Kogi State Teaching Service Recruitment Exercise (2026)',
      reference: 'KGCSC/REC/2026/002',
      description: 'A recruitment exercise for the teaching service, conducted in collaboration with the Kogi State Universal Basic Education Board. Approved vacancies are being confirmed.',
      eligibility: 'Minimum of NCE for primary level and B.Ed, B.Sc (Ed) or B.A (Ed) for secondary level. Registration with the Teachers Registration Council of Nigeria is an added advantage.',
      status: EXERCISE_STATUS.PENDING_APPROVAL,
      opensAt: days(20),
      closesAt: days(62),
      maxApplications: 1,
      requireExam: true,
      requireInterview: true,
      createdById: staff[ROLES.RECRUITMENT_OFFICER],
    },
  });
  await prisma.approvalRequest.create({
    data: {
      entityType: 'EXERCISE', entityId: draftExercise.id, exerciseId: draftExercise.id,
      action: 'APPROVE_EXERCISE', requestedById: staff[ROLES.RECRUITMENT_OFFICER],
      requestedByName: 'Daniel E. Ameh',
      note: 'Submitted for approval. Vacancy schedule attached from SUBEB.',
    },
  });

  const closedExercise = await prisma.recruitmentExercise.create({
    data: {
      title: '2024 Civil Service Recruitment Exercise',
      reference: 'KGCSC/REC/2024/001',
      description: 'Concluded recruitment exercise for appointment into the Kogi State Civil Service. Records retained for reference.',
      status: EXERCISE_STATUS.CLOSED,
      opensAt: days(-700),
      closesAt: days(-640),
      createdById: staff[ROLES.RECRUITMENT_OFFICER],
      approvedById: staff[ROLES.RECRUITMENT_DIRECTOR],
      approvedAt: days(-710),
      publishedAt: days(-700),
      closedAt: days(-640),
      requireExam: true,
      requireInterview: true,
    },
  });
  await prisma.vacancy.create({
    data: {
      exerciseId: closedExercise.id, jobTitle: 'Administrative Officer II', gradeLevel: 'GL 08',
      departmentId: departments.DAS,
      ministryId: establishment.ministries.HOS,
      positions: 20,
      qualifications: 'A degree (B.Sc, B.A) from a recognised university in any discipline, plus NYSC discharge or exemption certificate.',
      experience: 'No previous experience required.', minAge: 18, maxAge: 35,
    },
  });

  // -------------------------------------------------------------------------
  // Vacancies for the live exercise
  // -------------------------------------------------------------------------
  const vacancySpecs = [
    { jobTitle: 'Administrative Officer II', gradeLevel: 'GL 08', dept: 'DAS', mda: 'HOS', mdaDept: 'Establishment and Records', positions: 35, qualifications: 'A degree (B.Sc, B.A) from a recognised university in any discipline, plus NYSC discharge or exemption certificate.', experience: 'No previous experience required.', minAge: 18, maxAge: 35, description: 'Provides general administrative support, handles correspondence, maintains records and services committee meetings.' },
    { jobTitle: 'Accountant II', gradeLevel: 'GL 08', dept: 'DFA', mda: 'MOF', mdaDept: 'Treasury', positions: 18, qualifications: 'A degree (B.Sc) in Accounting or Accountancy from a recognised university, plus NYSC discharge or exemption certificate. Part qualification of ICAN or ANAN is an added advantage.', experience: 'Minimum of 1 year post-qualification experience is an advantage but not required.', minAge: 18, maxAge: 35, description: 'Maintains accounting records, processes payments, prepares financial returns and assists with budget preparation.' },
    { jobTitle: 'Statistician II', gradeLevel: 'GL 08', dept: 'DPRS', mda: 'MOE', mdaDept: 'Planning, Research and Statistics', positions: 12, qualifications: 'A degree (B.Sc) in Statistics, Mathematics, Economics or a related discipline, plus NYSC discharge or exemption certificate.', experience: 'Minimum of 2 years relevant experience.', minAge: 20, maxAge: 40, description: 'Collects, analyses and reports workforce and operational statistics; maintains the Commission management information.' },
    { jobTitle: 'ICT Officer II', gradeLevel: 'GL 08', dept: 'ICT', mda: 'BIR', mdaDept: 'Taxpayer Services', positions: 10, qualifications: 'A degree (B.Sc) in Computer Science, Information Technology, Computer Engineering or a related discipline, plus NYSC discharge or exemption certificate.', experience: 'Minimum of 2 years relevant experience in systems or network support.', minAge: 20, maxAge: 40, description: 'Supports the Commission portal, systems, networks and digital records; provides user support and maintains data backups.' },
    { jobTitle: 'Confidential Secretary II', gradeLevel: 'GL 07', dept: 'DAS', mda: 'MOH', mdaDept: 'Administration and Supplies', positions: 28, qualifications: 'HND or OND in Secretarial Studies or Office Technology and Management from a recognised institution, with proficiency in shorthand and word processing.', experience: 'No previous experience required.', minAge: 18, maxAge: 35, description: 'Provides secretarial and confidential support to directors and senior officers.' },
    { jobTitle: 'Clerical Officer', gradeLevel: 'GL 06', dept: 'RDU', mda: 'MLG', mdaDept: 'Local Government Administration', positions: 45, qualifications: 'SSCE, WASSCE or NECO with credit passes in at least five subjects including English Language and Mathematics.', experience: 'No previous experience required.', minAge: 18, maxAge: 30, description: 'Handles filing, record keeping, document retrieval and general clerical duties.' },
  ];
  await prisma.recruitmentExercise.update({
    where: { id: exercise.id },
    data: { unitId: establishment.unitId },
  });
  await prisma.recruitmentExercise.update({
    where: { id: closedExercise.id },
    data: { unitId: establishment.unitId },
  });

  const vacancies: Array<{ id: string; jobTitle: string; gradeLevel: string; positions: number }> = [];
  for (const v of vacancySpecs) {
    const rec = await prisma.vacancy.create({
      data: {
        exerciseId: exercise.id, jobTitle: v.jobTitle, gradeLevel: v.gradeLevel,
        departmentId: departments[v.dept],
        ministryId: establishment.ministries[v.mda],
        ministryDeptId: establishment.ministryDepartments[`${v.mda}:${v.mdaDept}`] ?? null,
        positions: v.positions,
        qualifications: v.qualifications, experience: v.experience,
        minAge: v.minAge, maxAge: v.maxAge, description: v.description, active: true,
      },
    });
    vacancies.push({ id: rec.id, jobTitle: v.jobTitle, gradeLevel: v.gradeLevel, positions: v.positions });
  }
  console.log(`  ✓ 3 recruitment exercises, ${vacancySpecs.length} vacancies (${vacancySpecs.reduce((s, v) => s + v.positions, 0)} posts)`);

  // -------------------------------------------------------------------------
  // MODULE 2.4 - Document requirements, and 2.3 custom form fields
  // -------------------------------------------------------------------------
  const requiredCodes = ['PASSPORT_PHOTO', 'BIRTH_CERTIFICATE', 'NIN', 'EDUCATIONAL_CERTIFICATE', 'LGA_CERTIFICATE'];
  const optionalCodes = ['NYSC', 'PROFESSIONAL_CERTIFICATE', 'EMPLOYMENT_RECORD'];
  const requirements: Array<{ id: string; code: string; label: string; required: boolean }> = [];
  for (const [i, code] of [...requiredCodes, ...optionalCodes].entries()) {
    const t = DOCUMENT_TYPES.find((x) => x.code === code)!;
    const rec = await prisma.documentRequirement.create({
      data: {
        exerciseId: exercise.id, code: t.code, label: t.label,
        required: requiredCodes.includes(code),
        description:
          code === 'PASSPORT_PHOTO' ? 'A recent passport photograph with a plain background, taken within the last six months.'
          : code === 'NIN' ? 'Your NIN slip or NIMC card showing your 11-digit National Identification Number.'
          : code === 'EDUCATIONAL_CERTIFICATE' ? 'The certificate for the qualification you are applying with. Combine multiple certificates into one PDF where possible.'
          : code === 'LGA_CERTIFICATE' ? 'Certificate of State or Local Government Area of origin, signed by the appropriate authority.'
          : code === 'NYSC' ? 'Required where your qualification is a degree, HND or NCE.'
          : null,
        maxSizeMb: t.maxMb, acceptTypes: t.accept, position: i,
      },
    });
    requirements.push({ id: rec.id, code: t.code, label: t.label, required: requiredCodes.includes(code) });
  }

  await prisma.formField.createMany({
    data: [
      { exerciseId: exercise.id, section: 'OTHER', key: 'computer_literacy', label: 'Level of computer literacy', inputType: 'select', options: JSON.stringify(['None', 'Basic', 'Intermediate', 'Advanced']), required: true, helpText: 'Be accurate — this is assessed at interview.', position: 0 },
      { exerciseId: exercise.id, section: 'OTHER', key: 'languages', label: 'Nigerian languages spoken', inputType: 'text', required: false, helpText: 'For example: English, Igala, Ebira, Okun, Hausa.', position: 1 },
      { exerciseId: exercise.id, section: 'OTHER', key: 'willing_to_relocate', label: 'Willing to serve anywhere in Kogi State', inputType: 'select', options: JSON.stringify(['Yes', 'No']), required: true, position: 2 },
      { exerciseId: exercise.id, section: 'DECLARATION', key: 'criminal_record', label: 'Have you ever been convicted of a criminal offence?', inputType: 'select', options: JSON.stringify(['No', 'Yes']), required: true, helpText: 'A conviction is not an automatic bar, but failing to declare one is grounds for disqualification.', position: 3 },
    ],
  });

  // -------------------------------------------------------------------------
  // MODULE 2.2 / 2.3 - Applicants and applications at every stage
  // -------------------------------------------------------------------------
  // Target distribution across the ten-stage workflow.
  const plan: Array<{ status: string; count: number }> = [
    { status: A.DRAFT, count: 3 },
    { status: A.SUBMITTED, count: 4 },
    { status: A.UNDER_SCREENING, count: 3 },
    { status: A.RESUBMISSION_REQUIRED, count: 2 },
    { status: A.DISQUALIFIED, count: 3 },
    { status: A.QUALIFIED, count: 4 },
    { status: A.SHORTLISTED, count: 3 },
    { status: A.EXAM_COMPLETED, count: 2 },
    { status: A.INTERVIEW_COMPLETED, count: 4 },
    { status: A.SELECTED, count: 0 },   // produced by the approved selection list
    { status: A.NOT_SELECTED, count: 3 }, // shortlisted, sat the examination, scored below the pass mark
    { status: A.WITHDRAWN, count: 2 },
  ];

  interface Seeded {
    userId: string;
    applicationId: string;
    reference: string;
    status: string;
    vacancyId: string;
    name: string;
    email: string;
    lga: string;
  }
  const seeded: Seeded[] = [];
  let applicantIndex = 0;

  for (const slice of plan) {
    for (let k = 0; k < slice.count; k += 1) {
      applicantIndex += 1;
      const female = rand() < 0.45;
      const surname = SURNAMES[Math.floor(rand() * SURNAMES.length)];
      const firstName = female
        ? FIRST_F[Math.floor(rand() * FIRST_F.length)]
        : FIRST_M[Math.floor(rand() * FIRST_M.length)];
      const middleName = female
        ? FIRST_F[Math.floor(rand() * FIRST_F.length)]
        : FIRST_M[Math.floor(rand() * FIRST_M.length)];
      const lga = KOGI_LGAS[Math.floor(rand() * KOGI_LGAS.length)];
      const email = `applicant${applicantIndex}@example.com`;
      const vacancy = vacancies[Math.floor(rand() * vacancies.length)];
      const ageYears = 22 + Math.floor(rand() * 13);

      const user = await prisma.user.create({
        data: {
          email, passwordHash: ctx.applicantHash,
          fullName: `${surname} ${firstName} ${middleName}`,
          role: ROLES.APPLICANT,
          phone: `080${pad(31000000 + applicantIndex * 7919, 8)}`,
          active: true,
          lastLoginAt: days(-Math.floor(rand() * 20)),
          applicantProfile: {
            create: {
              applicantRef: `KGCSC/APP/2026/${pad(applicantIndex, 6)}`,
              surname, firstName, middleName,
              gender: female ? 'Female' : 'Male',
              dateOfBirth: yearsAgo(ageYears, Math.floor(rand() * 12), 1 + Math.floor(rand() * 27)),
              maritalStatus: rand() < 0.55 ? 'Single' : 'Married',
              nin: pad(10000000000 + applicantIndex * 1234567, 11).slice(0, 11),
              phone: `080${pad(31000000 + applicantIndex * 7919, 8)}`,
              residentialAddress: `${1 + Math.floor(rand() * 90)} ${['Ganaja', 'Lokongoma', 'Felele', 'Adankolo', 'Phase II', 'Crusher'][Math.floor(rand() * 6)]} Road, Lokoja`,
              city: ['Lokoja', 'Okene', 'Anyigba', 'Idah', 'Kabba', 'Ankpa'][Math.floor(rand() * 6)],
              stateOfResidence: 'Kogi',
              stateOfOrigin: 'Kogi',
              lga,
              profileComplete: true,
            },
          },
        },
      });

      const reference = `KGCSC/2026/026001/${pad(applicantIndex, 6)}`;
      const isDraft = slice.status === A.DRAFT;
      const submittedAt = isDraft ? null : days(-25 + Math.floor(rand() * 18));

      const app = await prisma.application.create({
        data: {
          reference, applicantId: user.id, exerciseId: exercise.id, vacancyId: vacancy.id,
          status: slice.status, stage: stageForStatus(slice.status),
          completeness: isDraft ? 60 + Math.floor(rand() * 25) : 100,
          submittedAt,
          withdrawnAt: slice.status === A.WITHDRAWN ? days(-6) : null,
          declaration: !isDraft, consent: !isDraft,
          skills: `Proficient in word processing and spreadsheets. ${rand() < 0.5 ? 'Experienced in records management and filing. ' : ''}Fluent in English and ${['Igala', 'Ebira', 'Okun', 'Bassa', 'Nupe'][Math.floor(rand() * 5)]}.`,
          extraData: JSON.stringify({
            computer_literacy: ['Basic', 'Intermediate', 'Advanced'][Math.floor(rand() * 3)],
            languages: `English, ${['Igala', 'Ebira', 'Okun'][Math.floor(rand() * 3)]}`,
            willing_to_relocate: 'Yes',
            criminal_record: 'No',
          }),
          education: {
            create: [
              {
                institution: INSTITUTIONS[Math.floor(rand() * INSTITUTIONS.length)],
                qualification: vacancy.gradeLevel === 'GL 06'
                  ? 'SSCE/WASSCE/NECO'
                  : vacancy.gradeLevel === 'GL 07'
                    ? (rand() < 0.5 ? 'HND' : 'OND')
                    : 'B.Sc / B.A / B.Eng',
                course: COURSES[Math.floor(rand() * COURSES.length)],
                grade: ['Second Class Upper', 'Second Class Lower', 'Upper Credit', 'Credit', 'Distinction'][Math.floor(rand() * 5)],
                startYear: new Date().getFullYear() - ageYears + 18,
                endYear: new Date().getFullYear() - ageYears + 22,
                certificateNo: `CERT/${pad(100000 + applicantIndex * 31, 6)}`,
                position: 0,
              },
              ...(rand() < 0.3
                ? [{
                    institution: 'Chartered Institute of Personnel Management of Nigeria',
                    qualification: 'Professional Certification',
                    course: 'Human Resource Management',
                    grade: 'Associate',
                    startYear: new Date().getFullYear() - 3,
                    endYear: new Date().getFullYear() - 2,
                    position: 1,
                  }]
                : []),
            ],
          },
          employment: {
            create: rand() < 0.7
              ? [{
                  employer: EMPLOYERS[Math.floor(rand() * EMPLOYERS.length)],
                  jobTitle: ['Administrative Assistant', 'Accounts Clerk', 'Corps Member', 'Data Entry Officer', 'Teacher'][Math.floor(rand() * 5)],
                  responsibilities: 'Records management, correspondence handling, data entry and general administrative support.',
                  startDate: days(-(400 + Math.floor(rand() * 900))),
                  endDate: rand() < 0.4 ? null : days(-(30 + Math.floor(rand() * 200))),
                  current: rand() < 0.4,
                  position: 0,
                }]
              : [],
          },
          referees: {
            create: isDraft
              ? []
              : [
                  {
                    name: `${['Mr.', 'Mrs.', 'Dr.', 'Engr.'][Math.floor(rand() * 4)]} ${SURNAMES[Math.floor(rand() * SURNAMES.length)]} ${FIRST_M[Math.floor(rand() * FIRST_M.length)]}`,
                    occupation: ['Civil Servant', 'Lecturer', 'Banker', 'Head Teacher'][Math.floor(rand() * 4)],
                    organisation: EMPLOYERS[Math.floor(rand() * EMPLOYERS.length)],
                    email: `referee${applicantIndex}@example.com`,
                    phone: `0803${pad(1000000 + applicantIndex * 97, 7)}`,
                    address: 'Lokoja, Kogi State',
                  },
                ],
          },
          ...(isDraft
            ? {}
            : {
                nextOfKin: {
                  create: {
                    name: `${surname} ${FIRST_F[Math.floor(rand() * FIRST_F.length)]}`,
                    relationship: ['Spouse', 'Parent', 'Sibling'][Math.floor(rand() * 3)],
                    phone: `0806${pad(2000000 + applicantIndex * 53, 7)}`,
                    email: `nok${applicantIndex}@example.com`,
                    address: 'Lokoja, Kogi State',
                  },
                },
              }),
        },
      });

      // Documents. Drafts are missing one required document.
      const docCodes = isDraft
        ? requirements.filter((r) => r.required).slice(0, 3)
        : requirements.filter((r) => r.required || rand() < 0.5);
      for (const req of docCodes) {
        const t = DOCUMENT_TYPES.find((x) => x.code === req.code)!;
        const isImage = t.accept.startsWith('image');
        const buf = isImage
          ? Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9])
          : makePdf(`${req.label} — ${surname} ${firstName}`, [
              `Applicant: ${surname} ${firstName} ${middleName}`,
              `Application reference: ${reference}`,
              `Document: ${req.label}`,
              '',
              'This is seeded sample content for demonstration purposes.',
            ]);
        const storedName = `seed/docs/${pad(applicantIndex, 4)}-${req.code.toLowerCase()}${isImage ? '.jpg' : '.pdf'}`;
        await mkdir(path.join(uploadRoot, 'seed/docs'), { recursive: true });
        await writeFile(path.join(uploadRoot, storedName), buf);

        const reviewStatus =
          slice.status === A.RESUBMISSION_REQUIRED && req.code === 'EDUCATIONAL_CERTIFICATE'
            ? 'RESUBMISSION_REQUIRED'
            : [A.QUALIFIED, A.SHORTLISTED, A.EXAM_COMPLETED, A.INTERVIEW_COMPLETED, A.NOT_SELECTED].includes(slice.status as never)
              ? 'VERIFIED'
              : slice.status === A.DISQUALIFIED && rand() < 0.4
                ? 'REJECTED'
                : isDraft || slice.status === A.SUBMITTED
                  ? 'PENDING'
                  : rand() < 0.6 ? 'VERIFIED' : 'PENDING';

        const doc = await prisma.applicantDocument.create({
          data: {
            applicationId: app.id, requirementId: req.id, docType: req.code, label: req.label,
            storedName, originalName: `${req.code.toLowerCase()}${isImage ? '.jpg' : '.pdf'}`,
            mimeType: isImage ? 'image/jpeg' : 'application/pdf',
            sizeBytes: buf.length, reviewStatus,
            reviewNotes:
              reviewStatus === 'RESUBMISSION_REQUIRED'
                ? 'The certificate uploaded is not legible. Please upload a clearer scan showing the certificate number and the awarding institution.'
                : reviewStatus === 'REJECTED'
                  ? 'The document uploaded does not correspond to the requirement stated.'
                  : null,
            reviewedById: ['VERIFIED', 'REJECTED', 'RESUBMISSION_REQUIRED'].includes(reviewStatus)
              ? staff[ROLES.DOCUMENT_OFFICER]
              : null,
            reviewedAt: ['VERIFIED', 'REJECTED', 'RESUBMISSION_REQUIRED'].includes(reviewStatus) ? days(-10) : null,
          },
        });
        if (['VERIFIED', 'REJECTED', 'RESUBMISSION_REQUIRED'].includes(reviewStatus)) {
          await prisma.documentReview.create({
            data: {
              documentId: doc.id, officerId: staff[ROLES.DOCUMENT_OFFICER],
              outcome: reviewStatus, notes: doc.reviewNotes, createdAt: days(-10),
            },
          });
        }
      }

      // Status history
      // The draft is always started before the application is submitted.
      const startedAt = submittedAt
        ? new Date(submittedAt.getTime() - (1 + Math.floor(rand() * 3)) * 86400_000)
        : days(-4);
      const history: Array<{ to: string; remarks: string; at: Date }> = [
        { to: A.DRAFT, remarks: `Application started for ${vacancy.jobTitle}`, at: startedAt },
      ];
      if (!isDraft && slice.status !== A.WITHDRAWN) {
        history.push({ to: A.SUBMITTED, remarks: 'Application submitted by applicant', at: submittedAt! });
      }
      const screenedAt = submittedAt
        ? new Date(submittedAt.getTime() + 86400_000)
        : days(-14);
      if ([A.UNDER_SCREENING, A.RESUBMISSION_REQUIRED, A.DISQUALIFIED, A.QUALIFIED, A.SHORTLISTED, A.EXAM_COMPLETED, A.INTERVIEW_COMPLETED, A.NOT_SELECTED].includes(slice.status as never)) {
        history.push({ to: A.UNDER_SCREENING, remarks: 'Assigned to Fatima S. Yakubu for screening', at: screenedAt });
      }
      if (slice.status === A.RESUBMISSION_REQUIRED) {
        history.push({ to: A.RESUBMISSION_REQUIRED, remarks: 'Educational certificate is not legible; a clearer scan is required.', at: new Date(screenedAt.getTime() + 86400_000) });
      }
      if (slice.status === A.DISQUALIFIED) {
        history.push({ to: A.DISQUALIFIED, remarks: 'Does not meet the minimum qualification stated for the position applied for.', at: new Date(screenedAt.getTime() + 86400_000) });
      }
      if ([A.QUALIFIED, A.SHORTLISTED, A.EXAM_COMPLETED, A.INTERVIEW_COMPLETED, A.NOT_SELECTED].includes(slice.status as never)) {
        history.push({ to: A.QUALIFIED, remarks: 'Meets all approved criteria for the position.', at: new Date(screenedAt.getTime() + 86400_000) });
      }
      if ([A.SHORTLISTED, A.EXAM_COMPLETED, A.INTERVIEW_COMPLETED, A.NOT_SELECTED].includes(slice.status as never)) {
        history.push({ to: A.SHORTLISTED, remarks: 'Shortlisted under "Shortlist for Written Examination — Batch 1" (approved)', at: new Date(screenedAt.getTime() + 2 * 86400_000) });
      }
      if (slice.status === A.WITHDRAWN) {
        history.push({ to: A.WITHDRAWN, remarks: 'Withdrawn by applicant — accepted another appointment', at: days(-6) });
      }
      for (const h of history) {
        await prisma.applicationStatusHistory.create({
          data: {
            applicationId: app.id, toStatus: h.to, stage: stageForStatus(h.to),
            changedByName: h.to === A.DRAFT || h.to === A.SUBMITTED || h.to === A.WITHDRAWN
              ? `${surname} ${firstName}`
              : 'Fatima S. Yakubu',
            changedById: h.to === A.DRAFT || h.to === A.SUBMITTED || h.to === A.WITHDRAWN
              ? user.id
              : staff[ROLES.SCREENING_OFFICER],
            remarks: h.remarks, createdAt: h.at,
          },
        });
      }

      // Screening assignments and records
      if ([A.UNDER_SCREENING, A.RESUBMISSION_REQUIRED, A.DISQUALIFIED, A.QUALIFIED, A.SHORTLISTED, A.EXAM_COMPLETED, A.INTERVIEW_COMPLETED, A.NOT_SELECTED].includes(slice.status as never)) {
        const officerId = rand() < 0.6 ? staff[ROLES.SCREENING_OFFICER] : ctx.screener2.id;
        const done = slice.status !== A.UNDER_SCREENING;
        await prisma.screeningAssignment.create({
          data: {
            applicationId: app.id, officerId, assignedById: staff[ROLES.RECRUITMENT_OFFICER],
            assignedAt: days(-14), completedAt: done ? days(-11) : null,
          },
        });
        if (done) {
          const passed = [A.QUALIFIED, A.SHORTLISTED, A.EXAM_COMPLETED, A.INTERVIEW_COMPLETED, A.NOT_SELECTED].includes(slice.status as never);
          const resub = slice.status === A.RESUBMISSION_REQUIRED;
          await prisma.screeningRecord.create({
            data: {
              applicationId: app.id, officerId,
              completenessPass: passed || resub,
              eligibilityPass: passed,
              qualificationPass: passed,
              experiencePass: passed,
              documentsPass: passed,
              outcome: passed ? 'PASSED' : resub ? 'RESUBMISSION_REQUIRED' : 'FAILED',
              classification: passed ? 'QUALIFIED' : resub ? 'INCOMPLETE' : 'UNDER_QUALIFIED',
              remarks: passed
                ? 'All approved criteria met. Documents verified against the recruitment requirements.'
                : resub
                  ? 'Educational certificate is not legible. A clearer scan showing the certificate number and awarding institution is required.'
                  : 'Does not meet the minimum qualification stated for the position applied for.',
              createdAt: days(-11),
            },
          });
          await prisma.application.update({
            where: { id: app.id },
            data: {
              screeningOutcome: passed ? 'PASSED' : resub ? 'RESUBMISSION_REQUIRED' : 'FAILED',
              screeningAt: days(-11),
              shortlisted: [A.SHORTLISTED, A.EXAM_COMPLETED, A.INTERVIEW_COMPLETED, A.NOT_SELECTED].includes(slice.status as never),
            },
          });
        }
      }

      // Acknowledgement notification for every submitted application
      if (!isDraft) {
        await prisma.notification.create({
          data: {
            userId: user.id, channel: 'EMAIL', toAddress: email,
            subject: `Application received — ${reference}`,
            body: `Dear ${firstName} ${surname},\n\nYour application to the 2026 Kogi State Civil Service Recruitment Exercise has been received.\n\nApplication reference: ${reference}\nPosition applied for: ${vacancy.jobTitle} (${vacancy.gradeLevel})\n\nPlease retain your application reference. You can track the progress of your application at any time from your applicant dashboard.\n\nKogi State Civil Service Commission`,
            templateCode: 'APPLICATION_ACKNOWLEDGEMENT',
            status: 'SENT', providerRef: 'log-transport',
            sentAt: submittedAt!, createdAt: submittedAt!,
            readAt: rand() < 0.6 ? days(-5) : null,
          },
        });
      }

      seeded.push({
        userId: user.id, applicationId: app.id, reference, status: slice.status,
        vacancyId: vacancy.id, name: `${surname} ${firstName}`, email, lga,
      });
    }
  }
  console.log(`  ✓ ${seeded.length} applicants with applications across every workflow stage`);

  // -------------------------------------------------------------------------
  // MODULE 2.5 - Approved shortlist
  // -------------------------------------------------------------------------
  const shortlistable = seeded.filter((s) =>
    [A.SHORTLISTED, A.EXAM_COMPLETED, A.INTERVIEW_COMPLETED, A.NOT_SELECTED].includes(s.status as never),
  );
  const shortlist = await prisma.shortlist.create({
    data: {
      exerciseId: exercise.id,
      title: 'Shortlist for Written Examination — Batch 1',
      status: 'APPROVED',
      preparedById: staff[ROLES.RECRUITMENT_OFFICER],
      approvedById: staff[ROLES.RECRUITMENT_DIRECTOR],
      approvedAt: days(-9),
      notifiedAt: days(-9),
      createdAt: days(-10),
      entries: {
        create: shortlistable.map((s, i) => ({
          applicationId: s.applicationId, rank: i + 1,
          remarks: 'Meets all approved criteria.',
        })),
      },
    },
  });
  await prisma.approvalRequest.create({
    data: {
      entityType: 'SHORTLIST', entityId: shortlist.id, exerciseId: exercise.id,
      action: 'APPROVE_SHORTLIST', requestedById: staff[ROLES.RECRUITMENT_OFFICER],
      requestedByName: 'Daniel E. Ameh', status: 'APPROVED',
      decidedById: staff[ROLES.RECRUITMENT_DIRECTOR], decidedByName: 'Grace A. Onoja',
      decidedAt: days(-9), createdAt: days(-10),
      note: 'Approved. Candidates to be invited to the written aptitude test.',
    },
  });

  // A second shortlist awaiting approval, to show the queue.
  const qualified = seeded.filter((s) => s.status === A.QUALIFIED);
  if (qualified.length > 0) {
    const pendingShortlist = await prisma.shortlist.create({
      data: {
        exerciseId: exercise.id,
        title: 'Shortlist for Written Examination — Batch 2',
        status: 'PENDING_APPROVAL',
        preparedById: staff[ROLES.RECRUITMENT_OFFICER],
        createdAt: days(-2),
        entries: { create: qualified.map((s, i) => ({ applicationId: s.applicationId, rank: i + 1 })) },
      },
    });
    await prisma.approvalRequest.create({
      data: {
        entityType: 'SHORTLIST', entityId: pendingShortlist.id, exerciseId: exercise.id,
        action: 'APPROVE_SHORTLIST', requestedById: staff[ROLES.RECRUITMENT_OFFICER],
        requestedByName: 'Daniel E. Ameh', createdAt: days(-2),
        note: 'Second batch of qualified candidates, submitted for approval.',
      },
    });
  }
  console.log(`  ✓ 2 shortlists (1 approved with ${shortlistable.length} candidates, 1 awaiting approval)`);

  // -------------------------------------------------------------------------
  // MODULE 2.6 - Examination with centres, attendance and scores
  // -------------------------------------------------------------------------
  const examSchedule = await prisma.examSchedule.create({
    data: {
      exerciseId: exercise.id,
      title: 'Written Aptitude Test — Batch 1',
      examDate: days(-7),
      startTime: '09:00',
      endTime: '11:00',
      totalMarks: 100,
      passMark: 50,
      instructions: 'Candidates must report at least 45 minutes before the reporting time with a valid means of identification and a printed copy of this invitation. Mobile telephones and electronic devices are not permitted in the examination hall.',
      status: 'COMPLETED',
      resultsPublishedAt: days(-5),
      createdById: staff[ROLES.EXAMINATION_OFFICER],
      createdAt: days(-12),
      centres: {
        create: [
          { name: 'Government Science Secondary School, Lokoja', address: 'Felele Road, Lokoja', lga: 'Lokoja', capacity: 400, supervisor: 'Mr. Joseph O. Audu' },
          { name: 'Kogi State Polytechnic, Osara Campus', address: 'Osara, Adavi LGA', lga: 'Adavi', capacity: 300, supervisor: 'Mrs. Patience E. Egwuda' },
          { name: 'Federal Polytechnic, Idah', address: 'Idah, Kogi State', lga: 'Idah', capacity: 250, supervisor: 'Mr. Samuel I. Ocheje' },
          { name: 'Kogi State University, Anyigba', address: 'Anyigba, Dekina LGA', lga: 'Dekina', capacity: 350, supervisor: 'Dr. Ibrahim A. Momoh' },
        ],
      },
    },
    include: { centres: true },
  });

  const examCandidates = seeded.filter((s) =>
    [A.EXAM_COMPLETED, A.INTERVIEW_COMPLETED, A.NOT_SELECTED].includes(s.status as never),
  );
  let examSeq = 0;
  const examScores = new Map<string, number>();
  for (const cand of examCandidates) {
    examSeq += 1;
    const centre =
      examSchedule.centres.find((c) => c.lga === cand.lga) ??
      examSchedule.centres[examSeq % examSchedule.centres.length];
    const belowPassMark = cand.status === A.NOT_SELECTED;
    const absent = !belowPassMark && rand() < 0.1;
    const score = absent
      ? null
      : belowPassMark
        ? Math.round((22 + rand() * 26) * 10) / 10
        : Math.round((58 + rand() * 38) * 10) / 10;
    if (score !== null) examScores.set(cand.applicationId, score);

    await prisma.examCandidate.create({
      data: {
        scheduleId: examSchedule.id, applicationId: cand.applicationId, centreId: centre.id,
        examNumber: `KGE/2026/${pad(examSeq)}`,
        seatNumber: `${centre.name.slice(0, 3).toUpperCase()}-${pad(examSeq, 3)}`,
        attendance: absent ? 'ABSENT' : 'PRESENT',
        score,
        scoreEnteredById: score !== null ? staff[ROLES.EXAMINATION_OFFICER] : null,
        scoreEnteredAt: score !== null ? days(-6) : null,
        validated: true,
        remarks: absent ? 'Did not report to the examination centre.' : null,
        notifiedAt: days(-12),
        createdAt: days(-12),
      },
    });
    if (score !== null) {
      await prisma.application.update({ where: { id: cand.applicationId }, data: { examScore: score } });
    }
    await prisma.applicationStatusHistory.create({
      data: {
        applicationId: cand.applicationId, fromStatus: A.SHORTLISTED, toStatus: A.EXAM_COMPLETED,
        stage: 'EXAMINATION', changedById: staff[ROLES.EXAMINATION_OFFICER],
        changedByName: 'Emmanuel T. Bello',
        remarks: absent ? 'Absent from the written examination' : `Examination completed with a score of ${score}/100`,
        createdAt: days(-6),
      },
    });
    if (belowPassMark) {
      await prisma.applicationStatusHistory.create({
        data: {
          applicationId: cand.applicationId, fromStatus: A.EXAM_COMPLETED, toStatus: A.NOT_SELECTED,
          stage: 'SELECTION', changedById: staff[ROLES.RECRUITMENT_DIRECTOR],
          changedByName: 'Grace A. Onoja',
          remarks: 'Did not attain the pass mark at the written examination and was not carried forward to interview.',
          createdAt: days(-5),
        },
      });
      await prisma.notification.create({
        data: {
          userId: cand.userId, channel: 'EMAIL', toAddress: cand.email,
          subject: `Recruitment outcome — ${cand.reference}`,
          body: `Dear ${cand.name},\n\nThank you for participating in the 2026 Kogi State Civil Service Recruitment Exercise.\n\nAfter careful consideration, your application (${cand.reference}) was not successful on this occasion. We encourage you to apply for future opportunities advertised on the Commission portal.\n\nKogi State Civil Service Commission`,
          templateCode: 'SELECTION_UNSUCCESSFUL', status: 'SENT', providerRef: 'log-transport',
          sentAt: days(-5), createdAt: days(-5),
        },
      });
    }
    await prisma.notification.create({
      data: {
        userId: cand.userId, channel: 'EMAIL', toAddress: cand.email,
        subject: `Examination invitation — KGE/2026/${pad(examSeq)}`,
        body: `Dear ${cand.name},\n\nYou are invited to the written examination for the 2026 Kogi State Civil Service Recruitment Exercise.\n\nExamination number: KGE/2026/${pad(examSeq)}\nDate: ${days(-7).toDateString()}\nReporting time: 09:00\nCentre: ${centre.name}\nAddress: ${centre.address}\n\nPlease arrive at least 45 minutes before the reporting time with a valid means of identification and a printed copy of this invitation.\n\nKogi State Civil Service Commission`,
        templateCode: 'EXAM_INVITATION', status: 'SENT', providerRef: 'log-transport',
        sentAt: days(-12), createdAt: days(-12), readAt: days(-11),
      },
    });
  }

  // A second examination still scheduled, for the next batch.
  await prisma.examSchedule.create({
    data: {
      exerciseId: exercise.id,
      title: 'Written Aptitude Test — Batch 2',
      examDate: days(14), startTime: '09:00', endTime: '11:00',
      totalMarks: 100, passMark: 50,
      instructions: 'Arrangements as for Batch 1. Candidate allocations will be issued once the Batch 2 shortlist is approved.',
      status: 'SCHEDULED',
      createdById: staff[ROLES.EXAMINATION_OFFICER],
      centres: {
        create: [
          { name: 'Government Science Secondary School, Lokoja', address: 'Felele Road, Lokoja', lga: 'Lokoja', capacity: 400, supervisor: 'Mr. Joseph O. Audu' },
        ],
      },
    },
  });
  console.log(`  ✓ 2 centre-based examinations (1 completed with ${examCandidates.length} candidates across ${examSchedule.centres.length} centres)`);

  // -------------------------------------------------------------------------
  // MODULE 2.6 (online) - A computer-based aptitude test open in the portal
  // -------------------------------------------------------------------------
  const cbtSchedule = await prisma.examSchedule.create({
    data: {
      exerciseId: exercise.id,
      title: 'Computer-Based Aptitude Test — Batch 2',
      examDate: days(0),
      startTime: '08:00',
      endTime: '18:00',
      totalMarks: 100,
      passMark: 50,
      mode: 'CBT',
      paperId: establishment.paperId,
      durationMinutes: 45,
      opensAt: days(-1),
      closesAt: days(6),
      instructions:
        'This test is sat online in your applicant portal. You may begin at any time while the test is open. Once you begin, the clock runs for forty-five minutes without stopping, and the test is submitted automatically when the time is up. Ensure you have a steady internet connection and a quiet place before you begin.',
      status: 'ONGOING',
      createdById: staff[ROLES.EXAMINATION_OFFICER],
      createdAt: days(-3),
    },
  });

  /** Draw a candidate's paper the same way the live engine does. */
  async function buildSittingItems(sittingId: string): Promise<Array<{ id: string; marks: number; correctOptionIds: string[] }>> {
    const sections = await prisma.examPaperSection.findMany({
      where: { paperId: establishment.paperId },
      orderBy: { position: 'asc' },
    });
    const used: string[] = [];
    const created: Array<{ id: string; marks: number; correctOptionIds: string[] }> = [];
    let position = 0;

    for (const section of sections) {
      if (!section.bankId || !section.drawCount) continue;
      const pool = await prisma.question.findMany({
        where: { bankId: section.bankId, active: true, id: { notIn: used } },
        include: { options: { orderBy: { position: 'asc' } } },
        take: section.drawCount,
      });
      for (const q of pool) {
        used.push(q.id);
        position += 1;
        const item = await prisma.examSittingQuestion.create({
          data: {
            sittingId,
            questionId: q.id,
            sectionTitle: section.title,
            position,
            marks: section.marksPerQuestion,
            optionOrder: q.options.map((o) => o.id).join(','),
          },
        });
        created.push({
          id: item.id,
          marks: section.marksPerQuestion,
          correctOptionIds: q.options.filter((o) => o.correct).map((o) => o.id),
        });
      }
    }
    return created;
  }

  // Shortlisted candidates first, then qualified candidates, so there are
  // always sittings a reviewer can actually open and attempt.
  const cbtPool = [
    ...seeded.filter((s) => s.status === A.SHORTLISTED),
    ...seeded.filter((s) => s.status === A.QUALIFIED),
  ].slice(0, 12);
  let cbtSeq = 500;
  let cbtSubmitted = 0;

  for (const [index, cand] of cbtPool.entries()) {
    cbtSeq += 1;
    const examNumber = `KGE/2026/${pad(cbtSeq)}`;
    const candidate = await prisma.examCandidate.create({
      data: {
        scheduleId: cbtSchedule.id,
        applicationId: cand.applicationId,
        examNumber,
        attendance: 'PENDING',
        notifiedAt: days(-2),
        createdAt: days(-2),
      },
    });

    // The first three candidates have already sat and submitted the test; the
    // rest have the test released but not yet started, so it can be sat here.
    const alreadySat = index < 2;
    const sitting = await prisma.examSitting.create({
      data: {
        candidateId: candidate.id,
        paperId: establishment.paperId,
        status: 'NOT_STARTED',
      },
    });

    if (alreadySat) {
      const items = await buildSittingItems(sitting.id);
      const startedAt = days(-1);
      const expiresAt = new Date(startedAt.getTime() + 45 * 60_000);
      const submittedAt = new Date(startedAt.getTime() + (28 + index * 4) * 60_000);

      // A plausible performance: most answers correct, a few wrong or blank.
      let raw = 0;
      let answered = 0;
      for (const [i, item] of items.entries()) {
        const leaveBlank = i % 11 === 10;
        if (leaveBlank) continue;
        const answerCorrectly = (i + index) % 4 !== 0;
        const chosen = answerCorrectly
          ? item.correctOptionIds[0]
          : (await prisma.questionOption.findFirst({
              where: { questionId: (await prisma.examSittingQuestion.findUniqueOrThrow({ where: { id: item.id }, select: { questionId: true } })).questionId, correct: false },
              select: { id: true },
            }))?.id;
        if (!chosen) continue;
        answered += 1;
        const correct = item.correctOptionIds.includes(chosen);
        if (correct) raw += item.marks;
        await prisma.examSittingQuestion.update({
          where: { id: item.id },
          data: {
            selected: chosen,
            correct,
            awarded: correct ? item.marks : 0,
            answeredAt: new Date(startedAt.getTime() + (i + 1) * 45_000),
          },
        });
      }

      const total = items.reduce((t, i) => t + i.marks, 0);
      const percentage = total > 0 ? Math.round((raw / total) * 1000) / 10 : 0;
      const scaled = Math.round(percentage * 10) / 10; // the schedule is marked out of 100

      await prisma.examSitting.update({
        where: { id: sitting.id },
        data: {
          status: 'SUBMITTED',
          startedAt,
          expiresAt,
          submittedAt,
          submittedBy: 'CANDIDATE',
          totalMarks: total,
          rawScore: raw,
          percentage,
          answeredCount: answered,
          autoMarkedAt: submittedAt,
          ipAddress: '197.210.0.1',
          userAgent: 'Mozilla/5.0 (seed data)',
        },
      });
      await prisma.examCandidate.update({
        where: { id: candidate.id },
        data: {
          attendance: 'PRESENT',
          score: scaled,
          scoreEnteredAt: submittedAt,
          validated: false,
          remarks: `Marked automatically: ${raw} of ${total} (${percentage}%)`,
        },
      });
      await prisma.application.update({
        where: { id: cand.applicationId },
        data: { examScore: scaled },
      });
      cbtSubmitted += 1;
    }

    await prisma.notification.create({
      data: {
        userId: cand.userId,
        channel: 'EMAIL',
        toAddress: cand.email,
        subject: `Online aptitude test — ${examNumber}`,
        body: `Dear ${cand.name},\n\nYou are invited to sit the computer-based aptitude test for the 2026 Kogi State Civil Service Recruitment Exercise.\n\nExamination number: ${examNumber}\nThe test is open from ${days(-1).toDateString()} until ${days(6).toDateString()}.\nTime allowed once you begin: 45 minutes.\n\nSign in to the applicant portal and open "Tests and Examinations" to begin. Ensure you have a steady internet connection before you start; the clock does not stop once the test has begun.\n\nKogi State Civil Service Commission`,
        templateCode: 'EXAM_INVITATION',
        status: 'SENT',
        providerRef: 'log-transport',
        sentAt: days(-2),
        createdAt: days(-2),
      },
    });
  }
  console.log(`  ✓ 1 computer-based aptitude test released to ${cbtPool.length} candidates (${cbtSubmitted} already submitted, ${cbtPool.length - cbtSubmitted} awaiting their sitting)`);


  // -------------------------------------------------------------------------
  // MODULE 2.7 - Interview with panels and panel scores
  // -------------------------------------------------------------------------
  const criteria = [...DEFAULT_INTERVIEW_CRITERIA];
  const interview = await prisma.interviewSchedule.create({
    data: {
      exerciseId: exercise.id,
      title: 'Oral Interview — Batch 1',
      interviewDate: days(-3),
      startTime: '09:00',
      endTime: '16:00',
      venue: 'Commission Conference Room, Civil Service Commission Secretariat, Lokoja',
      slotMinutes: 20,
      totalMarks: criteria.reduce((s, c) => s + c.maxScore, 0),
      passMark: 50,
      criteria: JSON.stringify(criteria),
      status: 'COMPLETED',
      createdById: staff[ROLES.RECRUITMENT_DIRECTOR],
      createdAt: days(-8),
      panels: {
        create: [
          {
            name: 'Panel A',
            roomVenue: 'Conference Room 1',
            members: {
              create: [
                { userId: staff[ROLES.INTERVIEW_PANEL], isChair: true },
                { userId: ctx.extraPanel[0], isChair: false },
                { userId: staff[ROLES.RECRUITMENT_DIRECTOR], isChair: false },
              ],
            },
          },
          {
            name: 'Panel B',
            roomVenue: 'Conference Room 2',
            members: {
              create: [
                { userId: ctx.extraPanel[1], isChair: true },
                { userId: staff[ROLES.COMMISSION_ADMIN], isChair: false },
              ],
            },
          },
        ],
      },
    },
    include: { panels: { include: { members: true } } },
  });

  const interviewed = seeded.filter((s) => s.status === A.INTERVIEW_COMPLETED);
  const interviewScores = new Map<string, number>();
  for (const [i, cand] of interviewed.entries()) {
    const panel = interview.panels[i % interview.panels.length];
    const slotHour = 9 + Math.floor((i * 20) / 60);
    const slotMin = (i * 20) % 60;
    const slotTime = `${pad(slotHour, 2)}:${pad(slotMin, 2)}`;

    const candidate = await prisma.interviewCandidate.create({
      data: {
        scheduleId: interview.id, applicationId: cand.applicationId, panelId: panel.id,
        slotTime, attendance: 'PRESENT', notifiedAt: days(-7), createdAt: days(-7),
      },
    });

    const memberTotals: number[] = [];
    for (const member of panel.members) {
      const scores: Record<string, number> = {};
      let total = 0;
      for (const c of criteria) {
        const v = Math.round((c.maxScore * (0.55 + rand() * 0.42)) * 2) / 2;
        scores[c.key] = Math.min(v, c.maxScore);
        total += scores[c.key];
      }
      total = Math.round(total * 100) / 100;
      memberTotals.push(total);
      await prisma.interviewScore.create({
        data: {
          candidateId: candidate.id, memberId: member.userId,
          scores: JSON.stringify(scores), total,
          remarks: total >= 70
            ? 'Articulate and well prepared. Good grasp of the responsibilities of the post.'
            : total >= 55
              ? 'Adequate knowledge; would benefit from further exposure.'
              : 'Limited knowledge of the responsibilities of the post.',
          createdAt: days(-3),
        },
      });
    }
    const consolidated = Math.round((memberTotals.reduce((a, b) => a + b, 0) / memberTotals.length) * 100) / 100;
    interviewScores.set(cand.applicationId, consolidated);
    await prisma.interviewCandidate.update({
      where: { id: candidate.id }, data: { consolidatedScore: consolidated },
    });
    await prisma.application.update({
      where: { id: cand.applicationId }, data: { interviewScore: consolidated },
    });
    await prisma.applicationStatusHistory.create({
      data: {
        applicationId: cand.applicationId, fromStatus: A.EXAM_COMPLETED,
        toStatus: A.INTERVIEW_COMPLETED, stage: 'INTERVIEW',
        changedById: staff[ROLES.RECRUITMENT_DIRECTOR], changedByName: 'Grace A. Onoja',
        remarks: `Interview completed; consolidated score ${consolidated}/${interview.totalMarks}`,
        createdAt: days(-3),
      },
    });
    await prisma.notification.create({
      data: {
        userId: cand.userId, channel: 'EMAIL', toAddress: cand.email,
        subject: `Interview invitation — ${cand.reference}`,
        body: `Dear ${cand.name},\n\nYou are invited to an interview for the 2026 Kogi State Civil Service Recruitment Exercise.\n\nDate: ${days(-3).toDateString()}\nTime: ${slotTime}\nVenue: ${interview.venue}\n\nPlease bring the originals of all documents uploaded with your application, together with a valid means of identification.\n\nKogi State Civil Service Commission`,
        templateCode: 'INTERVIEW_INVITATION', status: 'SENT', providerRef: 'log-transport',
        sentAt: days(-7), createdAt: days(-7), readAt: days(-6),
      },
    });
  }
  console.log(`  ✓ 1 interview with ${interview.panels.length} panels and ${interviewed.length} candidates assessed`);

  // -------------------------------------------------------------------------
  // MODULE 2.8 - Final selection, approved and notified
  // -------------------------------------------------------------------------
  if (interviewed.length > 0) {
    const scored = interviewed.map((cand) => ({
      ...cand,
      examScore: examScores.get(cand.applicationId) ?? null,
      interviewScore: interviewScores.get(cand.applicationId) ?? null,
      finalScore: finalScore({
        examScore: examScores.get(cand.applicationId) ?? null,
        interviewScore: interviewScores.get(cand.applicationId) ?? null,
        examWeight: 50, interviewWeight: 50,
      }),
    }));
    const ranked = rankEntries(scored);
    const perVacancy = new Map<string, number>();
    for (const v of vacancies) perVacancy.set(v.id, v.positions);

    const selectionList = await prisma.selectionList.create({
      data: {
        exerciseId: exercise.id,
        title: 'Final Selection List — 2026 Recruitment Exercise (Batch 1)',
        status: 'APPROVED',
        examWeight: 50, interviewWeight: 50,
        preparedById: staff[ROLES.RECRUITMENT_OFFICER],
        approvedById: staff[ROLES.RECRUITMENT_DIRECTOR],
        approvedAt: days(-1), notifiedAt: days(-1), createdAt: days(-2),
      },
    });

    let selectedCount = 0;
    for (const entry of ranked) {
      const left = perVacancy.get(entry.vacancyId) ?? 0;
      const outcome = entry.finalScore !== null && left > 0 && entry.finalScore >= 50 ? 'SELECTED' : 'NOT_SELECTED';
      if (outcome === 'SELECTED') {
        perVacancy.set(entry.vacancyId, left - 1);
        selectedCount += 1;
      }
      await prisma.selectionEntry.create({
        data: {
          selectionListId: selectionList.id, applicationId: entry.applicationId,
          examScore: entry.examScore, interviewScore: entry.interviewScore,
          finalScore: entry.finalScore, rank: entry.rank, outcome,
          remarks: outcome === 'SELECTED'
            ? 'Recommended for appointment subject to verification of credentials.'
            : 'Not successful on this occasion.',
        },
      });

      const toStatus = outcome === 'SELECTED' ? A.SELECTED : A.NOT_SELECTED;
      await prisma.application.update({
        where: { id: entry.applicationId },
        data: {
          status: toStatus, stage: 'SELECTION',
          selected: outcome === 'SELECTED', finalScore: entry.finalScore,
        },
      });
      await prisma.applicationStatusHistory.create({
        data: {
          applicationId: entry.applicationId, fromStatus: A.INTERVIEW_COMPLETED,
          toStatus, stage: 'SELECTION',
          changedById: staff[ROLES.RECRUITMENT_DIRECTOR], changedByName: 'Grace A. Onoja',
          remarks: `Recruitment outcome approved under "${selectionList.title}" (rank ${entry.rank})`,
          createdAt: days(-1),
        },
      });
      await prisma.notification.create({
        data: {
          userId: entry.userId, channel: 'EMAIL', toAddress: entry.email,
          subject: `Recruitment outcome — ${entry.reference}`,
          body: outcome === 'SELECTED'
            ? `Dear ${entry.name},\n\nFollowing the conclusion of the 2026 Kogi State Civil Service Recruitment Exercise, we are pleased to inform you that you have been recommended for appointment.\n\nApplication reference: ${entry.reference}\n\nFormal documentation will be issued to you by the Commission. Final appointment remains subject to the approval of the legally authorised government authorities and verification of your credentials.\n\nKogi State Civil Service Commission`
            : `Dear ${entry.name},\n\nThank you for participating in the 2026 Kogi State Civil Service Recruitment Exercise.\n\nAfter careful consideration, your application (${entry.reference}) was not successful on this occasion. We encourage you to apply for future opportunities advertised on the Commission portal.\n\nKogi State Civil Service Commission`,
          templateCode: outcome === 'SELECTED' ? 'SELECTION_SUCCESSFUL' : 'SELECTION_UNSUCCESSFUL',
          status: 'SENT', providerRef: 'log-transport', sentAt: days(-1), createdAt: days(-1),
        },
      });
    }

    await prisma.approvalRequest.create({
      data: {
        entityType: 'SELECTION', entityId: selectionList.id, exerciseId: exercise.id,
        action: 'APPROVE_SELECTION', requestedById: staff[ROLES.RECRUITMENT_OFFICER],
        requestedByName: 'Daniel E. Ameh', status: 'APPROVED',
        decidedById: staff[ROLES.RECRUITMENT_DIRECTOR], decidedByName: 'Grace A. Onoja',
        decidedAt: days(-1), createdAt: days(-2),
        note: 'Approved. Successful candidates to be issued with formal documentation.',
      },
    });
    console.log(`  ✓ Final selection list approved: ${selectedCount} successful, ${ranked.length - selectedCount} unsuccessful`);
  }

  // -------------------------------------------------------------------------
  // MODULE 7 - A sent notification batch
  // -------------------------------------------------------------------------
  const batch = await prisma.notificationBatch.create({
    data: {
      title: 'Reminder: applications close in two weeks',
      channel: 'EMAIL',
      subject: 'Reminder: 2026 recruitment applications close soon',
      body: 'Dear {{name}},\n\nThis is a reminder that applications for the 2026 Kogi State Civil Service Recruitment Exercise close shortly. If you have started an application but not yet submitted it, please complete and submit it before the closing date.\n\nKogi State Civil Service Commission',
      audience: JSON.stringify({ exerciseId: exercise.id, status: 'DRAFT' }),
      totalCount: 3, sentCount: 3, failedCount: 0,
      status: 'SENT',
      createdById: staff[ROLES.RECRUITMENT_OFFICER],
      approvedById: staff[ROLES.RECRUITMENT_DIRECTOR],
      approvedAt: days(-4), sentAt: days(-4), createdAt: days(-4),
    },
  });
  for (const draft of seeded.filter((s) => s.status === A.DRAFT)) {
    await prisma.notification.create({
      data: {
        userId: draft.userId, batchId: batch.id, channel: 'EMAIL', toAddress: draft.email,
        subject: batch.subject,
        body: batch.body.replace('{{name}}', draft.name),
        status: 'SENT', providerRef: 'log-transport', sentAt: days(-4), createdAt: days(-4),
      },
    });
  }

  // A batch awaiting approval
  await prisma.notificationBatch.create({
    data: {
      title: 'Batch 2 examination arrangements',
      channel: 'BOTH',
      subject: 'Written examination arrangements — Batch 2',
      body: 'Dear {{name}},\n\nArrangements for the Batch 2 written examination will be communicated to you once the shortlist has been approved.\n\nKogi State Civil Service Commission',
      audience: JSON.stringify({ exerciseId: exercise.id, status: A.QUALIFIED }),
      totalCount: qualified.length,
      status: 'PENDING_APPROVAL',
      createdById: staff[ROLES.RECRUITMENT_OFFICER],
      createdAt: days(-1),
    },
  });
  console.log('  ✓ 2 notification batches (1 sent, 1 awaiting approval)');

  // -------------------------------------------------------------------------
  // MODULE 1 - Public enquiries
  // -------------------------------------------------------------------------
  const enquiries = [
    { name: 'Suleiman Abubakar', email: 'suleiman.a@example.com', phone: '08034567890', subject: 'Unable to upload my NYSC certificate', message: 'Good day. I am trying to upload my NYSC discharge certificate but the portal says the file is too large. The scan is 12MB. How can I reduce it? My application reference is KGCSC/2026/026001/000019.', status: 'RESPONDED', response: 'Thank you for contacting the Commission.\n\nThe NYSC certificate requirement accepts files of up to 5MB. Please rescan the certificate at a lower resolution (200 dpi is sufficient) or save it as a PDF, which usually produces a much smaller file than an image.\n\nIf the problem persists after rescanning, reply to this message and an officer will assist you.', respondedAt: days(-8) },
    { name: 'Comfort Ojochegbe', email: 'comfort.o@example.com', phone: '08098765432', subject: 'Can I change the position I applied for?', message: 'I applied for Clerical Officer but I now realise I qualify for Administrative Officer II. Can I change my application?', status: 'RESPONDED', response: 'Thank you for contacting the Commission.\n\nEach applicant may submit one application to this exercise, and a submitted application cannot be changed. If you have not yet submitted, you may withdraw the draft and start a new application for the position you prefer.\n\nIf you have already submitted, your application will be screened against the position you selected.', respondedAt: days(-6) },
    { name: 'Emmanuel Adaji', email: 'emmanuel.adaji@example.com', phone: '08011223344', subject: 'Request for clarification on age limit', message: 'The Statistician II vacancy states an age range of 20 to 40. I will turn 41 next month. Am I eligible?', status: 'IN_PROGRESS', response: null, respondedAt: null },
    { name: 'Hauwa Ibrahim', email: 'hauwa.i@example.com', phone: '08055667788', subject: 'When will Batch 2 examination results be released?', message: 'I sat the written examination in Batch 1 and can see my score. When will the Batch 2 examination take place?', status: 'NEW', response: null, respondedAt: null },
    { name: 'Daniel Okoh', email: 'daniel.okoh@example.com', subject: 'Someone is asking me for money for this recruitment', message: 'A man contacted me claiming he works for the Commission and can secure me a place for two hundred thousand naira. I want to report this.', status: 'NEW', response: null, respondedAt: null },
  ];
  for (const [i, e] of enquiries.entries()) {
    await prisma.enquiry.create({
      data: {
        reference: `ENQ/2026/${pad(100 + i, 6)}`,
        name: e.name, email: e.email, phone: e.phone ?? null,
        subject: e.subject, message: e.message, status: e.status,
        response: e.response, respondedAt: e.respondedAt,
        respondedById: e.response ? staff[ROLES.CONTENT_OFFICER] : null,
        createdAt: days(-12 + i * 2),
      },
    });
  }
  console.log(`  ✓ ${enquiries.length} public enquiries`);

  // -------------------------------------------------------------------------
  // MODULE 4 - Tasks, correspondence and document repository
  // -------------------------------------------------------------------------
  const tasks = [
    { title: 'Confirm Batch 2 examination centre availability', description: 'Write to the four proposed centres to confirm availability for the Batch 2 written examination and obtain written acceptance.', assignee: ROLES.EXAMINATION_OFFICER, dept: 'EAU', priority: 'HIGH', status: 'IN_PROGRESS', dueDate: days(5) },
    { title: 'Verify credentials of successful Batch 1 candidates', description: 'Write to the awarding institutions to confirm the certificates presented by every successful candidate before formal documentation is issued.', assignee: ROLES.DOCUMENT_OFFICER, dept: 'RDU', priority: 'URGENT', status: 'OPEN', dueDate: days(3) },
    { title: 'Prepare Batch 2 shortlist for Commission approval', description: 'Finalise the Batch 2 shortlist from qualified applications and submit it for the Director\'s approval.', assignee: ROLES.RECRUITMENT_OFFICER, dept: 'DRA', priority: 'HIGH', status: 'OPEN', dueDate: days(2) },
    { title: 'Publish Batch 1 examination statistics', description: 'Prepare and publish the aggregate examination statistics for the Batch 1 written test.', assignee: ROLES.REPORTING_OFFICER, dept: 'DPRS', priority: 'NORMAL', status: 'OPEN', dueDate: days(9) },
    { title: 'Update the portal FAQ with questions arising from Batch 1', description: 'Review enquiries received during Batch 1 and add the recurring questions to the public FAQ page.', assignee: ROLES.CONTENT_OFFICER, dept: 'PRU', priority: 'LOW', status: 'OPEN', dueDate: days(20) },
    { title: 'Archive 2024 exercise recruitment records', description: 'Complete the archiving of the 2024 recruitment exercise records in accordance with the retention policy.', assignee: ROLES.COMMISSION_ADMIN, dept: 'RDU', priority: 'NORMAL', status: 'DONE', dueDate: days(-10) },
    { title: 'Review document verification backlog', description: 'Clear the outstanding document verification queue before the Batch 2 screening begins.', assignee: ROLES.DOCUMENT_OFFICER, dept: 'RDU', priority: 'HIGH', status: 'IN_PROGRESS', dueDate: days(-2) },
  ];
  for (const t of tasks) {
    await prisma.staffTask.create({
      data: {
        title: t.title, description: t.description,
        assigneeId: staff[t.assignee], createdById: staff[ROLES.COMMISSION_ADMIN],
        departmentId: departments[t.dept], priority: t.priority, status: t.status,
        dueDate: t.dueDate, completedAt: t.status === 'DONE' ? days(-9) : null,
        createdAt: days(-15),
      },
    });
  }

  const correspondence = [
    { direction: 'INCOMING', subject: 'Request for nominal roll of newly appointed officers', party: 'Office of the Head of Service, Kogi State', body: 'The Office of the Head of Service requests the nominal roll of officers appointed under the 2026 recruitment exercise, for inclusion in the State payroll.', classification: 'GENERAL', status: 'ACTIONED' },
    { direction: 'OUTGOING', subject: 'Transmission of approved vacancy schedule — 2026 exercise', party: 'Ministry of Finance, Budget and Economic Planning', body: 'Transmission of the approved vacancy schedule for the 2026 recruitment exercise, for budgetary provision.', classification: 'GENERAL', status: 'FILED' },
    { direction: 'INCOMING', subject: 'Petition regarding the conduct of the Batch 1 written examination', party: 'Mr. A. Y. (applicant)', body: 'A petition alleging irregularity at one examination centre during the Batch 1 written test. Referred to the Legal Unit for consideration.', classification: 'CONFIDENTIAL', status: 'OPEN' },
    { direction: 'INCOMING', subject: 'Disciplinary case referral — officer in the Ministry of Works', party: 'Ministry of Works and Housing', body: 'Referral of a disciplinary case for the Commission\'s consideration.', classification: 'RESTRICTED', status: 'OPEN' },
    { direction: 'OUTGOING', subject: 'Circular KGCSC/CIR/2026/004 — verification of credentials', party: 'All Permanent Secretaries and Heads of Agency', body: 'Circular issued to all MDAs on the verification of credentials before assumption of duty.', classification: 'GENERAL', status: 'CLOSED' },
  ];
  for (const [i, c] of correspondence.entries()) {
    await prisma.correspondence.create({
      data: {
        reference: `COR/2026/${pad(200 + i, 6)}`,
        direction: c.direction, subject: c.subject, body: c.body, party: c.party,
        classification: c.classification, status: c.status,
        receivedAt: days(-20 + i * 3), handledById: staff[ROLES.COMMISSION_ADMIN],
        createdAt: days(-20 + i * 3),
      },
    });
  }

  const repoDocs = [
    { title: 'Approved vacancy schedule — 2026 recruitment exercise', category: 'RECORD', classification: 'GENERAL', tags: 'vacancies, 2026, establishment', description: 'The schedule of approved vacancies for the 2026 exercise, as confirmed with the Office of the Head of Service.' },
    { title: 'Commission minutes — meeting of 14 January 2026', category: 'MINUTES', classification: 'CONFIDENTIAL', tags: 'minutes, commission, 2026', description: 'Minutes of the Commission meeting at which the 2026 recruitment exercise was authorised.' },
    { title: 'Public Service Rules (extract) — appointments and promotions', category: 'POLICY', classification: 'GENERAL', tags: 'rules, policy, appointments', description: 'Extract from the Public Service Rules governing appointments, confirmations and promotions.' },
    { title: 'Batch 1 examination attendance register', category: 'REPORT', classification: 'CONFIDENTIAL', tags: 'examination, attendance, batch 1', description: 'Signed attendance registers from the four Batch 1 examination centres.' },
    { title: 'Disciplinary case file — Ministry of Works referral', category: 'PERSONNEL', classification: 'RESTRICTED', tags: 'discipline, personnel, restricted', description: 'Case file for a disciplinary matter referred by the Ministry of Works and Housing.' },
    { title: 'Records retention and disposal schedule', category: 'POLICY', classification: 'GENERAL', tags: 'retention, records, data protection', description: 'The Commission\'s approved records retention and disposal schedule.' },
  ];
  for (const d of repoDocs) {
    const buf = makePdf(d.title, [d.description, '', `Classification: ${d.classification}`, `Category: ${d.category}`]);
    const storedName = `seed/repo/${slugify(d.title)}.pdf`;
    await mkdir(path.join(uploadRoot, 'seed/repo'), { recursive: true });
    await writeFile(path.join(uploadRoot, storedName), buf);
    await prisma.repositoryDocument.create({
      data: {
        title: d.title, description: d.description, classification: d.classification,
        category: d.category, tags: d.tags, storedName,
        originalName: `${slugify(d.title)}.pdf`, mimeType: 'application/pdf',
        sizeBytes: buf.length, uploadedById: staff[ROLES.COMMISSION_ADMIN],
        createdAt: days(-25),
      },
    });
  }
  console.log(`  ✓ ${tasks.length} tasks, ${correspondence.length} correspondence records, ${repoDocs.length} repository documents`);

  // -------------------------------------------------------------------------
  // MODULE 8 - Audit trail and login history
  // -------------------------------------------------------------------------
  const auditSeed: Array<{ action: string; actor: string; actorName: string; role: string; entityType: string; summary: string; sensitive: boolean; at: Date }> = [
    { action: 'EXERCISE_CREATED', actor: staff[ROLES.RECRUITMENT_OFFICER], actorName: 'Daniel E. Ameh', role: ROLES.RECRUITMENT_OFFICER, entityType: 'RecruitmentExercise', summary: 'Created recruitment exercise "2026 Kogi State Civil Service Recruitment Exercise" (KGCSC/REC/2026/001)', sensitive: false, at: days(-35) },
    { action: 'EXERCISE_SUBMITTED', actor: staff[ROLES.RECRUITMENT_OFFICER], actorName: 'Daniel E. Ameh', role: ROLES.RECRUITMENT_OFFICER, entityType: 'RecruitmentExercise', summary: 'Exercise submitted for approval with 6 approved vacancies (148 posts)', sensitive: false, at: days(-34) },
    { action: 'EXERCISE_APPROVED', actor: staff[ROLES.RECRUITMENT_DIRECTOR], actorName: 'Grace A. Onoja', role: ROLES.RECRUITMENT_DIRECTOR, entityType: 'RecruitmentExercise', summary: 'Exercise approved; vacancies confirmed with the Office of the Head of Service', sensitive: true, at: days(-32) },
    { action: 'EXERCISE_PUBLISHED', actor: staff[ROLES.RECRUITMENT_DIRECTOR], actorName: 'Grace A. Onoja', role: ROLES.RECRUITMENT_DIRECTOR, entityType: 'RecruitmentExercise', summary: 'Exercise published to the public portal and opened for applications', sensitive: true, at: days(-30) },
    { action: 'CONTENT_PUBLISHED', actor: staff[ROLES.CONTENT_OFFICER], actorName: 'Victor K. Ogbaji', role: ROLES.CONTENT_OFFICER, entityType: 'Article', summary: 'Published announcement "2026 Kogi State Civil Service Recruitment Exercise now open for applications"', sensitive: false, at: days(-30) },
    { action: 'SCREENING_ASSIGNED', actor: staff[ROLES.RECRUITMENT_OFFICER], actorName: 'Daniel E. Ameh', role: ROLES.RECRUITMENT_OFFICER, entityType: 'ScreeningAssignment', summary: 'Assigned 18 applications to Fatima S. Yakubu for screening', sensitive: false, at: days(-14) },
    { action: 'DOCUMENT_REVIEWED', actor: staff[ROLES.DOCUMENT_OFFICER], actorName: 'Blessing O. Adeyemi', role: ROLES.DOCUMENT_OFFICER, entityType: 'ApplicantDocument', summary: 'Educational certificate marked RESUBMISSION_REQUIRED — scan not legible', sensitive: true, at: days(-10) },
    { action: 'SCREENING_RECORDED', actor: staff[ROLES.SCREENING_OFFICER], actorName: 'Fatima S. Yakubu', role: ROLES.SCREENING_OFFICER, entityType: 'Application', summary: 'Screening outcome PASSED (QUALIFIED) recorded', sensitive: true, at: days(-11) },
    { action: 'SHORTLIST_CREATED', actor: staff[ROLES.RECRUITMENT_OFFICER], actorName: 'Daniel E. Ameh', role: ROLES.RECRUITMENT_OFFICER, entityType: 'Shortlist', summary: 'Prepared shortlist "Shortlist for Written Examination — Batch 1"', sensitive: false, at: days(-10) },
    { action: 'SHORTLIST_APPROVED', actor: staff[ROLES.RECRUITMENT_DIRECTOR], actorName: 'Grace A. Onoja', role: ROLES.RECRUITMENT_DIRECTOR, entityType: 'Shortlist', summary: `Shortlist approved; ${shortlistable.length} candidate(s) shortlisted and notified`, sensitive: true, at: days(-9) },
    { action: 'EXAM_CREATED', actor: staff[ROLES.EXAMINATION_OFFICER], actorName: 'Emmanuel T. Bello', role: ROLES.EXAMINATION_OFFICER, entityType: 'ExamSchedule', summary: 'Created examination "Written Aptitude Test — Batch 1" with 4 centres', sensitive: false, at: days(-12) },
    { action: 'EXAM_CANDIDATES_ASSIGNED', actor: staff[ROLES.EXAMINATION_OFFICER], actorName: 'Emmanuel T. Bello', role: ROLES.EXAMINATION_OFFICER, entityType: 'ExamSchedule', summary: `Assigned ${examCandidates.length} candidate(s) to centres and issued examination numbers`, sensitive: false, at: days(-12) },
    { action: 'EXAM_SCORE_RECORDED', actor: staff[ROLES.EXAMINATION_OFFICER], actorName: 'Emmanuel T. Bello', role: ROLES.EXAMINATION_OFFICER, entityType: 'ExamSchedule', summary: `Bulk score upload: ${examScores.size} score(s) applied`, sensitive: true, at: days(-6) },
    { action: 'EXAM_SCORES_VALIDATED', actor: staff[ROLES.EXAMINATION_OFFICER], actorName: 'Emmanuel T. Bello', role: ROLES.EXAMINATION_OFFICER, entityType: 'ExamSchedule', summary: 'Validated examination scores and released results to candidates', sensitive: true, at: days(-5) },
    { action: 'INTERVIEW_PANEL_ASSIGNED', actor: staff[ROLES.RECRUITMENT_DIRECTOR], actorName: 'Grace A. Onoja', role: ROLES.RECRUITMENT_DIRECTOR, entityType: 'InterviewPanel', summary: 'Created interview panels A and B with 5 members in total', sensitive: false, at: days(-8) },
    { action: 'INTERVIEW_SCORE_RECORDED', actor: staff[ROLES.INTERVIEW_PANEL], actorName: 'Dr. Aisha M. Jimoh', role: ROLES.INTERVIEW_PANEL, entityType: 'InterviewCandidate', summary: 'Interview score recorded against the approved assessment framework', sensitive: true, at: days(-3) },
    { action: 'SELECTION_PREPARED', actor: staff[ROLES.RECRUITMENT_OFFICER], actorName: 'Daniel E. Ameh', role: ROLES.RECRUITMENT_OFFICER, entityType: 'SelectionList', summary: 'Prepared final selection list with 50/50 examination and interview weighting', sensitive: false, at: days(-2) },
    { action: 'SELECTION_APPROVED', actor: staff[ROLES.RECRUITMENT_DIRECTOR], actorName: 'Grace A. Onoja', role: ROLES.RECRUITMENT_DIRECTOR, entityType: 'SelectionList', summary: 'Final selection list approved; all candidates notified of their recruitment outcome', sensitive: true, at: days(-1) },
    { action: 'NOTIFICATION_SENT', actor: staff[ROLES.RECRUITMENT_OFFICER], actorName: 'Daniel E. Ameh', role: ROLES.RECRUITMENT_OFFICER, entityType: 'NotificationBatch', summary: 'Dispatched notification batch "Reminder: applications close in two weeks": 3 delivered, 0 failed', sensitive: true, at: days(-4) },
    { action: 'REPORT_EXPORTED', actor: staff[ROLES.REPORTING_OFFICER], actorName: 'Dr. Ibrahim A. Momoh', role: ROLES.REPORTING_OFFICER, entityType: 'Report', summary: 'Recruitment report for KGCSC/REC/2026/001 exported as PDF', sensitive: false, at: days(-2) },
    { action: 'USER_CREATED', actor: staff[ROLES.SUPER_ADMIN], actorName: 'System Administrator', role: ROLES.SUPER_ADMIN, entityType: 'User', summary: 'Created Screening Officer account for Hassan B. Lawal', sensitive: true, at: days(-20) },
    { action: 'PERMISSIONS_CHANGED', actor: staff[ROLES.SUPER_ADMIN], actorName: 'System Administrator', role: ROLES.SUPER_ADMIN, entityType: 'User', summary: 'Additional permissions for Fatima S. Yakubu set to: report.export', sensitive: true, at: days(-18) },
    { action: 'SETTINGS_UPDATED', actor: staff[ROLES.SUPER_ADMIN], actorName: 'System Administrator', role: ROLES.SUPER_ADMIN, entityType: 'SystemSetting', summary: 'Updated 6 data protection settings', sensitive: true, at: days(-22) },
    { action: 'ENQUIRY_RESPONDED', actor: staff[ROLES.CONTENT_OFFICER], actorName: 'Victor K. Ogbaji', role: ROLES.CONTENT_OFFICER, entityType: 'Enquiry', summary: 'Responded to enquiry ENQ/2026/000100 from Suleiman Abubakar', sensitive: false, at: days(-8) },
  ];
  for (const a of auditSeed) {
    await prisma.auditLog.create({
      data: {
        userId: a.actor, actorName: a.actorName, actorRole: a.role,
        action: a.action, entityType: a.entityType,
        summary: a.summary, sensitive: a.sensitive,
        ipAddress: '10.0.0.' + (10 + Math.floor(rand() * 200)),
        createdAt: a.at,
      },
    });
  }

  // Login history, including failed attempts
  for (const role of Object.values(ROLES).filter((r) => r !== ROLES.APPLICANT)) {
    if (!staff[role]) continue;
    for (let i = 0; i < 3; i += 1) {
      await prisma.loginHistory.create({
        data: {
          userId: staff[role], email: `${role.toLowerCase()}@kogicsc.kg.gov.ng`,
          success: true, ipAddress: '10.0.0.' + (10 + Math.floor(rand() * 200)),
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          createdAt: days(-i - 1),
        },
      });
    }
  }
  await prisma.loginHistory.createMany({
    data: [
      { email: 'unknown.person@example.com', success: false, reason: 'UNKNOWN_EMAIL', ipAddress: '197.210.0.44', createdAt: days(-2) },
      { email: 'unknown.person@example.com', success: false, reason: 'UNKNOWN_EMAIL', ipAddress: '197.210.0.44', createdAt: days(-2) },
      { userId: staff[ROLES.SCREENING_OFFICER], email: 'screening.officer@kogicsc.kg.gov.ng', success: false, reason: 'BAD_PASSWORD', ipAddress: '10.0.0.52', createdAt: days(-3) },
    ],
  });
  console.log(`  ✓ ${auditSeed.length} audit records and login history`);
}
