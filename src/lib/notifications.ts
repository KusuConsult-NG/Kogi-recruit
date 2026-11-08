/**
 * Module 7 - Notification and communication.
 * Email through SMTP (nodemailer); SMS through an approved gateway abstraction.
 * When no transport is configured the message is logged and still recorded,
 * so delivery history is always retained.
 */
import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import { prisma } from './db';
import { COMMISSION } from './constants';
import { CHANNELS, DEFAULT_TEMPLATES, TEMPLATES, render, type TemplateCode } from './notification-templates';

let transporter: Transporter | null = null;
function getTransporter(): Transporter | null {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transporter;
}

export function wrapEmailHtml(subject: string, body: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.65">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
  return `<!doctype html><html><body style="margin:0;background:#f4f6f5;font-family:Segoe UI,Arial,sans-serif;color:#1a2b22">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:620px;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #dfe5e2">
<tr><td style="background:#106441;color:#fff;padding:20px 24px">
<div style="font-size:17px;font-weight:700">${COMMISSION.name}</div>
<div style="font-size:12px;opacity:.85;margin-top:2px">Civil Service Recruitment Management System</div>
</td></tr>
<tr><td style="padding:24px"><h2 style="margin:0 0 16px;font-size:18px;color:#106441">${subject}</h2>${paragraphs}</td></tr>
<tr><td style="background:#f7faf8;padding:16px 24px;font-size:11px;color:#60706a;border-top:1px solid #e6ebe8">
This is an automated message from the ${COMMISSION.name} portal. Please do not reply to this address.<br/>
${COMMISSION.address}
</td></tr></table></td></tr></table></body></html>`;
}

export interface SendResult {
  notificationId: string;
  status: 'SENT' | 'FAILED';
  error?: string;
}

interface QueueInput {
  userId?: string | null;
  batchId?: string | null;
  channel?: string;
  toAddress?: string | null;
  subject: string;
  body: string;
  templateCode?: string | null;
}

/** Deliver one notification immediately and retain a delivery record. */
export async function sendNotification(input: QueueInput): Promise<SendResult> {
  const channel = input.channel ?? CHANNELS.EMAIL;
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId ?? null,
      batchId: input.batchId ?? null,
      channel,
      toAddress: input.toAddress ?? null,
      subject: input.subject,
      body: input.body,
      templateCode: input.templateCode ?? null,
      status: 'QUEUED',
    },
  });

  if (channel === CHANNELS.IN_APP) {
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: 'SENT', sentAt: new Date() },
    });
    return { notificationId: notification.id, status: 'SENT' };
  }

  try {
    let providerRef: string | null = null;
    if (channel === CHANNELS.SMS) {
      providerRef = await deliverSms(input.toAddress ?? '', input.body);
    } else {
      providerRef = await deliverEmail(input.toAddress ?? '', input.subject, input.body);
    }
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: 'SENT', sentAt: new Date(), providerRef },
    });
    return { notificationId: notification.id, status: 'SENT' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown delivery error';
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: 'FAILED', error: message },
    });
    return { notificationId: notification.id, status: 'FAILED', error: message };
  }
}

async function deliverEmail(to: string, subject: string, body: string): Promise<string | null> {
  if (!to) throw new Error('No email address on record for this recipient.');
  const tx = getTransporter();
  if (!tx) {
    console.info(`[mail:log] to=${to} subject="${subject}"`);
    return 'log-transport';
  }
  const info = await tx.sendMail({
    from: process.env.MAIL_FROM || `${COMMISSION.name} <no-reply@localhost>`,
    to,
    subject,
    text: body,
    html: wrapEmailHtml(subject, body),
  });
  return info.messageId ?? null;
}

/** SMS through an approved gateway. Transaction charges are billed separately. */
async function deliverSms(to: string, body: string): Promise<string | null> {
  if (!to) throw new Error('No telephone number on record for this recipient.');
  const provider = process.env.SMS_PROVIDER || 'log';
  if (provider === 'log' || !process.env.SMS_API_KEY) {
    console.info(`[sms:log] to=${to} body="${body.slice(0, 60)}..."`);
    return 'log-transport';
  }
  const response = await fetch('https://api.ng-sms-gateway.example/v1/send', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.SMS_API_KEY}`,
    },
    body: JSON.stringify({
      to,
      from: process.env.SMS_SENDER_ID || 'KOGICSC',
      message: body,
    }),
  });
  if (!response.ok) throw new Error(`SMS gateway responded ${response.status}`);
  const data = (await response.json().catch(() => ({}))) as { id?: string };
  return data.id ?? null;
}

/** Send using a stored template, falling back to the built-in default text. */
export async function sendTemplated(
  code: TemplateCode,
  recipient: { userId?: string | null; email?: string | null; phone?: string | null },
  vars: Record<string, string | number | undefined>,
  opts: { channel?: string; batchId?: string | null } = {},
): Promise<SendResult[]> {
  const stored = await prisma.notificationTemplate.findUnique({ where: { code } });
  const fallback = DEFAULT_TEMPLATES[code];
  const subject = render(stored?.subject ?? fallback.subject, vars);
  const body = render(stored?.body ?? fallback.body, vars);
  const channel = opts.channel ?? stored?.channel ?? fallback.channel;

  const results: SendResult[] = [];
  if (channel === CHANNELS.EMAIL || channel === CHANNELS.BOTH) {
    results.push(
      await sendNotification({
        userId: recipient.userId,
        batchId: opts.batchId,
        channel: CHANNELS.EMAIL,
        toAddress: recipient.email,
        subject,
        body,
        templateCode: code,
      }),
    );
  }
  if ((channel === CHANNELS.SMS || channel === CHANNELS.BOTH) && recipient.phone) {
    results.push(
      await sendNotification({
        userId: recipient.userId,
        batchId: opts.batchId,
        channel: CHANNELS.SMS,
        toAddress: recipient.phone,
        subject,
        body: `${subject}: ${body}`.slice(0, 480),
        templateCode: code,
      }),
    );
  }
  return results;
}


export { TEMPLATES, CHANNELS, DEFAULT_TEMPLATES, render };
export type { TemplateCode };
