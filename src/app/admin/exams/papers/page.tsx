import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { PERMISSIONS } from '@/lib/rbac';
import { PAPER_KIND_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import {
  Card, CardBody, CardHeader, EmptyState, PageHeading, StatCard, StatusBadge,
} from '@/components/ui';
import { ExamPaperForm } from '../forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Examination Papers' };

/** Papers are assembled from question banks and then attached to an examination. */
export default async function ExamPapersPage() {
  await requirePagePermission(PERMISSIONS.EXAM_SET);

  const papers = await prisma.examPaper.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      sections: { include: { _count: { select: { questions: true } } } },
      _count: { select: { schedules: true, sittings: true } },
    },
  });

  const questionCount = (p: (typeof papers)[number]) =>
    p.sections.reduce((s, sec) => s + (sec.drawCount ?? sec._count.questions), 0);

  return (
    <>
      <PageHeading
        eyebrow="Examinations and tests"
        title="Examination Papers"
        description="A paper sets the duration, the pass mark and the sections a candidate sits. Publish a paper to make it available to an examination; once candidates have sat it, its settings are locked so the record stands."
        breadcrumb={[{ label: 'Administration', href: '/admin' }, { label: 'Examination Papers' }]}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Papers" value={papers.length} />
        <StatCard label="Published" value={papers.filter((p) => p.status === 'PUBLISHED').length} tone="green" />
        <StatCard label="In draft" value={papers.filter((p) => p.status === 'DRAFT').length} tone="amber" />
        <StatCard label="Sittings recorded" value={papers.reduce((s, p) => s + p._count.sittings, 0)} tone="blue" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card>
            <CardHeader title="Papers" />
            {papers.length === 0 ? (
              <CardBody>
                <EmptyState
                  title="No papers yet"
                  description="Create a paper, add its sections, then publish it so an examination can be set with it."
                />
              </CardBody>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Code</th><th>Paper</th><th>Kind</th>
                      <th className="num">Sections</th><th className="num">Questions</th>
                      <th className="num">Minutes</th><th className="num">Pass</th>
                      <th className="num">Sittings</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {papers.map((p) => (
                      <tr key={p.id}>
                        <td><span className="ref">{p.code}</span></td>
                        <td>
                          <Link
                            href={`/admin/exams/papers/${p.id}`}
                            className="font-semibold text-ink-950 hover:text-kogi-700 hover:underline"
                          >
                            {p.title}
                          </Link>
                          <p className="text-xs text-ink-500">
                            {p.publishedAt ? `Published ${formatDate(p.publishedAt)}` : 'Not yet published'}
                          </p>
                        </td>
                        <td className="text-xs">{PAPER_KIND_LABELS[p.kind] ?? p.kind}</td>
                        <td className="num">{p.sections.length}</td>
                        <td className="num">{questionCount(p)}</td>
                        <td className="num">{p.durationMinutes}</td>
                        <td className="num">{p.passMark}%</td>
                        <td className="num">{p._count.sittings}</td>
                        <td><StatusBadge status={p.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader title="Create a paper" />
          <CardBody>
            <ExamPaperForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
