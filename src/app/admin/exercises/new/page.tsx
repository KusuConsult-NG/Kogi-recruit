import { requirePagePermission } from '@/lib/page-guards';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardBody, PageHeading } from '@/components/ui';
import { ExerciseForm } from '../exercise-form';

export const metadata = { title: 'New Recruitment Exercise' };

export default async function NewExercisePage() {
  await requirePagePermission(PERMISSIONS.EXERCISE_MANAGE);
  return (
    <>
      <PageHeading
        title="New Recruitment Exercise"
        description="Stage 1 — Recruitment planning. Configure the exercise, then add the approved vacancies and submit it for approval."
        breadcrumb={[{ label: 'Exercises', href: '/admin/exercises' }, { label: 'New' }]}
      />
      <Card className="max-w-4xl">
        <div className="card-header"><h2 className="card-title">Exercise details</h2></div>
        <CardBody>
          <ExerciseForm mode="create" />
        </CardBody>
      </Card>
    </>
  );
}
