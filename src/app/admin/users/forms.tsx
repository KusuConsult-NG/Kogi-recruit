'use client';

import {
  createStaffUser, resetStaffPassword, setUserPermissions, updateStaffUser,
} from '@/actions/users';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Field } from '@/components/ui';
import { ROLE_LABELS, STAFF_ROLES } from '@/lib/constants';
import { PERMISSION_LABELS } from '@/lib/rbac';

export function StaffUserForm({
  mode,
  departments,
  initial,
}: {
  mode: 'create' | 'edit';
  departments: Array<{ id: string; name: string }>;
  initial?: {
    id: string; fullName: string; email: string; phone: string; role: string;
    title: string; staffNumber: string; departmentId: string; active: boolean;
  };
}) {
  return (
    <ActionForm action={mode === 'create' ? createStaffUser : updateStaffUser} resetOnSuccess={mode === 'create'}>
      {(state) => (
        <>
          {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full name" name="fullName" required error={state.errors?.fullName}>
              <input name="fullName" required defaultValue={initial?.fullName ?? ''} className="input" />
            </Field>
            <Field label="Email address" name="email" required error={state.errors?.email}
              hint={mode === 'create' ? 'A temporary password is emailed to this address.' : undefined}>
              <input name="email" type="email" required defaultValue={initial?.email ?? ''} className="input" />
            </Field>
            <Field label="Telephone number" name="phone" error={state.errors?.phone}>
              <input name="phone" type="tel" defaultValue={initial?.phone ?? ''} className="input" />
            </Field>
            <Field label="Role" name="role" required error={state.errors?.role}>
              <select name="role" required className="select" defaultValue={initial?.role ?? ''}>
                <option value="">Select a role…</option>
                {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </Field>
            <Field label="Official title" name="title" error={state.errors?.title}>
              <input name="title" defaultValue={initial?.title ?? ''} className="input" />
            </Field>
            <Field label="Staff number" name="staffNumber" error={state.errors?.staffNumber}>
              <input name="staffNumber" defaultValue={initial?.staffNumber ?? ''} className="input" />
            </Field>
            <Field label="Department or unit" name="departmentId">
              <select name="departmentId" className="select" defaultValue={initial?.departmentId ?? ''}>
                <option value="">Not assigned</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2.5 text-sm text-ink-700">
                <input type="checkbox" name="active" value="true" defaultChecked={initial?.active ?? true} className="checkbox" />
                Account is active
              </label>
            </div>
          </div>
          <SubmitButton className="btn-primary" pendingLabel="Saving…">
            {mode === 'create' ? 'Create account' : 'Save changes'}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function PermissionsForm({
  userId,
  roleDefaults,
  granted,
}: {
  userId: string;
  roleDefaults: string[];
  granted: string[];
}) {
  const defaults = new Set(roleDefaults);
  const extra = new Set(granted);

  return (
    <ActionForm action={setUserPermissions}>
      {() => (
        <>
          <input type="hidden" name="id" value={userId} />
          <div className="max-h-96 space-y-1 overflow-y-auto rounded border border-ink-200 p-2">
            {Object.entries(PERMISSION_LABELS).map(([key, label]) => {
              const isDefault = defaults.has(key);
              return (
                <label key={key}
                  className={`flex items-start gap-2 rounded px-2 py-1.5 text-sm ${isDefault ? 'bg-kogi-50' : 'hover:bg-ink-50'}`}>
                  <input
                    type="checkbox"
                    name="permissions"
                    value={key}
                    defaultChecked={isDefault || extra.has(key)}
                    disabled={isDefault}
                    className="checkbox mt-0.5"
                  />
                  <span className="flex-1">
                    <span className="block text-ink-800">{label}</span>
                    <span className="block font-mono text-2xs text-ink-500">{key}</span>
                  </span>
                  {isDefault ? <span className="badge-green">role default</span> : null}
                </label>
              );
            })}
          </div>
          <p className="hint">
            Permissions marked as role defaults are granted by the account's role and cannot be removed
            individually — change the role instead. Tick any further permission to grant it to this
            officer only.
          </p>
          <SubmitButton className="btn-primary btn-sm" pendingLabel="Saving…">Save permissions</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function ResetPasswordForm({ userId }: { userId: string }) {
  return (
    <ActionForm
      action={resetStaffPassword}
      onSubmit={(e) => {
        if (!window.confirm('Issue a new temporary password? All of this officer\'s sessions will be signed out.')) {
          e.preventDefault();
        }
      }}
    >
      {() => (
        <>
          <input type="hidden" name="id" value={userId} />
          <SubmitButton className="btn-secondary btn-sm w-full" pendingLabel="Resetting…">
            Issue a new temporary password
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
