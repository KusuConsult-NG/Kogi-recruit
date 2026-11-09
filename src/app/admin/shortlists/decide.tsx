'use client';

import { decideShortlist } from '@/actions/screening';
import { ActionForm, SubmitButton } from '@/components/forms';

export function ShortlistDecisionForm({
  shortlistId,
  decision,
  label,
  tone = 'btn-secondary',
  requireNote = false,
  confirm,
}: {
  shortlistId: string;
  decision: 'SUBMIT' | 'APPROVE' | 'REJECT';
  label: string;
  tone?: string;
  requireNote?: boolean;
  confirm?: string;
}) {
  return (
    <ActionForm
      action={decideShortlist}
      className="space-y-2"
      onSubmit={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}
    >
      {() => (
        <>
          <input type="hidden" name="shortlistId" value={shortlistId} />
          <input type="hidden" name="decision" value={decision} />
          {requireNote ? (
            <input name="note" required placeholder="Reason" className="input text-xs" />
          ) : (
            <input name="note" placeholder="Note (optional)" className="input text-xs" />
          )}
          <SubmitButton className={`${tone} btn-sm w-full`} pendingLabel="Working…">{label}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
