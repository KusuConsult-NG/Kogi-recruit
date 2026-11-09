import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { EXERCISE_STATUS, MDA_KINDS, MDA_KIND_LABELS } from '@/lib/constants';
import {
  Card, EmptyState, PageHeading, StatCard, StatusBadge,
} from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ministries, Departments and Agencies' };

/**
 * The establishment register. Every vacancy is raised against one of these
 * records, so this is the list the recruitment unit maintains first.
 */
export default async function MinistriesAdmin({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; q?: string }>;
}) {
  const user = await requirePagePermission(PERMISSIONS.MDA_VIEW);
  const canManage = hasPermission(user, PERMISSIONS.MDA_MANAGE);
  const { kind, q } = await searchParams;

  const ministries = await prisma.ministry.findMany({
    where: {
      ...(kind ? { kind } : {}),
      ...(q
        ? { OR: [{ name: { contains: q } }, { code: { contains: q } }, { shortName: { contains: q } }] }
        : {}),
    },
    orderBy: [{ kind: 'asc' }, { position: 'asc' }, { name: 'asc' }],
    include: {
      _count: { select: { departments: true, vacancies: true } },
      vacancies: {
        where: { active: true, exercise: { status: EXERCISE_STATUS.PUBLISHED } },
        select: { positions: true },
      },
    },
  });

  const totals = {
    all: ministries.length,
    active: ministries.filter((m) => m.active).length,
    published: ministries.filter((m) => m.published).length,
    openPosts: ministries.reduce((s, m) => s + m.vacancies.reduce((t, v) => t + v.positions, 0), 0),
  };

  return (
    <>
      <PageHeading
        eyebrow="Establishment"
        title="Ministries, Departments and Agencies"
        description="The register of employing MDAs in the Kogi State Public Service. Vacancies are raised against an MDA, and the public directory and reporting are both driven from this list."
        breadcrumb={[{ label: 'Administration', href: '/admin' }, { label: 'Ministries & Agencies' }]}
        actions={
          canManage ? (
            <Link href="/admin/establishment/ministries/new" className="btn-primary btn-sm">
              Add an MDA
            </Link>
          ) : null
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="MDAs on the register" value={totals.all} />
        <StatCard label="Available for vacancies" value={totals.active} tone="green" />
        <StatCard label="In the public directory" value={totals.published} tone="blue" />
        <StatCard label="Posts currently advertised" value={totals.openPosts} tone="amber" />
      </div>

      <form className="mb-5 flex flex-wrap items-end gap-3 rounded-md border border-ink-200 bg-white px-4 py-3 shadow-raised">
        <div>
          <label htmlFor="q" className="micro-label mb-1 block">Search</label>
          <input id="q" name="q" defaultValue={q ?? ''} className="input w-56" placeholder="Name or code" />
        </div>
        <div>
          <label htmlFor="kind" className="micro-label mb-1 block">Classification</label>
          <select id="kind" name="kind" defaultValue={kind ?? ''} className="select w-56">
            <option value="">All classifications</option>
            {MDA_KINDS.map((k) => <option key={k.code} value={k.code}>{k.label}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-secondary btn-sm">Apply</button>
        {kind || q ? (
          <Link href="/admin/establishment/ministries" className="btn-ghost btn-sm">Clear</Link>
        ) : null}
      </form>

      <Card>
        {ministries.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No MDAs match"
              description="Add the ministries, extra-ministerial departments and agencies that carry approved posts."
              action={
                canManage ? (
                  <Link href="/admin/establishment/ministries/new" className="btn-primary btn-sm">
                    Add the first MDA
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Classification</th>
                  <th>Accounting officer</th>
                  <th className="num">Departments</th>
                  <th className="num">Vacancies</th>
                  <th className="num">Posts open</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ministries.map((m) => (
                  <tr key={m.id}>
                    <td><span className="ref">{m.code}</span></td>
                    <td>
                      <Link
                        href={`/admin/establishment/ministries/${m.id}`}
                        className="font-semibold text-ink-950 hover:text-kogi-700 hover:underline"
                      >
                        {m.name}
                      </Link>
                      {m.shortName ? <p className="text-xs text-ink-500">{m.shortName}</p> : null}
                    </td>
                    <td><StatusBadge status={m.kind} label={MDA_KIND_LABELS[m.kind] ?? m.kind} /></td>
                    <td className="text-xs">
                      {m.headName ? (
                        <>
                          <span className="block text-ink-800">{m.headName}</span>
                          <span className="block text-ink-500">{m.headTitle}</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="num">{m._count.departments}</td>
                    <td className="num">{m._count.vacancies}</td>
                    <td className="num">{m.vacancies.reduce((s, v) => s + v.positions, 0)}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {m.active ? <span className="badge-green">active</span> : <span className="badge-slate">retired</span>}
                        {m.published ? null : <span className="badge-amber">unlisted</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
