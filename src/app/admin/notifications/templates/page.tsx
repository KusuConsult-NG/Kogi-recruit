import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { PERMISSIONS } from '@/lib/rbac';
import { DEFAULT_TEMPLATES } from '@/lib/notifications';
import { formatDateTime } from '@/lib/format';
import { Card, CardBody, PageHeading } from '@/components/ui';
import { resetTemplate } from '@/actions/comms';
import { TemplateForm } from '../forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Message Templates' };

/** Module 7 - notification template management. */
export default async function TemplatesPage() {
  await requirePagePermission(PERMISSIONS.NOTIFICATION_APPROVE);
  const stored = await prisma.notificationTemplate.findMany();
  const byCode = new Map(stored.map((t) => [t.code, t]));

  return (
    <>
      <PageHeading
        title="Message Templates"
        description="The wording used for every automated notification the portal sends. Edited templates override the system defaults; reset a template to restore its default wording."
        breadcrumb={[{ label: 'Notifications', href: '/admin/notifications' }, { label: 'Templates' }]}
      />
      <div className="space-y-6">
        {Object.entries(DEFAULT_TEMPLATES).map(([code, fallback]) => {
          const record = byCode.get(code);
          return (
            <Card key={code}>
              <div className="card-header">
                <div>
                  <h2 className="card-title">{fallback.name}</h2>
                  <p className="mt-0.5 font-mono text-xs text-ink-500">{code}</p>
                </div>
                <div className="flex items-center gap-2">
                  {record ? (
                    <>
                      <span className="badge-blue">customised</span>
                      <span className="text-2xs text-ink-500">
                        {formatDateTime(record.updatedAt)}
                      </span>
                      <form action={resetTemplate}>
                        <input type="hidden" name="code" value={code} />
                        <button type="submit" className="btn-ghost btn-sm">Reset to default</button>
                      </form>
                    </>
                  ) : (
                    <span className="badge-slate">system default</span>
                  )}
                </div>
              </div>
              <CardBody>
                <TemplateForm
                  code={code}
                  channel={record?.channel ?? fallback.channel}
                  subject={record?.subject ?? fallback.subject}
                  body={record?.body ?? fallback.body}
                  active={record?.active ?? true}
                  variables={fallback.variables}
                />
              </CardBody>
            </Card>
          );
        })}
      </div>
    </>
  );
}
