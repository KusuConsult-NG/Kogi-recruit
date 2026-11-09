import { prisma } from '@/lib/db';
import { Card, CardBody, EmptyState, PageHeading } from '@/components/ui';
import { RichText } from '@/components/rich-text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Frequently Asked Questions' };

export default async function FaqPage() {
  const faqs = await prisma.faq.findMany({
    where: { published: true },
    orderBy: [{ category: 'asc' }, { position: 'asc' }],
  });
  const grouped = new Map<string, typeof faqs>();
  for (const f of faqs) grouped.set(f.category, [...(grouped.get(f.category) ?? []), f]);

  return (
    <div className="container-page py-10">
      <PageHeading
        title="Frequently Asked Questions"
        description="Answers to common questions about the Commission and its recruitment exercises."
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'FAQs' }]}
      />
      {faqs.length === 0 ? (
        <EmptyState title="No questions published yet" />
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([category, group]) => (
            <Card key={category}>
              <div className="card-header">
                <h2 className="card-title">{category.replace(/_/g, ' ')}</h2>
              </div>
              <CardBody className="space-y-2">
                {group.map((f) => (
                  <details key={f.id} className="group rounded-md border border-ink-200 px-4 py-3 open:bg-ink-50">
                    <summary className="cursor-pointer text-sm font-semibold text-ink-950 marker:text-kogi-600">
                      {f.question}
                    </summary>
                    <div className="mt-2 border-t border-ink-200 pt-2">
                      <RichText body={f.answer} />
                    </div>
                  </details>
                ))}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
