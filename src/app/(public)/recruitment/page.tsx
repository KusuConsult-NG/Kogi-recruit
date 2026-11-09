import Link from 'next/link';
import { prisma } from '@/lib/db';
import { EXERCISE_STATUS, EXERCISE_STATUS_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import { Card, CardBody, EmptyState, PageHeading, StatusBadge, Tabs } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Recruitment Exercises' };

export default async function RecruitmentPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view = 'open' } = await searchParams;

  const statusFilter =
    view === 'closed'
      ? { status: { in: [EXERCISE_STATUS.CLOSED, EXERCISE_STATUS.ARCHIVED] } }
      : view === 'all'
        ? { status: { in: [EXERCISE_STATUS.PUBLISHED, EXERCISE_STATUS.SUSPENDED, EXERCISE_STATUS.CLOSED, EXERCISE_STATUS.ARCHIVED] } }
        : { status: { in: [EXERCISE_STATUS.PUBLISHED, EXERCISE_STATUS.SUSPENDED] } };

  const [exercises, openCount, closedCount] = await Promise.all([
    prisma.recruitmentExercise.findMany({
      where: statusFilter,
      orderBy: [{ status: 'asc' }, { closesAt: 'desc' }],
      include: {
        vacancies: { where: { active: true }, orderBy: { jobTitle: 'asc' } },
        _count: { select: { applications: true } },
      },
    }),
    prisma.recruitmentExercise.count({ where: { status: { in: [EXERCISE_STATUS.PUBLISHED, EXERCISE_STATUS.SUSPENDED] } } }),
    prisma.recruitmentExercise.count({ where: { status: { in: [EXERCISE_STATUS.CLOSED, EXERCISE_STATUS.ARCHIVED] } } }),
  ]);

  const now = new Date();

  return (
    <div className="container-page py-10">
      <PageHeading
        title="Recruitment Exercises"
        description="Approved recruitment exercises, vacancies and application guidelines published by the Commission."
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Recruitment' }]}
        actions={<Link href="/recruitment/process" className="btn-secondary btn-sm">Recruitment process</Link>}
      />

      <Tabs
        active={`/recruitment?view=${view}`}
        tabs={[
          { label: 'Open', href: '/recruitment?view=open', count: openCount },
          { label: 'Closed and archived', href: '/recruitment?view=closed', count: closedCount },
          { label: 'All', href: '/recruitment?view=all', count: openCount + closedCount },
        ]}
      />

      {exercises.length === 0 ? (
        <EmptyState
          title="No recruitment exercises to display"
          description="Approved exercises are published here with their vacancies, guidelines and application dates."
        />
      ) : (
        <div className="space-y-6">
          {exercises.map((ex) => {
            const positions = ex.vacancies.reduce((s, v) => s + v.positions, 0);
            const isOpen = ex.status === EXERCISE_STATUS.PUBLISHED && ex.closesAt > now && ex.opensAt <= now;
            const notYetOpen = ex.status === EXERCISE_STATUS.PUBLISHED && ex.opensAt > now;
            return (
              <Card key={ex.id}>
                <div className="card-header">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={ex.status} label={EXERCISE_STATUS_LABELS[ex.status]} />
                      <span className="text-xs font-medium text-slate-500">{ex.reference}</span>
                    </div>
                    <h2 className="mt-1.5 text-lg font-semibold text-slate-900">{ex.title}</h2>
                  </div>
                  <Link href={`/recruitment/${ex.id}`} className={isOpen ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}>
                    {isOpen ? 'View and apply' : 'View details'}
                  </Link>
                </div>
                <CardBody>
                  <p className="text-sm text-slate-700">{ex.description}</p>
                  <dl className="mt-4 grid grid-cols-2 gap-4 text-xs sm:grid-cols-5">
                    <div><dt className="text-slate-500">Vacancies</dt><dd className="mt-0.5 font-semibold text-slate-900">{ex.vacancies.length}</dd></div>
                    <div><dt className="text-slate-500">Positions</dt><dd className="mt-0.5 font-semibold text-slate-900">{positions}</dd></div>
                    <div><dt className="text-slate-500">Opens</dt><dd className="mt-0.5 font-semibold text-slate-900">{formatDate(ex.opensAt)}</dd></div>
                    <div><dt className="text-slate-500">Closes</dt><dd className="mt-0.5 font-semibold text-slate-900">{formatDate(ex.closesAt)}</dd></div>
                    <div><dt className="text-slate-500">Applications</dt><dd className="mt-0.5 font-semibold text-slate-900">{ex._count.applications.toLocaleString('en-NG')}</dd></div>
                  </dl>
                  {notYetOpen ? (
                    <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                      Applications open on {formatDate(ex.opensAt)}.
                    </p>
                  ) : null}
                  {ex.status === EXERCISE_STATUS.SUSPENDED ? (
                    <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                      This exercise is temporarily suspended.{ex.suspendedReason ? ` ${ex.suspendedReason}` : ''}
                    </p>
                  ) : null}

                  {ex.vacancies.length > 0 ? (
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Advertised positions</p>
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {ex.vacancies.slice(0, 8).map((v) => (
                          <li key={v.id} className="badge-slate">
                            {v.jobTitle} · {v.gradeLevel} · {v.positions} post{v.positions === 1 ? '' : 's'}
                          </li>
                        ))}
                        {ex.vacancies.length > 8 ? (
                          <li className="badge-green">+{ex.vacancies.length - 8} more</li>
                        ) : null}
                      </ul>
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
