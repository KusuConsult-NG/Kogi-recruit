import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readStoredFile } from '@/lib/storage';

/** Public download of an attachment on a PUBLISHED article. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attachment = await prisma.articleAttachment.findUnique({
    where: { id },
    include: { article: { select: { status: true } } },
  });
  if (!attachment || attachment.article.status !== 'PUBLISHED') {
    return new NextResponse('Not found', { status: 404 });
  }
  try {
    const buffer = await readStoredFile(attachment.storedName);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'content-type': attachment.mimeType,
        'content-length': String(buffer.length),
        'content-disposition': `inline; filename="${attachment.originalName.replace(/"/g, '')}"`,
        'cache-control': 'public, max-age=3600',
      },
    });
  } catch {
    return new NextResponse('File unavailable', { status: 404 });
  }
}
