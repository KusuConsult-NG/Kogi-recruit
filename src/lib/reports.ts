/** Module 6 - Management dashboard and reporting aggregations. */
import 'server-only';
import { prisma } from './db';
import { APPLICATION_STATUS, EXERCISE_STATUS } from './constants';

const A = APPLICATION_STATUS;

export interface DashboardSummary {
  exercises: { total: number; active: number; closed: number; draft: number; archived: number };
  applications: {
    total: number;
    draft: number;
    submitted: number;
    complete: number;
    incomplete: number;
    awaitingScreening: number;
    qualified: number;
    disqualified: number;
    shortlisted: number;
    examCandidates: number;
    interviewCandidates: number;
    successful: number;
    unsuccessful: number;
    withdrawn: number;
  };
  documents: { total: number; pending: number; verified: number; rejected: number };
  enquiries: { total: number; open: number };
  users: { total: number; active: number; applicants: number; staff: number };
  stageCompletion: Array<{ stage: string; count: number; percent: number }>;
}

export async function dashboardSummary(exerciseId?: string): Promise<DashboardSummary> {
  const appWhere = exerciseId ? { exerciseId } : {};

  const [
    exTotal, exActive, exClosed, exDraft, exArchived,
    appTotal, appDraft, appSubmitted, appUnderScreening, appIncomplete, appResub,
    appQualified, appDisqualified, appShortlisted, appExamSched, appExamDone,
    appIntSched, appIntDone, appSelected, appNotSelected, appWithdrawn,
    docTotal, docPending, docVerified, docRejected,
    enqTotal, enqOpen,
    userTotal, userActive, applicantCount,
  ] = await Promise.all([
    prisma.recruitmentExercise.count(),
    prisma.recruitmentExercise.count({ where: { status: EXERCISE_STATUS.PUBLISHED } }),
    prisma.recruitmentExercise.count({ where: { status: EXERCISE_STATUS.CLOSED } }),
    prisma.recruitmentExercise.count({ where: { status: { in: [EXERCISE_STATUS.DRAFT, EXERCISE_STATUS.PENDING_APPROVAL, EXERCISE_STATUS.APPROVED] } } }),
    prisma.recruitmentExercise.count({ where: { status: EXERCISE_STATUS.ARCHIVED } }),
    prisma.application.count({ where: appWhere }),
    prisma.application.count({ where: { ...appWhere, status: A.DRAFT } }),
    prisma.application.count({ where: { ...appWhere, status: A.SUBMITTED } }),
    prisma.application.count({ where: { ...appWhere, status: A.UNDER_SCREENING } }),
    prisma.application.count({ where: { ...appWhere, status: A.INCOMPLETE } }),
    prisma.application.count({ where: { ...appWhere, status: A.RESUBMISSION_REQUIRED } }),
    prisma.application.count({ where: { ...appWhere, status: A.QUALIFIED } }),
    prisma.application.count({ where: { ...appWhere, status: A.DISQUALIFIED } }),
    prisma.application.count({ where: { ...appWhere, status: A.SHORTLISTED } }),
    prisma.application.count({ where: { ...appWhere, status: A.EXAM_SCHEDULED } }),
    prisma.application.count({ where: { ...appWhere, status: A.EXAM_COMPLETED } }),
    prisma.application.count({ where: { ...appWhere, status: A.INTERVIEW_SCHEDULED } }),
    prisma.application.count({ where: { ...appWhere, status: A.INTERVIEW_COMPLETED } }),
    prisma.application.count({ where: { ...appWhere, status: A.SELECTED } }),
    prisma.application.count({ where: { ...appWhere, status: A.NOT_SELECTED } }),
    prisma.application.count({ where: { ...appWhere, status: A.WITHDRAWN } }),
    prisma.applicantDocument.count({ where: exerciseId ? { application: { exerciseId } } : {} }),
    prisma.applicantDocument.count({ where: { ...(exerciseId ? { application: { exerciseId } } : {}), reviewStatus: 'PENDING' } }),
    prisma.applicantDocument.count({ where: { ...(exerciseId ? { application: { exerciseId } } : {}), reviewStatus: 'VERIFIED' } }),
    prisma.applicantDocument.count({ where: { ...(exerciseId ? { application: { exerciseId } } : {}), reviewStatus: { in: ['REJECTED', 'RESUBMISSION_REQUIRED'] } } }),
    prisma.enquiry.count(),
    prisma.enquiry.count({ where: { status: { in: ['NEW', 'IN_PROGRESS'] } } }),
    prisma.user.count(),
    prisma.user.count({ where: { active: true } }),
    prisma.user.count({ where: { role: 'APPLICANT' } }),
  ]);

  const submittedTotal = appTotal - appDraft - appWithdrawn;
  const complete = await prisma.application.count({
    where: { ...appWhere, completeness: { gte: 100 }, status: { not: A.DRAFT } },
  });

  const stages: Array<{ stage: string; count: number }> = [
    { stage: 'Applications submitted', count: submittedTotal },
    { stage: 'Screened', count: appQualified + appDisqualified + appShortlisted + appExamSched + appExamDone + appIntSched + appIntDone + appSelected + appNotSelected },
    { stage: 'Shortlisted', count: appShortlisted + appExamSched + appExamDone + appIntSched + appIntDone + appSelected },
    { stage: 'Examined', count: appExamDone + appIntSched + appIntDone + appSelected },
    { stage: 'Interviewed', count: appIntDone + appSelected },
    { stage: 'Selected', count: appSelected },
  ];

  return {
    exercises: { total: exTotal, active: exActive, closed: exClosed, draft: exDraft, archived: exArchived },
    applications: {
      total: appTotal,
      draft: appDraft,
      submitted: submittedTotal,
      complete,
      incomplete: appIncomplete + appResub,
      awaitingScreening: appSubmitted + appUnderScreening,
      qualified: appQualified,
      disqualified: appDisqualified,
      shortlisted: appShortlisted,
      examCandidates: appExamSched + appExamDone,
      interviewCandidates: appIntSched + appIntDone,
      successful: appSelected,
      unsuccessful: appNotSelected,
      withdrawn: appWithdrawn,
    },
    documents: { total: docTotal, pending: docPending, verified: docVerified, rejected: docRejected },
    enquiries: { total: enqTotal, open: enqOpen },
    users: {
      total: userTotal,
      active: userActive,
      applicants: applicantCount,
      staff: userTotal - applicantCount,
    },
    stageCompletion: stages.map((s) => ({
      ...s,
      percent: submittedTotal ? Math.round((s.count / submittedTotal) * 100) : 0,
    })),
  };
}

