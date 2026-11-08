import { prisma } from '@/lib/db';
import { requirePermission, AuthError, ForbiddenError } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { COMMISSION } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { errorResponse, parseFormat, respondWithExport } from '@/lib/report-export';

/** Module 8 - audit trail export. */
export async function GET(request: Request) {
  let user;
  try {
    user = await requirePermission(PERMISSIONS.AUDIT_VIEW);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Authentication required', 401);
    if (error instanceof ForbiddenError) return errorResponse('You are not authorised to view the audit trail', 403);
    throw error;
  }

  const url = new URL(request.url);
  const format = parseFormat(url.searchParams.get('format'));
  const action = url.searchParams.get('action') || undefined;
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const canSeeSensitive = hasPermission(user, PERMISSIONS.AUDIT_VIEW_SENSITIVE);

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(canSeeSensitive ? {} : { sensitive: false }),
      ...(action ? { action } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 20000,
  });

  return respondWithExport({
    user,
    format,
    title: 'System Audit Trail',
    sections: [
      {
        title: 'Audit records',
        columns: ['Date and time', 'Officer', 'Role', 'Action', 'Entity type', 'Entity id', 'Summary', 'IP address', 'Sensitive'],
        rows: logs.map((l) => [
          formatDateTime(l.createdAt),
          l.actorName ?? 'System',
          l.actorRole ?? '',
          l.action,
          l.entityType ?? '',
          l.entityId ?? '',
          l.summary ?? '',
          l.ipAddress ?? '',
          l.sensitive ? 'Yes' : 'No',
        ]),
      },
    ],
    meta: {
      Commission: COMMISSION.name,
      Records: String(logs.length),
      ...(action ? { 'Action filter': action } : {}),
      ...(from ? { From: from } : {}),
      ...(to ? { To: to } : {}),
      'Sensitive records included': canSeeSensitive ? 'Yes' : 'No (restricted to authorised officers)',
      'Prepared by': user.fullName,
    },
    auditSummary: `Audit trail (${logs.length} record(s))`,
    entityType: 'AuditLog',
  });
}
