'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { flashOk, setFlash } from '@/lib/flash';
import { requirePermission } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import {
  articleSchema, departmentSchema, downloadSchema, enquiryResponseSchema,
  faqSchema, leadershipSchema, pageContentSchema, parseForm,
} from '@/lib/validation';
import { slugify } from '@/lib/ids';
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { sendTemplated, TEMPLATES } from '@/lib/notifications';
import { storeFile, deleteStoredFile, UploadError } from '@/lib/storage';
import type { ActionState } from './public';

async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const root = slugify(base) || 'item';
  let candidate = root;
  let n = 1;
  for (;;) {
    const existing = await prisma.article.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || existing.id === ignoreId) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

/** Module 1 - create a news item, announcement, circular or notice. */
export async function createArticle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.CONTENT_MANAGE);
  const parsed = parseForm(articleSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;
  const canPublishDirectly = hasPermission(user, PERMISSIONS.CONTENT_PUBLISH);
  const requestedPublish = formData.get('publish') === 'true';

  const status = requestedPublish ? (canPublishDirectly ? 'PUBLISHED' : 'PENDING_APPROVAL') : 'DRAFT';

  const article = await prisma.article.create({
    data: {
      type: d.type,
      title: d.title,
      slug: await uniqueSlug(d.title),
      summary: d.summary || null,
      body: d.body,
      status,
      publishedAt: status === 'PUBLISHED' ? (d.publishedAt ?? new Date()) : null,
      authorId: user.id,
      publishedById: status === 'PUBLISHED' ? user.id : null,
    },
  });

  // Optional attachments
  const files = formData.getAll('attachments').filter((f): f is File => f instanceof File && f.size > 0);
  const uploadProblems: string[] = [];
  for (const file of files) {
    try {
      const stored = await storeFile(file, { maxBytes: 10 * 1024 * 1024 });
      await prisma.articleAttachment.create({
        data: {
          articleId: article.id,
          label: stored.originalName,
          storedName: stored.storedName,
          originalName: stored.originalName,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
        },
      });
    } catch (error) {
      uploadProblems.push(
        `${file.name}: ${error instanceof UploadError ? error.message : 'could not be uploaded'}`,
      );
    }
  }

  await recordAudit({
    action: status === 'PUBLISHED' ? AUDIT_ACTIONS.CONTENT_PUBLISHED : AUDIT_ACTIONS.CONTENT_CREATED,
    actor: user,
    entityType: 'Article',
    entityId: article.id,
    summary: `${status === 'PUBLISHED' ? 'Published' : 'Created'} ${d.type.replace(/_/g, ' ').toLowerCase()} "${d.title}"`,
    metadata: { status, attachments: files.length },
  });

  revalidatePath('/admin/content');
  revalidatePath('/news');
  if (uploadProblems.length > 0) {
    return flashOk(`Saved, but some attachments were rejected: ${uploadProblems.join('; ')}.`);
  }
  redirect(`/admin/content/${article.id}`);
}

export async function updateArticle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.CONTENT_MANAGE);
  const id = String(formData.get('id') ?? '');
  const existing = await prisma.article.findUnique({ where: { id } });
  if (!existing) return { ok: false, message: 'Item not found.' };

  const parsed = parseForm(articleSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;

  await prisma.article.update({
    where: { id },
    data: {
      type: d.type,
      title: d.title,
      slug: existing.title === d.title ? existing.slug : await uniqueSlug(d.title, id),
      summary: d.summary || null,
      body: d.body,
      publishedAt: existing.status === 'PUBLISHED' ? (d.publishedAt ?? existing.publishedAt) : existing.publishedAt,
    },
  });

  const files = formData.getAll('attachments').filter((f): f is File => f instanceof File && f.size > 0);
  for (const file of files) {
    try {
      const stored = await storeFile(file, { maxBytes: 10 * 1024 * 1024 });
      await prisma.articleAttachment.create({
        data: {
          articleId: id,
          label: stored.originalName,
          storedName: stored.storedName,
          originalName: stored.originalName,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
        },
      });
    } catch {
      /* reported below by count mismatch; keep the edit itself */
    }
  }

  await recordAudit({
    action: AUDIT_ACTIONS.CONTENT_UPDATED,
    actor: user,
    entityType: 'Article',
    entityId: id,
    summary: `Updated ${d.type.replace(/_/g, ' ').toLowerCase()} "${d.title}"`,
  });

  revalidatePath('/admin/content');
  revalidatePath(`/admin/content/${id}`);
  revalidatePath('/news');
  return flashOk('Item saved.');
}

