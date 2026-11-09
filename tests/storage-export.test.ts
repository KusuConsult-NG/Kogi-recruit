import { describe, expect, it } from 'vitest';
import {
  ALLOWED_MIME_TYPES, UploadError, formatBytes, validateUpload,
} from '@/lib/storage';
import { toCsv, toExcel, toPdf, buildExport, type TableSection } from '@/lib/export';
import { renderContent } from '@/components/rich-text';
import {
  applicantReference, applicationReference, enquiryReference, examNumber,
  exerciseReference, slugify, randomToken,
} from '@/lib/ids';
import { age, formatDate, formatNaira, initials, percent, titleCase } from '@/lib/format';

const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

describe('document upload validation (Module 2.4 / §7.1)', () => {
  it('accepts a genuine PDF within the size limit', () => {
    expect(() =>
      validateUpload({
        originalName: 'certificate.pdf', mimeType: 'application/pdf',
        sizeBytes: PDF.length, buffer: PDF,
        acceptTypes: ['application/pdf'], maxBytes: 5 * 1024 * 1024,
      }),
    ).not.toThrow();
  });

  it('rejects a file above the size limit, naming the limit', () => {
    expect(() =>
      validateUpload({
        originalName: 'big.pdf', mimeType: 'application/pdf',
        sizeBytes: 6 * 1024 * 1024, buffer: PDF, maxBytes: 5 * 1024 * 1024,
      }),
    ).toThrow(/Maximum permitted size is 5.0MB/);
  });

  it('rejects an empty file', () => {
    expect(() =>
      validateUpload({ originalName: 'empty.pdf', mimeType: 'application/pdf', sizeBytes: 0 }),
    ).toThrow(/empty/);
  });

  it('rejects a file type the portal does not permit', () => {
    expect(() =>
      validateUpload({ originalName: 'macro.exe', mimeType: 'application/x-msdownload', sizeBytes: 100 }),
    ).toThrow(UploadError);
  });

  it('rejects a permitted type that the requirement does not accept', () => {
    expect(() =>
      validateUpload({
        originalName: 'photo.png', mimeType: 'image/png', sizeBytes: PNG.length,
        buffer: PNG, acceptTypes: ['application/pdf'],
      }),
    ).toThrow(/must be one of/);
  });

  it('rejects an executable renamed as a PDF (magic-byte check)', () => {
    const fake = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ — Windows executable
    expect(() =>
      validateUpload({
        originalName: 'certificate.pdf', mimeType: 'application/pdf',
        sizeBytes: fake.length, buffer: fake, acceptTypes: ['application/pdf'],
      }),
    ).toThrow(/do not match its declared file type/);
  });

  it('accepts a genuine JPEG passport photograph', () => {
    expect(() =>
      validateUpload({
        originalName: 'passport.jpg', mimeType: 'image/jpeg', sizeBytes: JPEG.length,
        buffer: JPEG, acceptTypes: ['image/jpeg', 'image/png'], maxBytes: 2 * 1024 * 1024,
      }),
    ).not.toThrow();
  });

  it('rejects a missing or over-long file name', () => {
    expect(() => validateUpload({ originalName: '', mimeType: 'application/pdf', sizeBytes: 10 })).toThrow();
    expect(() =>
      validateUpload({ originalName: 'a'.repeat(300), mimeType: 'application/pdf', sizeBytes: 10 }),
    ).toThrow(/valid file name/);
  });

  it('permits the document formats the proposal names', () => {
    for (const type of ['application/pdf', 'image/jpeg', 'image/png']) {
      expect(ALLOWED_MIME_TYPES.has(type), type).toBe(true);
    }
  });

  it('formats file sizes for display', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.00 MB');
  });
});

