import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePageApplicant } from '@/lib/page-guards';
import { COMMISSION, SITTING_STATUS_LABELS } from '@/lib/constants';
import { CommissionCrest } from '@/components/site-chrome';
import { formatDateTime } from '@/lib/format';
import { isExpired } from '@/lib/cbt';
import { finaliseSitting } from '@/actions/cbt';
import {
  Alert, Card, CardBody, CardHeader, DescriptionList, PageHeading, StatCard, StatusBadge,
} from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Test submission', robots: { index: false } };

/**
 * What the candidate sees once a sitting is closed. The score is shown only
 * where the paper allows it; otherwise the candidate sees that the submission
 * was received and that results are released separately.
 */
export default async function SittingResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageApplicant();

  let sitting = await prisma.examSitting.findUnique({
    where: { id },
    include: {
      paper: { select: { title: true, code: true, passMark: true, showResultToCandidate: true } },
      candidate: {
        include: {
          schedule: { select: { title: true, totalMarks: true, passMark: true, resultsPublishedAt: true } },
          application: { select: { id: true, applicantId: true, reference: true } },
        },
      },
      _count: { select: { items: true } },
    },
  });

  if (!sitting || sitting.candidate.application.applicantId !== user.id) notFound();

  // Arriving here with the clock run out closes and marks the sitting.
  if (sitting.status === 'IN_PROGRESS' && isExpired(sitting.expiresAt)) {
    await finaliseSitting(sitting.id, 'TIMER');
    sitting = await prisma.examSitting.findUniqueOrThrow({
      where: { id },
      include: {
        paper: { select: { title: true, code: true, passMark: true, showResultToCandidate: true } },
        candidate: {
          include: {
            schedule: { select: { title: true, totalMarks: true, passMark: true, resultsPublishedAt: true } },
            application: { select: { id: true, applicantId: true, reference: true } },
          },
        },
        _count: { select: { items: true } },
      },
    });
  }

  const showScore = sitting.paper.showResultToCandidate || Boolean(sitting.candidate.schedule.resultsPublishedAt);
  const passed = (sitting.percentage ?? 0) >= sitting.paper.passMark;

  return (
    <div className="flex min-h-screen flex-col bg-ink-100">
      <header className="border-b-2 border-gold-500 bg-kogi-900 text-white">
        <div className="container-page flex flex-wrap items-center justify-between gap-4 py-3.5">
          <Link href="/portal/tests" className="flex items-center gap-3.5">
            <CommissionCrest size={40} />
            <span>
              <span className="block font-serif text-base font-semibold leading-tight">
                {COMMISSION.name}
              </span>
              <span className="mt-0.5 block text-2xs uppercase tracking-label text-gold-200">
                Examination submission
              </span>
            </span>
          </Link>
          <Link
            href="/portal"
            className="btn btn-sm border-white/25 bg-white/10 text-white hover:border-white/60 hover:bg-white/20"
          >
            Back to my dashboard
          </Link>
        </div>
      </header>

      <main id="main-content" className="container-page flex-1 py-8">
      <PageHeading
        eyebrow="Examination submission"
        title={sitting.candidate.schedule.title}
        description={`Paper ${sitting.paper.title} (${sitting.paper.code}) · examination number ${sitting.candidate.examNumber}`}
        breadcrumb={[
          { label: 'Tests & Examinations', href: '/portal/tests' },
          { label: 'Submission' },
        ]}
        actions={<StatusBadge status={sitting.status} label={SITTING_STATUS_LABELS[sitting.status]} />}
      />

      <div className="mb-6">
        {sitting.status === 'EXPIRED' ? (
          <Alert tone="warning" title="The allotted time ran out">
            Your test was submitted automatically when the clock reached zero. Everything you had
            answered up to that point was saved and marked.
          </Alert>
        ) : (
          <Alert tone="success" title="Your submission has been received">
            Your answers were recorded against examination number {sitting.candidate.examNumber}. No
            further action is needed from you at this stage.
          </Alert>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Questions on your paper" value={sitting._count.items} />
        <StatCard label="Questions answered" value={sitting.answeredCount} tone="blue" />
        <StatCard
          label="Questions left blank"
          value={Math.max(0, sitting._count.items - sitting.answeredCount)}
          tone={sitting._count.items - sitting.answeredCount > 0 ? 'amber' : 'default'}
        />
        <StatCard
          label="Your score"
          value={showScore ? `${sitting.percentage ?? 0}%` : 'Withheld'}
          tone={showScore ? (passed ? 'green' : 'red') : 'default'}
          hint={showScore ? `Pass mark ${sitting.paper.passMark}%` : 'Released by the Commission'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Record of your sitting" />
          <CardBody>
            <DescriptionList
              columns={1}
              items={[
                { label: 'Application', value: <span className="ref">{sitting.candidate.application.reference}</span> },
                { label: 'Examination number', value: <span className="ref">{sitting.candidate.examNumber}</span> },
                { label: 'Started', value: sitting.startedAt ? formatDateTime(sitting.startedAt) : '—' },
                { label: 'Submitted', value: sitting.submittedAt ? formatDateTime(sitting.submittedAt) : '—' },
                {
                  label: 'Submitted by',
                  value:
                    sitting.submittedBy === 'TIMER'
                      ? 'Automatically, when the time ran out'
                      : sitting.submittedBy === 'OFFICER'
                        ? 'Closed by an examination officer'
                        : 'You',
                },
                {
                  label: 'Marks',
                  value: showScore ? `${sitting.rawScore} of ${sitting.totalMarks}` : 'Withheld until released',
                },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="What happens next" />
          <CardBody className="prose-content">
            <p>
              Your answers were marked automatically as you saved them, and your score has been entered
              against your examination record. An examination officer validates the scores for the whole
              examination before any result is treated as final.
            </p>
            {showScore ? (
              <p>
                {passed
                  ? 'Your score is at or above the pass mark for this paper. Shortlisting for the next stage is decided by the Commission on the whole of your record, not on this paper alone.'
                  : 'Your score is below the pass mark for this paper. The Commission will notify you of the outcome of this stage.'}
              </p>
            ) : (
              <p>
                Scores are not released at the point of submission. You will be notified through the
                portal and by email when the results of this examination are published.
              </p>
            )}
            <p>
              Keep your examination number for any correspondence about this sitting.
            </p>
            <p>
              <Link href="/portal/tests" className="link">Back to my tests and examinations</Link>
              {' · '}
              <Link href={`/portal/applications/${sitting.candidate.application.id}`} className="link">
                View my application
              </Link>
            </p>
          </CardBody>
        </Card>
      </div>
      </main>

      <footer className="mt-10 border-t-2 border-gold-500 bg-kogi-900 py-5">
        <p className="container-page text-center text-2xs leading-relaxed text-kogi-300">
          © {new Date().getFullYear()} {COMMISSION.name} · This record is held against examination
          number {sitting.candidate.examNumber}.
        </p>
      </footer>
    </div>
  );
}
