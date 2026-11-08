import { requirePagePermission } from '@/lib/page-guards';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { Card, CardBody, PageHeading } from '@/components/ui';
import { ArticleForm } from '../forms';

export const metadata = { title: 'New Item' };

export default async function NewArticlePage() {
  const user = await requirePagePermission(PERMISSIONS.CONTENT_MANAGE);
  const canPublish = hasPermission(user, PERMISSIONS.CONTENT_PUBLISH);
  return (
    <>
      <PageHeading
        title="New Item"
        description="Create a news item, official announcement, circular, public notice or recruitment notice."
        breadcrumb={[{ label: 'News & Notices', href: '/admin/content' }, { label: 'New' }]}
      />
      <Card className="max-w-4xl">
        <div className="card-header"><h2 className="card-title">Item details</h2></div>
        <CardBody><ArticleForm mode="create" canPublish={canPublish} /></CardBody>
      </Card>
    </>
  );
}
