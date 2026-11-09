import { prisma } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';
import { hasAnyPermission, PERMISSIONS } from '@/lib/rbac';
import { COMMISSION } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import { passFail } from '@/lib/scoring';
import { errorResponse, parseFormat, respondWithExport } from '@/lib/report-export';

export async function GET(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Authentication required', 401);
    throw error;
  }
  if (!hasAnyPermission(user, [PERMISSIONS.EXAM_MANAGE, PERMISSIONS.EXAM_SCORE, PERMISSIONS.REPORT_EXPORT])) {
    return errorResponse('You are not authorised to export examination results', 403);
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return errorResponse('An examination id is required', 400);

  const schedule = await prisma.examSchedule.findUnique({
    where: { id },
    include: {
      exercise: { select: { title: true, reference: true } },
      centres: { include: { _count: { select: { candidates: true } } } },
      candidates: {
        orderBy: { examNumber: 'asc' },
        include: {
          centre: { select: { name: true } },
          application: {
            select: {
              reference: true,
              applicant: { select: { applicantProfile: { select: { surname: true, firstName: true, gender: true, lga: true } } } },
              vacancy: { select: { jobTitle: true, gradeLevel: true } },
            },
          },
        },
      },
    },
  });
  if (!schedule) return errorResponse('Examination not found', 404);

  const scored = schedule.candidates.filter((c) => c.score !== null);
  const passed = scored.filter((c) => (c.score ?? 0) >= schedule.passMark);

  return respondWithExport({
    user,
    format: parseFormat(url.searchParams.get('format')),
    title: `Examination Results — ${schedule.title}`,
    sections: [
      {
        title: 'Candidate results',
        columns: ['Examination no.', 'Application reference', 'Surname', 'First name', 'Gender', 'LGA', 'Position', 'Grade', 'Centre', 'Seat', 'Attendance', 'Score', `Out of ${schedule.totalMarks}`, 'Result', 'Remarks'],
        rows: schedule.candidates.map((c) => {
          const p = c.application.applicant.applicantProfile;
          return [
            c.examNumber, c.application.reference, p?.surname ?? '', p?.firstName ?? '',
            p?.gender ?? '', p?.lga ?? '',
            c.application.vacancy?.jobTitle ?? '', c.application.vacancy?.gradeLevel ?? '',
            c.centre?.name ?? '', c.seatNumber ?? '', c.attendance,
            c.score ?? '', schedule.totalMarks,
            passFail(c.score, schedule.passMark), c.remarks ?? '',
          ];
        }),
      },
      {
        title: 'Centre allocation',
        columns: ['Centre', 'LGA', 'Address', 'Capacity', 'Allocated', 'Supervisor'],
        rows: schedule.centres.map((c) => [
          c.name, c.lga ?? '', c.address ?? '', c.capacity, c._count.candidates, c.supervisor ?? '',
        ]),
      },
      {
        title: 'Performance summary',
        columns: ['Indicator', 'Value'],
        rows: [
          ['Candidates allocated', schedule.candidates.length],
          ['Present', schedule.candidates.filter((c) => c.attendance === 'PRESENT').length],
          ['Absent', schedule.candidates.filter((c) => c.attendance === 'ABSENT').length],
          ['Scores recorded', scored.length],
          ['Passed', passed.length],
          ['Failed', scored.length - passed.length],
          ['Pass rate', scored.length ? `${Math.round((passed.length / scored.length) * 100)}%` : '—'],
          ['Highest score', scored.length ? Math.max(...scored.map((c) => c.score ?? 0)) : '—'],
          ['Lowest score', scored.length ? Math.min(...scored.map((c) => c.score ?? 0)) : '—'],
          ['Average score', scored.length ? (scored.reduce((s, c) => s + (c.score ?? 0), 0) / scored.length).toFixed(2) : '—'],
        ],
      },
    ],
    meta: {
      Commission: COMMISSION.name,
      Exercise: `${schedule.exercise.title} (${schedule.exercise.reference})`,
      Examination: schedule.title,
      Date: formatDate(schedule.examDate),
      'Total marks': String(schedule.totalMarks),
      'Pass mark': String(schedule.passMark),
      'Prepared by': user.fullName,
      Classification: 'Restricted — examination results',
    },
    auditSummary: `Examination results for "${schedule.title}"`,
    entityType: 'ExamSchedule',
    entityId: schedule.id,
  });
}
