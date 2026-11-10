import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { PERMISSIONS } from '@/lib/rbac';
import { EXAM_SUBJECT_LABELS, QUESTION_TYPE_LABELS } from '@/lib/constants';
import {
  Alert, Card, CardBody, CardHeader, EmptyState, PageHeading, StatCard, StatusBadge,
} from '@/components/ui';
import { deleteQuestion, deleteQuestionBank } from '@/actions/exams';
import { QuestionBankForm, QuestionForm, QuestionImportForm } from '../../forms';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await prisma.questionBank.findUnique({ where: { id }, select: { title: true } });
  return { title: b?.title ?? 'Question Bank' };
}

export default async function QuestionBankDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePagePermission(PERMISSIONS.EXAM_SET);

  const bank = await prisma.questionBank.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: [{ position: 'asc' }],
        include: {
          options: { orderBy: { position: 'asc' } },
          _count: { select: { paperEntries: true, sittingItems: true } },
        },
      },
      sections: { include: { paper: { select: { id: true, title: true, code: true, status: true } } } },
      _count: { select: { questions: true } },
    },
  });
  if (!bank) notFound();

  const active = bank.questions.filter((q) => q.active);
  const byDifficulty = (d: string) => active.filter((q) => q.difficulty === d).length;
  const totalMarks = active.reduce((s, q) => s + q.marks, 0);

  return (
    <>
      <PageHeading
        eyebrow={`Question bank · ${EXAM_SUBJECT_LABELS[bank.subject] ?? bank.subject}`}
        title={bank.title}
        description={bank.description ?? undefined}
        breadcrumb={[
          { label: 'Administration', href: '/admin' },
          { label: 'Question Banks', href: '/admin/exams/banks' },
          { label: bank.code },
        ]}
        actions={
          <form action={deleteQuestionBank}>
            <input type="hidden" name="id" value={bank.id} />
            <button type="submit" className="btn-secondary btn-sm text-[#9a2c20]">
              {bank.sections.length > 0 ? 'Retire this bank' : 'Delete bank'}
            </button>
          </form>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Questions in use" value={active.length} tone="green" />
        <StatCard label="Withdrawn" value={bank.questions.length - active.length} />
        <StatCard label="Easy" value={byDifficulty('EASY')} />
        <StatCard label="Medium" value={byDifficulty('MEDIUM')} tone="blue" />
        <StatCard label="Hard" value={byDifficulty('HARD')} tone="amber" />
      </div>

      {bank.sections.length > 0 ? (
        <div className="mb-6">
          <Alert tone="info" title="This bank is in use">
            Drawn on by{' '}
            {bank.sections.map((s) => `${s.paper.title} (${s.paper.code})`).join(', ')}. Changing a
            question here changes what future candidates are asked; questions already answered are kept
            on the record.
          </Alert>
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[19rem_minmax(0,1fr)]">
        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Card>
            <CardHeader title="Bank settings" />
            <CardBody>
              <QuestionBankForm
                initial={{
                  id: bank.id,
                  title: bank.title,
                  code: bank.code,
                  subject: bank.subject,
                  description: bank.description ?? '',
                  active: bank.active,
                }}
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Set a question"
              description="Questions are added to this bank and drawn into papers from it."
            />
            <CardBody>
              <QuestionForm bankId={bank.id} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Questions"
              description={`${active.length} in use, ${totalMarks} mark(s) in total.`}
            />
            {bank.questions.length === 0 ? (
              <CardBody>
                <EmptyState
                  title="No questions set"
                  description="Set questions one at a time on the right, or import a batch in the Commission's plain-text format."
                />
              </CardBody>
            ) : (
              <CardBody className="space-y-4">
                <ol className="space-y-3">
                  {bank.questions.map((q, index) => (
                    <li
                      key={q.id}
                      className={`rounded-md border border-ink-200 bg-white p-4 ${q.active ? '' : 'opacity-60'}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-ink-500" data-numeric>
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <StatusBadge status={q.difficulty} />
                            <span className="badge-slate">{QUESTION_TYPE_LABELS[q.type] ?? q.type}</span>
                            <span className="text-xs text-ink-500" data-numeric>
                              {q.marks} mark{q.marks === 1 ? '' : 's'}
                            </span>
                            {q.topic ? <span className="text-xs text-ink-500">· {q.topic}</span> : null}
                            {q.active ? null : <span className="badge-amber">withdrawn</span>}
                          </div>
                          <p className="text-[0.9375rem] leading-snug text-ink-950">{q.stem}</p>
                          <ul className="mt-2.5 space-y-1">
                            {q.options.map((o) => (
                              <li key={o.id} className="flex items-start gap-2 text-[0.8125rem]">
                                <span
                                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border font-mono text-2xs font-bold ${
                                    o.correct
                                      ? 'border-kogi-600 bg-kogi-600 text-white'
                                      : 'border-ink-300 text-ink-500'
                                  }`}
                                >
                                  {o.label}
                                </span>
                                <span className={o.correct ? 'font-semibold text-kogi-900' : 'text-ink-700'}>
                                  {o.text}
                                </span>
                              </li>
                            ))}
                          </ul>
                          {q.explanation ? (
                            <p className="mt-2 border-l-2 border-gold-400 pl-3 text-xs italic text-ink-600">
                              {q.explanation}
                            </p>
                          ) : null}
                          {q._count.sittingItems > 0 ? (
                            <p className="mt-2 text-xs text-ink-500" data-numeric>
                              Answered by {q._count.sittingItems} candidate(s).
                            </p>
                          ) : null}
                        </div>
                        <form action={deleteQuestion}>
                          <input type="hidden" name="id" value={q.id} />
                          <button type="submit" className="btn-ghost btn-sm text-[#9a2c20]">
                            {q._count.sittingItems > 0 ? 'Withdraw' : 'Delete'}
                          </button>
                        </form>
                      </div>

                      <details className="mt-3 border-t border-ink-150 pt-3">
                        <summary className="cursor-pointer text-xs font-semibold text-kogi-700 hover:underline">
                          Amend this question
                        </summary>
                        <div className="mt-3">
                          <QuestionForm
                            bankId={bank.id}
                            initial={{
                              id: q.id,
                              type: q.type,
                              stem: q.stem,
                              topic: q.topic ?? '',
                              difficulty: q.difficulty,
                              marks: q.marks,
                              explanation: q.explanation ?? '',
                              active: q.active,
                              options: q.options.map((o) => ({ text: o.text, correct: o.correct })),
                            }}
                          />
                        </div>
                      </details>
                    </li>
                  ))}
                </ol>
              </CardBody>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Import a batch of questions"
              description="Paste a set of questions rather than typing them one by one."
            />
            <CardBody>
              <QuestionImportForm bankId={bank.id} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
