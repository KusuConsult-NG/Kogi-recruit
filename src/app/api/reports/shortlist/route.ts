import { prisma } from '@/lib/db';
import { requireUser, AuthError } from '@/lib/auth';
import { hasAnyPermission, PERMISSIONS } from '@/lib/rbac';
import { COMMISSION } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { errorResponse, parseFormat, respondWithExport } from '@/lib/report-export';

export async function GET(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Authentication required', 401);
    throw error;
  }
  if (!hasAnyPermission(user, [PERMISSIONS.SHORTLIST_PREPARE, PERMISSIONS.SHORTLIST_APPROVE, PERMISSIONS.REPORT_EXPORT])) {
    return errorResponse('You are not authorised to export this list', 403);
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return errorResponse('A shortlist id is required', 400);

  const shortlist = await prisma.shortlist.findUnique({
    where: { id },
    include: {
      exercise: { select: { title: true, reference: true } },
      entries: {
        orderBy: { rank: 'asc' },
        include: {
          application: {
            select: {
              reference: true,
              applicant: { select: { email: true, applicantProfile: { select: { applicantRef: true, surname: true, firstName: true, gender: true, lga: true, stateOfOrigin: true } } } },
              vacancy: { select: { jobTitle: true, gradeLevel: true } },
            },
          },
        },
      },
    },
  });
  if (!shortlist) return errorResponse('Shortlist not found', 404);

  return respondWithExport({
    user,
    format: parseFormat(url.searchParams.get('format')),
    title: `Shortlist — ${shortlist.title}`,
    sections: [
      {
        title: 'Shortlisted candidates',
        columns: ['Rank', 'Application reference', 'Applicant reference', 'Surname', 'First name', 'Gender', 'State of origin', 'LGA', 'Position', 'Grade', 'Remarks'],
        rows: shortlist.entries.map((e) => {
          const p = e.application.applicant.applicantProfile;
          return [
            e.rank ?? '',
            e.application.reference,
            p?.applicantRef ?? '',
            p?.surname ?? '',
            p?.firstName ?? '',
            p?.gender ?? '',
            p?.stateOfOrigin ?? '',
            p?.lga ?? '',
            e.application.vacancy?.jobTitle ?? '',
            e.application.vacancy?.gradeLevel ?? '',
            e.remarks ?? '',
          ];
        }),
      },
    ],
    meta: {
      Commission: COMMISSION.name,
      Exercise: `${shortlist.exercise.title} (${shortlist.exercise.reference})`,
      Status: shortlist.status,
      Candidates: String(shortlist.entries.length),
      Approved: shortlist.approvedAt ? formatDateTime(shortlist.approvedAt) : 'Not approved',
      'Prepared by': user.fullName,
    },
    auditSummary: `Shortlist "${shortlist.title}"`,
    entityType: 'Shortlist',
    entityId: shortlist.id,
  });
}
