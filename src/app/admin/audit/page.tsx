import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { AUDIT_ACTIONS } from '@/lib/audit';
import { formatDateTime } from '@/lib/format';
import { Alert, Card, EmptyState, PageHeading, Pagination, StatCard } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Audit Trail' };

const PAGE_SIZE = 50;

/** Module 8 - audit trail and activity monitoring. */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; user?: string; entity?: string; from?: string; to?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const user = await requirePagePermission(PERMISSIONS.AUDIT_VIEW);
  const canSeeSensitive = hasPermission(user, PERMISSIONS.AUDIT_VIEW_SENSITIVE);
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const where = {
    ...(canSeeSensitive ? {} : { sensitive: false }),
    ...(sp.action && sp.action !== 'ALL' ? { action: sp.action } : {}),
    ...(sp.user ? { userId: sp.user } : {}),
    ...(sp.entity ? { entityType: sp.entity } : {}),
    ...(sp.from || sp.to
      ? {
          createdAt: {
            ...(sp.from ? { gte: new Date(sp.from) } : {}),
            ...(sp.to ? { lte: new Date(`${sp.to}T23:59:59`) } : {}),
          },
        }
      : {}),
  };

  const [total, logs, officers, actionCounts, stats] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.user.findMany({
      where: { role: { not: 'APPLICANT' } },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true },
    }),
    prisma.auditLog.groupBy({
      by: ['action'],
      where: canSeeSensitive ? {} : { sensitive: false },
      _count: { _all: true },
      orderBy: { _count: { action: 'desc' } },
      take: 40,
    }),
    Promise.all([
      prisma.auditLog.count({ where: canSeeSensitive ? {} : { sensitive: false } }),
      prisma.auditLog.count({ where: { sensitive: true } }),
      prisma.auditLog.count({
        where: {
          ...(canSeeSensitive ? {} : { sensitive: false }),
          createdAt: { gte: new Date(Date.now() - 86400_000) },
        },
      }),
      prisma.loginHistory.count({ where: { success: false, createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } } }),
    ]),
  ]);

  const [allLogs, sensitiveLogs, last24h, failedLogins] = stats;
  const exportQuery = new URLSearchParams();
  if (sp.action && sp.action !== 'ALL') exportQuery.set('action', sp.action);
  if (sp.from) exportQuery.set('from', sp.from);
  if (sp.to) exportQuery.set('to', sp.to);

  return (
    <>
      <PageHeading
        title="Audit Trail"
        description="Every important activity is logged with the officer, date and time: sign-ins, application submissions, document uploads and reviews, screening decisions, status changes, approvals and account changes."
        actions={
          <>
            <Link href={`/api/reports/audit?${exportQuery.toString()}&format=pdf`} className="btn-secondary btn-sm">PDF</Link>
            <Link href={`/api/reports/audit?${exportQuery.toString()}&format=excel`} className="btn-secondary btn-sm">Excel</Link>
            <Link href={`/api/reports/audit?${exportQuery.toString()}&format=csv`} className="btn-secondary btn-sm">CSV</Link>
          </>
        }
      />

      {!canSeeSensitive ? (
        <div className="mb-5">
          <Alert tone="info">
            Sensitive records — including score entry, approvals, password and permission changes — are
            restricted to authorised officers and are not shown here.
          </Alert>
        </div>
      ) : null}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Visible records" value={allLogs.toLocaleString('en-NG')} />
        <StatCard label="Sensitive records" value={canSeeSensitive ? sensitiveLogs.toLocaleString('en-NG') : 'restricted'} />
        <StatCard label="Last 24 hours" value={last24h.toLocaleString('en-NG')} tone="blue" />
        <StatCard label="Failed sign-ins (7 days)" value={failedLogins} tone={failedLogins ? 'amber' : 'default'} />
      </div>

      <Card className="mb-5">
        <form method="get" className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
          <label className="lg:col-span-2">
            <span className="label">Action</span>
            <select name="action" defaultValue={sp.action ?? 'ALL'} className="select">
              <option value="ALL">All actions</option>
              {actionCounts.map((a) => (
                <option key={a.action} value={a.action}>
                  {a.action.replace(/_/g, ' ').toLowerCase()} ({a._count._all})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Officer</span>
            <select name="user" defaultValue={sp.user ?? ''} className="select">
              <option value="">All officers</option>
              {officers.map((o) => <option key={o.id} value={o.id}>{o.fullName}</option>)}
            </select>
          </label>
          <label>
            <span className="label">Entity type</span>
            <input name="entity" defaultValue={sp.entity} placeholder="e.g. Application" className="input" />
          </label>
          <label>
            <span className="label">From</span>
            <input name="from" type="date" defaultValue={sp.from} className="input" />
          </label>
          <label>
            <span className="label">To</span>
            <input name="to" type="date" defaultValue={sp.to} className="input" />
          </label>
          <div className="flex items-end gap-2 sm:col-span-3 lg:col-span-6">
            <button type="submit" className="btn-primary btn-sm">Filter</button>
            <Link href="/admin/audit" className="btn-ghost btn-sm">Reset</Link>
          </div>
        </form>
      </Card>

      {logs.length === 0 ? (
        <EmptyState title="No audit records match these filters" />
      ) : (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Date and time</th><th>Officer</th><th>Action</th><th>Entity</th><th>Summary</th><th>IP address</th></tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className={l.sensitive ? 'bg-amber-50/40' : ''}>
                    <td className="whitespace-nowrap text-xs">{formatDateTime(l.createdAt)}</td>
                    <td className="text-xs">
                      <p className="font-medium text-slate-900">{l.actorName ?? 'System'}</p>
                      {l.actorRole ? <p className="text-slate-500">{l.actorRole.replace(/_/g, ' ').toLowerCase()}</p> : null}
                    </td>
                    <td>
                      <span className={l.sensitive ? 'badge-amber' : 'badge-slate'}>
                        {l.action.replace(/_/g, ' ').toLowerCase()}
                      </span>
                    </td>
                    <td className="text-xs">
                      {l.entityType ?? '—'}
                      {l.entityId ? <p className="font-mono text-[10px] text-slate-400">{l.entityId.slice(0, 12)}…</p> : null}
                    </td>
                    <td className="max-w-lg text-xs">{l.summary ?? '—'}</td>
                    <td className="whitespace-nowrap font-mono text-[11px]">{l.ipAddress ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} basePath="/admin/audit"
            params={{ action: sp.action, user: sp.user, entity: sp.entity, from: sp.from, to: sp.to }} />
        </Card>
      )}
      <p className="mt-3 text-xs text-slate-500">
        {total.toLocaleString('en-NG')} record(s) match the current filters. Audit records cannot be
        edited or deleted from the portal.
      </p>
    </>
  );
}
