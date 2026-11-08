'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { flashOk, setFlash } from '@/lib/flash';
import { requirePermission } from '@/lib/auth';
import { PERMISSIONS, hasPermission } from '@/lib/rbac';
import { correspondenceSchema, parseForm, repositoryDocumentSchema, taskSchema } from '@/lib/validation';
import { correspondenceReference } from '@/lib/ids';
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { storeFile, deleteStoredFile, UploadError } from '@/lib/storage';
import { ROLES } from '@/lib/constants';
import type { ActionState } from './public';

/** Module 4 - internal task assignment. */
export async function saveTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.ADMIN_RECORDS);
  const id = String(formData.get('id') ?? '');
  const parsed = parseForm(taskSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;
  const data = {
    title: d.title,
    description: d.description || null,
    assigneeId: d.assigneeId || null,
    departmentId: d.departmentId || null,
    priority: d.priority,
    status: d.status,
    dueDate: d.dueDate ?? null,
    completedAt: d.status === 'DONE' ? new Date() : null,
  };

  const task = id
    ? await prisma.staffTask.update({ where: { id }, data })
    : await prisma.staffTask.create({ data: { ...data, createdById: user.id } });

  await recordAudit({
    action: id ? AUDIT_ACTIONS.RECORD_UPDATED : AUDIT_ACTIONS.RECORD_CREATED,
    actor: user,
    entityType: 'StaffTask',
    entityId: task.id,
    summary: `${id ? 'Updated' : 'Created'} task "${d.title}" (${d.status})`,
  });

  revalidatePath('/admin/records/tasks');
  return flashOk('Task saved.');
}

export async function updateTaskStatus(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.ADMIN_RECORDS);
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'].includes(status)) return;
  const task = await prisma.staffTask.findUnique({ where: { id } });
  if (!task) return;
  await prisma.staffTask.update({
    where: { id },
    data: { status, completedAt: status === 'DONE' ? new Date() : null },
  });
  await recordAudit({
    action: AUDIT_ACTIONS.RECORD_UPDATED,
    actor: user,
    entityType: 'StaffTask',
    entityId: id,
    summary: `Task "${task.title}" moved to ${status}`,
  });
  revalidatePath('/admin/records/tasks');
}

export async function deleteTask(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.ADMIN_RECORDS);
  const id = String(formData.get('id') ?? '');
  const task = await prisma.staffTask.findUnique({ where: { id } });
  if (!task) return;
  await prisma.staffTask.delete({ where: { id } });
  await recordAudit({
    action: AUDIT_ACTIONS.RECORD_UPDATED,
    actor: user,
    entityType: 'StaffTask',
    entityId: id,
    summary: `Deleted task "${task.title}"`,
  });
  revalidatePath('/admin/records/tasks');
}

/** Module 4 - correspondence and enquiry records. */
export async function saveCorrespondence(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.ADMIN_RECORDS);
  const id = String(formData.get('id') ?? '');
  const parsed = parseForm(correspondenceSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;
  const data = {
    direction: d.direction,
    subject: d.subject,
    body: d.body || null,
    party: d.party,
    classification: d.classification,
    status: d.status,
    receivedAt: d.receivedAt ?? new Date(),
    handledById: user.id,
  };

  const record = id
    ? await prisma.correspondence.update({ where: { id }, data })
    : await prisma.correspondence.create({ data: { ...data, reference: correspondenceReference() } });

  await recordAudit({
    action: id ? AUDIT_ACTIONS.RECORD_UPDATED : AUDIT_ACTIONS.RECORD_CREATED,
    actor: user,
    entityType: 'Correspondence',
    entityId: record.id,
    summary: `${id ? 'Updated' : 'Logged'} ${d.direction.toLowerCase()} correspondence "${d.subject}" (${d.classification})`,
    sensitive: d.classification !== 'GENERAL',
  });

  revalidatePath('/admin/records/correspondence');
  return flashOk(`Correspondence ${id ? 'updated' : `logged with reference ${record.reference}`}.`);
}

export async function deleteCorrespondence(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.ADMIN_RECORDS);
  const id = String(formData.get('id') ?? '');
  const record = await prisma.correspondence.findUnique({ where: { id } });
  if (!record) return;
  await prisma.correspondence.delete({ where: { id } });
  await recordAudit({
    action: AUDIT_ACTIONS.RECORD_UPDATED,
    actor: user,
    entityType: 'Correspondence',
    entityId: id,
    summary: `Deleted correspondence record ${record.reference}`,
    sensitive: true,
  });
  revalidatePath('/admin/records/correspondence');
}

/** Module 4 - Commission document repository. */
export async function uploadRepositoryDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.ADMIN_RECORDS);
  const parsed = parseForm(repositoryDocumentSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Attach the document to be filed.' };
  }
  let stored;
  try {
    stored = await storeFile(file, { maxBytes: 15 * 1024 * 1024 });
  } catch (error) {
    return { ok: false, message: error instanceof UploadError ? error.message : 'The file could not be uploaded.' };
  }
  const d = parsed.data;

  const doc = await prisma.repositoryDocument.create({
    data: {
      title: d.title,
      description: d.description || null,
      classification: d.classification,
      category: d.category,
      tags: d.tags || null,
      storedName: stored.storedName,
      originalName: stored.originalName,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      uploadedById: user.id,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.RECORD_CREATED,
    actor: user,
    entityType: 'RepositoryDocument',
    entityId: doc.id,
    summary: `Filed repository document "${d.title}" (${d.classification})`,
    sensitive: d.classification !== 'GENERAL',
  });

  revalidatePath('/admin/records/repository');
  return flashOk('Document filed in the Commission repository.');
}

export async function deleteRepositoryDocument(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.ADMIN_RECORDS);
  const id = String(formData.get('id') ?? '');
  const doc = await prisma.repositoryDocument.findUnique({ where: { id } });
  if (!doc) return;
  if (doc.classification === 'RESTRICTED' && user.role !== ROLES.SUPER_ADMIN &&
      !hasPermission(user, PERMISSIONS.AUDIT_VIEW_SENSITIVE)) {
    return;
  }
  await deleteStoredFile(doc.storedName);
  await prisma.repositoryDocument.delete({ where: { id } });
  await recordAudit({
    action: AUDIT_ACTIONS.RECORD_UPDATED,
    actor: user,
    entityType: 'RepositoryDocument',
    entityId: id,
    summary: `Deleted repository document "${doc.title}"`,
    sensitive: true,
  });
  revalidatePath('/admin/records/repository');
}
