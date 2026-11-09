/**
 * Seed data for the Kogi State Civil Service Commission Portal.
 * Creates institutional content, departments, leadership, FAQs, downloads,
 * one account per role, notification templates, system settings and a
 * complete sample recruitment exercise with applicants at every stage.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  APPLICATION_STATUS, COMMISSION, DEFAULT_INTERVIEW_CRITERIA, DOCUMENT_TYPES,
  EXERCISE_STATUS, KOGI_LGAS, ROLES, ROLE_LABELS, type Role,
} from '../src/lib/constants';
import { DEFAULT_TEMPLATES } from '../src/lib/notification-templates';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'KogiCSC#2026';
const APPLICANT_PASSWORD = 'Applicant#2026';

function slugify(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}
function pad(n: number, w = 6): string {
  return String(n).padStart(w, '0');
}
function daysFromNow(d: number): Date {
  return new Date(Date.now() + d * 86400_000);
}
function yearsAgo(y: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - y);
  return d;
}

async function main() {
  console.log('Seeding the Kogi State Civil Service Commission Portal…');

  // -------------------------------------------------------------------------
  // Clear existing data (seed is idempotent and safe to re-run)
  // -------------------------------------------------------------------------
  await prisma.$transaction([
    prisma.interviewScore.deleteMany(),
    prisma.interviewCandidate.deleteMany(),
    prisma.interviewPanelMember.deleteMany(),
    prisma.interviewPanel.deleteMany(),
    prisma.interviewSchedule.deleteMany(),
    prisma.examCandidate.deleteMany(),
    prisma.examCentre.deleteMany(),
    prisma.examSchedule.deleteMany(),
    prisma.selectionEntry.deleteMany(),
    prisma.selectionList.deleteMany(),
    prisma.shortlistEntry.deleteMany(),
    prisma.shortlist.deleteMany(),
    prisma.documentReview.deleteMany(),
    prisma.applicantDocument.deleteMany(),
    prisma.screeningRecord.deleteMany(),
    prisma.screeningAssignment.deleteMany(),
    prisma.applicationStatusHistory.deleteMany(),
    prisma.nextOfKin.deleteMany(),
    prisma.applicationReferee.deleteMany(),
    prisma.applicationEmployment.deleteMany(),
    prisma.applicationEducation.deleteMany(),
    prisma.application.deleteMany(),
    prisma.formField.deleteMany(),
    prisma.documentRequirement.deleteMany(),
    prisma.vacancy.deleteMany(),
    prisma.approvalRequest.deleteMany(),
    prisma.recruitmentExercise.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.notificationBatch.deleteMany(),
    prisma.notificationTemplate.deleteMany(),
    prisma.articleAttachment.deleteMany(),
    prisma.article.deleteMany(),
    prisma.downloadItem.deleteMany(),
    prisma.faq.deleteMany(),
    prisma.enquiry.deleteMany(),
    prisma.leadershipProfile.deleteMany(),
    prisma.pageContent.deleteMany(),
    prisma.repositoryDocument.deleteMany(),
    prisma.correspondence.deleteMany(),
    prisma.staffTask.deleteMany(),
    prisma.applicantProfile.deleteMany(),
    prisma.userPermission.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.loginHistory.deleteMany(),
    prisma.session.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.user.deleteMany(),
    prisma.department.deleteMany(),
    prisma.systemSetting.deleteMany(),
  ]);

  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const applicantHash = await bcrypt.hash(APPLICANT_PASSWORD, 10);

  // -------------------------------------------------------------------------
  // MODULE 4 - Departments and units
  // -------------------------------------------------------------------------
  const deptSpecs = [
    { name: 'Office of the Chairman', code: 'OC', description: 'Provides overall direction and supervises the implementation of Commission decisions.', headName: 'Barr. Hadiza Y. Suleiman', headTitle: 'Chairman' },
    { name: 'Department of Administration and Supplies', code: 'DAS', description: 'General administration, personnel records, welfare, stores and logistics.', headName: 'Mr. Joseph O. Audu', headTitle: 'Director of Administration' },
    { name: 'Department of Recruitment and Appointments', code: 'DRA', description: 'Plans, advertises and conducts recruitment exercises; processes appointments and confirmations.', headName: 'Mrs. Grace A. Onoja', headTitle: 'Director of Recruitment' },
    { name: 'Department of Promotion and Discipline', code: 'DPD', description: 'Promotion exercises, disciplinary proceedings and related personnel matters.', headName: 'Mr. Samuel I. Ocheje', headTitle: 'Director of Promotion' },
    { name: 'Department of Finance and Accounts', code: 'DFA', description: 'Budget preparation, payments, revenue and financial reporting.', headName: 'Mrs. Patience E. Egwuda', headTitle: 'Director of Finance' },
    { name: 'Department of Planning, Research and Statistics', code: 'DPRS', description: 'Workforce planning, research, statistics and management information.', headName: 'Dr. Ibrahim A. Momoh', headTitle: 'Director of Planning' },
  ];
  const departments: Record<string, string> = {};
  for (const [i, d] of deptSpecs.entries()) {
    const rec = await prisma.department.create({
      data: { ...d, kind: 'DEPARTMENT', position: i, email: `${d.code!.toLowerCase()}@kogicsc.kg.gov.ng`, phone: '+234 800 000 0000' },
    });
    departments[d.code!] = rec.id;
  }

  const unitSpecs = [
    { name: 'Information and Communication Technology Unit', code: 'ICT', parent: 'DAS', description: 'Maintains the Commission portal, systems and digital records.' },
    { name: 'Public Relations Unit', code: 'PRU', parent: 'OC', description: 'Public communication, announcements and media relations.' },
    { name: 'Legal Unit', code: 'LU', parent: 'OC', description: 'Legal advice, compliance and representation.' },
    { name: 'Internal Audit Unit', code: 'IAU', parent: 'DFA', description: 'Internal control, audit and assurance.' },
    { name: 'Examinations and Assessment Unit', code: 'EAU', parent: 'DRA', description: 'Conducts written examinations, assessments and score processing.' },
    { name: 'Records and Documentation Unit', code: 'RDU', parent: 'DAS', description: 'Classification, filing, retrieval and retention of Commission records.' },
  ];
  for (const [i, u] of unitSpecs.entries()) {
    const rec = await prisma.department.create({
      data: {
        name: u.name, code: u.code, kind: 'UNIT', parentId: departments[u.parent],
        description: u.description, position: i,
      },
    });
    departments[u.code] = rec.id;
  }
  console.log(`  ✓ ${deptSpecs.length} departments and ${unitSpecs.length} units`);

  // -------------------------------------------------------------------------
  // MODULE 5 - One account per role
  // -------------------------------------------------------------------------
  const staffSpecs: Array<{ role: Role; fullName: string; email: string; title: string; dept?: string; staffNumber: string }> = [
    { role: ROLES.SUPER_ADMIN, fullName: 'System Administrator', email: 'superadmin@kogicsc.kg.gov.ng', title: 'ICT Systems Administrator', dept: 'ICT', staffNumber: 'KGCSC/ICT/001' },
    { role: ROLES.COMMISSION_ADMIN, fullName: 'Joseph O. Audu', email: 'commission.admin@kogicsc.kg.gov.ng', title: 'Director of Administration', dept: 'DAS', staffNumber: 'KGCSC/DAS/001' },
    { role: ROLES.RECRUITMENT_DIRECTOR, fullName: 'Grace A. Onoja', email: 'recruitment.director@kogicsc.kg.gov.ng', title: 'Director of Recruitment and Appointments', dept: 'DRA', staffNumber: 'KGCSC/DRA/001' },
    { role: ROLES.RECRUITMENT_OFFICER, fullName: 'Daniel E. Ameh', email: 'recruitment.officer@kogicsc.kg.gov.ng', title: 'Principal Recruitment Officer', dept: 'DRA', staffNumber: 'KGCSC/DRA/014' },
    { role: ROLES.SCREENING_OFFICER, fullName: 'Fatima S. Yakubu', email: 'screening.officer@kogicsc.kg.gov.ng', title: 'Senior Screening Officer', dept: 'DRA', staffNumber: 'KGCSC/DRA/022' },
    { role: ROLES.DOCUMENT_OFFICER, fullName: 'Blessing O. Adeyemi', email: 'document.officer@kogicsc.kg.gov.ng', title: 'Document Verification Officer', dept: 'RDU', staffNumber: 'KGCSC/RDU/007' },
    { role: ROLES.EXAMINATION_OFFICER, fullName: 'Emmanuel T. Bello', email: 'examination.officer@kogicsc.kg.gov.ng', title: 'Head, Examinations and Assessment', dept: 'EAU', staffNumber: 'KGCSC/EAU/003' },
    { role: ROLES.INTERVIEW_PANEL, fullName: 'Dr. Aisha M. Jimoh', email: 'panel.one@kogicsc.kg.gov.ng', title: 'Interview Panel Member', dept: 'DPD', staffNumber: 'KGCSC/DPD/011' },
    { role: ROLES.CONTENT_OFFICER, fullName: 'Victor K. Ogbaji', email: 'content.officer@kogicsc.kg.gov.ng', title: 'Public Relations Officer', dept: 'PRU', staffNumber: 'KGCSC/PRU/002' },
    { role: ROLES.REPORTING_OFFICER, fullName: 'Dr. Ibrahim A. Momoh', email: 'reporting.officer@kogicsc.kg.gov.ng', title: 'Director of Planning, Research and Statistics', dept: 'DPRS', staffNumber: 'KGCSC/DPRS/001' },
  ];

  const staff: Record<string, string> = {};
  for (const s of staffSpecs) {
    const u = await prisma.user.create({
      data: {
        email: s.email, passwordHash: hash, fullName: s.fullName, role: s.role,
        title: s.title, staffNumber: s.staffNumber,
        departmentId: s.dept ? departments[s.dept] : null,
        phone: '+234 803 000 0000', active: true, mustChangePassword: false,
        lastLoginAt: new Date(Date.now() - 3600_000),
      },
    });
    staff[s.role] = u.id;
  }

  // Two further panel members so panels can be formed realistically.
  const extraPanel: string[] = [];
  for (const [i, p] of [
    { fullName: 'Hon. Michael A. Onuh', email: 'panel.two@kogicsc.kg.gov.ng', title: 'Commission Member' },
    { fullName: 'Mrs. Ruth N. Abah', email: 'panel.three@kogicsc.kg.gov.ng', title: 'Deputy Director, Promotion' },
  ].entries()) {
    const u = await prisma.user.create({
      data: {
        email: p.email, passwordHash: hash, fullName: p.fullName, role: ROLES.INTERVIEW_PANEL,
        title: p.title, staffNumber: `KGCSC/DPD/0${20 + i}`, departmentId: departments.DPD,
        phone: '+234 803 000 0000', active: true,
      },
    });
    extraPanel.push(u.id);
  }

  // A second screening officer, to demonstrate assignment and workload.
  const screener2 = await prisma.user.create({
    data: {
      email: 'screening.two@kogicsc.kg.gov.ng', passwordHash: hash,
      fullName: 'Hassan B. Lawal', role: ROLES.SCREENING_OFFICER,
      title: 'Screening Officer', staffNumber: 'KGCSC/DRA/031',
      departmentId: departments.DRA, phone: '+234 803 000 0000', active: true,
    },
  });

  // An inactive account, to show deactivation in the register.
  await prisma.user.create({
    data: {
      email: 'former.officer@kogicsc.kg.gov.ng', passwordHash: hash,
      fullName: 'Former Officer (transferred)', role: ROLES.RECRUITMENT_OFFICER,
      title: 'Recruitment Officer', staffNumber: 'KGCSC/DRA/009',
      departmentId: departments.DRA, active: false,
    },
  });

  // An extra per-user permission grant, demonstrating Module 5 fine-grained access.
  await prisma.userPermission.create({
    data: { userId: staff[ROLES.SCREENING_OFFICER], permission: 'report.export' },
  });

  console.log(`  ✓ ${staffSpecs.length + extraPanel.length + 2} staff accounts across all ${Object.keys(ROLE_LABELS).length - 1} staff roles`);

  // -------------------------------------------------------------------------
  // MODULE 1 - Institutional pages
  // -------------------------------------------------------------------------
  const pages = [
    {
      slug: 'homepage',
      title: 'Kogi State Civil Service Commission',
      subtitle: 'A centralised digital platform for Commission administration, transparent recruitment exercises, applicant records, public communication and document management.',
      body: `The ${COMMISSION.name} is responsible for recruitment, appointment, promotion, discipline and other personnel management functions within its approved mandate in the Kogi State Civil Service.\n\nThis portal provides the official digital interface for members of the public, prospective applicants and stakeholders, together with an integrated Civil Service Recruitment Management System used by the Commission to administer approved recruitment exercises end to end.`,
    },
    {
      slug: 'about',
      title: 'The Commission',
      subtitle: 'Profile, mandate, functions and responsibilities.',
      body: `## Profile\n\nThe ${COMMISSION.name} is the body charged with personnel management functions in the Kogi State Civil Service. Its responsibilities cover recruitment, appointment, promotion, discipline and related personnel matters within its approved mandate.\n\nThe Commission is committed to merit, transparency, accountability and due process in every exercise it conducts. Reliable records, transparent processes, accurate documentation and effective communication underpin that commitment.\n\n## Digital transformation\n\nThis portal establishes a centralised digital environment that improves operational efficiency, accountability, records management and applicant experience. Manual and fragmented processes created difficulties in managing high application volumes, screening candidates, retrieving records, tracking recruitment stages, producing timely reports and communicating with applicants. Those processes are now digital, auditable and traceable.`,
    },
    {
      slug: 'mandate',
      title: 'Mandate',
      body: `The Commission exercises the following powers and duties within its approved mandate:\n\n- Appointment of officers into the Kogi State Civil Service in accordance with approved establishment and quotas.\n- Confirmation of appointments and the regularisation of service.\n- Promotion of officers on the basis of merit, vacancy and approved criteria.\n- Discipline of officers in accordance with the Public Service Rules and due process.\n- Transfer, secondment and conversion of officers between cadres and departments.\n- Advising the Government on personnel policy and workforce planning.\n\nThe Commission acts within statutory and administrative procedures. The portal supports recruitment administration and records; it does not independently determine legal eligibility or make statutory recruitment decisions.`,
    },
    {
      slug: 'functions',
      title: 'Functions and Responsibilities',
      body: `## Recruitment and appointment\n\n- Identify and verify approved vacancies with the relevant ministries, departments and agencies.\n- Advertise approved vacancies and publish application guidelines.\n- Receive, screen and shortlist applications against approved criteria.\n- Conduct written examinations and interviews where required.\n- Document recruitment outcomes and recommend successful candidates for appointment.\n\n## Promotion and discipline\n\n- Conduct promotion exercises in accordance with approved criteria and available vacancies.\n- Consider disciplinary cases referred to the Commission and apply due process.\n\n## Records and reporting\n\n- Maintain complete and retrievable personnel and recruitment records.\n- Produce management information and statutory reports.\n- Retain a full history of decisions, approvals and the officers who made them.\n\n## Public communication\n\n- Publish official announcements, circulars and public notices.\n- Receive and respond to public enquiries.\n- Keep applicants informed of the progress of their applications.`,
    },
    {
      slug: 'vision-mission',
      title: 'Vision and Mission',
      body: `## Vision\n\nA professional, merit-based and digitally enabled civil service that earns public confidence.\n\n## Mission\n\nTo recruit, appoint, promote and discipline officers of the Kogi State Civil Service transparently and on merit, supported by reliable digital records and effective communication.\n\n## Core values\n\n- Merit\n- Transparency\n- Accountability\n- Integrity\n- Service`,
    },
    {
      slug: 'recruitment-process',
      title: 'How recruitment works on this portal',
      body: `Every approved recruitment exercise follows the same ten documented stages. At each stage the system records who acted, what they decided and when, so the complete history of the exercise is available to authorised officers.\n\nApplicants create one account, complete their profile once, then apply for any open exercise. Documents are uploaded securely, reviewed by Commission officers, and any deficiency is communicated back to the applicant with the reason and an opportunity to correct it where the Commission permits resubmission.\n\n**No payment of any kind is required to apply for any position advertised on this portal.** The Commission does not operate through agents or intermediaries.`,
    },
    {
      slug: 'privacy',
      title: 'Privacy Notice',
      subtitle: 'How the Commission processes personal information submitted through this portal.',
      body: `## Who we are\n\nThe ${COMMISSION.name}, ${COMMISSION.address}, is the data controller for personal information submitted through this portal.\n\n## What we collect\n\nWhen you register and apply, we collect your name, contact details, date of birth, gender, State and Local Government Area of origin, National Identification Number where supplied, educational and professional qualifications, employment history, referee and next-of-kin details, and the supporting documents you upload.\n\n## Why we process it\n\nWe process this information to administer approved recruitment exercises: to verify eligibility, screen and shortlist applications, administer examinations and interviews, document recruitment outcomes and maintain Commission records. Processing is carried out in accordance with the Nigeria Data Protection Act 2023.\n\n## Who can see it\n\nApplicant personal information is **not publicly accessible merely because it has been submitted through this portal**. Access is restricted to authorised officers acting within their assigned roles, and every access to an applicant document is recorded in the system audit trail.\n\n## How long we keep it\n\nRetention periods are determined by the Commission in line with public-service records policy. Archived recruitment records are retained for the period the Commission has approved.\n\n## Your rights\n\nYou may request access to the personal information we hold about you, ask for inaccurate information to be corrected, and object to processing in the circumstances the Act provides for. Write to ${COMMISSION.email}, quoting your applicant reference.\n\n## Security\n\nThe portal uses encrypted communication, secure password storage, role-based access control, secure document storage and full activity logging.`,
    },
  ];
  for (const p of pages) await prisma.pageContent.create({ data: { ...p, published: true } });
  console.log(`  ✓ ${pages.length} institutional pages`);

  // -------------------------------------------------------------------------
  // MODULE 1 - Leadership
  // -------------------------------------------------------------------------
  const leaders = [
    { name: 'Barr. Hadiza Y. Suleiman', position: 'Chairman', email: 'chairman@kogicsc.kg.gov.ng', bio: 'A legal practitioner with over twenty-five years of experience in public service administration and administrative law. Appointed Chairman of the Commission with responsibility for its overall direction and the implementation of its decisions.' },
    { name: 'Hon. Michael A. Onuh', position: 'Commission Member', bio: 'A career public servant with extensive experience in establishment matters, workforce planning and promotion exercises across the Kogi State Civil Service.' },
    { name: 'Mrs. Ruth N. Abah', position: 'Commission Member', bio: 'Specialises in personnel management, staff development and disciplinary procedures, with particular responsibility for promotion and discipline matters.' },
    { name: 'Mr. Joseph O. Audu', position: 'Permanent Secretary / Secretary to the Commission', email: 'secretary@kogicsc.kg.gov.ng', bio: 'Head of the Commission secretariat, responsible for administration, records, finance and the day-to-day execution of Commission decisions.' },
    { name: 'Mrs. Grace A. Onoja', position: 'Director, Recruitment and Appointments', email: 'recruitment.director@kogicsc.kg.gov.ng', bio: 'Coordinates recruitment planning, advertisement, screening, assessment and the documentation of recruitment outcomes.' },
  ];
  for (const [i, l] of leaders.entries()) {
    await prisma.leadershipProfile.create({ data: { ...l, position_: i, published: true } });
  }
  console.log(`  ✓ ${leaders.length} leadership profiles`);

  // -------------------------------------------------------------------------
  // MODULE 1 - FAQs
  // -------------------------------------------------------------------------
  const faqs = [
    { category: 'REGISTRATION', question: 'Do I need to pay anything to apply?', answer: 'No. **No payment of any kind is required** to register or to apply for any position advertised on this portal. The Commission does not operate through agents or intermediaries. Report any demand for payment to the Commission immediately.' },
    { category: 'REGISTRATION', question: 'How do I create an applicant account?', answer: 'Select **Create an Applicant Account**, supply your surname, first name, email address and Nigerian telephone number, and choose a password of at least eight characters including a letter and a number. You will be issued a unique applicant reference number.' },
    { category: 'REGISTRATION', question: 'I have forgotten my password. What do I do?', answer: 'Use the **Forgotten your password?** link on the sign-in page. A single-use reset link valid for sixty minutes is sent to your registered email address.' },
    { category: 'APPLICATION', question: 'Can I apply for more than one position?', answer: 'This depends on the exercise. Each recruitment exercise states how many applications an applicant may submit; most permit one. The portal enforces the limit set for the exercise.' },
    { category: 'APPLICATION', question: 'Can I save my application and finish it later?', answer: 'Yes. An application remains a draft until you submit it, and you can return to it at any time before the closing date. The portal shows how complete it is and what remains outstanding.' },
    { category: 'APPLICATION', question: 'Can I change my application after submitting it?', answer: 'Not directly. Once submitted, an application is locked. If a screening officer finds a deficiency and the Commission permits a correction, your application is reopened for you to re-upload the affected documents, and you are notified of what must be corrected.' },
    { category: 'APPLICATION', question: 'What happens after I submit?', answer: 'You receive an acknowledgement with your application reference. The application then moves through preliminary screening, shortlisting, examination and interview where applicable, and final selection. You can follow its progress on your dashboard at any time.' },
    { category: 'DOCUMENTS', question: 'Which documents will I need?', answer: 'Each exercise lists the documents it requires. These commonly include a passport photograph, birth certificate or declaration of age, evidence of NIN, educational certificates, NYSC discharge or exemption certificate where applicable, professional certificates and a certificate of State or LGA of origin.' },
    { category: 'DOCUMENTS', question: 'What file formats and sizes are accepted?', answer: 'PDF, JPEG and PNG are accepted for most documents. Each requirement states its own maximum size, commonly between 2MB and 8MB. Scan documents clearly — unreadable documents are returned for correction.' },
    { category: 'DOCUMENTS', question: 'One of my documents was rejected. What now?', answer: 'Open the application on your dashboard. The officer\'s remarks state what is wrong. Upload a corrected copy of the affected document and submit the application again before the closing date.' },
    { category: 'SCREENING', question: 'How are applications screened?', answer: 'Officers check completeness, eligibility, qualifications, experience and documents against the approved criteria for the vacancy. The system performs preliminary checks to assist officers, but **every final decision is recorded by an authorised Commission officer**.' },
    { category: 'EXAMINATION', question: 'Is the test sat online or at a centre?', answer: 'Both are used. Your invitation states which applies. A **computer-based test** is sat in this portal, under **Tests and Examinations** in your dashboard: it opens for a stated window, and once you begin, the clock runs for the stated number of minutes without stopping. A **centre-based examination** is sat at the centre named on your invitation.' },
    { category: 'EXAMINATION', question: 'What happens if my internet connection drops during an online test?', answer: 'Your answers are saved on the Commission\u2019s server each time you move to another question, so nothing already answered is lost. Sign in again and choose **Resume my test**. The clock does not stop, so reconnect as quickly as you can. If the time runs out while you are disconnected, the test is submitted automatically and whatever you had answered is marked.' },
    { category: 'EXAMINATION', question: 'Can I go back and change an answer during an online test?', answer: 'Yes. Use the question navigator to move to any question, and **Save and go back** to return to the previous one. You may flag a question for review and return to it. Once you submit, the paper is closed and cannot be reopened.' },
    { category: 'EXAMINATION', question: 'Will I see my score as soon as I submit?', answer: 'Only where the Commission has set the paper to show it. Otherwise your score is withheld until the results of the examination are released, and you are notified through the portal and by email. Scores are validated by an examination officer before any result is treated as final.' },
    { category: 'EXAMINATION', question: 'How will I know about the examination?', answer: 'Shortlisted candidates are notified by email and SMS with an examination number, date, reporting time and centre. The same details appear on your dashboard. Bring a valid means of identification and a printed copy of the invitation.' },
    { category: 'INTERVIEW', question: 'What should I bring to the interview?', answer: 'Bring the originals of every document you uploaded with your application, together with a valid means of identification. Arrive at the venue before your allocated reporting time.' },
    { category: 'OUTCOME', question: 'How are successful candidates decided?', answer: 'Examination and interview scores are combined using the weighting approved for the exercise, candidates are ranked, and the approved number of posts for each vacancy is filled by rank. The resulting selection list requires Commission approval before any candidate is notified.' },
    { category: 'OUTCOME', question: 'Is an appointment final once I am notified?', answer: 'No. Final appointment remains subject to the approval of the legally authorised government authorities and to verification of your credentials. Formal documentation is issued by the Commission.' },
    { category: 'GENERAL', question: 'Who can see the information I submit?', answer: 'Only authorised Commission officers acting within their assigned roles. Your personal information is not publicly accessible merely because it was submitted through this portal, and every access to your documents is logged.' },
    { category: 'GENERAL', question: 'How do I contact the Commission about my application?', answer: 'Use the **Contact** page, quoting your application reference. Every enquiry is logged with a reference number and routed to the responsible officer.' },
  ];
  for (const [i, f] of faqs.entries()) {
    await prisma.faq.create({ data: { ...f, position: i, published: true } });
  }
  console.log(`  ✓ ${faqs.length} frequently asked questions`);

  // -------------------------------------------------------------------------
  // MODULE 7 - Notification templates
  // -------------------------------------------------------------------------
  for (const [code, t] of Object.entries(DEFAULT_TEMPLATES)) {
    await prisma.notificationTemplate.create({
      data: {
        code, name: t.name, channel: t.channel, subject: t.subject,
        body: t.body, variables: JSON.stringify(t.variables), active: true,
      },
    });
  }
  console.log(`  ✓ ${Object.keys(DEFAULT_TEMPLATES).length} notification templates`);

  // -------------------------------------------------------------------------
  // System settings
  // -------------------------------------------------------------------------
  const settings: Array<[string, string, string, string]> = [
    ['commission.name', COMMISSION.name, 'COMMISSION', 'Commission name'],
    ['commission.address', COMMISSION.address, 'COMMISSION', 'Secretariat address'],
    ['commission.email', COMMISSION.email, 'COMMISSION', 'Official email address'],
    ['commission.phone', COMMISSION.phone, 'COMMISSION', 'Telephone number'],
    ['commission.officeHours', 'Monday to Friday, 8:00am – 4:00pm', 'COMMISSION', 'Office hours'],
    ['recruitment.maxApplicationsDefault', '1', 'RECRUITMENT', 'Default applications per applicant'],
    ['recruitment.examTotalMarks', '100', 'RECRUITMENT', 'Default examination total marks'],
    ['recruitment.examPassMark', '50', 'RECRUITMENT', 'Default examination pass mark'],
    ['recruitment.interviewSlotMinutes', '20', 'RECRUITMENT', 'Default minutes per interview'],
    ['recruitment.examWeight', '50', 'RECRUITMENT', 'Default examination weighting (%)'],
    ['recruitment.interviewWeight', '50', 'RECRUITMENT', 'Default interview weighting (%)'],
    ['documents.maxSizeMb', '8', 'DOCUMENTS', 'Maximum document size (MB)'],
    ['documents.resubmissionDays', '7', 'DOCUMENTS', 'Days allowed for document correction'],
    ['security.maxFailedAttempts', '5', 'SECURITY', 'Failed sign-ins before lock-out'],
    ['security.lockoutMinutes', '15', 'SECURITY', 'Lock-out duration (minutes)'],
    ['security.sessionDays', '1', 'SECURITY', 'Session lifetime (days)'],
    ['notifications.defaultChannel', 'EMAIL', 'NOTIFICATIONS', 'Default channel'],
    ['notifications.smsSenderId', 'KOGICSC', 'NOTIFICATIONS', 'SMS sender identity'],
    ['notifications.mailFrom', 'no-reply@kogicsc.kg.gov.ng', 'NOTIFICATIONS', 'Email sender address'],
    ['dataProtection.retentionMonths', '60', 'DATA_PROTECTION', 'Applicant record retention (months)'],
    ['dataProtection.lawfulBasis', 'Public interest and performance of a public task', 'DATA_PROTECTION', 'Lawful basis for processing'],
    ['dataProtection.collectGender', 'yes', 'DATA_PROTECTION', 'Collect and report gender statistics'],
    ['dataProtection.officerEmail', COMMISSION.email, 'DATA_PROTECTION', 'Data protection officer email'],
  ];
  for (const [key, value, group, label] of settings) {
    await prisma.systemSetting.create({ data: { key, value, group, label } });
  }
  console.log(`  ✓ ${settings.length} system settings`);
  return { staff, departments, screener2, extraPanel, hash, applicantHash };
}

main()
  .then(async (ctx) => {
    const { seedEstablishment } = await import('./seed-establishment');
    const establishment = await seedEstablishment(prisma, ctx.staff);
    const { seedRecruitment } = await import('./seed-recruitment');
    await seedRecruitment(prisma, { ...ctx, establishment });
    console.log('\nSeed complete.\n');
    console.log('Sign-in details (development only — change before deployment):');
    console.log(`  Super Administrator        superadmin@kogicsc.kg.gov.ng            ${DEFAULT_PASSWORD}`);
    console.log(`  Commission Administrator   commission.admin@kogicsc.kg.gov.ng      ${DEFAULT_PASSWORD}`);
    console.log(`  Recruitment Director       recruitment.director@kogicsc.kg.gov.ng  ${DEFAULT_PASSWORD}`);
    console.log(`  Recruitment Officer        recruitment.officer@kogicsc.kg.gov.ng   ${DEFAULT_PASSWORD}`);
    console.log(`  Screening Officer          screening.officer@kogicsc.kg.gov.ng     ${DEFAULT_PASSWORD}`);
    console.log(`  Document Officer           document.officer@kogicsc.kg.gov.ng      ${DEFAULT_PASSWORD}`);
    console.log(`  Examination Officer        examination.officer@kogicsc.kg.gov.ng   ${DEFAULT_PASSWORD}`);
    console.log(`  Interview Panel Member     panel.one@kogicsc.kg.gov.ng             ${DEFAULT_PASSWORD}`);
    console.log(`  Content Officer            content.officer@kogicsc.kg.gov.ng       ${DEFAULT_PASSWORD}`);
    console.log(`  Reporting Officer          reporting.officer@kogicsc.kg.gov.ng     ${DEFAULT_PASSWORD}`);
    console.log(`  Applicants                 applicant1..30@example.com              ${APPLICANT_PASSWORD}`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export { DEFAULT_PASSWORD, APPLICANT_PASSWORD, slugify, pad, daysFromNow, yearsAgo, DOCUMENT_TYPES, APPLICATION_STATUS, EXERCISE_STATUS, KOGI_LGAS, DEFAULT_INTERVIEW_CRITERIA };
