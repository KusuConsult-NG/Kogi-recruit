import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { PERMISSIONS } from '@/lib/rbac';
import { ROLE_LABELS, STAFF_ROLES } from '@/lib/constants';
import { ROLE_PERMISSIONS } from '@/lib/rbac';
import { Card, CardBody, PageHeading } from '@/components/ui';
import { StaffUserForm } from '../forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'New Staff Account' };

export default async function NewUserPage() {
  await requirePagePermission(PERMISSIONS.USER_MANAGE);
  const departments = await prisma.department.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  return (
    <>
      <PageHeading
        title="New Staff Account"
        description="Create an administrative account. A temporary password is emailed and must be changed at first sign-in."
        breadcrumb={[{ label: 'Users & Roles', href: '/admin/users' }, { label: 'New' }]}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card>
            <div className="card-header"><h2 className="card-title">Account details</h2></div>
            <CardBody><StaffUserForm mode="create" departments={departments} /></CardBody>
          </Card>
        </div>
        <Card>
          <div className="card-header"><h2 className="card-title">What each role can do</h2></div>
          <CardBody>
            <ul className="space-y-3">
              {STAFF_ROLES.map((r) => (
                <li key={r} className="border-b border-ink-100 pb-3 last:border-0 last:pb-0">
                  <p className="text-sm font-semibold text-ink-950">{ROLE_LABELS[r]}</p>
                  <p className="mt-0.5 text-xs text-ink-600">
                    {ROLE_PERMISSIONS[r].length} permission(s)
                  </p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
