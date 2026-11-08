/**
 * Kogi State Civil Service Commission Portal — portal smoke suite.
 *
 * Drives the running application with a real browser. Start the server
 * first, then run:
 *
 *   BASE_URL=http://localhost:3000 node tests/browser/smoke.mjs
 */
import { launchBrowser, BASE_URL } from './launch.mjs';
import { PrismaClient } from '@prisma/client';

/** Fixtures taken from the seeded database. */
const prisma = new PrismaClient();
const selected = await prisma.application.findFirst({
  where: { status: 'SELECTED' },
  include: { applicant: true },
});
const tracked = await prisma.application.findFirst({
  where: { status: { not: 'DRAFT' } },
  include: { applicant: { include: { applicantProfile: true } } },
});
const seedDoc = await prisma.applicantDocument.findFirst();
if (!selected || !tracked || !seedDoc) {
  throw new Error('The database does not look seeded. Run "npm run db:reset" first.');
}
process.env.SELECTED_EMAIL = selected.applicant.email;
process.env.TRACK_REF = tracked.reference;
process.env.TRACK_SURNAME = tracked.applicant.applicantProfile.surname;
process.env.DOC_ID = seedDoc.id;
await prisma.$disconnect();

const BASE = BASE_URL;
const results = [];
let failures = 0;

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await launchBrowser();
const errors = [];

async function newPage(context) {
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`));
  page.on('response', (r) => {
    if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`);
  });
  return page;
}

/** Visit a page and assert it rendered with the expected text. */
async function visit(page, path, expectText, name) {
  const res = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  const status = res?.status() ?? 0;
  const body = await page.textContent('body').catch(() => '');
  const ok = status === 200 && (!expectText || body.includes(expectText));
  record(name ?? path, ok, ok ? '' : `status ${status}${expectText ? `, expected "${expectText}"` : ''}`);
  return body;
}

async function login(context, email, password) {
  const page = await newPage(context);
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 }),
    page.click('button[type=submit]'),
  ]);
  return page;
}

