import { prisma } from '@/lib/db';
import { requirePermission, ForbiddenError, AuthError } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/rbac';
import {
  applicationsByDepartment, applicationsByGender, applicationsByLga,
  applicationsByQualification, applicationsByStatus, applicationsByVacancy,
  dashboardSummary,
} from '@/lib/reports';
import { APPLICATION_STATUS_LABELS, COMMISSION } from '@/lib/constants';
import { formatDate, percent } from '@/lib/format';
import { errorResponse, parseFormat, respondWithExport } from '@/lib/report-export';
import type { TableSection } from '@/lib/export';

/** Module 6 - full recruitment report export. */
export async function GET(request: Request) {
  let user;
  try {
    user = await requirePermission(PERMISSIONS.REPORT_EXPORT);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Authentication required', 401);
    if (error instanceof ForbiddenError) return errorResponse('You are not authorised to export reports', 403);
    throw error;
  }

  const url = new URL(request.url);
  const format = parseFormat(url.searchParams.get('format'));
  const exerciseId = url.searchParams.get('exercise') || undefined;

  const exercise = exerciseId
    ? await prisma.recruitmentExercise.findUnique({
        where: { id: exerciseId },
        select: { title: true, reference: true, status: true, opensAt: true, closesAt: true },
      })
    : null;
  if (exerciseId && !exercise) return errorResponse('Recruitment exercise not found', 404);

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
        where: { active: true, ...(exerciseId ? { exerciseId } : {}) },
        select: {
          jobTitle: true, gradeLevel: true, positions: true,
          _count: { select: { applications: true } },
          applications: { where: { status: 'SELECTED' }, select: { id: true } },
        },
        orderBy: { jobTitle: 'asc' },
      }),
    ]);

  const a = summary.applications;
  const sections: TableSection[] = [
    {
      title: 'Summary',
      columns: ['Indicator', 'Value'],
      rows: [
        ['Recruitment exercises (total)', summary.exercises.total],
        ['Exercises open', summary.exercises.active],
        ['Exercises closed', summary.exercises.closed],
        ['Exercises archived', summary.exercises.archived],
        ['Applications received', a.submitted],
        ['Applications in draft', a.draft],
        ['Complete applications', a.complete],
        ['Incomplete applications', a.incomplete],
        ['Applications awaiting screening', a.awaitingScreening],
        ['Qualified', a.qualified],
        ['Disqualified', a.disqualified],
        ['Shortlisted', a.shortlisted],
        ['Examination candidates', a.examCandidates],
        ['Interview candidates', a.interviewCandidates],
        ['Successful candidates', a.successful],
        ['Unsuccessful candidates', a.unsuccessful],
        ['Withdrawn applications', a.withdrawn],
        ['Documents uploaded', summary.documents.total],
        ['Documents verified', summary.documents.verified],
        ['Documents awaiting review', summary.documents.pending],
        ['Documents rejected or needing correction', summary.documents.rejected],
        ['Registered applicants', summary.users.applicants],
        ['Staff accounts', summary.users.staff],
      ],
    },
    {
      title: 'Stage completion',
      columns: ['Stage', 'Applications', 'Share of submitted'],
      rows: summary.stageCompletion.map((s) => [s.stage, s.count, `${s.percent}%`]),
    },
    {
      title: 'By vacancy',
      columns: ['Vacancy', 'Applications'],
      rows: byVacancy.map((r) => [r.label, r.count]),
    },
    {
      title: 'By qualification',
      columns: ['Qualification', 'Applications'],
      rows: byQualification.map((r) => [r.label, r.count]),
    },
    {
      title: 'By LGA',
      columns: ['Local Government Area', 'Applications'],
      rows: byLga.map((r) => [r.label, r.count]),
    },
    {
      title: 'By gender',
      columns: ['Gender', 'Applications'],
      rows: byGender.map((r) => [r.label, r.count]),
    },
    {
      title: 'By department',
      columns: ['Employing MDA', 'Applications'],
      rows: byDepartment.map((r) => [r.label, r.count]),
    },
    {
      title: 'By status',
      columns: ['Status', 'Applications'],
      rows: byStatus.map((r) => [APPLICATION_STATUS_LABELS[r.label] ?? r.label, r.count]),
    },
    {
      title: 'Vacancy fill rate',
      columns: ['Job title', 'Grade', 'Approved posts', 'Applications', 'Selected', 'Fill rate'],
      rows: vacancies.map((v) => [
        v.jobTitle, v.gradeLevel, v.positions, v._count.applications,
        v.applications.length, percent(v.applications.length, v.positions),
      ]),
    },
  ];

  return respondWithExport({
    user,
    format,
    title: exercise ? `Recruitment Report — ${exercise.title}` : 'Portal-wide Recruitment Report',
    sections,
    meta: {
      Commission: COMMISSION.name,
      ...(exercise
        ? {
            Exercise: exercise.title,
            Reference: exercise.reference,
            Status: exercise.status,
            Opened: formatDate(exercise.opensAt),
            Closes: formatDate(exercise.closesAt),
          }
        : { Scope: 'All recruitment exercises' }),
      'Prepared by': user.fullName,
    },
    auditSummary: exercise
      ? `Recruitment report for ${exercise.reference}`
      : 'Portal-wide recruitment report',
    entityType: 'RecruitmentExercise',
    entityId: exerciseId,
  });
}
