'use client';

import { recordScreening, reviewDocument } from '@/actions/screening';
import { sendDirectMessage } from '@/actions/comms';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Field } from '@/components/ui';

export interface AutoCheckView {
  key: string;
  label: string;
  pass: boolean;
  detail: string;
  advisory?: boolean;
}

export function ScreeningForm({
  applicationId,
  autoChecks,
  suggestedOutcome,
  suggestedClassification,
}: {
  applicationId: string;
  autoChecks: AutoCheckView[];
  suggestedOutcome: string;
  suggestedClassification: string;
}) {
  return (
    <ActionForm action={recordScreening}>
      {(state) => (
        <>
          <input type="hidden" name="applicationId" value={applicationId} />

          <div className="rounded-md border border-sky-200 bg-sky-50 p-4">
            <p className="text-sm font-semibold text-sky-900">Preliminary automated checks</p>
            <p className="mt-0.5 text-xs text-sky-800">
              These checks assist your review. The final decision is yours and is recorded against your name.
            </p>
            <ul className="mt-3 space-y-1.5">
              {autoChecks.map((c) => (
                <li key={c.key} className="flex items-start gap-2 text-xs">
                  <span className={c.pass ? 'badge-green' : c.advisory ? 'badge-slate' : 'badge-red'}>
                    {c.pass ? 'pass' : c.advisory ? 'review' : 'fail'}
                  </span>
                  <span>
                    <span className="font-medium text-slate-800">{c.label}</span>
                    <span className="ml-1 text-slate-600">— {c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs font-medium text-sky-900">
              Suggested outcome: {suggestedOutcome.replace(/_/g, ' ').toLowerCase()} ({suggestedClassification.replace(/_/g, ' ').toLowerCase()})
            </p>
          </div>

          <fieldset className="space-y-2 rounded-md border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-900">Officer's assessment</legend>
            {[
              { name: 'completenessPass', label: 'Application is complete' },
              { name: 'eligibilityPass', label: 'Applicant is eligible for the post' },
              { name: 'qualificationPass', label: 'Qualification requirements met' },
              { name: 'experiencePass', label: 'Experience requirements met' },
              { name: 'documentsPass', label: 'Supporting documents are in order' },
            ].map((item) => (
              <label key={item.name} className="flex items-center gap-2.5 text-sm text-slate-700">
                <input type="checkbox" name={item.name} value="true" className="checkbox" />
                {item.label}
              </label>
            ))}
          </fieldset>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Screening outcome" name="outcome" required error={state.errors?.outcome}>
              <select id="outcome" name="outcome" required className="select" defaultValue={suggestedOutcome}>
                <option value="PASSED">Passed — qualified for the next stage</option>
                <option value="RESUBMISSION_REQUIRED">Correction required — return to applicant</option>
                <option value="FAILED">Failed — disqualified</option>
              </select>
            </Field>
            <Field label="Classification" name="classification" error={state.errors?.classification}>
              <select id="classification" name="classification" className="select" defaultValue={suggestedClassification}>
                <option value="QUALIFIED">Qualified</option>
                <option value="UNDER_QUALIFIED">Under-qualified</option>
                <option value="INCOMPLETE">Incomplete</option>
                <option value="DISQUALIFIED">Disqualified</option>
              </select>
            </Field>
          </div>

          <Field label="Screening remarks" name="remarks" error={state.errors?.remarks}
            hint="Required when failing an application or requesting a correction. Shared with the applicant.">
            <textarea id="remarks" name="remarks" rows={3} className="textarea" />
          </Field>

          <SubmitButton className="btn-primary" pendingLabel="Recording…">Record screening outcome</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function DocumentReviewForm({
  documentId,
  currentStatus,
}: {
  documentId: string;
  currentStatus: string;
}) {
  return (
    <ActionForm action={reviewDocument} className="space-y-2">
      {(state) => (
        <>
          <input type="hidden" name="documentId" value={documentId} />
          <div className="flex flex-wrap items-center gap-2">
            <select name="outcome" className="select max-w-[11rem] text-xs" defaultValue={
              currentStatus === 'PENDING' ? 'VERIFIED' : currentStatus
            }>
              <option value="VERIFIED">Verify</option>
              <option value="RESUBMISSION_REQUIRED">Request correction</option>
              <option value="REJECTED">Reject</option>
            </select>
            <input name="notes" placeholder="Remarks (required unless verifying)" className="input max-w-sm text-xs" />
            <SubmitButton className="btn-primary btn-sm" pendingLabel="Saving…">Save</SubmitButton>
          </div>
          {state.errors?.notes ? <p className="error-text">{state.errors.notes}</p> : null}
          {state.message ? (
            <p className={`text-xs ${state.ok ? 'text-kogi-800' : 'text-red-700'}`}>{state.message}</p>
          ) : null}
        </>
      )}
    </ActionForm>
  );
}

export function DirectMessageForm({ applicantId }: { applicantId: string }) {
  return (
    <ActionForm action={sendDirectMessage} resetOnSuccess>
      {(state) => (
        <>
          <input type="hidden" name="applicantId" value={applicantId} />
          <Field label="Subject" name="subject" required error={state.errors?.subject}>
            <input id="subject" name="subject" required className="input text-sm" />
          </Field>
          <Field label="Message" name="body" required error={state.errors?.body}>
            <textarea id="body" name="body" rows={4} required className="textarea text-sm" />
          </Field>
          <Field label="Channel" name="channel">
            <select id="channel" name="channel" className="select text-sm" defaultValue="EMAIL">
              <option value="EMAIL">Email</option>
              <option value="SMS">SMS</option>
              <option value="BOTH">Email and SMS</option>
            </select>
          </Field>
          <SubmitButton className="btn-secondary btn-sm" pendingLabel="Sending…">Send message</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