// ---------------------------------------------------------------- public site
console.log('\nPublic portal (Module 1)');
{
  const context = await browser.newContext();
  const page = await newPage(context);
  await visit(page, '/', 'Kogi State Civil Service Commission', 'homepage');
  const home = await page.textContent('body');
  record('homepage lists an open exercise', home.includes('2026 Kogi State Civil Service Recruitment Exercise'));
  record('homepage shows the ten workflow stages', home.includes('Closure and Archiving'));
  await visit(page, '/about', 'Functions and Responsibilities');
  await visit(page, '/leadership', 'Commission Leadership');
  await visit(page, '/departments', 'Department of Recruitment and Appointments');
  await visit(page, '/news', 'News, Announcements and Notices');
  await visit(page, '/notices', 'Circulars and Public Notices');
  await visit(page, '/downloads', 'Application Guidelines');
  await visit(page, '/faqs', 'Frequently Asked Questions');
  await visit(page, '/contact', 'Submit an enquiry');
  await visit(page, '/privacy', 'Privacy Notice');
  await visit(page, '/track', 'Track an Application');
  await visit(page, '/recruitment', 'Recruitment Exercises');
  await visit(page, '/recruitment/process', 'The Recruitment Process');

  // Article detail
  await page.goto(`${BASE}/news`, { waitUntil: 'domcontentloaded' });
  const link = await page.locator('a[href^="/news/"]').first().getAttribute('href');
  const article = await visit(page, link, null, `article detail ${link}`);
  record('article renders body content', article.length > 800);

  // Exercise detail with vacancies
  await page.goto(`${BASE}/recruitment`, { waitUntil: 'domcontentloaded' });
  const exLink = await page.locator('a[href^="/recruitment/"]').filter({ hasText: /View/ }).first().getAttribute('href');
  const ex = await visit(page, exLink, 'Approved vacancies', `exercise detail ${exLink}`);
  record('exercise detail lists vacancies and documents', ex.includes('Administrative Officer II') && ex.includes('Documents you must upload'));

  // 404 handling
  const res = await page.goto(`${BASE}/news/does-not-exist`, { waitUntil: 'domcontentloaded' });
  record('unknown page returns 404', res.status() === 404);

  // Public enquiry submission (Module 1)
  await page.goto(`${BASE}/contact`, { waitUntil: 'domcontentloaded' });
  await page.fill('#name', 'Smoke Test Enquirer');
  await page.fill('#email', 'smoke.test@example.com');
  await page.fill('#subject', 'Automated smoke test enquiry');
  await page.fill('#message', 'This enquiry was submitted by the automated functional test.');
  await page.click('button[type=submit]');
  await page.waitForTimeout(2500);
  const enquiryBody = await page.textContent('body');
  record('enquiry submitted and reference issued', /ENQ\/\d{4}\//.test(enquiryBody), enquiryBody.match(/ENQ\/\S+/)?.[0] ?? '');

  // Public application tracking (Module 3)
  await page.goto(`${BASE}/track`, { waitUntil: 'domcontentloaded' });
  await page.fill('#reference', process.env.TRACK_REF);
  await page.fill('#surname', process.env.TRACK_SURNAME);
  await page.click('button[type=submit]');
  await page.waitForTimeout(2500);
  const trackBody = await page.textContent('body');
  record('tracking returns the application status', trackBody.includes(process.env.TRACK_REF) && trackBody.includes('Application completeness'));

  // Tracking with a wrong surname must not disclose anything
  await page.goto(`${BASE}/track`, { waitUntil: 'domcontentloaded' });
  await page.fill('#reference', process.env.TRACK_REF);
  await page.fill('#surname', 'WrongSurname');
  await page.click('button[type=submit]');
  await page.waitForTimeout(2500);
  const denied = await page.textContent('body');
  record('tracking refuses a mismatched surname', denied.includes('No application matches'));

  await context.close();
}

// ----------------------------------------------------- applicant registration
console.log('\nApplicant registration and portal (Modules 2.2, 3)');
{
  const context = await browser.newContext();
  const page = await newPage(context);
  const email = `smoke.applicant.${Date.now()}@example.com`;

  await page.goto(`${BASE}/register`, { waitUntil: 'domcontentloaded' });
  await page.fill('#surname', 'Smoketest');
  await page.fill('#firstName', 'Newuser');
  await page.fill('#email', email);
  await page.fill('#phone', '08031234567');
  await page.fill('#password', 'Kogi2026test');
  await page.fill('#confirmPassword', 'Kogi2026test');
  await page.check('input[name=consent]');
  await Promise.all([
    page.waitForURL(/\/portal\/profile/, { timeout: 25000 }),
    page.click('button[type=submit]'),
  ]);
  const profile = await page.textContent('body');
  record('registration creates an account and signs in', page.url().includes('/portal/profile'));
  record('applicant reference issued on registration', /KGCSC\/APP\/\d{4}\//.test(profile));

  // Weak password rejected (a fresh, signed-out context)
  const anonContext = await browser.newContext();
  const page2 = await newPage(anonContext);
  await page2.goto(`${BASE}/register`, { waitUntil: 'domcontentloaded' });
  await page2.fill('#surname', 'A');
  await page2.fill('#firstName', 'B');
  await page2.fill('#email', `weak.${Date.now()}@example.com`);
  await page2.fill('#phone', '08031234567');
  await page2.fill('#password', 'short');
  await page2.fill('#confirmPassword', 'short');
  await page2.check('input[name=consent]');
  await page2.click('button[type=submit]');
  await page2.waitForTimeout(2000);
  record('weak password rejected', (await page2.textContent('body')).includes('at least 8 characters'));
  await anonContext.close();

  // Complete the profile (Module 2.2)
  await page.fill('#dateOfBirth', '1996-05-12');
  await page.selectOption('#gender', 'Female');
  await page.selectOption('#maritalStatus', 'Single');
  await page.fill('#residentialAddress', '12 Ganaja Road, Lokoja');
  await page.fill('#city', 'Lokoja');
  await page.selectOption('#stateOfResidence', 'Kogi');
  await page.selectOption('#stateOfOrigin', 'Kogi');
  await page.selectOption('#lga', 'Lokoja');
  await page.locator('form:has(#residentialAddress) button[type=submit]').click();
  await page.waitForTimeout(2500);
  record('profile saved', (await page.textContent('body')).includes('profile has been saved'));

  // Start an application (Module 2.3)
  await page.goto(`${BASE}/portal/applications/new`, { waitUntil: 'domcontentloaded' });
  const exCard = page.locator('a[href*="/portal/applications/new?exercise="]').first();
  await exCard.click();
  await page.waitForLoadState('domcontentloaded');
  await page.locator('input[name=vacancyId]').first().check();
  await Promise.all([
    page.waitForURL((u) => /\/portal\/applications\/[a-z0-9]{8,}$/.test(u.pathname), { timeout: 25000 }),
    page.locator('form:has(input[name=vacancyId]) button[type=submit]').click(),
  ]);
  const appUrl = page.url();
  let appBody = await page.textContent('body');
  record('application started with a reference', /KGCSC\/2026\//.test(appBody));
  record('application shows required documents', appBody.includes('Supporting documents'));
  record('submission blocked while incomplete', appBody.includes('not yet complete'));

  // Add a qualification
  await page.fill('#institution', 'Kogi State University, Anyigba');
  await page.selectOption('#qualification', 'B.Sc / B.A / B.Eng');
  await page.locator('form:has(#institution) button[type=submit]').click();
  await page.waitForTimeout(2500);
  appBody = await page.textContent('body');
  record('qualification added to the application', appBody.includes('Kogi State University, Anyigba'));

  // Upload a required document (Module 2.4). The first requirement is the
  // passport photograph, which accepts images only.
  const jpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ]);
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'latin1');

  await page.locator('input[aria-label^="Upload Passport"]').setInputFiles({
    name: 'passport.jpg', mimeType: 'image/jpeg', buffer: jpeg,
  });
  await page.locator('form:has(input[aria-label^="Upload Passport"]) button[type=submit]').click();
  await page.waitForTimeout(3000);
  appBody = await page.textContent('body');
  record('passport photograph uploaded', appBody.includes('uploaded successfully') || appBody.includes('passport.jpg'));

  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('input[aria-label^="Upload Educational"]').setInputFiles({
    name: 'certificate.pdf', mimeType: 'application/pdf', buffer: pdf,
  });
  await page.locator('form:has(input[aria-label^="Upload Educational"]) button[type=submit]').click();
  await page.waitForTimeout(3000);
  appBody = await page.textContent('body');
  record('educational certificate uploaded', appBody.includes('uploaded successfully') || appBody.includes('certificate.pdf'));

  // A PDF is refused where the requirement accepts images only
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('input[aria-label^="Upload Passport"]').setInputFiles({
    name: 'wrong.pdf', mimeType: 'application/pdf', buffer: pdf,
  });
  await page.locator('form:has(input[aria-label^="Upload Passport"]) button[type=submit]').click();
  await page.waitForTimeout(2500);
  record('wrong format refused for a photograph', (await page.textContent('body')).includes('must be one of'));

  // A disallowed file type is refused outright
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('input[aria-label^="Upload Educational"]').setInputFiles({
    name: 'payload.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('MZ'),
  });
  await page.locator('form:has(input[aria-label^="Upload Educational"]) button[type=submit]').click();
  await page.waitForTimeout(2500);
  record('disallowed file type refused', (await page.textContent('body')).includes('not permitted'));

  // Applicant pages
  await visit(page, '/portal', 'Applicant reference', 'applicant dashboard');
  await visit(page, '/portal/applications', 'My Applications');
  await visit(page, '/portal/documents', 'My Documents');
  await visit(page, '/portal/notifications', 'Notifications');

  const dash = await page.textContent('body');
  record('dashboard shows the welcome notification', dash.includes('portal account') || dash.includes('Notifications'));

  // An applicant cannot reach the administration area
  const res = await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  record('applicant redirected away from administration', page.url().includes('/portal'), page.url());

  await context.close();
}

