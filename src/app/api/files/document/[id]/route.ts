import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readStoredFile } from '@/lib/storage';
import { getSessionUser } from '@/lib/auth';
import { hasPermission, PERMISSIONS } from '@/lib/rbac';
import { recordAudit } from '@/lib/audit';
import { ROLES } from '@/lib/constants';

/**
 * Applicant documents are never publicly accessible.
 * The owning applicant, or an officer holding document/application view rights, may retrieve them.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return new NextResponse('Authentication required', { status: 401 });

  const document = await prisma.applicantDocument.findUnique({
    where: { id },
    include: { application: { select: { applicantId: true, reference: true } } },
  });
  if (!document) return new NextResponse('Not found', { status: 404 });

  const isOwner = user.role === ROLES.APPLICANT && document.application.applicantId === user.id;
  const isOfficer =
    hasPermission(user, PERMISSIONS.DOCUMENT_REVIEW) ||
    hasPermission(user, PERMISSIONS.APPLICATION_VIEW);

  if (!isOwner && !isOfficer) {
    return new NextResponse('You are not authorised to view this document', { status: 403 });
  }

  try {
    const buffer = await readStoredFile(document.storedName);
    if (!isOwner) {
      await recordAudit({
        action: 'DOCUMENT_VIEWED',
        actor: user,
        entityType: 'ApplicantDocument',
        entityId: document.id,
        summary: `Viewed ${document.label} on application ${document.application.reference}`,
        sensitive: true,
      });
    }
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'content-type': document.mimeType,
        'content-length': String(buffer.length),
        'content-disposition': `inline; filename="${document.originalName.replace(/"/g, '')}"`,
        'cache-control': 'private, no-store',
      },
    });
  } catch {
    return new NextResponse('File unavailable', { status: 404 });
  }
}
