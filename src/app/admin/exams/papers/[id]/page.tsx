import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { PERMISSIONS } from '@/lib/rbac';
import { PAPER_KIND_LABELS, PAPER_STATUS, SITTING_STATUS_LABELS } from '@/lib/constants';
import { formatDate, formatDateTime } from '@/lib/format';
import {
  Alert, Card, CardBody, CardHeader, DescriptionList, EmptyState, PageHeading,
  StatCard, StatusBadge,
} from '@/components/ui';
import { copyExamPaper, deletePaperSection } from '@/actions/exams';
import {
  ExamPaperForm, PaperSectionForm, PaperStatusForm, SectionQuestionPicker,
} from '../../forms';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await prisma.examPaper.findUnique({ where: { id }, select: { title: true } });
  return { title: p?.title ?? 'Examination Paper' };
}

export default async function ExamPaperDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePagePermission(PERMISSIONS.EXAM_SET);

  const [paper, banks] = await Promise.all([
    prisma.examPaper.findUnique({
      where: { id },
      include: {
        sections: {
          orderBy: { position: 'asc' },
          include: {
            bank: {
              select: {
                id: true, title: true, code: true,
                questions: {
                  where: { active: true },
                  orderBy: { position: 'asc' },
                  select: { id: true, stem: true, difficulty: true, marks: true },
                },
              },
            },
            questions: { orderBy: { position: 'asc' }, select: { questionId: true, marks: true } },
          },
        },
        schedules: {
          orderBy: { examDate: 'desc' },
          include: {
            exercise: { select: { id: true, reference: true } },
            _count: { select: { candidates: true } },
          },
        },
        sittings: {
          orderBy: { updatedAt: 'desc' },
          take: 20,
          include: {
            candidate: {
              select: {
                examNumber: true,
                application: { select: { reference: true } },
              },
            },
          },
        },
        _count: { select: { sittings: true } },
      },
    }),
    prisma.questionBank.findMany({
      where: { active: true },
      orderBy: { title: 'asc' },
      include: { _count: { select: { questions: true } } },
    }),
  ]);
  if (!paper) notFound();

  const locked = paper._count.sittings > 0;
  const bankOptions = banks.map((b) => ({
    id: b.id, title: b.title, code: b.code, questionCount: b._count.questions,
  }));

  const sectionQuestionCount = (s: (typeof paper.sections)[number]) =>
    s.drawCount ?? s.questions.length;
  const totalQuestions = paper.sections.reduce((t, s) => t + sectionQuestionCount(s), 0);
  const totalMarks = paper.sections.reduce(
    (t, s) => t + sectionQuestionCount(s) * s.marksPerQuestion,
    0,
  );

  const submitted = paper.sittings.filter((s) => s.submittedAt);
  const averagePercentage =
    submitted.length > 0
      ? Math.round((submitted.reduce((t, s) => t + (s.percentage ?? 0), 0) / submitted.length) * 10) / 10
      : null;

  return (
    <>
      <PageHeading
        eyebrow={`Examination paper · ${PAPER_KIND_LABELS[paper.kind] ?? paper.kind}`}
        title={paper.title}
        breadcrumb={[
          { label: 'Administration', href: '/admin' },
          { label: 'Examination Papers', href: '/admin/exams/papers' },
          { label: paper.code },
        ]}
        actions={
          <>
            <StatusBadge status={paper.status} />
            {paper.status === PAPER_STATUS.DRAFT ? (
              <PaperStatusForm
                paperId={paper.id}
                to={PAPER_STATUS.PUBLISHED}
                label="Publish paper"
                tone="btn-primary"
                confirm="Publish this paper so examinations can be set with it?"
              />
            ) : null}
            {paper.status === PAPER_STATUS.PUBLISHED ? (
              <PaperStatusForm
                paperId={paper.id}
                to={PAPER_STATUS.RETIRED}
                label="Retire paper"
                confirm="Retire this paper? It will no longer be available for new examinations."
              />
            ) : null}
            {paper.status === PAPER_STATUS.RETIRED ? (
              <PaperStatusForm paperId={paper.id} to={PAPER_STATUS.DRAFT} label="Return to draft" />
            ) : null}
            <form action={copyExamPaper}>
              <input type="hidden" name="id" value={paper.id} />
              <button type="submit" className="btn-secondary btn-sm">Copy paper</button>
            </form>
          </>
        }
      />

      {locked ? (
        <div className="mb-6">
          <Alert tone="warning" title="This paper has been sat">
            {paper._count.sittings} candidate sitting(s) are recorded against this paper, so its
            settings and sections are locked. Copy the paper to produce a revised version for future
            examinations.
          </Alert>
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Sections" value={paper.sections.length} />
        <StatCard label="Questions per sitting" value={totalQuestions} tone="blue" />
        <StatCard label="Total marks" value={totalMarks} />
        <StatCard label="Duration" value={`${paper.durationMinutes} min`} tone="amber" />
        <StatCard
          label="Average score"
          value={averagePercentage === null ? '—' : `${averagePercentage}%`}
          tone="green"
          hint={submitted.length > 0 ? `${submitted.length} submitted sitting(s)` : 'No sittings yet'}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[19rem_minmax(0,1fr)]">
        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader title="Paper settings" />
            <CardBody>
              <ExamPaperForm
                locked={locked}
                initial={{
                  id: paper.id,
                  title: paper.title,
                  code: paper.code,
                  kind: paper.kind,
                  instructions: paper.instructions ?? '',
                  durationMinutes: paper.durationMinutes,
                  passMark: paper.passMark,
                  shuffleQuestions: paper.shuffleQuestions,
                  shuffleOptions: paper.shuffleOptions,
                  showResultToCandidate: paper.showResultToCandidate,
                }}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="How this paper is conducted" />
            <CardBody>
              <DescriptionList
                columns={1}
                items={[
                  { label: 'Question order', value: paper.shuffleQuestions ? 'Shuffled per candidate' : 'Fixed order' },
                  { label: 'Answer options', value: paper.shuffleOptions ? 'Shuffled per candidate' : 'Fixed order' },
                  { label: 'Score shown to candidate', value: paper.showResultToCandidate ? 'Immediately on submission' : 'Withheld until results are published' },
                  { label: 'Pass mark', value: `${paper.passMark}%` },
                  { label: 'Marking', value: 'Automatic, as each answer is saved' },
                ]}
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Sections"
              description="A section either names its questions or draws a fresh random selection from a bank for every candidate."
            />
            <CardBody className="space-y-5">
              {paper.sections.length === 0 ? (
                <EmptyState
                  title="This paper has no sections"
                  description="Add a section, then either draw questions at random from a bank or pick them by hand."
                />
              ) : (
                paper.sections.map((section, index) => (
                  <div key={section.id} className="rounded-md border border-ink-200 bg-white">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-200 bg-ink-50/80 px-4 py-3">
                      <div className="min-w-0">
                        <p className="micro-label">Section {index + 1}</p>
                        <h3 className="font-serif text-base font-semibold text-ink-950">{section.title}</h3>
                        {section.description ? (
                          <p className="mt-0.5 text-xs text-ink-600">{section.description}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {section.drawCount ? (
                          <span className="badge-blue" data-numeric>
                            {section.drawCount} drawn at random
                          </span>
                        ) : (
                          <span className="badge-slate" data-numeric>
                            {section.questions.length} chosen by hand
                          </span>
                        )}
                        <span className="text-xs text-ink-500" data-numeric>
                          {section.marksPerQuestion} mark{section.marksPerQuestion === 1 ? '' : 's'} each
                        </span>
                        {!locked ? (
                          <form action={deletePaperSection}>
                            <input type="hidden" name="id" value={section.id} />
                            <button type="submit" className="btn-ghost btn-sm text-[#9a2c20]">Remove</button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-4 px-4 py-4">
                      {section.bank ? (
                        <p className="text-xs text-ink-600">
                          Bank:{' '}
                          <Link href={`/admin/exams/banks/${section.bank.id}`} className="link">
                            {section.bank.title} ({section.bank.code})
                          </Link>
                          {' · '}
                          <span data-numeric>{section.bank.questions.length}</span> active question(s)
                        </p>
                      ) : (
                        <p className="text-xs text-ink-600">
                          No bank attached. Choose a bank below to pick or draw questions.
                        </p>
                      )}

                      {!locked ? (
                        <>
                          {section.bank && !section.drawCount ? (
                            <div>
                              <p className="micro-label mb-2">Choose the questions for this section</p>
                              <SectionQuestionPicker
                                sectionId={section.id}
                                questions={section.bank.questions}
                                selectedIds={section.questions.map((q) => q.questionId)}
                              />
                            </div>
                          ) : null}
                          <details className="border-t border-ink-150 pt-3">
                            <summary className="cursor-pointer text-xs font-semibold text-kogi-700 hover:underline">
                              Amend this section
                            </summary>
                            <div className="mt-3">
                              <PaperSectionForm
                                paperId={paper.id}
                                banks={bankOptions}
                                initial={{
                                  id: section.id,
                                  title: section.title,
                                  description: section.description ?? '',
                                  bankId: section.bankId ?? '',
                                  drawCount: section.drawCount ? String(section.drawCount) : '',
                                  marksPerQuestion: section.marksPerQuestion,
                                }}
                              />
                            </div>
                          </details>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))
              )}

              {!locked ? (
                <div className="panel-inset">
                  <p className="micro-label mb-3">Add a section</p>
                  <PaperSectionForm paperId={paper.id} banks={bankOptions} />
                </div>
              ) : null}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Examinations set with this paper" />
            {paper.schedules.length === 0 ? (
              <CardBody>
                <EmptyState
                  title="Not yet attached to an examination"
                  description="Publish the paper, then choose it when creating an examination with an online or hybrid mode."
                  action={
                    <Link href="/admin/examinations/new" className="btn-secondary btn-sm">
                      Create an examination
                    </Link>
                  }
                />
              </CardBody>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Examination</th><th>Exercise</th><th>Mode</th><th>Date</th>
                      <th className="num">Candidates</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paper.schedules.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <Link href={`/admin/examinations/${s.id}`} className="font-medium text-ink-950 hover:text-kogi-700 hover:underline">
                            {s.title}
                          </Link>
                        </td>
                        <td><span className="ref">{s.exercise.reference}</span></td>
                        <td><StatusBadge status={s.mode} /></td>
                        <td className="text-xs">{formatDate(s.examDate)}</td>
                        <td className="num">{s._count.candidates}</td>
                        <td><StatusBadge status={s.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {paper.sittings.length > 0 ? (
            <Card>
              <CardHeader title="Recent sittings" description="The twenty most recent candidate sittings." />
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Examination number</th><th>Application</th><th>Status</th>
                      <th className="num">Answered</th><th className="num">Score</th>
                      <th className="num">Percentage</th><th>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paper.sittings.map((s) => (
                      <tr key={s.id}>
                        <td><span className="ref">{s.candidate.examNumber}</span></td>
                        <td><span className="ref">{s.candidate.application.reference}</span></td>
                        <td><StatusBadge status={s.status} label={SITTING_STATUS_LABELS[s.status]} /></td>
                        <td className="num">{s.answeredCount}</td>
                        <td className="num">{s.submittedAt ? `${s.rawScore}/${s.totalMarks}` : '—'}</td>
                        <td className="num font-semibold">
                          {s.percentage === null ? '—' : `${s.percentage}%`}
                        </td>
                        <td className="text-xs">{s.submittedAt ? formatDateTime(s.submittedAt) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

