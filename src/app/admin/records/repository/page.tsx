import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { ROLES } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { formatBytes } from '@/lib/storage';
import {
  Alert, Card, CardBody, PageHeading, StatCard, StatusBadge, readable,
} from '@/components/ui';
import { deleteRepositoryDocument } from '@/actions/records';
import { RepositoryForm } from '../forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Document Repository' };

/** Module 4 - Commission document repository with records classification. */
export default async function RepositoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; classification?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const user = await requirePagePermission(PERMISSIONS.ADMIN_RECORDS);
  const canSeeRestricted =
    user.role === ROLES.SUPER_ADMIN || hasPermission(user, PERMISSIONS.AUDIT_VIEW_SENSITIVE);

  const [documents, counts] = await Promise.all([
    prisma.repositoryDocument.findMany({
      where: {
        ...(canSeeRestricted ? {} : { classification: { not: 'RESTRICTED' } }),
        ...(sp.classification ? { classification: sp.classification } : {}),
        ...(sp.category ? { category: sp.category } : {}),
        ...(sp.q
          ? { OR: [{ title: { contains: sp.q } }, { description: { contains: sp.q } }, { tags: { contains: sp.q } }] }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { uploadedBy: { select: { fullName: true } } },
    }),
    prisma.repositoryDocument.groupBy({ by: ['classification'], _count: { _all: true } }),
  ]);

  const countOf = (c: string) => counts.find((x) => x.classification === c)?._count._all ?? 0;

  return (
    <>
      <PageHeading
        title="Commission Document Repository"
        description="A structured digital repository for Commission records, with classification, tagging, search and retrieval. Every access is logged in the audit trail."
      />

      {!canSeeRestricted ? (
        <div className="mb-5">
          <Alert tone="info">Restricted records are not shown to your role.</Alert>
        </div>
      ) : null}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="General" value={countOf('GENERAL')} />
        <StatCard label="Confidential" value={countOf('CONFIDENTIAL')} tone="amber" />
        <StatCard label="Restricted" value={canSeeRestricted ? countOf('RESTRICTED') : 'restricted'} tone="red" />
        <StatCard label="Storage used" value={formatBytes(documents.reduce((s, d) => s + d.sizeBytes, 0))} />
      </div>

      <Card className="mb-5">
        <form method="get" className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-4">
          <input name="q" defaultValue={sp.q} placeholder="Title, description or tag…" className="input" aria-label="Search" />
          <select name="classification" defaultValue={sp.classification ?? ''} className="select" aria-label="Classification">
            <option value="">All classifications</option>
            <option value="GENERAL">General</option>
            <option value="CONFIDENTIAL">Confidential</option>
            {canSeeRestricted ? <option value="RESTRICTED">Restricted</option> : null}
          </select>
          <select name="category" defaultValue={sp.category ?? ''} className="select" aria-label="Category">
            <option value="">All categories</option>
            {['RECORD', 'CIRCULAR', 'POLICY', 'MINUTES', 'REPORT', 'CORRESPONDENCE', 'PERSONNEL'].map((c) => (
              <option key={c} value={c}>{c.toLowerCase()}</option>
            ))}
          </select>
          <button type="submit" className="btn-primary btn-sm">Search</button>
        </form>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card>
            <div className="card-header">
              <h2 className="card-title">Filed documents</h2>
              <span className="badge-slate">{documents.length}</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Title</th><th>Category</th><th>Classification</th><th>Tags</th>
                    <th>Size</th><th>Filed by</th><th>Filed</th><th></th></tr>
                </thead>
                <tbody>
                  {documents.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <p className="font-medium text-ink-950">{d.title}</p>
                        {d.description ? <p className="max-w-sm text-xs text-ink-500">{d.description}</p> : null}
                      </td>
                      <td><span className="badge-slate">{readable(d.category)}</span></td>
                      <td><StatusBadge status={d.classification} /></td>
                      <td className="max-w-[10rem] text-xs">{d.tags ?? '—'}</td>
                      <td className="whitespace-nowrap text-xs">{formatBytes(d.sizeBytes)}</td>
                      <td className="text-xs">{d.uploadedBy?.fullName ?? '—'}</td>
                      <td className="whitespace-nowrap text-xs">{formatDateTime(d.createdAt)}</td>
                      <td className="whitespace-nowrap">
                        <a href={`/api/files/repository/${d.id}`} target="_blank" rel="noopener" className="btn-secondary btn-sm">
                          Open
                        </a>
                        <form action={deleteRepositoryDocument} className="inline">
                          <input type="hidden" name="id" value={d.id} />
                          <button type="submit" className="btn-ghost btn-sm text-[#9a2c20]">Delete</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {documents.length === 0 ? (
                    <tr><td colSpan={8} className="py-6 text-center text-sm text-ink-500">No documents filed.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <Card>
          <div className="card-header"><h2 className="card-title">File a document</h2></div>
          <CardBody><RepositoryForm /></CardBody>
        </Card>
      </div>
    </>
  );
}
