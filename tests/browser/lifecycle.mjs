/**
 * Kogi State Civil Service Commission Portal — full recruitment lifecycle.
 *
 * Drives the running application with a real browser. Start the server
 * first, then run:
 *
 *   BASE_URL=http://localhost:3000 node tests/browser/lifecycle.mjs
 */
/**
 * Drives a complete recruitment exercise through the administrative UI,
 * from creation (stage 1) to approval and archiving (stage 10), signing in
 * as the officer who holds the rights for each stage.
 */
import { launchBrowser, BASE_URL } from './launch.mjs';

const BASE = BASE_URL;
const PW = 'KogiCSC#2026';
const PANEL_MEMBERS = ['Dr. Aisha M. Jimoh', 'Hon. Michael A. Onuh'];
const APPLICANT_PW = 'Kogi2026test';
const stamp = Date.now();
let pass = 0, fail = 0;
const errors = [];

function record(name, ok, detail = '') {
  if (ok) pass += 1; else fail += 1;
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}


/** Select the option in a <select> whose visible text contains `needle`. */
async function selectByText(page, selector, needle) {
  const value = await page.locator(`${selector} option`).evaluateAll(
    (opts, n) => (opts.find((o) => o.textContent.includes(n)) || {}).value,
    needle,
  );
  if (!value) throw new Error(`no option matching "${needle}" in ${selector}`);
  await page.selectOption(selector, value);
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

/** Rendered text of the page, excluding streaming payload scripts. */
const body = (page) => page.locator('main').innerText();
const lower = async (page) => (await body(page)).toLowerCase();

// ---------------------------------------------------------- stages 1 and 2
console.log('\nStage 1–2: planning, approval and publication');
const director = await session('recruitment.director@kogicsc.kg.gov.ng', PW);
const officer = await session('recruitment.officer@kogicsc.kg.gov.ng', PW);

const EX_TITLE = `E2E Test Exercise ${stamp}`;
const EX_REF = `KGCSC/E2E/${stamp}`;
{
  const page = officer.page;
  await page.goto(`${BASE}/admin/exercises/new`, { waitUntil: 'domcontentloaded' });
  await page.fill('#title', EX_TITLE);
  await page.fill('#reference', EX_REF);
  await page.fill('#description', 'An exercise created by the automated end-to-end test.');
  await page.fill('#eligibility', 'Open to candidates holding a first degree.');
  await page.fill('#guidelines', 'Apply online before the closing date.');
  const opens = new Date(Date.now() - 86400_000).toISOString().slice(0, 16);
  const closes = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 16);
  await page.fill('#opensAt', opens);
  await page.fill('#closesAt', closes);
  await Promise.all([
    page.waitForURL((u) => /\/admin\/exercises\/[a-z0-9]{8,}$/.test(u.pathname), { timeout: 25000 }),
    page.locator('form:has(#title) button[type=submit]').click(),
  ]);
  record('exercise created', page.url().includes('/admin/exercises/'));
  const exUrl = page.url();

  // Submitting for approval without a vacancy must be refused
  await page.locator('form:has(input[value=PENDING_APPROVAL]) button[type=submit]').click();
  await page.waitForTimeout(2500);
  record('approval refused without an approved vacancy',
    (await body(page)).includes('at least one approved vacancy'));

  // Add a vacancy
  await page.goto(exUrl, { waitUntil: 'domcontentloaded' });
  await page.fill('#jobTitle', 'E2E Administrative Officer II');
  await page.selectOption('#gradeLevel', 'GL 08');
  await page.fill('#positions', '2');
  await page.fill('#qualifications', 'A degree (B.Sc) from a recognised university in any discipline.');
  await page.fill('#experience', 'No previous experience required.');
  await page.fill('#minAge', '18');
  await page.fill('#maxAge', '40');
  await page.locator('form:has(#jobTitle) button[type=submit]').click();
  await page.waitForTimeout(3000);
  record('vacancy added', (await body(page)).includes('E2E Administrative Officer II'));

  // A vacancy with an inverted age range is refused
  await page.fill('#jobTitle', 'Invalid Vacancy');
  await page.selectOption('#gradeLevel', 'GL 07');
  await page.fill('#positions', '1');
  await page.fill('#qualifications', 'HND');
  await page.fill('#minAge', '40');
  await page.fill('#maxAge', '20');
  await page.locator('form:has(#jobTitle) button[type=submit]').click();
  await page.waitForTimeout(2500);
  record('invalid age range refused', (await body(page)).includes('not be lower than the minimum'));

  // Submit for approval
  await page.goto(exUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('form:has(input[value=PENDING_APPROVAL]) button[type=submit]').click();
  await page.waitForTimeout(3000);
  record('exercise submitted for approval', (await body(page)).includes('Awaiting Approval'));

  // An officer without approval rights cannot approve it
  const approveBtn = await page.locator('form:has(input[value=APPROVED]) button[type=submit]').count();
  record('preparing officer is not offered the approval action', approveBtn === 0);

  // The director approves and publishes
  const dpage = director.page;
  await dpage.goto(`${BASE}/admin/approvals?status=PENDING`, { waitUntil: 'domcontentloaded' });
  record('approval request appears in the director queue', (await body(dpage)).includes('approve exercise'));

  await dpage.goto(exUrl, { waitUntil: 'domcontentloaded' });
  await dpage.locator('form:has(input[value=APPROVED]) button[type=submit]').click();
  await dpage.waitForTimeout(3000);
  record('exercise approved by the director', (await body(dpage)).includes('Approved'));

  await dpage.goto(exUrl, { waitUntil: 'domcontentloaded' });
  dpage.once('dialog', (d) => d.accept());
  await dpage.locator('form:has(input[value=PUBLISHED]) button[type=submit]').click();
  await dpage.waitForTimeout(3000);
  record('exercise published', (await body(dpage)).includes('Published'));

  globalThis.exUrl = exUrl;
  globalThis.exId = exUrl.split('/').pop();
}

// Visible on the public portal
{
  const anon = await browser.newContext();
  const page = await anon.newPage();
  await page.goto(`${BASE}/recruitment`, { waitUntil: 'domcontentloaded' });
  record('published exercise visible to the public', (await body(page)).includes(EX_TITLE));
  await anon.close();
}

// ------------------------------------------------------------ stages 3 and 4
console.log('\nStage 3–4: registration and application submission');
const applicants = [];
for (let i = 0; i < 3; i += 1) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
  const email = `e2e.applicant.${stamp}.${i}@example.com`;

  await page.goto(`${BASE}/register`, { waitUntil: 'domcontentloaded' });
  await page.fill('#surname', `Candidate${i}`);
  await page.fill('#firstName', 'Test');
  await page.fill('#email', email);
  await page.fill('#phone', `0803123456${i}`);
  await page.fill('#password', APPLICANT_PW);
  await page.fill('#confirmPassword', APPLICANT_PW);
  await page.check('input[name=consent]');
  await Promise.all([
    page.waitForURL(/\/portal\/profile/, { timeout: 25000 }),
    page.click('button[type=submit]'),
  ]);

  await page.fill('#dateOfBirth', `199${i}-06-15`);
  await page.selectOption('#gender', i % 2 === 0 ? 'Male' : 'Female');
  await page.selectOption('#maritalStatus', 'Single');
  await page.fill('#residentialAddress', `${i + 1} Test Road, Lokoja`);
  await page.fill('#city', 'Lokoja');
  await page.selectOption('#stateOfResidence', 'Kogi');
  await page.selectOption('#stateOfOrigin', 'Kogi');
  await page.selectOption('#lga', ['Lokoja', 'Okene', 'Idah'][i]);
  await page.locator('form:has(#residentialAddress) button[type=submit]').click();
  await page.waitForTimeout(2500);

  // Apply
  await page.goto(`${BASE}/portal/applications/new?exercise=${globalThis.exId}`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name=vacancyId]').first().check();
  await Promise.all([
    page.waitForURL((u) => /\/portal\/applications\/[a-z0-9]{8,}$/.test(u.pathname), { timeout: 25000 }),
    page.locator('form:has(input[name=vacancyId]) button[type=submit]').click(),
  ]);
  const appUrl = page.url();

  // Qualification
  await page.fill('#institution', 'Kogi State University, Anyigba');
  await page.selectOption('#qualification', 'B.Sc / B.A / B.Eng');
  await page.fill('#course', 'Public Administration');
  await page.fill('#startYear', '2014');
  await page.fill('#endYear', '2018');
  await page.locator('form:has(#institution) button[type=submit]').click();
  await page.waitForTimeout(2500);

  // Every required document
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'latin1');
  for (let guard = 0; guard < 10; guard += 1) {
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    const pending = page.locator('li:has-text("not uploaded") input[type=file]').first();
    if ((await pending.count()) === 0) break;
    const label = (await pending.getAttribute('aria-label')) ?? '';
    const isPhoto = /Passport/i.test(label);
    await pending.setInputFiles(
      isPhoto
        ? { name: 'passport.jpg', mimeType: 'image/jpeg', buffer: jpeg }
        : { name: `${label.replace(/\W+/g, '-').toLowerCase()}.pdf`, mimeType: 'application/pdf', buffer: pdf },
    );
    await page.locator(`form:has(input[aria-label="${label}"]) button[type=submit]`).click();
    await page.waitForTimeout(2500);
  }

  // Next of kin and additional details
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  const nokForm = page.locator('form:has(#relationship)');
  await nokForm.locator('#name').fill('Test Next of Kin');
  await nokForm.locator('#relationship').fill('Parent');
  await nokForm.locator('#phone').fill('08039876543');
  await nokForm.locator('button[type=submit]').click();
  await page.waitForTimeout(2500);

  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.selectOption('#field_computer_literacy', 'Advanced').catch(() => {});
  await page.selectOption('#field_willing_to_relocate', 'Yes').catch(() => {});
  await page.selectOption('#field_criminal_record', 'No').catch(() => {});
  await page.locator('form:has(#skills) button[type=submit]').click().catch(() => {});
  await page.waitForTimeout(2500);

  // Submit
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.check('input[name=declaration]');
  await page.check('input[name=consent]');
  await page.locator('form:has(input[name=declaration]) button[type=submit]').click();
  await page.waitForTimeout(3500);
  const after = await page.locator('main').innerText();
  const submitted = after.includes('Your application has been submitted');
  record(`applicant ${i} submitted their application`, submitted,
    submitted ? '' : (after.match(/Outstanding:[^.]*/)?.[0] ?? 'no confirmation'));
  if (i === 0) {
    record('acknowledgement states the reference and next step',
      /KGCSC\/\d{4}\//.test(after) && after.includes('awaiting preliminary screening'));
  }
  const ref = after.match(/KGCSC\/\d{4}\/[A-Z0-9]+\/[A-Z0-9]+/)?.[0];
  applicants.push({ email, context, page, appUrl, ref });
}

