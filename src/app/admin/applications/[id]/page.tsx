import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/page-guards';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { APPLICATION_STATUS_LABELS } from '@/lib/constants';
import { age, formatDate, formatDateTime } from '@/lib/format';
import { formatBytes } from '@/lib/storage';
import { runAutoChecks, yearsOfExperience } from '@/lib/screening';
import {
  Alert, Card, CardBody, DescriptionList, PageHeading, ProgressBar, StatusBadge,
} from '@/components/ui';
import { RichText } from '@/components/rich-text';
import { DirectMessageForm, DocumentReviewForm, ScreeningForm } from './review';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = await prisma.application.findUnique({ where: { id }, select: { reference: true } });
  return { title: app ? `Application ${app.reference}` : 'Application' };
}

/** Modules 2.3–2.5 - officer view of a single application. */
export default async function AdminApplicationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePagePermission(PERMISSIONS.APPLICATION_VIEW);
  const canScreen = hasPermission(user, PERMISSIONS.SCREENING_PERFORM);
  const canReviewDocs = hasPermission(user, PERMISSIONS.DOCUMENT_REVIEW);
  const canMessage = hasPermission(user, PERMISSIONS.NOTIFICATION_SEND);

  const application = await prisma.application.findUnique({
    where: { id },
    include: {
      exercise: { include: { requirements: { orderBy: { position: 'asc' } }, formFields: { orderBy: { position: 'asc' } } } },
      vacancy: { include: { department: { select: { name: true } } } },
      applicant: { include: { applicantProfile: true } },
      education: { orderBy: { position: 'asc' } },
      employment: { orderBy: { position: 'asc' } },
      referees: true,
      nextOfKin: true,
      documents: { orderBy: { createdAt: 'asc' }, include: { reviews: { orderBy: { createdAt: 'desc' }, include: { officer: { select: { fullName: true } } } } } },
      screenings: { orderBy: { createdAt: 'desc' }, include: { officer: { select: { fullName: true, role: true } } } },
      assignments: { include: { officer: { select: { fullName: true } } } },
      statusHistory: { orderBy: { createdAt: 'desc' } },
      examCandidates: { include: { schedule: true, centre: true } },
      interviewCandidates: {
        include: {
          schedule: true, panel: { select: { name: true } },
          scores: { include: { member: { select: { fullName: true } } } },
        },
      },
      selectionEntries: { include: { selectionList: { select: { title: true, status: true } } } },
    },
  });
  if (!application) notFound();

  const profile = application.applicant.applicantProfile;
  const required = application.exercise.requirements.filter((r) => r.required);
  const uploadedCodes = new Set(application.documents.map((d) => d.docType));
  const autoChecks = runAutoChecks({
    completenessPercent: application.completeness,
    applicantAge: age(profile?.dateOfBirth),
    vacancy: application.vacancy,
    qualifications: application.education.map((e) => e.qualification),
    experienceYears: yearsOfExperience(application.employment),
    requiredDocsTotal: required.length,
    requiredDocsVerifiedOrPending: required.filter((r) => uploadedCodes.has(r.code)).length,
    rejectedDocs: application.documents.filter((d) => ['REJECTED', 'RESUBMISSION_REQUIRED'].includes(d.reviewStatus)).length,
  });

  const extraValues: Record<string, string> = application.extraData
    ? (JSON.parse(application.extraData) as Record<string, string>)
    : {};
  const exam = application.examCandidates[0];
  const interview = application.interviewCandidates[0];
  const selection = application.selectionEntries[0];
  const experienceYears = yearsOfExperience(application.employment);

  return (
    <>
      <PageHeading
        title={`${profile ? `${profile.surname} ${profile.firstName}` : application.applicant.fullName}`}
        description={
          <>
            Application <span className="font-mono font-semibold">{application.reference}</span> ·{' '}
            {application.exercise.title} ({application.exercise.reference})
          </>
        }
        breadcrumb={[
          { label: 'Applications', href: '/admin/applications' },
          { label: application.reference },
        ]}
        actions={<StatusBadge status={application.status} label={APPLICATION_STATUS_LABELS[application.status]} />}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <div className="card-header">
              <h2 className="card-title">Applicant details</h2>
              <span className="badge-slate">{profile?.applicantRef}</span>
            </div>
            <CardBody>
              <DescriptionList
                columns={3}
                items={[
                  { label: 'Surname', value: profile?.surname ?? '—' },
                  { label: 'First name', value: profile?.firstName ?? '—' },
                  { label: 'Middle name', value: profile?.middleName ?? '—' },
                  { label: 'Gender', value: profile?.gender ?? '—' },
                  { label: 'Date of birth', value: profile?.dateOfBirth ? `${formatDate(profile.dateOfBirth)} (${age(profile.dateOfBirth)} years)` : '—' },
                  { label: 'Marital status', value: profile?.maritalStatus ?? '—' },
                  { label: 'NIN', value: profile?.nin ?? 'Not supplied' },
                  { label: 'Telephone', value: profile?.phone ?? '—' },
                  { label: 'Alternative telephone', value: profile?.altPhone ?? '—' },
                  { label: 'Email', value: application.applicant.email },
                  { label: 'State of origin', value: profile?.stateOfOrigin ?? '—' },
                  { label: 'LGA of origin', value: profile?.lga ?? '—' },
                  { label: 'State of residence', value: profile?.stateOfResidence ?? '—' },
                  { label: 'City / Town', value: profile?.city ?? '—' },
                  { label: 'Disability / special requirements', value: profile?.disability ?? 'None declared' },
                ]}
              />
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Residential address</p>
                <p className="mt-0.5 text-sm text-slate-800">{profile?.residentialAddress ?? '—'}</p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <div className="card-header">
              <h2 className="card-title">Qualifications</h2>
              <span className="badge-slate">{application.education.length} entr{application.education.length === 1 ? 'y' : 'ies'}</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Institution</th><th>Qualification</th><th>Course</th><th>Grade</th><th>Years</th><th>Certificate no.</th></tr>
                </thead>
                <tbody>
                  {application.education.map((e) => (
                    <tr key={e.id}>
                      <td className="font-medium text-slate-900">{e.institution}</td>
                      <td>{e.qualification}</td>
                      <td>{e.course ?? '—'}</td>
                      <td>{e.grade ?? '—'}</td>
                      <td className="whitespace-nowrap">{e.startYear ?? '—'} – {e.endYear ?? '—'}</td>
                      <td className="text-xs">{e.certificateNo ?? '—'}</td>
                    </tr>
                  ))}
                  {application.education.length === 0 ? (
                    <tr><td colSpan={6} className="py-4 text-center text-sm text-slate-500">No qualifications recorded.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <div className="card-header">
              <h2 className="card-title">Employment history</h2>
              <span className="badge-slate">{experienceYears} year(s) total</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Employer</th><th>Position</th><th>Period</th><th>Responsibilities</th></tr></thead>
                <tbody>
                  {application.employment.map((e) => (
                    <tr key={e.id}>
                      <td className="font-medium text-slate-900">{e.employer}</td>
                      <td>{e.jobTitle}</td>
                      <td className="whitespace-nowrap text-xs">
                        {formatDate(e.startDate)} – {e.current ? 'Present' : formatDate(e.endDate)}
                      </td>
                      <td className="max-w-sm text-xs">{e.responsibilities ?? '—'}</td>
                    </tr>
                  ))}
                  {application.employment.length === 0 ? (
                    <tr><td colSpan={4} className="py-4 text-center text-sm text-slate-500">No employment history recorded.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Documents */}
          <Card>
            <div className="card-header">
              <h2 className="card-title">Supporting documents</h2>
              <span className="badge-slate">
                {application.documents.filter((d) => d.reviewStatus === 'VERIFIED').length} of {application.documents.length} verified
              </span>
            </div>
            <CardBody>
              {application.documents.length === 0 ? (
                <p className="text-sm text-slate-600">No documents uploaded.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {application.documents.map((d) => (
                    <li key={d.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {d.label}
                            {d.version > 1 ? <span className="ml-1.5 badge-slate">version {d.version}</span> : null}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {d.originalName} · {formatBytes(d.sizeBytes)} · uploaded {formatDateTime(d.createdAt)}
                          </p>
                          {d.reviewNotes ? (
                            <p className="mt-1 text-xs text-amber-800">Remarks: {d.reviewNotes}</p>
                          ) : null}
                          {d.reviews.length > 0 ? (
                            <ul className="mt-1.5 space-y-0.5">
                              {d.reviews.slice(0, 3).map((r) => (
                                <li key={r.id} className="text-[11px] text-slate-500">
                                  {r.outcome.replace(/_/g, ' ').toLowerCase()} by {r.officer?.fullName ?? 'officer'} · {formatDateTime(r.createdAt)}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={d.reviewStatus} />
                          <a href={`/api/files/document/${d.id}`} target="_blank" rel="noopener" className="btn-secondary btn-sm">
                            Open
                          </a>
                        </div>
                      </div>
                      {canReviewDocs ? (
                        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                          <DocumentReviewForm documentId={d.id} currentStatus={d.reviewStatus} />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              {required.length > 0 ? (
                <div className="mt-4 border-t border-slate-200 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Required documents check</p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {required.map((r) => (
                      <li key={r.id} className={uploadedCodes.has(r.code) ? 'badge-green' : 'badge-red'}>
                        {r.label}: {uploadedCodes.has(r.code) ? 'attached' : 'missing'}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {/* Referees / NOK / extras */}
          <Card>
            <div className="card-header"><h2 className="card-title">Referees, next of kin and additional information</h2></div>
            <CardBody className="space-y-5">
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-900">Referees</p>
                {application.referees.length === 0 ? (
                  <p className="text-sm text-slate-600">None listed.</p>
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead><tr><th>Name</th><th>Occupation</th><th>Organisation</th><th>Contact</th></tr></thead>
                      <tbody>
                        {application.referees.map((r) => (
                          <tr key={r.id}>
                            <td className="font-medium text-slate-900">{r.name}</td>
                            <td>{r.occupation ?? '—'}</td>
                            <td>{r.organisation ?? '—'}</td>
                            <td className="text-xs">{[r.phone, r.email].filter(Boolean).join(' · ') || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="mb-2 text-sm font-semibold text-slate-900">Next of kin</p>
                {application.nextOfKin ? (
                  <DescriptionList
                    items={[
                      { label: 'Name', value: application.nextOfKin.name },
                      { label: 'Relationship', value: application.nextOfKin.relationship },
                      { label: 'Telephone', value: application.nextOfKin.phone },
                      { label: 'Email', value: application.nextOfKin.email ?? '—' },
                      { label: 'Address', value: application.nextOfKin.address ?? '—' },
                    ]}
                  />
                ) : (
                  <p className="text-sm text-slate-600">Not supplied.</p>
                )}
              </div>

              {application.skills || Object.keys(extraValues).length > 0 ? (
                <div className="border-t border-slate-100 pt-4">
                  <p className="mb-2 text-sm font-semibold text-slate-900">Skills and additional information</p>
                  {application.skills ? <RichText body={application.skills} /> : null}
                  {Object.keys(extraValues).length > 0 ? (
                    <div className="mt-3">
                      <DescriptionList
                        items={application.exercise.formFields.map((f) => ({
                          label: f.label,
                          value: extraValues[f.key] ?? '—',
                        }))}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500">
                  Declaration confirmed: {application.declaration ? 'yes' : 'no'} · Data-processing consent:{' '}
                  {application.consent ? 'yes' : 'no'}
                </p>
              </div>
            </CardBody>
          </Card>

          {/* Screening */}
          {canScreen ? (
            <Card>
              <div className="card-header">
                <h2 className="card-title">Record a screening outcome</h2>
                <span className="badge-slate">Module 2.5</span>
              </div>
              <CardBody>
                {['DRAFT'].includes(application.status) ? (
                  <Alert tone="info">
                    This application has not yet been submitted by the applicant, so it cannot be screened.
                  </Alert>
                ) : (
                  <ScreeningForm
                    applicationId={application.id}
                    autoChecks={autoChecks.checks}
                    suggestedOutcome={autoChecks.suggestedOutcome}
                    suggestedClassification={autoChecks.suggestedClassification}
                  />
                )}
              </CardBody>
            </Card>
          ) : null}

          {application.screenings.length > 0 ? (
            <Card>
              <div className="card-header"><h2 className="card-title">Screening history</h2></div>
              <CardBody>
                <ul className="space-y-4">
                  {application.screenings.map((s) => (
                    <li key={s.id} className="rounded-md border border-slate-200 p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {s.outcome.replace(/_/g, ' ')} — {s.classification?.replace(/_/g, ' ').toLowerCase() ?? 'unclassified'}
                        </p>
                        <StatusBadge status={s.outcome === 'PASSED' ? 'VERIFIED' : s.outcome === 'FAILED' ? 'REJECTED' : 'PENDING'}
                          label={s.outcome.replace(/_/g, ' ').toLowerCase()} />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {s.officer?.fullName ?? 'Officer'} · {formatDateTime(s.createdAt)}
                      </p>
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {[
                          ['Complete', s.completenessPass],
                          ['Eligible', s.eligibilityPass],
                          ['Qualification', s.qualificationPass],
                          ['Experience', s.experiencePass],
                          ['Documents', s.documentsPass],
                        ].map(([label, pass]) => (
                          <li key={String(label)} className={pass ? 'badge-green' : 'badge-slate'}>
                            {String(label)}: {pass ? 'yes' : 'no'}
                          </li>
                        ))}
                      </ul>
                      {s.remarks ? <p className="mt-2 text-sm text-slate-700">{s.remarks}</p> : null}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <div className="card-header"><h2 className="card-title">Application summary</h2></div>
            <CardBody className="space-y-4">
              <ProgressBar value={application.completeness} label="Completeness"
                tone={application.completeness >= 100 ? 'green' : 'amber'} />
              <DescriptionList
                columns={1}
                items={[
                  { label: 'Reference', value: <span className="font-mono">{application.reference}</span> },
                  { label: 'Position applied for', value: application.vacancy ? `${application.vacancy.jobTitle} (${application.vacancy.gradeLevel})` : '—' },
                  { label: 'Department / Agency', value: application.vacancy?.department?.name ?? application.vacancy?.agency ?? '—' },
                  { label: 'Current stage', value: application.stage.replace(/_/g, ' ').toLowerCase() },
                  { label: 'Started', value: formatDateTime(application.createdAt) },
                  { label: 'Submitted', value: formatDateTime(application.submittedAt) },
                  { label: 'Screened', value: formatDateTime(application.screeningAt) },
                  { label: 'Examination score', value: application.examScore ?? '—' },
                  { label: 'Interview score', value: application.interviewScore ?? '—' },
                  { label: 'Final score', value: application.finalScore ?? '—' },
                  {
                    label: 'Screening officer(s)',
                    value: application.assignments.length
                      ? application.assignments.map((a) => a.officer.fullName).join(', ')
                      : 'Unassigned',
                  },
                ]}
              />
            </CardBody>
          </Card>

          {exam ? (
            <Card>
              <div className="card-header"><h2 className="card-title">Examination</h2></div>
              <CardBody>
                <DescriptionList
                  columns={1}
                  items={[
                    { label: 'Examination', value: exam.schedule.title },
                    { label: 'Examination number', value: <span className="font-mono">{exam.examNumber}</span> },
                    { label: 'Date', value: `${formatDate(exam.schedule.examDate)} at ${exam.schedule.startTime}` },
                    { label: 'Centre', value: exam.centre?.name ?? 'Unassigned' },
                    { label: 'Seat', value: exam.seatNumber ?? '—' },
                    { label: 'Attendance', value: <StatusBadge status={exam.attendance} /> },
                    { label: 'Score', value: exam.score !== null ? `${exam.score} / ${exam.schedule.totalMarks}` : '—' },
                    { label: 'Validated', value: exam.validated ? 'yes' : 'no' },
                  ]}
                />
                <Link href={`/admin/examinations/${exam.scheduleId}`} className="btn-secondary btn-sm mt-3 w-full">
                  Open examination
                </Link>
              </CardBody>
            </Card>
          ) : null}

          {interview ? (
            <Card>
              <div className="card-header"><h2 className="card-title">Interview</h2></div>
              <CardBody>
                <DescriptionList
                  columns={1}
                  items={[
                    { label: 'Interview', value: interview.schedule.title },
                    { label: 'Date and time', value: `${formatDate(interview.schedule.interviewDate)} at ${interview.slotTime ?? interview.schedule.startTime}` },
                    { label: 'Venue', value: interview.schedule.venue },
                    { label: 'Panel', value: interview.panel?.name ?? '—' },
                    { label: 'Attendance', value: <StatusBadge status={interview.attendance} /> },
                    { label: 'Consolidated score', value: interview.consolidatedScore !== null ? `${interview.consolidatedScore} / ${interview.schedule.totalMarks}` : '—' },
                  ]}
                />
                {interview.scores.length > 0 ? (
                  <ul className="mt-3 space-y-1 border-t border-slate-100 pt-2">
                    {interview.scores.map((s) => (
                      <li key={s.id} className="flex justify-between text-xs">
                        <span className="text-slate-600">{s.member.fullName}</span>
                        <span className="font-semibold text-slate-900">{s.total}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <Link href={`/admin/interviews/${interview.scheduleId}`} className="btn-secondary btn-sm mt-3 w-full">
                  Open interview
                </Link>
              </CardBody>
            </Card>
          ) : null}

          {selection ? (
            <Card>
              <div className="card-header"><h2 className="card-title">Recruitment outcome</h2></div>
              <CardBody>
                <DescriptionList
                  columns={1}
                  items={[
                    { label: 'Selection list', value: selection.selectionList.title },
                    { label: 'List status', value: <StatusBadge status={selection.selectionList.status} /> },
                    { label: 'Rank', value: selection.rank ?? '—' },
                    { label: 'Final score', value: selection.finalScore ?? '—' },
                    { label: 'Outcome', value: <StatusBadge status={selection.outcome} /> },
                    { label: 'Remarks', value: selection.remarks ?? '—' },
                  ]}
                />
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <div className="card-header"><h2 className="card-title">Status history</h2></div>
            <CardBody>
              <ol className="space-y-3 border-l-2 border-slate-200 pl-4">
                {application.statusHistory.map((h) => (
                  <li key={h.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-kogi-600" />
                    <p className="text-sm font-medium text-slate-800">
                      {APPLICATION_STATUS_LABELS[h.toStatus] ?? h.toStatus}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(h.createdAt)} · {h.changedByName ?? 'System'}
                    </p>
                    {h.remarks ? <p className="mt-0.5 text-xs text-slate-600">{h.remarks}</p> : null}
                  </li>
                ))}
                {application.statusHistory.length === 0 ? (
                  <li className="text-sm text-slate-600">No history recorded.</li>
                ) : null}
              </ol>
            </CardBody>
          </Card>

          {canMessage ? (
            <Card>
              <div className="card-header"><h2 className="card-title">Message this applicant</h2></div>
              <CardBody><DirectMessageForm applicantId={application.applicantId} /></CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
