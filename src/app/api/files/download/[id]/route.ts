import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readStoredFile } from '@/lib/storage';

/** Public download of an approved form, guideline or publication. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.downloadItem.findUnique({ where: { id } });
  if (!item || !item.published) return new NextResponse('Not found', { status: 404 });

  try {
    const buffer = await readStoredFile(item.storedName);
    await prisma.downloadItem
      .update({ where: { id }, data: { downloads: { increment: 1 } } })
      .catch(() => undefined);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'content-type': item.mimeType,
        'content-length': String(buffer.length),
        'content-disposition': `attachment; filename="${item.originalName.replace(/"/g, '')}"`,
      },
    });
  } catch {
    return new NextResponse('File unavailable', { status: 404 });
  }
}