// ------------------------------------------------------------ stages 5 and 6
console.log('\nStage 5–6: screening and shortlisting');
const screener = await session('screening.officer@kogicsc.kg.gov.ng', PW);
const docOfficer = await session('document.officer@kogicsc.kg.gov.ng', PW);
{
  // Verify the documents
  const page = docOfficer.page;
  await page.goto(`${BASE}/admin/documents?status=PENDING&exercise=${globalThis.exId}`, { waitUntil: 'domcontentloaded' });
  let verified = 0;
  for (let guard = 0; guard < 40; guard += 1) {
    await page.goto(`${BASE}/admin/documents?status=PENDING&exercise=${globalThis.exId}`, { waitUntil: 'domcontentloaded' });
    const form = page.locator('form:has(select[name=outcome])').first();
    if ((await form.count()) === 0) break;
    await form.locator('select[name=outcome]').selectOption('VERIFIED');
    await form.locator('button[type=submit]').click();
    await page.waitForTimeout(1500);
    verified += 1;
  }
  record('documents verified by the document officer', verified > 0, `${verified} document(s)`);

  // Assign screening
  const opage = officer.page;
  await opage.goto(`${BASE}/admin/screening?exercise=${globalThis.exId}&view=queue`, { waitUntil: 'domcontentloaded' });
  await opage.locator('thead input[type=checkbox]').check();
  await selectByText(opage, '#officerId', 'Fatima S. Yakubu');
  await opage.locator('form:has(#officerId) button[type=submit]').click();
  await opage.waitForTimeout(3000);
  record('applications assigned to a screening officer',
    (await body(opage)).includes('assigned to Fatima S. Yakubu'));

  // Screen each application individually
  const spage = screener.page;
  await spage.goto(`${BASE}/admin/screening?exercise=${globalThis.exId}&view=mine`, { waitUntil: 'domcontentloaded' });
  const links = await spage.locator('a[href^="/admin/applications/"]').evaluateAll(
    (els) => els.map((e) => e.getAttribute('href')),
  );
  const unique = [...new Set(links)];
  record('screening officer sees their assigned applications', unique.length >= 3, `${unique.length}`);

  let screened = 0;
  for (const [i, href] of unique.entries()) {
    await spage.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded' });
    const detail = await body(spage);
    if (i === 0) {
      record('officer sees the preliminary automated checks', detail.includes('Preliminary automated checks'));
      record('preliminary checks suggest an outcome', /Suggested outcome:/.test(detail));
    }
    const form = spage.locator('form:has(#outcome)');
    if ((await form.count()) === 0) continue;

    if (i === unique.length - 1) {
      // The last candidate is disqualified, with a reason
      await form.locator('#outcome').selectOption('FAILED');
      await form.locator('#classification').selectOption('UNDER_QUALIFIED');
      // A failure with no reason must be refused
      await form.locator('button[type=submit]').click();
      await spage.waitForTimeout(2500);
      record('screening failure refused without a reason',
        (await body(spage)).includes('Remarks are required'));
      const form2 = spage.locator('form:has(#outcome)');
      await form2.locator('#outcome').selectOption('FAILED');
      await form2.locator('#classification').selectOption('UNDER_QUALIFIED');
      await form2.locator('#remarks').fill('Does not hold the minimum qualification for the post.');
      await form2.locator('button[type=submit]').click();
      await spage.waitForTimeout(2500);
      record('candidate disqualified with a recorded reason',
        (await body(spage)).includes('Screening outcome recorded'));
    } else {
      for (const field of ['completenessPass', 'eligibilityPass', 'qualificationPass', 'experiencePass', 'documentsPass']) {
        await form.locator(`input[name=${field}]`).check();
      }
      await form.locator('#outcome').selectOption('PASSED');
      await form.locator('#remarks').fill('All approved criteria met.');
      await form.locator('button[type=submit]').click();
      await spage.waitForTimeout(2500);
      screened += 1;
    }
  }
  record('candidates passed screening', screened >= 2, `${screened}`);

  // Prepare the shortlist
  await opage.goto(`${BASE}/admin/screening?exercise=${globalThis.exId}&view=shortlist`, { waitUntil: 'domcontentloaded' });
  await opage.locator('thead input[type=checkbox]').check();
  await opage.locator('form:has(#title) #title').fill(`E2E Shortlist ${stamp}`);
  await opage.locator('form:has(#title) button[type=submit]').click();
  await opage.waitForTimeout(3000);
  record('shortlist prepared from qualified applications',
    (await body(opage)).includes('Shortlist created with'));

  // Submit and approve the shortlist
  await opage.goto(`${BASE}/admin/shortlists?exercise=${globalThis.exId}`, { waitUntil: 'domcontentloaded' });
  const slHref = await opage.locator('a[href^="/admin/shortlists/"]').first().getAttribute('href');
  await opage.goto(`${BASE}${slHref}`, { waitUntil: 'domcontentloaded' });
  await opage.locator('form:has(input[value=SUBMIT]) button[type=submit]').click();
  await opage.waitForTimeout(3000);
  const slState = await opage.locator('main').innerText();
  record('shortlist submitted for approval',
    slState.includes('submitted for approval') || slState.includes('awaiting approval'));

  const dpage = director.page;
  await dpage.goto(`${BASE}${slHref}`, { waitUntil: 'domcontentloaded' });
  dpage.once('dialog', (d) => d.accept());
  await dpage.locator('form:has(input[value=APPROVE]) button[type=submit]').click();
  await dpage.waitForTimeout(3500);
  await dpage.goto(`${BASE}${slHref}`, { waitUntil: 'domcontentloaded' });
  const slFinal = await lower(dpage);
  record('shortlist approved and candidates notified',
    slFinal.includes('candidates notified') && !slFinal.includes('not yet')
      && slFinal.includes('approved and the candidates notified'));
}

