import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePageAnyPermission } from '@/lib/page-guards';
import { hasAnyPermission, PERMISSIONS } from '@/lib/rbac';
import { formatDateTime } from '@/lib/format';
import { Alert, Card, EmptyState, PageHeading, StatCard, StatusBadge } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Shortlists' };

export default async function ShortlistsPage({
  searchParams,
}: {
  searchParams: Promise<{ exercise?: string }>;
}) {
  const sp = await searchParams;
  const user = await requirePageAnyPermission([PERMISSIONS.SHORTLIST_PREPARE, PERMISSIONS.SHORTLIST_APPROVE]);

  const [shortlists, exercises] = await Promise.all([
    prisma.shortlist.findMany({
      where: sp.exercise ? { exerciseId: sp.exercise } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        exercise: { select: { id: true, title: true, reference: true } },
        _count: { select: { entries: true } },
      },
    }),
    prisma.recruitmentExercise.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, reference: true, title: true } }),
  ]);

  const byStatus = (s: string) => shortlists.filter((x) => x.status === s).length;

  return (
    <>
      <PageHeading
        title="Shortlists"
        description="Stage 6 — qualified candidates are shortlisted, reviewed and approved before the next assessment stage."
        actions={<Link href="/admin/screening?view=shortlist" className="btn-primary btn-sm">Prepare a shortlist</Link>}
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Draft" value={byStatus('DRAFT')} tone={byStatus('DRAFT') ? 'amber' : 'default'} />
        <StatCard label="Awaiting approval" value={byStatus('PENDING_APPROVAL')} tone={byStatus('PENDING_APPROVAL') ? 'amber' : 'default'} />
        <StatCard label="Approved" value={byStatus('APPROVED')} tone="green" />
        <StatCard label="All shortlists" value={shortlists.length} />
      </div>

      <Card className="mb-5">
        <form method="get" className="flex flex-wrap items-end gap-3 p-4">
          <label className="flex-1 min-w-[16rem]">
            <span className="label">Recruitment exercise</span>
            <select name="exercise" defaultValue={sp.exercise ?? ''} className="select">
              <option value="">All exercises</option>
              {exercises.map((e) => <option key={e.id} value={e.id}>{e.reference} — {e.title}</option>)}
            </select>
          </label>
          <button type="submit" className="btn-primary btn-sm">Apply</button>
          <Link href="/admin/shortlists" className="btn-ghost btn-sm">Reset</Link>
        </form>
      </Card>

      {shortlists.length === 0 ? (
        <EmptyState
          title="No shortlists prepared"
          description="Shortlists are prepared from qualified applications in the screening workspace."
          action={<Link href="/admin/screening?view=shortlist" className="btn-primary btn-sm">Go to screening</Link>}
        />
      ) : (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Shortlist</th><th>Exercise</th><th>Candidates</th><th>Status</th><th>Prepared</th><th>Approved</th><th></th></tr>
              </thead>
              <tbody>
                {shortlists.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/admin/shortlists/${s.id}`} className="font-medium text-kogi-700 hover:underline">
                        {s.title}
                      </Link>
                      {s.rejectionNote ? <p className="mt-0.5 text-xs text-[#9a2c20]">Returned: {s.rejectionNote}</p> : null}
                    </td>
                    <td className="text-xs">{s.exercise.reference}</td>
                    <td>{s._count.entries}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td className="whitespace-nowrap text-xs">{formatDateTime(s.createdAt)}</td>
                    <td className="whitespace-nowrap text-xs">{s.approvedAt ? formatDateTime(s.approvedAt) : '—'}</td>
                    <td><Link href={`/admin/shortlists/${s.id}`} className="btn-secondary btn-sm">Open</Link></td>
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
