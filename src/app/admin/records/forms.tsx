'use client';

import { saveCorrespondence, saveTask, uploadRepositoryDocument } from '@/actions/records';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Field } from '@/components/ui';

export function TaskForm({
  officers,
  departments,
  initial,
}: {
  officers: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
  initial?: {
    id: string; title: string; description: string; assigneeId: string;
    departmentId: string; priority: string; status: string; dueDate: string;
  };
}) {
  return (
    <ActionForm action={saveTask} resetOnSuccess={!initial}>
      {(state) => (
        <>
          {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
          <Field label="Task title" name="title" required error={state.errors?.title}>
            <input name="title" required defaultValue={initial?.title ?? ''} className="input" />
          </Field>
          <Field label="Description" name="description" error={state.errors?.description}>
            <textarea name="description" rows={3} defaultValue={initial?.description ?? ''} className="textarea" />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Assign to" name="assigneeId">
              <select name="assigneeId" className="select" defaultValue={initial?.assigneeId ?? ''}>
                <option value="">Unassigned</option>
                {officers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
            <Field label="Department or unit" name="departmentId">
              <select name="departmentId" className="select" defaultValue={initial?.departmentId ?? ''}>
                <option value="">Not specified</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Priority" name="priority">
              <select name="priority" className="select" defaultValue={initial?.priority ?? 'NORMAL'}>
                {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p.toLowerCase()}</option>)}
              </select>
            </Field>
            <Field label="Status" name="status">
              <select name="status" className="select" defaultValue={initial?.status ?? 'OPEN'}>
                {['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'].map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Due date" name="dueDate">
            <input name="dueDate" type="date" defaultValue={initial?.dueDate ?? ''} className="input" />
          </Field>
          <SubmitButton className="btn-primary btn-sm" pendingLabel="Saving…">
            {initial ? 'Save task' : 'Create task'}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function CorrespondenceForm({
  initial,
}: {
  initial?: {
    id: string; direction: string; subject: string; body: string; party: string;
    classification: string; status: string; receivedAt: string;
  };
}) {
  return (
    <ActionForm action={saveCorrespondence} resetOnSuccess={!initial}>
      {(state) => (
        <>
          {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Direction" name="direction">
              <select name="direction" className="select" defaultValue={initial?.direction ?? 'INCOMING'}>
                <option value="INCOMING">Incoming</option>
                <option value="OUTGOING">Outgoing</option>
              </select>
            </Field>
            <Field label="Date received or sent" name="receivedAt">
              <input name="receivedAt" type="date" defaultValue={initial?.receivedAt ?? ''} className="input" />
            </Field>
          </div>
          <Field label="Subject" name="subject" required error={state.errors?.subject}>
            <input name="subject" required defaultValue={initial?.subject ?? ''} className="input" />
          </Field>
          <Field label="Party or correspondent" name="party" required error={state.errors?.party}>
            <input name="party" required defaultValue={initial?.party ?? ''} className="input" />
          </Field>
          <Field label="Details" name="body" error={state.errors?.body}>
            <textarea name="body" rows={4} defaultValue={initial?.body ?? ''} className="textarea" />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Records classification" name="classification">
              <select name="classification" className="select" defaultValue={initial?.classification ?? 'GENERAL'}>
                <option value="GENERAL">General</option>
                <option value="CONFIDENTIAL">Confidential</option>
                <option value="RESTRICTED">Restricted</option>
              </select>
            </Field>
            <Field label="Status" name="status">
              <select name="status" className="select" defaultValue={initial?.status ?? 'OPEN'}>
                {['OPEN', 'ACTIONED', 'FILED', 'CLOSED'].map((s) => (
                  <option key={s} value={s}>{s.toLowerCase()}</option>
                ))}
              </select>
            </Field>
          </div>
          <SubmitButton className="btn-primary btn-sm" pendingLabel="Saving…">
            {initial ? 'Save record' : 'Log correspondence'}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function RepositoryForm() {
  return (
    <ActionForm action={uploadRepositoryDocument} resetOnSuccess encType="multipart/form-data">
      {(state) => (
        <>
          <Field label="Title" name="title" required error={state.errors?.title}>
            <input name="title" required className="input" />
          </Field>
          <Field label="Description" name="description" error={state.errors?.description}>
            <textarea name="description" rows={2} className="textarea" />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Classification" name="classification">
              <select name="classification" className="select" defaultValue="GENERAL">
                <option value="GENERAL">General</option>
                <option value="CONFIDENTIAL">Confidential</option>
                <option value="RESTRICTED">Restricted</option>
              </select>
            </Field>
            <Field label="Category" name="category">
              <select name="category" className="select" defaultValue="RECORD">
                {['RECORD', 'CIRCULAR', 'POLICY', 'MINUTES', 'REPORT', 'CORRESPONDENCE', 'PERSONNEL'].map((c) => (
                  <option key={c} value={c}>{c.toLowerCase()}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Tags" name="tags" hint="Comma-separated keywords to aid search and retrieval.">
            <input name="tags" className="input" />
          </Field>
          <Field label="Document" name="file" required hint="Up to 15MB.">
            <input name="file" type="file" required
              accept="application/pdf,image/jpeg,image/png,.doc,.docx,.xls,.xlsx"
              className="block w-full cursor-pointer rounded-md border border-ink-300 bg-white px-2 py-1.5 text-xs file:mr-2 file:rounded file:border-0 file:bg-kogi-700 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-white" />
          </Field>
          <SubmitButton className="btn-primary btn-sm" pendingLabel="Filing…">File document</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