/** Content approval workflow. */
export async function changeArticleStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get('id') ?? '');
  const to = String(formData.get('status') ?? '');
  const note = String(formData.get('note') ?? '').trim();

  const needsPublishRight = ['PUBLISHED', 'REJECTED'].includes(to);
  const user = await requirePermission(
    needsPublishRight ? PERMISSIONS.CONTENT_PUBLISH : PERMISSIONS.CONTENT_MANAGE,
  );

  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) return { ok: false, message: 'Item not found.' };

  const allowed: Record<string, string[]> = {
    DRAFT: ['PENDING_APPROVAL', 'PUBLISHED', 'ARCHIVED'],
    PENDING_APPROVAL: ['PUBLISHED', 'REJECTED', 'DRAFT'],
    PUBLISHED: ['ARCHIVED', 'DRAFT'],
    REJECTED: ['DRAFT', 'PENDING_APPROVAL'],
    ARCHIVED: ['DRAFT', 'PUBLISHED'],
  };
  if (!(allowed[article.status] ?? []).includes(to)) {
    return { ok: false, message: `An item cannot move from ${article.status} to ${to}.` };
  }
  if (to === 'REJECTED' && !note) return { ok: false, message: 'State the reason for rejecting the item.' };

  await prisma.article.update({
    where: { id },
    data: {
      status: to,
      publishedAt: to === 'PUBLISHED' ? (article.publishedAt ?? new Date()) : article.publishedAt,
      publishedById: to === 'PUBLISHED' ? user.id : article.publishedById,
      approvalNote: note || null,
    },
  });

  if (to === 'PENDING_APPROVAL') {
    await prisma.approvalRequest.create({
      data: {
        entityType: 'ARTICLE',
        entityId: id,
        action: 'PUBLISH_CONTENT',
        requestedById: user.id,
        requestedByName: user.fullName,
        note: note || null,
      },
    });
  }
  if (['PUBLISHED', 'REJECTED'].includes(to)) {
    await prisma.approvalRequest.updateMany({
      where: { entityType: 'ARTICLE', entityId: id, status: 'PENDING' },
      data: {
        status: to === 'PUBLISHED' ? 'APPROVED' : 'REJECTED',
        decidedById: user.id,
        decidedByName: user.fullName,
        decidedAt: new Date(),
        note: note || null,
      },
    });
  }

  await recordAudit({
    action: to === 'PUBLISHED' ? AUDIT_ACTIONS.CONTENT_PUBLISHED : AUDIT_ACTIONS.CONTENT_UPDATED,
    actor: user,
    entityType: 'Article',
    entityId: id,
    summary: `Item "${article.title}" moved from ${article.status} to ${to}${note ? ` — ${note}` : ''}`,
  });

  revalidatePath('/admin/content');
  revalidatePath('/news');
  revalidatePath('/notices');
  revalidatePath('/');
  return flashOk(`Item ${to.replace(/_/g, ' ').toLowerCase()}.`);
}

export async function deleteArticle(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.CONTENT_PUBLISH);
  const id = String(formData.get('id') ?? '');
  const article = await prisma.article.findUnique({ where: { id }, include: { attachments: true } });
  if (!article) return;
  for (const att of article.attachments) await deleteStoredFile(att.storedName);
  await prisma.article.delete({ where: { id } });
  await recordAudit({
    action: AUDIT_ACTIONS.CONTENT_DELETED,
    actor: user,
    entityType: 'Article',
    entityId: id,
    summary: `Deleted item "${article.title}"`,
    sensitive: true,
  });
  revalidatePath('/admin/content');
  revalidatePath('/news');
  redirect('/admin/content');
}

export async function deleteArticleAttachment(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.CONTENT_MANAGE);
  const id = String(formData.get('id') ?? '');
  const att = await prisma.articleAttachment.findUnique({ where: { id } });
  if (!att) return;
  await deleteStoredFile(att.storedName);
  await prisma.articleAttachment.delete({ where: { id } });
  await recordAudit({
    action: AUDIT_ACTIONS.CONTENT_UPDATED,
    actor: user,
    entityType: 'ArticleAttachment',
    entityId: id,
    summary: `Removed attachment "${att.label}"`,
  });
  revalidatePath(`/admin/content/${att.articleId}`);
}

