'use client';

import { login } from '@/actions/auth';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Field } from '@/components/ui';

export function LoginForm({ next }: { next?: string }) {
  return (
    <ActionForm action={login}>
      {(state) => (
        <>
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <Field label="Email address" name="email" required error={state.errors?.email}>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={state.values?.email ?? ''}
              className={`input ${state.errors?.email ? 'input-error' : ''}`}
            />
          </Field>
          <Field label="Password" name="password" required error={state.errors?.password}>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className={`input ${state.errors?.password ? 'input-error' : ''}`}
            />
          </Field>
          <SubmitButton className="btn-primary w-full" pendingLabel="Signing in…">
            Sign in
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
