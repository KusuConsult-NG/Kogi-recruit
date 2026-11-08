'use client';

import { requestPasswordReset } from '@/actions/auth';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Field } from '@/components/ui';

export function ForgotPasswordForm() {
  return (
    <ActionForm action={requestPasswordReset} hideFormOnSuccess successTone="info">
      {(state) => (
        <>
          <Field label="Email address" name="email" required error={state.errors?.email}>
            <input id="email" name="email" type="email" autoComplete="email" required
              className={`input ${state.errors?.email ? 'input-error' : ''}`} />
          </Field>
          <SubmitButton className="btn-primary w-full" pendingLabel="Sending…">
            Send reset link
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