/** Institutional page content (homepage, about, functions, privacy, …). */
export async function savePageContent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.CONTENT_MANAGE);
  const slug = String(formData.get('slug') ?? '').trim();
  if (!slug) return { ok: false, message: 'A page identifier is required.' };

  const parsed = parseForm(pageContentSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;

  await prisma.pageContent.upsert({
    where: { slug },
    create: {
      slug,
      title: d.title,
      subtitle: d.subtitle || null,
      body: d.body,
      published: d.published,
      updatedById: user.id,
    },
    update: {
      title: d.title,
      subtitle: d.subtitle || null,
      body: d.body,
      published: d.published,
      updatedById: user.id,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.CONTENT_UPDATED,
    actor: user,
    entityType: 'PageContent',
    entityId: slug,
    summary: `Updated institutional page "${d.title}" (${slug})`,
  });

  revalidatePath('/admin/content/pages');
  revalidatePath('/');
  revalidatePath('/about');
  revalidatePath('/privacy');
  revalidatePath('/recruitment/process');
  return flashOk('Page content saved.');
}

/** Department and unit directory. */
export async function saveDepartment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.CONTENT_MANAGE);
  const id = String(formData.get('id') ?? '');
  const parsed = parseForm(departmentSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;
  const data = {
    name: d.name,
    code: d.code || null,
    kind: d.kind,
    parentId: d.parentId || null,
    description: d.description || null,
    headName: d.headName || null,
    headTitle: d.headTitle || null,
    email: d.email || null,
    phone: d.phone || null,
    published: d.published,
  };

  const clash = await prisma.department.findUnique({ where: { name: d.name } });
  if (clash && clash.id !== id) {
    return { ok: false, errors: { name: 'A department or unit with that name already exists.' }, message: 'Name already in use.' };
  }

  const record = id
    ? await prisma.department.update({ where: { id }, data })
    : await prisma.department.create({ data });

  await recordAudit({
    action: id ? AUDIT_ACTIONS.RECORD_UPDATED : AUDIT_ACTIONS.RECORD_CREATED,
    actor: user,
    entityType: 'Department',
    entityId: record.id,
    summary: `${id ? 'Updated' : 'Created'} ${d.kind.toLowerCase()} "${d.name}"`,
  });

  revalidatePath('/admin/content/departments');
  revalidatePath('/departments');
  return flashOk(`${d.kind === 'UNIT' ? 'Unit' : 'Department'} saved.`);
}

export async function deleteDepartment(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.CONTENT_MANAGE);
  const id = String(formData.get('id') ?? '');
  const dept = await prisma.department.findUnique({
    where: { id },
    include: { _count: { select: { users: true, vacancies: true, children: true } } },
  });
  if (!dept) return;
  if (dept._count.users + dept._count.vacancies + dept._count.children > 0) {
    await prisma.department.update({ where: { id }, data: { published: false } });
  } else {
    await prisma.department.delete({ where: { id } });
  }
  await recordAudit({
    action: AUDIT_ACTIONS.RECORD_UPDATED,
    actor: user,
    entityType: 'Department',
    entityId: id,
    summary: `Removed ${dept.kind.toLowerCase()} "${dept.name}"`,
  });
  revalidatePath('/admin/content/departments');
  revalidatePath('/departments');
}

/** Leadership profiles. */
export async function saveLeadership(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.CONTENT_MANAGE);
  const id = String(formData.get('id') ?? '');
  const parsed = parseForm(leadershipSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;
  const order = Number(formData.get('order') ?? 0) || 0;
  const data = {
    name: d.name,
    position: d.position,
    bio: d.bio || null,
    email: d.email || null,
    published: d.published,
    position_: order,
  };
  const record = id
    ? await prisma.leadershipProfile.update({ where: { id }, data })
    : await prisma.leadershipProfile.create({ data });

  await recordAudit({
    action: id ? AUDIT_ACTIONS.CONTENT_UPDATED : AUDIT_ACTIONS.CONTENT_CREATED,
    actor: user,
    entityType: 'LeadershipProfile',
    entityId: record.id,
    summary: `${id ? 'Updated' : 'Created'} leadership profile for ${d.name}`,
  });
  revalidatePath('/admin/content/leadership');
  revalidatePath('/leadership');
  return flashOk('Leadership profile saved.');
}

export async function deleteLeadership(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.CONTENT_MANAGE);
  const id = String(formData.get('id') ?? '');
  const p = await prisma.leadershipProfile.findUnique({ where: { id } });
  if (!p) return;
  await prisma.leadershipProfile.delete({ where: { id } });
  await recordAudit({
    action: AUDIT_ACTIONS.CONTENT_DELETED,
    actor: user,
    entityType: 'LeadershipProfile',
    entityId: id,
    summary: `Deleted leadership profile for ${p.name}`,
  });
  revalidatePath('/admin/content/leadership');
  revalidatePath('/leadership');
}