export interface GroupCount {
  label: string;
  count: number;
}

/** Applications grouped by vacancy / job title. */
export async function applicationsByVacancy(exerciseId?: string): Promise<GroupCount[]> {
  const rows = await prisma.application.groupBy({
    by: ['vacancyId'],
    where: { ...(exerciseId ? { exerciseId } : {}), status: { not: APPLICATION_STATUS.DRAFT } },
    _count: { _all: true },
  });
  const vacancyIds = rows.map((r) => r.vacancyId).filter((v): v is string => Boolean(v));
  const vacancies = await prisma.vacancy.findMany({
    where: { id: { in: vacancyIds } },
    select: { id: true, jobTitle: true, gradeLevel: true },
  });
  const map = new Map(vacancies.map((v) => [v.id, `${v.jobTitle} (${v.gradeLevel})`]));
  return rows
    .map((r) => ({
      label: r.vacancyId ? (map.get(r.vacancyId) ?? 'Unknown vacancy') : 'No position selected',
      count: r._count._all,
    }))
    .sort((a, b) => b.count - a.count);
}

/** Applications grouped by highest qualification held. */
export async function applicationsByQualification(exerciseId?: string): Promise<GroupCount[]> {
  const rows = await prisma.applicationEducation.groupBy({
    by: ['qualification'],
    where: {
      application: {
        ...(exerciseId ? { exerciseId } : {}),
        status: { not: APPLICATION_STATUS.DRAFT },
      },
    },
    _count: { _all: true },
  });
  return rows
    .map((r) => ({ label: r.qualification, count: r._count._all }))
    .sort((a, b) => b.count - a.count);
}

