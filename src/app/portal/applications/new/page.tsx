import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePageApplicant } from '@/lib/page-guards';
import { EXERCISE_STATUS } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import { Alert, Card, CardBody, EmptyState, PageHeading } from '@/components/ui';
import { RichText } from '@/components/rich-text';
import { StartApplicationForm } from './start-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Start an Application' };

export default async function NewApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ exercise?: string }>;
}) {
  const { exercise: exerciseId } = await searchParams;
  const user = await requirePageApplicant();
  const now = new Date();

  const profile = await prisma.applicantProfile.findUniqueOrThrow({ where: { userId: user.id } });

  if (!exerciseId) {
    const open = await prisma.recruitmentExercise.findMany({
      where: { status: EXERCISE_STATUS.PUBLISHED, opensAt: { lte: now }, closesAt: { gt: now } },
      orderBy: { closesAt: 'asc' },
      include: { vacancies: { where: { active: true }, select: { positions: true } } },
    });
    return (
      <>
        <PageHeading
          title="Start an Application"
          description="Choose the recruitment exercise you wish to apply to."
          breadcrumb={[
            { label: 'Dashboard', href: '/portal' },
            { label: 'My Applications', href: '/portal/applications' },
            { label: 'Start an Application' },
          ]}
        />
        {open.length === 0 ? (
          <EmptyState title="No exercises are open for application" description="Open exercises appear here as soon as they are published." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {open.map((ex) => (
              <Card key={ex.id}>
                <CardBody>
                  <h2 className="text-base font-semibold text-slate-900">{ex.title}</h2>
                  <p className="mt-0.5 text-xs text-slate-500">{ex.reference} · closes {formatDate(ex.closesAt)}</p>
                  <p className="mt-2 line-clamp-3 text-sm text-slate-600">{ex.description}</p>
                  <Link href={`/portal/applications/new?exercise=${ex.id}`} className="btn-primary btn-sm mt-4">
                    Apply to this exercise
                  </Link>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </>
    );
  }

  const exercise = await prisma.recruitmentExercise.findUnique({
    where: { id: exerciseId },
    include: {
      vacancies: {
        where: { active: true },
        orderBy: [{ gradeLevel: 'desc' }, { jobTitle: 'asc' }],
        include: { department: { select: { name: true } } },
      },
      requirements: { orderBy: { position: 'asc' } },
    },
  });
  if (!exercise) redirect('/portal/applications/new');

  const existing = await prisma.application.findFirst({
    where: { applicantId: user.id, exerciseId: exercise.id, status: { not: 'WITHDRAWN' } },
    select: { id: true, reference: true },
  });

  const isOpen =
    exercise.status === EXERCISE_STATUS.PUBLISHED && exercise.opensAt <= now && exercise.closesAt > now;

  return (
    <>
      <PageHeading
        title={exercise.title}
        description={`${exercise.reference} · closes ${formatDate(exercise.closesAt)}`}
        breadcrumb={[
          { label: 'Dashboard', href: '/portal' },
          { label: 'My Applications', href: '/portal/applications' },
          { label: 'Start an Application' },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {!profile.profileComplete ? (
            <Alert tone="warning" title="Complete your profile first">
              Your personal and contact details must be complete before you can start an application.{' '}
              <Link href="/portal/profile" className="font-semibold underline">Complete profile</Link>
            </Alert>
          ) : existing ? (
            <Alert tone="info" title="You already have an application for this exercise">
              Reference {existing.reference}.{' '}
              <Link href={`/portal/applications/${existing.id}`} className="font-semibold underline">
                Open it here
              </Link>
            </Alert>
          ) : !isOpen ? (
            <Alert tone="error" title="Not open for application">
              This exercise is not currently accepting applications.
            </Alert>
          ) : (
            <Card>
              <div className="card-header"><h2 className="card-title">Select the position you are applying for</h2></div>
              <CardBody>
                <StartApplicationForm
                  exerciseId={exercise.id}
                  vacancies={exercise.vacancies.map((v) => ({
                    id: v.id,
                    jobTitle: v.jobTitle,
                    gradeLevel: v.gradeLevel,
                    positions: v.positions,
                    department: v.department?.name ?? v.agency ?? null,
                    qualifications: v.qualifications,
                    experience: v.experience,
                    minAge: v.minAge,
                    maxAge: v.maxAge,
                  }))}
                />
              </CardBody>
            </Card>
          )}

          {exercise.guidelines ? (
            <Card>
              <div className="card-header"><h2 className="card-title">Application guidelines</h2></div>
              <CardBody><RichText body={exercise.guidelines} /></CardBody>
            </Card>
          ) : null}
          {exercise.eligibility ? (
            <Card>
              <div className="card-header"><h2 className="card-title">Eligibility criteria</h2></div>
              <CardBody><RichText body={exercise.eligibility} /></CardBody>
            </Card>
          ) : null}
        </div>

        <Card>
          <div className="card-header"><h2 className="card-title">Documents you will need</h2></div>
          <CardBody>
            {exercise.requirements.length === 0 ? (
              <p className="text-sm text-slate-600">No specific documents have been configured.</p>
            ) : (
              <ul className="space-y-2.5 text-sm">
                {exercise.requirements.map((r) => (
                  <li key={r.id} className="flex items-start gap-2">
                    <span className={r.required ? 'badge-red mt-0.5' : 'badge-slate mt-0.5'}>
                      {r.required ? 'required' : 'optional'}
                    </span>
                    <span>
                      <span className="block font-medium text-slate-800">{r.label}</span>
                      <span className="block text-xs text-slate-500">Max {r.maxSizeMb}MB</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 rounded bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Prepare clear scans or photographs before you begin. You can save your application as a
              draft and return to it at any time before the closing date.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
