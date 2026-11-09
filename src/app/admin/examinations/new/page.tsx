import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { PERMISSIONS } from '@/lib/rbac';
import { EXERCISE_STATUS, PAPER_KIND_LABELS, PAPER_STATUS } from '@/lib/constants';
import { Alert, Card, CardBody, PageHeading } from '@/components/ui';
import { ExamScheduleForm } from '../forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'New Examination' };

export default async function NewExamPage() {
  await requirePagePermission(PERMISSIONS.EXAM_MANAGE);
  const [exercises, papers] = await Promise.all([
    prisma.recruitmentExercise.findMany({
      where: { status: { in: [EXERCISE_STATUS.PUBLISHED, EXERCISE_STATUS.CLOSED, EXERCISE_STATUS.SUSPENDED] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, reference: true, title: true, requireExam: true },
    }),
    prisma.examPaper.findMany({
      where: { status: PAPER_STATUS.PUBLISHED },
      orderBy: { title: 'asc' },
      select: { id: true, title: true, code: true, durationMinutes: true, kind: true },
    }),
  ]);

  return (
    <>
      <PageHeading
        title="New Examination"
        eyebrow="Stage 7 · Examination and assessment"
        description="Configure the examination. A centre-based examination takes scores entered by officers; a computer-based test is sat online in the applicant portal and marked automatically."
        breadcrumb={[{ label: 'Examinations', href: '/admin/examinations' }, { label: 'New' }]}
      />
      {exercises.length === 0 ? (
        <Alert tone="warning" title="No eligible exercises">
          An examination can only be created for a published, suspended or closed recruitment exercise.
        </Alert>
      ) : (
        <Card className="max-w-3xl">
          <div className="card-header"><h2 className="card-title">Examination details</h2></div>
          <CardBody>
            <ExamScheduleForm
              exercises={exercises.map((e) => ({
                id: e.id,
                label: `${e.reference} — ${e.title}${e.requireExam ? '' : ' (examination not flagged for this exercise)'}`,
              }))}
              papers={papers.map((p) => ({
                id: p.id,
                label: `${p.title} (${p.code}) — ${PAPER_KIND_LABELS[p.kind] ?? p.kind}`,
                durationMinutes: p.durationMinutes,
              }))}
            />
          </CardBody>
        </Card>
      )}
    </>
  );
}
