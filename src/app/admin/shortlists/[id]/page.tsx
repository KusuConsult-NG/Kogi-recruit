import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePageAnyPermission } from '@/lib/page-guards';
import { hasAnyPermission, hasPermission, PERMISSIONS } from '@/lib/rbac';
import { APPLICATION_STATUS_LABELS } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import {
  Alert, Card, CardBody, DescriptionList, PageHeading, StatusBadge,
} from '@/components/ui';
import { removeShortlistEntry } from '@/actions/screening';
import { ShortlistDecisionForm } from '../decide';

export const dynamic = 'force-dynamic';

export default async function ShortlistDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageAnyPermission([PERMISSIONS.SHORTLIST_PREPARE, PERMISSIONS.SHORTLIST_APPROVE]);
  const canPrepare = hasPermission(user, PERMISSIONS.SHORTLIST_PREPARE);
  const canApprove = hasPermission(user, PERMISSIONS.SHORTLIST_APPROVE);

  const shortlist = await prisma.shortlist.findUnique({
    where: { id },
    include: {
      exercise: { select: { id: true, title: true, reference: true, requireExam: true, requireInterview: true } },
      entries: {
        orderBy: { rank: 'asc' },
        include: {
          application: {
            select: {
              id: true, reference: true, status: true, completeness: true,
              applicant: { select: { fullName: true, applicantProfile: { select: { applicantRef: true, lga: true, gender: true } } } },
              vacancy: { select: { jobTitle: true, gradeLevel: true } },
            },
          },
        },
      },
    },
  });
  if (!shortlist) notFound();

  return (
    <>
      <PageHeading
        title={shortlist.title}
        description={`${shortlist.exercise.title} (${shortlist.exercise.reference}) · ${shortlist.entries.length} candidate(s)`}
        breadcrumb={[{ label: 'Shortlists', href: '/admin/shortlists' }, { label: shortlist.title.slice(0, 40) }]}
        actions={<StatusBadge status={shortlist.status} />}
      />

      {shortlist.rejectionNote ? (
        <div className="mb-5"><Alert tone="warning" title="Returned by the approving officer">{shortlist.rejectionNote}</Alert></div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card>
            <div className="card-header">
              <h2 className="card-title">Shortlisted candidates</h2>
              <Link
                href={`/api/reports/shortlist?id=${shortlist.id}&format=pdf`}
                className="btn-secondary btn-sm"
              >
                Export to PDF
              </Link>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Rank</th><th>Reference</th><th>Candidate</th><th>Position</th><th>LGA</th><th>Status</th>
                    {canPrepare && shortlist.status === 'DRAFT' ? <th></th> : null}</tr>
                </thead>
                <tbody>
                  {shortlist.entries.map((e) => (
                    <tr key={e.id}>
                      <td className="font-semibold">{e.rank ?? '—'}</td>
                      <td className="whitespace-nowrap font-mono text-xs">
                        <Link href={`/admin/applications/${e.application.id}`} className="text-kogi-700 hover:underline">
                          {e.application.reference}
                        </Link>
                      </td>
                      <td>
                        <p className="font-medium text-ink-950">{e.application.applicant.fullName}</p>
                        <p className="text-xs text-ink-500">{e.application.applicant.applicantProfile?.applicantRef}</p>
                      </td>
                      <td className="text-xs">
                        {e.application.vacancy ? `${e.application.vacancy.jobTitle} (${e.application.vacancy.gradeLevel})` : '—'}
                      </td>
                      <td className="text-xs">{e.application.applicant.applicantProfile?.lga ?? '—'}</td>
                      <td><StatusBadge status={e.application.status} label={APPLICATION_STATUS_LABELS[e.application.status]} /></td>
                      {canPrepare && shortlist.status === 'DRAFT' ? (
                        <td>
                          <form action={removeShortlistEntry}>
                            <input type="hidden" name="entryId" value={e.id} />
                            <button type="submit" className="btn-ghost btn-sm text-[#9a2c20]">Remove</button>
                          </form>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                  {shortlist.entries.length === 0 ? (
                    <tr><td colSpan={7} className="py-6 text-center text-sm text-ink-500">No candidates on this shortlist.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="card-header"><h2 className="card-title">Shortlist details</h2></div>
            <CardBody className="space-y-3">
              <DescriptionList
                columns={1}
                items={[
                  { label: 'Status', value: <StatusBadge status={shortlist.status} /> },
                  { label: 'Candidates', value: shortlist.entries.length },
                  { label: 'Prepared', value: formatDateTime(shortlist.createdAt) },
                  { label: 'Approved', value: shortlist.approvedAt ? formatDateTime(shortlist.approvedAt) : '—' },
                  { label: 'Candidates notified', value: shortlist.notifiedAt ? formatDateTime(shortlist.notifiedAt) : 'Not yet' },
                  { label: 'Next stage', value: shortlist.exercise.requireExam ? 'Written examination' : shortlist.exercise.requireInterview ? 'Interview' : 'Final selection' },
                ]}
              />

              <div className="space-y-2 border-t border-ink-200 pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Available actions</p>
                {shortlist.status === 'DRAFT' && canPrepare ? (
                  <ShortlistDecisionForm shortlistId={shortlist.id} decision="SUBMIT"
                    label="Submit for approval" tone="btn-primary" />
                ) : null}
                {shortlist.status === 'PENDING_APPROVAL' && canApprove ? (
                  <>
                    <ShortlistDecisionForm shortlistId={shortlist.id} decision="APPROVE"
                      label="Approve and notify candidates" tone="btn-primary"
                      confirm="Approve this shortlist? Every candidate will be marked shortlisted and notified." />
                    <ShortlistDecisionForm shortlistId={shortlist.id} decision="REJECT"
                      label="Return to preparing officer" requireNote />
                  </>
                ) : null}
                {shortlist.status === 'APPROVED' ? (
                  <p className="text-xs text-ink-600">
                    This shortlist has been approved and the candidates notified. Proceed to the{' '}
                    {shortlist.exercise.requireExam ? (
                      <Link href={`/admin/examinations?exercise=${shortlist.exercise.id}`} className="text-kogi-700 underline">
                        examination stage
                      </Link>
                    ) : (
                      <Link href={`/admin/interviews?exercise=${shortlist.exercise.id}`} className="text-kogi-700 underline">
                        interview stage
                      </Link>
                    )}
                    .
                  </p>
                ) : null}
                {shortlist.status === 'PENDING_APPROVAL' && !canApprove ? (
                  <p className="text-xs text-ink-600">
                    This shortlist is awaiting approval by an authorised officer.
                  </p>
                ) : null}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
