import { prisma } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';
import { hasAnyPermission, PERMISSIONS } from '@/lib/rbac';
import { COMMISSION, DEFAULT_INTERVIEW_CRITERIA } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import { parseCriteria, passFail } from '@/lib/scoring';
import { errorResponse, parseFormat, respondWithExport } from '@/lib/report-export';

export async function GET(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Authentication required', 401);
    throw error;
  }
  if (!hasAnyPermission(user, [PERMISSIONS.INTERVIEW_MANAGE, PERMISSIONS.REPORT_EXPORT])) {
    return errorResponse('You are not authorised to export interview results', 403);
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return errorResponse('An interview id is required', 400);

  const schedule = await prisma.interviewSchedule.findUnique({
    where: { id },
    include: {
      exercise: { select: { title: true, reference: true } },
      panels: { include: { members: { include: { user: { select: { fullName: true } } } }, _count: { select: { candidates: true } } } },
      candidates: {
        orderBy: [{ panelId: 'asc' }, { slotTime: 'asc' }],
        include: {
          panel: { select: { name: true } },
          scores: { include: { member: { select: { fullName: true } } } },
          application: {
            select: {
              reference: true, examScore: true,
              applicant: { select: { applicantProfile: { select: { surname: true, firstName: true, gender: true, lga: true } } } },
              vacancy: { select: { jobTitle: true, gradeLevel: true } },
            },
          },
        },
      },
    },
  });
  if (!schedule) return errorResponse('Interview not found', 404);

  const criteria = parseCriteria(schedule.criteria, [...DEFAULT_INTERVIEW_CRITERIA]);
  const assessed = schedule.candidates.filter((c) => c.consolidatedScore !== null);

  return respondWithExport({
    user,
    format: parseFormat(url.searchParams.get('format')),
    title: `Interview Results — ${schedule.title}`,
    sections: [
      {
        title: 'Candidate assessments',
        columns: ['Application reference', 'Surname', 'First name', 'Gender', 'LGA', 'Position', 'Panel', 'Slot', 'Attendance', 'Exam score', 'Panel scores', `Consolidated (of ${schedule.totalMarks})`, 'Result', 'Remarks'],
        rows: schedule.candidates.map((c) => {
          const p = c.application.applicant.applicantProfile;
          return [
            c.application.reference, p?.surname ?? '', p?.firstName ?? '', p?.gender ?? '', p?.lga ?? '',
            c.application.vacancy ? `${c.application.vacancy.jobTitle} (${c.application.vacancy.gradeLevel})` : '',
            c.panel?.name ?? '', c.slotTime ?? '', c.attendance,
            c.application.examScore ?? '',
            c.scores.map((s) => `${s.member.fullName}: ${s.total}`).join('; '),
            c.consolidatedScore ?? '',
            passFail(c.consolidatedScore, schedule.passMark),
            c.remarks ?? '',
          ];
        }),
      },
      {
        title: 'Assessment framework',
        columns: ['Criterion', 'Maximum score'],
        rows: criteria.map((c) => [c.label, c.maxScore]),
      },
      {
        title: 'Panels',
        columns: ['Panel', 'Room or venue', 'Members', 'Candidates'],
        rows: schedule.panels.map((p) => [
          p.name, p.roomVenue ?? '',
          p.members.map((m) => `${m.user.fullName}${m.isChair ? ' (chair)' : ''}`).join('; '),
          p._count.candidates,
        ]),
      },
      {
        title: 'Summary',
        columns: ['Indicator', 'Value'],
        rows: [
          ['Candidates scheduled', schedule.candidates.length],
          ['Present', schedule.candidates.filter((c) => c.attendance === 'PRESENT').length],
          ['Absent', schedule.candidates.filter((c) => c.attendance === 'ABSENT').length],
          ['Assessments consolidated', assessed.length],
          ['Average consolidated score', assessed.length ? (assessed.reduce((s, c) => s + (c.consolidatedScore ?? 0), 0) / assessed.length).toFixed(2) : '—'],
          ['Highest consolidated score', assessed.length ? Math.max(...assessed.map((c) => c.consolidatedScore ?? 0)) : '—'],
        ],
      },
    ],
    meta: {
      Commission: COMMISSION.name,
      Exercise: `${schedule.exercise.title} (${schedule.exercise.reference})`,
      Interview: schedule.title,
      Date: formatDate(schedule.interviewDate),
      Venue: schedule.venue,
      'Prepared by': user.fullName,
      Classification: 'Restricted — interview assessments',
    },
    auditSummary: `Interview results for "${schedule.title}"`,
    entityType: 'InterviewSchedule',
    entityId: schedule.id,
  });
}
