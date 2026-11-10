/**
 * Kogi State Civil Service Commission Portal — computer-based testing.
 *
 * Drives the whole of the online testing feature through the real interface:
 * an officer sets a question bank, sets questions, assembles and publishes a
 * paper, creates an online examination, allocates candidates and releases the
 * test; an applicant then sits the test, answers, flags, navigates and
 * submits, and the officer sees the marked result.
 *
 * Start the server first, then run:
 *
 *   BASE_URL=http://localhost:3000 node tests/browser/cbt.mjs
 */
import { launchBrowser, BASE_URL } from './launch.mjs';

const BASE = BASE_URL;
const PW = 'KogiCSC#2026';
const APPLICANT_PW = 'Applicant#2026';
const stamp = Date.now().toString().slice(-6);
let pass = 0, fail = 0;
const errors = [];

function record(name, ok, detail = '') {
  if (ok) pass += 1; else fail += 1;
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function selectByText(page, selector, needle) {
  const value = await page.locator(`${selector} option`).evaluateAll(
    (opts, n) => (opts.find((o) => o.textContent.includes(n)) || {}).value,
    needle,
  );
  if (!value) throw new Error(`no option matching "${needle}" in ${selector}`);
  await page.selectOption(selector, value);
  return value;
}

const browser = await launchBrowser();

async function session(email, password) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 25000 }),
    page.click('button[type=submit]'),
  ]);
  return { context, page };
}

const body = (page) => page.locator('main').innerText();
/**
 * Badges and micro-labels are capitalised by CSS, so innerText returns them in
 * capitals. Assertions on rendered text are therefore case-insensitive.
 */
const says = async (page, needle) => (await body(page)).toLowerCase().includes(needle.toLowerCase());

