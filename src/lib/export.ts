/**
 * Module 6 - report export to approved formats (PDF, Excel, CSV).
 */
import 'server-only';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { COMMISSION } from './constants';

export interface TableSection {
  title: string;
  columns: string[];
  rows: Array<Array<string | number>>;
}

// --- CSV -----------------------------------------------------------------

function csvCell(value: string | number): string {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(sections: TableSection[]): string {
  const lines: string[] = [];
  sections.forEach((section, index) => {
    if (index > 0) lines.push('');
    lines.push(csvCell(section.title));
    lines.push(section.columns.map(csvCell).join(','));
    for (const row of section.rows) lines.push(row.map(csvCell).join(','));
  });
  return `﻿${lines.join('\r\n')}\r\n`;
}

// --- Excel ---------------------------------------------------------------

export async function toExcel(
  title: string,
  sections: TableSection[],
  meta: Record<string, string> = {},
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = COMMISSION.name;
  workbook.created = new Date();

  for (const section of sections) {
    const safeName = section.title.replace(/[*?:\\/\[\]]/g, '').slice(0, 30) || 'Sheet';
    const sheet = workbook.addWorksheet(safeName);

    sheet.mergeCells(1, 1, 1, Math.max(section.columns.length, 2));
    const heading = sheet.getCell(1, 1);
    heading.value = COMMISSION.name;
    heading.font = { bold: true, size: 14, color: { argb: 'FF106441' } };

    sheet.mergeCells(2, 1, 2, Math.max(section.columns.length, 2));
    const sub = sheet.getCell(2, 1);
    sub.value = `${title} — ${section.title}`;
    sub.font = { bold: true, size: 11 };

    let row = 3;
    for (const [key, value] of Object.entries(meta)) {
      sheet.getCell(row, 1).value = key;
      sheet.getCell(row, 1).font = { bold: true, size: 9 };
      sheet.getCell(row, 2).value = value;
      sheet.getCell(row, 2).font = { size: 9 };
      row += 1;
    }
    row += 1;

    const headerRow = sheet.getRow(row);
    headerRow.values = section.columns;
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF106441' } };
      cell.alignment = { vertical: 'middle' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF0E422E' } } };
    });
    row += 1;

    for (const dataRow of section.rows) {
      sheet.getRow(row).values = dataRow;
      row += 1;
    }

    section.columns.forEach((col, i) => {
      const widths = section.rows.map((r) => String(r[i] ?? '').length);
      sheet.getColumn(i + 1).width = Math.min(50, Math.max(col.length + 4, ...widths, 12));
    });
    sheet.views = [{ state: 'frozen', ySplit: row - section.rows.length - 1 }];
  }

  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}

// --- PDF -----------------------------------------------------------------

export async function toPdf(
  title: string,
  sections: TableSection[],
  meta: Record<string, string> = {},
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - 80;

      doc.rect(0, 0, doc.page.width, 78).fill('#106441');
      doc.fillColor('#ffffff').fontSize(15).font('Helvetica-Bold')
        .text(COMMISSION.name, 40, 22, { width: pageWidth });
      doc.fontSize(9).font('Helvetica')
        .text('Civil Service Recruitment Management System', 40, 44, { width: pageWidth });
      doc.fillColor('#1a2b22').moveDown(3);

      doc.y = 96;
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#106441').text(title, 40, doc.y);
      doc.moveDown(0.4);

      doc.fontSize(8.5).font('Helvetica').fillColor('#44554d');
      const metaEntries = Object.entries(meta);
      if (metaEntries.length) {
        for (const [key, value] of metaEntries) {
          doc.text(`${key}: ${value}`, { width: pageWidth });
        }
      }
      doc.text(`Generated: ${new Date().toLocaleString('en-NG')}`, { width: pageWidth });
      doc.moveDown(0.8);

      for (const section of sections) {
        if (doc.y > doc.page.height - 140) doc.addPage();
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#106441')
          .text(section.title, { width: pageWidth });
        doc.moveDown(0.3);

        const cols = section.columns.length || 1;
        const colWidth = pageWidth / cols;
        const drawHeader = () => {
          const y = doc.y;
          doc.rect(40, y - 2, pageWidth, 17).fill('#106441');
          doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
          section.columns.forEach((c, i) => {
            doc.text(String(c), 44 + i * colWidth, y + 3, {
              width: colWidth - 8,
              ellipsis: true,
              lineBreak: false,
            });
          });
          doc.y = y + 19;
          doc.fillColor('#1a2b22').font('Helvetica').fontSize(8);
        };
        drawHeader();

        section.rows.forEach((row, rowIndex) => {
          if (doc.y > doc.page.height - 70) {
            doc.addPage();
            doc.y = 50;
            drawHeader();
          }
          const y = doc.y;
          if (rowIndex % 2 === 1) doc.rect(40, y - 2, pageWidth, 15).fill('#f3f7f4');
          doc.fillColor('#1a2b22').font('Helvetica').fontSize(8);
          row.forEach((cell, i) => {
            doc.text(String(cell ?? ''), 44 + i * colWidth, y + 2, {
              width: colWidth - 8,
              ellipsis: true,
              lineBreak: false,
            });
          });
          doc.y = y + 15;
        });

        if (section.rows.length === 0) {
          doc.fontSize(8).fillColor('#7a8a83').text('No records for this section.', 44, doc.y + 2);
          doc.y += 16;
        }
        doc.moveDown(0.8);
      }

      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i += 1) {
        doc.switchToPage(range.start + i);
        doc.fontSize(7.5).fillColor('#7a8a83').font('Helvetica')
          .text(
            `${COMMISSION.name} — official report. Page ${i + 1} of ${range.count}. Restricted to authorised officers.`,
            40,
            doc.page.height - 32,
            { width: pageWidth, align: 'center' },
          );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export type ExportFormat = 'pdf' | 'excel' | 'csv';

export interface ExportPayload {
  body: Buffer | string;
  contentType: string;
  filename: string;
}

export async function buildExport(
  format: ExportFormat,
  title: string,
  sections: TableSection[],
  meta: Record<string, string> = {},
): Promise<ExportPayload> {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'csv') {
    return {
      body: toCsv(sections),
      contentType: 'text/csv; charset=utf-8',
      filename: `${slug}-${stamp}.csv`,
    };
  }
  if (format === 'excel') {
    return {
      body: await toExcel(title, sections, meta),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `${slug}-${stamp}.xlsx`,
    };
  }
  return {
    body: await toPdf(title, sections, meta),
    contentType: 'application/pdf',
    filename: `${slug}-${stamp}.pdf`,
  };
}
