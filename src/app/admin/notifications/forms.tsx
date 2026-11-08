'use client';

import {
  createNotificationBatch, dispatchNotificationBatch, saveTemplate, sendDirectMessage,
} from '@/actions/comms';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Field } from '@/components/ui';
import { APPLICATION_STATUS, APPLICATION_STATUS_LABELS } from '@/lib/constants';

export function BatchForm({ exercises }: { exercises: Array<{ id: string; label: string }> }) {
  return (
    <ActionForm action={createNotificationBatch} resetOnSuccess>
      {(state) => (
        <>
          <Field label="Batch title" name="title" required error={state.errors?.title}
            hint="An internal reference for this batch.">
            <input name="title" required className="input" />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Recruitment exercise" name="exerciseId"
              hint="Leave blank to address every registered applicant.">
              <select name="exerciseId" className="select" defaultValue="">
                <option value="">All registered applicants</option>
                {exercises.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select>
            </Field>
            <Field label="Application status" name="audienceStatus"
              hint="Narrow the audience to applicants at a particular stage.">
              <select name="audienceStatus" className="select" defaultValue="">
                <option value="">Any status</option>
                {Object.values(APPLICATION_STATUS).map((s) => (
                  <option key={s} value={s}>{APPLICATION_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Channel" name="channel">
            <select name="channel" className="select" defaultValue="EMAIL">
              <option value="EMAIL">Email</option>
              <option value="SMS">SMS (gateway charges apply)</option>
              <option value="BOTH">Email and SMS</option>
            </select>
          </Field>
          <Field label="Subject" name="subject" required error={state.errors?.subject}>
            <input name="subject" required className="input" />
          </Field>
          <Field label="Message" name="body" required error={state.errors?.body}
            hint="Use {{name}} to insert each recipient's name.">
            <textarea name="body" rows={7} required className="textarea" />
          </Field>
          <SubmitButton className="btn-primary" pendingLabel="Preparing…">Prepare batch</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function BatchActionForm({
  batchId,
  decision,
  label,
  tone = 'btn-secondary',
  confirm,
}: {
  batchId: string;
  decision: 'SEND' | 'REJECT';
  label: string;
  tone?: string;
  confirm?: string;
}) {
  return (
    <ActionForm
      action={dispatchNotificationBatch}
      className="inline"
      onSubmit={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}
    >
      {() => (
        <>
          <input type="hidden" name="batchId" value={batchId} />
          <input type="hidden" name="decision" value={decision} />
          <SubmitButton className={`${tone} btn-sm`} pendingLabel="Working…">{label}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function DirectForm({ applicants }: { applicants: Array<{ id: string; label: string }> }) {
  return (
    <ActionForm action={sendDirectMessage} resetOnSuccess>
      {(state) => (
        <>
          <Field label="Applicant" name="applicantId" required>
            <select name="applicantId" required className="select" defaultValue="">
              <option value="">Select an applicant…</option>
              {applicants.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </Field>
          <Field label="Channel" name="channel">
            <select name="channel" className="select" defaultValue="EMAIL">
              <option value="EMAIL">Email</option>
              <option value="SMS">SMS</option>
              <option value="BOTH">Email and SMS</option>
            </select>
          </Field>
          <Field label="Subject" name="subject" required error={state.errors?.subject}>
            <input name="subject" required className="input" />
          </Field>
          <Field label="Message" name="body" required error={state.errors?.body}>
            <textarea name="body" rows={5} required className="textarea" />
          </Field>
          <SubmitButton className="btn-primary btn-sm" pendingLabel="Sending…">Send message</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function TemplateForm({
  code,
  channel,
  subject,
  body,
  active,
  variables,
}: {
  code: string;
  channel: string;
  subject: string;
  body: string;
  active: boolean;
  variables: string[];
}) {
  return (
    <ActionForm action={saveTemplate}>
      {(state) => (
        <>
          <input type="hidden" name="code" value={code} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Channel" name="channel">
              <select name="channel" className="select" defaultValue={channel}>
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
                <option value="BOTH">Email and SMS</option>
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Subject" name="subject" required error={state.errors?.subject}>
                <input name="subject" required defaultValue={subject} className="input" />
              </Field>
            </div>
          </div>
          <Field label="Message body" name="body" required error={state.errors?.body}
            hint={`Available variables: ${variables.map((v) => `{{${v}}}`).join(', ')}`}>
            <textarea name="body" rows={9} required defaultValue={body} className="textarea font-mono text-xs" />
          </Field>
          <label className="flex items-center gap-2.5 text-sm text-slate-700">
            <input type="checkbox" name="active" value="true" defaultChecked={active} className="checkbox" />
            Template is active
          </label>
          <SubmitButton className="btn-primary btn-sm" pendingLabel="Saving…">Save template</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
