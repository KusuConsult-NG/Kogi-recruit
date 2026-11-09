import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePageAnyPermission } from '@/lib/page-guards';
import { hasAnyPermission, hasPermission, PERMISSIONS } from '@/lib/rbac';
import { formatDate } from '@/lib/format';
import { Alert, Card, EmptyState, PageHeading, StatCard, StatusBadge } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Interviews' };

export default async function InterviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ exercise?: string }>;
}) {
  const sp = await searchParams;
  const user = await requirePageAnyPermission([PERMISSIONS.INTERVIEW_MANAGE, PERMISSIONS.INTERVIEW_SCORE]);
  const canManage = hasPermission(user, PERMISSIONS.INTERVIEW_MANAGE);

  const [schedules, exercises] = await Promise.all([
    prisma.interviewSchedule.findMany({
      where: {
        ...(sp.exercise ? { exerciseId: sp.exercise } : {}),
        ...(canManage ? {} : { panels: { some: { members: { some: { userId: user.id } } } } }),
      },
      orderBy: { interviewDate: 'desc' },
      include: {
        exercise: { select: { reference: true, title: true } },
        panels: { select: { id: true } },
        candidates: { select: { attendance: true, consolidatedScore: true } },
      },
    }),
    prisma.recruitmentExercise.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, reference: true, title: true } }),
  ]);

  const totalCandidates = schedules.reduce((s, x) => s + x.candidates.length, 0);
  const assessed = schedules.reduce((s, x) => s + x.candidates.filter((c) => c.consolidatedScore !== null).length, 0);

  return (
    <>
      <PageHeading
        title="Interview Management"
        description="Stage 8 — schedule interviews, assign panels, record panel assessments and consolidate the results."
        actions={canManage ? <Link href="/admin/interviews/new" className="btn-primary btn-sm">New interview</Link> : undefined}
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Interviews" value={schedules.length} />
        <StatCard label="Candidates scheduled" value={totalCandidates} />
        <StatCard label="Assessments recorded" value={assessed} tone={assessed ? 'green' : 'default'} />
        <StatCard label="Completed" value={schedules.filter((s) => s.status === 'COMPLETED').length} tone="green" />
      </div>

      {canManage ? (
        <Card className="mb-5">
          <form method="get" className="flex flex-wrap items-end gap-3 p-4">
            <label className="flex-1 min-w-[16rem]">
              <span className="label">Recruitment exercise</span>
              <select name="exercise" defaultValue={sp.exercise ?? ''} className="select">
                <option value="">All exercises</option>
                {exercises.map((e) => <option key={e.id} value={e.id}>{e.reference} — {e.title}</option>)}
              </select>
            </label>
            <button type="submit" className="btn-primary btn-sm">Apply</button>
            <Link href="/admin/interviews" className="btn-ghost btn-sm">Reset</Link>
          </form>
        </Card>
      ) : (
        <div className="mb-5">
          <Alert tone="info">
            You are shown only the interviews for which you have been assigned to a panel.
          </Alert>
        </div>
      )}

      {schedules.length === 0 ? (
        <EmptyState
          title="No interviews scheduled"
          description={canManage
            ? 'Create an interview, define the assessment framework, assign panels, then schedule candidates.'
            : 'You have not been assigned to any interview panel yet.'}
          action={canManage ? <Link href="/admin/interviews/new" className="btn-primary btn-sm">Create interview</Link> : undefined}
        />
      ) : (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Interview</th><th>Exercise</th><th>Date</th><th>Venue</th><th>Panels</th>
                  <th>Candidates</th><th>Assessed</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/admin/interviews/${s.id}`} className="font-medium text-kogi-700 hover:underline">
                        {s.title}
                      </Link>
                      <p className="text-xs text-slate-500">{s.totalMarks} marks · pass {s.passMark}</p>
                    </td>
                    <td className="text-xs">{s.exercise.reference}</td>
                    <td className="whitespace-nowrap text-xs">{formatDate(s.interviewDate)} {s.startTime}</td>
                    <td className="max-w-[12rem] truncate text-xs">{s.venue}</td>
                    <td>{s.panels.length}</td>
                    <td>{s.candidates.length}</td>
                    <td>{s.candidates.filter((c) => c.consolidatedScore !== null).length}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td><Link href={`/admin/interviews/${s.id}`} className="btn-secondary btn-sm">Open</Link></td>
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
