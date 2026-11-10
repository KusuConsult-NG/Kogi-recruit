import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePageApplicant } from '@/lib/page-guards';
import { COMMISSION, OPTION_LABELS } from '@/lib/constants';
import { isExpired, parseSelected } from '@/lib/cbt';
import { saveAnswer, toggleFlag } from '@/actions/cbt';
import { SubmitButton } from '@/components/forms';
import { Alert } from '@/components/ui';
import { SittingTimer, SubmitSittingForm } from '@/components/exam-runner';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Examination in progress', robots: { index: false } };

/**
 * The examination hall. Deliberately stripped of the portal's navigation so a
 * candidate under a clock has one task in front of them, with a question
 * navigator, one question at a time and the countdown always visible.
 */
export default async function SittingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q } = await searchParams;
  const user = await requirePageApplicant();

  const sitting = await prisma.examSitting.findUnique({
    where: { id },
    include: {
      paper: { select: { title: true, code: true, instructions: true, passMark: true } },
      candidate: {
        include: {
          schedule: { select: { title: true, totalMarks: true, exercise: { select: { reference: true } } } },
          application: { select: { applicantId: true, reference: true } },
        },
      },
      items: {
        orderBy: { position: 'asc' },
        include: {
          question: {
            select: {
              id: true, type: true, stem: true,
              options: { select: { id: true, text: true } },
            },
          },
        },
      },
    },
  });

  if (!sitting || sitting.candidate.application.applicantId !== user.id) notFound();
  if (sitting.status === 'NOT_STARTED') redirect('/portal/tests');
  if (sitting.status === 'SUBMITTED' || sitting.status === 'EXPIRED') {
    redirect(`/examination/${id}/result`);
  }
  if (isExpired(sitting.expiresAt)) {
    // The clock has run out between page loads; the result page finalises it.
    redirect(`/examination/${id}/result?expired=1`);
  }

  const items = sitting.items;
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Alert tone="error" title="This paper could not be assembled">
          Report this to the Commission’s examination officer, quoting examination number{' '}
          {sitting.candidate.examNumber}.
        </Alert>
      </div>
    );
  }

  const requested = Number(q ?? '1');
  const position = Number.isFinite(requested)
    ? Math.min(Math.max(1, Math.trunc(requested)), items.length)
    : 1;
  const item = items[position - 1];
  const selected = new Set(parseSelected(item.selected));
  const optionOrder = parseSelected(item.optionOrder);
  const options = optionOrder
    .map((optionId) => item.question.options.find((o) => o.id === optionId))
    .filter((o): o is { id: string; text: string } => Boolean(o));
  const multi = item.question.type === 'MULTI_CHOICE';

  const answered = items.filter((i) => (i.selected ?? '').length > 0).length;
  const unanswered = items.length - answered;
  const flagged = items.filter((i) => i.flagged).length;

  const totalSeconds =
    sitting.startedAt && sitting.expiresAt
      ? Math.max(1, Math.floor((sitting.expiresAt.getTime() - sitting.startedAt.getTime()) / 1000))
      : 1;

  // Sections, so the candidate can see where they are in the paper.
  const sections = Array.from(new Set(items.map((i) => i.sectionTitle ?? 'Questions')));

  return (
    <div className="min-h-screen bg-ink-100">
      {/* Examination hall header */}
      <header className="border-b-2 border-gold-500 bg-kogi-900 text-white">
        <div className="container-page flex flex-wrap items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <p className="seal-text text-2xs text-gold-300">
              {COMMISSION.shortName} · Examination in progress
            </p>
            <h1 className="mt-0.5 font-serif text-base font-semibold leading-tight">
              {sitting.candidate.schedule.title}
            </h1>
          </div>
          <dl className="flex flex-wrap items-center gap-x-6 gap-y-1 text-right text-2xs">
            <div>
              <dt className="uppercase tracking-label text-kogi-300">Examination number</dt>
              <dd className="font-mono text-xs text-gold-200">{sitting.candidate.examNumber}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-label text-kogi-300">Paper</dt>
              <dd className="font-mono text-xs text-gold-200">{sitting.paper.code}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-label text-kogi-300">Answered</dt>
              <dd className="font-mono text-xs text-gold-200" data-numeric>
                {answered} / {items.length}
              </dd>
            </div>
          </dl>
        </div>
      </header>

      <main id="main-content" className="container-page py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Question */}
          <div className="lg:col-span-3">
            <article className="rounded-md border border-ink-200 bg-white shadow-raised">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 bg-ink-50/80 px-5 py-3">
                <div>
                  <p className="micro-label">{item.sectionTitle ?? 'Questions'}</p>
                  <p className="mt-0.5 font-serif text-base font-semibold text-ink-950">
                    Question {position} of {items.length}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge-slate" data-numeric>
                    {item.marks} mark{item.marks === 1 ? '' : 's'}
                  </span>
                  {multi ? <span className="badge-blue">choose all that apply</span> : null}
                  {item.flagged ? <span className="badge-amber">flagged</span> : null}
                </div>
              </div>

              <form action={saveAnswer} className="px-5 py-5">
                <input type="hidden" name="itemId" value={item.id} />

                <fieldset>
                  <legend className="text-[1.0625rem] font-medium leading-relaxed text-ink-950">
                    {item.question.stem}
                  </legend>
                  <div className="mt-5 space-y-2">
                    {options.map((option, index) => {
                      const checked = selected.has(option.id);
                      return (
                        <label
                          key={option.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition ${
                            checked
                              ? 'border-kogi-600 bg-kogi-50 shadow-raised'
                              : 'border-ink-200 bg-white hover:border-kogi-400 hover:bg-kogi-50/50'
                          }`}
                        >
                          <input
                            type={multi ? 'checkbox' : 'radio'}
                            name="selected"
                            value={option.id}
                            defaultChecked={checked}
                            className={`mt-0.5 ${multi ? 'checkbox' : 'radio'}`}
                          />
                          <span
                            aria-hidden
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border font-mono text-2xs font-bold ${
                              checked ? 'border-kogi-700 bg-kogi-700 text-white' : 'border-ink-300 text-ink-600'
                            }`}
                          >
                            {OPTION_LABELS[index] ?? index + 1}
                          </span>
                          <span className="text-[0.9375rem] leading-relaxed text-ink-900">{option.text}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {position > 1 ? (
                      <SubmitButton
                        className="btn-secondary"
                        name="next"
                        value={String(position - 1)}
                        pendingLabel="Saving…"
                      >
                        ← Save and go back
                      </SubmitButton>
                    ) : null}
                    {position < items.length ? (
                      <SubmitButton
                        className="btn-primary"
                        name="next"
                        value={String(position + 1)}
                        pendingLabel="Saving…"
                      >
                        Save and continue →
                      </SubmitButton>
                    ) : (
                      <SubmitButton
                        className="btn-primary"
                        name="next"
                        value={String(position)}
                        pendingLabel="Saving…"
                      >
                        Save this answer
                      </SubmitButton>
                    )}
                  </div>
                  <p className="text-xs text-ink-500">
                    Your answer is saved on the Commission’s server each time you move on.
                  </p>
                </div>
              </form>

              <div className="border-t border-ink-200 bg-ink-50/70 px-5 py-3">
                <form action={toggleFlag} className="inline">
                  <input type="hidden" name="itemId" value={item.id} />
                  <button type="submit" className="btn-ghost btn-sm">
                    {item.flagged ? 'Remove the flag on this question' : 'Flag this question for review'}
                  </button>
                </form>
              </div>
            </article>

            {sitting.paper.instructions ? (
              <details className="mt-4 rounded-md border border-ink-200 bg-white px-5 py-3 shadow-raised">
                <summary className="cursor-pointer text-[0.8125rem] font-semibold text-kogi-700">
                  Read the instructions for this paper again
                </summary>
                <p className="mt-3 whitespace-pre-line text-[0.8125rem] leading-relaxed text-ink-700">
                  {sitting.paper.instructions}
                </p>
              </details>
            ) : null}
          </div>

          {/* Clock and navigator */}
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <SittingTimer
              sittingId={sitting.id}
              expiresAtIso={sitting.expiresAt!.toISOString()}
              totalSeconds={totalSeconds}
            />

            <div className="rounded-md border border-ink-200 bg-white p-4 shadow-raised">
              <p className="micro-label mb-3">Question navigator</p>
              <ol className="grid grid-cols-6 gap-1.5">
                {items.map((i) => {
                  const done = (i.selected ?? '').length > 0;
                  const current = i.position === position;
                  return (
                    <li key={i.id}>
                      <Link
                        href={`/examination/${sitting.id}?q=${i.position}`}
                        aria-current={current ? 'step' : undefined}
                        aria-label={`Question ${i.position}${done ? ', answered' : ', not answered'}${i.flagged ? ', flagged' : ''}`}
                        className={`relative flex h-8 items-center justify-center rounded-sm border font-mono text-xs font-semibold transition ${
                          current
                            ? 'border-kogi-800 bg-kogi-800 text-white'
                            : done
                              ? 'border-kogi-300 bg-kogi-100 text-kogi-900 hover:border-kogi-600'
                              : 'border-ink-300 bg-white text-ink-600 hover:border-kogi-500 hover:text-kogi-800'
                        }`}
                      >
                        {i.position}
                        {i.flagged ? (
                          <span
                            aria-hidden
                            className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-gold-500"
                          />
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ol>

              <dl className="mt-4 space-y-1.5 border-t border-ink-150 pt-3 text-xs">
                <div className="flex justify-between">
                  <dt className="text-ink-600">Answered</dt>
                  <dd className="font-semibold text-kogi-800" data-numeric>{answered}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-600">Not answered</dt>
                  <dd className="font-semibold text-ink-900" data-numeric>{unanswered}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-600">Flagged for review</dt>
                  <dd className="font-semibold text-gold-700" data-numeric>{flagged}</dd>
                </div>
                {sections.length > 1 ? (
                  <div className="flex justify-between">
                    <dt className="text-ink-600">Sections</dt>
                    <dd className="font-semibold text-ink-900" data-numeric>{sections.length}</dd>
                  </div>
                ) : null}
              </dl>
            </div>

            <div className="rounded-md border border-ink-200 bg-white p-4 shadow-raised">
              <p className="micro-label mb-2">Finish</p>
              <p className="mb-3 text-xs leading-relaxed text-ink-600">
                Submit when you are satisfied with your answers. You cannot return to the paper
                afterwards.
              </p>
              <SubmitSittingForm sittingId={sitting.id} unanswered={unanswered} />
            </div>

            <p className="px-1 text-2xs leading-relaxed text-ink-500">
              This sitting is recorded against examination number {sitting.candidate.examNumber} and
              application {sitting.candidate.application.reference}. Do not refresh or close the window
              until you have submitted.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}
