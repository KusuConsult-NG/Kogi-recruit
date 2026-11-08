'use client';

import Link from 'next/link';
import { registerApplicant } from '@/actions/auth';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Field } from '@/components/ui';

export function RegisterForm() {
  return (
    <ActionForm action={registerApplicant}>
      {(state) => (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Surname" name="surname" required error={state.errors?.surname}>
              <input id="surname" name="surname" required defaultValue={state.values?.surname ?? ''}
                className={`input ${state.errors?.surname ? 'input-error' : ''}`} />
            </Field>
            <Field label="First name" name="firstName" required error={state.errors?.firstName}>
              <input id="firstName" name="firstName" required defaultValue={state.values?.firstName ?? ''}
                className={`input ${state.errors?.firstName ? 'input-error' : ''}`} />
            </Field>
          </div>
          <Field label="Middle name" name="middleName" error={state.errors?.middleName}>
            <input id="middleName" name="middleName" defaultValue={state.values?.middleName ?? ''} className="input" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Email address" name="email" required error={state.errors?.email}
              hint="All official correspondence is sent to this address.">
              <input id="email" name="email" type="email" autoComplete="email" required
                defaultValue={state.values?.email ?? ''}
                className={`input ${state.errors?.email ? 'input-error' : ''}`} />
            </Field>
            <Field label="Telephone number" name="phone" required error={state.errors?.phone}
              hint="Nigerian mobile number, e.g. 08031234567">
              <input id="phone" name="phone" type="tel" required defaultValue={state.values?.phone ?? ''}
                className={`input ${state.errors?.phone ? 'input-error' : ''}`} />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Password" name="password" required error={state.errors?.password}
              hint="At least 8 characters, including a letter and a number.">
              <input id="password" name="password" type="password" autoComplete="new-password" required
                className={`input ${state.errors?.password ? 'input-error' : ''}`} />
            </Field>
            <Field label="Confirm password" name="confirmPassword" required error={state.errors?.confirmPassword}>
              <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required
                className={`input ${state.errors?.confirmPassword ? 'input-error' : ''}`} />
            </Field>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <label className="flex items-start gap-2.5 text-sm text-slate-700">
              <input type="checkbox" name="consent" value="on" className="checkbox mt-0.5" required />
              <span>
                I have read the{' '}
                <Link href="/privacy" target="_blank" className="text-kogi-700 underline">privacy notice</Link>{' '}
                and consent to the Commission processing my personal information for the purpose of
                recruitment administration, in accordance with the Nigeria Data Protection Act 2023.
              </span>
            </label>
            {state.errors?.consent ? <p className="error-text">{state.errors.consent}</p> : null}
          </div>
          <SubmitButton className="btn-primary w-full" pendingLabel="Creating your account…">
            Create account
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
