/**
 * Integration tests against the seeded development database.
 * Read-only assertions verify the seeded recruitment lifecycle; the write
 * tests create their own records and remove them afterwards.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  APPLICATION_STATUS, EXERCISE_STATUS, ROLES, ROLE_LABELS, STAFF_ROLES,
} from '@/lib/constants';
import { permissionsForRole } from '@/lib/rbac';
import { computeCompleteness, canTransitionApplication } from '@/lib/workflow';
import { finalScore, rankEntries } from '@/lib/scoring';
import { DEFAULT_TEMPLATES } from '@/lib/notification-templates';

const prisma = new PrismaClient();
const A = APPLICATION_STATUS;
const created: Array<() => Promise<unknown>> = [];

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  for (const cleanup of created.reverse()) await cleanup().catch(() => undefined);
  await prisma.$disconnect();
});

describe('seeded institutional data (Modules 1, 4, 5)', () => {
  it('has an account for every staff role', async () => {
    for (const role of STAFF_ROLES) {
      const count = await prisma.user.count({ where: { role, active: true } });
      expect(count, `${ROLE_LABELS[role]} has no active account`).toBeGreaterThan(0);
    }
  });

  it('stores every password hashed, never in clear text', async () => {
    const users = await prisma.user.findMany({ select: { passwordHash: true }, take: 20 });
    expect(users.length).toBeGreaterThan(0);
    for (const u of users) {
      expect(u.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
      expect(u.passwordHash).not.toContain('KogiCSC');
    }
  });

  it('verifies a seeded password against its hash', async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'superadmin@kogicsc.kg.gov.ng' } });
    expect(await bcrypt.compare('KogiCSC#2026', admin.passwordHash)).toBe(true);
    expect(await bcrypt.compare('wrong-password', admin.passwordHash)).toBe(false);
  });

  it('has departments, units and a department hierarchy', async () => {
    expect(await prisma.department.count({ where: { kind: 'DEPARTMENT' } })).toBeGreaterThanOrEqual(6);
    expect(await prisma.department.count({ where: { kind: 'UNIT' } })).toBeGreaterThanOrEqual(6);
    expect(await prisma.department.count({ where: { parentId: { not: null } } })).toBeGreaterThan(0);
  });

  it('publishes the institutional pages the public portal reads', async () => {
    for (const slug of ['homepage', 'about', 'mandate', 'functions', 'privacy', 'recruitment-process']) {
      const page = await prisma.pageContent.findUnique({ where: { slug } });
      expect(page, `page "${slug}" is missing`).toBeTruthy();
      expect(page!.published).toBe(true);
      expect(page!.body.length).toBeGreaterThan(50);
    }
  });

  it('publishes leadership profiles, FAQs and downloads', async () => {
    expect(await prisma.leadershipProfile.count({ where: { published: true } })).toBeGreaterThanOrEqual(5);
    expect(await prisma.faq.count({ where: { published: true } })).toBeGreaterThanOrEqual(15);
    expect(await prisma.downloadItem.count({ where: { published: true } })).toBeGreaterThanOrEqual(5);
  });

  it('publishes news, a circular and a public notice', async () => {
    for (const type of ['ANNOUNCEMENT', 'CIRCULAR', 'NOTICE', 'NEWS', 'RECRUITMENT_NOTICE']) {
      expect(
        await prisma.article.count({ where: { type, status: 'PUBLISHED' } }),
        `no published ${type}`,
      ).toBeGreaterThan(0);
    }
  });

  it('holds an item awaiting approval with a matching approval request', async () => {
    const pending = await prisma.article.findFirst({ where: { status: 'PENDING_APPROVAL' } });
    expect(pending).toBeTruthy();
    const request = await prisma.approvalRequest.findFirst({
      where: { entityType: 'ARTICLE', entityId: pending!.id, status: 'PENDING' },
    });
    expect(request).toBeTruthy();
  });

  it('stores every notification template', async () => {
    for (const code of Object.keys(DEFAULT_TEMPLATES)) {
      const t = await prisma.notificationTemplate.findUnique({ where: { code } });
      expect(t, `template ${code} is missing`).toBeTruthy();
      expect(t!.active).toBe(true);
    }
  });

  it('holds Commission administrative records with classification (Module 4)', async () => {
    expect(await prisma.staffTask.count()).toBeGreaterThanOrEqual(5);
    expect(await prisma.correspondence.count()).toBeGreaterThanOrEqual(5);
    expect(await prisma.repositoryDocument.count({ where: { classification: 'RESTRICTED' } })).toBeGreaterThan(0);
    expect(await prisma.repositoryDocument.count({ where: { classification: 'CONFIDENTIAL' } })).toBeGreaterThan(0);
  });

  it('holds public enquiries with responses recorded', async () => {
    expect(await prisma.enquiry.count()).toBeGreaterThanOrEqual(5);
    const responded = await prisma.enquiry.findFirst({ where: { status: 'RESPONDED' } });
    expect(responded?.response).toBeTruthy();
    expect(responded?.respondedAt).toBeTruthy();
  });
});

describe('seeded recruitment exercise (Modules 2.1 – 2.8)', () => {
  it('publishes an exercise with approved vacancies', async () => {
    const exercise = await prisma.recruitmentExercise.findUniqueOrThrow({
      where: { reference: 'KGCSC/REC/2026/001' },
      include: { vacancies: true, requirements: true, formFields: true },
    });
    expect(exercise.status).toBe(EXERCISE_STATUS.PUBLISHED);
    expect(exercise.approvedById).toBeTruthy();
    expect(exercise.publishedAt).toBeTruthy();
    expect(exercise.vacancies.length).toBeGreaterThanOrEqual(6);
    expect(exercise.vacancies.reduce((s, v) => s + v.positions, 0)).toBe(148);
    expect(exercise.requirements.filter((r) => r.required).length).toBeGreaterThanOrEqual(5);
    expect(exercise.formFields.length).toBeGreaterThan(0);
  });

  it('has an exercise awaiting approval and a closed exercise', async () => {
    expect(await prisma.recruitmentExercise.count({ where: { status: EXERCISE_STATUS.PENDING_APPROVAL } })).toBeGreaterThan(0);
    expect(await prisma.recruitmentExercise.count({ where: { status: EXERCISE_STATUS.CLOSED } })).toBeGreaterThan(0);
  });

  it('holds applications at every stage of the workflow', async () => {
    for (const status of [
      A.DRAFT, A.SUBMITTED, A.UNDER_SCREENING, A.RESUBMISSION_REQUIRED,
      A.DISQUALIFIED, A.QUALIFIED, A.SHORTLISTED, A.EXAM_COMPLETED,
      A.SELECTED, A.NOT_SELECTED, A.WITHDRAWN,
    ]) {
      expect(
        await prisma.application.count({ where: { status } }),
        `no application at status ${status}`,
      ).toBeGreaterThan(0);
    }
  });

  it('gives every applicant a unique reference and a complete profile', async () => {
    const applicants = await prisma.user.findMany({
      where: { role: ROLES.APPLICANT },
      include: { applicantProfile: true },
    });
    expect(applicants.length).toBeGreaterThanOrEqual(30);
    const refs = new Set<string>();
    for (const a of applicants) {
      expect(a.applicantProfile, `${a.email} has no profile`).toBeTruthy();
      expect(a.applicantProfile!.profileComplete).toBe(true);
      expect(refs.has(a.applicantProfile!.applicantRef)).toBe(false);
      refs.add(a.applicantProfile!.applicantRef);
    }
  });

  it('records a submission date and declaration on every submitted application', async () => {
    const submitted = await prisma.application.findMany({
      where: { status: { notIn: [A.DRAFT, A.WITHDRAWN] } },
    });
    expect(submitted.length).toBeGreaterThan(0);
    for (const app of submitted) {
      expect(app.submittedAt, app.reference).toBeTruthy();
      expect(app.declaration, app.reference).toBe(true);
      expect(app.consent, app.reference).toBe(true);
      expect(app.completeness).toBe(100);
    }
  });

  it('keeps draft applications below full completeness', async () => {
    for (const draft of await prisma.application.findMany({ where: { status: A.DRAFT } })) {
      expect(draft.submittedAt).toBeNull();
      expect(draft.completeness).toBeLessThan(100);
    }
  });

  it('records a status history that follows permitted transitions', async () => {
    const apps = await prisma.application.findMany({
      where: { status: { not: A.DRAFT } },
      include: { statusHistory: { orderBy: { createdAt: 'asc' } } },
      take: 15,
    });
    for (const app of apps) {
      expect(app.statusHistory.length, app.reference).toBeGreaterThan(0);
      const path = app.statusHistory.map((h) => h.toStatus);
      for (let i = 0; i < path.length - 1; i += 1) {
        expect(
          canTransitionApplication(path[i], path[i + 1]),
          `${app.reference}: ${path[i]} → ${path[i + 1]}`,
        ).toBe(true);
      }
    }
  });

  it('records a screening decision against a named officer', async () => {
    const records = await prisma.screeningRecord.findMany({
      include: { officer: { select: { fullName: true, role: true } } },
      take: 20,
    });
    expect(records.length).toBeGreaterThan(0);
    for (const r of records) {
      expect(r.officer, 'screening decision has no officer').toBeTruthy();
      expect(['PASSED', 'FAILED', 'RESUBMISSION_REQUIRED']).toContain(r.outcome);
      if (r.outcome !== 'PASSED') expect(r.remarks, 'a failed outcome has no reason').toBeTruthy();
    }
  });

  it('requires a reason on every rejected document', async () => {
    const rejected = await prisma.applicantDocument.findMany({
      where: { reviewStatus: { in: ['REJECTED', 'RESUBMISSION_REQUIRED'] } },
      include: { reviews: true },
    });
    expect(rejected.length).toBeGreaterThan(0);
    for (const d of rejected) {
      expect(d.reviewNotes, `${d.label} has no reason`).toBeTruthy();
      expect(d.reviewedById).toBeTruthy();
      expect(d.reviews.length).toBeGreaterThan(0);
    }
  });

  it('approves a shortlist and marks its candidates shortlisted', async () => {
    const shortlist = await prisma.shortlist.findFirstOrThrow({
      where: { status: 'APPROVED' },
      include: { entries: { include: { application: true } } },
    });
    expect(shortlist.approvedById).toBeTruthy();
    expect(shortlist.notifiedAt).toBeTruthy();
    expect(shortlist.entries.length).toBeGreaterThan(0);
    for (const entry of shortlist.entries) {
      expect(entry.application.shortlisted, entry.application.reference).toBe(true);
    }
  });

  it('issues a unique examination number and a centre to every exam candidate', async () => {
    const candidates = await prisma.examCandidate.findMany({
      include: { centre: true, schedule: true },
    });
    expect(candidates.length).toBeGreaterThan(0);
    const numbers = new Set<string>();
    for (const c of candidates) {
      expect(c.examNumber).toMatch(/^KGE\/\d{4}\/\d{6}$/);
      expect(numbers.has(c.examNumber)).toBe(false);
      numbers.add(c.examNumber);
      expect(c.centre, `${c.examNumber} has no centre`).toBeTruthy();
      if (c.attendance === 'PRESENT') {
        expect(c.score, `${c.examNumber} is present with no score`).not.toBeNull();
        expect(c.score!).toBeGreaterThanOrEqual(0);
        expect(c.score!).toBeLessThanOrEqual(c.schedule.totalMarks);
      }
      if (c.attendance === 'ABSENT') expect(c.score).toBeNull();
    }
  });

  it('never allocates more candidates to a centre than its capacity', async () => {
    const centres = await prisma.examCentre.findMany({ include: { _count: { select: { candidates: true } } } });
    for (const c of centres) {
      expect(c._count.candidates, c.name).toBeLessThanOrEqual(c.capacity);
    }
  });

  it('records panel scores within range and consolidates them by mean', async () => {
    const candidates = await prisma.interviewCandidate.findMany({
      include: { schedule: true, scores: true },
    });
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates.filter((x) => x.attendance === 'PRESENT')) {
      expect(c.scores.length, 'a present candidate has no panel score').toBeGreaterThan(0);
      for (const s of c.scores) {
        expect(s.total).toBeGreaterThanOrEqual(0);
        expect(s.total).toBeLessThanOrEqual(c.schedule.totalMarks);
      }
      const mean = c.scores.reduce((s, x) => s + x.total, 0) / c.scores.length;
      expect(c.consolidatedScore).toBeCloseTo(mean, 1);
    }
  });

  it('assigns every interview candidate to a panel with members', async () => {
    const candidates = await prisma.interviewCandidate.findMany({
      include: { panel: { include: { members: true } } },
    });
    for (const c of candidates) {
      expect(c.panel, 'interview candidate has no panel').toBeTruthy();
      expect(c.panel!.members.length).toBeGreaterThan(0);
      expect(c.slotTime).toMatch(/^\d{2}:\d{2}$/);
    }
  });

  it('approves a selection list whose final scores match the approved weighting', async () => {
    const list = await prisma.selectionList.findFirstOrThrow({
      where: { status: 'APPROVED' },
      include: { entries: { include: { application: true } } },
    });
    expect(list.approvedById).toBeTruthy();
    expect(list.approvedAt).toBeTruthy();
    expect(list.notifiedAt).toBeTruthy();
    expect(list.entries.length).toBeGreaterThan(0);

    for (const entry of list.entries) {
      const expected = finalScore({
        examScore: entry.examScore, interviewScore: entry.interviewScore,
        examWeight: list.examWeight, interviewWeight: list.interviewWeight,
      });
      expect(entry.finalScore).toBeCloseTo(expected ?? 0, 1);
      expect(['SELECTED', 'NOT_SELECTED', 'RESERVE']).toContain(entry.outcome);
      expect(
        entry.outcome === 'SELECTED' ? A.SELECTED : A.NOT_SELECTED,
      ).toBe(entry.application.status);
    }
  });

  it('ranks selection entries consistently with their final scores', async () => {
    const list = await prisma.selectionList.findFirstOrThrow({
      where: { status: 'APPROVED' },
      include: { entries: true },
    });
    const expected = rankEntries(list.entries.map((e) => ({ id: e.id, finalScore: e.finalScore })));
    const byId = new Map(expected.map((e) => [e.id, e.rank]));
    for (const entry of list.entries) {
      expect(entry.rank, `entry ${entry.id}`).toBe(byId.get(entry.id));
    }
  });

  it('never selects more candidates than a vacancy has approved posts', async () => {
    const vacancies = await prisma.vacancy.findMany({
      include: { applications: { where: { status: A.SELECTED }, select: { id: true } } },
    });
    for (const v of vacancies) {
      expect(v.applications.length, v.jobTitle).toBeLessThanOrEqual(v.positions);
    }
  });
});

describe('notifications and audit (Modules 7, 8)', () => {
  it('sends an acknowledgement for every submitted application', async () => {
    const submitted = await prisma.application.count({ where: { status: { notIn: [A.DRAFT, A.WITHDRAWN] } } });
    const acks = await prisma.notification.count({ where: { templateCode: 'APPLICATION_ACKNOWLEDGEMENT' } });
    expect(acks).toBeGreaterThanOrEqual(submitted - 2);
  });

  it('notifies examination and interview candidates and records the outcome', async () => {
    for (const code of ['EXAM_INVITATION', 'INTERVIEW_INVITATION', 'SELECTION_SUCCESSFUL', 'SELECTION_UNSUCCESSFUL']) {
      expect(
        await prisma.notification.count({ where: { templateCode: code } }),
        `no ${code} notification`,
      ).toBeGreaterThan(0);
    }
  });

  it('records a delivery status against every notification', async () => {
    const notifications = await prisma.notification.findMany({ take: 50 });
    expect(notifications.length).toBeGreaterThan(0);
    for (const n of notifications) {
      expect(['QUEUED', 'SENT', 'FAILED', 'READ']).toContain(n.status);
      if (n.status === 'SENT') expect(n.sentAt).toBeTruthy();
      expect(n.subject.length).toBeGreaterThan(0);
    }
  });

  it('holds a dispatched batch and one awaiting approval', async () => {
    const sent = await prisma.notificationBatch.findFirst({ where: { status: 'SENT' } });
    expect(sent?.approvedById).toBeTruthy();
    expect(sent?.sentAt).toBeTruthy();
    expect(await prisma.notificationBatch.count({ where: { status: 'PENDING_APPROVAL' } })).toBeGreaterThan(0);
  });

  it('logs the officer, action and time on every audit record', async () => {
    const logs = await prisma.auditLog.findMany({ take: 50 });
    expect(logs.length).toBeGreaterThanOrEqual(20);
    for (const l of logs) {
      expect(l.action.length).toBeGreaterThan(0);
      expect(l.createdAt).toBeTruthy();
      expect(l.summary, l.action).toBeTruthy();
    }
  });

  it('marks score entry, approvals and permission changes as sensitive', async () => {
    for (const action of [
      'EXERCISE_APPROVED', 'SHORTLIST_APPROVED', 'SELECTION_APPROVED',
      'EXAM_SCORE_RECORDED', 'INTERVIEW_SCORE_RECORDED', 'PERMISSIONS_CHANGED',
    ]) {
      const log = await prisma.auditLog.findFirst({ where: { action } });
      expect(log, `no audit record for ${action}`).toBeTruthy();
      expect(log!.sensitive, `${action} is not marked sensitive`).toBe(true);
    }
  });

  it('records both successful and failed sign-in attempts', async () => {
    expect(await prisma.loginHistory.count({ where: { success: true } })).toBeGreaterThan(0);
    const failed = await prisma.loginHistory.findFirst({ where: { success: false } });
    expect(failed?.reason).toBeTruthy();
  });

  it('records the approval chain for each recruitment stage', async () => {
    for (const entityType of ['EXERCISE', 'SHORTLIST', 'SELECTION']) {
      const approved = await prisma.approvalRequest.findFirst({ where: { entityType, status: 'APPROVED' } });
      expect(approved, `no approved ${entityType} request`).toBeTruthy();
      expect(approved!.requestedByName).toBeTruthy();
      expect(approved!.decidedByName).toBeTruthy();
      expect(approved!.decidedAt).toBeTruthy();
    }
  });
});

describe('completeness recalculation against live records', () => {
  it('agrees with the stored completeness on a submitted application', async () => {
    const app = await prisma.application.findFirstOrThrow({
      where: { status: A.QUALIFIED },
      include: {
        exercise: { include: { requirements: true } },
        applicant: { include: { applicantProfile: true } },
        education: true, employment: true, referees: true,
        nextOfKin: true, documents: true,
      },
    });
    const required = app.exercise.requirements.filter((r) => r.required);
    const uploaded = new Set(app.documents.filter((d) => d.reviewStatus !== 'REJECTED').map((d) => d.docType));
    const result = computeCompleteness({
      hasProfile: true,
      vacancySelected: Boolean(app.vacancyId),
      educationCount: app.education.length,
      employmentCount: app.employment.length,
      refereeCount: app.referees.length,
      hasNextOfKin: Boolean(app.nextOfKin),
      requiredDocsTotal: required.length,
      requiredDocsUploaded: required.filter((r) => uploaded.has(r.code)).length,
      declaration: app.declaration,
      consent: app.consent,
    });
    expect(result.canSubmit).toBe(true);
    expect(result.percent).toBe(app.completeness);
  });
});

describe('access control enforced in the database', () => {
  it('grants an additional permission to one officer only', async () => {
    const grants = await prisma.userPermission.findMany({ include: { user: true } });
    expect(grants.length).toBeGreaterThan(0);
    for (const g of grants) {
      expect(permissionsForRole(g.user.role)).not.toContain(g.permission);
    }
  });

  it('keeps at least one active Super Administrator', async () => {
    expect(await prisma.user.count({ where: { role: ROLES.SUPER_ADMIN, active: true } })).toBeGreaterThanOrEqual(1);
  });

  it('holds a deactivated account to demonstrate access withdrawal', async () => {
    expect(await prisma.user.count({ where: { active: false } })).toBeGreaterThan(0);
  });
});

describe('database constraints', () => {
  it('refuses a duplicate application for the same applicant, exercise and vacancy', async () => {
    const existing = await prisma.application.findFirstOrThrow({ where: { status: { not: A.DRAFT } } });
    await expect(
      prisma.application.create({
        data: {
          reference: `TEST/DUP/${Date.now()}`,
          applicantId: existing.applicantId,
          exerciseId: existing.exerciseId,
          vacancyId: existing.vacancyId,
        },
      }),
    ).rejects.toThrow();
  });

  it('refuses a duplicate email address', async () => {
    const existing = await prisma.user.findFirstOrThrow();
    await expect(
      prisma.user.create({
        data: { email: existing.email, passwordHash: 'x', fullName: 'Duplicate', role: ROLES.APPLICANT },
      }),
    ).rejects.toThrow();
  });

  it('refuses a duplicate examination number', async () => {
    const existing = await prisma.examCandidate.findFirstOrThrow();
    await expect(
      prisma.examCandidate.create({
        data: {
          scheduleId: existing.scheduleId,
          applicationId: existing.applicationId,
          examNumber: existing.examNumber,
        },
      }),
    ).rejects.toThrow();
  });

  it('cascades the removal of an application to its child records', async () => {
    const exercise = await prisma.recruitmentExercise.findFirstOrThrow({ where: { reference: 'KGCSC/REC/2026/001' } });
    const applicant = await prisma.user.create({
      data: {
        email: `cascade.test.${Date.now()}@example.com`,
        passwordHash: await bcrypt.hash('Test1234', 10),
        fullName: 'Cascade Test', role: ROLES.APPLICANT,
      },
    });
    const app = await prisma.application.create({
      data: {
        reference: `TEST/CASCADE/${Date.now()}`,
        applicantId: applicant.id, exerciseId: exercise.id,
        education: { create: { institution: 'Test Institution', qualification: 'HND', position: 0 } },
        statusHistory: { create: { toStatus: A.DRAFT, stage: 'APPLICATION' } },
      },
    });
    expect(await prisma.applicationEducation.count({ where: { applicationId: app.id } })).toBe(1);

    await prisma.application.delete({ where: { id: app.id } });
    expect(await prisma.applicationEducation.count({ where: { applicationId: app.id } })).toBe(0);
    expect(await prisma.applicationStatusHistory.count({ where: { applicationId: app.id } })).toBe(0);

    await prisma.user.delete({ where: { id: applicant.id } });
  });
});

describe('examination numbers are unique across the portal (regression)', () => {
  it('continues the yearly sequence rather than restarting per schedule', async () => {
    const candidates = await prisma.examCandidate.findMany({ select: { examNumber: true } });
    const numbers = candidates.map((c) => c.examNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('refuses a number already issued under a different schedule', async () => {
    const schedules = await prisma.examSchedule.findMany({
      include: { candidates: { select: { examNumber: true, applicationId: true } } },
    });
    const withCandidates = schedules.find((s) => s.candidates.length > 0);
    const other = schedules.find((s) => s.id !== withCandidates?.id);
    if (!withCandidates || !other) return;

    const taken = withCandidates.candidates[0].examNumber;
    const application = await prisma.application.findFirstOrThrow({
      where: { exerciseId: other.exerciseId, examCandidates: { none: { scheduleId: other.id } } },
      select: { id: true },
    });
    await expect(
      prisma.examCandidate.create({
        data: { scheduleId: other.id, applicationId: application.id, examNumber: taken },
      }),
    ).rejects.toThrow();
  });
});
