import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { PERMISSIONS } from '@/lib/rbac';
import { formatDateTime } from '@/lib/format';
import { Card, CardBody, EmptyState, PageHeading, StatCard, StatusBadge, Tabs } from '@/components/ui';
import { EnquiryResponseForm } from '../content/forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Public Enquiries' };

/** Module 1 - contact and enquiry management. */
export default async function EnquiriesAdmin({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  await requirePagePermission(PERMISSIONS.ENQUIRY_MANAGE);
  const status = sp.status ?? 'NEW';

  const [enquiries, counts] = await Promise.all([
    prisma.enquiry.findMany({
      where: status === 'ALL' ? {} : { status },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.enquiry.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const total = counts.reduce((s, c) => s + c._count._all, 0);

  return (
    <>
      <PageHeading
        title="Public Enquiries"
        description="Enquiries submitted through the public contact form. Each is logged with a reference number and a complete response history."
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="New" value={countOf('NEW')} tone={countOf('NEW') ? 'amber' : 'default'} />
        <StatCard label="In progress" value={countOf('IN_PROGRESS')} tone="blue" />
        <StatCard label="Responded" value={countOf('RESPONDED')} tone="green" />
        <StatCard label="All enquiries" value={total} />
      </div>

      <Tabs
        active={`/admin/enquiries?status=${status}`}
        tabs={[
          { label: 'New', href: '/admin/enquiries?status=NEW', count: countOf('NEW') },
          { label: 'In progress', href: '/admin/enquiries?status=IN_PROGRESS', count: countOf('IN_PROGRESS') },
          { label: 'Responded', href: '/admin/enquiries?status=RESPONDED', count: countOf('RESPONDED') },
          { label: 'Closed', href: '/admin/enquiries?status=CLOSED', count: countOf('CLOSED') },
          { label: 'All', href: '/admin/enquiries?status=ALL', count: total },
        ]}
      />

      {enquiries.length === 0 ? (
        <EmptyState title="No enquiries in this queue" />
      ) : (
        <div className="space-y-5">
          {enquiries.map((e) => (
            <Card key={e.id}>
              <div className="card-header">
                <div>
                  <h2 className="card-title">{e.subject}</h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    <span className="font-mono">{e.reference}</span> · {e.name} · {e.email}
                    {e.phone ? ` · ${e.phone}` : ''}
                  </p>
                  <p className="text-xs text-slate-500">Received {formatDateTime(e.createdAt)}</p>
                </div>
                <StatusBadge status={e.status} />
              </div>
              <CardBody className="space-y-4">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="whitespace-pre-line text-sm text-slate-700">{e.message}</p>
                </div>
                {e.response ? (
                  <div className="rounded-md border border-kogi-200 bg-kogi-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-kogi-800">Response</p>
                    <p className="mt-1 whitespace-pre-line text-sm text-kogi-900">{e.response}</p>
                    <p className="mt-1.5 text-[11px] text-kogi-700">Sent {formatDateTime(e.respondedAt)}</p>
                  </div>
                ) : null}
                <EnquiryResponseForm id={e.id} current={e.response ?? ''} />
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
