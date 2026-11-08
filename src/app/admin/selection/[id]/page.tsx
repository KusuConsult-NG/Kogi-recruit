import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePageAnyPermission } from '@/lib/page-guards';
import { hasAnyPermission, hasPermission, PERMISSIONS } from '@/lib/rbac';
import { APPLICATION_STATUS_LABELS } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import {
  Alert, Card, CardBody, DescriptionList, PageHeading, StatCard, StatusBadge,
} from '@/components/ui';
import { setSelectionOutcome } from '@/actions/assessment';
import { ArchiveSelectionForm, SelectionDecisionForm } from '../forms';

export const dynamic = 'force-dynamic';

export default async function SelectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageAnyPermission([PERMISSIONS.SELECTION_PREPARE, PERMISSIONS.SELECTION_APPROVE]);
  const canPrepare = hasPermission(user, PERMISSIONS.SELECTION_PREPARE);
  const canApprove = hasPermission(user, PERMISSIONS.SELECTION_APPROVE);

  const list = await prisma.selectionList.findUnique({
    where: { id },
    include: {
      exercise: {
        select: {
          id: true, title: true, reference: true, status: true,
          vacancies: { where: { active: true }, select: { id: true, jobTitle: true, gradeLevel: true, positions: true } },
        },
      },
      entries: {
        orderBy: [{ rank: 'asc' }],
        include: {
          application: {
            select: {
              id: true, reference: true, status: true, vacancyId: true,
              applicant: { select: { fullName: true, applicantProfile: { select: { applicantRef: true, lga: true, gender: true } } } },
              vacancy: { select: { jobTitle: true, gradeLevel: true } },
            },
          },
        },
      },
    },
  });
  if (!list) notFound();

  const selected = list.entries.filter((e) => e.outcome === 'SELECTED');
  const reserve = list.entries.filter((e) => e.outcome === 'RESERVE');
  const notSelected = list.entries.filter((e) => e.outcome === 'NOT_SELECTED');
  const pendingOutcome = list.entries.filter((e) => e.outcome === 'PENDING');

  const fillByVacancy = list.exercise.vacancies.map((v) => ({
    ...v,
    selected: selected.filter((e) => e.application.vacancyId === v.id).length,
  }));

  const editable = list.status === 'DRAFT' && canPrepare;

  return (
    <>
      <PageHeading
        title={list.title}
        description={`${list.exercise.title} (${list.exercise.reference}) · weighting ${list.examWeight}% examination / ${list.interviewWeight}% interview`}
        breadcrumb={[{ label: 'Final Selection', href: '/admin/selection' }, { label: list.title.slice(0, 40) }]}
        actions={
          <>
            <StatusBadge status={list.status} />
            <Link href={`/api/reports/selection?id=${list.id}&format=pdf`} className="btn-secondary btn-sm">
              Export to PDF
            </Link>
            <Link href={`/api/reports/selection?id=${list.id}&format=excel`} className="btn-secondary btn-sm">
              Export to Excel
            </Link>
          </>
        }
      />

      {list.rejectionNote ? (
        <div className="mb-5"><Alert tone="warning" title="Returned by the approving authority">{list.rejectionNote}</Alert></div>
      ) : null}
      {list.status === 'APPROVED' ? (
        <div className="mb-5">
          <Alert tone="success" title="Recruitment outcome approved">
            Approved on {formatDateTime(list.approvedAt)}. All candidates have been notified. Final
            appointment remains subject to the approval of the legally authorised government authorities.
          </Alert>
        </div>
      ) : null}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Candidates" value={list.entries.length} />
        <StatCard label="Successful" value={selected.length} tone="green" />
        <StatCard label="Reserve" value={reserve.length} tone="amber" />
        <StatCard label="Unsuccessful" value={notSelected.length} />
        <StatCard label="Outcome pending" value={pendingOutcome.length} tone={pendingOutcome.length ? 'red' : 'default'} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card>
            <div className="card-header">
              <h2 className="card-title">Consolidated assessment and ranking</h2>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Rank</th><th>Candidate</th><th>Position</th><th>LGA</th>
                    <th>Exam</th><th>Interview</th><th>Final</th><th>Outcome</th>
                    {editable ? <th>Set outcome</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {list.entries.map((e) => (
                    <tr key={e.id} className={e.outcome === 'SELECTED' ? 'bg-kogi-50/50' : ''}>
                      <td className="font-semibold">{e.rank ?? '—'}</td>
                      <td>
                        <Link href={`/admin/applications/${e.application.id}`} className="text-xs font-medium text-kogi-700 hover:underline">
                          {e.application.applicant.fullName}
                        </Link>
                        <p className="font-mono text-[11px] text-slate-500">{e.application.reference}</p>
                      </td>
                      <td className="text-xs">
                        {e.application.vacancy ? `${e.application.vacancy.jobTitle} (${e.application.vacancy.gradeLevel})` : '—'}
                      </td>
                      <td className="text-xs">{e.application.applicant.applicantProfile?.lga ?? '—'}</td>
                      <td className="text-xs">{e.examScore ?? '—'}</td>
                      <td className="text-xs">{e.interviewScore ?? '—'}</td>
                      <td className="text-xs font-bold text-slate-900">{e.finalScore ?? '—'}</td>
                      <td><StatusBadge status={e.outcome} /></td>
                      {editable ? (
                        <td>
                          <form action={setSelectionOutcome} className="flex flex-wrap items-center gap-1">
                            <input type="hidden" name="entryId" value={e.id} />
                            <select name="outcome" defaultValue={e.outcome} className="select w-28 text-xs" aria-label="Outcome">
                              <option value="SELECTED">Selected</option>
                              <option value="RESERVE">Reserve</option>
                              <option value="NOT_SELECTED">Not selected</option>
                              <option value="PENDING">Pending</option>
                            </select>
                            <input name="remarks" defaultValue={e.remarks ?? ''} placeholder="Remarks"
                              aria-label="Remarks" className="input w-28 text-xs" />
                            <button type="submit" className="btn-secondary btn-sm">Set</button>
                          </form>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                  {list.entries.length === 0 ? (
                    <tr><td colSpan={9} className="py-6 text-center text-sm text-slate-500">No candidates on this list.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="card-header"><h2 className="card-title">Approval</h2></div>
            <CardBody className="space-y-3">
              <DescriptionList
                columns={1}
                items={[
                  { label: 'Status', value: <StatusBadge status={list.status} /> },
                  { label: 'Prepared', value: formatDateTime(list.createdAt) },
                  { label: 'Approved', value: list.approvedAt ? formatDateTime(list.approvedAt) : '—' },
                  { label: 'Candidates notified', value: list.notifiedAt ? formatDateTime(list.notifiedAt) : 'Not yet' },
                  { label: 'Archived', value: list.archivedAt ? formatDateTime(list.archivedAt) : '—' },
                ]}
              />
              <div className="space-y-2 border-t border-slate-200 pt-3">
                {list.status === 'DRAFT' && canPrepare ? (
                  <>
                    {pendingOutcome.length > 0 ? (
                      <Alert tone="warning">
                        {pendingOutcome.length} candidate(s) still have no provisional outcome.
                      </Alert>
                    ) : null}
                    <SelectionDecisionForm selectionListId={list.id} decision="SUBMIT"
                      label="Submit for Commission approval" tone="btn-primary" />
                  </>
                ) : null}
                {list.status === 'PENDING_APPROVAL' && canApprove ? (
                  <>
                    <SelectionDecisionForm selectionListId={list.id} decision="APPROVE"
                      label="Approve and notify all candidates" tone="btn-primary"
                      confirm="Approve this selection list? Every candidate will be notified of their recruitment outcome. This cannot be undone." />
                    <SelectionDecisionForm selectionListId={list.id} decision="REJECT"
                      label="Return to preparing officer" requireNote />
                  </>
                ) : null}
                {list.status === 'PENDING_APPROVAL' && !canApprove ? (
                  <p className="text-xs text-slate-600">Awaiting approval by an authorised officer.</p>
                ) : null}
                {list.status === 'APPROVED' && canApprove ? (
                  <ArchiveSelectionForm selectionListId={list.id} />
                ) : null}
              </div>
            </CardBody>
          </Card>

          <Card>
            <div className="card-header"><h2 className="card-title">Vacancy fill</h2></div>
            <CardBody>
              <ul className="space-y-2">
                {fillByVacancy.map((v) => (
                  <li key={v.id} className="rounded border border-slate-200 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-800">{v.jobTitle}</span>
                      <span className={`text-xs font-bold ${v.selected >= v.positions ? 'text-kogi-700' : 'text-amber-700'}`}>
                        {v.selected}/{v.positions}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">{v.gradeLevel}</p>
                  </li>
                ))}
                {fillByVacancy.length === 0 ? (
                  <li className="text-sm text-slate-600">No active vacancies on this exercise.</li>
                ) : null}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <div className="card-header"><h2 className="card-title">Important</h2></div>
            <CardBody className="text-xs leading-relaxed text-slate-600">
              This system supports recruitment administration and records. It does not independently
              determine legal eligibility or make statutory recruitment decisions. Final approval of
              successful candidates remains with the legally authorised government authorities.
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