// -------------------------------------------------------------------- stage 7
console.log('\nStage 7: examination');
const examOfficer = await session('examination.officer@kogicsc.kg.gov.ng', PW);
{
  const page = examOfficer.page;
  await page.goto(`${BASE}/admin/examinations/new`, { waitUntil: 'domcontentloaded' });
  await selectByText(page, '#exerciseId', EX_REF);
  await page.fill('#title', `E2E Written Test ${stamp}`);
  await page.fill('#examDate', new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10));
  await page.fill('#startTime', '09:00');
  await page.fill('#endTime', '11:00');
  await page.fill('#instructions', 'Report 45 minutes early with a valid means of identification.');
  await Promise.all([
    page.waitForURL((u) => /\/admin\/examinations\/[a-z0-9]{8,}$/.test(u.pathname), { timeout: 25000 }),
    page.locator('form:has(#title) button[type=submit]').click(),
  ]);
  const examUrl = page.url();
  record('examination created', examUrl.includes('/admin/examinations/'));

  // Candidates cannot be allocated before a centre exists
  record('allocation blocked before a centre is added',
    (await body(page)).includes('Add at least one examination centre'));

  await page.fill('form:has(#capacity) #name', 'E2E Examination Centre, Lokoja');
  await page.fill('#address', 'Test Road, Lokoja');
  await page.selectOption('#lga', 'Lokoja');
  await page.fill('#capacity', '50');
  await page.fill('#supervisor', 'Test Supervisor');
  await page.locator('form:has(#capacity) button[type=submit]').click();
  await page.waitForTimeout(3000);
  record('examination centre added', (await body(page)).includes('E2E Examination Centre'));

  await page.goto(examUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('thead input[type=checkbox]').first().check();
  await page.locator('form:has(input[name=notify]) button[type=submit]').click();
  await page.waitForTimeout(4000);
  const allocated = await page.locator('main').innerText();
  record('candidates allocated and notified',
    /candidate\(s\) assigned and \d+ notified/.test(allocated) || /KGE\/\d{4}\/\d{6}/.test(allocated));
  record('examination numbers issued', /KGE\/\d{4}\/\d{6}/.test(allocated));

  // A score above the total marks is refused by the field constraint, and the
  // server refuses it too if the constraint is bypassed.
  await page.goto(examUrl, { waitUntil: 'domcontentloaded' });
  const row = page.locator('form:has(select[name=attendance])').first();
  await row.locator('select[name=attendance]').selectOption('PRESENT');
  const scoreField = row.locator('input[name=score]');
  await scoreField.fill('150');
  const invalid = await scoreField.evaluate((el) => !el.checkValidity());
  record('score above the total marks refused by the field', invalid);

  await row.locator('button[type=submit]').click();
  await page.waitForTimeout(2500);
  await page.goto(examUrl, { waitUntil: 'domcontentloaded' });
  record('an out-of-range score is never stored', !(await body(page)).includes('150/100'));

  // Bypass the constraint to confirm the server refuses it as well
  await page.goto(examUrl, { waitUntil: 'domcontentloaded' });
  const row2 = page.locator('form:has(select[name=attendance])').first();
  await row2.locator('select[name=attendance]').selectOption('PRESENT');
  await row2.locator('input[name=score]').evaluate((el) => {
    el.removeAttribute('max');
    el.value = '150';
  });
  await row2.locator('button[type=submit]').click();
  await page.waitForTimeout(2500);
  record('server refuses an out-of-range score',
    (await lower(page)).includes('cannot exceed the total mark'));

  // Record each score
  await page.goto(examUrl, { waitUntil: 'domcontentloaded' });
  const rows = await page.locator('form:has(select[name=attendance])').count();
  for (let i = 0; i < rows; i += 1) {
    await page.goto(examUrl, { waitUntil: 'domcontentloaded' });
    const r = page.locator('form:has(select[name=attendance])').nth(i);
    await r.locator('select[name=attendance]').selectOption('PRESENT');
    await r.locator('input[name=score]').fill(String(72 + i * 5));
    await r.locator('button[type=submit]').click();
    await page.waitForTimeout(1800);
  }
  record('examination scores recorded', rows > 0, `${rows} candidate(s)`);

  // Validate and release
  await page.goto(examUrl, { waitUntil: 'domcontentloaded' });
  await page.check('input[name=publishResults]');
  await page.locator('form:has(input[name=publishResults]) button[type=submit]').click();
  await page.waitForTimeout(3500);
  await page.goto(examUrl, { waitUntil: 'domcontentloaded' });
  const validated = await body(page);
  record('examination validated and candidates advanced', validated.includes('Results summary'));
  record('results released to candidates', !validated.includes('Not released'));
}

