/**
 * Page-level access guards.
 *
 * Server actions and API routes throw AuthError / ForbiddenError, which they
 * translate into a form message or an HTTP status. A page cannot do that: an
 * uncaught error there produces a generic error screen, and in production
 * Next.js redacts the message, so the officer is told nothing useful.
 *
 * These guards therefore redirect instead: to sign-in when there is no
 * session, and to a clear "not authorised" page when the officer's role does
 * not include the function. Nothing about the restricted page is rendered.
 */
import 'server-only';
import { redirect } from 'next/navigation';
import { getSessionUser, type SessionUser } from './auth';
import { hasAnyPermission, hasPermission, type Permission } from './rbac';
import { ROLES } from './constants';
import { recordAudit } from './audit';

export async function requirePageUser(next?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  return user;
}

export async function requirePageStaff(next?: string): Promise<SessionUser> {
  const user = await requirePageUser(next);
  if (user.role === ROLES.APPLICANT) redirect('/portal');
  return user;
}

async function refuse(user: SessionUser, permissions: Permission[]): Promise<never> {
  await recordAudit({
    action: 'ACCESS_REFUSED',
    actor: user,
    entityType: 'Permission',
    summary: `Access refused: role does not include ${permissions.join(' or ')}`,
    metadata: { permissions },
    sensitive: true,
  });
  redirect(`/admin/not-authorised?permission=${encodeURIComponent(permissions[0])}`);
}

/** Require one permission, or redirect to the refusal page naming it. */
export async function requirePagePermission(permission: Permission): Promise<SessionUser> {
  const user = await requirePageStaff();
  if (!hasPermission(user, permission)) await refuse(user, [permission]);
  return user;
}

/** Require any one of several permissions. */
export async function requirePageAnyPermission(permissions: Permission[]): Promise<SessionUser> {
  const user = await requirePageStaff();
  if (!hasAnyPermission(user, permissions)) await refuse(user, permissions);
  return user;
}

/** Require an applicant session for the applicant portal. */
export async function requirePageApplicant(next?: string): Promise<SessionUser> {
  const user = await requirePageUser(next);
  if (user.role !== ROLES.APPLICANT) redirect('/admin');
  return user;
}
