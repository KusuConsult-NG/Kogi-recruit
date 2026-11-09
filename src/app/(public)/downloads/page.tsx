import { prisma } from '@/lib/db';
import { formatDate } from '@/lib/format';
import { formatBytes } from '@/lib/storage';
import { Card, CardBody, EmptyState, PageHeading } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Forms and Downloads' };

const CATEGORY_LABELS: Record<string, string> = {
  FORM: 'Approved Forms',
  GUIDELINE: 'Guidelines',
  PUBLICATION: 'Publications',
  CIRCULAR: 'Circulars',
};

export default async function DownloadsPage() {
  const items = await prisma.downloadItem.findMany({
    where: { published: true },
    orderBy: [{ category: 'asc' }, { title: 'asc' }],
  });

  const grouped = new Map<string, typeof items>();
  for (const item of items) {
    grouped.set(item.category, [...(grouped.get(item.category) ?? []), item]);
  }

  return (
    <div className="container-page py-10">
      <PageHeading
        title="Forms, Guidelines and Publications"
        description="Download approved forms, guidelines and publications issued by the Commission."
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Downloads' }]}
      />
      {items.length === 0 ? (
        <EmptyState title="No downloads available" description="Approved documents will be published here." />
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([category, group]) => (
            <Card key={category}>
              <div className="card-header">
                <h2 className="card-title">{CATEGORY_LABELS[category] ?? category}</h2>
                <span className="badge-slate">{group.length} item(s)</span>
              </div>
              <CardBody>
                <ul className="divide-y divide-slate-100">
                  {group.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        {item.description ? <p className="mt-0.5 text-xs text-slate-600">{item.description}</p> : null}
                        <p className="mt-1 text-[11px] text-slate-400">
                          {formatBytes(item.sizeBytes)} · published {formatDate(item.createdAt)} · {item.downloads} download(s)
                        </p>
                      </div>
                      <a href={`/api/files/download/${item.id}`} className="btn-secondary btn-sm">Download</a>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
