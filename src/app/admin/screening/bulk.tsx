'use client';

import { useState } from 'react';
import { assignScreening, bulkScreen } from '@/actions/screening';
import { createShortlist } from '@/actions/screening';
import { ActionForm, SubmitButton } from '@/components/forms';
import {
  Field, readable,
} from '@/components/ui';

export interface QueueRow {
  id: string;
  reference: string;
  applicantName: string;
  applicantRef: string;
  lga: string;
  exercise: string;
  position: string;
  status: string;
  completeness: number;
  documents: string;
  officers: string;
  submittedAt: string;
}

/**
 * Bulk screening workspace: select applications, then assign to an officer
 * or record a bulk outcome (Module 2.5).
 */
export function ScreeningWorkspace({
  rows,
  officers,
  mode,
  exerciseId,
}: {
  rows: QueueRow[];
  officers: Array<{ id: string; name: string; role: string; pending: number }>;
  mode: 'queue' | 'shortlist';
  exerciseId?: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const allSelected = rows.length > 0 && selected.length === rows.length;

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="space-y-5">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            {mode === 'queue' ? 'Applications awaiting screening' : 'Qualified applications'}
          </h2>
          <span className="badge-slate">{selected.length} of {rows.length} selected</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? [] : rows.map((r) => r.id))}
                    className="checkbox"
                  />
                </th>
                <th>Reference</th><th>Applicant</th><th>Position</th>
                <th>Status</th><th>Complete</th><th>Documents</th>
                {mode === 'queue' ? <th>Assigned to</th> : null}
                <th>Submitted</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={selected.includes(r.id) ? 'bg-kogi-50/60' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.reference}`}
                      checked={selected.includes(r.id)}
                      onChange={() => toggle(r.id)}
                      className="checkbox"
                    />
                  </td>
                  <td className="whitespace-nowrap font-mono text-xs">{r.reference}</td>
                  <td>
                    <p className="font-medium text-ink-950">{r.applicantName}</p>
                    <p className="text-xs text-ink-500">{r.applicantRef} · {r.lga}</p>
                  </td>
                  <td className="text-xs">{r.position}</td>
                  <td><span className="badge-slate">{readable(r.status)}</span></td>
                  <td className="text-xs">{r.completeness}%</td>
                  <td className="text-xs">{r.documents}</td>
                  {mode === 'queue' ? <td className="text-xs">{r.officers || '—'}</td> : null}
                  <td className="whitespace-nowrap text-xs">{r.submittedAt}</td>
                  <td>
                    <a href={`/admin/applications/${r.id}`} className="btn-secondary btn-sm">Open</a>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-sm text-ink-500">
                    {mode === 'queue'
                      ? 'No applications are currently awaiting screening.'
                      : 'No qualified applications are available for shortlisting.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {mode === 'queue' ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="card">
            <div className="card-header"><h2 className="card-title">Assign to a screening officer</h2></div>
            <div className="card-body">
              <ActionForm action={assignScreening}>
                {(state) => (
                  <>
                    {selected.map((id) => <input key={id} type="hidden" name="applicationIds" value={id} />)}
                    <Field label="Screening officer" name="officerId" required error={state.errors?.officerId}>
                      <select id="officerId" name="officerId" required className="select" defaultValue="">
                        <option value="">Select an officer…</option>
                        {officers.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name} — {o.role.replace(/_/g, ' ').toLowerCase()} ({o.pending} pending)
                          </option>
                        ))}
                      </select>
                    </Field>
                    <p className="hint">
                      {selected.length === 0
                        ? 'Select applications above before assigning.'
                        : `${selected.length} application(s) will be assigned and moved to under screening.`}
                    </p>
                    <SubmitButton className="btn-primary" pendingLabel="Assigning…" disabled={selected.length === 0}>
                      Assign {selected.length || ''} application(s)
                    </SubmitButton>
                  </>
                )}
              </ActionForm>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h2 className="card-title">Record a bulk screening outcome</h2></div>
            <div className="card-body">
              <ActionForm action={bulkScreen}>
                {(state) => (
                  <>
                    {selected.map((id) => <input key={id} type="hidden" name="applicationIds" value={id} />)}
                    <Field label="Outcome" name="outcome" required error={state.errors?.outcome}>
                      <select id="outcome" name="outcome" required className="select" defaultValue="">
                        <option value="">Select an outcome…</option>
                        <option value="PASSED">Passed — qualified</option>
                        <option value="RESUBMISSION_REQUIRED">Correction required</option>
                        <option value="FAILED">Failed — disqualified</option>
                      </select>
                    </Field>
                    <Field label="Remarks" name="remarks"
                      hint="Required unless passing. Sent to every selected applicant.">
                      <textarea id="remarks" name="remarks" rows={3} className="textarea" />
                    </Field>
                    <p className="hint">
                      Bulk processing applies the same outcome to every selected application and notifies
                      each applicant. Use individual screening for cases needing judgement.
                    </p>
                    <SubmitButton className="btn-primary" pendingLabel="Processing…" disabled={selected.length === 0}>
                      Screen {selected.length || ''} application(s)
                    </SubmitButton>
                  </>
                )}
              </ActionForm>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header"><h2 className="card-title">Prepare a shortlist</h2></div>
          <div className="card-body">
            <ActionForm action={createShortlist}>
              {(state) => (
                <>
                  <input type="hidden" name="exerciseId" value={exerciseId ?? ''} />
                  {selected.map((id) => <input key={id} type="hidden" name="applicationIds" value={id} />)}
                  <Field label="Shortlist title" name="title" required error={state.errors?.title}>
                    <input id="title" name="title" required placeholder="e.g. Shortlist for written examination — Batch 1" className="input" />
                  </Field>
                  <p className="hint">
                    {selected.length === 0
                      ? 'Select qualified applications above to include them.'
                      : `${selected.length} candidate(s) will be included. The shortlist is created as a draft for approval.`}
                  </p>
                  <SubmitButton className="btn-primary" pendingLabel="Creating…"
                    disabled={selected.length === 0 || !exerciseId}>
                    Create shortlist with {selected.length || ''} candidate(s)
                  </SubmitButton>
                  {!exerciseId ? (
                    <p className="error-text">Select a single recruitment exercise above before preparing a shortlist.</p>
                  ) : null}
                </>
              )}
            </ActionForm>
          </div>
        </div>
      )}
    </div>
  );
}