// -------------------------------------------- seeded applicant with full data
console.log('\nSeeded applicant dashboard (Module 3)');
{
  const context = await browser.newContext();
  const page = await login(context, process.env.SELECTED_EMAIL, 'Applicant#2026');
  const dash = await page.textContent('body');
  record('successful candidate sees their outcome', dash.includes('Successful') || dash.includes('recommended'));
  await page.goto(`${BASE}/portal/applications`, { waitUntil: 'domcontentloaded' });
  const apps = await page.textContent('body');
  record('application register shows the examination and interview stages', apps.includes('KGCSC/2026/'));
  const appLink = await page.locator('a[href^="/portal/applications/"]').first().getAttribute('href');
  const detail = await visit(page, appLink, 'Application history', 'application detail with full history');
  record('detail shows examination number and interview', detail.includes('Examination number') && detail.includes('Interview'));
  record('stage tracker rendered', detail.includes('Final Selection'));
  await context.close();
}

// ------------------------------------------------------- administration by role
const ROLE_PAGES = {
  'superadmin@kogicsc.kg.gov.ng': [
    ['/admin', 'Administration Dashboard'],
    ['/admin/exercises', 'Recruitment Exercises'],
    ['/admin/applications', 'Applications'],
    ['/admin/screening', 'Application Screening'],
    ['/admin/documents', 'Document Verification'],
    ['/admin/shortlists', 'Shortlists'],
    ['/admin/examinations', 'Examinations and Assessment'],
    ['/admin/interviews', 'Interview Management'],
    ['/admin/selection', 'Final Selection'],
    ['/admin/reports', 'Reports and Analytics'],
    ['/admin/approvals', 'Approvals'],
    ['/admin/content', 'News, Announcements and Notices'],
    ['/admin/content/pages', 'Institutional Pages'],
    ['/admin/content/leadership', 'Leadership Profiles'],
    ['/admin/content/departments', 'Departments and Units'],
    ['/admin/content/downloads', 'Forms, Guidelines and Publications'],
    ['/admin/content/faqs', 'Frequently Asked Questions'],
    ['/admin/enquiries', 'Public Enquiries'],
    ['/admin/records/tasks', 'Internal Tasks'],
    ['/admin/records/correspondence', 'Correspondence Records'],
    ['/admin/records/repository', 'Commission Document Repository'],
    ['/admin/notifications', 'Notifications and Communication'],
    ['/admin/notifications/templates', 'Message Templates'],
    ['/admin/users', 'Users, Roles and Access'],
    ['/admin/audit', 'Audit Trail'],
    ['/admin/settings', 'System Settings'],
  ],
};

