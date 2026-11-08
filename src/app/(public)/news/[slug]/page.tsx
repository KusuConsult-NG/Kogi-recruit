import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { formatBytes } from '@/lib/storage';
import { Card, CardBody, PageHeading } from '@/components/ui';
import { RichText } from '@/components/rich-text';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await prisma.article.findUnique({ where: { slug } });
  return { title: article?.title ?? 'Publication' };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await prisma.article.findFirst({
    where: { slug, status: 'PUBLISHED' },
    include: { attachments: true, author: { select: { fullName: true, title: true } } },
  });
  if (!article) notFound();

  await prisma.article.update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } }).catch(() => undefined);

  const related = await prisma.article.findMany({
    where: { status: 'PUBLISHED', type: article.type, id: { not: article.id } },
    orderBy: { publishedAt: 'desc' },
    take: 4,
  });

  return (
    <div className="container-page py-10">
      <PageHeading
        title={article.title}
        breadcrumb={[
          { label: 'Home', href: '/' },
          { label: 'News & Notices', href: '/news' },
          { label: article.title.slice(0, 40) },
        ]}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardBody>
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4 text-xs text-slate-500">
                <span className="badge-green">{article.type.replace(/_/g, ' ').toLowerCase()}</span>
                <span>Published {formatDateTime(article.publishedAt)}</span>
                {article.author ? <span>· by {article.author.fullName}</span> : null}
              </div>
              {article.summary ? (
                <p className="mt-4 rounded-md border-l-4 border-kogi-500 bg-kogi-50 px-4 py-3 text-sm font-medium text-kogi-900">
                  {article.summary}
                </p>
              ) : null}
              <div className="mt-5">
                <RichText body={article.body} />
              </div>

              {article.attachments.length > 0 ? (
                <div className="mt-6 border-t border-slate-200 pt-4">
                  <h2 className="text-sm font-semibold text-slate-900">Attachments</h2>
                  <ul className="mt-2 space-y-2">
                    {article.attachments.map((att) => (
                      <li key={att.id}>
                        <a
                          href={`/api/files/article/${att.id}`}
                          className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm hover:border-kogi-400 hover:bg-kogi-50"
                        >
                          <span className="font-medium text-slate-800">{att.label}</span>
                          <span className="text-xs text-slate-500">{formatBytes(att.sizeBytes)}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>

        <div>
          {related.length > 0 ? (
            <Card>
              <div className="card-header"><h2 className="card-title">Related items</h2></div>
              <CardBody>
                <ul className="space-y-3">
                  {related.map((r) => (
                    <li key={r.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                      <Link href={`/news/${r.slug}`} className="text-sm font-medium text-slate-800 hover:text-kogi-700 hover:underline">
                        {r.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
