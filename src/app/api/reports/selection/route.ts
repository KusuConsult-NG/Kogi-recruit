import { prisma } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';
import { hasAnyPermission, PERMISSIONS } from '@/lib/rbac';
import { COMMISSION } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { errorResponse, parseFormat, respondWithExport } from '@/lib/report-export';

/** Module 2.8 - final selection and recruitment outcome documentation. */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Authentication required', 401);
    throw error;
  }
  if (!hasAnyPermission(user, [PERMISSIONS.SELECTION_PREPARE, PERMISSIONS.SELECTION_APPROVE, PERMISSIONS.REPORT_EXPORT])) {
    return errorResponse('You are not authorised to export selection records', 403);
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return errorResponse('A selection list id is required', 400);

  const list = await prisma.selectionList.findUnique({
    where: { id },
    include: {
      exercise: {
        select: {
          title: true, reference: true,
          vacancies: { where: { active: true }, select: { id: true, jobTitle: true, gradeLevel: true, positions: true } },
        },
      },
      entries: {
        orderBy: { rank: 'asc' },
        include: {
          application: {
            select: {
              reference: true, vacancyId: true,
              applicant: { select: { email: true, phone: true, applicantProfile: { select: { applicantRef: true, surname: true, firstName: true, gender: true, lga: true, stateOfOrigin: true } } } },
              vacancy: { select: { jobTitle: true, gradeLevel: true } },
            },
          },
        },
      },
    },
  });
  if (!list) return errorResponse('Selection list not found', 404);

  const selected = list.entries.filter((e) => e.outcome === 'SELECTED');

  return respondWithExport({
    user,
    format: parseFormat(url.searchParams.get('format')),
    title: `Final Selection — ${list.title}`,
    sections: [
      {
        title: 'Successful candidates',
        columns: ['Rank', 'Application reference', 'Applicant reference', 'Surname', 'First name', 'Gender', 'State of origin', 'LGA', 'Position', 'Grade', 'Exam', 'Interview', 'Final score'],
        rows: selected.map((e) => {
          const p = e.application.applicant.applicantProfile;
          return [
            e.rank ?? '', e.application.reference, p?.applicantRef ?? '',
            p?.surname ?? '', p?.firstName ?? '', p?.gender ?? '',
            p?.stateOfOrigin ?? '', p?.lga ?? '',
            e.application.vacancy?.jobTitle ?? '', e.application.vacancy?.gradeLevel ?? '',
            e.examScore ?? '', e.interviewScore ?? '', e.finalScore ?? '',
          ];
        }),
      },
      {
        title: 'Full ranking',
        columns: ['Rank', 'Application reference', 'Surname', 'First name', 'Position', 'Exam', 'Interview', 'Final score', 'Outcome', 'Remarks'],
        rows: list.entries.map((e) => {
          const p = e.application.applicant.applicantProfile;
          return [
            e.rank ?? '', e.application.reference, p?.surname ?? '', p?.firstName ?? '',
            e.application.vacancy?.jobTitle ?? '',
            e.examScore ?? '', e.interviewScore ?? '', e.finalScore ?? '',
            e.outcome, e.remarks ?? '',
          ];
        }),
      },
      {
        title: 'Vacancy fill',
        columns: ['Job title', 'Grade', 'Approved posts', 'Selected', 'Outstanding'],
        rows: list.exercise.vacancies.map((v) => {
          const filled = selected.filter((e) => e.application.vacancyId === v.id).length;
          return [v.jobTitle, v.gradeLevel, v.positions, filled, Math.max(0, v.positions - filled)];
        }),
      },
      {
        title: 'Summary',
        columns: ['Indicator', 'Value'],
        rows: [
          ['Candidates assessed', list.entries.length],
          ['Successful', selected.length],
          ['Reserve', list.entries.filter((e) => e.outcome === 'RESERVE').length],
          ['Unsuccessful', list.entries.filter((e) => e.outcome === 'NOT_SELECTED').length],
          ['Examination weighting', `${list.examWeight}%`],
          ['Interview weighting', `${list.interviewWeight}%`],
          ['Status', list.status],
          ['Approved', list.approvedAt ? formatDateTime(list.approvedAt) : 'Not approved'],
        ],
      },
    ],
    meta: {
      Commission: COMMISSION.name,
      Exercise: `${list.exercise.title} (${list.exercise.reference})`,
      'Selection list': list.title,
      Status: list.status,
      Approved: list.approvedAt ? formatDateTime(list.approvedAt) : 'Not approved',
      'Prepared by': user.fullName,
      Note: 'Final appointment remains subject to approval by the legally authorised government authorities.',
    },
    auditSummary: `Final selection list "${list.title}"`,
    entityType: 'SelectionList',
    entityId: list.id,
  });
}
