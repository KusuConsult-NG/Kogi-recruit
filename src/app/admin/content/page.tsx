import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { ARTICLE_TYPES } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { Card, EmptyState, PageHeading, StatCard, StatusBadge, Tabs } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'News and Notices' };

/** Module 1 - content register. */
export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const user = await requirePagePermission(PERMISSIONS.CONTENT_VIEW);
  const canManage = hasPermission(user, PERMISSIONS.CONTENT_MANAGE);

  const where = {
    ...(sp.status && sp.status !== 'ALL' ? { status: sp.status } : {}),
    ...(sp.type ? { type: sp.type } : {}),
  };

  const [articles, counts] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        author: { select: { fullName: true } },
        _count: { select: { attachments: true } },
      },
    }),
    prisma.article.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const total = counts.reduce((s, c) => s + c._count._all, 0);
  const base = `/admin/content?${sp.type ? `type=${sp.type}&` : ''}`;

  return (
    <>
      <PageHeading
        title="News, Announcements and Notices"
        description="Publish approved information to the public portal without developer intervention. Items follow a draft, approval and publication workflow."
        actions={canManage ? <Link href="/admin/content/new" className="btn-primary btn-sm">New item</Link> : undefined}
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Published" value={countOf('PUBLISHED')} tone="green" />
        <StatCard label="Awaiting approval" value={countOf('PENDING_APPROVAL')} tone={countOf('PENDING_APPROVAL') ? 'amber' : 'default'} />
        <StatCard label="Drafts" value={countOf('DRAFT')} />
        <StatCard label="All items" value={total} />
      </div>

      <Card className="mb-5">
        <form method="get" className="flex flex-wrap items-end gap-3 p-4">
          <input type="hidden" name="status" value={sp.status ?? 'ALL'} />
          <label className="flex-1 min-w-[14rem]">
            <span className="label">Category</span>
            <select name="type" defaultValue={sp.type ?? ''} className="select">
              <option value="">All categories</option>
              {ARTICLE_TYPES.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
            </select>
          </label>
          <button type="submit" className="btn-primary btn-sm">Apply</button>
          <Link href="/admin/content" className="btn-ghost btn-sm">Reset</Link>
        </form>
      </Card>

      <Tabs
        active={`${base}status=${sp.status ?? 'ALL'}`}
        tabs={[
          { label: 'All', href: `${base}status=ALL`, count: total },
          { label: 'Draft', href: `${base}status=DRAFT`, count: countOf('DRAFT') },
          { label: 'Awaiting approval', href: `${base}status=PENDING_APPROVAL`, count: countOf('PENDING_APPROVAL') },
          { label: 'Published', href: `${base}status=PUBLISHED`, count: countOf('PUBLISHED') },
          { label: 'Rejected', href: `${base}status=REJECTED`, count: countOf('REJECTED') },
          { label: 'Archived', href: `${base}status=ARCHIVED`, count: countOf('ARCHIVED') },
        ]}
      />

      {articles.length === 0 ? (
        <EmptyState title="No items found"
          action={canManage ? <Link href="/admin/content/new" className="btn-primary btn-sm">Create an item</Link> : undefined} />
      ) : (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Title</th><th>Category</th><th>Status</th><th>Author</th>
                  <th>Attachments</th><th>Views</th><th>Last updated</th><th></th></tr>
              </thead>
              <tbody>
                {articles.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/admin/content/${a.id}`} className="font-medium text-kogi-700 hover:underline">
                        {a.title}
                      </Link>
                      {a.approvalNote ? <p className="mt-0.5 text-xs text-red-700">{a.approvalNote}</p> : null}
                    </td>
                    <td><span className="badge-slate">{a.type.replace(/_/g, ' ').toLowerCase()}</span></td>
                    <td><StatusBadge status={a.status} /></td>
                    <td className="text-xs">{a.author?.fullName ?? '—'}</td>
                    <td>{a._count.attachments}</td>
                    <td>{a.viewCount}</td>
                    <td className="whitespace-nowrap text-xs">{formatDateTime(a.updatedAt)}</td>
                    <td className="whitespace-nowrap">
                      <Link href={`/admin/content/${a.id}`} className="btn-secondary btn-sm">Open</Link>
                      {a.status === 'PUBLISHED' ? (
                        <Link href={`/news/${a.slug}`} target="_blank" className="btn-ghost btn-sm">View</Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
