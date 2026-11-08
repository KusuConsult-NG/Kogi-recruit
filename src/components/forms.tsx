'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { ReactNode } from 'react';
import { Alert } from './ui';
import type { ActionState } from '@/actions/public';

export function SubmitButton({
  children,
  className = 'btn-primary',
  pendingLabel,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  pendingLabel?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} {...rest}>
      {pending ? (pendingLabel ?? 'Please wait…') : children}
    </button>
  );
}

export type ActionFn = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Wraps a server action with shared pending/error/success handling.
 * The render function receives the current action state.
 */
export function ActionForm({
  action,
  children,
  className = 'space-y-4',
  successTone = 'success',
  hideFormOnSuccess = false,
  resetOnSuccess = false,
  ...formProps
}: {
  action: ActionFn;
  children: (state: ActionState) => ReactNode;
  className?: string;
  successTone?: 'success' | 'info';
  hideFormOnSuccess?: boolean;
  resetOnSuccess?: boolean;
} & Omit<React.FormHTMLAttributes<HTMLFormElement>, 'action' | 'children' | 'className'>) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  if (hideFormOnSuccess && state.ok) {
    return (
      <Alert tone={successTone} title="Done">
        {state.message}
      </Alert>
    );
  }

  return (
    <form action={formAction} className={className} key={resetOnSuccess && state.ok ? 'reset' : 'form'} {...formProps}>
      {state.message ? (
        <Alert tone={state.ok ? successTone : 'error'}>{state.message}</Alert>
      ) : null}
      {children(state)}
    </form>
  );
}

/** A plain form bound to a void server action, with a pending-aware button. */
export function SimpleForm({
  action,
  children,
  className,
  confirm,
  ...rest
}: {
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  className?: string;
  confirm?: string;
} & Omit<React.FormHTMLAttributes<HTMLFormElement>, 'action' | 'children' | 'className'>) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={
        confirm
          ? (e) => {
              if (!window.confirm(confirm)) e.preventDefault();
            }
          : undefined
      }
      {...rest}
    >
      {children}
    </form>
  );
}
