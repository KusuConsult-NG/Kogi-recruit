/**
 * Kogi State Civil Service Commission Portal — recorded walkthrough.
 *
 * Drives the live application with a real browser and records one continuous
 * video, with chapter cards and captions so the result can be watched without
 * a narrator. Start the server first, then run:
 *
 *   BASE_URL=http://localhost:3000 node tests/browser/walkthrough.mjs
 */
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { launchBrowser, BASE_URL } from './launch.mjs';

const OUT = path.resolve(process.env.OUT_DIR ?? './demo');
await mkdir(OUT, { recursive: true });

const STAFF_PW = 'KogiCSC#2026';
const APPLICANT_PW = 'Applicant#2026';
const NEW_PW = 'Demo#2026pass';
const stamp = Date.now().toString().slice(-6);

const prisma = new PrismaClient();
const [exercise, ministry, unit, bank, paper, cbtExam, waiting] = await Promise.all([
  prisma.recruitmentExercise.findFirstOrThrow({ where: { status: 'PUBLISHED' }, select: { id: true } }),
  prisma.ministry.findFirstOrThrow({ where: { vacancies: { some: {} } }, select: { id: true } }),
  prisma.recruitmentUnit.findFirstOrThrow({ select: { id: true } }),
  prisma.questionBank.findFirstOrThrow({ where: { code: 'APT-NUM' }, select: { id: true } }),
  prisma.examPaper.findFirstOrThrow({ where: { status: 'PUBLISHED' }, select: { id: true } }),
  prisma.examSchedule.findFirstOrThrow({ where: { mode: 'CBT' }, select: { id: true } }),
  prisma.examSitting.findFirstOrThrow({
    where: { status: 'NOT_STARTED' },
    include: {
      candidate: {
        select: { examNumber: true, application: { select: { applicant: { select: { email: true } } } } },
      },
    },
  }),
]);
const qualifiedApp = await prisma.application.findFirst({ where: { status: 'QUALIFIED' }, select: { id: true } });
const shortlist = await prisma.shortlist.findFirst({ where: { status: 'APPROVED' }, select: { id: true } });
const interview = await prisma.interviewSchedule.findFirst({ select: { id: true } });
const selection = await prisma.selectionList.findFirst({ where: { status: 'APPROVED' }, select: { id: true } });
await prisma.$disconnect();

const browser = await launchBrowser();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: OUT, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();

const BRAND = '#16342a';
const GOLD = '#cfa84f';

/** A caption bar along the foot of the screen. */
async function say(text, sub = '', hold = 2600) {
  await page.evaluate(({ text, sub, BRAND, GOLD }) => {
    document.getElementById('demo-cap')?.remove();
    const bar = document.createElement('div');
    bar.id = 'demo-cap';
    bar.style.cssText = `position:fixed;left:0;right:0;bottom:0;z-index:2147483647;
      background:${BRAND};border-top:3px solid ${GOLD};padding:14px 28px;
      font-family:'Public Sans',system-ui,sans-serif;color:#fff;
      box-shadow:0 -8px 24px rgba(0,0,0,.25)`;
    bar.innerHTML = `<div style="font-size:19px;font-weight:600;line-height:1.3">${text}</div>` +
      (sub ? `<div style="font-size:14px;color:#dcc277;margin-top:3px;line-height:1.4">${sub}</div>` : '');
    document.body.appendChild(bar);
  }, { text, sub, BRAND, GOLD });
  await page.waitForTimeout(hold);
}

