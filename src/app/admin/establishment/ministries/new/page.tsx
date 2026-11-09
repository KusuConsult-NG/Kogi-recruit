import { requirePagePermission } from '@/lib/page-guards';
import { PERMISSIONS } from '@/lib/rbac';
import { Card, CardBody, CardHeader, PageHeading } from '@/components/ui';
import { MinistryForm } from '../../forms';

export const metadata = { title: 'Add an MDA' };

export default async function NewMinistryPage() {
  await requirePagePermission(PERMISSIONS.MDA_MANAGE);
  return (
    <>
      <PageHeading
        eyebrow="Establishment"
        title="Add a ministry, department or agency"
        description="Record the MDA that carries the approved posts. Vacancies cannot be advertised until the employing MDA is on the register."
        breadcrumb={[
          { label: 'Administration', href: '/admin' },
          { label: 'Ministries & Agencies', href: '/admin/establishment/ministries' },
          { label: 'New' },
        ]}
      />
      <div className="max-w-4xl">
        <Card>
          <CardHeader title="Establishment record" />
          <CardBody>
            <MinistryForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
