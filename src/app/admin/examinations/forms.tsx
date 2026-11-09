'use client';

import { useState } from 'react';
import {
  addExamCentre, assignExamCandidates, bulkUploadExamScores,
  createExamSchedule, recordExamAttendanceAndScore, validateExamScores,
} from '@/actions/assessment';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Field } from '@/components/ui';
import { EXAM_MODES, KOGI_LGAS } from '@/lib/constants';
import { releaseOnlineTest } from '@/actions/cbt';

export function ExamScheduleForm({
  exercises,
  papers,
}: {
  exercises: Array<{ id: string; label: string }>;
  papers: Array<{ id: string; label: string; durationMinutes: number }>;
}) {
  const [mode, setMode] = useState('CENTRE');
  const [paperId, setPaperId] = useState('');
  const online = mode === 'CBT' || mode === 'HYBRID';
  const paper = papers.find((p) => p.id === paperId);
  return (
    <ActionForm action={createExamSchedule}>
      {(state) => (
        <>
          <Field label="Recruitment exercise" name="exerciseId" required>
            <select id="exerciseId" name="exerciseId" required className="select" defaultValue="">
              <option value="">Select an exercise…</option>
              {exercises.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </Field>
          <Field label="Examination title" name="title" required error={state.errors?.title}>
            <input id="title" name="title" required placeholder="e.g. Written Aptitude Test — Batch 1" className="input" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Examination date" name="examDate" required error={state.errors?.examDate}>
              <input id="examDate" name="examDate" type="date" required className="input" />
            </Field>
            <Field label="Reporting time" name="startTime" required error={state.errors?.startTime}>
              <input id="startTime" name="startTime" type="time" required defaultValue="09:00" className="input" />
            </Field>
            <Field label="End time" name="endTime" error={state.errors?.endTime}>
              <input id="endTime" name="endTime" type="time" defaultValue="11:00" className="input" />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Total marks" name="totalMarks" required error={state.errors?.totalMarks}>
              <input id="totalMarks" name="totalMarks" type="number" min={1} defaultValue={100} required className="input" />
            </Field>
            <Field label="Pass mark" name="passMark" required error={state.errors?.passMark}>
              <input id="passMark" name="passMark" type="number" min={0} defaultValue={50} required className="input" />
            </Field>
          </div>
          <fieldset className="space-y-4 rounded-md border border-ink-200 bg-ink-50/70 p-4">
            <legend className="micro-label">How the examination is conducted</legend>
            <Field label="Mode" name="mode" required error={state.errors?.mode}>
              <select
                id="mode"
                name="mode"
                required
                className="select"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                {EXAM_MODES.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
              </select>
              <p className="hint">{EXAM_MODES.find((m) => m.code === mode)?.description}</p>
            </Field>

            {online ? (
              <>
                <Field
                  label="Examination paper"
                  name="paperId"
                  required
                  error={state.errors?.paperId}
                  hint={
                    papers.length === 0
                      ? 'No published papers are available. Set and publish a paper first.'
                      : 'Only published papers can be set for an examination.'
                  }
                >
                  <select
                    id="paperId"
                    name="paperId"
                    required
                    className="select"
                    value={paperId}
                    onChange={(e) => setPaperId(e.target.value)}
                    disabled={papers.length === 0}
                  >
                    <option value="">Select a published paper…</option>
                    {papers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field
                    label="Duration (minutes)"
                    name="durationMinutes"
                    error={state.errors?.durationMinutes}
                    hint={paper ? `The paper itself allows ${paper.durationMinutes} minutes.` : 'Leave blank to use the paper\u2019s own duration.'}
                  >
                    <input
                      id="durationMinutes"
                      name="durationMinutes"
                      type="number"
                      min={5}
                      max={480}
                      placeholder={paper ? String(paper.durationMinutes) : ''}
                      className="input"
                    />
                  </Field>
                  <Field
                    label="Test opens"
                    name="opensAt"
                    error={state.errors?.opensAt}
                    hint="Candidates cannot start before this time."
                  >
                    <input id="opensAt" name="opensAt" type="datetime-local" className="input" />
                  </Field>
                  <Field
                    label="Test closes"
                    name="closesAt"
                    error={state.errors?.closesAt}
                    hint="No new sitting may be started after this time."
                  >
                    <input id="closesAt" name="closesAt" type="datetime-local" className="input" />
                  </Field>
                </div>
              </>
            ) : null}
          </fieldset>

          <Field label="Instructions to candidates" name="instructions" error={state.errors?.instructions}>
            <textarea id="instructions" name="instructions" rows={3} className="textarea" />
          </Field>
          <SubmitButton className="btn-primary" pendingLabel="Creating…">Create examination</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function ExamCentreForm({ scheduleId }: { scheduleId: string }) {
  return (
    <ActionForm action={addExamCentre} resetOnSuccess className="space-y-3 rounded-md border border-ink-200 bg-ink-50/60 p-4">
      {(state) => (
        <>
          <input type="hidden" name="scheduleId" value={scheduleId} />
          <p className="text-sm font-semibold text-ink-950">Add an examination centre</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Centre name" name="name" required error={state.errors?.name}>
              <input id="name" name="name" required className="input" />
            </Field>
            <Field label="Local Government Area" name="lga" error={state.errors?.lga}
              hint="Candidates from this LGA are allocated here first.">
              <select id="lga" name="lga" className="select" defaultValue="">
                <option value="">Not specified</option>
                {KOGI_LGAS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Address" name="address" error={state.errors?.address}>
            <input id="address" name="address" className="input" />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Capacity" name="capacity" required error={state.errors?.capacity}>
              <input id="capacity" name="capacity" type="number" min={1} defaultValue={100} required className="input" />
            </Field>
            <Field label="Supervisor" name="supervisor" error={state.errors?.supervisor}>
              <input id="supervisor" name="supervisor" className="input" />
            </Field>
          </div>
          <SubmitButton className="btn-secondary btn-sm" pendingLabel="Adding…">Add centre</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export interface CandidatePick {
  id: string;
  reference: string;
  name: string;
  position: string;
  lga: string;
}

export function AssignCandidatesForm({
  scheduleId,
  candidates,
  action,
  label,
}: {
  scheduleId: string;
  candidates: CandidatePick[];
  action: 'exam' | 'interview';
  label: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const allSelected = candidates.length > 0 && selected.length === candidates.length;

  return (
    <ActionForm action={action === 'exam' ? assignExamCandidates : assignInterviewCandidatesAction}>
      {(state) => (
        <>
          <input type="hidden" name="scheduleId" value={scheduleId} />
          {selected.map((id) => <input key={id} type="hidden" name="applicationIds" value={id} />)}

          {candidates.length === 0 ? (
            <p className="text-sm text-ink-600">
              No candidates are currently eligible to be scheduled. Candidates become available once the
              previous stage has been approved.
            </p>
          ) : (
            <>
              <div className="max-h-80 overflow-y-auto rounded-md border border-ink-200">
                <table className="table">
                  <thead className="sticky top-0">
                    <tr>
                      <th className="w-10">
                        <input type="checkbox" aria-label="Select all" checked={allSelected} className="checkbox"
                          onChange={() => setSelected(allSelected ? [] : candidates.map((c) => c.id))} />
                      </th>
                      <th>Reference</th><th>Candidate</th><th>Position</th><th>LGA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((c) => (
                      <tr key={c.id} className={selected.includes(c.id) ? 'bg-kogi-50/60' : ''}>
                        <td>
                          <input type="checkbox" aria-label={`Select ${c.reference}`} className="checkbox"
                            checked={selected.includes(c.id)}
                            onChange={() => setSelected((p) => p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id])} />
                        </td>
                        <td className="whitespace-nowrap font-mono text-xs">{c.reference}</td>
                        <td className="text-xs font-medium text-ink-950">{c.name}</td>
                        <td className="text-xs">{c.position}</td>
                        <td className="text-xs">{c.lga}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <label className="flex items-center gap-2.5 text-sm text-ink-700">
                <input type="checkbox" name="notify" value="true" defaultChecked className="checkbox" />
                Notify each candidate by email and SMS
              </label>
              <SubmitButton className="btn-primary" pendingLabel="Assigning…" disabled={selected.length === 0}>
                {label} ({selected.length} selected)
              </SubmitButton>
            </>
          )}
          {state.errors?._form ? <p className="error-text">{state.errors._form}</p> : null}
        </>
      )}
    </ActionForm>
  );
}

// Re-exported so the single component can serve both stages.
import { assignInterviewCandidates as assignInterviewCandidatesAction } from '@/actions/assessment';

export function ExamScoreRow({
  candidateId,
  attendance,
  score,
  remarks,
  totalMarks,
}: {
  candidateId: string;
  attendance: string;
  score: number | null;
  remarks: string | null;
  totalMarks: number;
}) {
  return (
    <ActionForm action={recordExamAttendanceAndScore} className="flex flex-wrap items-center gap-1.5">
      {(state) => (
        <>
          <input type="hidden" name="candidateId" value={candidateId} />
          <select name="attendance" defaultValue={attendance} className="select w-28 text-xs" aria-label="Attendance">
            <option value="PENDING">Pending</option>
            <option value="PRESENT">Present</option>
            <option value="ABSENT">Absent</option>
          </select>
          <input name="score" type="number" step="0.01" min={0} max={totalMarks}
            defaultValue={score ?? ''} placeholder="Score" aria-label="Score"
            className="input w-20 text-xs" />
          <input name="remarks" defaultValue={remarks ?? ''} placeholder="Remarks" aria-label="Remarks"
            className="input w-36 text-xs" />
          <SubmitButton className="btn-secondary btn-sm" pendingLabel="…">Save</SubmitButton>
          {!state.ok && (state.errors?.score || state.message) ? (
            <span className="text-2xs font-medium text-[#9a2c20]">
              {state.errors?.score ?? state.message}
            </span>
          ) : null}
        </>
      )}
    </ActionForm>
  );
}

export function BulkScoreForm({ scheduleId }: { scheduleId: string }) {
  return (
    <ActionForm action={bulkUploadExamScores} encType="multipart/form-data">
      {() => (
        <>
          <input type="hidden" name="scheduleId" value={scheduleId} />
          <Field label="Attach a CSV score sheet" name="file"
            hint="Columns: examination number, score, optional remarks. A header row is detected automatically.">
            <input id="file" name="file" type="file" accept=".csv,text/csv,text/plain"
              className="block w-full cursor-pointer rounded-md border border-ink-300 bg-white px-2 py-1.5 text-xs file:mr-2 file:rounded file:border-0 file:bg-kogi-700 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-white" />
          </Field>
          <Field label="Or paste the scores" name="csv">
            <textarea id="csv" name="csv" rows={5} className="textarea font-mono text-xs"
              placeholder={'KGE/2026/000001,72\nKGE/2026/000002,65,Late arrival'} />
          </Field>
          <SubmitButton className="btn-primary btn-sm" pendingLabel="Uploading…">Upload scores</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function ValidateExamForm({ scheduleId }: { scheduleId: string }) {
  return (
    <ActionForm action={validateExamScores}>
      {() => (
        <>
          <input type="hidden" name="scheduleId" value={scheduleId} />
          <label className="flex items-start gap-2.5 text-sm text-ink-700">
            <input type="checkbox" name="publishResults" value="true" className="checkbox mt-0.5" />
            <span>Release scores to candidates in their applicant dashboard</span>
          </label>
          <SubmitButton className="btn-primary btn-sm" pendingLabel="Validating…">
            Validate scores and advance candidates
          </SubmitButton>
          <p className="text-xs text-ink-500">
            Validation requires attendance for every candidate and a score for everyone marked present.
          </p>
        </>
      )}
    </ActionForm>
  );
}

/** Release the online test to every allocated candidate who has no sitting yet. */
export function ReleaseOnlineTestForm({
  scheduleId,
  count,
}: {
  scheduleId: string;
  count: number;
}) {
  return (
    <ActionForm
      action={releaseOnlineTest}
      className="space-y-2"
      onSubmit={(e) => {
        if (!window.confirm(`Release the online test to ${count} candidate(s)?`)) e.preventDefault();
      }}
    >
      {() => (
        <>
          <input type="hidden" name="scheduleId" value={scheduleId} />
          <SubmitButton className="btn-primary btn-sm" pendingLabel="Releasing…">
            Release the test to {count} candidate{count === 1 ? '' : 's'}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