/** A full-screen card between acts. */
async function chapter(n, title, sub, hold = 3000) {
  await page.evaluate(({ n, title, sub, BRAND, GOLD }) => {
    document.getElementById('demo-chapter')?.remove();
    const card = document.createElement('div');
    card.id = 'demo-chapter';
    card.style.cssText = `position:fixed;inset:0;z-index:2147483647;background:${BRAND};
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      font-family:'Public Sans',system-ui,sans-serif;color:#fff;text-align:center`;
    card.innerHTML = `
      <div style="width:56px;height:3px;background:${GOLD};margin-bottom:26px"></div>
      <div style="font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:${GOLD}">${n}</div>
      <div style="font-family:Georgia,serif;font-size:46px;font-weight:600;margin-top:14px;max-width:1000px;line-height:1.15">${title}</div>
      <div style="font-size:17px;color:#bbd8c7;margin-top:18px;max-width:760px;line-height:1.6">${sub}</div>`;
    document.body.appendChild(card);
  }, { n, title, sub, BRAND, GOLD });
  await page.waitForTimeout(hold);
  await page.evaluate(() => document.getElementById('demo-chapter')?.remove());
}

async function go(route, hold = 1400) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(hold);
}

/** Scroll the page down so long records are seen, not just their headers. */
async function scan(distance = 2200, steps = 22) {
  for (let i = 0; i < steps; i += 1) {
    await page.mouse.wheel(0, distance / steps);
    await page.waitForTimeout(110);
  }
  await page.waitForTimeout(500);
}

async function signIn(email, password) {
  await go('/login', 600);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 }),
    page.click('button[type=submit]'),
  ]);
  await page.waitForTimeout(1200);
}

async function signOut() {
  await page.locator('form button:has-text("Sign out")').first().click().catch(() => {});
  await page.waitForTimeout(1500);
}

/** One act; a failure inside it must not cost the whole recording. */
async function act(name, fn) {
  try {
    await fn();
  } catch (error) {
    console.log(`  ! ${name}: ${error.message.split('\n')[0]}`);
  }
}

