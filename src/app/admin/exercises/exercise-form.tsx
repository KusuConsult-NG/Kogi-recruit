'use client';

import { createExercise, updateExercise } from '@/actions/recruitment';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Field } from '@/components/ui';

export interface ExerciseValues {
  id?: string;
  title: string;
  reference: string;
  description: string;
  guidelines: string;
  eligibility: string;
  opensAt: string;
  closesAt: string;
  maxApplications: number;
  requireExam: boolean;
  requireInterview: boolean;
}

export function ExerciseForm({
  mode,
  initial,
}: {
  mode: 'create' | 'edit';
  initial?: ExerciseValues;
}) {
  return (
    <ActionForm action={mode === 'create' ? createExercise : updateExercise}>
      {(state) => (
        <>
          {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label="Exercise title" name="title" required error={state.errors?.title}>
                <input id="title" name="title" required defaultValue={initial?.title ?? ''}
                  placeholder="e.g. 2026 Civil Service Recruitment Exercise" className="input" />
              </Field>
            </div>
            <Field label="Reference number" name="reference" error={state.errors?.reference}
              hint={mode === 'create' ? 'Leave blank to generate automatically.' : undefined}>
              <input id="reference" name="reference" defaultValue={initial?.reference ?? ''} className="input" />
            </Field>
          </div>

          <Field label="Description" name="description" required error={state.errors?.description}
            hint="Shown on the public portal. Markdown-style headings, lists and links are supported.">
            <textarea id="description" name="description" required rows={5}
              defaultValue={initial?.description ?? ''} className="textarea" />
          </Field>

          <Field label="Eligibility criteria" name="eligibility" error={state.errors?.eligibility}>
            <textarea id="eligibility" name="eligibility" rows={4}
              defaultValue={initial?.eligibility ?? ''} className="textarea" />
          </Field>

          <Field label="Application guidelines" name="guidelines" error={state.errors?.guidelines}>
            <textarea id="guidelines" name="guidelines" rows={5}
              defaultValue={initial?.guidelines ?? ''} className="textarea" />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Applications open" name="opensAt" required error={state.errors?.opensAt}>
              <input id="opensAt" name="opensAt" type="datetime-local" required
                defaultValue={initial?.opensAt ?? ''} className="input" />
            </Field>
            <Field label="Applications close" name="closesAt" required error={state.errors?.closesAt}>
              <input id="closesAt" name="closesAt" type="datetime-local" required
                defaultValue={initial?.closesAt ?? ''} className="input" />
            </Field>
            <Field label="Applications per applicant" name="maxApplications" error={state.errors?.maxApplications}>
              <input id="maxApplications" name="maxApplications" type="number" min={1} max={10}
                defaultValue={initial?.maxApplications ?? 1} className="input" />
            </Field>
          </div>

          <fieldset className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-900">Assessment stages</legend>
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 text-sm text-slate-700">
                <input type="checkbox" name="requireExam" value="true"
                  defaultChecked={initial?.requireExam ?? true} className="checkbox" />
                This exercise includes a written examination
              </label>
              <label className="flex items-center gap-2.5 text-sm text-slate-700">
                <input type="checkbox" name="requireInterview" value="true"
                  defaultChecked={initial?.requireInterview ?? true} className="checkbox" />
                This exercise includes an interview
              </label>
            </div>
          </fieldset>

          <SubmitButton className="btn-primary" pendingLabel="Saving…">
            {mode === 'create' ? 'Create exercise' : 'Save changes'}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
