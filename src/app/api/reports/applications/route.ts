import { prisma } from '@/lib/db';
import { requirePermission, AuthError, ForbiddenError } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/rbac';
import { APPLICATION_STATUS_LABELS, COMMISSION } from '@/lib/constants';
import { age, formatDate, formatDateTime } from '@/lib/format';
import { errorResponse, parseFormat, respondWithExport } from '@/lib/report-export';
import type { TableSection } from '@/lib/export';

/** Module 6 - application register export. */
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
  const status = url.searchParams.get('status') || undefined;

  const applications = await prisma.application.findMany({
    where: {
      ...(exerciseId ? { exerciseId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: [{ exerciseId: 'asc' }, { submittedAt: 'asc' }],
    take: 20000,
    include: {
      exercise: { select: { reference: true, title: true } },
      vacancy: { select: { jobTitle: true, gradeLevel: true, department: { select: { name: true } }, ministry: { select: { name: true } } } },
      applicant: { select: { email: true, phone: true, applicantProfile: true } },
      education: { select: { qualification: true, institution: true } },
      documents: { select: { reviewStatus: true } },
      screenings: { orderBy: { createdAt: 'desc' }, take: 1, select: { outcome: true, classification: true, remarks: true } },
    },
  });

  const sections: TableSection[] = [
    {
      title: 'Application register',
      columns: [
        'Application reference', 'Applicant reference', 'Surname', 'First name', 'Gender', 'Age',
        'Email', 'Telephone', 'State of origin', 'LGA', 'Exercise', 'Position', 'Grade',
        'Employing MDA', 'Highest qualification', 'Status', 'Completeness %',
        'Documents verified', 'Documents total', 'Screening outcome', 'Classification',
        'Exam score', 'Interview score', 'Final score', 'Submitted',
      ],
      rows: applications.map((app) => {
        const p = app.applicant.applicantProfile;
        const screening = app.screenings[0];
        return [
          app.reference,
          p?.applicantRef ?? '',
          p?.surname ?? '',
          p?.firstName ?? '',
          p?.gender ?? '',
          age(p?.dateOfBirth) ?? '',
          app.applicant.email,
          p?.phone ?? app.applicant.phone ?? '',
          p?.stateOfOrigin ?? '',
          p?.lga ?? '',
          app.exercise.reference,
          app.vacancy?.jobTitle ?? '',
          app.vacancy?.gradeLevel ?? '',
          app.vacancy?.ministry?.name ?? app.vacancy?.department?.name ?? '',
          app.education.map((e) => e.qualification).join('; '),
          APPLICATION_STATUS_LABELS[app.status] ?? app.status,
          app.completeness,
          app.documents.filter((d) => d.reviewStatus === 'VERIFIED').length,
          app.documents.length,
          screening?.outcome ?? '',
          screening?.classification ?? '',
          app.examScore ?? '',
          app.interviewScore ?? '',
          app.finalScore ?? '',
          app.submittedAt ? formatDateTime(app.submittedAt) : 'Not submitted',
        ];
      }),
    },
  ];

  const exercise = exerciseId
    ? await prisma.recruitmentExercise.findUnique({
        where: { id: exerciseId },
        select: { title: true, reference: true, opensAt: true, closesAt: true },
      })
    : null;

  return respondWithExport({
    user,
    format,
    title: exercise ? `Application Register — ${exercise.reference}` : 'Application Register',
    sections,
    meta: {
      Commission: COMMISSION.name,
      ...(exercise ? { Exercise: exercise.title, Opened: formatDate(exercise.opensAt), Closes: formatDate(exercise.closesAt) } : { Scope: 'All exercises' }),
      ...(status ? { 'Status filter': APPLICATION_STATUS_LABELS[status] ?? status } : {}),
      Records: String(applications.length),
      'Prepared by': user.fullName,
      Classification: 'Restricted — contains applicant personal information',
    },
    auditSummary: `Application register (${applications.length} record(s))`,
    entityType: 'Application',
  });
}