try {
  // ======================================================================
  await go('/', 900);
  await page.evaluate(({ BRAND, GOLD }) => {
    const card = document.createElement('div');
    card.id = 'demo-chapter';
    card.style.cssText = `position:fixed;inset:0;z-index:2147483647;background:${BRAND};
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      font-family:'Public Sans',system-ui,sans-serif;color:#fff;text-align:center`;
    card.innerHTML = `
      <svg width="88" height="88" viewBox="0 0 64 64" style="margin-bottom:28px">
        <circle cx="32" cy="32" r="31" fill="#16342a" stroke="${GOLD}" stroke-width="2.5"/>
        <circle cx="32" cy="32" r="27" fill="none" stroke="${GOLD}" stroke-width="0.9" opacity="0.5"/>
        <path d="M13 16c1 11 8 19 19 23" fill="none" stroke="#eadcab" stroke-width="3.6" stroke-linecap="round"/>
        <path d="M51 16c-1 11-8 19-19 23" fill="none" stroke="#eadcab" stroke-width="3.6" stroke-linecap="round" opacity="0.72"/>
        <path d="M32 39v9" fill="none" stroke="#eadcab" stroke-width="3.6" stroke-linecap="round"/>
        <path d="M23 51.5h18" fill="none" stroke="${GOLD}" stroke-width="2.2" stroke-linecap="round"/>
      </svg>
      <div style="font-family:Georgia,serif;font-size:50px;font-weight:600;line-height:1.15;max-width:1000px">
        Kogi State Civil Service Commission</div>
      <div style="font-size:15px;letter-spacing:.2em;text-transform:uppercase;color:${GOLD};margin-top:18px">
        Civil Service Recruitment Management System</div>
      <div style="font-size:17px;color:#bbd8c7;margin-top:30px;max-width:720px;line-height:1.6">
        A walkthrough of the portal: the public information service, online
        application, screening, computer-based testing and recruitment outcomes.</div>`;
    document.body.appendChild(card);
  }, { BRAND, GOLD });
  await page.waitForTimeout(5000);
  await page.evaluate(() => document.getElementById('demo-chapter')?.remove());

  // ======================================================================
  await act('public', async () => {
    await chapter('Part one', 'The public portal',
      'What a citizen sees: the Commission, its establishment, and every advertised post.');

    await go('/');
    await say('The homepage states the Commission’s standing and the register at a glance.',
      'Open exercises, approved posts advertised, applications received, and the number of MDAs.');
    await scan(1800);
    await say('Current recruitment exercises, each with its approved posts and closing date.');
    await scan(2000);
    await say('Vacancies can be browsed by the ministry that carries the post.');
    await scan(1800);

    await go('/ministries');
    await say('The establishment directory.',
      'Ministries, extra-ministerial departments, agencies, parastatals, boards and commissions.');
    await scan(2400);
    await say('Each MDA states its mandate, accounting officer, contact details and departments.');
    await scan(2200);

    await go('/recruitment');
    await say('Every advertised exercise, filterable by the employing MDA.');
    await scan(1600);
    await say('The posts are listed with grade level, employing ministry and the number approved.');
    await scan(1600);

    await go(`/recruitment/${exercise.id}`);
    await say('An exercise in full: key dates, eligibility and how to apply.');
    await scan(2200);
    await say('The approved vacancies, each tied to the ministry that carries the post.');
    await scan(2600);
    await say('And the documents an applicant must upload.');
    await scan(2000);

    await go('/recruitment/process');
    await say('The ten documented stages of a recruitment exercise.');
    await scan(2000);

    await go('/news');
    await say('News, official announcements, circulars and public notices.');
    await go('/downloads', 1200);
    await say('Forms and publications for download.');
    await go('/faqs', 1200);
    await say('Frequently asked questions, including how an online test is sat.');
    await scan(1400);
    await go('/track', 1200);
    await say('An applicant can track an application without signing in,',
      'using the reference and surname.');
  });

  // ======================================================================
  await act('applicant', async () => {
    await chapter('Part two', 'Applying for a post',
      'Registration, profile, application, documents and submission.');

    await go('/register');
    await say('Registration asks only for what is needed to open an account.');
    await page.fill('#surname', 'Ocheje');
    await page.waitForTimeout(400);
    await page.fill('#firstName', 'Amina');
    await page.waitForTimeout(400);
    await page.fill('#email', `demo.applicant.${stamp}@example.com`);
    await page.waitForTimeout(400);
    await page.fill('#phone', '08031234599');
    await page.fill('#password', NEW_PW);
    await page.fill('#confirmPassword', NEW_PW);
    await page.check('input[name=consent]');
    await say('Consent to the privacy notice is explicit, and recorded.', '', 2000);
    await Promise.all([
      page.waitForURL(/\/portal\/profile/, { timeout: 30000 }),
      page.click('button[type=submit]'),
    ]);
    await page.waitForTimeout(1500);
    await say('The account is created and a unique applicant reference issued.');

    await page.fill('#dateOfBirth', '1996-04-12');
    await page.selectOption('#gender', 'Female');
    await page.selectOption('#maritalStatus', 'Single');
    await page.fill('#residentialAddress', '14 Murtala Mohammed Way');
    await page.fill('#city', 'Lokoja');
    await page.selectOption('#stateOfResidence', 'Kogi');
    await page.selectOption('#stateOfOrigin', 'Kogi');
    await page.selectOption('#lga', 'Lokoja');
    await say('The profile captures State and Local Government Area of origin.', '', 2200);
    await page.locator('form:has(#residentialAddress) button[type=submit]').click();
    await page.waitForTimeout(2500);
    await say('Profile saved. An application can now be started.');

    await go('/portal/applications/new');
    await say('The open exercises are offered.');
    await page.locator('a[href*="/portal/applications/new?exercise="]').first().click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1200);
    await say('A position is chosen from the approved vacancies,',
      'each showing its employing MDA, grade level and requirements.');
    await scan(900, 9);
    await page.locator('input[name=vacancyId]').first().check();
    await page.waitForTimeout(800);
    await Promise.all([
      page.waitForURL((u) => /\/portal\/applications\/[a-z0-9]{8,}$/.test(u.pathname), { timeout: 30000 }),
      page.locator('form:has(input[name=vacancyId]) button[type=submit]').click(),
    ]);
    const appUrl = page.url();
    await page.waitForTimeout(1500);
    await say('The application opens with a unique reference and a completeness measure.');
    await scan(1400);

    await page.fill('#institution', 'Kogi State University, Anyigba');
    await page.selectOption('#qualification', 'B.Sc / B.A / B.Eng');
    await say('Qualifications, employment history, referees and next of kin are recorded.', '', 2000);
    await page.locator('form:has(#institution) button[type=submit]').click();
    await page.waitForTimeout(2500);

    const jpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
    ]);
    await go(appUrl, 1200);
    await scan(2600);
    await say('Documents are uploaded against the requirements the Commission set.');
    await page.locator('input[aria-label^="Upload Passport"]').setInputFiles({
      name: 'passport.jpg', mimeType: 'image/jpeg', buffer: jpeg,
    });
    await page.locator('form:has(input[aria-label^="Upload Passport"]) button[type=submit]').click();
    await page.waitForTimeout(3000);
    await say('Each upload is checked for file type, size and real content, then recorded.');

    await go(appUrl, 1200);
    await scan(3200);
    await say('The declaration and data-processing consent are confirmed before submission.');
    await page.locator('input[name=declaration]').check().catch(() => {});
    await page.waitForTimeout(500);
    await page.locator('input[name=consent]').check().catch(() => {});
    await page.waitForTimeout(1500);

    await go('/portal');
    await say('The applicant dashboard tracks the application through all ten stages.');
    await scan(2000);
    await go('/portal/documents', 1200);
    await say('Every uploaded document and its review status.');
    await go('/portal/notifications', 1200);
    await say('Notifications sent by the Commission are kept on the record.');
    await signOut();
  });

  // ======================================================================
  await act('officer', async () => {
    await chapter('Part three', 'The Commission at work',
      'The establishment register, the recruitment unit, and an exercise under management.');

    await signIn('recruitment.director@kogicsc.kg.gov.ng', STAFF_PW);
    await say('An officer signs in and sees only what their role permits.',
      'Eleven roles, thirty named permissions, enforced on navigation, pages and actions.');
    await scan(1600);

    await go('/admin/establishment/ministries');
    await say('The establishment register of ministries, departments and agencies.');
    await scan(1600);
    await go(`/admin/establishment/ministries/${ministry.id}`);
    await say('One MDA: its record, its departments, and every vacancy raised against it.');
    await scan(2400);

    await go('/admin/establishment/units');
    await say('Recruitment is managed by a standing unit, not by individuals acting alone.');
    await scan(1400);
    await go(`/admin/establishment/units/${unit.id}`);
    await say('Officers are assigned to the unit in named roles.',
      'Coordinator, secretary, screening lead, examination lead, records officer.');
    await scan(2200);

    await go('/admin/exercises');
    await say('The register of recruitment exercises.');
    await go(`/admin/exercises/${exercise.id}`, 1400);
    await say('An exercise under management: its lifecycle, stages and approval history.');
    await scan(2000);
    await say('Approved vacancies, each raised against its employing MDA.');
    await scan(2600);
    await say('Required documents and custom application fields are configured here.');
    await scan(3000);

    await go('/admin/applications');
    await say('Every application, filterable by exercise, status and stage.');
    await scan(1600);
    if (qualifiedApp) {
      await go(`/admin/applications/${qualifiedApp.id}`, 1400);
      await say('An application in full, with preliminary checks that assist the officer.',
        'The decision is always recorded against the officer who made it.');
      await scan(3000);
    }
    await go('/admin/screening', 1400);
    await say('Screening: assignment to officers, and bulk processing.');
    await scan(1600);
    await go('/admin/documents', 1400);
    await say('Document verification, with rejection and resubmission.');
    await scan(1400);
    if (shortlist) {
      await go(`/admin/shortlists/${shortlist.id}`, 1400);
      await say('Shortlists are prepared, then approved by an officer with that right.');
      await scan(2000);
    }
  });

  // ======================================================================
  await act('exam-setting', async () => {
    await chapter('Part four', 'Setting an aptitude test',
      'Question banks, examination papers, and releasing an online test to candidates.');

    await signOut();
    await signIn('examination.officer@kogicsc.kg.gov.ng', STAFF_PW);

    await go('/admin/exams/banks');
    await say('Questions are collected into banks by subject.');
    await scan(1400);
    await go(`/admin/exams/banks/${bank.id}`, 1400);
    await say('A bank of numerical reasoning questions, with the correct answer marked.');
    await scan(2600);
    await say('An officer sets a question here, or imports a batch in plain text.');
    await page.fill('#stem-new', 'A ministry of 320 officers is to be reduced by 15 per cent. How many will remain?');
    await page.waitForTimeout(700);
    await page.fill('input[name=option_0]', '272');
    await page.fill('input[name=option_1]', '280');
    await page.fill('input[name=option_2]', '288');
    await page.fill('input[name=option_3]', '48');
    await page.locator('input[name=correct][value="0"]').first().check();
    await page.waitForTimeout(1200);
    await say('Marks, difficulty and topic are recorded against every question.');
    await page.locator('form:has(#stem-new) button[type=submit]').click();
    await page.waitForTimeout(3000);
    await say('The question joins the bank and is available to every paper that draws on it.');
    await scan(1200);

    await go('/admin/exams/papers');
    await say('Papers are assembled from the banks.');
    await scan(1200);
    await go(`/admin/exams/papers/${paper.id}`, 1400);
    await say('This paper draws a fresh random selection for every candidate.',
      'Twenty-seven questions across four sections, forty-five minutes, marked automatically.');
    await scan(2600);
    await say('Once candidates have sat a paper, it locks, so the record stands.');
    await scan(2200);

    await go('/admin/examinations');
    await say('Examinations can be centre-based, computer-based or hybrid.');
    await scan(1200);
    await go(`/admin/examinations/${cbtExam.id}`, 1400);
    await say('An online test: its paper, its window, and the duration allowed.');
    await scan(2200);
    await say('Every candidate sitting is watched live — not started, in progress, submitted.');
    await scan(2600);
  });

  // ======================================================================
  await act('sitting', async () => {
    await chapter('Part five', 'A candidate sits the test',
      'Under a clock, in the applicant portal, marked as the answers are saved.');

    await signOut();
    await signIn(waiting.candidate.application.applicant.email, APPLICANT_PW);
    await go('/portal');
    await say('The candidate is told a test is waiting for them.');
    await scan(900, 9);

    await go('/portal/tests');
    await say('The invitation states the examination number, the time allowed and the window.');
    await scan(1200);
    await say('The clock runs without stopping once the test begins.');

    page.once('dialog', (d) => d.accept());
    await Promise.all([
      page.waitForURL((u) => /\/examination\/[a-z0-9]{8,}$/.test(u.pathname), { timeout: 40000 }),
      page.locator('form:has(input[name=sittingId]) button[type=submit]').first().click(),
    ]);
    const sitting = page.url();
    await page.waitForTimeout(2000);
    await say('The examination hall: one question, the countdown, and the navigator.',
      'The portal navigation is withheld, so there is nowhere to wander off to.');
    await page.waitForTimeout(2500);

    await page.locator('input[name=selected]').first().check();
    await page.waitForTimeout(1200);
    await say('An answer is saved on the Commission’s server each time the candidate moves on.');
    await page.locator('form:has(input[name=itemId]) button:has-text("Save and continue")').click();
    await page.waitForTimeout(2500);

    await page.locator('input[name=selected]').nth(1).check().catch(() => {});
    await page.waitForTimeout(900);
    await say('A question can be flagged and returned to.');
    await page.locator('button:has-text("Flag this question")').click().catch(() => {});
    await page.waitForTimeout(2200);

    await go(`${sitting}?q=4`, 1200);
    await say('The navigator jumps to any question, showing answered, unanswered and flagged.');
    await page.waitForTimeout(2000);

    // Answer the remainder so the submission is a real one.
    const total = Number(((await page.locator('main').innerText()).match(/Question \d+ of (\d+)/) || [0, 7])[1]);
    await say(`Answering the rest of the paper — ${total} questions in all.`, '', 1500);
    for (let q = 1; q <= total; q += 1) {
      await page.goto(`${sitting}?q=${q}`, { waitUntil: 'domcontentloaded' });
      await page.locator('input[name=selected]').first().check().catch(() => {});
      await page.locator('form:has(input[name=itemId]) button[type=submit]').first().click().catch(() => {});
      await page.waitForTimeout(450);
    }
    await go(sitting, 1200);
    await say('Every question answered. The test is submitted.');
    page.once('dialog', (d) => d.accept());
    await Promise.all([
      page.waitForURL((u) => u.pathname.endsWith('/result'), { timeout: 40000 }),
      page.locator('form:has(input[name=sittingId]) button:has-text("Submit my test")').click(),
    ]);
    await page.waitForTimeout(2000);
    await say('The submission is acknowledged and the sitting recorded.',
      'The score is withheld until the Commission releases the results.');
    await scan(1800);
  });

  // ======================================================================
  await act('outcome', async () => {
    await chapter('Part six', 'Marking, outcomes and the record',
      'Automatic marking, interviews, final selection, reporting and the audit trail.');

    await signOut();
    await signIn('superadmin@kogicsc.kg.gov.ng', STAFF_PW);

    await go(`/admin/examinations/${cbtExam.id}`, 1400);
    await say('The officer sees the sitting submitted and marked automatically.');
    await scan(2600);
    await say('The score is scaled onto the examination’s total marks and written to the candidate.');
    await scan(1600);

    if (interview) {
      await go(`/admin/interviews/${interview.id}`, 1400);
      await say('Interviews: panels, time slots and a configurable assessment framework.');
      await scan(2400);
    }
    if (selection) {
      await go(`/admin/selection/${selection.id}`, 1400);
      await say('Final selection ranks candidates on weighted examination and interview scores.');
      await scan(2600);
    }

    await go('/admin/reports', 1400);
    await say('Management reporting across every exercise.');
    await scan(1800);
    await say('Computer-based testing is reported alongside the rest.');
    await scan(2000);
    await say('Distributions by vacancy, qualification, LGA, gender and employing MDA.',
      'Exportable to PDF, Excel and CSV.');
    await scan(2400);

    await go('/admin/audit', 1400);
    await say('Every action is written to the audit trail, with the officer and the time.');
    await scan(2200);
    await go('/admin/users', 1400);
    await say('Users, roles and per-user permissions.');
    await scan(1600);
  });

  // ======================================================================
  await go('/', 800);
  await page.evaluate(({ BRAND, GOLD }) => {
    const card = document.createElement('div');
    card.style.cssText = `position:fixed;inset:0;z-index:2147483647;background:${BRAND};
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      font-family:'Public Sans',system-ui,sans-serif;color:#fff;text-align:center`;
    card.innerHTML = `
      <div style="width:56px;height:3px;background:${GOLD};margin-bottom:26px"></div>
      <div style="font-family:Georgia,serif;font-size:40px;font-weight:600;max-width:900px;line-height:1.2">
        Kogi State Civil Service Commission Portal</div>
      <div style="font-size:17px;color:#bbd8c7;margin-top:22px;max-width:780px;line-height:1.7">
        Eight modules, the ten-stage recruitment workflow, vacancies raised against
        ministries, a recruitment unit, and aptitude tests sat online and marked
        automatically.</div>
      <div style="font-size:15px;color:${GOLD};margin-top:26px">
        585 automated checks · 61 database models · 90 routes</div>`;
    document.body.appendChild(card);
  }, { BRAND, GOLD });
  await page.waitForTimeout(5500);
} catch (error) {
  console.error('walkthrough aborted:', error.message);
} finally {
  await context.close();
  await browser.close();
}

console.log('recording written to', OUT);
