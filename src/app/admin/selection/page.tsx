import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePageAnyPermission } from '@/lib/page-guards';
import { hasAnyPermission, hasPermission, PERMISSIONS } from '@/lib/rbac';
import { EXERCISE_STATUS } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { Alert, Card, CardBody, EmptyState, PageHeading, StatCard, StatusBadge } from '@/components/ui';
import { SelectionListForm } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Final Selection' };

export default async function SelectionPage({
  searchParams,
}: {
  searchParams: Promise<{ exercise?: string }>;
}) {
  const sp = await searchParams;
  const user = await requirePageAnyPermission([PERMISSIONS.SELECTION_PREPARE, PERMISSIONS.SELECTION_APPROVE]);
  const canPrepare = hasPermission(user, PERMISSIONS.SELECTION_PREPARE);

  const [lists, exercises] = await Promise.all([
    prisma.selectionList.findMany({
      where: sp.exercise ? { exerciseId: sp.exercise } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        exercise: { select: { reference: true, title: true } },
        entries: { select: { outcome: true } },
      },
    }),
    prisma.recruitmentExercise.findMany({
      where: { status: { in: [EXERCISE_STATUS.PUBLISHED, EXERCISE_STATUS.SUSPENDED, EXERCISE_STATUS.CLOSED] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, reference: true, title: true },
    }),
  ]);

  const byStatus = (s: string) => lists.filter((x) => x.status === s).length;

  return (
    <>
      <PageHeading
        title="Final Selection and Recruitment Outcome"
        description="Stage 9 and 10 — consolidate assessment records, rank candidates, obtain Commission approval, notify candidates and archive the records."
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Draft" value={byStatus('DRAFT')} tone={byStatus('DRAFT') ? 'amber' : 'default'} />
        <StatCard label="Awaiting approval" value={byStatus('PENDING_APPROVAL')} tone={byStatus('PENDING_APPROVAL') ? 'amber' : 'default'} />
        <StatCard label="Approved" value={byStatus('APPROVED')} tone="green" />
        <StatCard label="Archived" value={byStatus('ARCHIVED')} />
      </div>

      {lists.length === 0 ? (
        <EmptyState title="No selection lists prepared"
          description="Prepare a selection list once candidates have completed the examination and interview stages." />
      ) : (
        <Card className="mb-6">
          <div className="card-header"><h2 className="card-title">Selection lists</h2></div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Selection list</th><th>Exercise</th><th>Candidates</th><th>Successful</th>
                  <th>Reserve</th><th>Weighting</th><th>Status</th><th>Approved</th><th></th></tr>
              </thead>
              <tbody>
                {lists.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <Link href={`/admin/selection/${l.id}`} className="font-medium text-kogi-700 hover:underline">
                        {l.title}
                      </Link>
                      {l.rejectionNote ? <p className="mt-0.5 text-xs text-red-700">Returned: {l.rejectionNote}</p> : null}
                    </td>
                    <td className="text-xs">{l.exercise.reference}</td>
                    <td>{l.entries.length}</td>
                    <td className="font-semibold text-kogi-800">{l.entries.filter((e) => e.outcome === 'SELECTED').length}</td>
                    <td>{l.entries.filter((e) => e.outcome === 'RESERVE').length}</td>
                    <td className="whitespace-nowrap text-xs">{l.examWeight}% / {l.interviewWeight}%</td>
                    <td><StatusBadge status={l.status} /></td>
                    <td className="whitespace-nowrap text-xs">{l.approvedAt ? formatDateTime(l.approvedAt) : '—'}</td>
                    <td><Link href={`/admin/selection/${l.id}`} className="btn-secondary btn-sm">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {canPrepare ? (
        <Card className="max-w-3xl">
          <div className="card-header"><h2 className="card-title">Prepare a new selection list</h2></div>
          <CardBody>
            {exercises.length === 0 ? (
              <Alert tone="warning">No eligible recruitment exercises are available.</Alert>
            ) : (
              <SelectionListForm
                exercises={exercises.map((e) => ({ id: e.id, label: `${e.reference} — ${e.title}` }))}
              />
            )}
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
