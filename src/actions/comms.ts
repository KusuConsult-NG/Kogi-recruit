'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { flashOk, setFlash } from '@/lib/flash';
import { requirePermission } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { notificationBatchSchema, parseForm } from '@/lib/validation';
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { DEFAULT_TEMPLATES, render, sendNotification, CHANNELS } from '@/lib/notifications';
import { ROLES } from '@/lib/constants';
import type { ActionState } from './public';

/** Module 7 - compose a notification batch for a defined audience. */
export async function createNotificationBatch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.NOTIFICATION_SEND);
  const parsed = parseForm(notificationBatchSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;
  const exerciseId = d.exerciseId || null;
  const audienceStatus = d.audienceStatus || null;

  const recipients = await resolveAudience(exerciseId, audienceStatus);
  if (recipients.length === 0) {
    return { ok: false, message: 'No recipients match that audience. Adjust the exercise or status filter.' };
  }

  const batch = await prisma.notificationBatch.create({
    data: {
      title: d.title,
      channel: d.channel,
      subject: d.subject,
      body: d.body,
      audience: JSON.stringify({ exerciseId, status: audienceStatus }),
      totalCount: recipients.length,
      createdById: user.id,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.NOTIFICATION_SENT,
    actor: user,
    entityType: 'NotificationBatch',
    entityId: batch.id,
    summary: `Prepared notification batch "${d.title}" for ${recipients.length} recipient(s)`,
    metadata: { exerciseId, audienceStatus, channel: d.channel },
  });

  revalidatePath('/admin/notifications');
  return flashOk(`Batch prepared for ${recipients.length} recipient(s). Review it, then approve and send.`);
}

async function resolveAudience(exerciseId: string | null, status: string | null) {
  if (!exerciseId && !status) {
    return prisma.user.findMany({
      where: { role: ROLES.APPLICANT, active: true },
      select: {
        id: true, email: true, phone: true, fullName: true,
        applicantProfile: { select: { firstName: true, surname: true } },
      },
    });
  }
  const applications = await prisma.application.findMany({
    where: {
      ...(exerciseId ? { exerciseId } : {}),
      ...(status ? { status } : {}),
    },
    select: {
      reference: true,
      applicant: {
        select: {
          id: true, email: true, phone: true, fullName: true,
          applicantProfile: { select: { firstName: true, surname: true } },
        },
      },
    },
  });
  const seen = new Set<string>();
  const out: typeof applications[number]['applicant'][] = [];
  for (const a of applications) {
    if (seen.has(a.applicant.id)) continue;
    seen.add(a.applicant.id);
    out.push(a.applicant);
  }
  return out;
}

/** Approve and dispatch a prepared batch. */
export async function dispatchNotificationBatch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const batchId = String(formData.get('batchId') ?? '');
  const decision = String(formData.get('decision') ?? 'SEND');

  const user = await requirePermission(
    decision === 'REJECT' ? PERMISSIONS.NOTIFICATION_APPROVE : PERMISSIONS.NOTIFICATION_SEND,
  );

  const batch = await prisma.notificationBatch.findUnique({ where: { id: batchId } });
  if (!batch) return { ok: false, message: 'Notification batch not found.' };

  if (decision === 'REJECT') {
    if (batch.status === 'SENT') return { ok: false, message: 'That batch has already been sent.' };
    await prisma.notificationBatch.update({ where: { id: batchId }, data: { status: 'REJECTED' } });
    await recordAudit({
      action: AUDIT_ACTIONS.NOTIFICATION_BATCH_APPROVED,
      actor: user,
      entityType: 'NotificationBatch',
      entityId: batchId,
      summary: `Rejected notification batch "${batch.title}"`,
      sensitive: true,
    });
    revalidatePath('/admin/notifications');
    return flashOk('Batch rejected; nothing was sent.');
  }

  if (batch.status === 'SENT' || batch.status === 'SENDING') {
    return { ok: false, message: 'That batch has already been dispatched.' };
  }
  if (!hasPermission(user, PERMISSIONS.NOTIFICATION_APPROVE)) {
    // Officers without approval rights may only submit the batch for approval.
    await prisma.notificationBatch.update({ where: { id: batchId }, data: { status: 'PENDING_APPROVAL' } });
    await prisma.approvalRequest.create({
      data: {
        entityType: 'NOTIFICATION_BATCH',
        entityId: batchId,
        action: 'SEND_NOTIFICATION',
        requestedById: user.id,
        requestedByName: user.fullName,
      },
    });
    revalidatePath('/admin/notifications');
    return flashOk('Batch submitted for approval before dispatch.');
  }

  const audience = JSON.parse(batch.audience) as { exerciseId: string | null; status: string | null };
  const recipients = await resolveAudience(audience.exerciseId, audience.status);

  await prisma.notificationBatch.update({
    where: { id: batchId },
    data: { status: 'SENDING', approvedById: user.id, approvedAt: new Date() },
  });

  let sent = 0;
  let failed = 0;
  for (const recipient of recipients) {
    const name = recipient.applicantProfile
      ? `${recipient.applicantProfile.firstName} ${recipient.applicantProfile.surname}`
      : recipient.fullName;
    const vars = { name, subject: batch.subject, message: batch.body };
    const subject = render(batch.subject, vars);
    const body = render(batch.body, vars);

    if (batch.channel === CHANNELS.EMAIL || batch.channel === CHANNELS.BOTH) {
      const r = await sendNotification({
        userId: recipient.id, batchId, channel: CHANNELS.EMAIL,
        toAddress: recipient.email, subject, body,
      });
      r.status === 'SENT' ? (sent += 1) : (failed += 1);
    }
    if ((batch.channel === CHANNELS.SMS || batch.channel === CHANNELS.BOTH) && recipient.phone) {
      const r = await sendNotification({
        userId: recipient.id, batchId, channel: CHANNELS.SMS,
        toAddress: recipient.phone, subject, body: `${subject}: ${body}`.slice(0, 480),
      });
      r.status === 'SENT' ? (sent += 1) : (failed += 1);
    }
  }

  await prisma.notificationBatch.update({
    where: { id: batchId },
    data: { status: 'SENT', sentCount: sent, failedCount: failed, sentAt: new Date() },
  });
  await prisma.approvalRequest.updateMany({
    where: { entityType: 'NOTIFICATION_BATCH', entityId: batchId, status: 'PENDING' },
    data: { status: 'APPROVED', decidedById: user.id, decidedByName: user.fullName, decidedAt: new Date() },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.NOTIFICATION_SENT,
    actor: user,
    entityType: 'NotificationBatch',
    entityId: batchId,
    summary: `Dispatched notification batch "${batch.title}": ${sent} delivered, ${failed} failed`,
    metadata: { sent, failed, recipients: recipients.length },
    sensitive: true,
  });

  revalidatePath('/admin/notifications');
  return flashOk(`Batch dispatched: ${sent} message(s) delivered${failed ? `, ${failed} failed` : ''}.`);
}

