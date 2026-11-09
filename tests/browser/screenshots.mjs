/**
 * Kogi State Civil Service Commission Portal — screenshot capture.
 *
 * Captures every significant screen of the portal from the running
 * application, signing in as the role that can reach each one. Useful for
 * review packs, user acceptance testing and the administrator manual.
 *
 * Start the server first, then run:
 *
 *   BASE_URL=http://localhost:3000 OUT_DIR=./screens node tests/browser/screenshots.mjs
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { launchBrowser, BASE_URL } from './launch.mjs';

const OUT = path.resolve(process.env.OUT_DIR ?? './screens');
const STAFF_PASSWORD = process.env.STAFF_PASSWORD ?? 'KogiCSC#2026';
const APPLICANT_PASSWORD = process.env.APPLICANT_PASSWORD ?? 'Applicant#2026';

await mkdir(OUT, { recursive: true });

// Seeded records to link to, so the capture works against any seeded database.
const prisma = new PrismaClient();
const [selectedApp, qualifiedApp, exercise, article, exam, interview, selection, shortlist, tracked] =
  await Promise.all([
    prisma.application.findFirst({ where: { status: 'SELECTED' }, include: { applicant: true } }),
    prisma.application.findFirst({ where: { status: 'QUALIFIED' }, select: { id: true } }),
    prisma.recruitmentExercise.findFirst({ where: { status: 'PUBLISHED' }, select: { id: true } }),
    prisma.article.findFirst({ where: { status: 'PUBLISHED' }, select: { slug: true } }),
    prisma.examSchedule.findFirst({ where: { status: 'COMPLETED' }, select: { id: true } }),
    prisma.interviewSchedule.findFirst({ select: { id: true } }),
    prisma.selectionList.findFirst({ where: { status: 'APPROVED' }, select: { id: true } }),
    prisma.shortlist.findFirst({ where: { status: 'APPROVED' }, select: { id: true } }),
    prisma.application.findFirst({
      where: { status: { not: 'DRAFT' } },
      include: { applicant: { include: { applicantProfile: true } } },
    }),
  ]);
await prisma.$disconnect();

if (!selectedApp || !exercise || !article || !tracked) {
  throw new Error('The database does not look seeded. Run "npm run db:reset" first.');
}

const browser = await launchBrowser();
let count = 0;

const desktop = () =>
  browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const phone = () =>
  browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

async function signIn(context, email, password) {
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 25000 }),
    page.click('button[type=submit]'),
  ]);
  return page;
}

async function shot(page, route, name, label) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  count += 1;
  console.log(`  ${name}  ${label}`);
}

// ------------------------------------------------------------ public portal
console.log('Public portal (Module 1)');
{
  const context = await desktop();
  const page = await context.newPage();
  await shot(page, '/', '01-public-home', 'Homepage');
  await shot(page, '/recruitment', '02-public-recruitment', 'Current recruitment exercises');
  await shot(page, `/recruitment/${exercise.id}`, '03-public-exercise', 'Exercise detail');
  await shot(page, '/recruitment/process', '04-public-process', 'The ten-stage process');
  await shot(page, '/about', '05-public-about', 'The Commission');
  await shot(page, '/leadership', '06-public-leadership', 'Leadership');
  await shot(page, '/departments', '07-public-departments', 'Departments and units');
  await shot(page, `/news/${article.slug}`, '08-public-article', 'Published announcement');
  await shot(page, '/notices', '09-public-notices', 'Circulars and public notices');
  await shot(page, '/downloads', '10-public-downloads', 'Downloads');
  await shot(page, '/faqs', '11-public-faqs', 'Frequently asked questions');
  await shot(page, '/contact', '12-public-contact', 'Contact and enquiries');

  // Tracking, showing a result rather than an empty form
  await page.goto(`${BASE_URL}/track`, { waitUntil: 'domcontentloaded' });
  await page.fill('#reference', tracked.reference);
  await page.fill('#surname', tracked.applicant.applicantProfile.surname);
  await page.click('button[type=submit]');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, '13-public-track.png'), fullPage: true });
  count += 1;
  console.log('  13-public-track  Application tracking result');

  await shot(page, '/register', '14-auth-register', 'Applicant registration');
  await shot(page, '/login', '15-auth-login', 'Sign in');
  await context.close();
}

// --------------------------------------------------------- applicant portal
console.log('Applicant portal (Modules 2.2–2.4, 3)');
{
  const context = await desktop();
  const page = await signIn(context, selectedApp.applicant.email, APPLICANT_PASSWORD);
  await shot(page, '/portal', '16-applicant-dashboard', 'Applicant dashboard');
  await shot(page, `/portal/applications/${selectedApp.id}`, '17-applicant-application', 'Application detail');
  await shot(page, '/portal/applications', '18-applicant-applications', 'My applications');
  await shot(page, '/portal/documents', '19-applicant-documents', 'My documents');
  await shot(page, '/portal/notifications', '20-applicant-notifications', 'Notifications');
  await shot(page, '/portal/profile', '21-applicant-profile', 'Profile');
  await context.close();
}

// ------------------------------------------------------------ administration
console.log('Administration (Modules 2, 4–8)');
{
  const context = await desktop();
  const page = await signIn(context, 'superadmin@kogicsc.kg.gov.ng', STAFF_PASSWORD);
  await shot(page, '/admin', '22-admin-dashboard', 'Administration dashboard');
  await shot(page, '/admin/exercises', '23-admin-exercises', 'Exercise register');
  await shot(page, `/admin/exercises/${exercise.id}`, '24-admin-exercise', 'Exercise management');
  await shot(page, '/admin/applications', '25-admin-applications', 'Application register');
  if (qualifiedApp) {
    await shot(page, `/admin/applications/${qualifiedApp.id}`, '26-admin-application', 'Application review');
  }
  await shot(page, '/admin/screening', '27-admin-screening', 'Screening workspace');
  await shot(page, '/admin/documents', '28-admin-documents', 'Document verification queue');
  if (shortlist) await shot(page, `/admin/shortlists/${shortlist.id}`, '29-admin-shortlist', 'Shortlist');
  if (exam) await shot(page, `/admin/examinations/${exam.id}`, '30-admin-examination', 'Examination');
  if (interview) await shot(page, `/admin/interviews/${interview.id}`, '31-admin-interview', 'Interview');
  if (selection) await shot(page, `/admin/selection/${selection.id}`, '32-admin-selection', 'Final selection');
  await shot(page, '/admin/reports', '33-admin-reports', 'Reports and analytics');
  await shot(page, '/admin/audit', '34-admin-audit', 'Audit trail');
  await shot(page, '/admin/users', '35-admin-users', 'Users, roles and access');
  await shot(page, '/admin/content', '36-admin-content', 'News and notices');
  await shot(page, '/admin/notifications', '37-admin-notifications', 'Notifications');
  await shot(page, '/admin/records/repository', '38-admin-repository', 'Document repository');
  await shot(page, '/admin/approvals', '39-admin-approvals', 'Approvals queue');
  await shot(page, '/admin/settings', '40-admin-settings', 'System settings');
  await context.close();
}

// -------------------------------------------------------- role-based access
console.log('Role-based access control (Module 5)');
{
  const context = await desktop();
  const page = await signIn(context, 'content.officer@kogicsc.kg.gov.ng', STAFF_PASSWORD);
  await shot(page, '/admin', '41-role-content-officer', 'Content Officer dashboard');
  await shot(page, '/admin/users', '42-role-refused', 'Access refused');
  await context.close();
}

// -------------------------------------------------------------------- mobile
console.log('Mobile (§7.2)');
{
  const context = await phone();
  const page = await context.newPage();
  await shot(page, '/', '43-mobile-home', 'Homepage at 390px');
  await shot(page, '/recruitment', '44-mobile-recruitment', 'Vacancies at 390px');
  await context.close();
}

await browser.close();
console.log(`\n${count} screenshots written to ${OUT}`);
