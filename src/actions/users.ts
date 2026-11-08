'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';
import { flashOk, setFlash } from '@/lib/flash';
import { hashPassword, requirePermission } from '@/lib/auth';
import { PERMISSIONS, permissionsForRole, PERMISSION_LABELS } from '@/lib/rbac';
import { parseForm, staffUserSchema } from '@/lib/validation';
import { recordAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { sendTemplated, TEMPLATES } from '@/lib/notifications';
import { ROLES, ROLE_LABELS, type Role } from '@/lib/constants';
import type { ActionState } from './public';

function tempPassword(): string {
  return `Kg${randomBytes(4).toString('hex')}!${Math.floor(Math.random() * 90 + 10)}`;
}

/** Module 5 - create a staff account with a role and temporary password. */
export async function createStaffUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission(PERMISSIONS.USER_MANAGE);
  const parsed = parseForm(staffUserSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;

  if (d.role === ROLES.APPLICANT) {
    return { ok: false, message: 'Applicant accounts are created through public registration.' };
  }
  if (d.role === ROLES.SUPER_ADMIN && actor.role !== ROLES.SUPER_ADMIN) {
    return { ok: false, message: 'Only a Super Administrator may create another Super Administrator.' };
  }

  const existing = await prisma.user.findUnique({ where: { email: d.email } });
  if (existing) {
    return { ok: false, errors: { email: 'An account already exists for that email address.' }, message: 'Email address already in use.' };
  }

  const password = tempPassword();
  const user = await prisma.user.create({
    data: {
      email: d.email,
      phone: d.phone || null,
      passwordHash: await hashPassword(password),
      fullName: d.fullName,
      role: d.role,
      title: d.title || null,
      staffNumber: d.staffNumber || null,
      departmentId: d.departmentId || null,
      active: d.active,
      mustChangePassword: true,
      createdById: actor.id,
    },
  });

  await recordAudit({
    action: AUDIT_ACTIONS.USER_CREATED,
    actor,
    entityType: 'User',
    entityId: user.id,
    summary: `Created ${ROLE_LABELS[d.role as Role]} account for ${d.fullName} (${d.email})`,
    metadata: { role: d.role },
    sensitive: true,
  });

  await sendTemplated(TEMPLATES.STAFF_ACCOUNT_CREATED, { userId: user.id, email: user.email }, {
    name: d.fullName,
    role: ROLE_LABELS[d.role as Role],
    email: d.email,
    password,
    loginUrl: `${process.env.APP_URL || 'http://localhost:3000'}/login`,
  });

  revalidatePath('/admin/users');
  return flashOk(`Account created for ${d.fullName}. A temporary password has been emailed; it must be changed on first sign-in.`);
}

export async function updateStaffUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission(PERMISSIONS.USER_MANAGE);
  const id = String(formData.get('id') ?? '');
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return { ok: false, message: 'Account not found.' };
  if (existing.role === ROLES.APPLICANT) {
    return { ok: false, message: 'Applicant accounts are managed by the applicant.' };
  }

  const parsed = parseForm(staffUserSchema, formData);
  if (!parsed.success || !parsed.data) {
    return { ok: false, errors: parsed.errors, message: 'Please correct the highlighted fields.' };
  }
  const d = parsed.data;

  if (
    (d.role === ROLES.SUPER_ADMIN || existing.role === ROLES.SUPER_ADMIN) &&
    actor.role !== ROLES.SUPER_ADMIN
  ) {
    return { ok: false, message: 'Only a Super Administrator may change a Super Administrator account.' };
  }
  if (existing.role === ROLES.SUPER_ADMIN && d.role !== ROLES.SUPER_ADMIN) {
    const supers = await prisma.user.count({ where: { role: ROLES.SUPER_ADMIN, active: true } });
    if (supers <= 1) return { ok: false, message: 'At least one active Super Administrator must remain.' };
  }
  if (d.email !== existing.email) {
    const clash = await prisma.user.findUnique({ where: { email: d.email } });
    if (clash) return { ok: false, errors: { email: 'That email address is already in use.' }, message: 'Email address already in use.' };
  }

  await prisma.user.update({
    where: { id },
    data: {
      email: d.email,
      phone: d.phone || null,
      fullName: d.fullName,
      role: d.role,
      title: d.title || null,
      staffNumber: d.staffNumber || null,
      departmentId: d.departmentId || null,
      active: d.active,
    },
  });

  if (existing.role !== d.role) {
    // Role defaults change; clear explicit grants that the new role already covers.
    const defaults = new Set<string>(permissionsForRole(d.role));
    await prisma.userPermission.deleteMany({ where: { userId: id, permission: { in: Array.from(defaults) } } });
    await recordAudit({
      action: AUDIT_ACTIONS.ROLE_CHANGED,
      actor,
      entityType: 'User',
      entityId: id,
      summary: `Role for ${d.fullName} changed from ${ROLE_LABELS[existing.role as Role]} to ${ROLE_LABELS[d.role as Role]}`,
      sensitive: true,
    });
  }
  if (existing.active !== d.active) {
    if (!d.active) {
      await prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await recordAudit({
      action: d.active ? AUDIT_ACTIONS.USER_ACTIVATED : AUDIT_ACTIONS.USER_DEACTIVATED,
      actor,
      entityType: 'User',
      entityId: id,
      summary: `${d.active ? 'Reactivated' : 'Deactivated'} account for ${d.fullName}`,
      sensitive: true,
    });
  }

  await recordAudit({
    action: AUDIT_ACTIONS.USER_UPDATED,
    actor,
    entityType: 'User',
    entityId: id,
    summary: `Updated account details for ${d.fullName}`,
  });

  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${id}`);
  return flashOk('Account updated.');
}

/** Grant or revoke an additional permission beyond the role default. */
export async function setUserPermissions(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission(PERMISSIONS.USER_MANAGE);
  const id = String(formData.get('id') ?? '');
  const granted = formData.getAll('permissions').map(String).filter((p) => p in PERMISSION_LABELS);

  const user = await prisma.user.findUnique({ where: { id }, include: { permissions: true } });
  if (!user) return { ok: false, message: 'Account not found.' };
  if (user.role === ROLES.SUPER_ADMIN) {
    return { ok: false, message: 'A Super Administrator already holds every permission.' };
  }

  const defaults = new Set<string>(permissionsForRole(user.role));
  const extras = granted.filter((p) => !defaults.has(p));

  await prisma.$transaction([
    prisma.userPermission.deleteMany({ where: { userId: id } }),
    ...(extras.length
      ? [prisma.userPermission.createMany({ data: extras.map((permission) => ({ userId: id, permission })) })]
      : []),
  ]);

  await recordAudit({
    action: AUDIT_ACTIONS.PERMISSIONS_CHANGED,
    actor,
    entityType: 'User',
    entityId: id,
    summary: `Additional permissions for ${user.fullName} set to: ${extras.length ? extras.join(', ') : 'none'}`,
    metadata: { extras },
    sensitive: true,
  });

  revalidatePath(`/admin/users/${id}`);
  return flashOk(extras.length
      ? `${extras.length} additional permission(s) granted beyond the role default.`
      : 'Additional permissions cleared; the account now holds only its role defaults.');
}

export async function resetStaffPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission(PERMISSIONS.USER_MANAGE);
  const id = String(formData.get('id') ?? '');
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { ok: false, message: 'Account not found.' };
  if (user.role === ROLES.SUPER_ADMIN && actor.role !== ROLES.SUPER_ADMIN) {
    return { ok: false, message: 'Only a Super Administrator may reset a Super Administrator password.' };
  }

  const password = tempPassword();
  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
        failedAttempts: 0,
        lockedUntil: null,
      },
    }),
    prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);

  await recordAudit({
    action: AUDIT_ACTIONS.PASSWORD_CHANGED,
    actor,
    entityType: 'User',
    entityId: id,
    summary: `Administrative password reset issued for ${user.fullName}`,
    sensitive: true,
  });

  await sendTemplated(TEMPLATES.STAFF_ACCOUNT_CREATED, { userId: id, email: user.email }, {
    name: user.fullName,
    role: ROLE_LABELS[user.role as Role] ?? user.role,
    email: user.email,
    password,
    loginUrl: `${process.env.APP_URL || 'http://localhost:3000'}/login`,
  });

  revalidatePath(`/admin/users/${id}`);
  return flashOk('A new temporary password has been issued and emailed. All sessions were signed out.');
}

export async function unlockAccount(formData: FormData): Promise<void> {
  const actor = await requirePermission(PERMISSIONS.USER_MANAGE);
  const id = String(formData.get('id') ?? '');
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return;
  await prisma.user.update({ where: { id }, data: { failedAttempts: 0, lockedUntil: null } });
  await recordAudit({
    action: AUDIT_ACTIONS.USER_UPDATED,
    actor,
    entityType: 'User',
    entityId: id,
    summary: `Unlocked account for ${user.fullName}`,
    sensitive: true,
  });
  revalidatePath(`/admin/users/${id}`);
}

/** System settings (Module 5 / §8). */
export async function saveSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const entries: Array<{ key: string; value: string; group: string; label: string }> = [];

  for (const [field, raw] of formData.entries()) {
    if (!field.startsWith('setting_') || raw instanceof File) continue;
    const key = field.slice('setting_'.length);
    entries.push({
      key,
      value: String(raw).slice(0, 2000),
      group: String(formData.get(`group_${key}`) ?? 'GENERAL'),
      label: String(formData.get(`label_${key}`) ?? key),
    });
  }
  if (entries.length === 0) return { ok: false, message: 'No settings were submitted.' };

  for (const entry of entries) {
    await prisma.systemSetting.upsert({
      where: { key: entry.key },
      create: entry,
      update: { value: entry.value, group: entry.group, label: entry.label },
    });
  }

  await recordAudit({
    action: AUDIT_ACTIONS.SETTINGS_UPDATED,
    actor,
    entityType: 'SystemSetting',
    summary: `Updated ${entries.length} system setting(s): ${entries.map((e) => e.key).join(', ')}`,
    sensitive: true,
  });

  revalidatePath('/admin/settings');
  return flashOk(`${entries.length} setting(s) saved.`);
}
