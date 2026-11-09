import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { PERMISSIONS } from '@/lib/rbac';
import { formatDate, formatDateInput } from '@/lib/format';
import { Card, CardBody, PageHeading, StatCard, StatusBadge, Tabs } from '@/components/ui';
import { deleteTask, updateTaskStatus } from '@/actions/records';
import { TaskForm } from '../forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Internal Tasks' };

/** Module 4 - internal task assignment and workflow tracking. */
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; mine?: string }>;
}) {
  const sp = await searchParams;
  const user = await requirePagePermission(PERMISSIONS.ADMIN_RECORDS);
  const status = sp.status ?? 'OPEN';

  const [tasks, officers, departments, counts] = await Promise.all([
    prisma.staffTask.findMany({
      where: {
        ...(status === 'ALL' ? {} : { status }),
        ...(sp.mine ? { assigneeId: user.id } : {}),
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
      include: {
        assignee: { select: { fullName: true } },
        creator: { select: { fullName: true } },
        department: { select: { name: true } },
      },
    }),
    prisma.user.findMany({
      where: { active: true, role: { not: 'APPLICANT' } },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true },
    }),
    prisma.department.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.staffTask.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const overdue = tasks.filter((t) => t.dueDate && t.dueDate < new Date() && t.status !== 'DONE').length;
  const base = `/admin/records/tasks?${sp.mine ? 'mine=1&' : ''}`;

  return (
    <>
      <PageHeading
        title="Internal Tasks"
        description="Assign and track administrative tasks across the Commission's departments and units."
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open" value={countOf('OPEN')} tone={countOf('OPEN') ? 'amber' : 'default'} />
        <StatCard label="In progress" value={countOf('IN_PROGRESS')} tone="blue" />
        <StatCard label="Completed" value={countOf('DONE')} tone="green" />
        <StatCard label="Overdue" value={overdue} tone={overdue ? 'red' : 'default'} />
      </div>

      <Tabs
        active={`${base}status=${status}`}
        tabs={[
          { label: 'Open', href: `${base}status=OPEN`, count: countOf('OPEN') },
          { label: 'In progress', href: `${base}status=IN_PROGRESS`, count: countOf('IN_PROGRESS') },
          { label: 'Completed', href: `${base}status=DONE`, count: countOf('DONE') },
          { label: 'All', href: `${base}status=ALL`, count: counts.reduce((s, c) => s + c._count._all, 0) },
          { label: sp.mine ? 'Everyone' : 'Assigned to me', href: sp.mine ? `/admin/records/tasks?status=${status}` : `/admin/records/tasks?mine=1&status=${status}` },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card>
            <div className="card-header"><h2 className="card-title">Tasks</h2></div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Task</th><th>Assigned to</th><th>Department</th><th>Priority</th>
                    <th>Due</th><th>Status</th><th>Move to</th><th></th></tr>
                </thead>
                <tbody>
                  {tasks.map((t) => {
                    const isOverdue = t.dueDate && t.dueDate < new Date() && t.status !== 'DONE';
                    return (
                      <tr key={t.id}>
                        <td>
                          <p className="font-medium text-ink-950">{t.title}</p>
                          {t.description ? <p className="max-w-sm text-xs text-ink-500">{t.description}</p> : null}
                          <p className="text-2xs text-ink-400">Created by {t.creator?.fullName ?? '—'}</p>
                        </td>
                        <td className="text-xs">{t.assignee?.fullName ?? 'Unassigned'}</td>
                        <td className="text-xs">{t.department?.name ?? '—'}</td>
                        <td><StatusBadge status={t.priority} /></td>
                        <td className={`whitespace-nowrap text-xs ${isOverdue ? 'font-semibold text-[#9a2c20]' : ''}`}>
                          {t.dueDate ? formatDate(t.dueDate) : '—'}
                          {isOverdue ? ' (overdue)' : ''}
                        </td>
                        <td><StatusBadge status={t.status} /></td>
                        <td>
                          <form action={updateTaskStatus} className="flex items-center gap-1">
                            <input type="hidden" name="id" value={t.id} />
                            <select name="status" defaultValue={t.status} className="select w-28 text-xs" aria-label="Status">
                              {['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'].map((s) => (
                                <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>
                              ))}
                            </select>
                            <button type="submit" className="btn-secondary btn-sm">Set</button>
                          </form>
                        </td>
                        <td>
                          <form action={deleteTask}>
                            <input type="hidden" name="id" value={t.id} />
                            <button type="submit" className="btn-ghost btn-sm text-[#9a2c20]">Delete</button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                  {tasks.length === 0 ? (
                    <tr><td colSpan={8} className="py-6 text-center text-sm text-ink-500">No tasks in this view.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="mt-6 space-y-5">
            {tasks.slice(0, 10).map((t) => (
              <Card key={`edit-${t.id}`}>
                <div className="card-header"><h2 className="card-title">Edit — {t.title}</h2></div>
                <CardBody>
                  <TaskForm
                    officers={officers.map((o) => ({ id: o.id, name: o.fullName }))}
                    departments={departments}
                    initial={{
                      id: t.id, title: t.title, description: t.description ?? '',
                      assigneeId: t.assigneeId ?? '', departmentId: t.departmentId ?? '',
                      priority: t.priority, status: t.status, dueDate: formatDateInput(t.dueDate),
                    }}
                  />
                </CardBody>
              </Card>
            ))}
          </div>
        </div>

        <Card>
          <div className="card-header"><h2 className="card-title">Create a task</h2></div>
          <CardBody>
            <TaskForm
              officers={officers.map((o) => ({ id: o.id, name: o.fullName }))}
              departments={departments}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
