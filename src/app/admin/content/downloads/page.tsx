import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { PERMISSIONS } from '@/lib/rbac';
import { formatDateTime } from '@/lib/format';
import { formatBytes } from '@/lib/storage';
import { Card, CardBody, PageHeading, StatCard } from '@/components/ui';
import { deleteDownload } from '@/actions/content';
import { DownloadForm } from '../forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Downloads' };

export default async function DownloadsAdmin() {
  await requirePagePermission(PERMISSIONS.CONTENT_MANAGE);
  const items = await prisma.downloadItem.findMany({ orderBy: { createdAt: 'desc' } });

  return (
    <>
      <PageHeading
        title="Forms, Guidelines and Publications"
        description="Publish approved forms, guidelines, publications and circulars for download from the public portal."
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Documents" value={items.length} />
        <StatCard label="Published" value={items.filter((i) => i.published).length} tone="green" />
        <StatCard label="Total downloads" value={items.reduce((s, i) => s + i.downloads, 0)} />
        <StatCard label="Storage used" value={formatBytes(items.reduce((s, i) => s + i.sizeBytes, 0))} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card>
            <div className="card-header"><h2 className="card-title">Published documents</h2></div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Title</th><th>Category</th><th>File</th><th>Downloads</th><th>Published</th><th>Added</th><th></th></tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <p className="font-medium text-slate-900">{i.title}</p>
                        {i.description ? <p className="text-xs text-slate-500">{i.description}</p> : null}
                      </td>
                      <td><span className="badge-slate">{i.category.toLowerCase()}</span></td>
                      <td className="text-xs">
                        <a href={`/api/files/download/${i.id}`} className="text-kogi-700 underline">{i.originalName}</a>
                        <p className="text-slate-500">{formatBytes(i.sizeBytes)}</p>
                      </td>
                      <td>{i.downloads}</td>
                      <td>{i.published ? <span className="badge-green">yes</span> : <span className="badge-slate">no</span>}</td>
                      <td className="whitespace-nowrap text-xs">{formatDateTime(i.createdAt)}</td>
                      <td>
                        <form action={deleteDownload}>
                          <input type="hidden" name="id" value={i.id} />
                          <button type="submit" className="btn-ghost btn-sm text-red-700">Remove</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 ? (
                    <tr><td colSpan={7} className="py-6 text-center text-sm text-slate-500">No documents published.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        <Card>
          <div className="card-header"><h2 className="card-title">Publish a document</h2></div>
          <CardBody><DownloadForm /></CardBody>
        </Card>
      </div>
    </>
  );
}
