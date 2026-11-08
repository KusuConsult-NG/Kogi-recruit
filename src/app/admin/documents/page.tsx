import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { PERMISSIONS } from '@/lib/rbac';
import { formatDateTime } from '@/lib/format';
import { formatBytes } from '@/lib/storage';
import { Card, EmptyState, PageHeading, Pagination, StatCard, StatusBadge, Tabs } from '@/components/ui';
import { DocumentReviewForm } from '../applications/[id]/review';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Document Verification' };

const PAGE_SIZE = 20;

/** Module 2.4 - document verification queue. */
export default async function DocumentQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; exercise?: string; page?: string }>;
}) {
  const sp = await searchParams;
  await requirePagePermission(PERMISSIONS.DOCUMENT_REVIEW);
  const status = sp.status ?? 'PENDING';
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const where = {
    ...(status !== 'ALL'
      ? status === 'PROBLEM'
        ? { reviewStatus: { in: ['REJECTED', 'RESUBMISSION_REQUIRED'] } }
        : { reviewStatus: status }
      : {}),
    ...(sp.exercise ? { application: { exerciseId: sp.exercise } } : {}),
  };

  const [total, documents, exercises, counts] = await Promise.all([
    prisma.applicantDocument.count({ where }),
    prisma.applicantDocument.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        application: {
          select: {
            id: true, reference: true, status: true,
            exercise: { select: { reference: true, title: true } },
            vacancy: { select: { jobTitle: true } },
            applicant: { select: { fullName: true, applicantProfile: { select: { applicantRef: true } } } },
          },
        },
        requirement: { select: { required: true } },
      },
    }),
    prisma.recruitmentExercise.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, reference: true, title: true } }),
    prisma.applicantDocument.groupBy({ by: ['reviewStatus'], _count: { _all: true } }),
  ]);

  const countOf = (s: string) => counts.find((c) => c.reviewStatus === s)?._count._all ?? 0;
  const problem = countOf('REJECTED') + countOf('RESUBMISSION_REQUIRED');
  const base = `/admin/documents?${sp.exercise ? `exercise=${sp.exercise}&` : ''}`;

  return (
    <>
      <PageHeading
        title="Document Verification"
        description="Check uploaded documents against the recruitment requirements, record the review outcome and the reason for any deficiency."
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Awaiting review" value={countOf('PENDING')} tone={countOf('PENDING') ? 'amber' : 'default'} />
        <StatCard label="Verified" value={countOf('VERIFIED')} tone="green" />
        <StatCard label="Needing correction" value={problem} tone={problem ? 'red' : 'default'} />
        <StatCard label="All documents" value={counts.reduce((s, c) => s + c._count._all, 0)} />
      </div>

      <Card className="mb-5">
        <form method="get" className="flex flex-wrap items-end gap-3 p-4">
          <input type="hidden" name="status" value={status} />
          <label className="flex-1 min-w-[16rem]">
            <span className="label">Recruitment exercise</span>
            <select name="exercise" defaultValue={sp.exercise ?? ''} className="select">
              <option value="">All exercises</option>
              {exercises.map((e) => <option key={e.id} value={e.id}>{e.reference} — {e.title}</option>)}
            </select>
          </label>
          <button type="submit" className="btn-primary btn-sm">Apply</button>
          <Link href="/admin/documents" className="btn-ghost btn-sm">Reset</Link>
        </form>
      </Card>

      <Tabs
        active={`${base}status=${status}`}
        tabs={[
          { label: 'Awaiting review', href: `${base}status=PENDING`, count: countOf('PENDING') },
          { label: 'Verified', href: `${base}status=VERIFIED`, count: countOf('VERIFIED') },
          { label: 'Needing correction', href: `${base}status=PROBLEM`, count: problem },
          { label: 'All', href: `${base}status=ALL`, count: counts.reduce((s, c) => s + c._count._all, 0) },
        ]}
      />

      {documents.length === 0 ? (
        <EmptyState title="No documents in this queue" description="Documents appear here as applicants upload them." />
      ) : (
        <Card>
          <div className="divide-y divide-slate-100">
            {documents.map((d) => (
              <div key={d.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {d.label}
                      {d.requirement?.required ? <span className="ml-1.5 badge-red">required</span> : null}
                      {d.version > 1 ? <span className="ml-1.5 badge-slate">version {d.version}</span> : null}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      <Link href={`/admin/applications/${d.application.id}`} className="font-mono text-kogi-700 underline">
                        {d.application.reference}
                      </Link>{' '}
                      · {d.application.applicant.fullName} ({d.application.applicant.applicantProfile?.applicantRef}) ·{' '}
                      {d.application.vacancy?.jobTitle ?? '—'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {d.application.exercise.reference} · {d.originalName} · {formatBytes(d.sizeBytes)} · uploaded{' '}
                      {formatDateTime(d.createdAt)}
                    </p>
                    {d.reviewNotes ? (
                      <p className="mt-1 text-xs text-amber-800">Previous remarks: {d.reviewNotes}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={d.reviewStatus} />
                    <a href={`/api/files/document/${d.id}`} target="_blank" rel="noopener" className="btn-secondary btn-sm">
                      Open document
                    </a>
                  </div>
                </div>
                <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <DocumentReviewForm documentId={d.id} currentStatus={d.reviewStatus} />
                </div>
              </div>
            ))}
          </div>
          <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} basePath="/admin/documents"
            params={{ status, exercise: sp.exercise }} />
        </Card>
      )}
    </>
  );
}
