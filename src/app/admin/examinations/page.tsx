import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePageAnyPermission } from '@/lib/page-guards';
import { hasAnyPermission, hasPermission, PERMISSIONS } from '@/lib/rbac';
import { formatDate } from '@/lib/format';
import { Alert, Card, EmptyState, PageHeading, StatCard, StatusBadge } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Examinations' };

export default async function ExaminationsPage({
  searchParams,
}: {
  searchParams: Promise<{ exercise?: string }>;
}) {
  const sp = await searchParams;
  const user = await requirePageAnyPermission([PERMISSIONS.EXAM_MANAGE, PERMISSIONS.EXAM_SCORE]);
  const canManage = hasPermission(user, PERMISSIONS.EXAM_MANAGE);

  const [schedules, exercises] = await Promise.all([
    prisma.examSchedule.findMany({
      where: sp.exercise ? { exerciseId: sp.exercise } : {},
      orderBy: { examDate: 'desc' },
      include: {
        exercise: { select: { reference: true, title: true } },
        centres: { select: { id: true, capacity: true } },
        candidates: { select: { attendance: true, score: true, validated: true } },
      },
    }),
    prisma.recruitmentExercise.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, reference: true, title: true } }),
  ]);

  const totalCandidates = schedules.reduce((s, x) => s + x.candidates.length, 0);
  const scored = schedules.reduce((s, x) => s + x.candidates.filter((c) => c.score !== null).length, 0);

  return (
    <>
      <PageHeading
        title="Examinations and Assessment"
        description="Stage 7 — create examination schedules and centres, allocate candidates, record attendance and scores, then validate the results."
        actions={canManage ? <Link href="/admin/examinations/new" className="btn-primary btn-sm">New examination</Link> : undefined}
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Examinations" value={schedules.length} />
        <StatCard label="Candidates" value={totalCandidates} />
        <StatCard label="Scores recorded" value={scored} tone={scored ? 'green' : 'default'} />
        <StatCard label="Completed" value={schedules.filter((s) => s.status === 'COMPLETED').length} tone="green" />
      </div>

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
          <Link href="/admin/examinations" className="btn-ghost btn-sm">Reset</Link>
        </form>
      </Card>

      {schedules.length === 0 ? (
        <EmptyState
          title="No examinations scheduled"
          description="Create an examination, add centres, then allocate the approved shortlisted candidates."
          action={canManage ? <Link href="/admin/examinations/new" className="btn-primary btn-sm">Create examination</Link> : undefined}
        />
      ) : (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Examination</th><th>Exercise</th><th>Date</th><th>Centres</th><th>Candidates</th>
                  <th>Present</th><th>Scored</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/admin/examinations/${s.id}`} className="font-medium text-kogi-700 hover:underline">
                        {s.title}
                      </Link>
                      <p className="text-xs text-ink-500">
                        {s.totalMarks} marks · pass {s.passMark}
                        {s.resultsPublishedAt ? ' · results released' : ''}
                      </p>
                    </td>
                    <td className="text-xs">{s.exercise.reference}</td>
                    <td className="whitespace-nowrap text-xs">{formatDate(s.examDate)} {s.startTime}</td>
                    <td>{s.centres.length} <span className="text-xs text-ink-500">({s.centres.reduce((a, c) => a + c.capacity, 0)} seats)</span></td>
                    <td>{s.candidates.length}</td>
                    <td>{s.candidates.filter((c) => c.attendance === 'PRESENT').length}</td>
                    <td>{s.candidates.filter((c) => c.score !== null).length}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td><Link href={`/admin/examinations/${s.id}`} className="btn-secondary btn-sm">Manage</Link></td>
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
