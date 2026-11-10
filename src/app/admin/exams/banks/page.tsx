import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { PERMISSIONS } from '@/lib/rbac';
import { EXAM_SUBJECT_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import { Card, CardBody, CardHeader, EmptyState, PageHeading, StatCard } from '@/components/ui';
import { QuestionBankForm } from '../forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Question Banks' };

/** Where officers set the questions that aptitude tests and examinations draw on. */
export default async function QuestionBanksPage() {
  await requirePagePermission(PERMISSIONS.EXAM_SET);

  const banks = await prisma.questionBank.findMany({
    orderBy: [{ active: 'desc' }, { subject: 'asc' }, { title: 'asc' }],
    include: {
      _count: { select: { questions: true, sections: true } },
      createdBy: { select: { fullName: true } },
    },
  });

  const totalQuestions = banks.reduce((s, b) => s + b._count.questions, 0);

  return (
    <>
      <PageHeading
        eyebrow="Examinations and tests"
        title="Question Banks"
        description="Questions are set and moderated here, then drawn into examination papers. A bank can be used by any number of papers, and a paper can draw a fresh random selection for every candidate."
        breadcrumb={[{ label: 'Administration', href: '/admin' }, { label: 'Question Banks' }]}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Banks" value={banks.length} />
        <StatCard label="Active banks" value={banks.filter((b) => b.active).length} tone="green" />
        <StatCard label="Questions set" value={totalQuestions} tone="blue" />
        <StatCard label="In use by papers" value={banks.filter((b) => b._count.sections > 0).length} tone="amber" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card>
            <CardHeader title="Banks" description="Select a bank to set, import or moderate its questions." />
            {banks.length === 0 ? (
              <CardBody>
                <EmptyState
                  title="No question banks yet"
                  description="Create a bank for each subject — aptitude, numerical reasoning, use of English, civil service rules — then set or import its questions."
                />
              </CardBody>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Code</th><th>Bank</th><th>Subject</th>
                      <th className="num">Questions</th><th className="num">Used by</th>
                      <th>Created</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {banks.map((b) => (
                      <tr key={b.id}>
                        <td><span className="ref">{b.code}</span></td>
                        <td>
                          <Link
                            href={`/admin/exams/banks/${b.id}`}
                            className="font-semibold text-ink-950 hover:text-kogi-700 hover:underline"
                          >
                            {b.title}
                          </Link>
                          {b.description ? <p className="max-w-sm text-xs text-ink-500">{b.description}</p> : null}
                        </td>
                        <td className="text-xs">{EXAM_SUBJECT_LABELS[b.subject] ?? b.subject}</td>
                        <td className="num font-semibold">{b._count.questions}</td>
                        <td className="num">{b._count.sections}</td>
                        <td className="text-xs">
                          {formatDate(b.createdAt)}
                          {b.createdBy ? <span className="block text-ink-500">{b.createdBy.fullName}</span> : null}
                        </td>
                        <td>{b.active ? <span className="badge-green">active</span> : <span className="badge-slate">retired</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader title="Create a question bank" />
          <CardBody>
            <QuestionBankForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
