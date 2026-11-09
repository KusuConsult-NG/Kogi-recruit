'use client';

import {
  addEducation, addEmployment, addReferee, saveNextOfKin,
  saveAdditionalDetails, uploadDocument, submitApplication,
} from '@/actions/applications';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Field } from '@/components/ui';
import { QUALIFICATIONS } from '@/lib/constants';

export function EducationForm({ applicationId }: { applicationId: string }) {
  return (
    <ActionForm action={addEducation} resetOnSuccess className="space-y-4 rounded-md border border-ink-200 bg-ink-50/60 p-4">
      {(state) => (
        <>
          <input type="hidden" name="applicationId" value={applicationId} />
          <p className="text-sm font-semibold text-ink-950">Add a qualification</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Institution attended" name="institution" required error={state.errors?.institution}>
              <input id="institution" name="institution" required className="input" />
            </Field>
            <Field label="Qualification obtained" name="qualification" required error={state.errors?.qualification}>
              <select id="qualification" name="qualification" required className="select" defaultValue="">
                <option value="">Select…</option>
                {QUALIFICATIONS.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Field label="Course / Discipline" name="course" error={state.errors?.course}>
              <input id="course" name="course" className="input" />
            </Field>
            <Field label="Grade / Class" name="grade" error={state.errors?.grade}>
              <input id="grade" name="grade" placeholder="e.g. Second Class Upper" className="input" />
            </Field>
            <Field label="Start year" name="startYear" error={state.errors?.startYear}>
              <input id="startYear" name="startYear" type="number" min={1950} max={2100} className="input" />
            </Field>
            <Field label="End year" name="endYear" error={state.errors?.endYear}>
              <input id="endYear" name="endYear" type="number" min={1950} max={2100} className="input" />
            </Field>
          </div>
          <Field label="Certificate number" name="certificateNo" error={state.errors?.certificateNo}>
            <input id="certificateNo" name="certificateNo" className="input" />
          </Field>
          <SubmitButton className="btn-secondary btn-sm" pendingLabel="Adding…">Add qualification</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function EmploymentForm({ applicationId }: { applicationId: string }) {
  return (
    <ActionForm action={addEmployment} resetOnSuccess className="space-y-4 rounded-md border border-ink-200 bg-ink-50/60 p-4">
      {(state) => (
        <>
          <input type="hidden" name="applicationId" value={applicationId} />
          <p className="text-sm font-semibold text-ink-950">Add an employment record</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Employer" name="employer" required error={state.errors?.employer}>
              <input id="employer" name="employer" required className="input" />
            </Field>
            <Field label="Job title / Position held" name="jobTitle" required error={state.errors?.jobTitle}>
              <input id="jobTitle" name="jobTitle" required className="input" />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Start date" name="startDate" error={state.errors?.startDate}>
              <input id="startDate" name="startDate" type="date" className="input" />
            </Field>
            <Field label="End date" name="endDate" error={state.errors?.endDate}>
              <input id="endDate" name="endDate" type="date" className="input" />
            </Field>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" name="current" value="true" className="checkbox" />
                This is my current job
              </label>
            </div>
          </div>
          <Field label="Key responsibilities" name="responsibilities" error={state.errors?.responsibilities}>
            <textarea id="responsibilities" name="responsibilities" rows={3} className="textarea" />
          </Field>
          <SubmitButton className="btn-secondary btn-sm" pendingLabel="Adding…">Add employment record</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function RefereeForm({ applicationId }: { applicationId: string }) {
  return (
    <ActionForm action={addReferee} resetOnSuccess className="space-y-4 rounded-md border border-ink-200 bg-ink-50/60 p-4">
      {(state) => (
        <>
          <input type="hidden" name="applicationId" value={applicationId} />
          <p className="text-sm font-semibold text-ink-950">Add a referee</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Referee name" name="name" required error={state.errors?.name}>
              <input id="name" name="name" required className="input" />
            </Field>
            <Field label="Occupation" name="occupation" error={state.errors?.occupation}>
              <input id="occupation" name="occupation" className="input" />
            </Field>
            <Field label="Organisation" name="organisation" error={state.errors?.organisation}>
              <input id="organisation" name="organisation" className="input" />
            </Field>
            <Field label="Email address" name="email" error={state.errors?.email}>
              <input id="email" name="email" type="email" className="input" />
            </Field>
            <Field label="Telephone number" name="phone" error={state.errors?.phone}>
              <input id="phone" name="phone" type="tel" className="input" />
            </Field>
          </div>
          <Field label="Address" name="address" error={state.errors?.address}>
            <input id="address" name="address" className="input" />
          </Field>
          <SubmitButton className="btn-secondary btn-sm" pendingLabel="Adding…">Add referee</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function NextOfKinForm({
  applicationId,
  initial,
}: {
  applicationId: string;
  initial?: { name: string; relationship: string; phone: string; email: string; address: string } | null;
}) {
  return (
    <ActionForm action={saveNextOfKin}>
      {(state) => (
        <>
          <input type="hidden" name="applicationId" value={applicationId} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name" name="name" required error={state.errors?.name}>
              <input id="name" name="name" required defaultValue={initial?.name ?? ''} className="input" />
            </Field>
            <Field label="Relationship" name="relationship" required error={state.errors?.relationship}>
              <input id="relationship" name="relationship" required defaultValue={initial?.relationship ?? ''} placeholder="e.g. Spouse, Parent" className="input" />
            </Field>
            <Field label="Telephone number" name="phone" required error={state.errors?.phone}>
              <input id="phone" name="phone" type="tel" required defaultValue={initial?.phone ?? ''} className="input" />
            </Field>
            <Field label="Email address" name="email" error={state.errors?.email}>
              <input id="email" name="email" type="email" defaultValue={initial?.email ?? ''} className="input" />
            </Field>
          </div>
          <Field label="Address" name="address" error={state.errors?.address}>
            <textarea id="address" name="address" rows={2} defaultValue={initial?.address ?? ''} className="textarea" />
          </Field>
          <SubmitButton className="btn-secondary btn-sm" pendingLabel="Saving…">Save next of kin</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export interface FormFieldSpec {
  key: string;
  label: string;
  section: string;
  inputType: string;
  options: string[];
  required: boolean;
  helpText: string | null;
}

export function AdditionalDetailsForm({
  applicationId,
  skills,
  fields,
  values,
}: {
  applicationId: string;
  skills: string;
  fields: FormFieldSpec[];
  values: Record<string, string>;
}) {
  return (
    <ActionForm action={saveAdditionalDetails}>
      {(state) => (
        <>
          <input type="hidden" name="applicationId" value={applicationId} />
          <Field label="Skills and competencies" name="skills"
            hint="List relevant skills, computer literacy, languages and other competencies.">
            <textarea id="skills" name="skills" rows={4} defaultValue={skills} className="textarea" />
          </Field>

          {fields.length > 0 ? (
            <div className="space-y-3 border-t border-ink-200 pt-4">
              <p className="text-sm font-semibold text-ink-950">
                Additional information required for this exercise
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {fields.map((f) => (
                  <Field
                    key={f.key}
                    label={f.label}
                    name={`field_${f.key}`}
                    required={f.required}
                    hint={f.helpText ?? undefined}
                    error={state.errors?.[`field_${f.key}`]}
                  >
                    {f.inputType === 'textarea' ? (
                      <textarea id={`field_${f.key}`} name={`field_${f.key}`} rows={3}
                        required={f.required} defaultValue={values[f.key] ?? ''} className="textarea" />
                    ) : f.inputType === 'select' ? (
                      <select id={`field_${f.key}`} name={`field_${f.key}`} required={f.required}
                        defaultValue={values[f.key] ?? ''} className="select">
                        <option value="">Select…</option>
                        {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : f.inputType === 'checkbox' ? (
                      <label className="flex items-center gap-2 text-sm text-ink-700">
                        <input type="checkbox" id={`field_${f.key}`} name={`field_${f.key}`} value="Yes"
                          defaultChecked={values[f.key] === 'Yes'} className="checkbox" />
                        Yes
                      </label>
                    ) : (
                      <input id={`field_${f.key}`} name={`field_${f.key}`} type={f.inputType}
                        required={f.required} defaultValue={values[f.key] ?? ''} className="input" />
                    )}
                  </Field>
                ))}
              </div>
            </div>
          ) : null}

          <SubmitButton className="btn-secondary btn-sm" pendingLabel="Saving…">Save additional details</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function DocumentUploadForm({
  applicationId,
  requirementId,
  label,
  accept,
  maxMb,
  docType,
}: {
  applicationId: string;
  requirementId?: string;
  label: string;
  accept: string;
  maxMb: number;
  docType?: string;
}) {
  return (
    <ActionForm action={uploadDocument} className="space-y-2" encType="multipart/form-data">
      {() => (
        <>
          <input type="hidden" name="applicationId" value={applicationId} />
          {requirementId ? <input type="hidden" name="requirementId" value={requirementId} /> : null}
          {docType ? <input type="hidden" name="docType" value={docType} /> : null}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              name="file"
              accept={accept}
              required
              aria-label={`Upload ${label}`}
              className="block w-full max-w-xs cursor-pointer rounded-md border border-ink-300 bg-white px-2 py-1.5 text-xs file:mr-2 file:rounded file:border-0 file:bg-kogi-700 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-white"
            />
            <SubmitButton className="btn-primary btn-sm" pendingLabel="Uploading…">Upload</SubmitButton>
          </div>
          <p className="text-2xs text-ink-500">
            Accepted: {accept.replace(/application\/pdf/g, 'PDF').replace(/image\//g, '').toUpperCase()} · max {maxMb}MB
          </p>
        </>
      )}
    </ActionForm>
  );
}

export function SubmitApplicationForm({
  applicationId,
  canSubmit,
  missing,
}: {
  applicationId: string;
  canSubmit: boolean;
  missing: string[];
}) {
  return (
    <ActionForm action={submitApplication}>
      {(state) => (
        <>
          <input type="hidden" name="applicationId" value={applicationId} />
          {!canSubmit ? (
            <div className="rounded-md border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-gold-900">
              <p className="font-semibold">Your application is not yet complete.</p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs">
                {missing.map((m) => <li key={m}>{m}</li>)}
              </ul>
            </div>
          ) : null}

          <div className="space-y-2.5 rounded-md border border-ink-200 bg-ink-50 p-4">
            <label className="flex items-start gap-2.5 text-sm text-ink-700">
              <input type="checkbox" name="declaration" value="on" required className="checkbox mt-0.5" />
              <span>
                <strong>Declaration.</strong> I declare that the information supplied in this application
                is true and correct to the best of my knowledge. I understand that any false statement or
                withheld material fact may lead to the disqualification of my application or the
                withdrawal of any appointment made on its basis.
              </span>
            </label>
            {state.errors?.declaration ? <p className="error-text">{state.errors.declaration}</p> : null}

            <label className="flex items-start gap-2.5 text-sm text-ink-700">
              <input type="checkbox" name="consent" value="on" required className="checkbox mt-0.5" />
              <span>
                <strong>Consent.</strong> I consent to the Kogi State Civil Service Commission processing
                the personal information and documents in this application for the purposes of
                recruitment administration, screening, assessment and record keeping, in accordance with
                the Nigeria Data Protection Act 2023.
              </span>
            </label>
            {state.errors?.consent ? <p className="error-text">{state.errors.consent}</p> : null}
          </div>

          <SubmitButton className="btn-primary" pendingLabel="Submitting…" disabled={!canSubmit}>
            Submit my application
          </SubmitButton>
          <p className="text-xs text-ink-500">
            Once submitted, your application cannot be edited unless a screening officer requests a
            correction.
          </p>
        </>
      )}
    </ActionForm>
  );
}
