import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { PERMISSIONS } from '@/lib/rbac';
import {
  Card, CardBody, PageHeading, StatCard, readable,
} from '@/components/ui';
import { deleteDepartment } from '@/actions/content';
import { DepartmentForm } from '../forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Departments and Units' };

/** Module 4 - department and unit directory. */
export default async function DepartmentsAdmin() {
  await requirePagePermission(PERMISSIONS.CONTENT_MANAGE);
  const departments = await prisma.department.findMany({
    orderBy: [{ kind: 'asc' }, { position: 'asc' }, { name: 'asc' }],
    include: {
      parent: { select: { name: true } },
      _count: { select: { users: true, vacancies: true, children: true } },
    },
  });
  const parents = departments.filter((d) => d.kind === 'DEPARTMENT').map((d) => ({ id: d.id, name: d.name }));

  return (
    <>
      <PageHeading
        title="Departments and Units"
        description="Directory of the Commission's departments and units, used for staff accounts, vacancies and the public directory."
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Departments" value={departments.filter((d) => d.kind === 'DEPARTMENT').length} />
        <StatCard label="Units" value={departments.filter((d) => d.kind === 'UNIT').length} />
        <StatCard label="Published" value={departments.filter((d) => d.published).length} tone="green" />
        <StatCard label="Staff assigned" value={departments.reduce((s, d) => s + d._count.users, 0)} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card>
            <div className="card-header"><h2 className="card-title">Directory</h2></div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Type</th><th>Parent</th><th>Head</th><th>Staff</th><th>Vacancies</th><th>Published</th><th></th></tr>
                </thead>
                <tbody>
                  {departments.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <p className="font-medium text-ink-950">{d.name}</p>
                        {d.code ? <p className="text-xs text-ink-500">{d.code}</p> : null}
                      </td>
                      <td><span className="badge-slate">{readable(d.kind)}</span></td>
                      <td className="text-xs">{d.parent?.name ?? '—'}</td>
                      <td className="text-xs">{d.headName ?? '—'}</td>
                      <td>{d._count.users}</td>
                      <td>{d._count.vacancies}</td>
                      <td>{d.published ? <span className="badge-green">yes</span> : <span className="badge-slate">no</span>}</td>
                      <td>
                        <form action={deleteDepartment}>
                          <input type="hidden" name="id" value={d.id} />
                          <button type="submit" className="btn-ghost btn-sm text-[#9a2c20]">Remove</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {departments.length === 0 ? (
                    <tr><td colSpan={8} className="py-6 text-center text-sm text-ink-500">No departments configured.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="mt-6 space-y-5">
            {departments.map((d) => (
              <Card key={`edit-${d.id}`}>
                <div className="card-header"><h2 className="card-title">Edit — {d.name}</h2></div>
                <CardBody>
                  <DepartmentForm
                    parents={parents}
                    initial={{
                      id: d.id, name: d.name, code: d.code ?? '', kind: d.kind,
                      parentId: d.parentId ?? '', description: d.description ?? '',
                      headName: d.headName ?? '', headTitle: d.headTitle ?? '',
                      email: d.email ?? '', phone: d.phone ?? '', published: d.published,
                    }}
                  />
                </CardBody>
              </Card>
            ))}
          </div>
        </div>

        <Card>
          <div className="card-header"><h2 className="card-title">Add a department or unit</h2></div>
          <CardBody><DepartmentForm parents={parents} /></CardBody>
        </Card>
      </div>
    </>
  );
}
