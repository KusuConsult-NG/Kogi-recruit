/**
 * Seeds the establishment register (ministries, departments and agencies), the
 * recruitment unit that manages recruitment, and the question banks and
 * examination paper used for the computer-based aptitude test.
 */
import type { PrismaClient } from '@prisma/client';
import { OPTION_LABELS, PAPER_STATUS, ROLES } from '../src/lib/constants';

export interface EstablishmentContext {
  ministries: Record<string, string>;
  ministryDepartments: Record<string, string>;
  unitId: string;
  paperId: string;
  bankIds: Record<string, string>;
}

interface MdaSpec {
  key: string;
  name: string;
  shortName: string;
  code: string;
  kind: string;
  headName: string;
  headTitle: string;
  mandate: string;
  staffStrength: number;
  departments: string[];
}

/** The MDAs of the Kogi State Public Service for which the Commission recruits. */
const MDAS: MdaSpec[] = [
  {
    key: 'MOE', name: 'Ministry of Education, Science and Technology', shortName: 'Education',
    code: 'MOE', kind: 'MINISTRY', headName: 'Mrs. Hauwa Audu Ozigi', headTitle: 'Permanent Secretary',
    mandate: 'Formulates and implements education policy for basic, post-basic, technical and tertiary education in Kogi State, and oversees science and technology development.',
    staffStrength: 18400,
    departments: ['Basic Education', 'Secondary Education', 'Science and Technology', 'Planning, Research and Statistics', 'Finance and Accounts'],
  },
  {
    key: 'MOH', name: 'Ministry of Health', shortName: 'Health',
    code: 'MOH', kind: 'MINISTRY', headName: 'Dr. Joseph Omeiza Adaji', headTitle: 'Permanent Secretary',
    mandate: 'Oversees the delivery of primary, secondary and tertiary health services, disease control, health facility standards and health workforce planning across the State.',
    staffStrength: 9650,
    departments: ['Public Health', 'Hospital Services', 'Nursing Services', 'Planning, Research and Statistics', 'Administration and Supplies'],
  },
  {
    key: 'MOF', name: 'Ministry of Finance, Budget and Economic Planning', shortName: 'Finance and Budget',
    code: 'MOF', kind: 'MINISTRY', headName: 'Mr. Samuel Ochigbo Ileanwa', headTitle: 'Permanent Secretary',
    mandate: 'Manages the State’s finances, prepares and monitors the annual budget, controls expenditure and coordinates economic planning and development partner relations.',
    staffStrength: 2130,
    departments: ['Budget', 'Treasury', 'Economic Planning', 'Internal Audit', 'Finance and Accounts'],
  },
  {
    key: 'MOA', name: 'Ministry of Agriculture and Natural Resources', shortName: 'Agriculture',
    code: 'MOA', kind: 'MINISTRY', headName: 'Mr. Daniel Ojochenemi Ekele', headTitle: 'Permanent Secretary',
    mandate: 'Promotes agricultural production, extension services, livestock and fisheries development, and the sustainable use of the State’s natural resources.',
    staffStrength: 3480,
    departments: ['Crop Production', 'Veterinary Services', 'Agricultural Extension', 'Fisheries', 'Administration and Supplies'],
  },
  {
    key: 'MOW', name: 'Ministry of Works and Housing', shortName: 'Works and Housing',
    code: 'MOW', kind: 'MINISTRY', headName: 'Engr. Abdulrahman Isah Ogbe', headTitle: 'Permanent Secretary',
    mandate: 'Plans, constructs and maintains State roads, bridges and public buildings, and delivers the State’s housing programmes.',
    staffStrength: 2760,
    departments: ['Highways', 'Public Buildings', 'Housing', 'Mechanical and Electrical', 'Quantity Surveying'],
  },
  {
    key: 'MLG', name: 'Ministry of Local Government and Chieftaincy Affairs', shortName: 'Local Government',
    code: 'MLG', kind: 'MINISTRY', headName: 'Mr. Ibrahim Yakubu Onuh', headTitle: 'Permanent Secretary',
    mandate: 'Supervises the twenty-one Local Government Councils, coordinates community development and administers chieftaincy matters.',
    staffStrength: 1540,
    departments: ['Local Government Administration', 'Chieftaincy Affairs', 'Community Development', 'Finance and Accounts'],
  },
  {
    key: 'MWA', name: 'Ministry of Women Affairs and Social Development', shortName: 'Women Affairs',
    code: 'MWA', kind: 'MINISTRY', headName: 'Mrs. Grace Ojonugwa Idoko', headTitle: 'Permanent Secretary',
    mandate: 'Advances the welfare of women, children and vulnerable persons, and administers social development and rehabilitation services.',
    staffStrength: 870,
    departments: ['Women Development', 'Child Development', 'Social Welfare', 'Administration and Supplies'],
  },
  {
    key: 'HOS', name: 'Office of the Head of the Civil Service', shortName: 'Head of Service',
    code: 'HOS', kind: 'EXTRA_MINISTERIAL', headName: 'Mrs. Deborah Aina Ogundele', headTitle: 'Director-General',
    mandate: 'Coordinates the State’s civil service establishment, career management, service-wide training and the issue of circulars and service rules.',
    staffStrength: 640,
    departments: ['Establishment and Records', 'Career Management', 'Service Welfare', 'Training and Development'],
  },
  {
    key: 'BIR', name: 'Kogi State Internal Revenue Service', shortName: 'Internal Revenue',
    code: 'KGIRS', kind: 'AGENCY', headName: 'Mr. Sule Enehe Salifu', headTitle: 'Executive Chairman',
    mandate: 'Assesses and collects all taxes, fees and levies accruing to the Kogi State Government, and administers the State’s revenue laws.',
    staffStrength: 1210,
    departments: ['Tax Assessment', 'Collection and Enforcement', 'Taxpayer Services', 'Legal Services'],
  },
  {
    key: 'SUBEB', name: 'Kogi State Universal Basic Education Board', shortName: 'SUBEB',
    code: 'SUBEB', kind: 'PARASTATAL', headName: 'Dr. Patricia Omolara Bello', headTitle: 'Executive Chairman',
    mandate: 'Implements the universal basic education programme in the State, manages primary and junior secondary school infrastructure and the basic education teaching service.',
    staffStrength: 21300,
    departments: ['School Services', 'Quality Assurance', 'Teacher Development', 'Projects and Works', 'Social Mobilisation'],
  },
  {
    key: 'KGHSB', name: 'Kogi State Hospitals Management Board', shortName: 'Hospitals Board',
    code: 'KGHMB', kind: 'BOARD', headName: 'Dr. Felix Adeiza Omale', headTitle: 'Executive Secretary',
    mandate: 'Manages the State’s general hospitals and cottage hospitals, including clinical standards, staffing and facility maintenance.',
    staffStrength: 4120,
    departments: ['Clinical Services', 'Nursing Services', 'Pharmaceutical Services', 'Medical Records'],
  },
  {
    key: 'CSC', name: 'Kogi State Civil Service Commission', shortName: 'Civil Service Commission',
    code: 'KGCSC', kind: 'COMMISSION', headName: 'Hon. Michael Ocheje Abah', headTitle: 'Chairman',
    mandate: 'Appoints, promotes, transfers and exercises disciplinary control over officers in the Kogi State Civil Service, and conducts recruitment on behalf of ministries, departments and agencies.',
    staffStrength: 312,
    departments: ['Administration and Supplies', 'Finance and Accounts', 'Planning, Research and Statistics', 'Recruitment and Appointments'],
  },
];

