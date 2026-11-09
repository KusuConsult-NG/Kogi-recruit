import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { PERMISSIONS } from '@/lib/rbac';
import { UNIT_MEMBER_ROLE_LABELS } from '@/lib/constants';
import { Card, CardBody, CardHeader, EmptyState, PageHeading, StatCard } from '@/components/ui';
import { RecruitmentUnitForm } from '../forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Recruitment Unit' };

/**
 * The standing unit that manages recruitment. Exercises are assigned to a
 * unit, and the unit's membership records who is answerable for each stage.
 */
export default async function RecruitmentUnitsAdmin() {
  await requirePagePermission(PERMISSIONS.UNIT_MANAGE);

  const units = await prisma.recruitmentUnit.findMany({
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    include: {
      members: {
        where: { active: true },
        orderBy: { unitRole: 'asc' },
        include: { user: { select: { fullName: true } } },
      },
      _count: { select: { exercises: true } },
    },
  });

  const totalMembers = units.reduce((s, u) => s + u.members.length, 0);

  return (
    <>
      <PageHeading
        eyebrow="Establishment"
        title="Recruitment Unit"
        description="The unit that manages recruitment from planning to closure. Officers are assigned to it in named roles, and each recruitment exercise is placed under a unit so responsibility is recorded."
        breadcrumb={[{ label: 'Administration', href: '/admin' }, { label: 'Recruitment Unit' }]}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Units established" value={units.length} />
        <StatCard label="Active units" value={units.filter((u) => u.active).length} tone="green" />
        <StatCard label="Officers assigned" value={totalMembers} tone="blue" />
        <StatCard
          label="Exercises under management"
          value={units.reduce((s, u) => s + u._count.exercises, 0)}
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          {units.length === 0 ? (
            <Card>
              <CardBody>
                <EmptyState
                  title="No recruitment unit has been established"
                  description="Establish the unit on the right, then assign officers to it and place recruitment exercises under its management."
                />
              </CardBody>
            </Card>
          ) : (
            units.map((unit) => (
              <Card key={unit.id}>
                <CardHeader
                  eyebrow={unit.code}
                  title={unit.name}
                  description={unit.mandate ?? undefined}
                  actions={
                    <>
                      {unit.active ? <span className="badge-green">active</span> : <span className="badge-slate">inactive</span>}
                      <Link href={`/admin/establishment/units/${unit.id}`} className="btn-secondary btn-sm">
                        Manage unit
                      </Link>
                    </>
                  }
                />
                <CardBody>
                  <dl className="mb-4 grid grid-cols-2 gap-x-8 gap-y-2 text-xs sm:grid-cols-4">
                    <div>
                      <dt className="micro-label">Members</dt>
                      <dd className="mt-0.5 text-sm font-semibold text-ink-900" data-numeric>{unit.members.length}</dd>
                    </div>
                    <div>
                      <dt className="micro-label">Exercises</dt>
                      <dd className="mt-0.5 text-sm font-semibold text-ink-900" data-numeric>{unit._count.exercises}</dd>
                    </div>
                    <div>
                      <dt className="micro-label">Office</dt>
                      <dd className="mt-0.5 text-sm text-ink-800">{unit.office ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="micro-label">Email</dt>
                      <dd className="mt-0.5 break-all text-sm text-ink-800">{unit.email ?? '—'}</dd>
                    </div>
                  </dl>
                  {unit.members.length === 0 ? (
                    <p className="text-sm text-ink-500">No officers have been assigned to this unit yet.</p>
                  ) : (
                    <ul className="divide-y divide-ink-150 border-t border-ink-150">
                      {unit.members.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-4 py-2">
                          <span className="text-[0.8125rem] font-medium text-ink-900">{m.user.fullName}</span>
                          <span className="badge-slate">{UNIT_MEMBER_ROLE_LABELS[m.unitRole] ?? m.unitRole}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            ))
          )}
        </div>

        <Card>
          <CardHeader title="Establish a recruitment unit" />
          <CardBody>
            <RecruitmentUnitForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
