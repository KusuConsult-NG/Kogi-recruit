import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { PERMISSIONS } from '@/lib/rbac';
import { EXERCISE_STATUS } from '@/lib/constants';
import { Alert, Card, CardBody, PageHeading } from '@/components/ui';
import { ExamScheduleForm } from '../forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'New Examination' };

export default async function NewExamPage() {
  await requirePagePermission(PERMISSIONS.EXAM_MANAGE);
  const exercises = await prisma.recruitmentExercise.findMany({
    where: { status: { in: [EXERCISE_STATUS.PUBLISHED, EXERCISE_STATUS.CLOSED, EXERCISE_STATUS.SUSPENDED] } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, reference: true, title: true, requireExam: true },
  });

  return (
    <>
      <PageHeading
        title="New Examination"
        description="Stage 7 — configure the examination schedule. Centres and candidates are added next."
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
            />
          </CardBody>
        </Card>
      )}
    </>
  );
}