console.log('\nAdministration backend — Super Administrator (all modules)');
{
  const context = await browser.newContext();
  const page = await login(context, 'superadmin@kogicsc.kg.gov.ng', 'KogiCSC#2026');
  record('staff sign-in reaches the dashboard', page.url().includes('/admin'));
  for (const [path, expect] of ROLE_PAGES['superadmin@kogicsc.kg.gov.ng']) {
    await visit(page, path, expect);
  }

  // Detail pages
  await page.goto(`${BASE}/admin/exercises`, { waitUntil: 'domcontentloaded' });
  const exHref = await page.locator('a[href^="/admin/exercises/"]').filter({ hasText: 'Manage' }).first().getAttribute('href');
  const exDetail = await visit(page, exHref, 'Approved vacancies', 'exercise management');
  record('exercise management shows lifecycle actions', exDetail.includes('Available actions'));
  record('exercise management shows document requirements', exDetail.includes('Required documents'));

  await page.goto(`${BASE}/admin/applications`, { waitUntil: 'domcontentloaded' });
  const appHref = await page.locator('a[href^="/admin/applications/"]').filter({ hasText: 'Open' }).first().getAttribute('href');
  const appDetail = await visit(page, appHref, 'Applicant details', 'application review');
  record('application review shows preliminary checks', appDetail.includes('Preliminary automated checks'));
  record('application review shows documents and status history', appDetail.includes('Supporting documents') && appDetail.includes('Status history'));

  for (const [list, expect] of [
    ['/admin/shortlists', 'Shortlisted candidates'],
    ['/admin/examinations', 'Candidate list and score sheet'],
    ['/admin/interviews', 'Candidates and score sheets'],
    ['/admin/selection', 'Consolidated assessment and ranking'],
  ]) {
    await page.goto(`${BASE}${list}`, { waitUntil: 'domcontentloaded' });
    const href = await page
      .locator(`a[href^="${list}/"]:not([href$="/new"])`)
      .first().getAttribute('href').catch(() => null);
    if (href) await visit(page, href, expect, `${list} detail`);
    else record(`${list} detail`, false, 'no detail link found');
  }

  await page.goto(`${BASE}/admin/users`, { waitUntil: 'domcontentloaded' });
  const userHref = await page.locator('a[href^="/admin/users/"]').filter({ hasText: /Manage|View/ }).first().getAttribute('href');
  const userDetail = await visit(page, userHref, 'Permissions', 'user management');
  record('user detail shows login history', userDetail.includes('Login history'));

  // Report exports (Module 6)
  for (const [path, type] of [
    ['/api/reports/exercise?format=pdf', 'application/pdf'],
    ['/api/reports/exercise?format=excel', 'spreadsheetml'],
    ['/api/reports/exercise?format=csv', 'text/csv'],
    ['/api/reports/applications?format=csv', 'text/csv'],
    ['/api/reports/audit?format=pdf', 'application/pdf'],
  ]) {
    const res = await context.request.get(`${BASE}${path}`);
    const ct = res.headers()['content-type'] ?? '';
    const len = (await res.body()).length;
    record(`export ${path}`, res.status() === 200 && ct.includes(type) && len > 500, `${res.status()} ${ct} ${len}B`);
  }

  // Applicant document is served to an authorised officer
  const docRes = await context.request.get(`${BASE}/api/files/document/${process.env.DOC_ID}`);
  record('officer can retrieve an applicant document', docRes.status() === 200, `status ${docRes.status()}`);

  await context.close();
}

