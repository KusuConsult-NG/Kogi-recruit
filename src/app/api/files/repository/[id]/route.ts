import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readStoredFile } from '@/lib/storage';
import { getSessionUser } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { recordAudit } from '@/lib/audit';
import { ROLES } from '@/lib/constants';

/** Commission document repository (Module 4). Restricted to authorised officers. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return new NextResponse('Authentication required', { status: 401 });
  if (!hasPermission(user, PERMISSIONS.ADMIN_RECORDS)) {
    return new NextResponse('You are not authorised to view this record', { status: 403 });
  }

  const doc = await prisma.repositoryDocument.findUnique({ where: { id } });
  if (!doc) return new NextResponse('Not found', { status: 404 });

  if (doc.classification === 'RESTRICTED' && user.role !== ROLES.SUPER_ADMIN &&
      !hasPermission(user, PERMISSIONS.AUDIT_VIEW_SENSITIVE)) {
    return new NextResponse('This record is restricted', { status: 403 });
  }

  try {
    const buffer = await readStoredFile(doc.storedName);
    await recordAudit({
      action: 'REPOSITORY_DOCUMENT_VIEWED',
      actor: user,
      entityType: 'RepositoryDocument',
      entityId: doc.id,
      summary: `Viewed repository document "${doc.title}" (${doc.classification})`,
      sensitive: doc.classification !== 'GENERAL',
    });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'content-type': doc.mimeType,
        'content-length': String(buffer.length),
        'content-disposition': `inline; filename="${doc.originalName.replace(/"/g, '')}"`,
        'cache-control': 'private, no-store',
      },
    });
  } catch {
    return new NextResponse('File unavailable', { status: 404 });
  }
}
