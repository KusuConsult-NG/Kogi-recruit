import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { formatDateTime } from '@/lib/format';
import { formatBytes } from '@/lib/storage';
import { Alert, Card, CardBody, DescriptionList, PageHeading, StatusBadge } from '@/components/ui';
import { deleteArticle, deleteArticleAttachment } from '@/actions/content';
import { ArticleForm, ArticleStatusForm } from '../forms';

export const dynamic = 'force-dynamic';

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission(PERMISSIONS.CONTENT_VIEW);
  const canManage = hasPermission(user, PERMISSIONS.CONTENT_MANAGE);
  const canPublish = hasPermission(user, PERMISSIONS.CONTENT_PUBLISH);

  const article = await prisma.article.findUnique({
    where: { id },
    include: { attachments: true, author: { select: { fullName: true } } },
  });
  if (!article) notFound();

  return (
    <>
      <PageHeading
        title={article.title}
        description={`${article.type.replace(/_/g, ' ').toLowerCase()} · last updated ${formatDateTime(article.updatedAt)}`}
        breadcrumb={[{ label: 'News & Notices', href: '/admin/content' }, { label: article.title.slice(0, 40) }]}
        actions={
          <>
            <StatusBadge status={article.status} />
            {article.status === 'PUBLISHED' ? (
              <Link href={`/news/${article.slug}`} target="_blank" className="btn-ghost btn-sm">View public page</Link>
            ) : null}
          </>
        }
      />

      {article.approvalNote ? (
        <div className="mb-5"><Alert tone="warning" title="Approval note">{article.approvalNote}</Alert></div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card>
            <div className="card-header"><h2 className="card-title">Item content</h2></div>
            <CardBody>
              {canManage ? (
                <ArticleForm
                  mode="edit"
                  canPublish={canPublish}
                  initial={{
                    id: article.id,
                    type: article.type,
                    title: article.title,
                    summary: article.summary ?? '',
                    body: article.body,
                    publishedAt: article.publishedAt ? article.publishedAt.toISOString().slice(0, 10) : '',
                  }}
                />
              ) : (
                <pre className="whitespace-pre-wrap text-sm text-slate-700">{article.body}</pre>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="card-header"><h2 className="card-title">Publication</h2></div>
            <CardBody className="space-y-3">
              <DescriptionList
                columns={1}
                items={[
                  { label: 'Status', value: <StatusBadge status={article.status} /> },
                  { label: 'Author', value: article.author?.fullName ?? '—' },
                  { label: 'Created', value: formatDateTime(article.createdAt) },
                  { label: 'Published', value: article.publishedAt ? formatDateTime(article.publishedAt) : '—' },
                  { label: 'Public URL', value: article.status === 'PUBLISHED' ? `/news/${article.slug}` : 'Not published' },
                  { label: 'Views', value: article.viewCount },
                ]}
              />
              <div className="space-y-2 border-t border-slate-200 pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</p>
                {article.status === 'DRAFT' && canManage && !canPublish ? (
                  <ArticleStatusForm id={article.id} to="PENDING_APPROVAL" label="Submit for approval" tone="btn-primary" />
                ) : null}
                {['DRAFT', 'PENDING_APPROVAL', 'ARCHIVED'].includes(article.status) && canPublish ? (
                  <ArticleStatusForm id={article.id} to="PUBLISHED" label="Publish to the portal" tone="btn-primary"
                    confirm="Publish this item to the public portal?" />
                ) : null}
                {article.status === 'PENDING_APPROVAL' && canPublish ? (
                  <ArticleStatusForm id={article.id} to="REJECTED" label="Reject" requireNote />
                ) : null}
                {article.status === 'PUBLISHED' && canManage ? (
                  <>
                    <ArticleStatusForm id={article.id} to="DRAFT" label="Unpublish (return to draft)" />
                    <ArticleStatusForm id={article.id} to="ARCHIVED" label="Archive" />
                  </>
                ) : null}
                {['REJECTED', 'ARCHIVED'].includes(article.status) && canManage ? (
                  <ArticleStatusForm id={article.id} to="DRAFT" label="Return to draft" />
                ) : null}
                {canPublish ? (
                  <form action={deleteArticle}
                    onSubmit={undefined}>
                    <input type="hidden" name="id" value={article.id} />
                    <button type="submit" className="btn-danger btn-sm w-full">Delete item permanently</button>
                  </form>
                ) : null}
              </div>
            </CardBody>
          </Card>

          <Card>
            <div className="card-header">
              <h2 className="card-title">Attachments</h2>
              <span className="badge-slate">{article.attachments.length}</span>
            </div>
            <CardBody>
              {article.attachments.length === 0 ? (
                <p className="text-sm text-slate-600">No attachments. Add them from the form on the left.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {article.attachments.map((att) => (
                    <li key={att.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                      <div>
                        <a href={`/api/files/article/${att.id}`} target="_blank" rel="noopener"
                          className="text-sm font-medium text-kogi-700 underline">
                          {att.label}
                        </a>
                        <p className="text-xs text-slate-500">{formatBytes(att.sizeBytes)}</p>
                      </div>
                      {canManage ? (
                        <form action={deleteArticleAttachment}>
                          <input type="hidden" name="id" value={att.id} />
                          <button type="submit" className="btn-ghost btn-sm text-red-700">Remove</button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
