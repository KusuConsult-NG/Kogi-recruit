import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePageStaff } from '@/lib/page-guards';
import { hasAnyPermission, PERMISSIONS } from '@/lib/rbac';
import { formatDateTime } from '@/lib/format';
import {
  Alert, Card, EmptyState, PageHeading, StatCard, StatusBadge, Tabs, readable,
} from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Approvals' };

const DESTINATION: Record<string, (entityId: string) => string> = {
  EXERCISE: (id) => `/admin/exercises/${id}`,
  ARTICLE: (id) => `/admin/content/${id}`,
  SHORTLIST: (id) => `/admin/shortlists/${id}`,
  SELECTION: (id) => `/admin/selection/${id}`,
  NOTIFICATION_BATCH: () => '/admin/notifications',
};

/** Approval workflow queue across every module. */
export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const user = await requirePageStaff();
  const approvalRights = [
    PERMISSIONS.EXERCISE_APPROVE, PERMISSIONS.SHORTLIST_APPROVE,
    PERMISSIONS.SELECTION_APPROVE, PERMISSIONS.CONTENT_PUBLISH,
    PERMISSIONS.NOTIFICATION_APPROVE,
  ];
  if (!hasAnyPermission(user, approvalRights)) {
    return <Alert tone="error" title="Not authorised">You do not hold any approval rights.</Alert>;
  }
  const status = sp.status ?? 'PENDING';

  const [requests, counts] = await Promise.all([
    prisma.approvalRequest.findMany({
      where: status === 'ALL' ? {} : { status },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { exercise: { select: { title: true, reference: true } } },
    }),
    prisma.approvalRequest.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <>
      <PageHeading
        title="Approvals"
        description="Every item awaiting authorisation across recruitment exercises, shortlists, selection lists, portal content and notification batches."
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Awaiting approval" value={countOf('PENDING')} tone={countOf('PENDING') ? 'amber' : 'default'} />
        <StatCard label="Approved" value={countOf('APPROVED')} tone="green" />
        <StatCard label="Rejected or returned" value={countOf('REJECTED')} />
      </div>

      <Tabs
        active={`/admin/approvals?status=${status}`}
        tabs={[
          { label: 'Awaiting approval', href: '/admin/approvals?status=PENDING', count: countOf('PENDING') },
          { label: 'Approved', href: '/admin/approvals?status=APPROVED', count: countOf('APPROVED') },
          { label: 'Rejected', href: '/admin/approvals?status=REJECTED', count: countOf('REJECTED') },
          { label: 'All', href: '/admin/approvals?status=ALL', count: counts.reduce((s, c) => s + c._count._all, 0) },
        ]}
      />

      {requests.length === 0 ? (
        <EmptyState title="Nothing in this queue"
          description="Approval requests appear here when an officer submits an item for authorisation." />
      ) : (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Item</th><th>Action</th><th>Exercise</th><th>Requested by</th>
                  <th>Requested</th><th>Status</th><th>Decided by</th><th>Note</th><th></th></tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td><span className="badge-slate">{readable(r.entityType)}</span></td>
                    <td className="text-xs">{r.action.replace(/_/g, ' ').toLowerCase()}</td>
                    <td className="text-xs">{r.exercise?.reference ?? '—'}</td>
                    <td className="text-xs">{r.requestedByName ?? '—'}</td>
                    <td className="whitespace-nowrap text-xs">{formatDateTime(r.createdAt)}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="text-xs">
                      {r.decidedByName ?? '—'}
                      {r.decidedAt ? <p className="text-ink-500">{formatDateTime(r.decidedAt)}</p> : null}
                    </td>
                    <td className="max-w-xs text-xs">{r.note ?? '—'}</td>
                    <td>
                      <Link
                        href={(DESTINATION[r.entityType] ?? (() => '/admin'))(r.entityId)}
                        className="btn-secondary btn-sm"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
