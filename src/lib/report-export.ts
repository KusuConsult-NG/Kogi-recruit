/** Shared helpers for the report export API routes (Module 6). */
import 'server-only';
import { NextResponse } from 'next/server';
import { buildExport, type ExportFormat, type TableSection } from './export';
import { recordAudit, AUDIT_ACTIONS } from './audit';
import type { SessionUser } from './auth';

export function parseFormat(value: string | null): ExportFormat {
  if (value === 'excel' || value === 'csv') return value;
  return 'pdf';
}

export async function respondWithExport(opts: {
  user: SessionUser;
  format: ExportFormat;
  title: string;
  sections: TableSection[];
  meta?: Record<string, string>;
  auditSummary: string;
  entityType?: string;
  entityId?: string;
}): Promise<NextResponse> {
  const payload = await buildExport(opts.format, opts.title, opts.sections, opts.meta ?? {});
  await recordAudit({
    action: AUDIT_ACTIONS.REPORT_EXPORTED,
    actor: opts.user,
    entityType: opts.entityType ?? 'Report',
    entityId: opts.entityId,
    summary: `${opts.auditSummary} exported as ${opts.format.toUpperCase()}`,
    metadata: { format: opts.format, rows: opts.sections.reduce((s, x) => s + x.rows.length, 0) },
  });

  const body = typeof payload.body === 'string' ? payload.body : new Uint8Array(payload.body);
  return new NextResponse(body, {
    headers: {
      'content-type': payload.contentType,
      'content-disposition': `attachment; filename="${payload.filename}"`,
      'cache-control': 'private, no-store',
    },
  });
}

export function errorResponse(message: string, status = 400): NextResponse {
  return new NextResponse(message, { status });
}
