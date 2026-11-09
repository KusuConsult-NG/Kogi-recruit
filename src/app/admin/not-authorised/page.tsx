import Link from 'next/link';
import { requirePageStaff } from '@/lib/page-guards';
import { effectivePermissions, PERMISSION_LABELS } from '@/lib/rbac';
import { COMMISSION, ROLE_LABELS, type Role } from '@/lib/constants';
import { Alert, Card, CardBody, PageHeading } from '@/components/ui';
import { visibleNav } from '@/components/admin-nav';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Not authorised' };

/**
 * Module 5 — a clear refusal when an officer's role does not include a
 * function, listing what their role does cover.
 */
export default async function NotAuthorisedPage({
  searchParams,
}: {
  searchParams: Promise<{ permission?: string }>;
}) {
  const { permission } = await searchParams;
  const user = await requirePageStaff();
  const held = effectivePermissions(user.role, user.permissions);
  const groups = visibleNav(user);

  return (
    <>
      <PageHeading
        title="You are not authorised to use this function"
        description={`Signed in as ${user.fullName} — ${ROLE_LABELS[user.role as Role]}.`}
      />

      <div className="max-w-3xl space-y-6">
        <Alert tone="error" title="Access refused">
          {permission && PERMISSION_LABELS[permission] ? (
            <>
              This page requires the permission <strong>{PERMISSION_LABELS[permission]}</strong>, which
              your role does not include.
            </>
          ) : (
            <>Your role does not include this function.</>
          )}
          <span className="mt-2 block">
            Users access only the functions and information assigned to their roles. This attempt has
            been recorded in the system audit trail. If you need this access, ask a Commission
            Administrator to review your role or grant the specific permission.
          </span>
        </Alert>

        <Card>
          <div className="card-header">
            <h2 className="card-title">What your role does cover</h2>
            <span className="badge-slate">{held.length} permission(s)</span>
          </div>
          <CardBody>
            {groups.length === 0 ? (
              <p className="text-sm text-ink-600">Your role has no administrative functions assigned.</p>
            ) : (
              <div className="space-y-4">
                {groups.map((group) => (
                  <div key={group.label}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                      {group.label}
                    </p>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {group.items.map((item) => (
                        <li key={item.href}>
                          <Link href={item.href} className="badge-green hover:bg-kogi-200">
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <div className="card-header"><h2 className="card-title">Need different access?</h2></div>
          <CardBody className="text-sm text-ink-700">
            <p>
              Roles and permissions are managed centrally by a Commission Administrator or the Super
              Administrator. Contact the Commission secretariat at{' '}
              <a href={`mailto:${COMMISSION.email}`} className="text-kogi-700 underline">{COMMISSION.email}</a>{' '}
              stating the function you need and why.
            </p>
            <Link href="/admin" className="btn-primary btn-sm mt-4">Return to my dashboard</Link>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
