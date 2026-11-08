import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { ROLE_LABELS, STAFF_ROLES, ROLES, type Role } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { Card, EmptyState, PageHeading, StatCard, Tabs } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Users and Roles' };

/** Module 5 - user, role and access management. */
export default async function UsersAdmin({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; q?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const user = await requirePagePermission(PERMISSIONS.USER_VIEW);
  const canManage = hasPermission(user, PERMISSIONS.USER_MANAGE);
  const view = sp.view === 'applicants' ? 'applicants' : 'staff';

  const where = {
    ...(view === 'applicants' ? { role: ROLES.APPLICANT } : { role: { not: ROLES.APPLICANT } }),
    ...(sp.role && sp.role !== 'ALL' ? { role: sp.role } : {}),
    ...(sp.q
      ? { OR: [{ fullName: { contains: sp.q } }, { email: { contains: sp.q } }, { staffNumber: { contains: sp.q } }] }
      : {}),
  };

  const [users, staffCount, applicantCount, roleCounts] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ active: 'desc' }, { fullName: 'asc' }],
      take: 200,
      include: {
        department: { select: { name: true } },
        permissions: { select: { permission: true } },
        _count: { select: { screeningAssignments: true, applications: true } },
      },
    }),
    prisma.user.count({ where: { role: { not: ROLES.APPLICANT } } }),
    prisma.user.count({ where: { role: ROLES.APPLICANT } }),
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
  ]);

  const countOf = (r: string) => roleCounts.find((c) => c.role === r)?._count._all ?? 0;

  return (
    <>
      <PageHeading
        title="Users, Roles and Access"
        description="Create and manage accounts, assign roles and permissions, deactivate accounts and review login history. Users access only the functions assigned to their roles."
        actions={canManage ? <Link href="/admin/users/new" className="btn-primary btn-sm">New staff account</Link> : undefined}
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Staff accounts" value={staffCount} />
        <StatCard label="Registered applicants" value={applicantCount.toLocaleString('en-NG')} />
        <StatCard label="Active" value={users.filter((u) => u.active).length} tone="green" />
        <StatCard label="Locked or inactive" value={users.filter((u) => !u.active || (u.lockedUntil && u.lockedUntil > new Date())).length}
          tone={users.some((u) => !u.active) ? 'amber' : 'default'} />
      </div>

      <Tabs
        active={`/admin/users?view=${view}`}
        tabs={[
          { label: 'Commission staff', href: '/admin/users?view=staff', count: staffCount },
          { label: 'Applicants', href: '/admin/users?view=applicants', count: applicantCount },
        ]}
      />

      <Card className="mb-5">
        <form method="get" className="flex flex-wrap items-end gap-3 p-4">
          <input type="hidden" name="view" value={view} />
          {view === 'staff' ? (
            <label className="min-w-[14rem]">
              <span className="label">Role</span>
              <select name="role" defaultValue={sp.role ?? 'ALL'} className="select">
                <option value="ALL">All roles</option>
                {STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]} ({countOf(r)})</option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex-1 min-w-[14rem]">
            <span className="label">Search</span>
            <input name="q" defaultValue={sp.q} placeholder="Name, email or staff number…" className="input" />
          </label>
          <button type="submit" className="btn-primary btn-sm">Filter</button>
          <Link href={`/admin/users?view=${view}`} className="btn-ghost btn-sm">Reset</Link>
        </form>
      </Card>

      {users.length === 0 ? (
        <EmptyState title="No accounts match these filters" />
      ) : (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>Role</th>
                  {view === 'staff' ? <><th>Department</th><th>Extra permissions</th><th>Workload</th></> : <th>Applications</th>}
                  <th>Status</th><th>Last sign-in</th><th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const locked = u.lockedUntil && u.lockedUntil > new Date();
                  return (
                    <tr key={u.id} className={u.active ? '' : 'opacity-60'}>
                      <td>
                        <p className="font-medium text-slate-900">{u.fullName}</p>
                        {u.title ? <p className="text-xs text-slate-500">{u.title}</p> : null}
                        {u.staffNumber ? <p className="text-xs text-slate-500">{u.staffNumber}</p> : null}
                      </td>
                      <td className="text-xs">{u.email}</td>
                      <td className="text-xs">{ROLE_LABELS[u.role as Role] ?? u.role}</td>
                      {view === 'staff' ? (
                        <>
                          <td className="text-xs">{u.department?.name ?? '—'}</td>
                          <td>{u.permissions.length > 0 ? <span className="badge-blue">{u.permissions.length}</span> : <span className="text-xs text-slate-400">none</span>}</td>
                          <td className="text-xs">{u._count.screeningAssignments} screening</td>
                        </>
                      ) : (
                        <td>{u._count.applications}</td>
                      )}
                      <td>
                        {!u.active ? <span className="badge-slate">inactive</span>
                          : locked ? <span className="badge-red">locked</span>
                          : u.mustChangePassword ? <span className="badge-amber">password reset</span>
                          : <span className="badge-green">active</span>}
                      </td>
                      <td className="whitespace-nowrap text-xs">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never'}</td>
                      <td>
                        {view === 'staff' && canManage ? (
                          <Link href={`/admin/users/${u.id}`} className="btn-secondary btn-sm">Manage</Link>
                        ) : view === 'staff' ? (
                          <Link href={`/admin/users/${u.id}`} className="btn-ghost btn-sm">View</Link>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