/** Send a one-off message to a single applicant. */
export async function sendDirectMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.NOTIFICATION_SEND);
  const applicantId = String(formData.get('applicantId') ?? '');
  const subject = String(formData.get('subject') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const channel = String(formData.get('channel') ?? CHANNELS.EMAIL);

  if (!subject || !body) return { ok: false, message: 'Both a subject and a message are required.' };

  const applicant = await prisma.user.findUnique({
    where: { id: applicantId },
    select: { id: true, email: true, phone: true, fullName: true },
  });
  if (!applicant) return { ok: false, message: 'Applicant not found.' };

  const results = [];
  if (channel === CHANNELS.EMAIL || channel === CHANNELS.BOTH) {
    results.push(await sendNotification({
      userId: applicant.id, channel: CHANNELS.EMAIL, toAddress: applicant.email, subject, body,
    }));
  }
  if ((channel === CHANNELS.SMS || channel === CHANNELS.BOTH) && applicant.phone) {
    results.push(await sendNotification({
      userId: applicant.id, channel: CHANNELS.SMS, toAddress: applicant.phone,
      subject, body: `${subject}: ${body}`.slice(0, 480),
    }));
  }

  await recordAudit({
    action: AUDIT_ACTIONS.NOTIFICATION_SENT,
    actor: user,
    entityType: 'User',
    entityId: applicant.id,
    summary: `Sent a direct message to ${applicant.fullName}: "${subject}"`,
  });

  const failed = results.filter((r) => r.status === 'FAILED');
  revalidatePath('/admin/notifications');
  return {
    ok: failed.length === 0,
    message: failed.length === 0
      ? 'Message sent.'
      : `Message recorded, but delivery failed: ${failed.map((f) => f.error).join('; ')}`,
  };
}

/** Seed or update the stored notification templates. */
export async function saveTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(PERMISSIONS.NOTIFICATION_APPROVE);
  const code = String(formData.get('code') ?? '').trim();
  const subject = String(formData.get('subject') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const channel = String(formData.get('channel') ?? 'EMAIL');
  const active = formData.get('active') === 'true';

  const fallback = DEFAULT_TEMPLATES[code];
  if (!fallback) return { ok: false, message: 'Unknown template code.' };
  if (!subject || !body) return { ok: false, message: 'Both a subject and a message body are required.' };

  await prisma.notificationTemplate.upsert({
    where: { code },
    create: {
      code, name: fallback.name, channel, subject, body,
      variables: JSON.stringify(fallback.variables), active,
    },
    update: { channel, subject, body, active },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.SETTINGS_UPDATED,
    actor: user,
    entityType: 'NotificationTemplate',
    entityId: code,
    summary: `Updated notification template "${fallback.name}"`,
  });

  revalidatePath('/admin/notifications/templates');
  return flashOk('Template saved.');
}

export async function resetTemplate(formData: FormData): Promise<void> {
  const user = await requirePermission(PERMISSIONS.NOTIFICATION_APPROVE);
  const code = String(formData.get('code') ?? '');
  if (!DEFAULT_TEMPLATES[code]) return;
  await prisma.notificationTemplate.deleteMany({ where: { code } });
  await recordAudit({
    action: AUDIT_ACTIONS.SETTINGS_UPDATED,
    actor: user,
    entityType: 'NotificationTemplate',
    entityId: code,
    summary: `Reset notification template "${code}" to the system default`,
  });
  revalidatePath('/admin/notifications/templates');
}
