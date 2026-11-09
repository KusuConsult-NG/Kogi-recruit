'use client';

import { changePassword } from '@/actions/auth';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Field } from '@/components/ui';

export function ChangePasswordForm() {
  return (
    <ActionForm action={changePassword}>
      {(state) => (
        <>
          <Field label="Current password" name="currentPassword" required error={state.errors?.currentPassword}>
            <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required
              className={`input ${state.errors?.currentPassword ? 'input-error' : ''}`} />
          </Field>
          <Field label="New password" name="password" required error={state.errors?.password}
            hint="At least 8 characters, including a letter and a number.">
            <input id="password" name="password" type="password" autoComplete="new-password" required
              className={`input ${state.errors?.password ? 'input-error' : ''}`} />
          </Field>
          <Field label="Confirm new password" name="confirmPassword" required error={state.errors?.confirmPassword}>
            <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required
              className={`input ${state.errors?.confirmPassword ? 'input-error' : ''}`} />
          </Field>
          <SubmitButton className="btn-primary" pendingLabel="Saving…">Change password</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
