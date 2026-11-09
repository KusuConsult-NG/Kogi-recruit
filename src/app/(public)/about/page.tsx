import { prisma } from '@/lib/db';
import { COMMISSION } from '@/lib/constants';
import { Card, CardBody, PageHeading } from '@/components/ui';
import { RichText } from '@/components/rich-text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'The Commission' };

export default async function AboutPage() {
  const pages = await prisma.pageContent.findMany({
    where: { slug: { in: ['about', 'functions', 'mandate', 'vision-mission'] }, published: true },
  });
  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  const about = bySlug.get('about');
  const functions = bySlug.get('functions');
  const mandate = bySlug.get('mandate');
  const vision = bySlug.get('vision-mission');

  return (
    <div className="container-page py-10">
      <PageHeading
        title={about?.title ?? 'The Commission'}
        description={about?.subtitle ?? `Profile, mandate, functions and responsibilities of the ${COMMISSION.name}.`}
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'The Commission' }]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="card-header"><h2 className="card-title">Profile</h2></div>
            <CardBody>
              {about ? <RichText body={about.body} /> : <p className="text-sm text-slate-600">Content pending publication.</p>}
            </CardBody>
          </Card>

          <Card id="mandate">
            <div className="card-header"><h2 className="card-title">{mandate?.title ?? 'Mandate'}</h2></div>
            <CardBody>
              {mandate ? <RichText body={mandate.body} /> : <p className="text-sm text-slate-600">Content pending publication.</p>}
            </CardBody>
          </Card>

          <Card id="functions">
            <div className="card-header"><h2 className="card-title">{functions?.title ?? 'Functions and Responsibilities'}</h2></div>
            <CardBody>
              {functions ? <RichText body={functions.body} /> : <p className="text-sm text-slate-600">Content pending publication.</p>}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          {vision ? (
            <Card>
              <div className="card-header"><h2 className="card-title">{vision.title}</h2></div>
              <CardBody><RichText body={vision.body} /></CardBody>
            </Card>
          ) : null}
          <Card>
            <div className="card-header"><h2 className="card-title">Contact</h2></div>
            <CardBody className="space-y-2 text-sm text-slate-700">
              <p>{COMMISSION.address}</p>
              <p><span className="font-medium">Telephone:</span> {COMMISSION.phone}</p>
              <p><span className="font-medium">Email:</span> {COMMISSION.email}</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
