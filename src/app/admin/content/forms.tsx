'use client';

import {
  changeArticleStatus, createArticle, saveDepartment, saveFaq,
  saveLeadership, savePageContent, updateArticle, uploadDownload, respondToEnquiry,
} from '@/actions/content';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Field } from '@/components/ui';
import { ARTICLE_TYPES } from '@/lib/constants';

export function ArticleForm({
  mode,
  canPublish,
  initial,
}: {
  mode: 'create' | 'edit';
  canPublish: boolean;
  initial?: {
    id: string; type: string; title: string; summary: string; body: string; publishedAt: string;
  };
}) {
  return (
    <ActionForm action={mode === 'create' ? createArticle : updateArticle} encType="multipart/form-data">
      {(state) => (
        <>
          {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Category" name="type" required error={state.errors?.type}>
              <select id="type" name="type" required className="select" defaultValue={initial?.type ?? 'NEWS'}>
                {ARTICLE_TYPES.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Title" name="title" required error={state.errors?.title}>
                <input id="title" name="title" required defaultValue={initial?.title ?? ''} className="input" />
              </Field>
            </div>
          </div>
          <Field label="Summary" name="summary" error={state.errors?.summary}
            hint="A short standfirst shown in listings and at the top of the item.">
            <textarea id="summary" name="summary" rows={2} defaultValue={initial?.summary ?? ''} className="textarea" />
          </Field>
          <Field label="Content" name="body" required error={state.errors?.body}
            hint="Markdown-style headings (## ), bullet lists (- ), numbered lists and [links](https://…) are supported.">
            <textarea id="body" name="body" rows={12} required defaultValue={initial?.body ?? ''} className="textarea font-mono text-xs" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Publication date" name="publishedAt" error={state.errors?.publishedAt}
              hint="Leave blank to use the date of publication.">
              <input id="publishedAt" name="publishedAt" type="date" defaultValue={initial?.publishedAt ?? ''} className="input" />
            </Field>
            <Field label="Attachments" name="attachments" hint="PDF, image or Office documents, up to 10MB each.">
              <input id="attachments" name="attachments" type="file" multiple
                accept="application/pdf,image/jpeg,image/png,.doc,.docx,.xls,.xlsx"
                className="block w-full cursor-pointer rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs file:mr-2 file:rounded file:border-0 file:bg-kogi-700 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-white" />
            </Field>
          </div>
          {mode === 'create' ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <label className="flex items-start gap-2.5 text-sm text-slate-700">
                <input type="checkbox" name="publish" value="true" className="checkbox mt-0.5" />
                <span>
                  {canPublish
                    ? 'Publish immediately to the public portal'
                    : 'Submit for approval (an authorised officer must approve before publication)'}
                </span>
              </label>
            </div>
          ) : null}
          <SubmitButton className="btn-primary" pendingLabel="Saving…">
            {mode === 'create' ? 'Save item' : 'Save changes'}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function ArticleStatusForm({
  id,
  to,
  label,
  tone = 'btn-secondary',
  requireNote = false,
  confirm,
}: {
  id: string;
  to: string;
  label: string;
  tone?: string;
  requireNote?: boolean;
  confirm?: string;
}) {
  return (
    <ActionForm
      action={changeArticleStatus}
      className="space-y-2"
      onSubmit={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}
    >
      {() => (
        <>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value={to} />
          {requireNote ? <input name="note" required placeholder="Reason" className="input text-xs" /> : null}
          <SubmitButton className={`${tone} btn-sm w-full`} pendingLabel="Working…">{label}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function PageContentForm({
  slug,
  initial,
}: {
  slug: string;
  initial?: { title: string; subtitle: string; body: string; published: boolean };
}) {
  return (
    <ActionForm action={savePageContent}>
      {(state) => (
        <>
          <input type="hidden" name="slug" value={slug} />
          <Field label="Heading" name="title" required error={state.errors?.title}>
            <input id={`title-${slug}`} name="title" required defaultValue={initial?.title ?? ''} className="input" />
          </Field>
          <Field label="Sub-heading" name="subtitle" error={state.errors?.subtitle}>
            <input id={`subtitle-${slug}`} name="subtitle" defaultValue={initial?.subtitle ?? ''} className="input" />
          </Field>
          <Field label="Content" name="body" required error={state.errors?.body}>
            <textarea id={`body-${slug}`} name="body" rows={10} required
              defaultValue={initial?.body ?? ''} className="textarea font-mono text-xs" />
          </Field>
          <label className="flex items-center gap-2.5 text-sm text-slate-700">
            <input type="checkbox" name="published" value="true" defaultChecked={initial?.published ?? true} className="checkbox" />
            Visible on the public portal
          </label>
          <SubmitButton className="btn-primary btn-sm" pendingLabel="Saving…">Save page</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function LeadershipForm({
  initial,
}: {
  initial?: { id: string; name: string; position: string; bio: string; email: string; published: boolean; order: number };
}) {
  return (
    <ActionForm action={saveLeadership} resetOnSuccess={!initial}>
      {(state) => (
        <>
          {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name" name="name" required error={state.errors?.name}>
              <input name="name" required defaultValue={initial?.name ?? ''} className="input" />
            </Field>
            <Field label="Position" name="position" required error={state.errors?.position}>
              <input name="position" required defaultValue={initial?.position ?? ''} className="input" />
            </Field>
            <Field label="Email" name="email" error={state.errors?.email}>
              <input name="email" type="email" defaultValue={initial?.email ?? ''} className="input" />
            </Field>
            <Field label="Display order" name="order">
              <input name="order" type="number" min={0} defaultValue={initial?.order ?? 0} className="input" />
            </Field>
          </div>
          <Field label="Biography" name="bio" error={state.errors?.bio}>
            <textarea name="bio" rows={4} defaultValue={initial?.bio ?? ''} className="textarea" />
          </Field>
          <label className="flex items-center gap-2.5 text-sm text-slate-700">
            <input type="checkbox" name="published" value="true" defaultChecked={initial?.published ?? true} className="checkbox" />
            Published on the public portal
          </label>
          <SubmitButton className="btn-primary btn-sm" pendingLabel="Saving…">
            {initial ? 'Save profile' : 'Add profile'}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function DepartmentForm({
  parents,
  initial,
}: {
  parents: Array<{ id: string; name: string }>;
  initial?: {
    id: string; name: string; code: string; kind: string; parentId: string;
    description: string; headName: string; headTitle: string; email: string; phone: string; published: boolean;
  };
}) {
  return (
    <ActionForm action={saveDepartment} resetOnSuccess={!initial}>
      {(state) => (
        <>
          {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Field label="Name" name="name" required error={state.errors?.name}>
                <input name="name" required defaultValue={initial?.name ?? ''} className="input" />
              </Field>
            </div>
            <Field label="Code" name="code" error={state.errors?.code}>
              <input name="code" defaultValue={initial?.code ?? ''} className="input" />
            </Field>
            <Field label="Type" name="kind">
              <select name="kind" className="select" defaultValue={initial?.kind ?? 'DEPARTMENT'}>
                <option value="DEPARTMENT">Department</option>
                <option value="UNIT">Unit</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Parent department" name="parentId">
              <select name="parentId" className="select" defaultValue={initial?.parentId ?? ''}>
                <option value="">None (top level)</option>
                {parents.filter((p) => p.id !== initial?.id).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Head of department" name="headName" error={state.errors?.headName}>
              <input name="headName" defaultValue={initial?.headName ?? ''} className="input" />
            </Field>
            <Field label="Head's title" name="headTitle" error={state.errors?.headTitle}>
              <input name="headTitle" defaultValue={initial?.headTitle ?? ''} className="input" />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Email" name="email" error={state.errors?.email}>
              <input name="email" type="email" defaultValue={initial?.email ?? ''} className="input" />
            </Field>
            <Field label="Telephone" name="phone" error={state.errors?.phone}>
              <input name="phone" defaultValue={initial?.phone ?? ''} className="input" />
            </Field>
          </div>
          <Field label="Description and responsibilities" name="description" error={state.errors?.description}>
            <textarea name="description" rows={3} defaultValue={initial?.description ?? ''} className="textarea" />
          </Field>
          <label className="flex items-center gap-2.5 text-sm text-slate-700">
            <input type="checkbox" name="published" value="true" defaultChecked={initial?.published ?? true} className="checkbox" />
            Published on the public portal
          </label>
          <SubmitButton className="btn-primary btn-sm" pendingLabel="Saving…">
            {initial ? 'Save' : 'Add department or unit'}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function FaqForm({
  initial,
}: {
  initial?: { id: string; question: string; answer: string; category: string; published: boolean; order: number };
}) {
  return (
    <ActionForm action={saveFaq} resetOnSuccess={!initial}>
      {(state) => (
        <>
          {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
          <Field label="Question" name="question" required error={state.errors?.question}>
            <input name="question" required defaultValue={initial?.question ?? ''} className="input" />
          </Field>
          <Field label="Answer" name="answer" required error={state.errors?.answer}>
            <textarea name="answer" rows={4} required defaultValue={initial?.answer ?? ''} className="textarea" />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Category" name="category">
              <select name="category" className="select" defaultValue={initial?.category ?? 'GENERAL'}>
                {['GENERAL', 'REGISTRATION', 'APPLICATION', 'DOCUMENTS', 'SCREENING', 'EXAMINATION', 'INTERVIEW', 'OUTCOME'].map((c) => (
                  <option key={c} value={c}>{c.toLowerCase()}</option>
                ))}
              </select>
            </Field>
            <Field label="Display order" name="order">
              <input name="order" type="number" min={0} defaultValue={initial?.order ?? 0} className="input" />
            </Field>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="published" value="true" defaultChecked={initial?.published ?? true} className="checkbox" />
                Published
              </label>
            </div>
          </div>
          <SubmitButton className="btn-primary btn-sm" pendingLabel="Saving…">
            {initial ? 'Save FAQ' : 'Add FAQ'}
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function DownloadForm() {
  return (
    <ActionForm action={uploadDownload} resetOnSuccess encType="multipart/form-data">
      {(state) => (
        <>
          <Field label="Title" name="title" required error={state.errors?.title}>
            <input name="title" required className="input" />
          </Field>
          <Field label="Description" name="description" error={state.errors?.description}>
            <textarea name="description" rows={2} className="textarea" />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Category" name="category">
              <select name="category" className="select" defaultValue="FORM">
                <option value="FORM">Approved form</option>
                <option value="GUIDELINE">Guideline</option>
                <option value="PUBLICATION">Publication</option>
                <option value="CIRCULAR">Circular</option>
              </select>
            </Field>
            <Field label="Document" name="file" required hint="Up to 15MB.">
              <input name="file" type="file" required
                accept="application/pdf,image/jpeg,image/png,.doc,.docx,.xls,.xlsx"
                className="block w-full cursor-pointer rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs file:mr-2 file:rounded file:border-0 file:bg-kogi-700 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-white" />
            </Field>
          </div>
          <label className="flex items-center gap-2.5 text-sm text-slate-700">
            <input type="checkbox" name="published" value="true" defaultChecked className="checkbox" />
            Publish on the downloads page
          </label>
          <SubmitButton className="btn-primary btn-sm" pendingLabel="Uploading…">Publish document</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function EnquiryResponseForm({ id, current }: { id: string; current: string }) {
  return (
    <ActionForm action={respondToEnquiry}>
      {(state) => (
        <>
          <input type="hidden" name="id" value={id} />
          <Field label="Response" name="response" required error={state.errors?.response}>
            <textarea name="response" rows={4} required defaultValue={current} className="textarea text-sm" />
          </Field>
          <Field label="Set status to" name="status">
            <select name="status" className="select text-sm" defaultValue="RESPONDED">
              <option value="IN_PROGRESS">In progress (do not email yet)</option>
              <option value="RESPONDED">Responded (email the enquirer)</option>
              <option value="CLOSED">Closed</option>
            </select>
          </Field>
          <SubmitButton className="btn-primary btn-sm" pendingLabel="Saving…">Save response</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
