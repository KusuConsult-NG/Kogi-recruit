import Link from 'next/link';
import { prisma } from '@/lib/db';
import { COMMISSION, EXERCISE_STATUS, MDA_KIND_LABELS, WORKFLOW_STAGES } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import { Card, CardBody, CardHeader, StatusBadge } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const now = new Date();
  const [homepage, exercises, articles, notices, stats, leadership, ministries] = await Promise.all([
    prisma.pageContent.findUnique({ where: { slug: 'homepage' } }),
    prisma.recruitmentExercise.findMany({
      where: { status: EXERCISE_STATUS.PUBLISHED },
      orderBy: { closesAt: 'asc' },
      take: 3,
      include: {
        vacancies: {
          where: { active: true },
          select: { positions: true, ministry: { select: { id: true, name: true, shortName: true } } },
        },
      },
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
      prisma.ministry.count({ where: { published: true, active: true } }),
    ]),
    prisma.leadershipProfile.findMany({ where: { published: true }, orderBy: { position_: 'asc' }, take: 3 }),
    prisma.ministry.findMany({
      where: { published: true, active: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      take: 8,
      select: {
        id: true, name: true, shortName: true, kind: true,
        _count: { select: { vacancies: { where: { active: true, exercise: { status: EXERCISE_STATUS.PUBLISHED } } } } },
      },
    }),
  ]);

  const [activeExercises, positionsAgg, applicationCount, ministryCount] = stats;

  const ledger = [
    { label: 'Open recruitment exercises', value: activeExercises },
    { label: 'Approved posts advertised', value: positionsAgg._sum.positions ?? 0 },
    { label: 'Applications received', value: applicationCount.toLocaleString('en-NG') },
    { label: 'Ministries, departments and agencies', value: ministryCount },
  ];

  return (
    <>
      {/* ---- Masthead notice ------------------------------------------- */}
      <section className="border-b border-ink-200 bg-kogi-900 text-white">
        <div className="container-page grid grid-cols-1 gap-10 py-14 lg:grid-cols-12 lg:py-16">
          <div className="lg:col-span-7">
            <p className="seal-text text-2xs text-gold-300">
              {COMMISSION.state} · Office of the Civil Service Commission
            </p>
            <div className="rule-gold mt-3 w-16" />
            <h1 className="mt-5 font-serif text-[2rem] font-semibold leading-[1.15] tracking-tight sm:text-[2.5rem] lg:text-[2.875rem]">
              {homepage?.title ?? COMMISSION.name}
            </h1>
            <p className="mt-5 max-w-measure text-[0.9375rem] leading-[1.75] text-kogi-100">
              {homepage?.subtitle ??
                'The Commission’s official portal: approved vacancies by ministry, online applications, preliminary screening, computer-based aptitude testing, interviews and published recruitment outcomes — each stage documented and auditable.'}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/recruitment" className="btn-gold btn-lg">
                View current vacancies
              </Link>
              <Link
                href="/register"
                className="btn btn-lg border-white/30 bg-white/10 text-white hover:border-white/60 hover:bg-white/20"
              >
                Create an applicant account
              </Link>
              <Link
                href="/track"
                className="text-sm font-semibold text-gold-200 underline decoration-gold-500/60 underline-offset-4 hover:text-white"
              >
                Track an application →
              </Link>
            </div>
          </div>

          {/* Register of figures, set as a ledger rather than tiles. */}
          <div className="lg:col-span-5 lg:pl-10">
            <div className="border-t-2 border-gold-500 pt-4">
              <p className="micro-label text-gold-300">The register, at a glance</p>
              <dl className="mt-4 divide-y divide-kogi-800">
                {ledger.map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-4 py-3">
                    <dt className="text-[0.8125rem] leading-snug text-kogi-100">{row.label}</dt>
                    <dd className="font-serif text-2xl font-semibold text-gold-200" data-numeric>
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Open exercises -------------------------------------------- */}
      <section className="container-page py-14">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-ink-200 pb-4">
          <div>
            <p className="micro-label">Advertisements</p>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-ink-950">
              Current recruitment exercises
            </h2>
            <p className="mt-1.5 max-w-measure text-sm text-ink-600">
              Approved vacancies now open for online application, with the employing ministry,
              department or agency stated against every post.
            </p>
          </div>
          <Link href="/recruitment" className="btn-secondary btn-sm">
            All exercises
          </Link>
        </header>

        {exercises.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-sm text-ink-600">
                There are no recruitment exercises open at this time. Approved vacancies are published on
                this portal and announced under{' '}
                <Link href="/news" className="link">
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
              const mdas = new Set(ex.vacancies.map((v) => v.ministry?.id).filter(Boolean));
              const daysLeft = Math.ceil((ex.closesAt.getTime() - now.getTime()) / 86400000);
              return (
                <article
                  key={ex.id}
                  className="relative flex flex-col overflow-hidden rounded-md border border-ink-200 bg-white pl-1 shadow-raised transition hover:border-kogi-400 hover:shadow-panel before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-kogi-700 before:content-['']"
                >
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-2">
                      <StatusBadge status={ex.status} label="Open for application" />
                      <span className="ref">{ex.reference}</span>
                    </div>
                    <h3 className="mt-3 font-serif text-lg font-semibold leading-snug text-ink-950">
                      {ex.title}
                    </h3>
                    <p className="mt-2 line-clamp-3 flex-1 text-[0.8125rem] leading-relaxed text-ink-600">
                      {ex.description}
                    </p>
                    <dl className="mt-4 divide-y divide-ink-150 border-y border-ink-150 text-xs">
                      <div className="flex justify-between py-1.5">
                        <dt className="text-ink-500">Approved posts</dt>
                        <dd className="font-semibold text-ink-900" data-numeric>{positions}</dd>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <dt className="text-ink-500">Employing MDAs</dt>
                        <dd className="font-semibold text-ink-900" data-numeric>{mdas.size}</dd>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <dt className="text-ink-500">Closes</dt>
                        <dd className="font-semibold text-ink-900">{formatDate(ex.closesAt)}</dd>
                      </div>
                    </dl>
                    {daysLeft >= 0 ? (
                      <p className="mt-2.5 text-xs font-semibold text-gold-700">
                        {daysLeft === 0 ? 'Closes today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining`}
                      </p>
                    ) : null}
                    <Link href={`/recruitment/${ex.id}`} className="btn-primary btn-sm mt-4 w-full">
                      View details and apply
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ---- Browse by ministry ---------------------------------------- */}
      {ministries.length > 0 ? (
        <section className="border-y border-ink-200 bg-ink-50">
          <div className="container-page py-12">
            <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="micro-label">The establishment</p>
                <h2 className="mt-1 font-serif text-2xl font-semibold text-ink-950">
                  Browse vacancies by ministry
                </h2>
                <p className="mt-1.5 max-w-measure text-sm text-ink-600">
                  Every post is raised for the ministry, extra-ministerial department or agency that
                  carries the approved establishment.
                </p>
              </div>
              <Link href="/ministries" className="btn-secondary btn-sm">
                Full MDA directory
              </Link>
            </header>
            <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-ink-200 bg-ink-200 sm:grid-cols-2 lg:grid-cols-4">
              {ministries.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/recruitment?ministry=${m.id}`}
                    className="flex h-full flex-col justify-between gap-3 bg-white px-4 py-3.5 transition hover:bg-kogi-50"
                  >
                    <span>
                      <span className="micro-label">{MDA_KIND_LABELS[m.kind] ?? m.kind}</span>
                      <span className="mt-1 block font-serif text-[0.9375rem] font-semibold leading-snug text-ink-950">
                        {m.shortName ?? m.name}
                      </span>
                    </span>
                    <span className="text-xs text-ink-600" data-numeric>
                      {m._count.vacancies === 0
                        ? 'No open vacancies'
                        : `${m._count.vacancies} open ${m._count.vacancies === 1 ? 'vacancy' : 'vacancies'}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* ---- The ten stages -------------------------------------------- */}
      <section className="bg-white py-14">
        <div className="container-page">
          <header className="mb-8 border-b border-ink-200 pb-4">
            <p className="micro-label">Procedure</p>
            <h2 className="mt-1 font-serif text-2xl font-semibold text-ink-950">
              How the recruitment process works
            </h2>
            <p className="mt-1.5 max-w-measure text-sm text-ink-600">
              Every approved recruitment exercise follows the same ten documented stages, from planning
              through to closure and archiving. Where an aptitude test or examination is required it is
              sat online in the applicant portal and marked automatically.
            </p>
          </header>
          <ol className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-5">
            {WORKFLOW_STAGES.map((stage) => (
              <li key={stage.key} className="border-t-2 border-ink-200 pt-3">
                <span className="font-serif text-xs font-bold tracking-label text-gold-600" data-numeric>
                  {String(stage.n).padStart(2, '0')}
                </span>
                <h3 className="mt-1 font-serif text-[0.9375rem] font-semibold leading-snug text-ink-950">
                  {stage.name}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-600">{stage.description}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8">
            <Link href="/recruitment/process" className="btn-secondary btn-sm">
              Read the full recruitment process
            </Link>
          </div>
        </div>
      </section>

      {/* ---- News and notices ------------------------------------------ */}
      <section className="border-t border-ink-200 bg-ink-50">
        <div className="container-page grid grid-cols-1 gap-10 py-14 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <header className="mb-5 flex items-end justify-between gap-3 border-b border-ink-200 pb-3">
              <div>
                <p className="micro-label">From the Commission</p>
                <h2 className="mt-1 font-serif text-xl font-semibold text-ink-950">
                  News and announcements
                </h2>
              </div>
              <Link href="/news" className="link text-sm">
                View all
              </Link>
            </header>
            {articles.length === 0 ? (
              <p className="text-sm text-ink-600">No news items have been published yet.</p>
            ) : (
              <ul className="divide-y divide-ink-200 border-b border-ink-200">
                {articles.map((a) => (
                  <li key={a.id} className="py-4 first:pt-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="badge-green">{a.type.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-ink-500">{formatDate(a.publishedAt)}</span>
                    </div>
                    <h3 className="mt-2 font-serif text-[1.0625rem] font-semibold leading-snug text-ink-950">
                      <Link href={`/news/${a.slug}`} className="hover:text-kogi-700 hover:underline">
                        {a.title}
                      </Link>
                    </h3>
                    {a.summary ? (
                      <p className="mt-1.5 line-clamp-2 text-[0.875rem] leading-relaxed text-ink-600">
                        {a.summary}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Circulars and public notices" />
              <CardBody>
                {notices.length === 0 ? (
                  <p className="text-sm text-ink-600">No notices published.</p>
                ) : (
                  <ul className="divide-y divide-ink-150">
                    {notices.map((n) => (
                      <li key={n.id} className="py-2.5 first:pt-0 last:pb-0">
                        <Link
                          href={`/news/${n.slug}`}
                          className="text-[0.8125rem] font-medium leading-snug text-ink-800 hover:text-kogi-700 hover:underline"
                        >
                          {n.title}
                        </Link>
                        <p className="mt-0.5 text-xs text-ink-500">{formatDate(n.publishedAt)}</p>
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
                <CardHeader title="Commission leadership" />
                <CardBody>
                  <ul className="divide-y divide-ink-150">
                    {leadership.map((l) => (
                      <li key={l.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                        <span
                          aria-hidden
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold-300 bg-kogi-50 font-serif text-xs font-semibold text-kogi-800"
                        >
                          {l.name.split(' ').slice(0, 2).map((p) => p[0]).join('')}
                        </span>
                        <span>
                          <span className="block text-[0.8125rem] font-semibold text-ink-950">{l.name}</span>
                          <span className="block text-xs text-ink-600">{l.position}</span>
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
        </div>
      </section>

      {/* ---- Call to action -------------------------------------------- */}
      <section className="border-t-2 border-gold-500 bg-kogi-800 bg-kogi-weave bg-weave py-12 text-white">
        <div className="container-page flex flex-wrap items-center justify-between gap-8">
          <div className="max-w-measure">
            <h2 className="font-serif text-xl font-semibold">Ready to apply?</h2>
            <p className="mt-1.5 text-[0.875rem] leading-relaxed text-kogi-100">
              Create an applicant account once, then apply for any open recruitment exercise, upload your
              documents, sit any required aptitude test online and track your progress at every stage.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/register" className="btn-gold">
              Create account
            </Link>
            <Link
              href="/login"
              className="btn border-white/30 bg-white/10 text-white hover:border-white/60 hover:bg-white/20"
            >
              Applicant login
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
