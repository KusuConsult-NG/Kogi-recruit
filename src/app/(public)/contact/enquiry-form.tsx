'use client';

import { submitEnquiry } from '@/actions/public';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Field } from '@/components/ui';

export function EnquiryForm() {
  return (
    <ActionForm action={submitEnquiry} hideFormOnSuccess>
      {(state) => (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Your name" name="name" required error={state.errors?.name}>
              <input id="name" name="name" required defaultValue={state.values?.name ?? ''}
                className={`input ${state.errors?.name ? 'input-error' : ''}`} />
            </Field>
            <Field label="Email address" name="email" required error={state.errors?.email}>
              <input id="email" name="email" type="email" required defaultValue={state.values?.email ?? ''}
                className={`input ${state.errors?.email ? 'input-error' : ''}`} />
            </Field>
          </div>
          <Field label="Telephone number" name="phone" error={state.errors?.phone}>
            <input id="phone" name="phone" type="tel" defaultValue={state.values?.phone ?? ''} className="input" />
          </Field>
          <Field label="Subject" name="subject" required error={state.errors?.subject}>
            <input id="subject" name="subject" required defaultValue={state.values?.subject ?? ''}
              className={`input ${state.errors?.subject ? 'input-error' : ''}`} />
          </Field>
          <Field label="Message" name="message" required error={state.errors?.message}>
            <textarea id="message" name="message" required rows={6} defaultValue={state.values?.message ?? ''}
              className={`textarea ${state.errors?.message ? 'input-error' : ''}`} />
          </Field>
          <SubmitButton className="btn-primary" pendingLabel="Submitting…">Submit enquiry</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
