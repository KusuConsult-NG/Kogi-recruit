'use client';

import { useState } from 'react';
import { saveProfile } from '@/actions/applications';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Field } from '@/components/ui';
import { GENDERS, KOGI_LGAS, MARITAL_STATUS, NIGERIAN_STATES } from '@/lib/constants';

export interface ProfileValues {
  surname: string; firstName: string; middleName: string; gender: string;
  dateOfBirth: string; maritalStatus: string; nin: string; phone: string;
  altPhone: string; residentialAddress: string; city: string;
  stateOfResidence: string; stateOfOrigin: string; lga: string; disability: string;
}

export function ProfileForm({ profile }: { profile: ProfileValues }) {
  const [stateOfOrigin, setStateOfOrigin] = useState(profile.stateOfOrigin || 'Kogi');

  return (
    <ActionForm action={saveProfile} className="space-y-6">
      {(state) => (
        <>
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-ink-950">Personal information</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Surname" name="surname" required error={state.errors?.surname}>
                <input id="surname" name="surname" required defaultValue={profile.surname} className="input" />
              </Field>
              <Field label="First name" name="firstName" required error={state.errors?.firstName}>
                <input id="firstName" name="firstName" required defaultValue={profile.firstName} className="input" />
              </Field>
              <Field label="Middle name" name="middleName" error={state.errors?.middleName}>
                <input id="middleName" name="middleName" defaultValue={profile.middleName} className="input" />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <Field label="Gender" name="gender" required error={state.errors?.gender}>
                <select id="gender" name="gender" required defaultValue={profile.gender} className="select">
                  <option value="">Select…</option>
                  {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="Date of birth" name="dateOfBirth" required error={state.errors?.dateOfBirth}>
                <input id="dateOfBirth" name="dateOfBirth" type="date" required defaultValue={profile.dateOfBirth} className="input" />
              </Field>
              <Field label="Marital status" name="maritalStatus" required error={state.errors?.maritalStatus}>
                <select id="maritalStatus" name="maritalStatus" required defaultValue={profile.maritalStatus} className="select">
                  <option value="">Select…</option>
                  {MARITAL_STATUS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="National Identification Number" name="nin" error={state.errors?.nin} hint="11 digits, if available">
                <input id="nin" name="nin" inputMode="numeric" maxLength={11} defaultValue={profile.nin} className="input" />
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-4 border-t border-ink-200 pt-5">
            <legend className="text-sm font-semibold text-ink-950">Contact details</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Telephone number" name="phone" required error={state.errors?.phone} hint="e.g. 08031234567">
                <input id="phone" name="phone" type="tel" required defaultValue={profile.phone} className="input" />
              </Field>
              <Field label="Alternative telephone" name="altPhone" error={state.errors?.altPhone}>
                <input id="altPhone" name="altPhone" type="tel" defaultValue={profile.altPhone} className="input" />
              </Field>
            </div>
            <Field label="Residential address" name="residentialAddress" required error={state.errors?.residentialAddress}>
              <textarea id="residentialAddress" name="residentialAddress" required rows={2} defaultValue={profile.residentialAddress} className="textarea" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="City / Town" name="city" required error={state.errors?.city}>
                <input id="city" name="city" required defaultValue={profile.city} className="input" />
              </Field>
              <Field label="State of residence" name="stateOfResidence" required error={state.errors?.stateOfResidence}>
                <select id="stateOfResidence" name="stateOfResidence" required defaultValue={profile.stateOfResidence || 'Kogi'} className="select">
                  {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-4 border-t border-ink-200 pt-5">
            <legend className="text-sm font-semibold text-ink-950">State and Local Government of origin</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="State of origin" name="stateOfOrigin" required error={state.errors?.stateOfOrigin}>
                <select
                  id="stateOfOrigin"
                  name="stateOfOrigin"
                  required
                  value={stateOfOrigin}
                  onChange={(e) => setStateOfOrigin(e.target.value)}
                  className="select"
                >
                  {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Local Government Area of origin" name="lga" required error={state.errors?.lga}>
                {stateOfOrigin === 'Kogi' ? (
                  <select id="lga" name="lga" required defaultValue={profile.lga} className="select">
                    <option value="">Select LGA…</option>
                    {KOGI_LGAS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                ) : (
                  <input id="lga" name="lga" required defaultValue={profile.lga} placeholder="Enter your LGA" className="input" />
                )}
              </Field>
            </div>
            <Field label="Disability or special requirements" name="disability" error={state.errors?.disability}
              hint="Optional. Declared only so the Commission can make reasonable arrangements.">
              <input id="disability" name="disability" defaultValue={profile.disability} className="input" />
            </Field>
          </fieldset>

          <div className="border-t border-ink-200 pt-5">
            <SubmitButton className="btn-primary" pendingLabel="Saving…">Save profile</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}
