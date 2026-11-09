import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { PERMISSIONS } from '@/lib/rbac';
import { EXERCISE_STATUS } from '@/lib/constants';
import { Alert, Card, CardBody, PageHeading } from '@/components/ui';
import { InterviewScheduleForm } from '../forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'New Interview' };

export default async function NewInterviewPage() {
  await requirePagePermission(PERMISSIONS.INTERVIEW_MANAGE);
  const exercises = await prisma.recruitmentExercise.findMany({
    where: { status: { in: [EXERCISE_STATUS.PUBLISHED, EXERCISE_STATUS.CLOSED, EXERCISE_STATUS.SUSPENDED] } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, reference: true, title: true },
  });

  return (
    <>
      <PageHeading
        title="New Interview"
        description="Stage 8 — configure the interview. The assessment framework, panels and candidates are set next."
        breadcrumb={[{ label: 'Interviews', href: '/admin/interviews' }, { label: 'New' }]}
      />
      {exercises.length === 0 ? (
        <Alert tone="warning" title="No eligible exercises">
          An interview can only be created for a published, suspended or closed recruitment exercise.
        </Alert>
      ) : (
        <Card className="max-w-3xl">
          <div className="card-header"><h2 className="card-title">Interview details</h2></div>
          <CardBody>
            <InterviewScheduleForm
              exercises={exercises.map((e) => ({ id: e.id, label: `${e.reference} — ${e.title}` }))}
            />
          </CardBody>
        </Card>
      )}
    </>
  );
}
