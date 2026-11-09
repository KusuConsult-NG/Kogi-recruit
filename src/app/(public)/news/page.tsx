import Link from 'next/link';
import { prisma } from '@/lib/db';
import { ARTICLE_TYPES } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import {
  Card, CardBody, EmptyState, PageHeading, Pagination, readable,
} from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'News and Announcements' };

const PAGE_SIZE = 10;

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const type = sp.type && ARTICLE_TYPES.some((t) => t.code === sp.type) ? sp.type : undefined;
  const q = sp.q?.trim();

  const where = {
    status: 'PUBLISHED',
    ...(type ? { type } : {}),
    ...(q ? { OR: [{ title: { contains: q } }, { summary: { contains: q } }, { body: { contains: q } }] } : {}),
  };

  const [total, articles] = await Promise.all([
    prisma.article.count({ where }),
    prisma.article.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { attachments: { select: { id: true } } },
    }),
  ]);

  return (
    <div className="container-page py-10">
      <PageHeading
        title="News, Announcements and Notices"
        description="Official information published by the Kogi State Civil Service Commission."
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'News & Notices' }]}
      />

      <Card className="mb-6">
        <CardBody>
          <form className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_200px_auto]" method="get">
            <input name="q" defaultValue={q} placeholder="Search published items…" className="input" aria-label="Search" />
            <select name="type" defaultValue={type ?? ''} className="select" aria-label="Filter by type">
              <option value="">All categories</option>
              {ARTICLE_TYPES.map((t) => (
                <option key={t.code} value={t.code}>{t.label}</option>
              ))}
            </select>
            <button type="submit" className="btn-primary">Search</button>
          </form>
        </CardBody>
      </Card>

      {articles.length === 0 ? (
        <EmptyState title="No published items found" description="Try a different search term or category." />
      ) : (
        <div className="space-y-4">
          {articles.map((a) => (
            <Card key={a.id} className="transition hover:shadow-md">
              <CardBody>
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                  <span className="badge-green">{readable(a.type)}</span>
                  <span>{formatDate(a.publishedAt)}</span>
                  {a.attachments.length > 0 ? (
                    <span className="badge-slate">{a.attachments.length} attachment(s)</span>
                  ) : null}
                </div>
                <h2 className="mt-2 text-lg font-semibold text-ink-950">
                  <Link href={`/news/${a.slug}`} className="hover:text-kogi-700 hover:underline">{a.title}</Link>
                </h2>
                {a.summary ? <p className="mt-1.5 text-sm text-ink-600">{a.summary}</p> : null}
                <Link href={`/news/${a.slug}`} className="mt-3 inline-block text-sm font-medium text-kogi-700 hover:underline">
                  Read more →
                </Link>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
      <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} basePath="/news" params={{ type, q }} />
    </div>
  );
}