describe('report export (Module 6)', () => {
  const sections: TableSection[] = [
    {
      title: 'Summary',
      columns: ['Indicator', 'Value'],
      rows: [['Applications received', 1420], ['Successful candidates', 148]],
    },
    {
      title: 'By LGA',
      columns: ['Local Government Area', 'Applications'],
      rows: [['Lokoja', 240], ['Okene, Kogi', 180]],
    },
  ];

  it('produces CSV with a BOM, escaping embedded separators', () => {
    const csv = toCsv(sections);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Applications received,1420');
    expect(csv).toContain('"Okene, Kogi",180');
  });

  it('escapes embedded quotes in CSV', () => {
    const csv = toCsv([{ title: 'T', columns: ['A'], rows: [['He said "yes"']] }]);
    expect(csv).toContain('"He said ""yes"""');
  });

  it('produces a valid XLSX workbook', async () => {
    const buf = await toExcel('Recruitment Report', sections, { Commission: 'Kogi CSC' });
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 2).toString('latin1')).toBe('PK'); // ZIP container
  });

  it('produces a valid PDF document', async () => {
    const buf = await toPdf('Recruitment Report', sections, { Commission: 'Kogi CSC' });
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('handles a section with no rows', async () => {
    const buf = await toPdf('Empty', [{ title: 'None', columns: ['A'], rows: [] }]);
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('names and types each export format correctly', async () => {
    const pdf = await buildExport('pdf', 'Recruitment Report', sections);
    expect(pdf.contentType).toBe('application/pdf');
    expect(pdf.filename).toMatch(/^recruitment-report-\d{4}-\d{2}-\d{2}\.pdf$/);

    const xlsx = await buildExport('excel', 'Recruitment Report', sections);
    expect(xlsx.contentType).toMatch(/spreadsheetml/);
    expect(xlsx.filename).toMatch(/\.xlsx$/);

    const csv = await buildExport('csv', 'Recruitment Report', sections);
    expect(csv.contentType).toMatch(/text\/csv/);
    expect(csv.filename).toMatch(/\.csv$/);
  });
});

describe('reference number generation', () => {
  it('generates distinct applicant references in the Commission format', () => {
    const a = applicantReference(new Date('2026-02-11'));
    expect(a).toMatch(/^KGCSC\/APP\/2026\/[0-9A-F]{6}$/);
    expect(a).not.toBe(applicantReference(new Date('2026-02-11')));
  });

  it('includes the exercise reference in an application reference', () => {
    expect(applicationReference('KGCSC/REC/2026/001', new Date('2026-02-11')))
      .toMatch(/^KGCSC\/2026\/0260{0,2}1?[0-9A-Z]*\/[0-9A-F]{6}$/);
  });

  it('generates sequential examination numbers', () => {
    expect(examNumber(1, new Date('2026-02-11'))).toBe('KGE/2026/000001');
    expect(examNumber(1234, new Date('2026-02-11'))).toBe('KGE/2026/001234');
  });

  it('generates exercise and enquiry references', () => {
    expect(exerciseReference(1, new Date('2026-02-11'))).toBe('KGCSC/REC/2026/001');
    expect(enquiryReference(new Date('2026-02-11'))).toMatch(/^ENQ\/2026\/[0-9A-F]{6}$/);
  });

  it('produces URL-safe slugs', () => {
    expect(slugify('2026 Recruitment Exercise — Now Open!')).toBe('2026-recruitment-exercise-now-open');
    expect(slugify('  Multiple   Spaces  ')).toBe('multiple-spaces');
  });

  it('produces unguessable tokens', () => {
    const t = randomToken(32);
    expect(t).toHaveLength(64);
    expect(t).not.toBe(randomToken(32));
  });
});

describe('display formatting', () => {
  it('formats dates and placeholders', () => {
    expect(formatDate(new Date('2026-02-11'))).toMatch(/11 Feb 2026/);
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not a date')).toBe('—');
  });

  it('formats Naira amounts with separators', () => {
    expect(formatNaira(35000000)).toBe('₦35,000,000');
  });

  it('calculates age at a given date', () => {
    expect(age(new Date('1995-04-12'), new Date('2026-04-11'))).toBe(30);
    expect(age(new Date('1995-04-12'), new Date('2026-04-12'))).toBe(31);
    expect(age(null)).toBeNull();
  });

  it('formats percentages, guarding against division by zero', () => {
    expect(percent(50, 200)).toBe('25%');
    expect(percent(5, 0)).toBe('0%');
  });

  it('title-cases status constants and derives initials', () => {
    expect(titleCase('UNDER_SCREENING')).toBe('Under Screening');
    expect(initials('Grace Adeyemi Oiza')).toBe('GA');
  });
});

describe('content rendering (Module 1)', () => {
  it('renders headings, lists and links', () => {
    const html = renderContent('## Heading\n\n- one\n- two\n\n[Apply](/recruitment)');
    expect(html).toContain('<h2>Heading</h2>');
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('<a href="/recruitment"');
  });

  it('renders numbered lists and emphasis', () => {
    const html = renderContent('1. first\n2. second\n\nThis is **bold** text');
    expect(html).toContain('<ol>');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('escapes authored HTML so content cannot inject markup', () => {
    const html = renderContent('<script>alert("x")</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('refuses a javascript: link', () => {
    const html = renderContent('[click](javascript:alert(1))');
    expect(html).not.toContain('href="javascript');
  });

  it('keeps single newlines inside a paragraph as line breaks', () => {
    expect(renderContent('line one\nline two')).toContain('line one<br/>line two');
  });
});
