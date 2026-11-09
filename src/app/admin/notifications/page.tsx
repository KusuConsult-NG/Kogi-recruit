import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { formatDateTime } from '@/lib/format';
import {
  Card, CardBody, PageHeading, StatCard, StatusBadge, readable,
} from '@/components/ui';
import { BatchActionForm, BatchForm, DirectForm } from './forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Notifications' };

/** Module 7 - notification and communication. */
export default async function NotificationsAdmin() {
  const user = await requirePagePermission(PERMISSIONS.NOTIFICATION_SEND);
  const canApprove = hasPermission(user, PERMISSIONS.NOTIFICATION_APPROVE);

  const [batches, recent, exercises, applicants, stats] = await Promise.all([
    prisma.notificationBatch.findMany({ orderBy: { createdAt: 'desc' }, take: 25 }),
    prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: { user: { select: { fullName: true } } },
    }),
    prisma.recruitmentExercise.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, reference: true, title: true },
    }),
    prisma.user.findMany({
      where: { role: 'APPLICANT', active: true },
      orderBy: { fullName: 'asc' },
      take: 500,
      select: { id: true, fullName: true, email: true, applicantProfile: { select: { applicantRef: true } } },
    }),
    Promise.all([
      prisma.notification.count(),
      prisma.notification.count({ where: { status: 'SENT' } }),
      prisma.notification.count({ where: { status: 'FAILED' } }),
      prisma.notification.count({ where: { channel: 'SMS' } }),
    ]),
  ]);

  const [total, sent, failed, smsCount] = stats;

  return (
    <>
      <PageHeading
        title="Notifications and Communication"
        description="Send acknowledgements, status updates, examination and interview invitations, correction requests, announcements and administrative alerts by email and SMS."
        actions={
          canApprove ? (
            <Link href="/admin/notifications/templates" className="btn-secondary btn-sm">Message templates</Link>
          ) : undefined
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Messages recorded" value={total.toLocaleString('en-NG')} />
        <StatCard label="Delivered" value={sent.toLocaleString('en-NG')} tone="green" />
        <StatCard label="Delivery failures" value={failed} tone={failed ? 'red' : 'default'} />
        <StatCard label="SMS messages" value={smsCount} hint="Gateway charges are billed separately" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <div className="card-header">
              <h2 className="card-title">Notification batches</h2>
              <span className="badge-slate">{batches.length}</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Batch</th><th>Channel</th><th>Recipients</th><th>Delivered</th>
                    <th>Failed</th><th>Status</th><th>Created</th><th></th></tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <p className="font-medium text-ink-950">{b.title}</p>
                        <p className="text-xs text-ink-500">{b.subject}</p>
                      </td>
                      <td><span className="badge-slate">{readable(b.channel)}</span></td>
                      <td>{b.totalCount}</td>
                      <td>{b.sentCount}</td>
                      <td className={b.failedCount ? 'font-semibold text-[#9a2c20]' : ''}>{b.failedCount}</td>
                      <td><StatusBadge status={b.status} /></td>
                      <td className="whitespace-nowrap text-xs">{formatDateTime(b.createdAt)}</td>
                      <td className="whitespace-nowrap">
                        {['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(b.status) ? (
                          <>
                            <BatchActionForm batchId={b.id} decision="SEND"
                              label={canApprove ? 'Approve and send' : 'Submit for approval'}
                              tone="btn-primary"
                              confirm={canApprove ? `Send this batch to ${b.totalCount} recipient(s)? This cannot be undone.` : undefined} />
                            {canApprove ? (
                              <span className="ml-1">
                                <BatchActionForm batchId={b.id} decision="REJECT" label="Reject" />
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-xs text-ink-400">
                            {b.sentAt ? formatDateTime(b.sentAt) : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {batches.length === 0 ? (
                    <tr><td colSpan={8} className="py-6 text-center text-sm text-ink-500">
                      No batches prepared yet.
                    </td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <div className="card-header">
              <h2 className="card-title">Delivery history</h2>
              <span className="badge-slate">latest {recent.length}</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Recipient</th><th>Channel</th><th>Subject</th><th>Status</th><th>Sent</th><th>Problem</th></tr>
                </thead>
                <tbody>
                  {recent.map((n) => (
                    <tr key={n.id}>
                      <td className="text-xs">
                        <p className="font-medium text-ink-950">{n.user?.fullName ?? n.toAddress ?? '—'}</p>
                        <p className="text-ink-500">{n.toAddress}</p>
                      </td>
                      <td><span className="badge-slate">{readable(n.channel)}</span></td>
                      <td className="max-w-xs truncate text-xs">{n.subject}</td>
                      <td><StatusBadge status={n.status} /></td>
                      <td className="whitespace-nowrap text-xs">{n.sentAt ? formatDateTime(n.sentAt) : '—'}</td>
                      <td className="max-w-[12rem] truncate text-xs text-[#9a2c20]">{n.error ?? ''}</td>
                    </tr>
                  ))}
                  {recent.length === 0 ? (
                    <tr><td colSpan={6} className="py-6 text-center text-sm text-ink-500">No messages recorded.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="card-header"><h2 className="card-title">Prepare a batch</h2></div>
            <CardBody>
              <BatchForm exercises={exercises.map((e) => ({ id: e.id, label: `${e.reference} — ${e.title}` }))} />
            </CardBody>
          </Card>

          <Card>
            <div className="card-header"><h2 className="card-title">Message a single applicant</h2></div>
            <CardBody>
              <DirectForm
                applicants={applicants.map((a) => ({
                  id: a.id,
                  label: `${a.fullName}${a.applicantProfile ? ` (${a.applicantProfile.applicantRef})` : ''}`,
                }))}
              />
            </CardBody>
          </Card>

          <Card>
            <div className="card-header"><h2 className="card-title">About SMS</h2></div>
            <CardBody className="text-xs leading-relaxed text-ink-600">
              SMS is delivered through an approved gateway configured in the environment. SMS
              transaction charges are separate from the product cost unless expressly included in the
              final contract. Delivery records are retained wherever the gateway supports them.
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
