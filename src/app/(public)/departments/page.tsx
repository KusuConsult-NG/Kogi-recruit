import { prisma } from '@/lib/db';
import {
  Card, CardBody, EmptyState, PageHeading, readable,
} from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Departments and Units' };

export default async function DepartmentsPage() {
  const departments = await prisma.department.findMany({
    where: { published: true, parentId: null },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    include: { children: { where: { published: true }, orderBy: { name: 'asc' } } },
  });

  return (
    <div className="container-page py-10">
      <PageHeading
        eyebrow="The Commission"
        title="Departments and Units"
        description="Directory of the Commission's departments, units and their responsibilities."
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Departments' }]}
      />
      {departments.length === 0 ? (
        <EmptyState title="No departments published" />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {departments.map((d) => (
            <Card key={d.id}>
              <div className="card-header">
                <div>
                  <h2 className="card-title">{d.name}</h2>
                  {d.code ? <p className="mt-0.5 text-xs text-ink-500">Code: {d.code}</p> : null}
                </div>
                <span className="badge-slate">{readable(d.kind)}</span>
              </div>
              <CardBody>
                {d.description ? <p className="text-sm text-ink-700">{d.description}</p> : null}
                <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                  {d.headName ? (
                    <div>
                      <dt className="text-ink-500">Head of department</dt>
                      <dd className="font-medium text-ink-800">
                        {d.headName}{d.headTitle ? `, ${d.headTitle}` : ''}
                      </dd>
                    </div>
                  ) : null}
                  {d.email ? (
                    <div>
                      <dt className="text-ink-500">Email</dt>
                      <dd className="font-medium text-ink-800">{d.email}</dd>
                    </div>
                  ) : null}
                  {d.phone ? (
                    <div>
                      <dt className="text-ink-500">Telephone</dt>
                      <dd className="font-medium text-ink-800">{d.phone}</dd>
                    </div>
                  ) : null}
                </dl>
                {d.children.length > 0 ? (
                  <div className="mt-4 border-t border-ink-100 pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Units</p>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {d.children.map((c) => (
                        <li key={c.id} className="badge-green">{c.name}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
