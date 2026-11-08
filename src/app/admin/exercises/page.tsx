import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { EXERCISE_STATUS, EXERCISE_STATUS_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import { Card, EmptyState, PageHeading, StatusBadge, Tabs } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Recruitment Exercises' };

/** Module 2.1 - recruitment exercise register. */
export default async function AdminExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const user = await requirePagePermission(PERMISSIONS.EXERCISE_VIEW);
  const canManage = hasPermission(user, PERMISSIONS.EXERCISE_MANAGE);

  const where = {
    ...(sp.status && sp.status !== 'ALL' ? { status: sp.status } : {}),
    ...(sp.q ? { OR: [{ title: { contains: sp.q } }, { reference: { contains: sp.q } }] } : {}),
  };

  const [exercises, counts] = await Promise.all([
    prisma.recruitmentExercise.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { applications: true, vacancies: true } },
        vacancies: { where: { active: true }, select: { positions: true } },
      },
    }),
    prisma.recruitmentExercise.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const countFor = (status: string) =>
    counts.find((c) => c.status === status)?._count._all ?? 0;
  const total = counts.reduce((s, c) => s + c._count._all, 0);

  return (
    <>
      <PageHeading
        title="Recruitment Exercises"
        description="Create, configure, approve, publish, suspend, close and archive recruitment exercises."
        actions={canManage ? <Link href="/admin/exercises/new" className="btn-primary btn-sm">New exercise</Link> : undefined}
      />

      <Tabs
        active={`/admin/exercises?status=${sp.status ?? 'ALL'}`}
        tabs={[
          { label: 'All', href: '/admin/exercises?status=ALL', count: total },
          { label: 'Draft', href: `/admin/exercises?status=${EXERCISE_STATUS.DRAFT}`, count: countFor(EXERCISE_STATUS.DRAFT) },
          { label: 'Awaiting approval', href: `/admin/exercises?status=${EXERCISE_STATUS.PENDING_APPROVAL}`, count: countFor(EXERCISE_STATUS.PENDING_APPROVAL) },
          { label: 'Approved', href: `/admin/exercises?status=${EXERCISE_STATUS.APPROVED}`, count: countFor(EXERCISE_STATUS.APPROVED) },
          { label: 'Published', href: `/admin/exercises?status=${EXERCISE_STATUS.PUBLISHED}`, count: countFor(EXERCISE_STATUS.PUBLISHED) },
          { label: 'Suspended', href: `/admin/exercises?status=${EXERCISE_STATUS.SUSPENDED}`, count: countFor(EXERCISE_STATUS.SUSPENDED) },
          { label: 'Closed', href: `/admin/exercises?status=${EXERCISE_STATUS.CLOSED}`, count: countFor(EXERCISE_STATUS.CLOSED) },
          { label: 'Archived', href: `/admin/exercises?status=${EXERCISE_STATUS.ARCHIVED}`, count: countFor(EXERCISE_STATUS.ARCHIVED) },
        ]}
      />

      <form method="get" className="mb-5 flex flex-wrap gap-2">
        <input type="hidden" name="status" value={sp.status ?? 'ALL'} />
        <input name="q" defaultValue={sp.q} placeholder="Search by title or reference…" className="input max-w-xs" />
        <button type="submit" className="btn-secondary btn-sm">Search</button>
        {sp.q ? <Link href={`/admin/exercises?status=${sp.status ?? 'ALL'}`} className="btn-ghost btn-sm">Clear</Link> : null}
      </form>

      {exercises.length === 0 ? (
        <EmptyState
          title="No recruitment exercises found"
          description={sp.q || sp.status ? 'Adjust your filters.' : 'Create an exercise to begin a recruitment cycle.'}
          action={canManage ? <Link href="/admin/exercises/new" className="btn-primary btn-sm">Create exercise</Link> : undefined}
        />
      ) : (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Exercise</th>
                  <th>Status</th>
                  <th>Vacancies</th>
                  <th>Posts</th>
                  <th>Applications</th>
                  <th>Opens</th>
                  <th>Closes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {exercises.map((ex) => (
                  <tr key={ex.id}>
                    <td>
                      <Link href={`/admin/exercises/${ex.id}`} className="font-medium text-kogi-700 hover:underline">
                        {ex.title}
                      </Link>
                      <p className="text-xs text-slate-500">{ex.reference}</p>
                    </td>
                    <td><StatusBadge status={ex.status} label={EXERCISE_STATUS_LABELS[ex.status]} /></td>
                    <td>{ex._count.vacancies}</td>
                    <td>{ex.vacancies.reduce((s, v) => s + v.positions, 0)}</td>
                    <td>{ex._count.applications.toLocaleString('en-NG')}</td>
                    <td className="whitespace-nowrap text-xs">{formatDate(ex.opensAt)}</td>
                    <td className="whitespace-nowrap text-xs">{formatDate(ex.closesAt)}</td>
                    <td><Link href={`/admin/exercises/${ex.id}`} className="btn-secondary btn-sm">Manage</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
