'use client';

import { archiveSelectionList, createSelectionList, decideSelectionList } from '@/actions/assessment';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Field } from '@/components/ui';

export function SelectionListForm({ exercises }: { exercises: Array<{ id: string; label: string }> }) {
  return (
    <ActionForm action={createSelectionList}>
      {(state) => (
        <>
          <Field label="Recruitment exercise" name="exerciseId" required>
            <select id="exerciseId" name="exerciseId" required className="select" defaultValue="">
              <option value="">Select an exercise…</option>
              {exercises.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </Field>
          <Field label="Selection list title" name="title" required error={state.errors?.title}>
            <input id="title" name="title" required
              placeholder="e.g. Final Selection List — 2026 Recruitment Exercise" className="input" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Examination weight (%)" name="examWeight" required error={state.errors?.examWeight}>
              <input id="examWeight" name="examWeight" type="number" min={0} max={100} step="1"
                defaultValue={50} required className="input" />
            </Field>
            <Field label="Interview weight (%)" name="interviewWeight" required error={state.errors?.interviewWeight}>
              <input id="interviewWeight" name="interviewWeight" type="number" min={0} max={100} step="1"
                defaultValue={50} required className="input" />
            </Field>
          </div>
          <p className="hint">
            Candidates who have completed assessment are ranked by their weighted final score. The
            approved number of posts for each vacancy is filled by rank, with the remainder marked as
            reserve. Every provisional outcome can be adjusted before submission.
          </p>
          <SubmitButton className="btn-primary" pendingLabel="Preparing…">Prepare selection list</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function SelectionDecisionForm({
  selectionListId,
  decision,
  label,
  tone = 'btn-secondary',
  requireNote = false,
  confirm,
}: {
  selectionListId: string;
  decision: 'SUBMIT' | 'APPROVE' | 'REJECT';
  label: string;
  tone?: string;
  requireNote?: boolean;
  confirm?: string;
}) {
  return (
    <ActionForm
      action={decideSelectionList}
      className="space-y-2"
      onSubmit={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}
    >
      {() => (
        <>
          <input type="hidden" name="selectionListId" value={selectionListId} />
          <input type="hidden" name="decision" value={decision} />
          <input name="note" required={requireNote}
            placeholder={requireNote ? 'Reason (required)' : 'Note (optional)'} className="input text-xs" />
          <SubmitButton className={`${tone} btn-sm w-full`} pendingLabel="Working…">{label}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function ArchiveSelectionForm({ selectionListId }: { selectionListId: string }) {
  return (
    <ActionForm
      action={archiveSelectionList}
      onSubmit={(e) => {
        if (!window.confirm('Archive these recruitment records and close the exercise? This concludes stage 10.')) {
          e.preventDefault();
        }
      }}
    >
      {() => (
        <>
          <input type="hidden" name="selectionListId" value={selectionListId} />
          <SubmitButton className="btn-secondary btn-sm w-full" pendingLabel="Archiving…">
            Archive records and close exercise
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