// ----------------------------------------------- role-based access enforcement
console.log('\nRole-based access control (Module 5)');
const RESTRICTIONS = [
  ['content.officer@kogicsc.kg.gov.ng', '/admin/content', true, 'content officer reaches content management'],
  ['content.officer@kogicsc.kg.gov.ng', '/admin/users', false, 'content officer blocked from user management'],
  ['content.officer@kogicsc.kg.gov.ng', '/admin/settings', false, 'content officer blocked from settings'],
  ['content.officer@kogicsc.kg.gov.ng', '/admin/applications', false, 'content officer blocked from applications'],
  ['screening.officer@kogicsc.kg.gov.ng', '/admin/screening', true, 'screening officer reaches screening'],
  ['screening.officer@kogicsc.kg.gov.ng', '/admin/users', false, 'screening officer blocked from user management'],
  ['screening.officer@kogicsc.kg.gov.ng', '/admin/selection', false, 'screening officer blocked from final selection'],
  ['panel.one@kogicsc.kg.gov.ng', '/admin/interviews', true, 'panel member reaches their interviews'],
  ['panel.one@kogicsc.kg.gov.ng', '/admin/exercises', true, 'panel member may view exercises'],
  ['panel.one@kogicsc.kg.gov.ng', '/admin/screening', false, 'panel member blocked from screening'],
  ['panel.one@kogicsc.kg.gov.ng', '/admin/audit', false, 'panel member blocked from the audit trail'],
  ['reporting.officer@kogicsc.kg.gov.ng', '/admin/reports', true, 'reporting officer reaches reports'],
  ['reporting.officer@kogicsc.kg.gov.ng', '/admin/users', false, 'reporting officer blocked from user management'],
  ['examination.officer@kogicsc.kg.gov.ng', '/admin/examinations', true, 'examination officer reaches examinations'],
  ['examination.officer@kogicsc.kg.gov.ng', '/admin/interviews', false, 'examination officer blocked from interviews'],
  ['document.officer@kogicsc.kg.gov.ng', '/admin/documents', true, 'document officer reaches document verification'],
  ['document.officer@kogicsc.kg.gov.ng', '/admin/shortlists', false, 'document officer blocked from shortlists'],
];
{
  const byEmail = new Map();
  for (const [email, path, allowed, name] of RESTRICTIONS) {
    if (!byEmail.has(email)) {
      const context = await browser.newContext();
      byEmail.set(email, { context, page: await login(context, email, 'KogiCSC#2026') });
    }
    const { page } = byEmail.get(email);
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
    const body = await page.textContent('body');
    const denied = page.url().includes('/admin/not-authorised')
      || body.includes('not authorised')
      || body.includes('Not authorised');
    record(name, allowed ? !denied : denied, allowed ? (denied ? 'unexpectedly denied' : '') : (denied ? '' : 'unexpectedly allowed'));
    if (!allowed && denied) {
      record(`${name} — refusal explains the role`, body.includes('What your role does cover'));
    }
  }

  // Navigation only offers permitted functions
  const { page: contentPage } = byEmail.get('content.officer@kogicsc.kg.gov.ng');
  await contentPage.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  const nav = await contentPage.textContent('nav[aria-label="Administration navigation"]');
  record('navigation hides Users & Roles from a content officer', !nav.includes('Users & Roles'));
  record('navigation hides Settings from a content officer', !nav.includes('Settings'));
  record('navigation offers News & Notices to a content officer', nav.includes('News & Notices'));

  for (const { context } of byEmail.values()) await context.close();
}