/**
 * Objective questions for the general aptitude paper. The first option marked
 * with a leading asterisk is the correct answer.
 */
const BANKS: Array<{
  key: string;
  title: string;
  code: string;
  subject: string;
  description: string;
  questions: Array<{ stem: string; options: string[]; difficulty: string; topic?: string }>;
}> = [
  {
    key: 'NUM', title: 'Numerical reasoning', code: 'APT-NUM', subject: 'NUMERICAL',
    description: 'Arithmetic, percentages, ratios, series and simple data interpretation at entry-cadre level.',
    questions: [
      { stem: 'A department of 240 officers is to be reduced by 15 per cent. How many officers will remain?', options: ['*204', '216', '225', '36'], difficulty: 'EASY', topic: 'Percentages' },
      { stem: 'If 7 clerks file 350 records in a day, how many records would 12 clerks file in a day at the same rate?', options: ['*600', '560', '620', '500'], difficulty: 'MEDIUM', topic: 'Direct proportion' },
      { stem: 'What is the next number in the series 3, 7, 15, 31, …?', options: ['*63', '47', '62', '59'], difficulty: 'MEDIUM', topic: 'Number series' },
      { stem: 'A budget of ₦48,000,000 is shared between three units in the ratio 3 : 4 : 5. How much does the largest share receive?', options: ['*₦20,000,000', '₦16,000,000', '₦12,000,000', '₦24,000,000'], difficulty: 'MEDIUM', topic: 'Ratio' },
      { stem: 'An officer earns ₦145,000 monthly and is granted an increase of 8 per cent. What is the new monthly salary?', options: ['*₦156,600', '₦153,400', '₦158,600', '₦152,600'], difficulty: 'EASY', topic: 'Percentages' },
      { stem: 'Of 1,200 applications received, 35 per cent were incomplete. How many were complete?', options: ['*780', '420', '840', '760'], difficulty: 'EASY', topic: 'Percentages' },
      { stem: 'A vehicle covers 180 kilometres in 2 hours 30 minutes. What is its average speed in kilometres per hour?', options: ['*72', '70', '75', '90'], difficulty: 'EASY', topic: 'Rates' },
      { stem: 'Simplify: 5(2x − 3) − 2(3x − 7).', options: ['*4x − 1', '4x − 29', '16x − 1', '4x + 1'], difficulty: 'HARD', topic: 'Algebra' },
      { stem: 'If a file is 8 per cent of a 2,500-page archive, how many pages does it contain?', options: ['*200', '250', '180', '320'], difficulty: 'EASY', topic: 'Percentages' },
      { stem: 'Three officers complete a task in 12 days. How long would four officers, working at the same rate, take?', options: ['*9 days', '16 days', '8 days', '10 days'], difficulty: 'MEDIUM', topic: 'Inverse proportion' },
      { stem: 'The mean of five scores is 64. Four of the scores are 58, 71, 60 and 66. What is the fifth score?', options: ['*65', '63', '67', '70'], difficulty: 'MEDIUM', topic: 'Averages' },
      { stem: 'A sum of ₦250,000 attracts simple interest at 6 per cent per annum. What is the interest after three years?', options: ['*₦45,000', '₦15,000', '₦47,700', '₦30,000'], difficulty: 'MEDIUM', topic: 'Interest' },
    ],
  },
  {
    key: 'VERB', title: 'Verbal reasoning and use of English', code: 'APT-VERB', subject: 'VERBAL',
    description: 'Comprehension, vocabulary, grammar and official correspondence usage.',
    questions: [
      { stem: 'Choose the word nearest in meaning to “diligent”.', options: ['*Industrious', 'Reluctant', 'Careless', 'Hesitant'], difficulty: 'EASY', topic: 'Synonyms' },
      { stem: 'Choose the word opposite in meaning to “transparent”, as used of official conduct.', options: ['*Opaque', 'Evident', 'Candid', 'Lucid'], difficulty: 'MEDIUM', topic: 'Antonyms' },
      { stem: 'Complete the sentence: The Commission has ______ the appointment of fifteen officers.', options: ['*approved', 'approve', 'approving', 'approval'], difficulty: 'EASY', topic: 'Grammar' },
      { stem: 'Which sentence is correctly punctuated?', options: ['*The circular, which was issued last week, takes effect immediately.', 'The circular which was issued last week takes, effect immediately.', 'The circular; which was issued last week takes effect immediately.', 'The circular which, was issued last week, takes effect immediately.'], difficulty: 'HARD', topic: 'Punctuation' },
      { stem: 'In official correspondence, a letter signed “for: Permanent Secretary” indicates that the signatory is', options: ['*signing on behalf of the Permanent Secretary', 'the Permanent Secretary in person', 'addressing the Permanent Secretary', 'requesting the Permanent Secretary’s approval'], difficulty: 'MEDIUM', topic: 'Official usage' },
      { stem: 'Choose the correctly spelt word.', options: ['*Accommodation', 'Acommodation', 'Accomodation', 'Acomodation'], difficulty: 'EASY', topic: 'Spelling' },
      { stem: '“The memorandum was treated with dispatch.” In this sentence, “dispatch” means', options: ['*promptness', 'reluctance', 'secrecy', 'severity'], difficulty: 'MEDIUM', topic: 'Vocabulary' },
      { stem: 'Which of these is the plural of “memorandum”?', options: ['*Memoranda', 'Memorandums’', 'Memorandas', 'Memorandi'], difficulty: 'MEDIUM', topic: 'Vocabulary' },
      { stem: 'Choose the option that best completes the sentence: Neither the director nor the officers ______ present at the meeting.', options: ['*were', 'was', 'is', 'has been'], difficulty: 'HARD', topic: 'Concord' },
      { stem: '“Ultra vires” describes an act that is', options: ['*beyond the powers conferred', 'within lawful authority', 'done in good faith', 'subject to appeal'], difficulty: 'HARD', topic: 'Vocabulary' },
    ],
  },
  {
    key: 'CSR', title: 'Civil service rules and public administration', code: 'APT-CSR',
    subject: 'CIVIL_SERVICE_RULES',
    description: 'The Public Service Rules, Financial Regulations, and the structure of the Kogi State Public Service.',
    questions: [
      { stem: 'Which body is responsible for the appointment, promotion and discipline of officers in the Kogi State Civil Service?', options: ['*The Civil Service Commission', 'The State Executive Council', 'The Office of the Auditor-General', 'The State House of Assembly'], difficulty: 'EASY', topic: 'Institutions' },
      { stem: 'The accounting officer of a ministry is ordinarily the', options: ['*Permanent Secretary', 'Honourable Commissioner', 'Director of Finance and Accounts', 'Internal Auditor'], difficulty: 'EASY', topic: 'Institutions' },
      { stem: 'How many Local Government Areas are there in Kogi State?', options: ['*21', '20', '23', '19'], difficulty: 'EASY', topic: 'Kogi State' },
      { stem: 'The administrative headquarters of Kogi State is situated at', options: ['*Lokoja', 'Okene', 'Idah', 'Ankpa'], difficulty: 'EASY', topic: 'Kogi State' },
      { stem: 'Which two rivers meet at the confluence in Lokoja?', options: ['*The Niger and the Benue', 'The Niger and the Kaduna', 'The Benue and the Gongola', 'The Niger and the Osun'], difficulty: 'EASY', topic: 'Kogi State' },
      { stem: 'A query raised by the Auditor-General on a payment voucher is properly answered by the', options: ['*accounting officer of the ministry concerned', 'applicant for the payment', 'Civil Service Commission', 'State House of Assembly'], difficulty: 'MEDIUM', topic: 'Financial regulations' },
      { stem: 'Confirmation of appointment of an officer on probation ordinarily follows', options: ['*satisfactory service for the prescribed probationary period', 'the officer’s own written request', 'the expiry of one month in post', 'promotion to the next grade level'], difficulty: 'MEDIUM', topic: 'Public Service Rules' },
      { stem: 'An officer who absents themselves from duty without leave or reasonable excuse commits', options: ['*an act of misconduct', 'a civil wrong only', 'no infraction if later explained', 'an offence triable only by a court'], difficulty: 'MEDIUM', topic: 'Discipline' },
      { stem: 'The instrument by which service-wide administrative instructions are conveyed to ministries is a', options: ['*circular', 'writ', 'gazette notice of appointment', 'bill'], difficulty: 'EASY', topic: 'Public administration' },
      { stem: 'Which of the following is a function of the Office of the Head of the Civil Service?', options: ['*Coordinating the civil service establishment and career management', 'Auditing the accounts of the State', 'Prosecuting criminal offences', 'Collecting internally generated revenue'], difficulty: 'MEDIUM', topic: 'Institutions' },
    ],
  },
  {
    key: 'ICT', title: 'Computer appreciation', code: 'APT-ICT', subject: 'COMPUTER_LITERACY',
    description: 'Basic computer literacy expected of officers using the Commission’s systems.',
    questions: [
      { stem: 'Which of these is an input device?', options: ['*Keyboard', 'Monitor', 'Printer', 'Loudspeaker'], difficulty: 'EASY', topic: 'Hardware' },
      { stem: 'In a spreadsheet, which symbol begins a formula?', options: ['*=', '#', '@', '&'], difficulty: 'EASY', topic: 'Spreadsheets' },
      { stem: 'What does “PDF” stand for?', options: ['*Portable Document Format', 'Printed Document File', 'Public Data Form', 'Primary Document Folder'], difficulty: 'EASY', topic: 'File formats' },
      { stem: 'Which practice best protects an official account?', options: ['*Using a long, unique password and not sharing it', 'Writing the password on the desk pad', 'Using the same password on every system', 'Sharing the password with a colleague for cover'], difficulty: 'EASY', topic: 'Information security' },
      { stem: 'A file of 2,048 kilobytes is approximately', options: ['*2 megabytes', '2 gigabytes', '20 megabytes', '0.2 megabytes'], difficulty: 'MEDIUM', topic: 'Storage' },
      { stem: 'Which of these is an operating system?', options: ['*Microsoft Windows', 'Microsoft Excel', 'Google Chrome', 'Adobe Reader'], difficulty: 'EASY', topic: 'Software' },
      { stem: 'In electronic mail, “Cc” is used to', options: ['*copy the message to other recipients openly', 'hide the recipients from one another', 'mark the message confidential', 'request a read receipt'], difficulty: 'EASY', topic: 'Electronic mail' },
      { stem: 'Which action best guards against the loss of official records held electronically?', options: ['*Keeping regular backups in a separate location', 'Storing a single copy on the desktop', 'Printing the records once a year', 'Renaming the files frequently'], difficulty: 'MEDIUM', topic: 'Records management' },
    ],
  },
];

