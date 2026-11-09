import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { PERMISSIONS } from '@/lib/rbac';
import {
  EXERCISE_STATUS_LABELS, ROLES, ROLE_LABELS, UNIT_MEMBER_ROLE_LABELS, type Role,
} from '@/lib/constants';
import { formatDate } from '@/lib/format';
import {
  Card, CardBody, CardHeader, EmptyState, PageHeading, StatCard, StatusBadge,
} from '@/components/ui';
import { removeUnitMember } from '@/actions/establishment';
import { RecruitmentUnitForm, UnitMemberForm } from '../../forms';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await prisma.recruitmentUnit.findUnique({ where: { id }, select: { name: true } });
  return { title: u?.name ?? 'Recruitment Unit' };
}

export default async function UnitDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePagePermission(PERMISSIONS.UNIT_MANAGE);

  const [unit, officers] = await Promise.all([
    prisma.recruitmentUnit.findUnique({
      where: { id },
      include: {
        members: {
          orderBy: [{ active: 'desc' }, { assignedAt: 'asc' }],
          include: { user: { select: { id: true, fullName: true, role: true, email: true, active: true } } },
        },
        exercises: {
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { applications: true, vacancies: true } } },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: { not: ROLES.APPLICANT }, active: true },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, role: true },
    }),
  ]);
  if (!unit) notFound();

  const assignedIds = new Set(unit.members.filter((m) => m.active).map((m) => m.userId));
  const available = officers
    .filter((o) => !assignedIds.has(o.id))
    .map((o) => ({ id: o.id, fullName: o.fullName, roleLabel: ROLE_LABELS[o.role as Role] ?? o.role }));

  const activeMembers = unit.members.filter((m) => m.active);
  const pastMembers = unit.members.filter((m) => !m.active);

  return (
    <>
      <PageHeading
        eyebrow={`Recruitment unit · ${unit.code}`}
        title={unit.name}
        description={unit.mandate ?? undefined}
        breadcrumb={[
          { label: 'Administration', href: '/admin' },
          { label: 'Recruitment Unit', href: '/admin/establishment/units' },
          { label: unit.code },
        ]}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Officers on the unit" value={activeMembers.length} tone="green" />
        <StatCard label="Exercises managed" value={unit.exercises.length} tone="blue" />
        <StatCard
          label="Vacancies raised"
          value={unit.exercises.reduce((s, e) => s + e._count.vacancies, 0)}
        />
        <StatCard
          label="Applications handled"
          value={unit.exercises.reduce((s, e) => s + e._count.applications, 0)}
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader
              title="Unit membership"
              description="Officers answerable for the stages of a recruitment exercise."
            />
            {activeMembers.length === 0 ? (
              <CardBody>
                <EmptyState
                  title="No officers assigned"
                  description="Assign officers on the right so responsibility for each stage is on record."
                />
              </CardBody>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Officer</th><th>System role</th><th>Role on the unit</th>
                      <th>Assigned</th><th>Note</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {activeMembers.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <p className="font-medium text-ink-950">{m.user.fullName}</p>
                          <p className="text-xs text-ink-500">{m.user.email}</p>
                        </td>
                        <td className="text-xs">{ROLE_LABELS[m.user.role as Role] ?? m.user.role}</td>
                        <td><span className="badge-green">{UNIT_MEMBER_ROLE_LABELS[m.unitRole] ?? m.unitRole}</span></td>
                        <td className="text-xs">{formatDate(m.assignedAt)}</td>
                        <td className="text-xs text-ink-600">{m.notes ?? '—'}</td>
                        <td>
                          <form action={removeUnitMember}>
                            <input type="hidden" name="id" value={m.id} />
                            <button type="submit" className="btn-ghost btn-sm text-[#9a2c20]">Remove</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {pastMembers.length > 0 ? (
            <Card>
              <CardHeader title="Past membership" description="Officers who have left the unit." />
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Officer</th><th>Role held</th><th>Assigned</th><th>Ended</th></tr>
                  </thead>
                  <tbody>
                    {pastMembers.map((m) => (
                      <tr key={m.id}>
                        <td className="text-ink-700">{m.user.fullName}</td>
                        <td><span className="badge-slate">{UNIT_MEMBER_ROLE_LABELS[m.unitRole] ?? m.unitRole}</span></td>
                        <td className="text-xs">{formatDate(m.assignedAt)}</td>
                        <td className="text-xs">{m.endedAt ? formatDate(m.endedAt) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Exercises under this unit"
              actions={<Link href="/admin/exercises" className="btn-secondary btn-sm">All exercises</Link>}
            />
            {unit.exercises.length === 0 ? (
              <CardBody>
                <EmptyState
                  title="No exercises assigned"
                  description="Open a recruitment exercise and place it under this unit from its management panel."
                />
              </CardBody>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Reference</th><th>Exercise</th><th>Status</th>
                      <th className="num">Vacancies</th><th className="num">Applications</th><th>Closes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unit.exercises.map((e) => (
                      <tr key={e.id}>
                        <td><span className="ref">{e.reference}</span></td>
                        <td>
                          <Link href={`/admin/exercises/${e.id}`} className="font-medium text-ink-950 hover:text-kogi-700 hover:underline">
                            {e.title}
                          </Link>
                        </td>
                        <td><StatusBadge status={e.status} label={EXERCISE_STATUS_LABELS[e.status]} /></td>
                        <td className="num">{e._count.vacancies}</td>
                        <td className="num">{e._count.applications}</td>
                        <td className="text-xs">{formatDate(e.closesAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Assign an officer" />
            <CardBody>
              {available.length === 0 ? (
                <p className="text-sm text-ink-500">
                  Every active member of staff is already on this unit.
                </p>
              ) : (
                <UnitMemberForm unitId={unit.id} officers={available} />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Amend the unit" />
            <CardBody>
              <RecruitmentUnitForm
                initial={{
                  id: unit.id,
                  name: unit.name,
                  code: unit.code,
                  mandate: unit.mandate ?? '',
                  description: unit.description ?? '',
                  email: unit.email ?? '',
                  phone: unit.phone ?? '',
                  office: unit.office ?? '',
                  active: unit.active,
                }}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
