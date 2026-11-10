import { prisma } from '@/lib/db';
import { Card, CardBody, EmptyState, PageHeading } from '@/components/ui';
import { RichText } from '@/components/rich-text';
import { initials } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Leadership' };

export default async function LeadershipPage() {
  const profiles = await prisma.leadershipProfile.findMany({
    where: { published: true },
    orderBy: [{ position_: 'asc' }, { name: 'asc' }],
  });

  return (
    <div className="container-page py-10">
      <PageHeading
        eyebrow="The Commission"
        title="Commission Leadership"
        description="Approved leadership profiles of the Kogi State Civil Service Commission."
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Leadership' }]}
      />
      {profiles.length === 0 ? (
        <EmptyState title="No leadership profiles published" description="Approved profiles will appear here once published by the Commission." />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((p) => (
            <Card key={p.id}>
              <CardBody>
                <div className="flex items-center gap-4">
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-kogi-100 text-lg font-bold text-kogi-800">
                    {initials(p.name)}
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-ink-950">{p.name}</h2>
                    <p className="text-sm text-kogi-700">{p.position}</p>
                    {p.email ? <p className="mt-0.5 text-xs text-ink-500">{p.email}</p> : null}
                  </div>
                </div>
                {p.bio ? <div className="mt-4 border-t border-ink-100 pt-4"><RichText body={p.bio} /></div> : null}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
