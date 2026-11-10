import Link from 'next/link';
import { prisma } from '@/lib/db';
import { EXERCISE_STATUS, MDA_KINDS, MDA_KIND_LABELS } from '@/lib/constants';
import { Card, CardBody, EmptyState, PageHeading, StatCard } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Ministries, Departments and Agencies',
  description:
    'Directory of the ministries, extra-ministerial departments, agencies and parastatals of the Kogi State Public Service for which the Civil Service Commission conducts recruitment.',
};

/**
 * The public establishment directory. Vacancies are raised against these
 * records, so the directory doubles as a way into the current advertisements.
 */
export default async function MinistriesDirectory() {
  const ministries = await prisma.ministry.findMany({
    where: { published: true },
    orderBy: [{ kind: 'asc' }, { position: 'asc' }, { name: 'asc' }],
    include: {
      departments: { orderBy: { name: 'asc' }, select: { id: true, name: true, kind: true } },
      vacancies: {
        where: { active: true, exercise: { status: EXERCISE_STATUS.PUBLISHED } },
        select: { positions: true },
      },
    },
  });

  const grouped = MDA_KINDS.map((kind) => ({
    kind,
    entries: ministries.filter((m) => m.kind === kind.code),
  })).filter((g) => g.entries.length > 0);

  const openPosts = ministries.reduce(
    (s, m) => s + m.vacancies.reduce((t, v) => t + v.positions, 0),
    0,
  );
  const withVacancies = ministries.filter((m) => m.vacancies.length > 0).length;

  return (
    <div className="container-page py-10">
      <PageHeading
        eyebrow="The establishment"
        title="Ministries, Departments and Agencies"
        description="The Commission conducts recruitment on behalf of the ministries, extra-ministerial departments, agencies and parastatals of the Kogi State Public Service. Every advertised post belongs to one of the MDAs listed here."
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Ministries & Agencies' }]}
        actions={
          <Link href="/recruitment" className="btn-secondary btn-sm">
            Current vacancies
          </Link>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="MDAs in the directory" value={ministries.length} />
        <StatCard label="Classifications" value={grouped.length} />
        <StatCard label="MDAs recruiting now" value={withVacancies} tone="green" />
        <StatCard label="Posts currently advertised" value={openPosts} tone="amber" />
      </div>

      {ministries.length === 0 ? (
        <EmptyState
          title="The directory is being compiled"
          description="The register of ministries, departments and agencies will be published here."
        />
      ) : (
        <div className="space-y-10">
          {grouped.map((group) => (
            <section key={group.kind.code}>
              <div className="mb-4 flex items-center gap-3 border-b border-ink-200 pb-2">
                <h2 className="font-serif text-xl font-semibold text-ink-950">{group.kind.label}</h2>
                <span className="badge-slate" data-numeric>{group.entries.length}</span>
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {group.entries.map((m) => {
                  const posts = m.vacancies.reduce((t, v) => t + v.positions, 0);
                  return (
                    <Card key={m.id}>
                      <CardBody>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="micro-label">{m.code}</p>
                            <h3 className="mt-1 font-serif text-[1.0625rem] font-semibold leading-snug text-ink-950">
                              {m.name}
                            </h3>
                            {m.headName ? (
                              <p className="mt-1 text-xs text-ink-600">
                                {m.headTitle ?? 'Accounting officer'}: {m.headName}
                              </p>
                            ) : null}
                          </div>
                          {posts > 0 ? (
                            <span className="badge-green" data-numeric>
                              {posts} post{posts === 1 ? '' : 's'} open
                            </span>
                          ) : (
                            <span className="badge-slate">no open vacancies</span>
                          )}
                        </div>

                        {m.mandate ? (
                          <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-700">{m.mandate}</p>
                        ) : null}

                        <dl className="mt-4 divide-y divide-ink-150 border-y border-ink-150 text-xs">
                          {m.address ? (
                            <div className="flex gap-4 py-1.5">
                              <dt className="w-28 shrink-0 text-ink-500">Address</dt>
                              <dd className="text-ink-800">{m.address}</dd>
                            </div>
                          ) : null}
                          {m.lga ? (
                            <div className="flex gap-4 py-1.5">
                              <dt className="w-28 shrink-0 text-ink-500">LGA</dt>
                              <dd className="text-ink-800">{m.lga}</dd>
                            </div>
                          ) : null}
                          {m.email ? (
                            <div className="flex gap-4 py-1.5">
                              <dt className="w-28 shrink-0 text-ink-500">Email</dt>
                              <dd className="break-all text-ink-800">
                                <a href={`mailto:${m.email}`} className="link">{m.email}</a>
                              </dd>
                            </div>
                          ) : null}
                          {m.phone ? (
                            <div className="flex gap-4 py-1.5">
                              <dt className="w-28 shrink-0 text-ink-500">Telephone</dt>
                              <dd className="font-mono text-ink-800">{m.phone}</dd>
                            </div>
                          ) : null}
                          {m.staffStrength ? (
                            <div className="flex gap-4 py-1.5">
                              <dt className="w-28 shrink-0 text-ink-500">Staff strength</dt>
                              <dd className="text-ink-800" data-numeric>
                                {m.staffStrength.toLocaleString('en-NG')}
                              </dd>
                            </div>
                          ) : null}
                        </dl>

                        {m.departments.length > 0 ? (
                          <div className="mt-3">
                            <p className="micro-label mb-1.5">Departments and units</p>
                            <ul className="flex flex-wrap gap-1.5">
                              {m.departments.map((d) => (
                                <li key={d.id} className="badge-slate">{d.name}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        <div className="mt-4">
                          <Link
                            href={`/recruitment?ministry=${m.id}`}
                            className={posts > 0 ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                          >
                            {posts > 0 ? 'View this MDA’s vacancies' : 'See past advertisements'}
                          </Link>
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="mt-10 max-w-measure text-xs leading-relaxed text-ink-500">
        {MDA_KIND_LABELS.MINISTRY} entries and their departments are maintained by the Commission's
        recruitment unit. Where a post sits in a named department of an MDA, that department is stated
        on the advertisement.
      </p>
    </div>
  );
}
