import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePageApplicant } from '@/lib/page-guards';
import { APPLICATION_STATUS_LABELS } from '@/lib/constants';
import { formatDate, formatDateTime } from '@/lib/format';
import { Alert, Card, EmptyState, PageHeading, ProgressBar, StatusBadge } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My Applications' };

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; withdrawn?: string }>;
}) {
  const sp = await searchParams;
  const user = await requirePageApplicant();

  const applications = await prisma.application.findMany({
    where: { applicantId: user.id, ...(sp.status ? { status: sp.status } : {}) },
    orderBy: { createdAt: 'desc' },
    include: {
      exercise: { select: { title: true, reference: true, closesAt: true } },
      vacancy: { select: { jobTitle: true, gradeLevel: true } },
      documents: { select: { reviewStatus: true } },
    },
  });

  return (
    <>
      <PageHeading
        title="My Applications"
        description="Every application you have started or submitted, with its current status and document review progress."
        breadcrumb={[{ label: 'Dashboard', href: '/portal' }, { label: 'My Applications' }]}
        actions={<Link href="/recruitment" className="btn-primary btn-sm">Apply for a vacancy</Link>}
      />
      {sp.withdrawn ? (
        <div className="mb-6"><Alert tone="info">Your application has been withdrawn.</Alert></div>
      ) : null}

      {applications.length === 0 ? (
        <EmptyState
          title="No applications found"
          description={sp.status ? 'No applications match that status.' : 'Start by browsing the open recruitment exercises.'}
          action={<Link href="/recruitment" className="btn-primary btn-sm">Browse vacancies</Link>}
        />
      ) : (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Exercise</th>
                  <th>Position</th>
                  <th>Status</th>
                  <th>Completeness</th>
                  <th>Documents</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => {
                  const rejected = app.documents.filter((d) =>
                    ['REJECTED', 'RESUBMISSION_REQUIRED'].includes(d.reviewStatus),
                  ).length;
                  const verified = app.documents.filter((d) => d.reviewStatus === 'VERIFIED').length;
                  return (
                    <tr key={app.id}>
                      <td className="whitespace-nowrap font-mono text-xs">{app.reference}</td>
                      <td>
                        <p className="font-medium text-slate-900">{app.exercise.title}</p>
                        <p className="text-xs text-slate-500">{app.exercise.reference} · closes {formatDate(app.exercise.closesAt)}</p>
                      </td>
                      <td className="text-xs">
                        {app.vacancy ? `${app.vacancy.jobTitle} (${app.vacancy.gradeLevel})` : '—'}
                      </td>
                      <td><StatusBadge status={app.status} label={APPLICATION_STATUS_LABELS[app.status]} /></td>
                      <td className="w-32"><ProgressBar value={app.completeness} tone={app.completeness >= 100 ? 'green' : 'amber'} /></td>
                      <td className="whitespace-nowrap text-xs">
                        {app.documents.length === 0 ? (
                          <span className="text-slate-400">None</span>
                        ) : (
                          <>
                            {verified}/{app.documents.length} verified
                            {rejected > 0 ? <span className="mt-0.5 block font-semibold text-amber-700">{rejected} to correct</span> : null}
                          </>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-xs">{formatDateTime(app.submittedAt)}</td>
                      <td>
                        <Link href={`/portal/applications/${app.id}`} className="btn-secondary btn-sm">Open</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
