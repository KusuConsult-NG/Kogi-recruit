import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePageStaff } from '@/lib/page-guards';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { dashboardSummary } from '@/lib/reports';
import { APPLICATION_STATUS_LABELS, EXERCISE_STATUS, EXERCISE_STATUS_LABELS, ROLE_LABELS, type Role } from '@/lib/constants';
import { formatDate, formatDateTime, percent } from '@/lib/format';
import {
  Card, CardBody, DescriptionList, PageHeading, ProgressBar, StatCard, StatusBadge, readable,
} from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Administration Dashboard' };

/** Module 6 - management dashboard. */
export default async function AdminDashboard() {
  const user = await requirePageStaff();
  const canReport = hasPermission(user, PERMISSIONS.REPORT_VIEW);

  const [summary, exercises, pendingApprovals, myAssignments, recentAudit, panelDuties] =
    await Promise.all([
      canReport ? dashboardSummary() : null,
      prisma.recruitmentExercise.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: {
          _count: { select: { applications: true, vacancies: true } },
        },
      }),
      hasPermission(user, PERMISSIONS.EXERCISE_APPROVE) ||
      hasPermission(user, PERMISSIONS.SHORTLIST_APPROVE) ||
      hasPermission(user, PERMISSIONS.SELECTION_APPROVE) ||
      hasPermission(user, PERMISSIONS.CONTENT_PUBLISH)
        ? prisma.approvalRequest.findMany({
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
            take: 8,
          })
        : [],
      prisma.screeningAssignment.findMany({
        where: { officerId: user.id, completedAt: null },
        take: 8,
        include: {
          application: {
            select: {
              id: true, reference: true, status: true, completeness: true,
              exercise: { select: { title: true } },
              vacancy: { select: { jobTitle: true } },
            },
          },
        },
      }),
      hasPermission(user, PERMISSIONS.AUDIT_VIEW)
        ? prisma.auditLog.findMany({
            where: hasPermission(user, PERMISSIONS.AUDIT_VIEW_SENSITIVE) ? {} : { sensitive: false },
            orderBy: { createdAt: 'desc' },
            take: 10,
          })
        : [],
      hasPermission(user, PERMISSIONS.INTERVIEW_SCORE)
        ? prisma.interviewPanelMember.findMany({
            where: { userId: user.id },
            include: {
              panel: {
                include: {
                  schedule: { select: { id: true, title: true, interviewDate: true, venue: true, status: true } },
                  _count: { select: { candidates: true } },
                },
              },
            },
          })
        : [],
    ]);

  return (
    <>
      <PageHeading
        title="Administration Dashboard"
        description={`Signed in as ${user.fullName} — ${ROLE_LABELS[user.role as Role]}. You see only the functions assigned to your role.`}
        actions={
          canReport ? (
            <Link href="/admin/reports" className="btn-secondary btn-sm">Full reports</Link>
          ) : undefined
        }
      />

      {summary ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Open exercises" value={summary.exercises.active}
              hint={`${summary.exercises.total} total · ${summary.exercises.draft} in preparation`}
              tone="green" href="/admin/exercises" />
            <StatCard label="Applications received" value={summary.applications.submitted.toLocaleString('en-NG')}
              hint={`${summary.applications.draft} draft · ${summary.applications.withdrawn} withdrawn`}
              href="/admin/applications" />
            <StatCard label="Awaiting screening" value={summary.applications.awaitingScreening}
              hint={`${summary.applications.incomplete} need correction`}
              tone={summary.applications.awaitingScreening ? 'amber' : 'default'} href="/admin/screening" />
            <StatCard label="Documents pending review" value={summary.documents.pending}
              hint={`${summary.documents.verified} verified · ${summary.documents.rejected} rejected`}
              tone={summary.documents.pending ? 'amber' : 'default'} href="/admin/documents" />
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-6">
            <StatCard label="Qualified" value={summary.applications.qualified} tone="green" />
            <StatCard label="Shortlisted" value={summary.applications.shortlisted} tone="green" />
            <StatCard label="Exam candidates" value={summary.applications.examCandidates} tone="blue" />
            <StatCard label="Interview candidates" value={summary.applications.interviewCandidates} tone="blue" />
            <StatCard label="Successful" value={summary.applications.successful} tone="green" />
            <StatCard label="Disqualified" value={summary.applications.disqualified} tone="red" />
          </div>
        </>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {summary ? (
            <Card>
              <div className="card-header">
                <h2 className="card-title">Recruitment stage completion</h2>
                <span className="badge-slate">all exercises</span>
              </div>
              <CardBody className="space-y-3.5">
                {summary.stageCompletion.map((stage) => (
                  <div key={stage.stage}>
                    <ProgressBar
                      value={stage.percent}
                      label={`${stage.stage} — ${stage.count.toLocaleString('en-NG')} of ${summary.applications.submitted.toLocaleString('en-NG')}`}
                      tone={stage.percent >= 75 ? 'green' : stage.percent >= 30 ? 'blue' : 'amber'}
                    />
                  </div>
                ))}
                {summary.applications.submitted === 0 ? (
                  <p className="text-sm text-ink-600">No applications have been submitted yet.</p>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          {myAssignments.length > 0 ? (
            <Card>
              <div className="card-header">
                <h2 className="card-title">My screening assignments</h2>
                <Link href="/admin/screening" className="text-sm text-kogi-700 hover:underline">All</Link>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Reference</th><th>Exercise</th><th>Position</th><th>Status</th><th>Complete</th><th></th></tr>
                  </thead>
                  <tbody>
                    {myAssignments.map((a) => (
                      <tr key={a.id}>
                        <td className="whitespace-nowrap font-mono text-xs">{a.application.reference}</td>
                        <td className="text-xs">{a.application.exercise.title}</td>
                        <td className="text-xs">{a.application.vacancy?.jobTitle ?? '—'}</td>
                        <td><StatusBadge status={a.application.status} /></td>
                        <td className="text-xs">{a.application.completeness}%</td>
                        <td>
                          <Link href={`/admin/applications/${a.application.id}`} className="btn-secondary btn-sm">
                            Screen
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          {panelDuties.length > 0 ? (
            <Card>
              <div className="card-header"><h2 className="card-title">My interview panel duties</h2></div>
              <CardBody>
                <ul className="divide-y divide-ink-100">
                  {panelDuties.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium text-ink-950">
                          {d.panel.schedule.title} — {d.panel.name}
                          {d.isChair ? <span className="ml-1.5 badge-green">chair</span> : null}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-500">
                          {formatDate(d.panel.schedule.interviewDate)} · {d.panel.schedule.venue} ·{' '}
                          {d.panel._count.candidates} candidate(s)
                        </p>
                      </div>
                      <Link href={`/admin/interviews/${d.panel.schedule.id}`} className="btn-secondary btn-sm">
                        Open score sheet
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <div className="card-header">
              <h2 className="card-title">Recent recruitment exercises</h2>
              <Link href="/admin/exercises" className="text-sm text-kogi-700 hover:underline">All exercises</Link>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Exercise</th><th>Status</th><th>Vacancies</th><th>Applications</th><th>Closes</th><th></th></tr>
                </thead>
                <tbody>
                  {exercises.map((ex) => (
                    <tr key={ex.id}>
                      <td>
                        <p className="font-medium text-ink-950">{ex.title}</p>
                        <p className="text-xs text-ink-500">{ex.reference}</p>
                      </td>
                      <td><StatusBadge status={ex.status} label={EXERCISE_STATUS_LABELS[ex.status]} /></td>
                      <td>{ex._count.vacancies}</td>
                      <td>{ex._count.applications.toLocaleString('en-NG')}</td>
                      <td className="whitespace-nowrap text-xs">{formatDate(ex.closesAt)}</td>
                      <td><Link href={`/admin/exercises/${ex.id}`} className="btn-secondary btn-sm">Open</Link></td>
                    </tr>
                  ))}
                  {exercises.length === 0 ? (
                    <tr><td colSpan={6} className="py-6 text-center text-sm text-ink-500">
                      No recruitment exercises have been created.
                    </td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {pendingApprovals.length > 0 ? (
            <Card>
              <div className="card-header">
                <h2 className="card-title">Awaiting my approval</h2>
                <span className="badge-amber">{pendingApprovals.length}</span>
              </div>
              <CardBody>
                <ul className="space-y-3">
                  {pendingApprovals.map((a) => (
                    <li key={a.id} className="border-b border-ink-100 pb-3 last:border-0 last:pb-0">
                      <p className="text-sm font-medium text-ink-950">
                        {readable(a.entityType)} — {a.action.replace(/_/g, ' ').toLowerCase()}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        Requested by {a.requestedByName ?? 'an officer'} on {formatDateTime(a.createdAt)}
                      </p>
                      {a.note ? <p className="mt-0.5 text-xs text-ink-600">{a.note}</p> : null}
                    </li>
                  ))}
                </ul>
                <Link href="/admin/approvals" className="btn-primary btn-sm mt-4 w-full">Review approvals</Link>
              </CardBody>
            </Card>
          ) : null}

          {summary ? (
            <Card>
              <div className="card-header"><h2 className="card-title">Portal activity</h2></div>
              <CardBody>
                <DescriptionList
                  columns={1}
                  items={[
                    { label: 'Registered applicants', value: summary.users.applicants.toLocaleString('en-NG') },
                    { label: 'Staff accounts', value: `${summary.users.staff} (${summary.users.active} active overall)` },
                    { label: 'Open public enquiries', value: `${summary.enquiries.open} of ${summary.enquiries.total}` },
                    { label: 'Complete applications', value: `${summary.applications.complete} (${percent(summary.applications.complete, summary.applications.submitted)})` },
                    { label: 'Archived exercises', value: summary.exercises.archived },
                  ]}
                />
              </CardBody>
            </Card>
          ) : null}

          {recentAudit.length > 0 ? (
            <Card>
              <div className="card-header">
                <h2 className="card-title">Recent activity</h2>
                <Link href="/admin/audit" className="text-sm text-kogi-700 hover:underline">Audit trail</Link>
              </div>
              <CardBody>
                <ul className="space-y-2.5">
                  {recentAudit.map((log) => (
                    <li key={log.id} className="border-b border-ink-100 pb-2.5 last:border-0 last:pb-0">
                      <p className="text-xs font-medium text-ink-800">{log.summary ?? log.action}</p>
                      <p className="text-2xs text-ink-500">
                        {log.actorName ?? 'System'} · {formatDateTime(log.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
