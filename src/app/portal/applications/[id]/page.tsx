import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requirePageApplicant } from '@/lib/page-guards';
import { APPLICATION_STATUS, APPLICATION_STATUS_LABELS, DOCUMENT_TYPES, WORKFLOW_STAGES } from '@/lib/constants';
import { formatDate, formatDateTime } from '@/lib/format';
import { formatBytes } from '@/lib/storage';
import { isEditable, refreshCompleteness } from '@/lib/application-service';
import {
  Alert, Card, CardBody, DescriptionList, PageHeading, ProgressBar, StatusBadge,
} from '@/components/ui';
import { RichText } from '@/components/rich-text';
import { deleteDocument, removeEntry, withdrawApplication } from '@/actions/applications';
import {
  AdditionalDetailsForm, DocumentUploadForm, EducationForm, EmploymentForm,
  NextOfKinForm, RefereeForm, SubmitApplicationForm, type FormFieldSpec,
} from './sections';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = await prisma.application.findUnique({ where: { id }, select: { reference: true } });
  return { title: app ? `Application ${app.reference}` : 'Application' };
}

const STAGE_INDEX: Record<string, number> = {
  APPLICATION: 4, SCREENING: 5, SHORTLIST: 6, EXAMINATION: 7,
  INTERVIEW: 8, SELECTION: 9, CLOSED: 10,
};

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageApplicant();

  const application = await prisma.application.findFirst({
    where: { id, applicantId: user.id },
    include: {
      exercise: {
        include: {
          requirements: { orderBy: { position: 'asc' } },
          formFields: { where: { enabled: true }, orderBy: { position: 'asc' } },
        },
      },
      vacancy: { include: { department: { select: { name: true } } } },
      applicant: { include: { applicantProfile: true } },
      education: { orderBy: { position: 'asc' } },
      employment: { orderBy: { position: 'asc' } },
      referees: true,
      nextOfKin: true,
      documents: { orderBy: { createdAt: 'asc' } },
      screenings: { orderBy: { createdAt: 'desc' } },
      statusHistory: { orderBy: { createdAt: 'desc' } },
      examCandidates: {
        include: {
          schedule: true,
          centre: true,
        },
      },
      interviewCandidates: { include: { schedule: true, panel: { select: { name: true } } } },
      selectionEntries: { include: { selectionList: { select: { status: true, title: true } } } },
    },
  });
  if (!application) notFound();

  const completeness = await refreshCompleteness(application.id);
  const editable = isEditable(application.status);
  const profile = application.applicant.applicantProfile;
  const extraValues: Record<string, string> = application.extraData
    ? (JSON.parse(application.extraData) as Record<string, string>)
    : {};

  const uploadedByType = new Map(application.documents.map((d) => [d.docType, d]));
  const otherDocs = application.documents.filter((d) => !application.exercise.requirements.some((r) => r.code === d.docType));
  const rejectedDocs = application.documents.filter((d) =>
    ['REJECTED', 'RESUBMISSION_REQUIRED'].includes(d.reviewStatus),
  );
  const latestScreening = application.screenings[0];
  const exam = application.examCandidates[0];
  const interview = application.interviewCandidates[0];
  const selection = application.selectionEntries.find((e) => e.selectionList.status === 'APPROVED' || e.selectionList.status === 'PUBLISHED');
  const currentStage = STAGE_INDEX[application.stage] ?? 4;

  const formFields: FormFieldSpec[] = application.exercise.formFields.map((f) => ({
    key: f.key,
    label: f.label,
    section: f.section,
    inputType: f.inputType,
    options: f.options ? (JSON.parse(f.options) as string[]) : [],
    required: f.required,
    helpText: f.helpText,
  }));

  return (
    <>
      <PageHeading
        title={application.exercise.title}
        description={
          <>
            Application reference <span className="font-mono font-semibold">{application.reference}</span> ·{' '}
            {application.vacancy ? `${application.vacancy.jobTitle} (${application.vacancy.gradeLevel})` : 'No position selected'}
          </>
        }
        breadcrumb={[
          { label: 'Dashboard', href: '/portal' },
          { label: 'My Applications', href: '/portal/applications' },
          { label: application.reference },
        ]}
        actions={<StatusBadge status={application.status} label={APPLICATION_STATUS_LABELS[application.status]} />}
      />

      {application.status === APPLICATION_STATUS.SUBMITTED ? (
        <div className="mb-6">
          <Alert tone="success" title="Your application has been submitted">
            Received on {formatDateTime(application.submittedAt)}. Your application reference is{' '}
            <span className="font-mono font-semibold">{application.reference}</span> — please keep it
            safe. An acknowledgement has been sent to {application.applicant.email}.
            <span className="mt-2 block">
              Your application is now awaiting preliminary screening. You will be notified of any
              change, and this page always shows the current position. No further action is needed
              from you at this stage.
            </span>
          </Alert>
        </div>
      ) : null}

      {application.status === APPLICATION_STATUS.UNDER_SCREENING ? (
        <div className="mb-6">
          <Alert tone="info" title="Your application is being screened">
            A Commission officer is reviewing your application and documents against the approved
            criteria for this position. You will be notified of the outcome.
          </Alert>
        </div>
      ) : null}

      {application.status === APPLICATION_STATUS.QUALIFIED ? (
        <div className="mb-6">
          <Alert tone="success" title="Your application has passed screening">
            Your application met the approved criteria for this position. Shortlisting is subject to
            Commission approval, and you will be notified if you are shortlisted.
          </Alert>
        </div>
      ) : null}

      {application.status === APPLICATION_STATUS.SHORTLISTED ? (
        <div className="mb-6">
          <Alert tone="success" title="You have been shortlisted">
            Instructions for the next stage of the exercise will be sent to you. Check this page and
            your notifications for the arrangements.
          </Alert>
        </div>
      ) : null}

      {application.status === APPLICATION_STATUS.WITHDRAWN ? (
        <div className="mb-6">
          <Alert tone="info" title="This application has been withdrawn">
            Withdrawn on {formatDateTime(application.withdrawnAt)}. It will not be considered further
            in this exercise.
          </Alert>
        </div>
      ) : null}

      {application.status === APPLICATION_STATUS.RESUBMISSION_REQUIRED ? (
        <div className="mb-6">
          <Alert tone="warning" title="Correction requested">
            A screening officer has asked you to correct part of this application.
            {latestScreening?.remarks ? <span className="mt-1 block">Officer&apos;s remarks: {latestScreening.remarks}</span> : null}
            {rejectedDocs.length > 0 ? (
              <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs">
                {rejectedDocs.map((d) => (
                  <li key={d.id}>
                    <strong>{d.label}:</strong> {d.reviewNotes ?? 'Requires resubmission.'}
                  </li>
                ))}
              </ul>
            ) : null}
            <span className="mt-2 block">Re-upload the affected documents, then submit again.</span>
          </Alert>
        </div>
      ) : null}

      {application.status === APPLICATION_STATUS.DISQUALIFIED ? (
        <div className="mb-6">
          <Alert tone="error" title="Application not successful at screening">
            {latestScreening?.remarks ?? 'Your application did not meet the approved criteria for this exercise.'}
          </Alert>
        </div>
      ) : null}

      {selection ? (
        <div className="mb-6">
          <Alert tone={selection.outcome === 'SELECTED' ? 'success' : 'info'}
            title={selection.outcome === 'SELECTED' ? 'You have been recommended for appointment' : `Recruitment outcome: ${selection.outcome.replace(/_/g, ' ').toLowerCase()}`}>
            {selection.outcome === 'SELECTED'
              ? 'Formal documentation will be issued to you by the Commission. Final appointment remains subject to the approval of the legally authorised government authorities.'
              : 'Thank you for participating in this recruitment exercise. We encourage you to apply for future opportunities.'}
          </Alert>
        </div>
      ) : null}

      {/* Stage tracker */}
      <Card className="mb-6">
        <CardBody>
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-10">
            {WORKFLOW_STAGES.map((s) => {
              const done = s.n < currentStage;
              const active = s.n === currentStage;
              return (
                <li key={s.key} className="text-center">
                  <span
                    className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      done ? 'bg-kogi-600 text-white' : active ? 'bg-gold-400 text-gold-950 ring-2 ring-gold-200' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {done ? '✓' : s.n}
                  </span>
                  <span className={`mt-1.5 block text-[10px] leading-tight ${active ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>
                    {s.name}
                  </span>
                </li>
              );
            })}
          </ol>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Personal details snapshot */}
          <Card>
            <div className="card-header">
              <h2 className="card-title">1. Personal and contact details</h2>
              {editable ? <Link href="/portal/profile" className="btn-ghost btn-sm">Edit in profile</Link> : null}
            </div>
            <CardBody>
              <DescriptionList
                items={[
                  { label: 'Full name', value: profile ? `${profile.surname} ${profile.firstName} ${profile.middleName ?? ''}`.trim() : '—' },
                  { label: 'Gender', value: profile?.gender ?? '—' },
                  { label: 'Date of birth', value: formatDate(profile?.dateOfBirth) },
                  { label: 'Marital status', value: profile?.maritalStatus ?? '—' },
                  { label: 'NIN', value: profile?.nin ?? 'Not supplied' },
                  { label: 'Telephone', value: profile?.phone ?? '—' },
                  { label: 'Email', value: application.applicant.email },
                  { label: 'Residential address', value: profile?.residentialAddress ?? '—' },
                  { label: 'City / State of residence', value: profile ? `${profile.city ?? '—'}, ${profile.stateOfResidence ?? '—'}` : '—' },
                  { label: 'State / LGA of origin', value: profile ? `${profile.stateOfOrigin ?? '—'} / ${profile.lga ?? '—'}` : '—' },
                ]}
              />
            </CardBody>
          </Card>

          {/* Education */}
          <Card>
            <div className="card-header">
              <h2 className="card-title">2. Educational and professional qualifications</h2>
              <span className="badge-slate">{application.education.length} entr{application.education.length === 1 ? 'y' : 'ies'}</span>
            </div>
            <CardBody className="space-y-4">
              {application.education.length === 0 ? (
                <p className="text-sm text-slate-600">No qualifications recorded yet. At least one is required.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr><th>Institution</th><th>Qualification</th><th>Course</th><th>Grade</th><th>Years</th>{editable ? <th></th> : null}</tr>
                    </thead>
                    <tbody>
                      {application.education.map((e) => (
                        <tr key={e.id}>
                          <td className="font-medium text-slate-900">{e.institution}</td>
                          <td>{e.qualification}</td>
                          <td>{e.course ?? '—'}</td>
                          <td>{e.grade ?? '—'}</td>
                          <td className="whitespace-nowrap">{e.startYear ?? '—'} – {e.endYear ?? '—'}</td>
                          {editable ? (
                            <td>
                              <form action={removeEntry}>
                                <input type="hidden" name="kind" value="education" />
                                <input type="hidden" name="id" value={e.id} />
                                <button type="submit" className="btn-ghost btn-sm text-red-700">Remove</button>
                              </form>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {editable ? <EducationForm applicationId={application.id} /> : null}
            </CardBody>
          </Card>

          {/* Employment */}
          <Card>
            <div className="card-header">
              <h2 className="card-title">3. Employment history and experience</h2>
              <span className="badge-slate">{application.employment.length} record(s)</span>
            </div>
            <CardBody className="space-y-4">
              {application.employment.length === 0 ? (
                <p className="text-sm text-slate-600">No employment records added.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr><th>Employer</th><th>Position</th><th>Period</th><th>Responsibilities</th>{editable ? <th></th> : null}</tr>
                    </thead>
                    <tbody>
                      {application.employment.map((e) => (
                        <tr key={e.id}>
                          <td className="font-medium text-slate-900">{e.employer}</td>
                          <td>{e.jobTitle}</td>
                          <td className="whitespace-nowrap text-xs">
                            {formatDate(e.startDate)} – {e.current ? 'Present' : formatDate(e.endDate)}
                          </td>
                          <td className="max-w-xs text-xs">{e.responsibilities ?? '—'}</td>
                          {editable ? (
                            <td>
                              <form action={removeEntry}>
                                <input type="hidden" name="kind" value="employment" />
                                <input type="hidden" name="id" value={e.id} />
                                <button type="submit" className="btn-ghost btn-sm text-red-700">Remove</button>
                              </form>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {editable ? <EmploymentForm applicationId={application.id} /> : null}
            </CardBody>
          </Card>

          {/* Documents */}
          <Card>
            <div className="card-header">
              <h2 className="card-title">4. Supporting documents</h2>
              <span className="badge-slate">{application.documents.length} uploaded</span>
            </div>
            <CardBody className="space-y-4">
              {application.exercise.requirements.length === 0 ? (
                <p className="text-sm text-slate-600">No documents have been configured for this exercise.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {application.exercise.requirements.map((req) => {
                    const doc = uploadedByType.get(req.code);
                    return (
                      <li key={req.id} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {req.label}
                              {req.required ? <span className="ml-1.5 badge-red">required</span> : <span className="ml-1.5 badge-slate">optional</span>}
                            </p>
                            {req.description ? <p className="mt-0.5 text-xs text-slate-600">{req.description}</p> : null}
                          </div>
                          {doc ? <StatusBadge status={doc.reviewStatus} /> : <span className="badge-amber">not uploaded</span>}
                        </div>

                        {doc ? (
                          <div className="mt-2.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-xs">
                                <a href={`/api/files/document/${doc.id}`} target="_blank" rel="noopener"
                                  className="font-medium text-kogi-700 underline">
                                  {doc.originalName}
                                </a>
                                <span className="ml-2 text-slate-500">
                                  {formatBytes(doc.sizeBytes)} · v{doc.version} · uploaded {formatDateTime(doc.createdAt)}
                                </span>
                              </div>
                              {editable ? (
                                <form action={deleteDocument}>
                                  <input type="hidden" name="documentId" value={doc.id} />
                                  <button type="submit" className="btn-ghost btn-sm text-red-700">Remove</button>
                                </form>
                              ) : null}
                            </div>
                            {doc.reviewNotes ? (
                              <p className={`mt-1.5 text-xs ${doc.reviewStatus === 'VERIFIED' ? 'text-kogi-800' : 'text-amber-800'}`}>
                                Officer&apos;s note: {doc.reviewNotes}
                              </p>
                            ) : null}
                          </div>
                        ) : null}

                        {editable ? (
                          <div className="mt-2.5">
                            <DocumentUploadForm
                              applicationId={application.id}
                              requirementId={req.id}
                              label={req.label}
                              accept={req.acceptTypes}
                              maxMb={req.maxSizeMb}
                            />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}

              {otherDocs.length > 0 ? (
                <div className="border-t border-slate-200 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Other documents</p>
                  <ul className="mt-2 space-y-1.5">
                    {otherDocs.map((d) => (
                      <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <a href={`/api/files/document/${d.id}`} target="_blank" rel="noopener" className="text-kogi-700 underline">
                          {d.label} — {d.originalName}
                        </a>
                        <span className="flex items-center gap-2">
                          <StatusBadge status={d.reviewStatus} />
                          {editable ? (
                            <form action={deleteDocument}>
                              <input type="hidden" name="documentId" value={d.id} />
                              <button type="submit" className="btn-ghost btn-sm text-red-700">Remove</button>
                            </form>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {editable ? (
                <div className="border-t border-slate-200 pt-4">
                  <p className="mb-2 text-sm font-semibold text-slate-900">Upload another document</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {DOCUMENT_TYPES.filter((t) => !application.exercise.requirements.some((r) => r.code === t.code)).map((t) => (
                      <div key={t.code} className="rounded-md border border-slate-200 p-3">
                        <p className="mb-1.5 text-xs font-medium text-slate-800">{t.label}</p>
                        <DocumentUploadForm
                          applicationId={application.id}
                          label={t.label}
                          accept={t.accept}
                          maxMb={t.maxMb}
                          docType={t.code}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {/* Referees and NOK */}
          <Card>
            <div className="card-header"><h2 className="card-title">5. Referees and next of kin</h2></div>
            <CardBody className="space-y-5">
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-900">Referees</p>
                {application.referees.length === 0 ? (
                  <p className="text-sm text-slate-600">No referees listed.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {application.referees.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 first:pt-0">
                        <div className="text-sm">
                          <p className="font-medium text-slate-900">{r.name}</p>
                          <p className="text-xs text-slate-600">
                            {[r.occupation, r.organisation].filter(Boolean).join(', ') || '—'}
                          </p>
                          <p className="text-xs text-slate-500">{[r.phone, r.email].filter(Boolean).join(' · ')}</p>
                        </div>
                        {editable ? (
                          <form action={removeEntry}>
                            <input type="hidden" name="kind" value="referee" />
                            <input type="hidden" name="id" value={r.id} />
                            <button type="submit" className="btn-ghost btn-sm text-red-700">Remove</button>
                          </form>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                {editable && application.referees.length < 3 ? (
                  <div className="mt-3"><RefereeForm applicationId={application.id} /></div>
                ) : null}
              </div>

              <div className="border-t border-slate-200 pt-4">
                <p className="mb-2 text-sm font-semibold text-slate-900">Next of kin</p>
                {editable ? (
                  <NextOfKinForm
                    applicationId={application.id}
                    initial={
                      application.nextOfKin
                        ? {
                            name: application.nextOfKin.name,
                            relationship: application.nextOfKin.relationship,
                            phone: application.nextOfKin.phone,
                            email: application.nextOfKin.email ?? '',
                            address: application.nextOfKin.address ?? '',
                          }
                        : null
                    }
                  />
                ) : application.nextOfKin ? (
                  <DescriptionList
                    items={[
                      { label: 'Name', value: application.nextOfKin.name },
                      { label: 'Relationship', value: application.nextOfKin.relationship },
                      { label: 'Telephone', value: application.nextOfKin.phone },
                      { label: 'Email', value: application.nextOfKin.email ?? '—' },
                    ]}
                  />
                ) : (
                  <p className="text-sm text-slate-600">Not supplied.</p>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Additional */}
          <Card>
            <div className="card-header"><h2 className="card-title">6. Skills and additional information</h2></div>
            <CardBody>
              {editable ? (
                <AdditionalDetailsForm
                  applicationId={application.id}
                  skills={application.skills ?? ''}
                  fields={formFields}
                  values={extraValues}
                />
              ) : (
                <>
                  {application.skills ? <RichText body={application.skills} /> : <p className="text-sm text-slate-600">None recorded.</p>}
                  {Object.keys(extraValues).length > 0 ? (
                    <div className="mt-4 border-t border-slate-200 pt-3">
                      <DescriptionList
                        items={formFields.map((f) => ({ label: f.label, value: extraValues[f.key] ?? '—' }))}
                      />
                    </div>
                  ) : null}
                </>
              )}
            </CardBody>
          </Card>

          {/* Declaration and submit */}
          {editable ? (
            <Card>
              <div className="card-header"><h2 className="card-title">7. Declaration and submission</h2></div>
              <CardBody className="space-y-4">
                <ProgressBar value={completeness.percent} label="Application completeness"
                  tone={completeness.percent >= 100 ? 'green' : 'amber'} />
                <SubmitApplicationForm
                  applicationId={application.id}
                  canSubmit={completeness.canSubmit}
                  missing={completeness.missing}
                />
              </CardBody>
            </Card>
          ) : null}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <div className="card-header"><h2 className="card-title">Application summary</h2></div>
            <CardBody className="space-y-4">
              <ProgressBar value={completeness.percent} label="Completeness"
                tone={completeness.percent >= 100 ? 'green' : 'amber'} />
              <DescriptionList
                columns={1}
                items={[
                  { label: 'Reference', value: <span className="font-mono">{application.reference}</span> },
                  { label: 'Exercise reference', value: application.exercise.reference },
                  { label: 'Position', value: application.vacancy ? `${application.vacancy.jobTitle} (${application.vacancy.gradeLevel})` : '—' },
                  { label: 'Department', value: application.vacancy?.department?.name ?? application.vacancy?.agency ?? '—' },
                  { label: 'Status', value: <StatusBadge status={application.status} label={APPLICATION_STATUS_LABELS[application.status]} /> },
                  { label: 'Current stage', value: application.stage.replace(/_/g, ' ').toLowerCase() },
                  { label: 'Started', value: formatDateTime(application.createdAt) },
                  { label: 'Submitted', value: formatDateTime(application.submittedAt) },
                  { label: 'Closing date', value: formatDateTime(application.exercise.closesAt) },
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
                    { label: 'Examination number', value: <span className="font-mono font-semibold">{exam.examNumber}</span> },
                    { label: 'Date and time', value: `${formatDate(exam.schedule.examDate)} at ${exam.schedule.startTime}` },
                    { label: 'Centre', value: exam.centre ? `${exam.centre.name}${exam.centre.address ? ` — ${exam.centre.address}` : ''}` : 'To be advised' },
                    { label: 'Seat number', value: exam.seatNumber ?? 'To be advised' },
                    { label: 'Attendance', value: <StatusBadge status={exam.attendance} /> },
                    ...(exam.schedule.resultsPublishedAt && exam.score !== null
                      ? [{ label: 'Score', value: `${exam.score} / ${exam.schedule.totalMarks}` }]
                      : []),
                  ]}
                />
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
                    { label: 'Date', value: formatDate(interview.schedule.interviewDate) },
                    { label: 'Reporting time', value: interview.slotTime ?? interview.schedule.startTime },
                    { label: 'Venue', value: interview.schedule.venue },
                    { label: 'Panel', value: interview.panel?.name ?? 'To be advised' },
                    { label: 'Attendance', value: <StatusBadge status={interview.attendance} /> },
                  ]}
                />
                <p className="mt-3 rounded bg-purple-50 px-3 py-2 text-xs text-purple-900">
                  Bring the originals of every document uploaded with your application, together with a
                  valid means of identification.
                </p>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <div className="card-header"><h2 className="card-title">Application history</h2></div>
            <CardBody>
              {application.statusHistory.length === 0 ? (
                <p className="text-sm text-slate-600">No history recorded.</p>
              ) : (
                <ol className="space-y-3 border-l-2 border-slate-200 pl-4">
                  {application.statusHistory.map((h) => (
                    <li key={h.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-kogi-600" />
                      <p className="text-sm font-medium text-slate-800">
                        {APPLICATION_STATUS_LABELS[h.toStatus] ?? h.toStatus}
                      </p>
                      <p className="text-xs text-slate-500">{formatDateTime(h.createdAt)}</p>
                      {h.remarks ? <p className="mt-0.5 text-xs text-slate-600">{h.remarks}</p> : null}
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>

          {[APPLICATION_STATUS.DRAFT, APPLICATION_STATUS.SUBMITTED].includes(application.status as never) ? (
            <Card>
              <div className="card-header"><h2 className="card-title">Withdraw application</h2></div>
              <CardBody>
                <p className="text-xs text-slate-600">
                  Withdrawing cannot be undone. You will not be considered further in this exercise.
                </p>
                <form action={withdrawApplication} className="mt-3 space-y-2">
                  <input type="hidden" name="applicationId" value={application.id} />
                  <input name="reason" placeholder="Reason (optional)" className="input text-xs" />
                  <button type="submit" className="btn-danger btn-sm w-full">Withdraw this application</button>
                </form>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
