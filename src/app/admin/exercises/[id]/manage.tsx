'use client';

import {
  changeExerciseStatus, createVacancy, saveDocumentRequirement, saveFormField,
} from '@/actions/recruitment';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Field } from '@/components/ui';
import { DOCUMENT_TYPES, GRADE_LEVELS } from '@/lib/constants';

export function StatusActionForm({
  exerciseId,
  to,
  label,
  tone = 'btn-secondary',
  requireNote = false,
  notePlaceholder,
  confirm,
}: {
  exerciseId: string;
  to: string;
  label: string;
  tone?: string;
  requireNote?: boolean;
  notePlaceholder?: string;
  confirm?: string;
}) {
  return (
    <ActionForm
      action={changeExerciseStatus}
      className="space-y-2"
      onSubmit={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}
    >
      {() => (
        <>
          <input type="hidden" name="id" value={exerciseId} />
          <input type="hidden" name="status" value={to} />
          {requireNote ? (
            <input name="note" required placeholder={notePlaceholder ?? 'Reason'} className="input text-xs" />
          ) : null}
          <SubmitButton className={`${tone} btn-sm w-full`} pendingLabel="Working…">{label}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function VacancyForm({
  exerciseId,
  departments,
}: {
  exerciseId: string;
  departments: Array<{ id: string; name: string }>;
}) {
  return (
    <ActionForm action={createVacancy} resetOnSuccess className="space-y-4 rounded-md border border-slate-200 bg-slate-50/60 p-4">
      {(state) => (
        <>
          <input type="hidden" name="exerciseId" value={exerciseId} />
          <p className="text-sm font-semibold text-slate-900">Add an approved vacancy</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Field label="Job title" name="jobTitle" required error={state.errors?.jobTitle}>
                <input id="jobTitle" name="jobTitle" required className="input" />
              </Field>
            </div>
            <Field label="Grade level" name="gradeLevel" required error={state.errors?.gradeLevel}>
              <select id="gradeLevel" name="gradeLevel" required className="select" defaultValue="">
                <option value="">Select…</option>
                {GRADE_LEVELS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Number of posts" name="positions" required error={state.errors?.positions}>
              <input id="positions" name="positions" type="number" min={1} defaultValue={1} required className="input" />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Department / Unit" name="departmentId" error={state.errors?.departmentId}>
              <select id="departmentId" name="departmentId" className="select" defaultValue="">
                <option value="">Not specified</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Agency / MDA" name="agency" error={state.errors?.agency}
              hint="Use where the post sits outside the Commission's own departments.">
              <input id="agency" name="agency" className="input" />
            </Field>
          </div>
          <Field label="Qualification requirements" name="qualifications" required error={state.errors?.qualifications}
            hint="Name the qualifications explicitly (e.g. “HND or B.Sc in a relevant discipline”) so preliminary checks can assist officers.">
            <textarea id="qualifications" name="qualifications" rows={2} required className="textarea" />
          </Field>
          <Field label="Experience requirements" name="experience" error={state.errors?.experience}
            hint="State a minimum in years (e.g. “minimum of 3 years post-qualification experience”).">
            <input id="experience" name="experience" className="input" />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Minimum age" name="minAge" error={state.errors?.minAge}>
              <input id="minAge" name="minAge" type="number" min={15} max={70} className="input" />
            </Field>
            <Field label="Maximum age" name="maxAge" error={state.errors?.maxAge}>
              <input id="maxAge" name="maxAge" type="number" min={15} max={70} className="input" />
            </Field>
          </div>
          <Field label="Job description" name="description" error={state.errors?.description}>
            <textarea id="description" name="description" rows={2} className="textarea" />
          </Field>
          <SubmitButton className="btn-secondary btn-sm" pendingLabel="Adding…">Add vacancy</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function RequirementForm({ exerciseId }: { exerciseId: string }) {
  return (
    <ActionForm action={saveDocumentRequirement} resetOnSuccess className="space-y-3 rounded-md border border-slate-200 bg-slate-50/60 p-4">
      {(state) => (
        <>
          <input type="hidden" name="exerciseId" value={exerciseId} />
          <p className="text-sm font-semibold text-slate-900">Add or update a required document</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Document type" name="code" required error={state.errors?.code}>
              <select id="code" name="code" required className="select" defaultValue="">
                <option value="">Select…</option>
                {DOCUMENT_TYPES.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Label shown to applicants" name="label" required error={state.errors?.label}>
              <input id="label" name="label" required className="input" />
            </Field>
          </div>
          <Field label="Guidance note" name="description" error={state.errors?.description}>
            <input id="description" name="description" className="input" />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Maximum size (MB)" name="maxSizeMb" error={state.errors?.maxSizeMb}>
              <input id="maxSizeMb" name="maxSizeMb" type="number" min={1} max={20} defaultValue={5} className="input" />
            </Field>
            <Field label="Accepted file types" name="acceptTypes" error={state.errors?.acceptTypes}>
              <select id="acceptTypes" name="acceptTypes" className="select"
                defaultValue="application/pdf,image/jpeg,image/png">
                <option value="application/pdf,image/jpeg,image/png">PDF, JPEG or PNG</option>
                <option value="application/pdf">PDF only</option>
                <option value="image/jpeg,image/png">Image only</option>
              </select>
            </Field>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="required" value="true" defaultChecked className="checkbox" />
                Mandatory
              </label>
            </div>
          </div>
          <SubmitButton className="btn-secondary btn-sm" pendingLabel="Saving…">Save requirement</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function FormFieldForm({ exerciseId }: { exerciseId: string }) {
  return (
    <ActionForm action={saveFormField} resetOnSuccess className="space-y-3 rounded-md border border-slate-200 bg-slate-50/60 p-4">
      {() => (
        <>
          <input type="hidden" name="exerciseId" value={exerciseId} />
          <p className="text-sm font-semibold text-slate-900">Add a custom application form field</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Field key" name="key" required hint="Letters, numbers and underscores only.">
              <input id="key" name="key" required placeholder="e.g. driving_licence_no" className="input" />
            </Field>
            <Field label="Label shown to applicants" name="label" required>
              <input id="label" name="label" required className="input" />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Section" name="section">
              <select id="section" name="section" className="select" defaultValue="OTHER">
                {['PERSONAL', 'CONTACT', 'ORIGIN', 'EDUCATION', 'EMPLOYMENT', 'OTHER', 'DECLARATION'].map((s) => (
                  <option key={s} value={s}>{s.toLowerCase()}</option>
                ))}
              </select>
            </Field>
            <Field label="Input type" name="inputType">
              <select id="inputType" name="inputType" className="select" defaultValue="text">
                {['text', 'textarea', 'select', 'date', 'number', 'email', 'tel', 'checkbox'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="required" value="true" className="checkbox" />
                Mandatory
              </label>
            </div>
          </div>
          <Field label="Options" name="options" hint="Comma-separated; required for a select field.">
            <input id="options" name="options" className="input" />
          </Field>
          <Field label="Help text" name="helpText">
            <input id="helpText" name="helpText" className="input" />
          </Field>
          <SubmitButton className="btn-secondary btn-sm" pendingLabel="Saving…">Save field</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
