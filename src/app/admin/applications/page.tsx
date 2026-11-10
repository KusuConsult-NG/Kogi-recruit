import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { PERMISSIONS } from '@/lib/rbac';
import { APPLICATION_STATUS, APPLICATION_STATUS_LABELS } from '@/lib/constants';
import { formatDate, formatDateTime } from '@/lib/format';
import { Card, EmptyState, PageHeading, Pagination, StatusBadge } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Applications' };

const PAGE_SIZE = 25;

/** Module 2.3 - application register with filtering and search. */
export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ exercise?: string; status?: string; q?: string; vacancy?: string; page?: string }>;
}) {
  const sp = await searchParams;
  await requirePagePermission(PERMISSIONS.APPLICATION_VIEW);
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const where = {
    ...(sp.exercise ? { exerciseId: sp.exercise } : {}),
    ...(sp.vacancy ? { vacancyId: sp.vacancy } : {}),
    ...(sp.status && sp.status !== 'ALL' ? { status: sp.status } : {}),
    ...(sp.q
      ? {
          OR: [
            { reference: { contains: sp.q } },
            { applicant: { fullName: { contains: sp.q } } },
            { applicant: { email: { contains: sp.q } } },
            { applicant: { applicantProfile: { applicantRef: { contains: sp.q } } } },
          ],
        }
      : {}),
  };

  const [total, applications, exercises, statusCounts] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.findMany({
      where,
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        exercise: { select: { title: true, reference: true } },
        vacancy: { select: { jobTitle: true, gradeLevel: true } },
        applicant: {
          select: {
            fullName: true, email: true,
            applicantProfile: { select: { applicantRef: true, lga: true, gender: true } },
          },
        },
        documents: { select: { reviewStatus: true } },
        assignments: { include: { officer: { select: { fullName: true } } } },
      },
    }),
    prisma.recruitmentExercise.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, title: true, reference: true } }),
    prisma.application.groupBy({
      by: ['status'],
      where: sp.exercise ? { exerciseId: sp.exercise } : {},
      _count: { _all: true },
    }),
  ]);

  const pageCount = Math.ceil(total / PAGE_SIZE);
  const countOf = (s: string) => statusCounts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <>
      <PageHeading
        title="Applications"
        description="Every application received, with screening assignment, document review progress and current stage."
        actions={
          <Link
            href={`/api/reports/applications?format=excel${sp.exercise ? `&exercise=${sp.exercise}` : ''}${sp.status && sp.status !== 'ALL' ? `&status=${sp.status}` : ''}`}
            className="btn-secondary btn-sm"
          >
            Export to Excel
          </Link>
        }
      />

      <Card className="mb-5">
        <form method="get" className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-4">
          <select name="exercise" defaultValue={sp.exercise ?? ''} className="select" aria-label="Recruitment exercise">
            <option value="">All exercises</option>
            {exercises.map((e) => <option key={e.id} value={e.id}>{e.reference} — {e.title}</option>)}
          </select>
          <select name="status" defaultValue={sp.status ?? 'ALL'} className="select" aria-label="Status">
            <option value="ALL">All statuses ({total})</option>
            {Object.entries(APPLICATION_STATUS).map(([, value]) => (
              <option key={value} value={value}>
                {APPLICATION_STATUS_LABELS[value]} ({countOf(value)})
              </option>
            ))}
          </select>
          <input name="q" defaultValue={sp.q} placeholder="Reference, name or email…" className="input" aria-label="Search" />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary btn-sm flex-1">Filter</button>
            <Link href="/admin/applications" className="btn-ghost btn-sm">Reset</Link>
          </div>
        </form>
      </Card>

      {applications.length === 0 ? (
        <EmptyState title="No applications match these filters" />
      ) : (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th><th>Applicant</th><th>Exercise</th><th>Position</th>
                  <th>Status</th><th>Complete</th><th>Docs</th><th>Screening officer</th>
                  <th>Submitted</th><th></th>
                </tr>
              </thead>
              <tbody>
                {applications.map((a) => {
                  const verified = a.documents.filter((d) => d.reviewStatus === 'VERIFIED').length;
                  const rejected = a.documents.filter((d) => ['REJECTED', 'RESUBMISSION_REQUIRED'].includes(d.reviewStatus)).length;
                  return (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap font-mono text-xs">{a.reference}</td>
                      <td>
                        <p className="font-medium text-ink-950">{a.applicant.fullName}</p>
                        <p className="text-xs text-ink-500">{a.applicant.applicantProfile?.applicantRef}</p>
                        <p className="text-xs text-ink-500">{a.applicant.applicantProfile?.lga ?? '—'}</p>
                      </td>
                      <td className="text-xs">{a.exercise.reference}</td>
                      <td className="text-xs">
                        {a.vacancy ? `${a.vacancy.jobTitle} (${a.vacancy.gradeLevel})` : '—'}
                      </td>
                      <td><StatusBadge status={a.status} label={APPLICATION_STATUS_LABELS[a.status]} /></td>
                      <td className="whitespace-nowrap text-xs">{a.completeness}%</td>
                      <td className="whitespace-nowrap text-xs">
                        {verified}/{a.documents.length}
                        {rejected > 0 ? <span className="mt-0.5 block text-gold-700">{rejected} rejected</span> : null}
                      </td>
                      <td className="text-xs">
                        {a.assignments.length === 0
                          ? <span className="text-ink-400">Unassigned</span>
                          : a.assignments.map((x) => x.officer.fullName).join(', ')}
                      </td>
                      <td className="whitespace-nowrap text-xs">{a.submittedAt ? formatDate(a.submittedAt) : <span className="text-ink-400">draft</span>}</td>
                      <td><Link href={`/admin/applications/${a.id}`} className="btn-secondary btn-sm">Open</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageCount={pageCount} basePath="/admin/applications"
            params={{ exercise: sp.exercise, status: sp.status, q: sp.q }} />
        </Card>
      )}
      <p className="mt-4 text-xs text-ink-500">
        Showing {applications.length} of {total.toLocaleString('en-NG')} application(s)
        {total > 0 ? ` · last refreshed ${formatDateTime(new Date())}` : ''}.
      </p>
    </>
  );
}
