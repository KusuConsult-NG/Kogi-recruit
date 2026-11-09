import { prisma } from '@/lib/db';
import { requirePageApplicant } from '@/lib/page-guards';
import { formatDateTime } from '@/lib/format';
import {
  Card, CardBody, EmptyState, PageHeading, StatusBadge, readable,
} from '@/components/ui';
import { markAllNotificationsRead, markNotificationRead } from '@/actions/applications';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Notifications' };

/** Module 7 - applicant notification history. */
export default async function NotificationsPage() {
  const user = await requirePageApplicant();
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeading
        title="Notifications"
        description="Every message the Commission has sent you about your applications, by email, SMS or in-portal."
        breadcrumb={[{ label: 'Dashboard', href: '/portal' }, { label: 'Notifications' }]}
        actions={
          unread > 0 ? (
            <form action={markAllNotificationsRead}>
              <button type="submit" className="btn-secondary btn-sm">Mark all as read ({unread})</button>
            </form>
          ) : undefined
        }
      />

      {notifications.length === 0 ? (
        <EmptyState
          title="No notifications yet"
          description="You will be notified here when your application status changes, and when examination or interview invitations are issued."
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <Card key={n.id} className={n.readAt ? '' : 'border-l-4 border-l-kogi-600'}>
              <CardBody>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className={`text-sm ${n.readAt ? 'font-medium text-ink-800' : 'font-bold text-ink-950'}`}>
                        {n.subject}
                      </h2>
                      <span className="badge-slate">{readable(n.channel)}</span>
                      <StatusBadge status={n.status} />
                      {!n.readAt ? <span className="badge-green">new</span> : null}
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-700">{n.body}</p>
                    <p className="mt-2 text-xs text-ink-500">
                      {formatDateTime(n.createdAt)}
                      {n.sentAt ? ` · delivered ${formatDateTime(n.sentAt)}` : ''}
                      {n.error ? ` · delivery problem: ${n.error}` : ''}
                    </p>
                  </div>
                  {!n.readAt ? (
                    <form action={markNotificationRead}>
                      <input type="hidden" name="notificationId" value={n.id} />
                      <button type="submit" className="btn-ghost btn-sm">Mark read</button>
                    </form>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
