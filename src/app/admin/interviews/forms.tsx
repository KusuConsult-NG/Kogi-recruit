'use client';

import { useState } from 'react';
import {
  consolidateInterviews, createInterviewSchedule, createPanel,
  recordInterviewScore, saveInterviewCriteria,
} from '@/actions/assessment';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Field } from '@/components/ui';

export function InterviewScheduleForm({ exercises }: { exercises: Array<{ id: string; label: string }> }) {
  return (
    <ActionForm action={createInterviewSchedule}>
      {(state) => (
        <>
          <Field label="Recruitment exercise" name="exerciseId" required>
            <select id="exerciseId" name="exerciseId" required className="select" defaultValue="">
              <option value="">Select an exercise…</option>
              {exercises.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </Field>
          <Field label="Interview title" name="title" required error={state.errors?.title}>
            <input id="title" name="title" required placeholder="e.g. Oral Interview — Administrative Officer" className="input" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Interview date" name="interviewDate" required error={state.errors?.interviewDate}>
              <input id="interviewDate" name="interviewDate" type="date" required className="input" />
            </Field>
            <Field label="Start time" name="startTime" required error={state.errors?.startTime}>
              <input id="startTime" name="startTime" type="time" required defaultValue="09:00" className="input" />
            </Field>
            <Field label="End time" name="endTime" error={state.errors?.endTime}>
              <input id="endTime" name="endTime" type="time" defaultValue="16:00" className="input" />
            </Field>
          </div>
          <Field label="Venue" name="venue" required error={state.errors?.venue}>
            <input id="venue" name="venue" required
              placeholder="e.g. Commission Conference Room, Lokoja" className="input" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Minutes per candidate" name="slotMinutes" required error={state.errors?.slotMinutes}>
              <input id="slotMinutes" name="slotMinutes" type="number" min={5} max={180} defaultValue={20} required className="input" />
            </Field>
            <Field label="Total marks" name="totalMarks" required error={state.errors?.totalMarks}>
              <input id="totalMarks" name="totalMarks" type="number" min={1} defaultValue={100} required className="input" />
            </Field>
            <Field label="Pass mark" name="passMark" required error={state.errors?.passMark}>
              <input id="passMark" name="passMark" type="number" min={0} defaultValue={50} required className="input" />
            </Field>
          </div>
          <SubmitButton className="btn-primary" pendingLabel="Creating…">Create interview</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function CriteriaForm({
  scheduleId,
  criteria,
}: {
  scheduleId: string;
  criteria: Array<{ key: string; label: string; maxScore: number }>;
}) {
  const [rows, setRows] = useState(criteria.length ? criteria : [{ key: '', label: '', maxScore: 20 }]);

  return (
    <ActionForm action={saveInterviewCriteria}>
      {() => (
        <>
          <input type="hidden" name="scheduleId" value={scheduleId} />
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input
                  name="criterionLabel"
                  defaultValue={row.label}
                  placeholder="Criterion, e.g. Job Knowledge"
                  aria-label={`Criterion ${i + 1} label`}
                  className="input flex-1 min-w-[12rem] text-sm"
                />
                <input
                  name="criterionMax"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={row.maxScore}
                  aria-label={`Criterion ${i + 1} maximum score`}
                  className="input w-24 text-sm"
                />
                {rows.length > 1 ? (
                  <button type="button" onClick={() => setRows(rows.filter((_, x) => x !== i))}
                    className="btn-ghost btn-sm text-red-700">Remove</button>
                ) : null}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setRows([...rows, { key: '', label: '', maxScore: 10 }])}
              className="btn-ghost btn-sm">+ Add criterion</button>
            <SubmitButton className="btn-secondary btn-sm" pendingLabel="Saving…">Save framework</SubmitButton>
          </div>
          <p className="hint">
            Total marks for the interview are the sum of the criterion maxima:{' '}
            <strong>{rows.reduce((s, r) => s + (Number(r.maxScore) || 0), 0)}</strong>.
          </p>
        </>
      )}
    </ActionForm>
  );
}

export function PanelForm({
  scheduleId,
  officers,
}: {
  scheduleId: string;
  officers: Array<{ id: string; name: string; role: string }>;
}) {
  const [members, setMembers] = useState<string[]>([]);

  return (
    <ActionForm action={createPanel} className="space-y-3 rounded-md border border-slate-200 bg-slate-50/60 p-4">
      {(state) => (
        <>
          <input type="hidden" name="scheduleId" value={scheduleId} />
          <p className="text-sm font-semibold text-slate-900">Create an interview panel</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Panel name" name="name" required error={state.errors?.name}>
              <input id="name" name="name" required placeholder="e.g. Panel A" className="input" />
            </Field>
            <Field label="Room / venue" name="roomVenue" error={state.errors?.roomVenue}>
              <input id="roomVenue" name="roomVenue" className="input" />
            </Field>
          </div>
          <fieldset>
            <legend className="label">Panel members</legend>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded border border-slate-200 bg-white p-2">
              {officers.length === 0 ? (
                <p className="p-2 text-xs text-slate-500">
                  No officers hold interview scoring rights. Create Interview Panel Member accounts first.
                </p>
              ) : (
                officers.map((o) => (
                  <label key={o.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-slate-50">
                    <input
                      type="checkbox"
                      name="memberIds"
                      value={o.id}
                      checked={members.includes(o.id)}
                      onChange={() => setMembers((p) => p.includes(o.id) ? p.filter((x) => x !== o.id) : [...p, o.id])}
                      className="checkbox"
                    />
                    <span className="flex-1">{o.name}</span>
                    <span className="text-[11px] text-slate-500">{o.role.replace(/_/g, ' ').toLowerCase()}</span>
                  </label>
                ))
              )}
            </div>
          </fieldset>
          {members.length > 0 ? (
            <Field label="Panel chair" name="chairId">
              <select id="chairId" name="chairId" className="select" defaultValue="">
                <option value="">No chair designated</option>
                {officers.filter((o) => members.includes(o.id)).map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </Field>
          ) : null}
          <SubmitButton className="btn-secondary btn-sm" pendingLabel="Creating…" disabled={members.length === 0}>
            Create panel
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function InterviewScoreForm({
  candidateId,
  criteria,
  existing,
  attendance,
  totalMarks,
}: {
  candidateId: string;
  criteria: Array<{ key: string; label: string; maxScore: number }>;
  existing: Record<string, number> | null;
  attendance: string;
  totalMarks: number;
}) {
  const [absent, setAbsent] = useState(attendance === 'ABSENT');

  return (
    <ActionForm action={recordInterviewScore} className="space-y-3">
      {(state) => (
        <>
          <input type="hidden" name="candidateId" value={candidateId} />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={absent}
              onChange={(e) => setAbsent(e.target.checked)}
              className="checkbox"
            />
            Candidate was absent
          </label>
          <input type="hidden" name="attendance" value={absent ? 'ABSENT' : 'PRESENT'} />

          {!absent ? (
            <div className="space-y-2">
              {criteria.map((c) => (
                <div key={c.key} className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor={`score_${c.key}`} className="flex-1 text-sm text-slate-700">
                    {c.label}
                    <span className="ml-1 text-xs text-slate-500">(max {c.maxScore})</span>
                  </label>
                  <input
                    id={`score_${c.key}`}
                    name={`score_${c.key}`}
                    type="number"
                    step="0.5"
                    min={0}
                    max={c.maxScore}
                    defaultValue={existing?.[c.key] ?? ''}
                    className="input w-24 text-sm"
                  />
                </div>
              ))}
              <p className="border-t border-slate-200 pt-2 text-xs text-slate-500">
                Total available: {totalMarks} marks.
              </p>
            </div>
          ) : null}

          <Field label="Remarks" name="remarks">
            <textarea id="remarks" name="remarks" rows={2} className="textarea text-sm" />
          </Field>
          <SubmitButton className="btn-primary btn-sm" pendingLabel="Saving…">Record my assessment</SubmitButton>
          {state.message ? (
            <p className={`text-xs ${state.ok ? 'text-kogi-800' : 'text-red-700'}`}>{state.message}</p>
          ) : null}
        </>
      )}
    </ActionForm>
  );
}

export function ConsolidateForm({ scheduleId }: { scheduleId: string }) {
  return (
    <ActionForm action={consolidateInterviews}>
      {() => (
        <>
          <input type="hidden" name="scheduleId" value={scheduleId} />
          <SubmitButton className="btn-primary btn-sm w-full" pendingLabel="Consolidating…">
            Consolidate panel assessments
          </SubmitButton>
          <p className="mt-2 text-xs text-slate-500">
            Every candidate must have attendance recorded, and everyone present must have at least one
            panel score. Consolidation takes the mean of the panel members' totals.
          </p>
        </>
      )}
    </ActionForm>
  );
}