// -------------------------------------------------------------------- stage 8
console.log('\nStage 8: interview');
{
  const page = director.page;
  await page.goto(`${BASE}/admin/interviews/new`, { waitUntil: 'domcontentloaded' });
  await selectByText(page, '#exerciseId', EX_REF);
  await page.fill('#title', `E2E Oral Interview ${stamp}`);
  await page.fill('#interviewDate', new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10));
  await page.fill('#startTime', '09:00');
  await page.fill('#venue', 'Commission Conference Room, Lokoja');
  await Promise.all([
    page.waitForURL((u) => /\/admin\/interviews\/[a-z0-9]{8,}$/.test(u.pathname), { timeout: 25000 }),
    page.locator('form:has(#venue) button[type=submit]').click(),
  ]);
  const ivUrl = page.url();
  record('interview created', ivUrl.includes('/admin/interviews/'));
  record('scheduling blocked before a panel exists',
    (await body(page)).includes('Create at least one interview panel'));

  // Create a panel of Interview Panel Members
  const panelForm = page.locator('form:has(input[name=memberIds])');
  await panelForm.locator('#name').fill('E2E Panel A');
  await panelForm.locator('#roomVenue').fill('Conference Room 1');
  for (const name of PANEL_MEMBERS) {
    await panelForm.locator(`label:has-text("${name}") input[name=memberIds]`).check();
  }
  await selectByText(page, '#chairId', PANEL_MEMBERS[0]);
  await panelForm.locator('button[type=submit]').click();
  await page.waitForTimeout(3000);
  record('interview panel created with members', (await body(page)).includes('E2E Panel A'));

  // Schedule candidates
  await page.goto(ivUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('thead input[type=checkbox]').first().check();
  await page.locator('form:has(input[name=notify]) button[type=submit]').click();
  await page.waitForTimeout(4000);
  const scheduled = await page.locator('main').innerText();
  record('candidates scheduled for interview and notified',
    /candidate\(s\) scheduled and \d+ notified/.test(scheduled) || scheduled.includes('slot '));

  // A manager who does not sit on the panel may not score
  await page.goto(ivUrl, { waitUntil: 'domcontentloaded' });
  record('manager who is not on the panel is not offered a score sheet',
    (await page.locator('form:has(input[name^=score_])').count()) === 0);

  // Record scores as a member of the panel
  const panellist = await session('panel.one@kogicsc.kg.gov.ng', PW);
  const ppage = panellist.page;
  await ppage.goto(ivUrl, { waitUntil: 'domcontentloaded' });
  const sheets = await ppage.locator('form:has(input[name^=score_])').count();
  for (let i = 0; i < sheets; i += 1) {
    await ppage.goto(ivUrl, { waitUntil: 'domcontentloaded' });
    const sheet = ppage.locator('form:has(input[name^=score_])').nth(i);
    const inputs = sheet.locator('input[name^=score_]');
    const n = await inputs.count();
    for (let j = 0; j < n; j += 1) {
      const max = Number(await inputs.nth(j).getAttribute('max')) || 10;
      await inputs.nth(j).fill(String(Math.round(max * 0.8)));
    }
    await sheet.locator('#remarks').fill('Articulate and well prepared.');
    await sheet.locator('button[type=submit]').click();
    await ppage.waitForTimeout(2000);
  }
  record('interview scores recorded by a panel member', sheets > 0, `${sheets} candidate(s)`);
  if (sheets > 0) {
    await ppage.goto(ivUrl, { waitUntil: 'domcontentloaded' });
    record('panel mean shown against the candidate',
      (await lower(ppage)).includes('panel mean'));
  }
  await panellist.context.close();

  // Consolidate
  await page.goto(ivUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('form:has(input[name=scheduleId]) button:has-text("Consolidate")').click();
  await page.waitForTimeout(3500);
  await page.goto(ivUrl, { waitUntil: 'domcontentloaded' });
  record('panel assessments consolidated', (await body(page)).includes('Prepare the final selection list'));
}

// ------------------------------------------------------------ stages 9 and 10
console.log('\nStage 9–10: final selection, notification and archiving');
{
  const opage = officer.page;
  await opage.goto(`${BASE}/admin/selection`, { waitUntil: 'domcontentloaded' });
  await selectByText(opage, '#exerciseId', EX_REF);
  await opage.locator('form:has(#examWeight) #title').fill(`E2E Final Selection ${stamp}`);
  await opage.fill('#examWeight', '50');
  await opage.fill('#interviewWeight', '50');
  await Promise.all([
    opage.waitForURL((u) => /\/admin\/selection\/[a-z0-9]{8,}$/.test(u.pathname), { timeout: 25000 }),
    opage.locator('form:has(#examWeight) button[type=submit]').click(),
  ]);
  const selUrl = opage.url();
  const prepared = await body(opage);
  record('selection list prepared with ranking', selUrl.includes('/admin/selection/'));
  record('candidates ranked by weighted final score', prepared.includes('Consolidated assessment and ranking'));
  record('vacancy fill shown against approved posts', prepared.includes('Vacancy fill'));

  await opage.locator('form:has(input[value=SUBMIT]) button[type=submit]').click();
  await opage.waitForTimeout(3000);
  await opage.goto(selUrl, { waitUntil: 'domcontentloaded' });
  record('selection list submitted for Commission approval',
    (await lower(opage)).includes('awaiting approval') || (await lower(opage)).includes('pending approval'));

  const dpage = director.page;
  await dpage.goto(selUrl, { waitUntil: 'domcontentloaded' });
  dpage.once('dialog', (d) => d.accept());
  await dpage.locator('form:has(input[value=APPROVE]) button[type=submit]').click();
  await dpage.waitForTimeout(4000);
  await dpage.goto(selUrl, { waitUntil: 'domcontentloaded' });
  const approved = await lower(dpage);
  record('selection approved and every candidate notified',
    approved.includes('recruitment outcome approved')
      && approved.includes('all candidates have been notified'));

  await dpage.goto(selUrl, { waitUntil: 'domcontentloaded' });
  dpage.once('dialog', (d) => d.accept());
  await dpage.locator('form:has(button:has-text("Archive records")) button[type=submit]').click();
  await dpage.waitForTimeout(3500);
  await dpage.goto(selUrl, { waitUntil: 'domcontentloaded' });
  record('records archived and the exercise closed',
    (await body(dpage)).toLowerCase().includes('archived'));

  // The exercise is now closed to new applications
  const anon = await browser.newContext();
  const apage = await anon.newPage();
  await apage.goto(`${BASE}/recruitment/${globalThis.exId}`, { waitUntil: 'domcontentloaded' });
  record('closed exercise no longer accepts applications',
    (await body(apage)).includes('no longer accepting applications'));
  await anon.close();
}

// ------------------------------------------------- what the applicants now see
console.log('\nApplicant outcome (Module 3 / Module 7)');
{
  for (const [i, a] of applicants.entries()) {
    await a.page.goto(a.appUrl, { waitUntil: 'domcontentloaded' });
    const detail = (await body(a.page)).toLowerCase();
    const concluded = detail.includes('successful') || detail.includes('unsuccessful')
      || detail.includes('recommended for appointment') || detail.includes('not successful')
      || detail.includes('disqualified');
    record(`applicant ${i} sees a concluded outcome`, concluded);
    if (i === 0) {
      record('applicant sees their examination details', detail.includes('examination number'));
      record('applicant sees their interview details', detail.includes('interview'));
      record('applicant sees the full application history', detail.includes('application history'));
    }
    await a.page.goto(`${BASE}/portal/notifications`, { waitUntil: 'domcontentloaded' });
    const notes = (await body(a.page)).toLowerCase();
    record(`applicant ${i} was notified of the outcome`,
      notes.includes('recruitment outcome') || notes.includes('not successful')
        || notes.includes('update on your application'));
  }
}

// ------------------------------------------------------- audit trail of it all
console.log('\nAudit trail (Module 8)');
{
  // An officer reaching outside their role is refused, and the attempt recorded.
  await examOfficer.page.goto(`${BASE}/admin/users`, { waitUntil: 'domcontentloaded' });
  record('access outside a role is refused',
    examOfficer.page.url().includes('/admin/not-authorised'));

  const admin = await session('superadmin@kogicsc.kg.gov.ng', PW);
  const page = admin.page;
  for (const action of [
    'EXERCISE_CREATED', 'EXERCISE_APPROVED', 'EXERCISE_PUBLISHED',
    'APPLICATION_SUBMITTED', 'DOCUMENT_REVIEWED', 'SCREENING_ASSIGNED',
    'SCREENING_RECORDED', 'SHORTLIST_APPROVED', 'EXAM_CANDIDATES_ASSIGNED',
    'EXAM_SCORE_RECORDED', 'EXAM_SCORES_VALIDATED', 'INTERVIEW_SCORE_RECORDED',
    'SELECTION_PREPARED', 'SELECTION_APPROVED', 'ACCESS_REFUSED',
  ]) {
    await page.goto(`${BASE}/admin/audit?action=${action}`, { waitUntil: 'domcontentloaded' });
    const text = await body(page);
    const found = !text.includes('No audit records match');
    record(`audit records ${action.replace(/_/g, ' ').toLowerCase()}`, found);
  }
  await page.goto(`${BASE}/admin/audit`, { waitUntil: 'domcontentloaded' });
  record('audit entries name the officer and time',
    (await body(page)).includes('Grace A. Onoja') || (await body(page)).includes('Daniel E. Ameh'));

  // The whole exercise exports
  for (const fmt of ['pdf', 'excel', 'csv']) {
    const res = await admin.context.request.get(`${BASE}/api/reports/exercise?exercise=${globalThis.exId}&format=${fmt}`);
    record(`completed exercise exports as ${fmt}`, res.status() === 200 && (await res.body()).length > 500);
  }
  await admin.context.close();
}

for (const { context } of [director, officer, screener, docOfficer, examOfficer]) await context.close();
for (const a of applicants) await a.context.close();
await browser.close();

console.log(`\n${pass}/${pass + fail} checks passed.`);
if (errors.length > 0) {
  console.log(`\nPage errors and 5xx responses (${errors.length}):`);
  for (const e of [...new Set(errors)].slice(0, 15)) console.log(`  - ${e}`);
}
process.exit(fail > 0 || errors.length > 0 ? 1 : 0);
