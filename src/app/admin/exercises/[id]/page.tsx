import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { EXERCISE_STATUS, EXERCISE_STATUS_LABELS } from '@/lib/constants';
import { formatDate, formatDateTime } from '@/lib/format';
import { EXERCISE_TRANSITIONS } from '@/lib/workflow';
import {
  Alert, Card, CardBody, DescriptionList, PageHeading, StatCard, StatusBadge,
} from '@/components/ui';
import { deleteDocumentRequirement, deleteFormField, deleteVacancy, toggleVacancy } from '@/actions/recruitment';
import { ExerciseForm } from '../exercise-form';
import { ExerciseUnitForm, FormFieldForm, RequirementForm, StatusActionForm, VacancyForm } from './manage';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ex = await prisma.recruitmentExercise.findUnique({ where: { id }, select: { title: true } });
  return { title: ex?.title ?? 'Recruitment Exercise' };
}

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function AdminExerciseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission(PERMISSIONS.EXERCISE_VIEW);
  const canManage = hasPermission(user, PERMISSIONS.EXERCISE_MANAGE);
  const canApprove = hasPermission(user, PERMISSIONS.EXERCISE_APPROVE);

  const exercise = await prisma.recruitmentExercise.findUnique({
    where: { id },
    include: {
      vacancies: {
        orderBy: [{ active: 'desc' }, { jobTitle: 'asc' }],
        include: {
          department: { select: { name: true } },
          ministry: { select: { name: true, code: true, kind: true } },
          ministryDept: { select: { name: true } },
          _count: { select: { applications: true } },
        },
      },
      requirements: { orderBy: { position: 'asc' } },
      formFields: { orderBy: { position: 'asc' } },
      approvals: { orderBy: { createdAt: 'desc' }, take: 5 },
      unit: { select: { id: true, name: true, code: true } },
      _count: { select: { applications: true, shortlists: true, examSchedules: true, interviewSchedules: true, selectionLists: true } },
    },
  });
  if (!exercise) notFound();

  const [departments, statusCounts, units, ministries] = await Promise.all([
    prisma.department.findMany({ where: { published: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.application.groupBy({ by: ['status'], where: { exerciseId: id }, _count: { _all: true } }),
    prisma.recruitmentUnit.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    }),
    prisma.ministry.findMany({
      where: { active: true },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
      select: {
        id: true, name: true, code: true, kind: true,
        departments: { orderBy: { name: 'asc' }, select: { id: true, name: true } },
      },
    }),
  ]);

  const nextStates = EXERCISE_TRANSITIONS[exercise.status] ?? [];
  const totalPosts = exercise.vacancies.filter((v) => v.active).reduce((s, v) => s + v.positions, 0);
  const editable = ![EXERCISE_STATUS.CLOSED, EXERCISE_STATUS.ARCHIVED].includes(exercise.status as never);
  const countOf = (s: string) => statusCounts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <>
      <PageHeading
        title={exercise.title}
        description={`${exercise.reference} · created ${formatDate(exercise.createdAt)}`}
        breadcrumb={[{ label: 'Exercises', href: '/admin/exercises' }, { label: exercise.reference }]}
        actions={
          <>
            <StatusBadge status={exercise.status} label={EXERCISE_STATUS_LABELS[exercise.status]} />
            <Link href={`/recruitment/${exercise.id}`} target="_blank" className="btn-ghost btn-sm">
              View public page
            </Link>
          </>
        }
      />

      {exercise.status === EXERCISE_STATUS.SUSPENDED && exercise.suspendedReason ? (
        <div className="mb-5">
          <Alert tone="warning" title="Exercise suspended">{exercise.suspendedReason}</Alert>
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Active vacancies" value={exercise.vacancies.filter((v) => v.active).length} />
        <StatCard label="Approved posts" value={totalPosts} />
        <StatCard label="Applications" value={exercise._count.applications.toLocaleString('en-NG')}
          href={`/admin/applications?exercise=${exercise.id}`} />
        <StatCard label="Awaiting screening" value={countOf('SUBMITTED') + countOf('UNDER_SCREENING')}
          tone={countOf('SUBMITTED') ? 'amber' : 'default'} href={`/admin/screening?exercise=${exercise.id}`} />
        <StatCard label="Successful" value={countOf('SELECTED')} tone="green" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {/* Managing recruitment unit */}
          <Card>
            <div className="card-header">
              <h2 className="card-title">Managing recruitment unit</h2>
              {exercise.unit ? (
                <span className="badge-green">{exercise.unit.code}</span>
              ) : (
                <span className="badge-amber">not assigned</span>
              )}
            </div>
            <CardBody>
              {exercise.unit ? (
                <p className="mb-4 text-sm text-ink-700">
                  This exercise is managed by{' '}
                  <Link href={`/admin/establishment/units/${exercise.unit.id}`} className="link">
                    {exercise.unit.name}
                  </Link>
                  . The unit's membership records who is answerable for each stage.
                </p>
              ) : (
                <p className="mb-4 text-sm text-ink-700">
                  No recruitment unit has been placed in charge of this exercise. Assigning one records
                  who is answerable for screening, examinations, interviews and selection.
                </p>
              )}
              {canManage ? (
                <ExerciseUnitForm
                  exerciseId={exercise.id}
                  units={units}
                  currentUnitId={exercise.unitId ?? ''}
                />
              ) : null}
            </CardBody>
          </Card>

          {/* Vacancies */}
          <Card>
            <div className="card-header">
              <h2 className="card-title">Approved vacancies</h2>
              <span className="badge-slate">{totalPosts} post(s)</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Job title</th><th>Grade</th><th>Employing MDA</th>
                    <th>Posts</th><th>Applications</th><th>State</th>{canManage && editable ? <th></th> : null}
                  </tr>
                </thead>
                <tbody>
                  {exercise.vacancies.map((v) => (
                    <tr key={v.id} className={v.active ? '' : 'opacity-60'}>
                      <td>
                        <p className="font-medium text-ink-950">{v.jobTitle}</p>
                        <p className="mt-0.5 max-w-sm text-xs text-ink-500">{v.qualifications}</p>
                        {v.experience ? <p className="text-xs text-ink-500">Experience: {v.experience}</p> : null}
                        {v.minAge || v.maxAge ? (
                          <p className="text-xs text-ink-500">Age: {v.minAge ?? '—'} to {v.maxAge ?? '—'}</p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap">{v.gradeLevel}</td>
                      <td className="text-xs">{v.ministry ? <span>{v.ministry.name}{v.ministryDept ? <span className="block text-ink-500">{v.ministryDept.name}</span> : null}</span> : (v.department?.name ?? '—')}</td>
                      <td>{v.positions}</td>
                      <td>{v._count.applications}</td>
                      <td>{v.active ? <span className="badge-green">active</span> : <span className="badge-slate">inactive</span>}</td>
                      {canManage && editable ? (
                        <td className="whitespace-nowrap">
                          <form action={toggleVacancy} className="inline">
                            <input type="hidden" name="id" value={v.id} />
                            <button type="submit" className="btn-ghost btn-sm">{v.active ? 'Deactivate' : 'Activate'}</button>
                          </form>
                          <form action={deleteVacancy} className="inline">
                            <input type="hidden" name="id" value={v.id} />
                            <button type="submit" className="btn-ghost btn-sm text-[#9a2c20]">Remove</button>
                          </form>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                  {exercise.vacancies.length === 0 ? (
                    <tr><td colSpan={7} className="py-6 text-center text-sm text-ink-500">
                      No vacancies added. At least one approved vacancy is required before this exercise can be submitted for approval.
                    </td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {canManage && editable ? (
              <CardBody><VacancyForm exerciseId={exercise.id} departments={departments} ministries={ministries} /></CardBody>
            ) : null}
          </Card>

          {/* Document requirements */}
          <Card>
            <div className="card-header">
              <h2 className="card-title">Required documents</h2>
              <span className="badge-slate">{exercise.requirements.filter((r) => r.required).length} mandatory</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Document</th><th>Guidance</th><th>Mandatory</th><th>Max size</th><th>Types</th>{canManage && editable ? <th></th> : null}</tr>
                </thead>
                <tbody>
                  {exercise.requirements.map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium text-ink-950">{r.label}</td>
                      <td className="max-w-xs text-xs">{r.description ?? '—'}</td>
                      <td>{r.required ? <span className="badge-red">required</span> : <span className="badge-slate">optional</span>}</td>
                      <td className="whitespace-nowrap text-xs">{r.maxSizeMb} MB</td>
                      <td className="max-w-[10rem] truncate text-xs">{r.acceptTypes}</td>
                      {canManage && editable ? (
                        <td>
                          <form action={deleteDocumentRequirement}>
                            <input type="hidden" name="id" value={r.id} />
                            <button type="submit" className="btn-ghost btn-sm text-[#9a2c20]">Remove</button>
                          </form>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                  {exercise.requirements.length === 0 ? (
                    <tr><td colSpan={6} className="py-6 text-center text-sm text-ink-500">No document requirements configured.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {canManage && editable ? <CardBody><RequirementForm exerciseId={exercise.id} /></CardBody> : null}
          </Card>

          {/* Custom form fields */}
          <Card>
            <div className="card-header">
              <h2 className="card-title">Custom application form fields</h2>
              <span className="badge-slate">{exercise.formFields.length}</span>
            </div>
            <CardBody className="space-y-4">
              {exercise.formFields.length === 0 ? (
                <p className="text-sm text-ink-600">
                  The standard application form captures personal details, contact information, State and
                  LGA, qualifications, employment history, referees, next of kin, declaration and consent.
                  Add custom fields here if this exercise needs anything further.
                </p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr><th>Label</th><th>Key</th><th>Section</th><th>Type</th><th>Mandatory</th>{canManage && editable ? <th></th> : null}</tr>
                    </thead>
                    <tbody>
                      {exercise.formFields.map((f) => (
                        <tr key={f.id}>
                          <td className="font-medium text-ink-950">{f.label}</td>
                          <td className="font-mono text-xs">{f.key}</td>
                          <td className="text-xs">{f.section.toLowerCase()}</td>
                          <td className="text-xs">{f.inputType}</td>
                          <td>{f.required ? <span className="badge-red">yes</span> : <span className="badge-slate">no</span>}</td>
                          {canManage && editable ? (
                            <td>
                              <form action={deleteFormField}>
                                <input type="hidden" name="id" value={f.id} />
                                <button type="submit" className="btn-ghost btn-sm text-[#9a2c20]">Remove</button>
                              </form>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {canManage && editable ? <FormFieldForm exerciseId={exercise.id} /> : null}
            </CardBody>
          </Card>

          {/* Edit exercise */}
          {canManage && editable ? (
            <Card>
              <div className="card-header"><h2 className="card-title">Exercise configuration</h2></div>
              <CardBody>
                <ExerciseForm
                  mode="edit"
                  initial={{
                    id: exercise.id,
                    title: exercise.title,
                    reference: exercise.reference,
                    description: exercise.description,
                    guidelines: exercise.guidelines ?? '',
                    eligibility: exercise.eligibility ?? '',
                    opensAt: toLocalInput(exercise.opensAt),
                    closesAt: toLocalInput(exercise.closesAt),
                    maxApplications: exercise.maxApplications,
                    requireExam: exercise.requireExam,
                    requireInterview: exercise.requireInterview,
                  }}
                />
              </CardBody>
            </Card>
          ) : null}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <div className="card-header"><h2 className="card-title">Lifecycle</h2></div>
            <CardBody className="space-y-3">
              <DescriptionList
                columns={1}
                items={[
                  { label: 'Current status', value: <StatusBadge status={exercise.status} label={EXERCISE_STATUS_LABELS[exercise.status]} /> },
                  { label: 'Opens', value: formatDateTime(exercise.opensAt) },
                  { label: 'Closes', value: formatDateTime(exercise.closesAt) },
                  { label: 'Approved', value: exercise.approvedAt ? formatDateTime(exercise.approvedAt) : '—' },
                  { label: 'Published', value: exercise.publishedAt ? formatDateTime(exercise.publishedAt) : '—' },
                  { label: 'Closed', value: exercise.closedAt ? formatDateTime(exercise.closedAt) : '—' },
                  { label: 'Archived', value: exercise.archivedAt ? formatDateTime(exercise.archivedAt) : '—' },
                  { label: 'Written examination', value: exercise.requireExam ? 'Applicable' : 'Not applicable' },
                  { label: 'Interview', value: exercise.requireInterview ? 'Applicable' : 'Not applicable' },
                ]}
              />

              {nextStates.length > 0 ? (
                <div className="space-y-2 border-t border-ink-200 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Available actions</p>
                  {nextStates.includes(EXERCISE_STATUS.PENDING_APPROVAL) && canManage ? (
                    <StatusActionForm exerciseId={exercise.id} to={EXERCISE_STATUS.PENDING_APPROVAL}
                      label="Submit for approval" tone="btn-primary" />
                  ) : null}
                  {nextStates.includes(EXERCISE_STATUS.APPROVED) && canApprove ? (
                    <StatusActionForm exerciseId={exercise.id} to={EXERCISE_STATUS.APPROVED}
                      label="Approve exercise" tone="btn-primary" />
                  ) : null}
                  {nextStates.includes(EXERCISE_STATUS.PUBLISHED) && canApprove ? (
                    <StatusActionForm exerciseId={exercise.id} to={EXERCISE_STATUS.PUBLISHED}
                      label="Publish to the portal" tone="btn-primary"
                      confirm="Publish this exercise? It will become visible to the public and open for applications." />
                  ) : null}
                  {nextStates.includes(EXERCISE_STATUS.DRAFT) && (canApprove || canManage) ? (
                    <StatusActionForm exerciseId={exercise.id} to={EXERCISE_STATUS.DRAFT}
                      label="Return to draft" requireNote notePlaceholder="Reason for returning" />
                  ) : null}
                  {nextStates.includes(EXERCISE_STATUS.SUSPENDED) && canManage ? (
                    <StatusActionForm exerciseId={exercise.id} to={EXERCISE_STATUS.SUSPENDED}
                      label="Suspend exercise" requireNote notePlaceholder="Reason for suspension" />
                  ) : null}
                  {nextStates.includes(EXERCISE_STATUS.CLOSED) && canManage ? (
                    <StatusActionForm exerciseId={exercise.id} to={EXERCISE_STATUS.CLOSED}
                      label="Close applications"
                      confirm="Close this exercise? No further applications will be accepted." />
                  ) : null}
                  {nextStates.includes(EXERCISE_STATUS.ARCHIVED) && canManage ? (
                    <StatusActionForm exerciseId={exercise.id} to={EXERCISE_STATUS.ARCHIVED}
                      label="Archive records"
                      confirm="Archive this exercise? Records are retained but the exercise becomes read-only." />
                  ) : null}
                </div>
              ) : (
                <p className="border-t border-ink-200 pt-3 text-xs text-ink-500">
                  No further lifecycle actions are available from this status.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <div className="card-header"><h2 className="card-title">Recruitment stages</h2></div>
            <CardBody className="space-y-2 text-sm">
              {[
                { label: 'Applications', count: exercise._count.applications, href: `/admin/applications?exercise=${exercise.id}` },
                { label: 'Screening queue', count: countOf('SUBMITTED') + countOf('UNDER_SCREENING'), href: `/admin/screening?exercise=${exercise.id}` },
                { label: 'Shortlists', count: exercise._count.shortlists, href: `/admin/shortlists?exercise=${exercise.id}` },
                { label: 'Examinations', count: exercise._count.examSchedules, href: `/admin/examinations?exercise=${exercise.id}` },
                { label: 'Interviews', count: exercise._count.interviewSchedules, href: `/admin/interviews?exercise=${exercise.id}` },
                { label: 'Selection lists', count: exercise._count.selectionLists, href: `/admin/selection?exercise=${exercise.id}` },
              ].map((row) => (
                <Link key={row.label} href={row.href}
                  className="flex items-center justify-between rounded border border-ink-200 px-3 py-2 hover:border-kogi-400 hover:bg-kogi-50">
                  <span className="text-ink-700">{row.label}</span>
                  <span className="font-semibold text-ink-950">{row.count}</span>
                </Link>
              ))}
            </CardBody>
          </Card>

          {exercise.approvals.length > 0 ? (
            <Card>
              <div className="card-header"><h2 className="card-title">Approval history</h2></div>
              <CardBody>
                <ul className="space-y-2.5">
                  {exercise.approvals.map((a) => (
                    <li key={a.id} className="border-b border-ink-100 pb-2.5 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-ink-800">{a.action.replace(/_/g, ' ').toLowerCase()}</p>
                        <StatusBadge status={a.status} />
                      </div>
                      <p className="mt-0.5 text-2xs text-ink-500">
                        Requested by {a.requestedByName ?? '—'} · {formatDateTime(a.createdAt)}
                      </p>
                      {a.decidedByName ? (
                        <p className="text-2xs text-ink-500">
                          Decided by {a.decidedByName} · {formatDateTime(a.decidedAt)}
                        </p>
                      ) : null}
                      {a.note ? <p className="mt-0.5 text-2xs text-ink-600">{a.note}</p> : null}
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