/** Applications grouped by Local Government Area of origin. */
export async function applicationsByLga(exerciseId?: string): Promise<GroupCount[]> {
  const apps = await prisma.application.findMany({
    where: { ...(exerciseId ? { exerciseId } : {}), status: { not: APPLICATION_STATUS.DRAFT } },
    select: { applicant: { select: { applicantProfile: { select: { lga: true, stateOfOrigin: true } } } } },
  });
  const counts = new Map<string, number>();
  for (const a of apps) {
    const p = a.applicant.applicantProfile;
    const key = p?.lga ? `${p.lga}${p.stateOfOrigin && p.stateOfOrigin !== 'Kogi' ? ` (${p.stateOfOrigin})` : ''}` : 'Not supplied';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

/**
 * Applications grouped by gender.
 * Collected only where lawfully permitted and approved by the Commission.
 */
export async function applicationsByGender(exerciseId?: string): Promise<GroupCount[]> {
  const apps = await prisma.application.findMany({
    where: { ...(exerciseId ? { exerciseId } : {}), status: { not: APPLICATION_STATUS.DRAFT } },
    select: { applicant: { select: { applicantProfile: { select: { gender: true } } } } },
  });
  const counts = new Map<string, number>();
  for (const a of apps) {
    const key = a.applicant.applicantProfile?.gender ?? 'Not stated';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export async function applicationsByStatus(exerciseId?: string): Promise<GroupCount[]> {
  const rows = await prisma.application.groupBy({
    by: ['status'],
    where: exerciseId ? { exerciseId } : {},
    _count: { _all: true },
  });
  return rows.map((r) => ({ label: r.status, count: r._count._all })).sort((a, b) => b.count - a.count);
}

export async function applicationsByDepartment(exerciseId?: string): Promise<GroupCount[]> {
  const apps = await prisma.application.findMany({
    where: { ...(exerciseId ? { exerciseId } : {}), status: { not: APPLICATION_STATUS.DRAFT } },
    select: { vacancy: { select: { department: { select: { name: true } }, agency: true } } },
  });
  const counts = new Map<string, number>();
  for (const a of apps) {
    const key = a.vacancy?.department?.name ?? a.vacancy?.agency ?? 'Unassigned';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export interface ExerciseReport {
  exercise: {
    id: string;
    title: string;
    reference: string;
    status: string;
    opensAt: Date;
    closesAt: Date;
  };
  summary: DashboardSummary;
  byVacancy: GroupCount[];
  byQualification: GroupCount[];
  byLga: GroupCount[];
  byGender: GroupCount[];
  byStatus: GroupCount[];
  byDepartment: GroupCount[];
  vacancyFill: Array<{ jobTitle: string; gradeLevel: string; positions: number; selected: number }>;
}

export async function exerciseReport(exerciseId: string): Promise<ExerciseReport | null> {
  const exercise = await prisma.recruitmentExercise.findUnique({
    where: { id: exerciseId },
    select: { id: true, title: true, reference: true, status: true, opensAt: true, closesAt: true },
  });
  if (!exercise) return null;

  const [summary, byVacancy, byQualification, byLga, byGender, byStatus, byDepartment, vacancies] =
    await Promise.all([
      dashboardSummary(exerciseId),
      applicationsByVacancy(exerciseId),
      applicationsByQualification(exerciseId),
      applicationsByLga(exerciseId),
      applicationsByGender(exerciseId),
      applicationsByStatus(exerciseId),
      applicationsByDepartment(exerciseId),
      prisma.vacancy.findMany({
        where: { exerciseId },
        select: {
          jobTitle: true,
          gradeLevel: true,
          positions: true,
          _count: { select: { applications: true } },
          applications: { where: { status: APPLICATION_STATUS.SELECTED }, select: { id: true } },
        },
      }),
    ]);

  return {
    exercise,
    summary,
    byVacancy,
    byQualification,
    byLga,
    byGender,
    byStatus,
    byDepartment,
    vacancyFill: vacancies.map((v) => ({
      jobTitle: v.jobTitle,
      gradeLevel: v.gradeLevel,
      positions: v.positions,
      selected: v.applications.length,
    })),
  };
}
