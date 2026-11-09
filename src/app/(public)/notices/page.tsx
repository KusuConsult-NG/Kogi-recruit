import Link from 'next/link';
import { prisma } from '@/lib/db';
import { formatDate } from '@/lib/format';
import { Card, CardBody, EmptyState, PageHeading } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Circulars and Public Notices' };

export default async function NoticesPage() {
  const notices = await prisma.article.findMany({
    where: { status: 'PUBLISHED', type: { in: ['CIRCULAR', 'NOTICE', 'RECRUITMENT_NOTICE'] } },
    orderBy: { publishedAt: 'desc' },
    include: { attachments: { select: { id: true, label: true } } },
  });

  return (
    <div className="container-page py-10">
      <PageHeading
        title="Circulars and Public Notices"
        description="Approved circulars, public notices and recruitment notices issued by the Commission."
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Circulars & Notices' }]}
      />
      {notices.length === 0 ? (
        <EmptyState title="No notices published" />
      ) : (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Attachments</th>
                </tr>
              </thead>
              <tbody>
                {notices.map((n) => (
                  <tr key={n.id}>
                    <td>
                      <Link href={`/news/${n.slug}`} className="font-medium text-kogi-700 hover:underline">{n.title}</Link>
                      {n.summary ? <p className="mt-0.5 text-xs text-slate-500">{n.summary}</p> : null}
                    </td>
                    <td><span className="badge-slate">{n.type.replace(/_/g, ' ').toLowerCase()}</span></td>
                    <td className="whitespace-nowrap">{formatDate(n.publishedAt)}</td>
                    <td>
                      {n.attachments.length === 0 ? (
                        <span className="text-xs text-slate-400">None</span>
                      ) : (
                        <ul className="space-y-1">
                          {n.attachments.map((a) => (
                            <li key={a.id}>
                              <a href={`/api/files/article/${a.id}`} className="text-xs text-kogi-700 underline">{a.label}</a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
