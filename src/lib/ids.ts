import { randomBytes } from 'node:crypto';

function rand(n: number): string {
  return randomBytes(n).toString('hex').toUpperCase().slice(0, n);
}

/** Unique applicant reference, e.g. KGCSC/APP/2026/4F2A91 */
export function applicantReference(date = new Date()): string {
  return `KGCSC/APP/${date.getFullYear()}/${rand(6)}`;
}

/** Unique application reference, e.g. KGCSC/2026/REC001/A1B2C3 */
export function applicationReference(exerciseRef: string, date = new Date()): string {
  const tail = exerciseRef.replace(/[^A-Za-z0-9]/g, '').slice(-6).toUpperCase() || 'EX';
  return `KGCSC/${date.getFullYear()}/${tail}/${rand(6)}`;
}

/** Examination number, e.g. KGE/2026/000123 */
export function examNumber(seq: number, date = new Date()): string {
  return `KGE/${date.getFullYear()}/${String(seq).padStart(6, '0')}`;
}

export function enquiryReference(date = new Date()): string {
  return `ENQ/${date.getFullYear()}/${rand(6)}`;
}

export function correspondenceReference(date = new Date()): string {
  return `COR/${date.getFullYear()}/${rand(6)}`;
}

export function exerciseReference(seq: number, date = new Date()): string {
  return `KGCSC/REC/${date.getFullYear()}/${String(seq).padStart(3, '0')}`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
