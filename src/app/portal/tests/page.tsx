import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePageApplicant } from '@/lib/page-guards';
import { EXAM_MODE_LABELS, SITTING_STATUS_LABELS } from '@/lib/constants';
import { formatDate, formatDateTime } from '@/lib/format';
import {
  Alert, Card, CardBody, CardHeader, EmptyState, PageHeading, StatusBadge,
} from '@/components/ui';
import { StartSittingForm } from '@/components/exam-runner';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tests and Examinations' };

/** Every examination the applicant has been invited to, online or at a centre. */
export default async function MyTestsPage() {
  const user = await requirePageApplicant();
  const now = new Date();

  const candidacies = await prisma.examCandidate.findMany({
    where: { application: { applicantId: user.id } },
    orderBy: { createdAt: 'desc' },
    include: {
      schedule: {
        include: {
          exercise: { select: { reference: true, title: true } },
          paper: { select: { title: true, durationMinutes: true, showResultToCandidate: true, instructions: true } },
        },
      },
      centre: { select: { name: true, address: true, lga: true } },
      sitting: true,
      application: { select: { id: true, reference: true, vacancy: { select: { jobTitle: true } } } },
    },
  });

  const online = candidacies.filter((c) => c.schedule.mode !== 'CENTRE');
  const centreBased = candidacies.filter((c) => c.schedule.mode === 'CENTRE');

  return (
    <>
      <PageHeading
        eyebrow="Stage 7 · Examination and assessment"
        title="Tests and Examinations"
        description="Aptitude tests and examinations you have been invited to sit. An online test is sat here in the portal, under a clock; a centre-based examination is sat at the centre stated on your invitation."
      />

      {candidacies.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="You have not been invited to a test"
              description="If an examination or aptitude test is required for a position you have applied for, it will appear here once you have been shortlisted and allocated."
              action={
                <Link href="/portal/applications" className="btn-secondary btn-sm">
                  View my applications
                </Link>
              }
            />
          </CardBody>
        </Card>
      ) : null}

      {online.length > 0 ? (
        <section className="mb-8 space-y-5">
          <h2 className="font-serif text-lg font-semibold text-ink-950">Online tests</h2>
          {online.map((c) => {
            const sitting = c.sitting;
            const minutes = c.schedule.durationMinutes ?? c.schedule.paper?.durationMinutes ?? 0;
            const notOpenYet = c.schedule.opensAt && now < c.schedule.opensAt;
            const windowClosed = c.schedule.closesAt && now > c.schedule.closesAt;
            const done = sitting?.status === 'SUBMITTED' || sitting?.status === 'EXPIRED';
            const running = sitting?.status === 'IN_PROGRESS';

            return (
              <Card key={c.id}>
                <CardHeader
                  eyebrow={`${c.schedule.exercise.reference} · ${EXAM_MODE_LABELS[c.schedule.mode] ?? c.schedule.mode}`}
                  title={c.schedule.title}
                  description={c.application.vacancy?.jobTitle ?? undefined}
                  actions={
                    sitting ? (
                      <StatusBadge status={sitting.status} label={SITTING_STATUS_LABELS[sitting.status]} />
                    ) : (
                      <span className="badge-slate">not released</span>
                    )
                  }
                />
                <CardBody className="space-y-4">
                  <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
                    <div>
                      <dt className="micro-label">Examination number</dt>
                      <dd className="mt-1 ref">{c.examNumber}</dd>
                    </div>
                    <div>
                      <dt className="micro-label">Time allowed</dt>
                      <dd className="mt-1 text-sm font-semibold text-ink-900" data-numeric>
                        {minutes} minutes
                      </dd>
                    </div>
                    <div>
                      <dt className="micro-label">Opens</dt>
                      <dd className="mt-1 text-sm text-ink-800">
                        {c.schedule.opensAt ? formatDateTime(c.schedule.opensAt) : 'Open now'}
                      </dd>
                    </div>
                    <div>
                      <dt className="micro-label">Closes</dt>
                      <dd className="mt-1 text-sm text-ink-800">
                        {c.schedule.closesAt ? formatDateTime(c.schedule.closesAt) : 'No closing time'}
                      </dd>
                    </div>
                  </dl>

                  {!sitting ? (
                    <Alert tone="info">
                      Your test has not been released yet. Check back nearer the date on your invitation.
                    </Alert>
                  ) : done ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-kogi-200 bg-kogi-50 px-4 py-3">
                      <p className="text-sm text-kogi-900">
                        You sat this test on{' '}
                        <strong className="font-semibold">
                          {sitting.submittedAt ? formatDateTime(sitting.submittedAt) : '—'}
                        </strong>
                        {sitting.status === 'EXPIRED' ? ' (the allotted time ran out)' : ''}.
                      </p>
                      <Link href={`/examination/${sitting.id}/result`} className="btn-secondary btn-sm">
                        View my submission
                      </Link>
                    </div>
                  ) : notOpenYet ? (
                    <Alert tone="warning" title="Not open yet">
                      This test opens at {formatDateTime(c.schedule.opensAt!)}. You will be able to begin
                      from this page at that time.
                    </Alert>
                  ) : windowClosed ? (
                    <Alert tone="error" title="The window has closed">
                      This test closed at {formatDateTime(c.schedule.closesAt!)} and can no longer be
                      started. Contact the Commission if you were prevented from sitting it.
                    </Alert>
                  ) : running ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gold-400 bg-gold-50 px-4 py-3">
                      <p className="text-sm text-gold-900">
                        <strong className="font-semibold">Your test is in progress.</strong> The clock is
                        still running — return to it now.
                      </p>
                      <Link href={`/examination/${sitting.id}`} className="btn-primary btn-sm">
                        Resume my test
                      </Link>
                    </div>
                  ) : (
                    <div className="panel-inset space-y-3">
                      <p className="text-sm leading-relaxed text-ink-700">
                        When you begin, the clock runs for{' '}
                        <strong className="font-semibold" data-numeric>{minutes} minutes</strong> without
                        stopping. Your answers are saved as you go, and the test submits itself when the
                        time is up. Make sure you have a steady connection before you start.
                      </p>
                      <StartSittingForm sittingId={sitting.id} label="Begin the test" />
                    </div>
                  )}

                  {c.schedule.instructions ? (
                    <div className="border-t border-ink-150 pt-3">
                      <p className="micro-label mb-1">Instructions</p>
                      <p className="whitespace-pre-line text-[0.8125rem] leading-relaxed text-ink-700">
                        {c.schedule.instructions}
                      </p>
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            );
          })}
        </section>
      ) : null}

      {centreBased.length > 0 ? (
        <section className="space-y-5">
          <h2 className="font-serif text-lg font-semibold text-ink-950">Centre-based examinations</h2>
          <Card>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Examination</th><th>Exam no.</th><th>Date</th><th>Time</th>
                    <th>Centre</th><th>Seat</th><th>Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {centreBased.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <p className="font-medium text-ink-950">{c.schedule.title}</p>
                        <p className="text-xs text-ink-500">{c.schedule.exercise.reference}</p>
                      </td>
                      <td><span className="ref">{c.examNumber}</span></td>
                      <td className="text-xs">{formatDate(c.schedule.examDate)}</td>
                      <td className="text-xs">{c.schedule.startTime}</td>
                      <td className="text-xs">
                        {c.centre?.name ?? 'To be advised'}
                        {c.centre?.address ? <span className="block text-ink-500">{c.centre.address}</span> : null}
                      </td>
                      <td className="text-xs">{c.seatNumber ?? '—'}</td>
                      <td><StatusBadge status={c.attendance} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      ) : null}
    </>
  );
}
