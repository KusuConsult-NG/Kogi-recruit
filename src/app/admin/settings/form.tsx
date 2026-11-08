'use client';

import { saveSettings } from '@/actions/users';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Field } from '@/components/ui';

export function SettingsForm({
  group,
  fields,
}: {
  group: string;
  fields: Array<{ key: string; label: string; type: string; value: string }>;
}) {
  return (
    <ActionForm action={saveSettings}>
      {(state) => (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                <input type="hidden" name={`group_${f.key}`} value={group} />
                <input type="hidden" name={`label_${f.key}`} value={f.label} />
                <Field label={f.label} name={`setting_${f.key}`} error={state.errors?.[`setting_${f.key}`]}>
                  {f.type === 'textarea' ? (
                    <textarea name={`setting_${f.key}`} rows={2} defaultValue={f.value} className="textarea" />
                  ) : (
                    <input name={`setting_${f.key}`} type={f.type} defaultValue={f.value} className="input" />
                  )}
                </Field>
              </div>
            ))}
          </div>
          <SubmitButton className="btn-primary btn-sm" pendingLabel="Saving…">Save settings</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
