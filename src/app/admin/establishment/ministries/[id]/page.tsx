import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { MDA_KIND_LABELS } from '@/lib/constants';
import {
  Card, CardBody, CardHeader, DescriptionList, EmptyState, PageHeading, StatCard, StatusBadge,
} from '@/components/ui';
import { deleteMinistry, deleteMinistryDepartment } from '@/actions/establishment';
import { MinistryDepartmentForm, MinistryForm } from '../../forms';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await prisma.ministry.findUnique({ where: { id }, select: { name: true } });
  return { title: m?.name ?? 'MDA' };
}

export default async function MinistryDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission(PERMISSIONS.MDA_VIEW);
  const canManage = hasPermission(user, PERMISSIONS.MDA_MANAGE);

  const ministry = await prisma.ministry.findUnique({
    where: { id },
    include: {
      departments: {
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
        include: { _count: { select: { vacancies: true } } },
      },
      vacancies: {
        orderBy: [{ active: 'desc' }, { jobTitle: 'asc' }],
        include: {
          exercise: { select: { id: true, reference: true, title: true, status: true } },
          ministryDept: { select: { name: true } },
          _count: { select: { applications: true } },
        },
      },
    },
  });
  if (!ministry) notFound();

  const openPosts = ministry.vacancies
    .filter((v) => v.active && v.exercise.status === 'PUBLISHED')
    .reduce((s, v) => s + v.positions, 0);
  const applications = ministry.vacancies.reduce((s, v) => s + v._count.applications, 0);

  return (
    <>
      <PageHeading
        eyebrow={MDA_KIND_LABELS[ministry.kind] ?? ministry.kind}
        title={ministry.name}
        description={ministry.mandate ?? undefined}
        breadcrumb={[
          { label: 'Administration', href: '/admin' },
          { label: 'Ministries & Agencies', href: '/admin/establishment/ministries' },
          { label: ministry.code },
        ]}
        actions={
          canManage ? (
            <form action={deleteMinistry}>
              <input type="hidden" name="id" value={ministry.id} />
              <button type="submit" className="btn-secondary btn-sm text-[#9a2c20]">
                {ministry.vacancies.length > 0 ? 'Retire this MDA' : 'Remove from register'}
              </button>
            </form>
          ) : null
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Departments recorded" value={ministry.departments.length} />
        <StatCard label="Vacancies raised" value={ministry.vacancies.length} tone="blue" />
        <StatCard label="Posts currently open" value={openPosts} tone="green" />
        <StatCard label="Applications received" value={applications} tone="amber" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Establishment record" eyebrow="Register entry" />
            <CardBody>
              <DescriptionList
                columns={2}
                items={[
                  { label: 'Code', value: <span className="ref">{ministry.code}</span> },
                  { label: 'Classification', value: <StatusBadge status={ministry.kind} label={MDA_KIND_LABELS[ministry.kind] ?? ministry.kind} /> },
                  { label: 'Accounting officer', value: ministry.headName ? `${ministry.headName} — ${ministry.headTitle ?? ''}` : '—' },
                  { label: 'Approved staff strength', value: ministry.staffStrength?.toLocaleString('en-NG') ?? '—' },
                  { label: 'Email', value: ministry.email ?? '—' },
                  { label: 'Telephone', value: ministry.phone ?? '—' },
                  { label: 'Office address', value: ministry.address ?? '—' },
                  { label: 'Local Government Area', value: ministry.lga ?? '—' },
                  { label: 'Established', value: ministry.establishedYear ?? '—' },
                  { label: 'Website', value: ministry.website ?? '—' },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Departments, divisions and units"
              description="A vacancy may name the department inside the MDA where the post sits."
            />
            <CardBody className="space-y-4">
              {ministry.departments.length === 0 ? (
                <EmptyState
                  title="No departments recorded"
                  description="Add the departments that carry posts, so vacancies can be placed precisely."
                />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th><th>Code</th><th>Type</th><th>Head</th>
                        <th className="num">Vacancies</th><th />
                      </tr>
                    </thead>
                    <tbody>
                      {ministry.departments.map((d) => (
                        <tr key={d.id}>
                          <td className="font-medium text-ink-950">{d.name}</td>
                          <td><span className="ref">{d.code ?? '—'}</span></td>
                          <td><span className="badge-slate">{d.kind}</span></td>
                          <td className="text-xs">{d.headName ?? '—'}</td>
                          <td className="num">{d._count.vacancies}</td>
                          <td>
                            {canManage && d._count.vacancies === 0 ? (
                              <form action={deleteMinistryDepartment}>
                                <input type="hidden" name="id" value={d.id} />
                                <button type="submit" className="btn-ghost btn-sm text-[#9a2c20]">Remove</button>
                              </form>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {canManage ? (
                <div className="panel-inset">
                  <p className="micro-label mb-3">Add a department</p>
                  <MinistryDepartmentForm ministryId={ministry.id} />
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Vacancies raised for this MDA"
              description="Across every recruitment exercise."
            />
            {ministry.vacancies.length === 0 ? (
              <CardBody>
                <EmptyState
                  title="No vacancies yet"
                  description="Vacancies are raised from within a recruitment exercise."
                  action={
                    <Link href="/admin/exercises" className="btn-secondary btn-sm">
                      Go to recruitment exercises
                    </Link>
                  }
                />
              </CardBody>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Post</th><th>Grade</th><th>Department</th><th>Exercise</th>
                      <th className="num">Posts</th><th className="num">Applications</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ministry.vacancies.map((v) => (
                      <tr key={v.id}>
                        <td className="font-medium text-ink-950">{v.jobTitle}</td>
                        <td><span className="ref">{v.gradeLevel}</span></td>
                        <td className="text-xs">{v.ministryDept?.name ?? '—'}</td>
                        <td className="text-xs">
                          <Link href={`/admin/exercises/${v.exercise.id}`} className="link">
                            {v.exercise.reference}
                          </Link>
                        </td>
                        <td className="num">{v.positions}</td>
                        <td className="num">{v._count.applications}</td>
                        <td>
                          {v.active ? <StatusBadge status={v.exercise.status} /> : <span className="badge-slate">withdrawn</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {canManage ? (
          <Card>
            <CardHeader title="Amend the record" />
            <CardBody>
              <MinistryForm
                initial={{
                  id: ministry.id,
                  name: ministry.name,
                  shortName: ministry.shortName ?? '',
                  code: ministry.code,
                  kind: ministry.kind,
                  mandate: ministry.mandate ?? '',
                  description: ministry.description ?? '',
                  headName: ministry.headName ?? '',
                  headTitle: ministry.headTitle ?? '',
                  email: ministry.email ?? '',
                  phone: ministry.phone ?? '',
                  website: ministry.website ?? '',
                  address: ministry.address ?? '',
                  lga: ministry.lga ?? '',
                  establishedYear: ministry.establishedYear ? String(ministry.establishedYear) : '',
                  staffStrength: ministry.staffStrength ? String(ministry.staffStrength) : '',
                  published: ministry.published,
                  active: ministry.active,
                }}
              />
            </CardBody>
          </Card>
        ) : null}
      </div>
    </>
  );
}
