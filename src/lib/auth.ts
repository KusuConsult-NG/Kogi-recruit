/**
 * Authentication: secure password storage, signed session cookies,
 * login history and account lock-out (Module 5 / §7.1).
 */
import 'server-only';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';
import { createHash } from 'node:crypto';
import { prisma } from './db';
import { ROLES, type Role } from './constants';
import { effectivePermissions, type Permission, hasPermission } from './rbac';
import { randomToken } from './ids';

const SESSION_COOKIE = 'kgcsc_session';
const SESSION_DAYS = 1;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error('AUTH_SECRET must be set to at least 32 characters');
  }
  return new TextEncoder().encode(s);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  permissions: Permission[];
  applicantRef?: string | null;
}

export async function createSessionToken(userId: string): Promise<string> {
  const jti = randomToken(16);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  const token = await new SignJWT({ sub: userId, jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(secret());

  const hdrs = await headers().catch(() => null);
  await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt: expires,
      ipAddress: hdrs?.get('x-forwarded-for') ?? null,
      userAgent: hdrs?.get('user-agent') ?? null,
    },
  });
  return token;
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session
      .updateMany({ where: { tokenHash: sha256(token) }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
  }
  store.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies().catch(() => null);
  const token = store?.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const userId = payload.sub as string;
    const record = await prisma.session.findUnique({ where: { tokenHash: sha256(token) } });
    if (!record || record.revokedAt || record.expiresAt < new Date()) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { permissions: true, applicantProfile: { select: { applicantRef: true } } },
    });
    if (!user || !user.active) return null;
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role as Role,
      permissions: effectivePermissions(user.role, user.permissions.map((p) => p.permission)),
      applicantRef: user.applicantProfile?.applicantRef ?? null,
    };
  } catch {
    return null;
  }
}

export class AuthError extends Error {}
export class ForbiddenError extends Error {}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError('Authentication required');
  return user;
}

export async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === ROLES.APPLICANT) throw new ForbiddenError('Staff access required');
  return user;
}

export async function requireApplicant(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== ROLES.APPLICANT) throw new ForbiddenError('Applicant access required');
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasPermission(user, permission)) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
  return user;
}

export interface LoginResult {
  ok: boolean;
  user?: { id: string; role: string; mustChangePassword: boolean };
  error?: string;
}

/** Authenticate by email + password, honouring lock-out and login history. */
export async function authenticate(
  email: string,
  password: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<LoginResult> {
  const normalised = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalised } });

  const logFailure = async (reason: string) => {
    await prisma.loginHistory.create({
      data: {
        userId: user?.id ?? null,
        email: normalised,
        success: false,
        reason,
        ipAddress: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
      },
    });
  };

  if (!user) {
    await logFailure('UNKNOWN_EMAIL');
    return { ok: false, error: 'Invalid email address or password.' };
  }
  if (!user.active) {
    await logFailure('ACCOUNT_INACTIVE');
    return { ok: false, error: 'This account has been deactivated. Contact the Commission.' };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await logFailure('ACCOUNT_LOCKED');
    return {
      ok: false,
      error: `Account temporarily locked after repeated failed attempts. Try again after ${user.lockedUntil.toLocaleTimeString('en-NG')}.`,
    };
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const failed = user.failedAttempts + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: failed,
        lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });
    await logFailure('BAD_PASSWORD');
    return { ok: false, error: 'Invalid email address or password.' };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await prisma.loginHistory.create({
    data: {
      userId: user.id,
      email: normalised,
      success: true,
      ipAddress: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    },
  });
  return {
    ok: true,
    user: { id: user.id, role: user.role, mustChangePassword: user.mustChangePassword },
  };
}
