'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { flashOk, setFlash } from '@/lib/flash';
import {
  authenticate, clearSessionCookie, createSessionToken, hashPassword,
  requireUser, setSessionCookie, sha256, verifyPassword,
} from '@/lib/auth';
import {
  changePasswordSchema, forgotPasswordSchema, loginSchema, parseForm,
  registerSchema, resetPasswordSchema,
} from '@/lib/validation';
import { applicantReference, randomToken } from '@/lib/ids';
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { sendTemplated, TEMPLATES } from '@/lib/notifications';
import { ROLES } from '@/lib/constants';
import type { ActionState } from './public';

async function meta() {
  const h = await headers();
  return {
    ip: h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? null,
    userAgent: h.get('user-agent') ?? null,
  };
}

function appUrl(path: string): string {
  return `${process.env.APP_URL || 'http://localhost:3000'}${path}`;
}

/** Module 2.2 - applicant account registration. */
export async function registerApplicant(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = Object.fromEntries(
    ['surname', 'firstName', 'middleName', 'email', 'phone'].map((k) => [
      k,
      String(formData.get(k) ?? ''),
    ]),
  );
  const parsed = parseForm(registerSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, values, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: d.email } });
  if (existing) {
    return {
      ok: false,
      values,
      errors: { email: 'An account already exists for this email address.' },
      message: 'An account already exists for this email address. Please sign in instead.',
    };
  }

  const fullName = [d.surname, d.firstName, d.middleName].filter(Boolean).join(' ');
  const ref = applicantReference();

  const user = await prisma.user.create({
    data: {
      email: d.email,
      phone: d.phone,
      passwordHash: await hashPassword(d.password),
      fullName,
      role: ROLES.APPLICANT,
      applicantProfile: {
        create: {
          applicantRef: ref,
          surname: d.surname,
          firstName: d.firstName,
          middleName: d.middleName || null,
          phone: d.phone,
        },
      },
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.USER_CREATED,
    entityType: 'User',
    entityId: user.id,
    summary: `Applicant account created (${ref})`,
  });

  await sendTemplated(
    TEMPLATES.APPLICANT_WELCOME,
    { userId: user.id, email: user.email, phone: user.phone },
    { name: `${d.firstName} ${d.surname}`, applicantRef: ref, email: d.email, loginUrl: appUrl('/login') },
  );

  const token = await createSessionToken(user.id);
  await setSessionCookie(token);
  await recordAudit({ action: AUDIT_ACTIONS.LOGIN, entityType: 'User', entityId: user.id, summary: 'Applicant signed in after registration' });
  redirect('/portal/profile?welcome=1');
}

/** Sign in for every user category. */
export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = { email: String(formData.get('email') ?? '') };
  const parsed = parseForm(loginSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, values, message: 'Enter your email address and password.' };
  }
  const result = await authenticate(parsed.data.email, parsed.data.password, await meta());
  if (!result.ok || !result.user) {
    await recordAudit({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      entityType: 'User',
      summary: `Failed sign-in attempt for ${parsed.data.email}`,
    });
    return { ok: false, values, message: result.error ?? 'Unable to sign in.' };
  }

  const token = await createSessionToken(result.user.id);
  await setSessionCookie(token);
  await recordAudit({
    action: AUDIT_ACTIONS.LOGIN,
    entityType: 'User',
    entityId: result.user.id,
    summary: `Signed in as ${parsed.data.email}`,
  });

  const next = String(formData.get('next') ?? '').trim();
  if (result.user.mustChangePassword) redirect('/change-password');
  if (next.startsWith('/')) redirect(next);
  redirect(result.user.role === ROLES.APPLICANT ? '/portal' : '/admin');
}

export async function logout(): Promise<void> {
  const user = await requireUser().catch(() => null);
  if (user) {
    await recordAudit({ action: AUDIT_ACTIONS.LOGOUT, actor: user, entityType: 'User', entityId: user.id, summary: 'Signed out' });
  }
  await clearSessionCookie();
  redirect('/login?signedout=1');
}

/** Password recovery request (Module 2.2). */
export async function requestPasswordReset(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseForm(forgotPasswordSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Enter a valid email address.' };
  }
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  // Always report the same outcome so accounts cannot be enumerated.
  if (user && user.active) {
    const token = randomToken(32);
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + 60 * 60_000),
      },
    });
    await recordAudit({
      action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
      entityType: 'User',
      entityId: user.id,
      summary: `Password reset requested for ${user.email}`,
    });
    await sendTemplated(
      TEMPLATES.PASSWORD_RESET,
      { userId: user.id, email: user.email },
      { name: user.fullName, resetUrl: appUrl(`/reset-password?token=${token}`) },
    );
  }

  return flashOk('If an active account exists for that email address, a password reset link has been sent. The link expires in 60 minutes.');
}

export async function resetPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(resetPasswordSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: sha256(parsed.data.token) },
    include: { user: true },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { ok: false, message: 'This password reset link is invalid or has expired. Please request a new one.' };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash: await hashPassword(parsed.data.password),
        mustChangePassword: false,
        failedAttempts: 0,
        lockedUntil: null,
      },
    }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.session.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);

  await recordAudit({
    action: AUDIT_ACTIONS.PASSWORD_CHANGED,
    entityType: 'User',
    entityId: record.userId,
    summary: `Password reset completed for ${record.user.email}`,
  });

  return flashOk('Your password has been changed. You may now sign in with your new password.');
}

export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(changePasswordSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(parsed.data.currentPassword, record.passwordHash))) {
    return { ok: false, errors: { currentPassword: 'Your current password is incorrect.' }, message: 'Your current password is incorrect.' };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.password), mustChangePassword: false },
  });
  await recordAudit({
    action: AUDIT_ACTIONS.PASSWORD_CHANGED,
    actor: user,
    entityType: 'User',
    entityId: user.id,
    summary: 'Password changed by account holder',
  });
  revalidatePath('/portal');
  return flashOk('Your password has been changed successfully.');
}
