import Link from 'next/link';
import { prisma } from '@/lib/db';
import { EXERCISE_STATUS, EXERCISE_STATUS_LABELS, MDA_KIND_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import { Card, CardBody, EmptyState, PageHeading, StatusBadge, Tabs } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Recruitment Exercises' };

export default async function RecruitmentPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; ministry?: string }>;
}) {
  const { view = 'open', ministry } = await searchParams;

  const statusFilter =
    view === 'closed'
      ? { status: { in: [EXERCISE_STATUS.CLOSED, EXERCISE_STATUS.ARCHIVED] } }
      : view === 'all'
        ? { status: { in: [EXERCISE_STATUS.PUBLISHED, EXERCISE_STATUS.SUSPENDED, EXERCISE_STATUS.CLOSED, EXERCISE_STATUS.ARCHIVED] } }
        : { status: { in: [EXERCISE_STATUS.PUBLISHED, EXERCISE_STATUS.SUSPENDED] } };

  // When an MDA is chosen, only exercises carrying one of its posts are listed,
  // and each exercise shows only that MDA's vacancies.
  const vacancyFilter = { active: true, ...(ministry ? { ministryId: ministry } : {}) };

  const [exercises, openCount, closedCount, ministries, chosenMinistry] = await Promise.all([
    prisma.recruitmentExercise.findMany({
      where: {
        ...statusFilter,
        ...(ministry ? { vacancies: { some: { active: true, ministryId: ministry } } } : {}),
      },
      orderBy: [{ status: 'asc' }, { closesAt: 'desc' }],
      include: {
        vacancies: {
          where: vacancyFilter,
          orderBy: { jobTitle: 'asc' },
          include: {
            ministry: { select: { id: true, name: true, shortName: true, code: true } },
            ministryDept: { select: { name: true } },
          },
        },
        _count: { select: { applications: true } },
      },
    }),
    prisma.recruitmentExercise.count({ where: { status: { in: [EXERCISE_STATUS.PUBLISHED, EXERCISE_STATUS.SUSPENDED] } } }),
    prisma.recruitmentExercise.count({ where: { status: { in: [EXERCISE_STATUS.CLOSED, EXERCISE_STATUS.ARCHIVED] } } }),
    prisma.ministry.findMany({
      where: { published: true, vacancies: { some: { active: true } } },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
      select: {
        id: true, name: true, shortName: true, kind: true,
        _count: { select: { vacancies: { where: { active: true } } } },
      },
    }),
    ministry
      ? prisma.ministry.findUnique({
          where: { id: ministry },
          select: { id: true, name: true, code: true, kind: true, mandate: true },
        })
      : Promise.resolve(null),
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
          { label: 'Open', href: `/recruitment?view=open${ministry ? `&ministry=${ministry}` : ''}`, count: openCount },
          { label: 'Closed and archived', href: `/recruitment?view=closed${ministry ? `&ministry=${ministry}` : ''}`, count: closedCount },
          { label: 'All', href: `/recruitment?view=all${ministry ? `&ministry=${ministry}` : ''}`, count: openCount + closedCount },
        ]}
      />

      {/* Filter by the employing ministry, department or agency. */}
      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-md border border-ink-200 bg-ink-50 px-4 py-3">
        <input type="hidden" name="view" value={view} />
        <div>
          <label htmlFor="ministry" className="micro-label mb-1 block">
            Employing ministry, department or agency
          </label>
          <select id="ministry" name="ministry" defaultValue={ministry ?? ''} className="select w-80">
            <option value="">Every MDA</option>
            {ministries.map((m) => (
              <option key={m.id} value={m.id}>
                {m.shortName ?? m.name} — {MDA_KIND_LABELS[m.kind] ?? m.kind} ({m._count.vacancies})
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary btn-sm">Filter vacancies</button>
        {ministry ? (
          <Link href={`/recruitment?view=${view}`} className="btn-ghost btn-sm">Clear</Link>
        ) : null}
        <Link href="/ministries" className="link ml-auto text-sm">MDA directory →</Link>
      </form>

      {chosenMinistry ? (
        <div className="mb-6 rounded-md border-l-4 border-kogi-700 bg-white px-5 py-4 shadow-raised">
          <p className="micro-label">{MDA_KIND_LABELS[chosenMinistry.kind] ?? chosenMinistry.kind}</p>
          <h2 className="mt-1 font-serif text-lg font-semibold text-ink-950">{chosenMinistry.name}</h2>
          {chosenMinistry.mandate ? (
            <p className="mt-1.5 max-w-measure text-sm leading-relaxed text-ink-600">{chosenMinistry.mandate}</p>
          ) : null}
          <p className="mt-2 text-xs text-ink-500">
            Showing only the posts advertised for this MDA.
          </p>
        </div>
      ) : null}

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
                      <span className="text-xs font-medium text-ink-500">{ex.reference}</span>
                    </div>
                    <h2 className="mt-1.5 text-lg font-semibold text-ink-950">{ex.title}</h2>
                  </div>
                  <Link href={`/recruitment/${ex.id}`} className={isOpen ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}>
                    {isOpen ? 'View and apply' : 'View details'}
                  </Link>
                </div>
                <CardBody>
                  <p className="text-sm text-ink-700">{ex.description}</p>
                  <dl className="mt-4 grid grid-cols-2 gap-4 text-xs sm:grid-cols-5">
                    <div><dt className="text-ink-500">Vacancies</dt><dd className="mt-0.5 font-semibold text-ink-950">{ex.vacancies.length}</dd></div>
                    <div><dt className="text-ink-500">Positions</dt><dd className="mt-0.5 font-semibold text-ink-950">{positions}</dd></div>
                    <div><dt className="text-ink-500">Opens</dt><dd className="mt-0.5 font-semibold text-ink-950">{formatDate(ex.opensAt)}</dd></div>
                    <div><dt className="text-ink-500">Closes</dt><dd className="mt-0.5 font-semibold text-ink-950">{formatDate(ex.closesAt)}</dd></div>
                    <div><dt className="text-ink-500">Applications</dt><dd className="mt-0.5 font-semibold text-ink-950">{ex._count.applications.toLocaleString('en-NG')}</dd></div>
                  </dl>
                  {notYetOpen ? (
                    <p className="mt-3 rounded bg-gold-50 px-3 py-2 text-xs font-medium text-gold-800">
                      Applications open on {formatDate(ex.opensAt)}.
                    </p>
                  ) : null}
                  {ex.status === EXERCISE_STATUS.SUSPENDED ? (
                    <p className="mt-3 rounded bg-gold-50 px-3 py-2 text-xs font-medium text-gold-800">
                      This exercise is temporarily suspended.{ex.suspendedReason ? ` ${ex.suspendedReason}` : ''}
                    </p>
                  ) : null}

                  {ex.vacancies.length > 0 ? (
                    <div className="mt-4 border-t border-ink-100 pt-3">
                      <p className="micro-label">Advertised positions</p>
                      <ul className="mt-2.5 divide-y divide-ink-150 border-y border-ink-150">
                        {ex.vacancies.slice(0, 8).map((v) => (
                          <li key={v.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                            <span className="min-w-0">
                              <span className="block text-[0.8125rem] font-semibold text-ink-950">{v.jobTitle}</span>
                              <span className="block text-xs text-ink-600">
                                {v.ministry ? (v.ministry.shortName ?? v.ministry.name) : 'MDA not stated'}
                                {v.ministryDept ? ` · ${v.ministryDept.name}` : ''}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-3 text-xs text-ink-700">
                              <span className="ref">{v.gradeLevel}</span>
                              <span data-numeric>
                                {v.positions} post{v.positions === 1 ? '' : 's'}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                      {ex.vacancies.length > 8 ? (
                        <p className="mt-2 text-xs text-ink-500" data-numeric>
                          and {ex.vacancies.length - 8} further position(s) — open the exercise to see them all.
                        </p>
                      ) : null}
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
