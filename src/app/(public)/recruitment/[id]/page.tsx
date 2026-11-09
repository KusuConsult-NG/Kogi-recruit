import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { EXERCISE_STATUS, EXERCISE_STATUS_LABELS, ROLES } from '@/lib/constants';
import { formatDate, formatDateTime } from '@/lib/format';
import { Alert, Card, CardBody, PageHeading, StatusBadge, DescriptionList } from '@/components/ui';
import { RichText } from '@/components/rich-text';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ex = await prisma.recruitmentExercise.findUnique({ where: { id }, select: { title: true } });
  return { title: ex?.title ?? 'Recruitment Exercise' };
}

const PUBLIC_STATUSES: string[] = [
  EXERCISE_STATUS.PUBLISHED, EXERCISE_STATUS.SUSPENDED,
  EXERCISE_STATUS.CLOSED, EXERCISE_STATUS.ARCHIVED,
];

export default async function ExercisePublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();

  const exercise = await prisma.recruitmentExercise.findUnique({
    where: { id },
    include: {
      vacancies: { where: { active: true }, orderBy: [{ gradeLevel: 'desc' }, { jobTitle: 'asc' }], include: { department: { select: { name: true } }, ministry: { select: { id: true, name: true, code: true, kind: true } }, ministryDept: { select: { name: true } } } },
      requirements: { orderBy: { position: 'asc' } },
      _count: { select: { applications: true } },
    },
  });
  if (!exercise || !PUBLIC_STATUSES.includes(exercise.status)) notFound();

  const now = new Date();
  const isOpen = exercise.status === EXERCISE_STATUS.PUBLISHED && exercise.opensAt <= now && exercise.closesAt > now;

  const existing =
    user && user.role === ROLES.APPLICANT
      ? await prisma.application.findFirst({
          where: { applicantId: user.id, exerciseId: exercise.id },
          select: { id: true, reference: true, status: true },
        })
      : null;

  return (
    <div className="container-page py-10">
      <PageHeading
        eyebrow="Recruitment exercise"
        title={exercise.title}
        description={exercise.reference}
        breadcrumb={[
          { label: 'Home', href: '/' },
          { label: 'Recruitment', href: '/recruitment' },
          { label: exercise.title.slice(0, 40) },
        ]}
        actions={<StatusBadge status={exercise.status} label={EXERCISE_STATUS_LABELS[exercise.status]} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="card-header"><h2 className="card-title">About this exercise</h2></div>
            <CardBody>
              <RichText body={exercise.description} />
            </CardBody>
          </Card>

          {exercise.eligibility ? (
            <Card>
              <div className="card-header"><h2 className="card-title">Eligibility criteria</h2></div>
              <CardBody><RichText body={exercise.eligibility} /></CardBody>
            </Card>
          ) : null}

        </div>

        {/* Key dates and the apply panel travel with the reader. */}
        <div className="space-y-6 lg:sticky lg:top-28 lg:self-start">
          <Card>
            <div className="card-header"><h2 className="card-title">Key dates</h2></div>
            <CardBody>
              <DescriptionList
                columns={1}
                items={[
                  { label: 'Opens', value: formatDateTime(exercise.opensAt) },
                  { label: 'Closes', value: formatDateTime(exercise.closesAt) },
                  { label: 'Reference', value: exercise.reference },
                  { label: 'Applications received', value: exercise._count.applications.toLocaleString('en-NG') },
                  { label: 'Written examination', value: exercise.requireExam ? 'Applicable' : 'Not applicable' },
                  { label: 'Interview', value: exercise.requireInterview ? 'Applicable' : 'Not applicable' },
                  { label: 'Applications per applicant', value: exercise.maxApplications },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <div className="card-header"><h2 className="card-title">Apply</h2></div>
            <CardBody className="space-y-3">
              {!isOpen ? (
                <Alert tone="warning">
                  {exercise.status === EXERCISE_STATUS.PUBLISHED && exercise.opensAt > now
                    ? `Applications open on ${formatDate(exercise.opensAt)}.`
                    : exercise.status === EXERCISE_STATUS.SUSPENDED
                      ? 'This exercise is temporarily suspended and is not accepting applications.'
                      : 'This exercise is no longer accepting applications.'}
                </Alert>
              ) : existing ? (
                <>
                  <Alert tone="success" title="You have already applied">
                    Reference {existing.reference}
                  </Alert>
                  <Link href={`/portal/applications/${existing.id}`} className="btn-primary w-full">
                    Open my application
                  </Link>
                </>
              ) : user && user.role === ROLES.APPLICANT ? (
                <Link href={`/portal/applications/new?exercise=${exercise.id}`} className="btn-primary w-full">
                  Start my application
                </Link>
              ) : user ? (
                <Alert tone="info">
                  You are signed in as a Commission officer. Applications are submitted from an
                  applicant account.
                </Alert>
              ) : (
                <>
                  <p className="text-sm text-ink-600">
                    You need an applicant account to apply. Registration takes about two minutes.
                  </p>
                  <Link href="/register" className="btn-primary w-full">Create an applicant account</Link>
                  <Link href={`/login?next=/recruitment/${exercise.id}`} className="btn-secondary w-full">
                    I already have an account
                  </Link>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Long-form matter runs the full width of the page. */}
      <div className="mt-6 space-y-6">
          {exercise.guidelines ? (
            <Card>
              <div className="card-header"><h2 className="card-title">Application guidelines</h2></div>
              <CardBody><RichText body={exercise.guidelines} /></CardBody>
            </Card>
          ) : null}

          <Card>
            <div className="card-header">
              <h2 className="card-title">Approved vacancies</h2>
              <span className="badge-slate">
                {exercise.vacancies.reduce((s, v) => s + v.positions, 0)} position(s)
              </span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Job title</th>
                    <th>Grade</th>
                    <th>Employing MDA</th>
                    <th>Posts</th>
                    <th>Qualification requirements</th>
                    <th>Age</th>
                  </tr>
                </thead>
                <tbody>
                  {exercise.vacancies.map((v) => (
                    <tr key={v.id}>
                      <td className="font-medium text-ink-950">{v.jobTitle}</td>
                      <td className="whitespace-nowrap">{v.gradeLevel}</td>
                      <td>
                        {v.ministry ? (
                          <>
                            <Link href={`/recruitment?ministry=${v.ministry.id}`} className="link">
                              {v.ministry.name}
                            </Link>
                            {v.ministryDept ? (
                              <span className="mt-0.5 block text-xs text-ink-500">{v.ministryDept.name}</span>
                            ) : null}
                          </>
                        ) : (
                          (v.department?.name ?? '—')
                        )}
                      </td>
                      <td>{v.positions}</td>
                      <td className="max-w-md text-xs">
                        {v.qualifications}
                        {v.experience ? <span className="mt-1 block text-ink-500">Experience: {v.experience}</span> : null}
                      </td>
                      <td className="whitespace-nowrap text-xs">
                        {v.minAge || v.maxAge ? `${v.minAge ?? '—'} – ${v.maxAge ?? '—'}` : 'No limit'}
                      </td>
                    </tr>
                  ))}
                  {exercise.vacancies.length === 0 ? (
                    <tr><td colSpan={6} className="py-6 text-center text-sm text-ink-500">No vacancies published.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>

          {exercise.requirements.length > 0 ? (
            <Card>
              <div className="card-header"><h2 className="card-title">Documents you must upload</h2></div>
              <CardBody>
                <ul className="divide-y divide-ink-100">
                  {exercise.requirements.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium text-ink-950">
                          {r.label}
                          {r.required ? <span className="ml-1.5 badge-red">required</span> : <span className="ml-1.5 badge-slate">optional</span>}
                        </p>
                        {r.description ? <p className="mt-0.5 text-xs text-ink-600">{r.description}</p> : null}
                      </div>
                      <p className="text-xs text-ink-500">Max {r.maxSizeMb}MB</p>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
      </div>
    </div>
  );
}