export async function seedEstablishment(prisma: PrismaClient, staff: Record<string, string>): Promise<EstablishmentContext> {
  // -------------------------------------------------------------------------
  // Establishment register
  // -------------------------------------------------------------------------
  const ministries: Record<string, string> = {};
  const ministryDepartments: Record<string, string> = {};
  let position = 0;

  for (const mda of MDAS) {
    position += 1;
    const record = await prisma.ministry.create({
      data: {
        name: mda.name,
        shortName: mda.shortName,
        code: mda.code,
        kind: mda.kind,
        mandate: mda.mandate,
        headName: mda.headName,
        headTitle: mda.headTitle,
        email: `info@${mda.code.toLowerCase()}.kg.gov.ng`,
        phone: '+234 800 000 0000',
        address: `${mda.shortName} Secretariat, Lokoja, Kogi State`,
        lga: 'Lokoja',
        staffStrength: mda.staffStrength,
        establishedYear: 1991,
        position,
        published: true,
        active: true,
        departments: {
          create: mda.departments.map((name, i) => ({
            name,
            kind: 'DEPARTMENT',
            position: i,
          })),
        },
      },
      include: { departments: true },
    });
    ministries[mda.key] = record.id;
    for (const dept of record.departments) {
      ministryDepartments[`${mda.key}:${dept.name}`] = dept.id;
    }
  }
  console.log(`  ✓ ${MDAS.length} ministries, departments and agencies on the establishment register`);

  // -------------------------------------------------------------------------
  // The recruitment unit
  // -------------------------------------------------------------------------
  const unit = await prisma.recruitmentUnit.create({
    data: {
      name: 'Recruitment and Appointments Unit',
      code: 'RAU',
      mandate:
        'Manages every recruitment exercise of the Commission end to end: confirming approved vacancies with the employing MDAs, publishing advertisements, allocating applications for screening, setting and conducting aptitude tests and examinations, convening interview panels, preparing selection lists for approval, and closing and archiving the exercise.',
      description:
        'Standing unit of the Commission, answerable to the Recruitment Director. Membership is reviewed at the start of each exercise.',
      email: 'recruitment@kogicsc.kg.gov.ng',
      phone: '+234 800 000 0001',
      office: 'Room 204, Commission Secretariat, Lokoja',
      active: true,
      createdById: staff[ROLES.SUPER_ADMIN],
      members: {
        create: [
          { userId: staff[ROLES.RECRUITMENT_DIRECTOR], unitRole: 'COORDINATOR', notes: 'Chairs the unit and signs its returns to the Commission.' },
          { userId: staff[ROLES.RECRUITMENT_OFFICER], unitRole: 'SECRETARY', notes: 'Keeps the unit’s records and prepares its submissions.' },
          { userId: staff[ROLES.SCREENING_OFFICER], unitRole: 'SCREENING_LEAD', notes: 'Leads preliminary screening and allocates applications.' },
          { userId: staff[ROLES.EXAMINATION_OFFICER], unitRole: 'EXAMINATION_LEAD', notes: 'Sets and conducts aptitude tests and examinations.' },
          { userId: staff[ROLES.DOCUMENT_OFFICER], unitRole: 'RECORDS_OFFICER', notes: 'Verifies documents and maintains the exercise file.' },
          { userId: staff[ROLES.COMMISSION_ADMIN], unitRole: 'DEPUTY_COORDINATOR', notes: 'Acts for the coordinator in their absence.' },
        ].filter((m) => Boolean(m.userId)),
      },
    },
  });
  console.log('  ✓ Recruitment and Appointments Unit established with 6 officers');

  // -------------------------------------------------------------------------
  // Question banks
  // -------------------------------------------------------------------------
  const bankIds: Record<string, string> = {};
  let questionTotal = 0;

  for (const bank of BANKS) {
    const record = await prisma.questionBank.create({
      data: {
        title: bank.title,
        code: bank.code,
        subject: bank.subject,
        description: bank.description,
        active: true,
        createdById: staff[ROLES.EXAMINATION_OFFICER] ?? staff[ROLES.SUPER_ADMIN],
        questions: {
          create: bank.questions.map((q, qi) => ({
            type: 'SINGLE_CHOICE',
            stem: q.stem,
            topic: q.topic ?? null,
            difficulty: q.difficulty,
            marks: 1,
            active: true,
            position: qi,
            createdById: staff[ROLES.EXAMINATION_OFFICER] ?? staff[ROLES.SUPER_ADMIN],
            options: {
              create: q.options.map((text, oi) => ({
                label: OPTION_LABELS[oi] ?? String(oi + 1),
                text: text.startsWith('*') ? text.slice(1) : text,
                correct: text.startsWith('*'),
                position: oi,
              })),
            },
          })),
        },
      },
    });
    bankIds[bank.key] = record.id;
    questionTotal += bank.questions.length;
  }
  console.log(`  ✓ ${BANKS.length} question banks holding ${questionTotal} questions`);

  // -------------------------------------------------------------------------
  // The aptitude paper candidates sit online
  // -------------------------------------------------------------------------
  const paper = await prisma.examPaper.create({
    data: {
      title: '2026 Civil Service Entry Aptitude Test',
      code: 'APT-2026-ENTRY',
      kind: 'APTITUDE_TEST',
      instructions: [
        'This paper carries four sections and is marked out of the total shown on your screen.',
        '',
        'Read each question carefully and select the one option you consider correct. For a question marked "choose all that apply", select every option you consider correct.',
        '',
        'Your answers are saved on the Commission’s server each time you move to another question. You may return to any question using the navigator, and you may flag a question for review.',
        '',
        'The clock runs without stopping once you begin. When the time is up the paper is submitted automatically, and whatever you have answered is marked.',
        '',
        'No books, notes, telephones or other aids are permitted. Any irregularity is reported to the Commission and may lead to disqualification.',
      ].join('\n'),
      durationMinutes: 45,
      passMark: 50,
      shuffleQuestions: true,
      shuffleOptions: true,
      showResultToCandidate: false,
      status: PAPER_STATUS.PUBLISHED,
      publishedAt: new Date(Date.now() - 7 * 86400_000),
      createdById: staff[ROLES.EXAMINATION_OFFICER] ?? staff[ROLES.SUPER_ADMIN],
      sections: {
        create: [
          { title: 'Section A — Numerical reasoning', description: 'Twelve questions. One mark each.', bankId: bankIds.NUM, drawCount: 8, marksPerQuestion: 1, position: 0 },
          { title: 'Section B — Verbal reasoning and use of English', description: 'Ten questions. One mark each.', bankId: bankIds.VERB, drawCount: 7, marksPerQuestion: 1, position: 1 },
          { title: 'Section C — Civil service rules and public administration', description: 'Ten questions. One mark each.', bankId: bankIds.CSR, drawCount: 7, marksPerQuestion: 1, position: 2 },
          { title: 'Section D — Computer appreciation', description: 'Eight questions. One mark each.', bankId: bankIds.ICT, drawCount: 5, marksPerQuestion: 1, position: 3 },
        ],
      },
    },
  });

  // A second paper, left in draft, so the draft state is visible for review.
  await prisma.examPaper.create({
    data: {
      title: 'Teaching Service Qualifying Examination (draft)',
      code: 'QE-2026-TEACH',
      kind: 'QUALIFYING_EXAM',
      instructions: 'Draft paper held pending the authorisation of the teaching service recruitment exercise.',
      durationMinutes: 90,
      passMark: 55,
      status: PAPER_STATUS.DRAFT,
      createdById: staff[ROLES.EXAMINATION_OFFICER] ?? staff[ROLES.SUPER_ADMIN],
      sections: {
        create: [
          { title: 'Section A — Use of English', bankId: bankIds.VERB, drawCount: 10, marksPerQuestion: 1, position: 0 },
        ],
      },
    },
  });
  console.log('  ✓ 1 published aptitude paper (27 questions drawn per candidate) and 1 draft paper');

  return { ministries, ministryDepartments, unitId: unit.id, paperId: paper.id, bankIds };
}
