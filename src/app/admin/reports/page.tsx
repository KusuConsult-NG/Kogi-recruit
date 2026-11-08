import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import {
  applicationsByDepartment, applicationsByGender, applicationsByLga,
  applicationsByQualification, applicationsByStatus, applicationsByVacancy,
  dashboardSummary, type GroupCount,
} from '@/lib/reports';
import { APPLICATION_STATUS_LABELS } from '@/lib/constants';
import { formatDateTime, percent } from '@/lib/format';
import { Card, CardBody, PageHeading, ProgressBar, StatCard } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reports and Analytics' };

function DistributionCard({
  title,
  rows,
  note,
}: {
  title: string;
  rows: GroupCount[];
  note?: string;
}) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  const top = rows.slice(0, 12);
  return (
    <Card>
      <div className="card-header">
        <h2 className="card-title">{title}</h2>
        <span className="badge-slate">{total.toLocaleString('en-NG')} total</span>
      </div>
      <CardBody className="space-y-2.5">
        {top.length === 0 ? (
          <p className="text-sm text-slate-600">No data available.</p>
        ) : (
          top.map((r) => (
            <ProgressBar
              key={r.label}
              value={total ? (r.count / total) * 100 : 0}
              label={`${r.label} — ${r.count.toLocaleString('en-NG')} (${percent(r.count, total)})`}
              tone="blue"
            />
          ))
        )}
        {rows.length > top.length ? (
          <p className="text-xs text-slate-500">
            Showing the top {top.length} of {rows.length} groups. Export for the complete breakdown.
          </p>
        ) : null}
        {note ? <p className="border-t border-slate-100 pt-2 text-xs text-slate-500">{note}</p> : null}
      </CardBody>
    </Card>
  );
}

