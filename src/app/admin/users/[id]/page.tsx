import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { hasPermission, permissionsForRole, PERMISSIONS, PERMISSION_LABELS } from '@/lib/rbac';
import { ROLE_LABELS, ROLES, type Role } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import {
  Alert, Card, CardBody, DescriptionList, PageHeading, StatusBadge,
} from '@/components/ui';
import { unlockAccount } from '@/actions/users';
import { PermissionsForm, ResetPasswordForm, StaffUserForm } from '../forms';

export const dynamic = 'force-dynamic';

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePagePermission(PERMISSIONS.USER_VIEW);
  const canManage = hasPermission(actor, PERMISSIONS.USER_MANAGE);

  const [account, departments] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        permissions: { select: { permission: true } },
        loginHistory: { orderBy: { createdAt: 'desc' }, take: 15 },
        _count: {
          select: {
            screeningAssignments: true, screeningRecords: true,
            documentReviews: true, panelMemberships: true,
            interviewScores: true, authoredArticles: true, auditLogs: true,
          },
        },
      },
    }),
    prisma.department.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  if (!account) notFound();

  const roleDefaults = permissionsForRole(account.role);
  const extras = account.permissions.map((p) => p.permission);
  const locked = account.lockedUntil && account.lockedUntil > new Date();
  const isApplicant = account.role === ROLES.APPLICANT;

  return (
    <>
      <PageHeading
        title={account.fullName}
        description={`${ROLE_LABELS[account.role as Role] ?? account.role} · ${account.email}`}
        breadcrumb={[{ label: 'Users & Roles', href: '/admin/users' }, { label: account.fullName }]}
        actions={
          <>
            {account.active ? <span className="badge-green">active</span> : <span className="badge-slate">inactive</span>}
            {locked ? <span className="badge-red">locked</span> : null}
            {account.mustChangePassword ? <span className="badge-amber">must change password</span> : null}
          </>
        }
      />

      {locked ? (
        <div className="mb-5">
          <Alert tone="warning" title="Account temporarily locked">
            Locked after repeated failed sign-in attempts until {formatDateTime(account.lockedUntil)}.
            {canManage ? (
              <form action={unlockAccount} className="mt-2">
                <input type="hidden" name="id" value={account.id} />
                <button type="submit" className="btn-secondary btn-sm">Unlock now</button>
              </form>
            ) : null}
          </Alert>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {canManage && !isApplicant ? (
            <Card>
              <div className="card-header"><h2 className="card-title">Account details</h2></div>
              <CardBody>
                <StaffUserForm
                  mode="edit"
                  departments={departments}
                  initial={{
                    id: account.id,
                    fullName: account.fullName,
                    email: account.email,
                    phone: account.phone ?? '',
                    role: account.role,
                    title: account.title ?? '',
                    staffNumber: account.staffNumber ?? '',
                    departmentId: account.departmentId ?? '',
                    active: account.active,
                  }}
                />
              </CardBody>
            </Card>
          ) : (
            <Card>
              <div className="card-header"><h2 className="card-title">Account details</h2></div>
              <CardBody>
                <DescriptionList
                  items={[
                    { label: 'Full name', value: account.fullName },
                    { label: 'Email', value: account.email },
                    { label: 'Telephone', value: account.phone ?? '—' },
                    { label: 'Role', value: ROLE_LABELS[account.role as Role] ?? account.role },
                    { label: 'Department', value: account.department?.name ?? '—' },
                    { label: 'Staff number', value: account.staffNumber ?? '—' },
                  ]}
                />
                {isApplicant ? (
                  <Alert tone="info">
                    This is an applicant account. Applicant personal details are maintained by the
                    applicant and are visible on their applications.
                  </Alert>
                ) : null}
              </CardBody>
            </Card>
          )}

          {!isApplicant ? (
            <Card>
              <div className="card-header">
                <h2 className="card-title">Permissions</h2>
                <span className="badge-slate">
                  {roleDefaults.length} role default(s) · {extras.length} additional
                </span>
              </div>
              <CardBody>
                {account.role === ROLES.SUPER_ADMIN ? (
                  <Alert tone="info">
                    A Super Administrator holds every permission in the system. Individual permissions
                    cannot be removed from this role.
                  </Alert>
                ) : canManage ? (
                  <PermissionsForm userId={account.id} roleDefaults={roleDefaults} granted={extras} />
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {[...roleDefaults, ...extras].map((p) => (
                      <li key={p} className={roleDefaults.includes(p as never) ? 'badge-green' : 'badge-blue'}>
                        {PERMISSION_LABELS[p] ?? p}
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <div className="card-header"><h2 className="card-title">Login history</h2></div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Outcome</th><th>Reason</th><th>IP address</th><th>When</th></tr></thead>
                <tbody>
                  {account.loginHistory.map((h) => (
                    <tr key={h.id}>
                      <td><StatusBadge status={h.success ? 'VERIFIED' : 'FAILED'} label={h.success ? 'success' : 'failed'} /></td>
                      <td className="text-xs">{h.reason?.replace(/_/g, ' ').toLowerCase() ?? '—'}</td>
                      <td className="font-mono text-xs">{h.ipAddress ?? '—'}</td>
                      <td className="whitespace-nowrap text-xs">{formatDateTime(h.createdAt)}</td>
                    </tr>
                  ))}
                  {account.loginHistory.length === 0 ? (
                    <tr><td colSpan={4} className="py-4 text-center text-sm text-ink-500">No sign-in attempts recorded.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="card-header"><h2 className="card-title">Account status</h2></div>
            <CardBody className="space-y-3">
              <DescriptionList
                columns={1}
                items={[
                  { label: 'Created', value: formatDateTime(account.createdAt) },
                  { label: 'Last sign-in', value: account.lastLoginAt ? formatDateTime(account.lastLoginAt) : 'Never' },
                  { label: 'Failed attempts', value: account.failedAttempts },
                  { label: 'Must change password', value: account.mustChangePassword ? 'Yes' : 'No' },
                ]}
              />
              {canManage ? (
                <div className="border-t border-ink-200 pt-3">
                  <ResetPasswordForm userId={account.id} />
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <div className="card-header"><h2 className="card-title">Activity record</h2></div>
            <CardBody>
              <DescriptionList
                columns={1}
                items={[
                  { label: 'Screening assignments', value: account._count.screeningAssignments },
                  { label: 'Screening decisions', value: account._count.screeningRecords },
                  { label: 'Document reviews', value: account._count.documentReviews },
                  { label: 'Interview panels', value: account._count.panelMemberships },
                  { label: 'Interview scores recorded', value: account._count.interviewScores },
                  { label: 'Portal items authored', value: account._count.authoredArticles },
                  { label: 'Audit entries', value: account._count.auditLogs },
                ]}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
