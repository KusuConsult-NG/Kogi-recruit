'use client';

import { useState } from 'react';
import { startApplication } from '@/actions/applications';
import { ActionForm, SubmitButton } from '@/components/forms';

export interface VacancyOption {
  id: string;
  jobTitle: string;
  gradeLevel: string;
  positions: number;
  department: string | null;
  qualifications: string;
  experience: string | null;
  minAge: number | null;
  maxAge: number | null;
}

export function StartApplicationForm({
  exerciseId,
  vacancies,
}: {
  exerciseId: string;
  vacancies: VacancyOption[];
}) {
  const [selected, setSelected] = useState<string>('');

  return (
    <ActionForm action={startApplication}>
      {(state) => (
        <>
          <input type="hidden" name="exerciseId" value={exerciseId} />
          {vacancies.length === 0 ? (
            <p className="text-sm text-slate-600">No vacancies are currently available in this exercise.</p>
          ) : (
            <>
              <fieldset className="space-y-2.5">
                <legend className="label">Available positions</legend>
                {vacancies.map((v) => (
                  <label
                    key={v.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-md border p-3.5 transition ${
                      selected === v.id ? 'border-kogi-600 bg-kogi-50' : 'border-slate-200 hover:border-kogi-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="vacancyId"
                      value={v.id}
                      checked={selected === v.id}
                      onChange={() => setSelected(v.id)}
                      className="mt-1 h-4 w-4 border-slate-300 text-kogi-700 focus:ring-kogi-600"
                      required
                    />
                    <span className="flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{v.jobTitle}</span>
                        <span className="badge-slate">{v.gradeLevel}</span>
                        <span className="badge-green">{v.positions} post{v.positions === 1 ? '' : 's'}</span>
                      </span>
                      {v.department ? (
                        <span className="mt-0.5 block text-xs text-slate-500">{v.department}</span>
                      ) : null}
                      <span className="mt-1.5 block text-xs text-slate-600">
                        <strong>Qualifications:</strong> {v.qualifications}
                      </span>
                      {v.experience ? (
                        <span className="mt-0.5 block text-xs text-slate-600">
                          <strong>Experience:</strong> {v.experience}
                        </span>
                      ) : null}
                      {v.minAge || v.maxAge ? (
                        <span className="mt-0.5 block text-xs text-slate-600">
                          <strong>Age:</strong> {v.minAge ?? '—'} to {v.maxAge ?? '—'} years
                        </span>
                      ) : null}
                    </span>
                  </label>
                ))}
                {state.errors?.vacancyId ? <p className="error-text">{state.errors.vacancyId}</p> : null}
              </fieldset>
              <SubmitButton className="btn-primary" pendingLabel="Starting…">
                Start application
              </SubmitButton>
            </>
          )}
        </>
      )}
    </ActionForm>
  );
}
