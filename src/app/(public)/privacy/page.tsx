import { prisma } from '@/lib/db';
import { COMMISSION } from '@/lib/constants';
import { Card, CardBody, PageHeading } from '@/components/ui';
import { RichText } from '@/components/rich-text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Privacy Notice' };

export default async function PrivacyPage() {
  const page = await prisma.pageContent.findUnique({ where: { slug: 'privacy' } });
  return (
    <div className="container-page py-10">
      <PageHeading
        eyebrow="Information"
        title={page?.title ?? 'Privacy Notice'}
        description={page?.subtitle ?? 'How the Commission processes personal information submitted through this portal.'}
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Privacy Notice' }]}
      />
      <Card className="max-w-4xl">
        <CardBody>
          {page ? (
            <RichText body={page.body} />
          ) : (
            <div className="prose-content">
              <p>
                The {COMMISSION.name} processes personal information submitted through this portal in
                accordance with the Nigeria Data Protection Act 2023.
              </p>
              <p>
                Applicant personal information is not publicly accessible merely because it has been
                submitted through this portal. Access is restricted to authorised officers acting
                within their assigned roles, and all access is recorded in the system audit trail.
              </p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
