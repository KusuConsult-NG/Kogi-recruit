import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePageApplicant } from '@/lib/page-guards';
import { formatDateTime } from '@/lib/format';
import { formatBytes } from '@/lib/storage';
import { Alert, Card, EmptyState, PageHeading, StatCard, StatusBadge } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My Documents' };

/** Module 2.4 - applicant view of every uploaded document and its review status. */
export default async function DocumentsPage() {
  const user = await requirePageApplicant();

  const documents = await prisma.applicantDocument.findMany({
    where: { application: { applicantId: user.id } },
    orderBy: { createdAt: 'desc' },
    include: {
      application: {
        select: { id: true, reference: true, status: true, exercise: { select: { title: true } } },
      },
      reviews: { orderBy: { createdAt: 'desc' }, take: 3 },
    },
  });

  const counts = {
    total: documents.length,
    verified: documents.filter((d) => d.reviewStatus === 'VERIFIED').length,
    pending: documents.filter((d) => d.reviewStatus === 'PENDING').length,
    rejected: documents.filter((d) => ['REJECTED', 'RESUBMISSION_REQUIRED'].includes(d.reviewStatus)).length,
  };

  return (
    <>
      <PageHeading
        title="My Documents"
        description="Every document you have uploaded, with its verification status and any officer remarks."
        breadcrumb={[{ label: 'Dashboard', href: '/portal' }, { label: 'My Documents' }]}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total uploaded" value={counts.total} />
        <StatCard label="Verified" value={counts.verified} tone="green" />
        <StatCard label="Awaiting review" value={counts.pending} tone="amber" />
        <StatCard label="Need correction" value={counts.rejected} tone={counts.rejected ? 'red' : 'default'} />
      </div>

      {counts.rejected > 0 ? (
        <div className="mb-6">
          <Alert tone="warning" title="Some documents need correction">
            Open the affected application and upload a corrected copy of each document listed below.
          </Alert>
        </div>
      ) : null}

      {documents.length === 0 ? (
        <EmptyState
          title="No documents uploaded"
          description="Documents are uploaded within each application."
          action={<Link href="/portal/applications" className="btn-primary btn-sm">Go to my applications</Link>}
        />
      ) : (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Application</th>
                  <th>File</th>
                  <th>Status</th>
                  <th>Officer remarks</th>
                  <th>Uploaded</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.id}>
                    <td className="font-medium text-slate-900">
                      {d.label}
                      {d.version > 1 ? <span className="ml-1.5 badge-slate">v{d.version}</span> : null}
                    </td>
                    <td className="text-xs">
                      <Link href={`/portal/applications/${d.application.id}`} className="text-kogi-700 underline">
                        {d.application.reference}
                      </Link>
                      <p className="mt-0.5 text-slate-500">{d.application.exercise.title}</p>
                    </td>
                    <td className="text-xs">
                      {d.originalName}
                      <p className="mt-0.5 text-slate-500">{formatBytes(d.sizeBytes)}</p>
                    </td>
                    <td><StatusBadge status={d.reviewStatus} /></td>
                    <td className="max-w-xs text-xs">
                      {d.reviewNotes ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="whitespace-nowrap text-xs">{formatDateTime(d.createdAt)}</td>
                    <td>
                      <a href={`/api/files/document/${d.id}`} target="_blank" rel="noopener" className="btn-secondary btn-sm">
                        View
                      </a>
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