/** Module 6 - management dashboard and reporting. */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ exercise?: string }>;
}) {
  const sp = await searchParams;
  const user = await requirePagePermission(PERMISSIONS.REPORT_VIEW);
  const canExport = hasPermission(user, PERMISSIONS.REPORT_EXPORT);
  const exerciseId = sp.exercise || undefined;

  const [summary, exercises, byVacancy, byQualification, byLga, byGender, byStatus, byDepartment, vacancyFill] =
    await Promise.all([
      dashboardSummary(exerciseId),
      prisma.recruitmentExercise.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, reference: true, title: true } }),
      applicationsByVacancy(exerciseId),
      applicationsByQualification(exerciseId),
      applicationsByLga(exerciseId),
      applicationsByGender(exerciseId),
      applicationsByStatus(exerciseId),
      applicationsByDepartment(exerciseId),
      prisma.vacancy.findMany({
        where: { active: true, ...(exerciseId ? { exerciseId } : {}) },
        select: {
          id: true, jobTitle: true, gradeLevel: true, positions: true,
          _count: { select: { applications: true } },
          applications: { where: { status: 'SELECTED' }, select: { id: true } },
        },
        orderBy: { jobTitle: 'asc' },
      }),
    ]);

  const exportQuery = `${exerciseId ? `exercise=${exerciseId}&` : ''}`;

  return (
    <>
      <PageHeading
        title="Reports and Analytics"
        description="Management dashboards and reports across every recruitment exercise, with export to PDF, Excel and CSV."
        actions={
          canExport ? (
            <>
              <Link href={`/api/reports/exercise?${exportQuery}format=pdf`} className="btn-secondary btn-sm">PDF</Link>
              <Link href={`/api/reports/exercise?${exportQuery}format=excel`} className="btn-secondary btn-sm">Excel</Link>
              <Link href={`/api/reports/exercise?${exportQuery}format=csv`} className="btn-secondary btn-sm">CSV</Link>
            </>
          ) : undefined
        }
      />

      <Card className="mb-6">
        <form method="get" className="flex flex-wrap items-end gap-3 p-4">
          <label className="flex-1 min-w-[18rem]">
            <span className="label">Recruitment exercise</span>
            <select name="exercise" defaultValue={exerciseId ?? ''} className="select">
              <option value="">All exercises (portal-wide)</option>
              {exercises.map((e) => <option key={e.id} value={e.id}>{e.reference} — {e.title}</option>)}
            </select>
          </label>
          <button type="submit" className="btn-primary btn-sm">Generate report</button>
          <Link href="/admin/reports" className="btn-ghost btn-sm">Reset</Link>
        </form>
      </Card>

      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Recruitment exercises</h2>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total exercises" value={summary.exercises.total} />
        <StatCard label="Active" value={summary.exercises.active} tone="green" />
        <StatCard label="In preparation" value={summary.exercises.draft} tone="amber" />
        <StatCard label="Closed" value={summary.exercises.closed} />
        <StatCard label="Archived" value={summary.exercises.archived} />
      </div>

      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Applications</h2>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatCard label="Total received" value={summary.applications.submitted.toLocaleString('en-NG')} />
        <StatCard label="Complete" value={summary.applications.complete} tone="green"
          hint={percent(summary.applications.complete, summary.applications.submitted)} />
        <StatCard label="Incomplete" value={summary.applications.incomplete} tone={summary.applications.incomplete ? 'amber' : 'default'} />
        <StatCard label="Awaiting screening" value={summary.applications.awaitingScreening} tone={summary.applications.awaitingScreening ? 'amber' : 'default'} />
        <StatCard label="Draft (unsubmitted)" value={summary.applications.draft} />
        <StatCard label="Withdrawn" value={summary.applications.withdrawn} />
      </div>

      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Recruitment stages</h2>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatCard label="Qualified" value={summary.applications.qualified} tone="green" />
        <StatCard label="Shortlisted" value={summary.applications.shortlisted} tone="green" />
        <StatCard label="Examination candidates" value={summary.applications.examCandidates} tone="blue" />
        <StatCard label="Interview candidates" value={summary.applications.interviewCandidates} tone="blue" />
        <StatCard label="Successful" value={summary.applications.successful} tone="green" />
        <StatCard label="Unsuccessful" value={summary.applications.unsuccessful} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="card-header"><h2 className="card-title">Recruitment stage completion</h2></div>
          <CardBody className="space-y-3.5">
            {summary.stageCompletion.map((s) => (
              <ProgressBar key={s.stage} value={s.percent}
                label={`${s.stage} — ${s.count.toLocaleString('en-NG')}`}
                tone={s.percent >= 75 ? 'green' : s.percent >= 30 ? 'blue' : 'amber'} />
            ))}
          </CardBody>
        </Card>

        <Card>
          <div className="card-header"><h2 className="card-title">Documents and enquiries</h2></div>
          <CardBody className="space-y-3.5">
            <ProgressBar value={summary.documents.total ? (summary.documents.verified / summary.documents.total) * 100 : 0}
              label={`Documents verified — ${summary.documents.verified} of ${summary.documents.total}`} tone="green" />
            <ProgressBar value={summary.documents.total ? (summary.documents.pending / summary.documents.total) * 100 : 0}
              label={`Awaiting review — ${summary.documents.pending}`} tone="amber" />
            <ProgressBar value={summary.documents.total ? (summary.documents.rejected / summary.documents.total) * 100 : 0}
              label={`Rejected or needing correction — ${summary.documents.rejected}`} tone="blue" />
            <div className="border-t border-slate-100 pt-3 text-sm text-slate-700">
              <p>Registered applicants: <strong>{summary.users.applicants.toLocaleString('en-NG')}</strong></p>
              <p>Staff accounts: <strong>{summary.users.staff}</strong></p>
              <p>Open public enquiries: <strong>{summary.enquiries.open}</strong> of {summary.enquiries.total}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Distribution analysis</h2>
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DistributionCard title="Applications by vacancy" rows={byVacancy} />
        <DistributionCard title="Applications by qualification" rows={byQualification} />
        <DistributionCard title="Applications by Local Government Area" rows={byLga} />
        <DistributionCard
          title="Applications by gender"
          rows={byGender}
          note="Gender statistics are collected and reported only where lawfully permitted and approved by the Commission."
        />
        <DistributionCard title="Applications by department or agency" rows={byDepartment} />
        <DistributionCard
          title="Applications by status"
          rows={byStatus.map((r) => ({ label: APPLICATION_STATUS_LABELS[r.label] ?? r.label, count: r.count }))}
        />
      </div>

      <Card className="mb-6">
        <div className="card-header">
          <h2 className="card-title">Vacancy fill rate</h2>
          <span className="badge-slate">{vacancyFill.length} vacancy/vacancies</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Job title</th><th>Grade</th><th>Approved posts</th><th>Applications</th>
                <th>Applications per post</th><th>Selected</th><th>Fill rate</th></tr>
            </thead>
            <tbody>
              {vacancyFill.map((v) => (
                <tr key={v.id}>
                  <td className="font-medium text-slate-900">{v.jobTitle}</td>
                  <td>{v.gradeLevel}</td>
                  <td>{v.positions}</td>
                  <td>{v._count.applications.toLocaleString('en-NG')}</td>
                  <td>{v.positions ? (v._count.applications / v.positions).toFixed(1) : '—'}</td>
                  <td className="font-semibold text-kogi-800">{v.applications.length}</td>
                  <td>{percent(v.applications.length, v.positions)}</td>
                </tr>
              ))}
              {vacancyFill.length === 0 ? (
                <tr><td colSpan={7} className="py-6 text-center text-sm text-slate-500">No active vacancies.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {canExport ? (
        <Card>
          <div className="card-header"><h2 className="card-title">Export reports</h2></div>
          <CardBody>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: 'Full recruitment report', path: `/api/reports/exercise?${exportQuery}` },
                { label: 'Application register', path: `/api/reports/applications?${exportQuery}` },
                { label: 'Audit trail', path: '/api/reports/audit?' },
              ].map((item) => (
                <div key={item.label} className="rounded-md border border-slate-200 p-3">
                  <p className="mb-2 text-sm font-medium text-slate-900">{item.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Link href={`${item.path}format=pdf`} className="btn-secondary btn-sm">PDF</Link>
                    <Link href={`${item.path}format=excel`} className="btn-secondary btn-sm">Excel</Link>
                    <Link href={`${item.path}format=csv`} className="btn-secondary btn-sm">CSV</Link>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Reports are generated from live data at {formatDateTime(new Date())}. Every export is
              recorded in the audit trail against your account.
            </p>
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
