import Link from 'next/link';
import { prisma } from '@/lib/db';
import { COMMISSION, EXERCISE_STATUS, WORKFLOW_STAGES } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import { Card, CardBody, StatusBadge } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const now = new Date();
  const [homepage, exercises, articles, notices, stats, leadership] = await Promise.all([
    prisma.pageContent.findUnique({ where: { slug: 'homepage' } }),
    prisma.recruitmentExercise.findMany({
      where: { status: EXERCISE_STATUS.PUBLISHED },
      orderBy: { closesAt: 'asc' },
      take: 3,
      include: { vacancies: { where: { active: true }, select: { positions: true } } },
    }),
    prisma.article.findMany({
      where: { status: 'PUBLISHED', type: { in: ['NEWS', 'ANNOUNCEMENT'] } },
      orderBy: { publishedAt: 'desc' },
      take: 4,
    }),
    prisma.article.findMany({
      where: { status: 'PUBLISHED', type: { in: ['CIRCULAR', 'NOTICE', 'RECRUITMENT_NOTICE'] } },
      orderBy: { publishedAt: 'desc' },
      take: 5,
    }),
    Promise.all([
      prisma.recruitmentExercise.count({ where: { status: EXERCISE_STATUS.PUBLISHED } }),
      prisma.vacancy.aggregate({
        _sum: { positions: true },
        where: { active: true, exercise: { status: EXERCISE_STATUS.PUBLISHED } },
      }),
      prisma.application.count({ where: { status: { not: 'DRAFT' } } }),
      prisma.department.count({ where: { published: true, kind: 'DEPARTMENT' } }),
    ]),
    prisma.leadershipProfile.findMany({
      where: { published: true },
      orderBy: { position_: 'asc' },
      take: 3,
    }),
  ]);

  const [activeExercises, positionsAgg, applicationCount, departmentCount] = stats;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-kogi-800 via-kogi-700 to-kogi-900 text-white">
        <div
          aria-hidden
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="container-page relative grid grid-cols-1 items-center gap-10 py-14 lg:grid-cols-5 lg:py-20">
          <div className="lg:col-span-3">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gold-300">
              Official Government Portal
            </p>
            <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              {homepage?.title ?? COMMISSION.name}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-kogi-50 sm:text-lg">
              {homepage?.subtitle ??
                'A centralised digital platform for Commission administration, transparent recruitment exercises, applicant records, public communication and document management.'}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/recruitment" className="btn-gold">
                View Current Vacancies
              </Link>
              <Link
                href="/register"
                className="btn border border-white/50 bg-white/10 text-white hover:bg-white/20"
              >
                Create an Applicant Account
              </Link>
              <Link href="/track" className="btn text-white underline hover:text-gold-300">
                Track your application
              </Link>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Open recruitment exercises', value: activeExercises },
                { label: 'Advertised positions', value: positionsAgg._sum.positions ?? 0 },
                { label: 'Applications received', value: applicationCount.toLocaleString('en-NG') },
                { label: 'Departments and units', value: departmentCount },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-lg border border-white/20 bg-white/10 px-4 py-4 backdrop-blur"
                >
                  <p className="text-2xl font-bold text-gold-300">{s.value}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-kogi-100">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Open exercises */}
      <section className="container-page py-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Current Recruitment Exercises</h2>
            <p className="mt-1 text-sm text-slate-600">
              Approved vacancies currently open for online application.
            </p>
          </div>
          <Link href="/recruitment" className="btn-secondary btn-sm">
            All exercises
          </Link>
        </div>

        {exercises.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-sm text-slate-600">
                There are no recruitment exercises open at this time. Approved vacancies are published on
                this portal and announced under{' '}
                <Link href="/news" className="text-kogi-700 underline">
                  News and Notices
                </Link>
                .
              </p>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {exercises.map((ex) => {
              const positions = ex.vacancies.reduce((s, v) => s + v.positions, 0);
              const daysLeft = Math.ceil((ex.closesAt.getTime() - now.getTime()) / 86400000);
              return (
                <Card key={ex.id} className="flex flex-col transition hover:shadow-md">
                  <CardBody className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <StatusBadge status={ex.status} label="Open" />
                      <span className="text-xs font-medium text-slate-500">{ex.reference}</span>
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-slate-900">{ex.title}</h3>
                    <p className="mt-2 line-clamp-3 flex-1 text-sm text-slate-600">{ex.description}</p>
                    <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-slate-500">Positions</dt>
                        <dd className="font-semibold text-slate-800">{positions}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Closes</dt>
                        <dd className="font-semibold text-slate-800">{formatDate(ex.closesAt)}</dd>
                      </div>
                    </dl>
                    {daysLeft >= 0 ? (
                      <p className="mt-2 text-xs font-medium text-amber-700">
                        {daysLeft === 0 ? 'Closes today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining`}
                      </p>
                    ) : null}
                    <Link href={`/recruitment/${ex.id}`} className="btn-primary btn-sm mt-4 w-full">
                      View details and apply
                    </Link>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="bg-white py-12">
        <div className="container-page">
          <h2 className="text-2xl font-bold text-slate-900">How the Recruitment Process Works</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Every approved recruitment exercise follows the same ten documented stages, from planning
            through to closure and archiving.
          </p>
          <ol className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {WORKFLOW_STAGES.map((stage) => (
              <li key={stage.key} className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-kogi-700 text-xs font-bold text-white">
                  {stage.n}
                </span>
                <h3 className="mt-2.5 text-sm font-semibold text-slate-900">{stage.name}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{stage.description}</p>
              </li>
            ))}
          </ol>
          <div className="mt-6">
            <Link href="/recruitment/process" className="btn-secondary btn-sm">
              Read the full recruitment process
            </Link>
          </div>
        </div>
      </section>

      {/* News + notices */}
      <section className="container-page grid grid-cols-1 gap-8 py-12 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-5 flex items-end justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-900">News and Announcements</h2>
            <Link href="/news" className="text-sm text-kogi-700 underline">
              View all
            </Link>
          </div>
          {articles.length === 0 ? (
            <Card>
              <CardBody>
                <p className="text-sm text-slate-600">No news items have been published yet.</p>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-4">
              {articles.map((a) => (
                <Card key={a.id} className="transition hover:shadow-md">
                  <CardBody>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="badge-green">{a.type.replace(/_/g, ' ').toLowerCase()}</span>
                      <span>{formatDate(a.publishedAt)}</span>
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-slate-900">
                      <Link href={`/news/${a.slug}`} className="hover:text-kogi-700 hover:underline">
                        {a.title}
                      </Link>
                    </h3>
                    {a.summary ? (
                      <p className="mt-1.5 line-clamp-2 text-sm text-slate-600">{a.summary}</p>
                    ) : null}
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <div className="card-header">
              <h2 className="card-title">Circulars and Public Notices</h2>
            </div>
            <CardBody>
              {notices.length === 0 ? (
                <p className="text-sm text-slate-600">No notices published.</p>
              ) : (
                <ul className="space-y-3">
                  {notices.map((n) => (
                    <li key={n.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                      <Link
                        href={`/news/${n.slug}`}
                        className="text-sm font-medium text-slate-800 hover:text-kogi-700 hover:underline"
                      >
                        {n.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500">{formatDate(n.publishedAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/notices" className="btn-secondary btn-sm mt-4 w-full">
                All notices
              </Link>
            </CardBody>
          </Card>

          {leadership.length > 0 ? (
            <Card>
              <div className="card-header">
                <h2 className="card-title">Commission Leadership</h2>
              </div>
              <CardBody>
                <ul className="space-y-3">
                  {leadership.map((l) => (
                    <li key={l.id} className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-kogi-100 text-xs font-bold text-kogi-800">
                        {l.name.split(' ').slice(0, 2).map((p) => p[0]).join('')}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-slate-900">{l.name}</span>
                        <span className="block text-xs text-slate-600">{l.position}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <Link href="/leadership" className="btn-secondary btn-sm mt-4 w-full">
                  All profiles
                </Link>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-kogi-800 py-12 text-white">
        <div className="container-page flex flex-wrap items-center justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold">Ready to apply?</h2>
            <p className="mt-1 max-w-2xl text-sm text-kogi-100">
              Create an applicant account once, then apply for any open recruitment exercise, upload
              your documents and track your progress at every stage.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/register" className="btn-gold">
              Create account
            </Link>
            <Link
              href="/login"
              className="btn border border-white/50 bg-white/10 text-white hover:bg-white/20"
            >
              Applicant login
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
