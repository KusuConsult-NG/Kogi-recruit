import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { PERMISSIONS } from '@/lib/rbac';
import { formatDate, formatDateInput } from '@/lib/format';
import { Card, CardBody, PageHeading, StatCard, StatusBadge, Tabs } from '@/components/ui';
import { deleteCorrespondence } from '@/actions/records';
import { CorrespondenceForm } from '../forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Correspondence' };

/** Module 4 - correspondence and records classification. */
export default async function CorrespondencePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  await requirePagePermission(PERMISSIONS.ADMIN_RECORDS);
  const status = sp.status ?? 'OPEN';

  const [records, counts] = await Promise.all([
    prisma.correspondence.findMany({
      where: {
        ...(status === 'ALL' ? {} : { status }),
        ...(sp.q
          ? { OR: [{ subject: { contains: sp.q } }, { party: { contains: sp.q } }, { reference: { contains: sp.q } }] }
          : {}),
      },
      orderBy: { receivedAt: 'desc' },
      take: 200,
      include: { handledBy: { select: { fullName: true } } },
    }),
    prisma.correspondence.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <>
      <PageHeading
        title="Correspondence Records"
        description="Log incoming and outgoing correspondence with classification, workflow status and search and retrieval."
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open" value={countOf('OPEN')} tone={countOf('OPEN') ? 'amber' : 'default'} />
        <StatCard label="Actioned" value={countOf('ACTIONED')} tone="blue" />
        <StatCard label="Filed" value={countOf('FILED')} tone="green" />
        <StatCard label="All records" value={counts.reduce((s, c) => s + c._count._all, 0)} />
      </div>

      <Card className="mb-5">
        <form method="get" className="flex flex-wrap items-end gap-3 p-4">
          <input type="hidden" name="status" value={status} />
          <label className="flex-1 min-w-[16rem]">
            <span className="label">Search</span>
            <input name="q" defaultValue={sp.q} placeholder="Subject, party or reference…" className="input" />
          </label>
          <button type="submit" className="btn-primary btn-sm">Search</button>
        </form>
      </Card>

      <Tabs
        active={`/admin/records/correspondence?status=${status}`}
        tabs={[
          { label: 'Open', href: '/admin/records/correspondence?status=OPEN', count: countOf('OPEN') },
          { label: 'Actioned', href: '/admin/records/correspondence?status=ACTIONED', count: countOf('ACTIONED') },
          { label: 'Filed', href: '/admin/records/correspondence?status=FILED', count: countOf('FILED') },
          { label: 'Closed', href: '/admin/records/correspondence?status=CLOSED', count: countOf('CLOSED') },
          { label: 'All', href: '/admin/records/correspondence?status=ALL', count: counts.reduce((s, c) => s + c._count._all, 0) },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card>
            <div className="card-header"><h2 className="card-title">Records</h2></div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Reference</th><th>Subject</th><th>Party</th><th>Direction</th>
                    <th>Classification</th><th>Status</th><th>Date</th><th>Handled by</th><th></th></tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap font-mono text-xs">{r.reference}</td>
                      <td>
                        <p className="font-medium text-slate-900">{r.subject}</p>
                        {r.body ? <p className="max-w-sm text-xs text-slate-500">{r.body.slice(0, 120)}</p> : null}
                      </td>
                      <td className="text-xs">{r.party}</td>
                      <td><span className="badge-slate">{r.direction.toLowerCase()}</span></td>
                      <td><StatusBadge status={r.classification} /></td>
                      <td><StatusBadge status={r.status} /></td>
                      <td className="whitespace-nowrap text-xs">{formatDate(r.receivedAt)}</td>
                      <td className="text-xs">{r.handledBy?.fullName ?? '—'}</td>
                      <td>
                        <form action={deleteCorrespondence}>
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className="btn-ghost btn-sm text-red-700">Delete</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {records.length === 0 ? (
                    <tr><td colSpan={9} className="py-6 text-center text-sm text-slate-500">No correspondence records.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="mt-6 space-y-5">
            {records.slice(0, 8).map((r) => (
              <Card key={`edit-${r.id}`}>
                <div className="card-header"><h2 className="card-title">Edit — {r.reference}</h2></div>
                <CardBody>
                  <CorrespondenceForm
                    initial={{
                      id: r.id, direction: r.direction, subject: r.subject, body: r.body ?? '',
                      party: r.party, classification: r.classification, status: r.status,
                      receivedAt: formatDateInput(r.receivedAt),
                    }}
                  />
                </CardBody>
              </Card>
            ))}
          </div>
        </div>

        <Card>
          <div className="card-header"><h2 className="card-title">Log correspondence</h2></div>
          <CardBody><CorrespondenceForm /></CardBody>
        </Card>
      </div>
    </>
  );
}
