/**
 * Secure document storage with file type and size validation (Module 2.4, §7.1).
 * Files are stored outside the web root and only served through authorised routes.
 */
import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile, readFile, unlink, stat } from 'node:fs/promises';
import path from 'node:path';

export const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || './storage/uploads');

export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

/** Magic-byte signatures, so a renamed executable cannot pose as a PDF. */
const SIGNATURES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] },
  { mime: 'application/msword', bytes: [0xd0, 0xcf, 0x11, 0xe0] },
  { mime: 'application/vnd.ms-excel', bytes: [0xd0, 0xcf, 0x11, 0xe0] },
  { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: [0x50, 0x4b, 0x03, 0x04] },
  { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', bytes: [0x50, 0x4b, 0x03, 0x04] },
];

export class UploadError extends Error {}

export interface StoredFile {
  storedName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
}

export function defaultMaxBytes(): number {
  return Number(process.env.MAX_UPLOAD_MB || 8) * 1024 * 1024;
}

export function validateUpload(opts: {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  buffer?: Buffer;
  acceptTypes?: string[];
  maxBytes?: number;
}): void {
  const { originalName, mimeType, sizeBytes, buffer } = opts;
  const maxBytes = opts.maxBytes ?? defaultMaxBytes();
  const accept = opts.acceptTypes?.length ? opts.acceptTypes : Array.from(ALLOWED_MIME_TYPES);

  if (!originalName || originalName.length > 255) {
    throw new UploadError('A valid file name is required.');
  }
  if (sizeBytes <= 0) throw new UploadError('The selected file is empty.');
  if (sizeBytes > maxBytes) {
    throw new UploadError(
      `File is too large. Maximum permitted size is ${(maxBytes / (1024 * 1024)).toFixed(1)}MB.`,
    );
  }
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new UploadError(`File type "${mimeType}" is not permitted.`);
  }
  if (!accept.includes(mimeType)) {
    throw new UploadError(
      `This document must be one of: ${accept.map((t) => EXTENSION_BY_MIME[t] ?? t).join(', ')}.`,
    );
  }
  if (buffer && buffer.length >= 4) {
    const candidates = SIGNATURES.filter((s) => s.mime === mimeType);
    if (candidates.length > 0) {
      const matches = candidates.some((sig) =>
        sig.bytes.every((b, i) => buffer[(sig.offset ?? 0) + i] === b),
      );
      if (!matches) {
        throw new UploadError('The file contents do not match its declared file type.');
      }
    }
  }
}

function safeStoredName(mimeType: string): string {
  const ext = EXTENSION_BY_MIME[mimeType] ?? '.bin';
  const date = new Date();
  const folder = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  return `${folder}/${Date.now()}-${randomBytes(8).toString('hex')}${ext}`;
}

/** Persist an uploaded file after validation. Returns storage metadata. */
export async function storeFile(
  file: { name: string; type: string; size: number; arrayBuffer(): Promise<ArrayBuffer> },
  opts: { acceptTypes?: string[]; maxBytes?: number } = {},
): Promise<StoredFile> {
  const buffer = Buffer.from(await file.arrayBuffer());
  validateUpload({
    originalName: file.name,
    mimeType: file.type,
    sizeBytes: buffer.length,
    buffer,
    acceptTypes: opts.acceptTypes,
    maxBytes: opts.maxBytes,
  });

  const storedName = safeStoredName(file.type);
  const target = path.join(UPLOAD_ROOT, storedName);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, buffer);

  return {
    storedName,
    originalName: path.basename(file.name).replace(/[^\w.\- ()]/g, '_').slice(0, 200),
    mimeType: file.type,
    sizeBytes: buffer.length,
    checksum: createHash('sha256').update(buffer).digest('hex'),
  };
}

function resolveWithin(storedName: string): string {
  const target = path.resolve(UPLOAD_ROOT, storedName);
  if (!target.startsWith(UPLOAD_ROOT + path.sep) && target !== UPLOAD_ROOT) {
    throw new UploadError('Invalid document path.');
  }
  return target;
}

export async function readStoredFile(storedName: string): Promise<Buffer> {
  return readFile(resolveWithin(storedName));
}

export async function storedFileExists(storedName: string): Promise<boolean> {
  try {
    await stat(resolveWithin(storedName));
    return true;
  } catch {
    return false;
  }
}

export async function deleteStoredFile(storedName: string): Promise<void> {
  try {
    await unlink(resolveWithin(storedName));
  } catch {
    /* already gone */
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
