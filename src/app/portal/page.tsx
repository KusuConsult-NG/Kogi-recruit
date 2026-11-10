import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePageApplicant } from '@/lib/page-guards';
import { APPLICATION_STATUS, APPLICATION_STATUS_LABELS, EXERCISE_STATUS, WORKFLOW_STAGES } from '@/lib/constants';
import { formatDate, formatDateTime, age } from '@/lib/format';
import {
  Alert, Card, CardBody, DescriptionList, EmptyState, PageHeading, ProgressBar, StatCard, StatusBadge, readable,
} from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Applicant Dashboard' };

/** Module 3 - applicant dashboard and application tracking. */
export default async function PortalDashboard() {
  const user = await requirePageApplicant();
  const now = new Date();

  const [profile, applications, openExercises, notifications, pendingTests, docCounts] = await Promise.all([
    prisma.applicantProfile.findUnique({ where: { userId: user.id } }),
    prisma.application.findMany({
      where: { applicantId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        exercise: { select: { id: true, title: true, reference: true, closesAt: true, status: true } },
        vacancy: { select: { jobTitle: true, gradeLevel: true } },
        documents: { select: { reviewStatus: true } },
        examCandidates: {
          include: { schedule: { select: { title: true, examDate: true, startTime: true } }, centre: { select: { name: true, address: true } } },
        },
        interviewCandidates: {
          include: { schedule: { select: { title: true, interviewDate: true, startTime: true, venue: true } } },
        },
        statusHistory: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
    prisma.recruitmentExercise.findMany({
      where: { status: EXERCISE_STATUS.PUBLISHED, closesAt: { gt: now }, opensAt: { lte: now } },
      orderBy: { closesAt: 'asc' },
      take: 4,
      include: { vacancies: { where: { active: true }, select: { positions: true } } },
    }),
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.examSitting.findMany({
      where: {
        candidate: { application: { applicantId: user.id } },
        status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
      },
      include: {
        paper: { select: { title: true, durationMinutes: true } },
        candidate: {
          select: {
            examNumber: true,
            schedule: { select: { title: true, opensAt: true, closesAt: true, durationMinutes: true, status: true } },
          },
        },
      },
    }),
    prisma.applicantDocument.groupBy({
      by: ['reviewStatus'],
      where: { application: { applicantId: user.id } },
      _count: { _all: true },
    }),
  ]);

  const active = applications.filter(
    (a) => ![APPLICATION_STATUS.WITHDRAWN, APPLICATION_STATUS.NOT_SELECTED].includes(a.status as never),
  );
  const drafts = applications.filter((a) => a.status === APPLICATION_STATUS.DRAFT);
  const actionRequired = applications.filter((a) =>
    [APPLICATION_STATUS.RESUBMISSION_REQUIRED, APPLICATION_STATUS.INCOMPLETE].includes(a.status as never),
  );
  const docsByStatus = new Map(docCounts.map((d) => [d.reviewStatus, d._count._all]));
  const appliedExerciseIds = new Set(applications.map((a) => a.exerciseId));

  return (
    <>
      <PageHeading
        title={`Welcome, ${profile?.firstName ?? user.fullName}`}
        description={
          <>
            Applicant reference <span className="font-mono font-semibold">{profile?.applicantRef}</span>. This
            dashboard shows every application you have made and its current status at each recruitment stage.
          </>
        }
        actions={
          <Link href="/recruitment" className="btn-primary btn-sm">
            Browse open vacancies
          </Link>
        }
      />

      {actionRequired.length > 0 ? (
        <div className="mb-6">
          <Alert tone="warning" title="Action required">
            {actionRequired.length === 1
              ? 'One of your applications requires correction before it can proceed.'
              : `${actionRequired.length} of your applications require correction before they can proceed.`}{' '}
            {actionRequired.map((a) => (
              <Link key={a.id} href={`/portal/applications/${a.id}`} className="mr-2 font-semibold underline">
                {a.reference}
              </Link>
            ))}
          </Alert>
        </div>
      ) : null}

      <div className="mb-7 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Applications" value={applications.length} hint={`${active.length} active`} href="/portal/applications" />
        <StatCard label="Drafts" value={drafts.length} hint="Not yet submitted" tone={drafts.length ? 'amber' : 'default'} href="/portal/applications?status=DRAFT" />
        <StatCard label="Documents verified" value={docsByStatus.get('VERIFIED') ?? 0} hint={`${docsByStatus.get('PENDING') ?? 0} awaiting review`} tone="green" href="/portal/documents" />
        <StatCard label="Unread notifications" value={notifications.filter((n) => !n.readAt).length} href="/portal/notifications" tone="blue" />
        <StatCard
          label="Tests to sit"
          value={pendingTests.length}
          hint={pendingTests.length > 0 ? 'Awaiting your sitting' : 'Nothing outstanding'}
          tone={pendingTests.length ? 'amber' : 'default'}
          href="/portal/tests"
        />
      </div>

      {pendingTests.length > 0 ? (
        <div className="mb-6 space-y-3">
          {pendingTests.map((sitting) => {
            const open =
              (!sitting.candidate.schedule.opensAt || sitting.candidate.schedule.opensAt <= now)
              && (!sitting.candidate.schedule.closesAt || sitting.candidate.schedule.closesAt >= now)
              && sitting.candidate.schedule.status !== 'CANCELLED';
            const minutes = sitting.candidate.schedule.durationMinutes ?? sitting.paper.durationMinutes;
            return (
              <div
                key={sitting.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-md border-l-4 border-gold-500 bg-gold-50 px-5 py-4 shadow-raised"
              >
                <div className="min-w-0">
                  <p className="micro-label text-gold-700">
                    {sitting.status === 'IN_PROGRESS' ? 'Test in progress' : 'Online test awaiting you'}
                  </p>
                  <p className="mt-1 font-serif text-base font-semibold text-ink-950">
                    {sitting.candidate.schedule.title}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-700">
                    Examination number <span className="ref">{sitting.candidate.examNumber}</span>
                    {' · '}
                    <span data-numeric>{minutes} minutes</span> once you begin
                    {sitting.candidate.schedule.closesAt
                      ? ` · closes ${formatDateTime(sitting.candidate.schedule.closesAt)}`
                      : ''}
                  </p>
                </div>
                <Link
                  href={sitting.status === 'IN_PROGRESS' ? `/examination/${sitting.id}` : '/portal/tests'}
                  className={open ? 'btn-primary' : 'btn-secondary'}
                >
                  {sitting.status === 'IN_PROGRESS' ? 'Resume my test' : open ? 'Begin the test' : 'View details'}
                </Link>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="card-header">
              <h2 className="card-title">My applications</h2>
              <Link href="/portal/applications" className="text-sm text-kogi-700 hover:underline">View all</Link>
            </div>
            {applications.length === 0 ? (
              <CardBody>
                <EmptyState
                  title="You have not applied to any exercise yet"
                  description="Open recruitment exercises are listed on the recruitment page. Complete your profile first, then start an application."
                  action={<Link href="/recruitment" className="btn-primary btn-sm">Browse vacancies</Link>}
                />
              </CardBody>
            ) : (
              <CardBody className="space-y-4">
                {applications.slice(0, 4).map((app) => {
                  const exam = app.examCandidates[0];
                  const interview = app.interviewCandidates[0];
                  const rejectedDocs = app.documents.filter((d) =>
                    ['REJECTED', 'RESUBMISSION_REQUIRED'].includes(d.reviewStatus),
                  ).length;
                  return (
                    <div key={app.id} className="rounded-lg border border-ink-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <Link href={`/portal/applications/${app.id}`} className="text-sm font-semibold text-ink-950 hover:text-kogi-700 hover:underline">
                            {app.exercise.title}
                          </Link>
                          <p className="mt-0.5 text-xs text-ink-500">
                            {app.vacancy ? `${app.vacancy.jobTitle} (${app.vacancy.gradeLevel})` : 'Position not selected'} ·{' '}
                            <span className="font-mono">{app.reference}</span>
                          </p>
                        </div>
                        <StatusBadge status={app.status} label={APPLICATION_STATUS_LABELS[app.status]} />
                      </div>

                      {app.status === APPLICATION_STATUS.DRAFT ? (
                        <div className="mt-3">
                          <ProgressBar value={app.completeness} label="Completeness" tone={app.completeness >= 100 ? 'green' : 'amber'} />
                          <Link href={`/portal/applications/${app.id}`} className="btn-primary btn-sm mt-3">
                            Continue application
                          </Link>
                        </div>
                      ) : (
                        <div className="mt-3 space-y-2 text-xs text-ink-600">
                          <p>Submitted {formatDateTime(app.submittedAt)}</p>
                          {rejectedDocs > 0 ? (
                            <p className="font-semibold text-gold-700">
                              {rejectedDocs} document(s) require correction.
                            </p>
                          ) : null}
                          {exam ? (
                            <p className="rounded bg-[#eef5fa] px-2.5 py-1.5 text-[#164765]">
                              <strong>Examination:</strong> {formatDate(exam.schedule.examDate)} at {exam.schedule.startTime}
                              {exam.centre ? ` · ${exam.centre.name}` : ''} · Exam No.{' '}
                              <span className="font-mono">{exam.examNumber}</span>
                            </p>
                          ) : null}
                          {interview ? (
                            <p className="rounded bg-[#f4f1f9] px-2.5 py-1.5 text-[#3a3053]">
                              <strong>Interview:</strong> {formatDate(interview.schedule.interviewDate)} at{' '}
                              {interview.slotTime ?? interview.schedule.startTime} · {interview.schedule.venue}
                            </p>
                          ) : null}
                          {app.statusHistory[0]?.remarks ? (
                            <p className="text-ink-500">Latest update: {app.statusHistory[0].remarks}</p>
                          ) : null}
                          <Link href={`/portal/applications/${app.id}`} className="inline-block font-semibold text-kogi-700 hover:underline">
                            View application →
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardBody>
            )}
          </Card>

          <Card>
            <div className="card-header">
              <h2 className="card-title">Open recruitment exercises</h2>
              <Link href="/recruitment" className="text-sm text-kogi-700 hover:underline">All exercises</Link>
            </div>
            <CardBody>
              {openExercises.length === 0 ? (
                <p className="text-sm text-ink-600">No exercises are open for application at this time.</p>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {openExercises.map((ex) => (
                    <li key={ex.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div>
                        <Link href={`/recruitment/${ex.id}`} className="text-sm font-medium text-ink-950 hover:text-kogi-700 hover:underline">
                          {ex.title}
                        </Link>
                        <p className="mt-0.5 text-xs text-ink-500">
                          {ex.vacancies.reduce((s, v) => s + v.positions, 0)} position(s) · closes {formatDate(ex.closesAt)}
                        </p>
                      </div>
                      {appliedExerciseIds.has(ex.id) ? (
                        <span className="badge-green">Applied</span>
                      ) : (
                        <Link href={`/portal/applications/new?exercise=${ex.id}`} className="btn-secondary btn-sm">
                          Apply
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="card-header">
              <h2 className="card-title">My details</h2>
              <Link href="/portal/profile" className="text-sm text-kogi-700 hover:underline">Edit</Link>
            </div>
            <CardBody>
              <DescriptionList
                columns={1}
                items={[
                  { label: 'Applicant reference', value: <span className="font-mono">{profile?.applicantRef}</span> },
                  { label: 'Full name', value: profile ? `${profile.surname} ${profile.firstName} ${profile.middleName ?? ''}`.trim() : user.fullName },
                  { label: 'Email', value: user.email },
                  { label: 'Telephone', value: profile?.phone ?? '—' },
                  { label: 'Date of birth', value: profile?.dateOfBirth ? `${formatDate(profile.dateOfBirth)} (age ${age(profile.dateOfBirth)})` : 'Not supplied' },
                  { label: 'State / LGA of origin', value: profile?.stateOfOrigin ? `${profile.stateOfOrigin} / ${profile.lga}` : 'Not supplied' },
                  {
                    label: 'Profile status',
                    value: profile?.profileComplete
                      ? <span className="badge-green">complete</span>
                      : <span className="badge-amber">incomplete</span>,
                  },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <div className="card-header">
              <h2 className="card-title">Recent notifications</h2>
              <Link href="/portal/notifications" className="text-sm text-kogi-700 hover:underline">All</Link>
            </div>
            <CardBody>
              {notifications.length === 0 ? (
                <p className="text-sm text-ink-600">No notifications yet.</p>
              ) : (
                <ul className="space-y-3">
                  {notifications.map((n) => (
                    <li key={n.id} className="border-b border-ink-100 pb-3 last:border-0 last:pb-0">
                      <p className={`text-sm ${n.readAt ? 'text-ink-700' : 'font-semibold text-ink-950'}`}>
                        {n.subject}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500">{formatDateTime(n.createdAt)} · {readable(n.channel)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <div className="card-header"><h2 className="card-title">Recruitment stages</h2></div>
            <CardBody>
              <ol className="space-y-2 text-xs">
                {WORKFLOW_STAGES.map((s) => (
                  <li key={s.key} className="flex gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-kogi-100 text-2xs font-bold text-kogi-800">
                      {s.n}
                    </span>
                    <span className="text-ink-700">{s.name}</span>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
