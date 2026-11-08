'use client';

import Link from 'next/link';
import { resetPassword } from '@/actions/auth';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Alert, Field } from '@/components/ui';

export function ResetPasswordForm({ token }: { token: string }) {
  return (
    <ActionForm action={resetPassword}>
      {(state) =>
        state.ok ? (
          <Alert tone="success" title="Password changed">
            {state.message}{' '}
            <Link href="/login" className="font-semibold underline">Sign in now</Link>
          </Alert>
        ) : (
          <>
            <input type="hidden" name="token" value={token} />
            <Field label="New password" name="password" required error={state.errors?.password}
              hint="At least 8 characters, including a letter and a number.">
              <input id="password" name="password" type="password" autoComplete="new-password" required
                className={`input ${state.errors?.password ? 'input-error' : ''}`} />
            </Field>
            <Field label="Confirm new password" name="confirmPassword" required error={state.errors?.confirmPassword}>
              <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required
                className={`input ${state.errors?.confirmPassword ? 'input-error' : ''}`} />
            </Field>
            <SubmitButton className="btn-primary w-full" pendingLabel="Saving…">Change password</SubmitButton>
          </>
        )
      }
    </ActionForm>
  );
}
