'use client';

import { useState } from 'react';
import {
  addUnitMember, createMinistry, createRecruitmentUnit, saveMinistryDepartment,
  updateMinistry, updateRecruitmentUnit,
} from '@/actions/establishment';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Field } from '@/components/ui';
import {
  KOGI_LGAS, MDA_HEAD_TITLES, MDA_KINDS, UNIT_MEMBER_ROLES,
} from '@/lib/constants';

export interface MinistryValues {
  id?: string;
  name: string;
  shortName: string;
  code: string;
  kind: string;
  mandate: string;
  description: string;
  headName: string;
  headTitle: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  lga: string;
  establishedYear: string;
  staffStrength: string;
  published: boolean;
  active: boolean;
}

/** Create or amend an entry in the establishment register. */
export function MinistryForm({ initial }: { initial?: MinistryValues }) {
  const editing = Boolean(initial?.id);
  return (
    <ActionForm action={editing ? updateMinistry : createMinistry} className="space-y-5">
      {(state) => (
        <>
          {editing ? <input type="hidden" name="id" value={initial!.id} /> : null}

          <fieldset className="space-y-4">
            <legend className="fieldset-legend">Identification</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Field label="Full official name" name="name" required error={state.errors?.name}>
                  <input
                    id="name"
                    name="name"
                    required
                    defaultValue={initial?.name}
                    className="input"
                    placeholder="Ministry of Education, Science and Technology"
                  />
                </Field>
              </div>
              <Field label="Short code" name="code" required error={state.errors?.code}
                hint="Used on vacancy references, e.g. MOE.">
                <input
                  id="code"
                  name="code"
                  required
                  defaultValue={initial?.code}
                  className="input font-mono uppercase"
                  placeholder="MOE"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Short name" name="shortName" error={state.errors?.shortName}>
                <input id="shortName" name="shortName" defaultValue={initial?.shortName} className="input" />
              </Field>
              <Field label="Classification" name="kind" required error={state.errors?.kind}>
                <select id="kind" name="kind" required className="select" defaultValue={initial?.kind ?? 'MINISTRY'}>
                  {MDA_KINDS.map((k) => (
                    <option key={k.code} value={k.code}>{k.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Year established" name="establishedYear" error={state.errors?.establishedYear}>
                <input
                  id="establishedYear"
                  name="establishedYear"
                  type="number"
                  min={1900}
                  max={2100}
                  defaultValue={initial?.establishedYear}
                  className="input"
                />
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="fieldset-legend">Accounting officer</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Name" name="headName" error={state.errors?.headName}>
                <input id="headName" name="headName" defaultValue={initial?.headName} className="input" />
              </Field>
              <Field label="Title" name="headTitle" error={state.errors?.headTitle}>
                <input
                  id="headTitle"
                  name="headTitle"
                  list="mda-head-titles"
                  defaultValue={initial?.headTitle ?? 'Permanent Secretary'}
                  className="input"
                />
                <datalist id="mda-head-titles">
                  {MDA_HEAD_TITLES.map((t) => <option key={t} value={t} />)}
                </datalist>
              </Field>
              <Field label="Approved staff strength" name="staffStrength" error={state.errors?.staffStrength}>
                <input
                  id="staffStrength"
                  name="staffStrength"
                  type="number"
                  min={0}
                  defaultValue={initial?.staffStrength}
                  className="input"
                />
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="fieldset-legend">Contact and location</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Official email" name="email" error={state.errors?.email}>
                <input id="email" name="email" type="email" defaultValue={initial?.email} className="input" />
              </Field>
              <Field label="Telephone" name="phone" error={state.errors?.phone}>
                <input id="phone" name="phone" defaultValue={initial?.phone} className="input" />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Field label="Office address" name="address" error={state.errors?.address}>
                  <input id="address" name="address" defaultValue={initial?.address} className="input" />
                </Field>
              </div>
              <Field label="Local Government Area" name="lga" error={state.errors?.lga}>
                <select id="lga" name="lga" className="select" defaultValue={initial?.lga ?? ''}>
                  <option value="">Not stated</option>
                  {KOGI_LGAS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Website" name="website" error={state.errors?.website}>
              <input id="website" name="website" defaultValue={initial?.website} className="input" />
            </Field>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="fieldset-legend">Mandate</legend>
            <Field label="Statutory mandate" name="mandate" error={state.errors?.mandate}
              hint="Shown on the public MDA directory.">
              <textarea id="mandate" name="mandate" rows={3} defaultValue={initial?.mandate} className="textarea" />
            </Field>
            <Field label="Internal notes" name="description" error={state.errors?.description}>
              <textarea id="description" name="description" rows={2} defaultValue={initial?.description} className="textarea" />
            </Field>
          </fieldset>

          <div className="flex flex-wrap items-center gap-6 border-t border-ink-200 pt-4">
            <label className="flex items-center gap-2 text-sm text-ink-800">
              <input type="checkbox" name="published" className="checkbox" defaultChecked={initial?.published ?? true} />
              Show in the public directory
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-800">
              <input type="checkbox" name="active" className="checkbox" defaultChecked={initial?.active ?? true} />
              Available for new vacancies
            </label>
          </div>

          <SubmitButton pendingLabel="Saving…">
            {editing ? 'Save establishment record' : 'Add to the register'}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

/** Departments, divisions and units inside one MDA. */
export function MinistryDepartmentForm({
  ministryId,
  initial,
}: {
  ministryId: string;
  initial?: { id: string; name: string; code: string; kind: string; headName: string };
}) {
  return (
    <ActionForm
      action={saveMinistryDepartment}
      resetOnSuccess={!initial}
      className="grid grid-cols-1 items-end gap-3 sm:grid-cols-5"
    >
      {(state) => (
        <>
          <input type="hidden" name="ministryId" value={ministryId} />
          {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
          <div className="sm:col-span-2">
            <Field label="Department name" name={`md-name-${initial?.id ?? 'new'}`} required error={state.errors?.name}>
              <input
                id={`md-name-${initial?.id ?? 'new'}`}
                name="name"
                required
                defaultValue={initial?.name}
                className="input"
              />
            </Field>
          </div>
          <Field label="Code" name={`md-code-${initial?.id ?? 'new'}`} error={state.errors?.code}>
            <input
              id={`md-code-${initial?.id ?? 'new'}`}
              name="code"
              defaultValue={initial?.code}
              className="input font-mono"
            />
          </Field>
          <Field label="Type" name={`md-kind-${initial?.id ?? 'new'}`} error={state.errors?.kind}>
            <select
              id={`md-kind-${initial?.id ?? 'new'}`}
              name="kind"
              className="select"
              defaultValue={initial?.kind ?? 'DEPARTMENT'}
            >
              <option value="DEPARTMENT">Department</option>
              <option value="DIVISION">Division</option>
              <option value="UNIT">Unit</option>
            </select>
          </Field>
          <div className="flex gap-2">
            <input
              name="headName"
              placeholder="Head (optional)"
              defaultValue={initial?.headName}
              className="input"
              aria-label="Head of department"
            />
            <SubmitButton className="btn-secondary shrink-0" pendingLabel="…">
              {initial ? 'Save' : 'Add'}
            </SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export interface UnitValues {
  id?: string;
  name: string;
  code: string;
  mandate: string;
  description: string;
  email: string;
  phone: string;
  office: string;
  active: boolean;
}

/** Establish or amend the unit that manages recruitment. */
export function RecruitmentUnitForm({ initial }: { initial?: UnitValues }) {
  const editing = Boolean(initial?.id);
  return (
    <ActionForm action={editing ? updateRecruitmentUnit : createRecruitmentUnit} className="space-y-5">
      {(state) => (
        <>
          {editing ? <input type="hidden" name="id" value={initial!.id} /> : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label="Unit name" name="name" required error={state.errors?.name}>
                <input
                  id="name"
                  name="name"
                  required
                  defaultValue={initial?.name}
                  className="input"
                  placeholder="Recruitment and Appointments Unit"
                />
              </Field>
            </div>
            <Field label="Short code" name="code" required error={state.errors?.code}>
              <input
                id="code"
                name="code"
                required
                defaultValue={initial?.code}
                className="input font-mono uppercase"
                placeholder="RAU"
              />
            </Field>
          </div>
          <Field label="Mandate" name="mandate" error={state.errors?.mandate}
            hint="What this unit is responsible for across a recruitment exercise.">
            <textarea id="mandate" name="mandate" rows={3} defaultValue={initial?.mandate} className="textarea" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Unit email" name="email" error={state.errors?.email}>
              <input id="email" name="email" type="email" defaultValue={initial?.email} className="input" />
            </Field>
            <Field label="Telephone" name="phone" error={state.errors?.phone}>
              <input id="phone" name="phone" defaultValue={initial?.phone} className="input" />
            </Field>
            <Field label="Office / room" name="office" error={state.errors?.office}>
              <input id="office" name="office" defaultValue={initial?.office} className="input" />
            </Field>
          </div>
          <Field label="Notes" name="description" error={state.errors?.description}>
            <textarea id="description" name="description" rows={2} defaultValue={initial?.description} className="textarea" />
          </Field>
          <label className="flex items-center gap-2 border-t border-ink-200 pt-4 text-sm text-ink-800">
            <input type="checkbox" name="active" className="checkbox" defaultChecked={initial?.active ?? true} />
            Active — exercises may be assigned to this unit
          </label>
          <SubmitButton pendingLabel="Saving…">
            {editing ? 'Save unit' : 'Establish the unit'}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

/** Put an officer on the recruitment unit in a stated role. */
export function UnitMemberForm({
  unitId,
  officers,
}: {
  unitId: string;
  officers: Array<{ id: string; fullName: string; roleLabel: string }>;
}) {
  const [userId, setUserId] = useState('');
  return (
    <ActionForm action={addUnitMember} resetOnSuccess className="space-y-4">
      {(state) => (
        <>
          <input type="hidden" name="unitId" value={unitId} />
          <Field label="Officer" name="userId" required error={state.errors?.userId}>
            <select
              id="userId"
              name="userId"
              required
              className="select"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">Select a member of staff…</option>
              {officers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.fullName} — {o.roleLabel}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Role on the unit" name="unitRole" required error={state.errors?.unitRole}>
            <select id="unitRole" name="unitRole" required className="select" defaultValue="MEMBER">
              {UNIT_MEMBER_ROLES.map((r) => (
                <option key={r.code} value={r.code}>{r.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Note" name="notes" error={state.errors?.notes}>
            <input id="notes" name="notes" className="input" placeholder="Terms of the assignment (optional)" />
          </Field>
          <SubmitButton className="btn-secondary" pendingLabel="Assigning…">
            Add to the unit
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