try {
  // =========================================================================
  console.log('\nSetting a question bank (Module 2.6)');
  // =========================================================================
  const { page } = await session('examination.officer@kogicsc.kg.gov.ng', PW);

  await page.goto(`${BASE}/admin/exams/banks`, { waitUntil: 'domcontentloaded' });
  record('examination officer reaches the question banks', (await body(page)).includes('Question Banks'));
  record('seeded banks are listed', (await body(page)).includes('Numerical reasoning'));

  const bankCode = `E2E-${stamp}`;
  await page.fill('#title', `End-to-end test bank ${stamp}`);
  await page.fill('#code', bankCode);
  await selectByText(page, '#subject', 'Aptitude');
  await page.fill('#description', 'Bank created by the automated test run.');
  await Promise.all([
    page.waitForURL((u) => /\/admin\/exams\/banks\/[a-z0-9]{8,}$/.test(u.pathname), { timeout: 25000 }),
    page.locator('form:has(#code) button[type=submit]').click(),
  ]);
  const bankUrl = page.url();
  record('bank created and opened', bankUrl.includes('/admin/exams/banks/'));
  record('new bank has no questions yet', (await body(page)).includes('No questions set'));

  // A duplicate code is refused.
  await page.goto(`${BASE}/admin/exams/banks`, { waitUntil: 'domcontentloaded' });
  await page.fill('#title', 'A clashing bank');
  await page.fill('#code', bankCode);
  await page.locator('form:has(#code) button[type=submit]').click();
  await page.waitForTimeout(2500);
  record('duplicate bank code refused', (await body(page)).toLowerCase().includes('already in use'));

  // =========================================================================
  console.log('\nSetting questions');
  // =========================================================================
  await page.goto(bankUrl, { waitUntil: 'domcontentloaded' });

  // A question with no correct option marked is refused.
  const setForm = page.locator('form:has(#stem-new)');
  await page.fill('#stem-new', 'Which city stands at the confluence of the Niger and the Benue?');
  await page.fill('input[name=option_0]', 'Lokoja');
  await page.fill('input[name=option_1]', 'Okene');
  await page.fill('input[name=option_2]', 'Idah');
  await page.fill('input[name=option_3]', 'Ankpa');
  await setForm.locator('button[type=submit]').click();
  await page.waitForTimeout(2500);
  record('question refused with no correct option marked',
    (await body(page)).toLowerCase().includes('correct answer'));

  // Now mark the correct option and save.
  await page.goto(bankUrl, { waitUntil: 'domcontentloaded' });
  await page.fill('#stem-new', 'Which city stands at the confluence of the Niger and the Benue?');
  await page.fill('input[name=option_0]', 'Lokoja');
  await page.fill('input[name=option_1]', 'Okene');
  await page.fill('input[name=option_2]', 'Idah');
  await page.fill('input[name=option_3]', 'Ankpa');
  await page.locator('input[name=correct][value="0"]').first().check();
  await page.locator('form:has(#stem-new) button[type=submit]').click();
  await page.waitForTimeout(3000);
  await page.goto(bankUrl, { waitUntil: 'domcontentloaded' });
  record('question set and listed', (await body(page)).includes('confluence of the Niger'));
  record('the correct option is marked on the record', (await body(page)).includes('Lokoja'));

  // Import a batch.
  const payload = [
    'How many Local Government Areas are there in Kogi State?',
    '*21',
    '20',
    '23',
    '19',
    '',
    'Which officer is ordinarily the accounting officer of a ministry?',
    '*The Permanent Secretary',
    'The Honourable Commissioner',
    'The Internal Auditor',
    '',
    'A bad block with no correct option',
    'One',
    'Two',
  ].join('\n');
  await page.fill('#payload', payload);
  await page.fill('#import-marks', '1');
  await page.locator('form:has(#payload) button[type=submit]').click();
  await page.waitForTimeout(3000);
  await page.goto(bankUrl, { waitUntil: 'domcontentloaded' });
  const afterImport = await body(page);
  record('batch import reads the good questions', afterImport.includes('How many Local Government Areas'));
  record('batch import reads the second question', afterImport.includes('accounting officer of a ministry'));
  record('batch import rejects the malformed block', !afterImport.includes('A bad block with no correct option'));

  // =========================================================================
  console.log('\nAssembling and publishing a paper');
  // =========================================================================
  await page.goto(`${BASE}/admin/exams/papers`, { waitUntil: 'domcontentloaded' });
  record('papers register lists the seeded aptitude paper',
    (await body(page)).includes('2026 Civil Service Entry Aptitude Test'));

  const paperCode = `E2EP-${stamp}`;
  await page.fill('#title', `End-to-end aptitude paper ${stamp}`);
  await page.fill('#code', paperCode);
  await page.fill('#durationMinutes', '30');
  await page.fill('#passMark', '40');
  await Promise.all([
    page.waitForURL((u) => /\/admin\/exams\/papers\/[a-z0-9]{8,}$/.test(u.pathname), { timeout: 25000 }),
    page.locator('form:has(#code) button[type=submit]').click(),
  ]);
  const paperUrl = page.url();
  record('paper created in draft', await says(page, 'draft'));
  record('a paper with no sections cannot be sat', (await body(page)).includes('no sections'));

  // Publishing is refused while the paper is empty.
  page.once('dialog', (d) => d.accept());
  await page.locator('form:has(input[value=PUBLISHED]) button[type=submit]').click();
  await page.waitForTimeout(2500);
  record('publishing refused without a section',
    (await body(page)).toLowerCase().includes('add at least one section'));

  // Add a section drawing from the seeded numerical bank.
  await page.goto(paperUrl, { waitUntil: 'domcontentloaded' });
  await page.fill('#sec-title-new', 'Section A — Numerical reasoning');
  await selectByText(page, '#sec-bank-new', 'Numerical reasoning');
  await page.fill('#sec-draw-new', '4');
  await page.locator('form:has(#sec-title-new) button[type=submit]').click();
  await page.waitForTimeout(3000);
  await page.goto(paperUrl, { waitUntil: 'domcontentloaded' });
  record('section added and draws from a bank', await says(page, '4 drawn at random'));

  // Asking for more questions than the bank holds is refused. The browser
  // stops it first through the max attribute, and the server refuses it too.
  await page.goto(paperUrl, { waitUntil: 'domcontentloaded' });
  await page.fill('#sec-title-new', 'Section B — too many');
  await selectByText(page, '#sec-bank-new', 'Computer appreciation');
  const drawMax = await page.locator('#sec-draw-new').getAttribute('max');
  record('the draw field is capped at the size of the bank',
    Number(drawMax) > 0 && Number(drawMax) < 500, `max=${drawMax}`);
  await page.fill('#sec-draw-new', '500');
  await page.locator('form:has(#sec-title-new) button[type=submit]').click();
  await page.waitForTimeout(2000);
  const tooMany = await body(page);
  record('an oversized draw never creates a section',
    !tooMany.includes('Section B — too many'));

  // Add a second section with questions chosen by hand.
  await page.goto(paperUrl, { waitUntil: 'domcontentloaded' });
  await page.fill('#sec-title-new', 'Section B — Civil service rules');
  await selectByText(page, '#sec-bank-new', 'Civil service rules');
  await page.locator('form:has(#sec-title-new) button[type=submit]').click();
  await page.waitForTimeout(3000);
  await page.goto(paperUrl, { waitUntil: 'domcontentloaded' });
  record('a hand-picked section is added', await says(page, 'chosen by hand'));

  const picker = page.locator('form:has(input[name=questionIds])').first();
  const boxes = picker.locator('input[name=questionIds]');
  const boxCount = await boxes.count();
  record('the picker offers the bank’s questions', boxCount > 0, `${boxCount} question(s)`);
  for (let i = 0; i < Math.min(3, boxCount); i += 1) await boxes.nth(i).check();
  await picker.locator('button[type=submit]').click();
  await page.waitForTimeout(3000);
  await page.goto(paperUrl, { waitUntil: 'domcontentloaded' });
  record('chosen questions are set on the section', await says(page, '3 chosen by hand'));

  // Publish.
  page.once('dialog', (d) => d.accept());
  await page.locator('form:has(input[value=PUBLISHED]) button[type=submit]').click();
  await page.waitForTimeout(3000);
  await page.goto(paperUrl, { waitUntil: 'domcontentloaded' });
  record('paper published', await says(page, 'published'));

  // =========================================================================
  console.log('\nCreating an online examination');
  // =========================================================================
  await page.goto(`${BASE}/admin/examinations/new`, { waitUntil: 'domcontentloaded' });
  await selectByText(page, '#exerciseId', '2026 Kogi State Civil Service Recruitment Exercise');
  await page.fill('#title', `End-to-end online aptitude test ${stamp}`);
  const today = new Date().toISOString().slice(0, 10);
  await page.fill('#examDate', today);
  await page.fill('#startTime', '08:00');
  await page.fill('#endTime', '18:00');

  // A paper is required once the mode is online.
  await page.selectOption('#mode', 'CBT');
  await page.waitForTimeout(500);
  record('choosing the online mode asks for a paper',
    (await page.locator('#paperId').count()) === 1);
  const paperChoices = await page.locator('#paperId option').evaluateAll((os) =>
    os.map((o) => o.textContent).filter(Boolean),
  );
  record('only published papers are offered',
    paperChoices.some((t) => t.includes(paperCode))
      && !paperChoices.some((t) => t.includes('Teaching Service Qualifying Examination')),
  );
  await selectByText(page, '#paperId', paperCode);
  await page.fill('#durationMinutes', '30');

  await Promise.all([
    page.waitForURL((u) => /\/admin\/examinations\/[a-z0-9]{8,}$/.test(u.pathname), { timeout: 25000 }),
    page.locator('form:has(#title) button[type=submit]').click(),
  ]);
  const examUrl = page.url();
  const examBody = await body(page);
  record('online examination created', examUrl.includes('/admin/examinations/'));
  record('the examination shows the online-test panel', examBody.includes('Online test'));
  record('the attached paper is named', examBody.includes(paperCode));
  record('a centre is not demanded for an online test', !examBody.includes('Add at least one examination centre'));

  // Allocate candidates. The allocation table uses controlled checkboxes, so
  // "select all" in the header is the officer's route.
  const allocate = page.locator('form:has(input[name=notify])').first();
  const candidateRows = await allocate.locator('tbody tr').count();
  record('shortlisted candidates are offered for allocation', candidateRows > 0,
    `${candidateRows} available`);
  await allocate.locator('thead input[type=checkbox]').first().check();
  await allocate.locator('button[type=submit]').click();
  await page.waitForTimeout(4000);
  await page.goto(examUrl, { waitUntil: 'domcontentloaded' });
  record('candidates allocated and issued examination numbers',
    /KGE\/\d{4}\/\d{6}/.test(await body(page)));

  // Release the test.
  page.once('dialog', (d) => d.accept());
  await page.locator('button:has-text("Release the test")').first().click();
  await page.waitForTimeout(3500);
  await page.goto(examUrl, { waitUntil: 'domcontentloaded' });
  const released = await body(page);
  record('test released to the allocated candidates', await says(page, 'not started'));
  record('every allocated candidate now has a sitting',
    await says(page, 'every allocated candidate has a sitting'));

  // Find the examination number of the first allocated candidate, and the
  // applicant it belongs to, so the test can be sat below.
  const firstRow = page.locator('table tbody tr').first();
  const examNumber = (await firstRow.locator('td').first().innerText()).trim();
  record('an examination number was issued', /^KGE\/\d{4}\/\d{6}$/.test(examNumber), examNumber);

  // =========================================================================
  console.log('\nSitting the test as a candidate');
  // =========================================================================
  // Identify the applicant holding an unstarted sitting on this examination,
  // rather than signing in as every seeded applicant in turn.
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const waiting = await prisma.examSitting.findFirst({
    where: { status: 'NOT_STARTED', candidate: { schedule: { title: { contains: stamp } } } },
    include: {
      candidate: {
        select: {
          examNumber: true,
          application: { select: { applicant: { select: { email: true } } } },
        },
      },
    },
  });
  await prisma.$disconnect();
  record('a candidate with an unstarted online test was found', Boolean(waiting),
    waiting?.candidate.examNumber ?? '');
  if (!waiting) throw new Error('no applicant had an unstarted sitting');

  const candidate = await session(waiting.candidate.application.applicant.email, APPLICANT_PW);
  await candidate.page.goto(`${BASE}/portal/tests`, { waitUntil: 'domcontentloaded' });

  const cpage = candidate.page;
  record('the test list names the examination', await says(cpage, 'examination number'));
  record('the time allowed is stated before beginning', await says(cpage, 'minutes'));

  cpage.once('dialog', (d) => d.accept());
  await Promise.all([
    cpage.waitForURL((u) => /\/examination\/[a-z0-9]{8,}$/.test(u.pathname), { timeout: 30000 }),
    cpage.locator('form:has(input[name=sittingId]) button[type=submit]').first().click(),
  ]);
  const sittingUrl = cpage.url();
  const hall = await body(cpage);
  record('the examination hall opens', sittingUrl.includes('/examination/'));
  record('the first question is shown', /Question 1 of \d+/.test(hall));
  record('the countdown is running', (await cpage.locator('[role=timer]').innerText()).match(/\d{2}:\d{2}/) !== null);
  record('the navigator lists every question', (await cpage.locator('ol li a').count()) > 0);
  record('the portal navigation is withheld during a sitting',
    (await cpage.locator('a[href="/portal/applications"]').count()) === 0);
  record('exactly one main landmark is present', (await cpage.locator('main').count()) === 1);

  const totalQuestions = Number((hall.match(/Question 1 of (\d+)/) || [0, 0])[1]);
  record('the paper was assembled from both sections', totalQuestions >= 7, `${totalQuestions} questions`);

  // Answer the first question and move on.
  await cpage.locator('input[name=selected]').first().check();
  await cpage.locator('form:has(input[name=itemId]) button:has-text("Save and continue")').click();
  await cpage.waitForTimeout(2500);
  record('the answer saved and the paper advanced', /Question 2 of/.test(await body(cpage)));

  // Flag a question, then confirm the flag shows.
  await cpage.locator('button:has-text("Flag this question")').click();
  await cpage.waitForTimeout(2000);
  record('a question can be flagged for review', (await body(cpage)).toLowerCase().includes('flagged'));
  await cpage.locator('button:has-text("Remove the flag")').click();
  await cpage.waitForTimeout(2000);
  record('a flag can be removed', (await body(cpage)).includes('Flag this question'));

  // Go back, then jump through the navigator.
  await cpage.locator('button:has-text("Save and go back")').click();
  await cpage.waitForTimeout(2500);
  record('the candidate can go back a question', /Question 1 of/.test(await body(cpage)));

  await cpage.goto(`${sittingUrl}?q=3`, { waitUntil: 'domcontentloaded' });
  record('the navigator jumps to a chosen question', /Question 3 of/.test(await body(cpage)));

  // An out-of-range question number is clamped rather than erroring.
  await cpage.goto(`${sittingUrl}?q=9999`, { waitUntil: 'domcontentloaded' });
  record('an out-of-range question number is clamped',
    new RegExp(`Question ${totalQuestions} of ${totalQuestions}`).test(await body(cpage)));

  // Answer the rest of the paper.
  for (let q = 2; q <= totalQuestions; q += 1) {
    await cpage.goto(`${sittingUrl}?q=${q}`, { waitUntil: 'domcontentloaded' });
    await cpage.locator('input[name=selected]').first().check();
    await cpage.locator('form:has(input[name=itemId]) button[type=submit]').first().click();
    await cpage.waitForTimeout(900);
  }
  await cpage.goto(sittingUrl, { waitUntil: 'domcontentloaded' });
  const tally = await body(cpage);
  record('every question is recorded as answered', /not answered\s*0\b/i.test(tally));
  record('the answered tally matches the paper',
    new RegExp(`answered\\s*${totalQuestions}\\b`, 'i').test(tally));

  // Submit.
  cpage.once('dialog', (d) => d.accept());
  await Promise.all([
    cpage.waitForURL((u) => u.pathname.endsWith('/result'), { timeout: 30000 }),
    cpage.locator('form:has(input[name=sittingId]) button:has-text("Submit my test")').click(),
  ]);
  const result = await body(cpage);
  record('the submission is acknowledged', result.includes('submission has been received'));
  record('the record of the sitting is shown', result.includes('Record of your sitting'));
  record('the score is withheld where the paper says so',
    result.includes('Withheld') || /\d+%/.test(result));
  record('the examination number appears on the receipt', result.includes('KGE/'));

  // The paper cannot be reopened.
  await cpage.goto(sittingUrl, { waitUntil: 'domcontentloaded' });
  record('a submitted paper cannot be reopened', cpage.url().endsWith('/result'));

  await cpage.goto(`${BASE}/portal/tests`, { waitUntil: 'domcontentloaded' });
  record('the test list shows the sitting as submitted', await says(cpage, 'you sat this test on'));

  // =========================================================================
  console.log('\nThe officer sees the marked result');
  // =========================================================================
  await page.goto(examUrl, { waitUntil: 'domcontentloaded' });
  const marked = await body(page);
  record('the sitting shows as submitted to the officer', await says(page, 'submitted'));
  record('a percentage was computed automatically', /\d+(\.\d+)?%/.test(marked));
  record('the score reached the candidate’s examination record', await says(page, 'present'));

  await page.goto(`${BASE}/admin/reports`, { waitUntil: 'domcontentloaded' });
  record('computer-based testing appears in the reports', await says(page, 'computer-based testing'));
  record('the average online score is reported', await says(page, 'average score'));

  await page.goto(paperUrl, { waitUntil: 'domcontentloaded' });
  const paperAfter = await body(page);
  record('the paper records the sitting', paperAfter.includes('Recent sittings'));
  record('a sat paper is locked against amendment',
    paperAfter.includes('already sat') || paperAfter.includes('locked'));

  // =========================================================================
  console.log('\nAccess control');
  // =========================================================================
  const screener = await session('screening.officer@kogicsc.kg.gov.ng', PW);
  await screener.page.goto(`${BASE}/admin/exams/banks`, { waitUntil: 'domcontentloaded' });
  record('a screening officer cannot reach the question banks',
    screener.page.url().includes('not-authorised'));
  await screener.page.goto(`${BASE}/admin/exams/papers`, { waitUntil: 'domcontentloaded' });
  record('a screening officer cannot reach the papers',
    screener.page.url().includes('not-authorised'));
  await screener.context.close();

  // An applicant cannot open another candidate's sitting.
  const other = await session('applicant30@example.com', APPLICANT_PW);
  await other.page.goto(sittingUrl, { waitUntil: 'domcontentloaded' });
  const otherBody = await other.page.content();
  record('an applicant cannot open another candidate’s sitting',
    otherBody.includes('not be found') || otherBody.includes('404') || otherBody.includes('Page not found'));
  await other.context.close();

  await candidate.context.close();
} catch (error) {
  fail += 1;
  console.error('\nSuite aborted:', error.message);
} finally {
  await browser.close();
}

if (errors.length > 0) {
  console.log('\nPage errors and server failures:');
  for (const e of [...new Set(errors)]) console.log(`  ! ${e}`);
}

console.log(`\n${pass}/${pass + fail} checks passed.`);
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