/** FAQs. */
export async function saveFaq(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.CONTENT_MANAGE);
  const id = String(formData.get('id') ?? '');
  const parsed = parseForm(faqSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;
  const order = Number(formData.get('order') ?? 0) || 0;
  const data = {
    question: d.question,
    answer: d.answer,
    category: d.category || 'GENERAL',
    published: d.published,
    position: order,
  };
  const record = id
    ? await prisma.faq.update({ where: { id }, data })
    : await prisma.faq.create({ data });

  await recordAudit({
    action: id ? AUDIT_ACTIONS.CONTENT_UPDATED : AUDIT_ACTIONS.CONTENT_CREATED,
    actor: user,
    entityType: 'Faq',
    entityId: record.id,
    summary: `${id ? 'Updated' : 'Created'} FAQ "${d.question.slice(0, 60)}"`,
  });
  revalidatePath('/admin/content/faqs');
  revalidatePath('/faqs');
  return flashOk('FAQ saved.');
}

export async function deleteFaq(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.CONTENT_MANAGE);
  const id = String(formData.get('id') ?? '');
  const faq = await prisma.faq.findUnique({ where: { id } });
  if (!faq) return;
  await prisma.faq.delete({ where: { id } });
  await recordAudit({
    action: AUDIT_ACTIONS.CONTENT_DELETED,
    actor: user,
    entityType: 'Faq',
    entityId: id,
    summary: `Deleted FAQ "${faq.question.slice(0, 60)}"`,
  });
  revalidatePath('/admin/content/faqs');
  revalidatePath('/faqs');
}

/** Downloadable forms, guidelines and publications. */
export async function uploadDownload(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.CONTENT_MANAGE);
  const parsed = parseForm(downloadSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Attach the document to be published.' };
  }
  let stored;
  try {
    stored = await storeFile(file, { maxBytes: 15 * 1024 * 1024 });
  } catch (error) {
    return { ok: false, message: error instanceof UploadError ? error.message : 'The file could not be uploaded.' };
  }
  const d = parsed.data;
  const item = await prisma.downloadItem.create({
    data: {
      title: d.title,
      description: d.description || null,
      category: d.category,
      published: d.published,
      storedName: stored.storedName,
      originalName: stored.originalName,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
    },
  });
  await recordAudit({
    action: AUDIT_ACTIONS.CONTENT_CREATED,
    actor: user,
    entityType: 'DownloadItem',
    entityId: item.id,
    summary: `Published download "${d.title}" (${d.category})`,
  });
  revalidatePath('/admin/content/downloads');
  revalidatePath('/downloads');
  return flashOk('Document published to the downloads page.');
}

export async function deleteDownload(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.CONTENT_MANAGE);
  const id = String(formData.get('id') ?? '');
  const item = await prisma.downloadItem.findUnique({ where: { id } });
  if (!item) return;
  await deleteStoredFile(item.storedName);
  await prisma.downloadItem.delete({ where: { id } });
  await recordAudit({
    action: AUDIT_ACTIONS.CONTENT_DELETED,
    actor: user,
    entityType: 'DownloadItem',
    entityId: id,
    summary: `Removed download "${item.title}"`,
  });
  revalidatePath('/admin/content/downloads');
  revalidatePath('/downloads');
}

/** Public enquiry handling. */
export async function respondToEnquiry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.ENQUIRY_MANAGE);
  const id = String(formData.get('id') ?? '');
  const parsed = parseForm(enquiryResponseSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const enquiry = await prisma.enquiry.findUnique({ where: { id } });
  if (!enquiry) return { ok: false, message: 'Enquiry not found.' };

  const d = parsed.data;
  await prisma.enquiry.update({
    where: { id },
    data: {
      response: d.response,
      status: d.status,
      respondedById: user.id,
      respondedAt: new Date(),
    },
  });

  if (d.status === 'RESPONDED') {
    await sendTemplated(TEMPLATES.ENQUIRY_RESPONSE, { email: enquiry.email }, {
      name: enquiry.name,
      reference: enquiry.reference,
      subject: enquiry.subject,
      response: d.response,
    });
  }

  await recordAudit({
    action: AUDIT_ACTIONS.ENQUIRY_RESPONDED,
    actor: user,
    entityType: 'Enquiry',
    entityId: id,
    summary: `Responded to enquiry ${enquiry.reference} from ${enquiry.name}`,
  });

  revalidatePath('/admin/enquiries');
  return flashOk(d.status === 'RESPONDED' ? 'Response recorded and emailed to the enquirer.' : 'Enquiry updated.');
}