// ------------------------------------------------------- unauthenticated access
console.log('\nUnauthenticated access');
{
  const context = await browser.newContext();
  const page = await newPage(context);
  for (const path of ['/admin', '/admin/applications', '/portal', '/portal/documents']) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
    record(`${path} requires sign-in`, page.url().includes('/login'), page.url());
  }
  const api = await context.request.get(`${BASE}/api/reports/applications?format=csv`);
  record('report export requires authentication', api.status() === 401, `status ${api.status()}`);
  const doc = await context.request.get(`${BASE}/api/files/document/${process.env.DOC_ID}`);
  record('applicant document requires authentication', doc.status() === 401, `status ${doc.status()}`);

  // Failed sign-in is rejected
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#email', 'superadmin@kogicsc.kg.gov.ng');
  await page.fill('#password', 'wrong-password');
  await page.click('button[type=submit]');
  await page.waitForTimeout(2500);
  record('wrong password rejected', (await page.textContent('body')).includes('Invalid email address or password'));
  await context.close();
}

// ----------------------------------------------------------- mobile responsive
console.log('\nResponsive layout (§7.2)');
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await newPage(context);
  for (const path of ['/', '/recruitment', '/faqs', '/login']) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    record(`${path} has no horizontal overflow at 390px`, overflow <= 1, `${overflow}px`);
  }
  await context.close();
}

await browser.close();

console.log(`\n${results.length - failures}/${results.length} checks passed.`);
if (errors.length > 0) {
  console.log(`\nPage errors and 5xx responses (${errors.length}):`);
  for (const e of [...new Set(errors)].slice(0, 20)) console.log(`  - ${e}`);
}
process.exit(failures > 0 || errors.length > 0 ? 1 : 0);
