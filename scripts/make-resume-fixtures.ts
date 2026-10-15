/**
 * Generates the resume fixtures in e2e/fixtures/resumes/ as REAL files:
 *   freshman-maya.pdf, junior-sam.pdf, junior-priya.pdf, sophomore-jordan.docx
 * from the persona text in e2e/fixtures/resumes/personas.ts.
 *
 * No dependencies: a minimal text-PDF writer (Helvetica Type1, WinAnsi, correct xref
 * byte offsets) and a minimal DOCX writer (store-only ZIP with CRC-32).
 *
 *   node scripts/make-resume-fixtures.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PERSONAS } from '../e2e/fixtures/resumes/personas.ts';

// ---------- PDF ----------

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 54;
/** Characters outside Latin-1 that Windows-1252 (PDF WinAnsiEncoding) can carry. */
const WIN_ANSI_EXTRA: Record<number, number> = {
  0x2013: 0x96, // en dash
  0x2014: 0x97, // em dash
  0x2022: 0x95, // bullet
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2026: 0x85,
};

function pdfString(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 63;
    const byte = code < 256 ? code : WIN_ANSI_EXTRA[code];
    if (byte === undefined) throw new Error(`Character U+${code.toString(16)} is not encodable in WinAnsi: "${ch}"`);
    const c = String.fromCharCode(byte);
    out += c === '(' || c === ')' || c === '\\' ? `\\${c}` : c;
  }
  return `(${out})`;
}

type LineStyle = 'name' | 'header' | 'body' | 'blank';

function styleOf(line: string, index: number): LineStyle {
  if (line === '') return 'blank';
  if (index === 0) return 'name';
  if (/^[A-Z][A-Z &/]+$/.test(line)) return 'header';
  return 'body';
}

const STYLE = {
  name: { font: 'F2', size: 16, advance: 22 },
  header: { font: 'F2', size: 11, advance: 17 },
  body: { font: 'F1', size: 10, advance: 13 },
  blank: { font: 'F1', size: 10, advance: 7 },
} as const;

/** Lay lines onto pages; returns one content stream per page. */
function layoutPages(lines: string[]): string[] {
  const pages: string[] = [];
  let ops: string[] = [];
  let y = PAGE_H - MARGIN;
  const flush = (): void => {
    pages.push(ops.join('\n'));
    ops = [];
    y = PAGE_H - MARGIN;
  };
  lines.forEach((line, i) => {
    const st = STYLE[styleOf(line, i)];
    if (y - st.advance < MARGIN) flush();
    y -= st.advance;
    if (line !== '') {
      // widest allowed line: Helvetica averages ~0.5em per glyph
      if (line.length * st.size * 0.5 > PAGE_W - 2 * MARGIN + 40) throw new Error(`Line too long for one PDF line: "${line}"`);
      ops.push(`BT /${st.font} ${st.size} Tf 1 0 0 1 ${MARGIN} ${y.toFixed(1)} Tm ${pdfString(line)} Tj ET`);
    }
  });
  if (ops.length > 0 || pages.length === 0) flush();
  return pages;
}

/** A minimal, valid, text-only PDF 1.4. Returns the file bytes. */
export function buildPdf(lines: string[], title: string): Buffer {
  const streams = layoutPages(lines);
  // object numbers: 1 catalog, 2 pages, 3 F1, 4 F2, 5 info, then (page, content) pairs
  const firstPageObj = 6;
  const pageObjs = streams.map((_s, i) => firstPageObj + i * 2);
  const objects: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageObjs.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageObjs.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  objects[5] = `<< /Title ${pdfString(title)} /Producer (make-resume-fixtures.ts) >>`;
  streams.forEach((stream, i) => {
    const pageNo = firstPageObj + i * 2;
    const contentNo = pageNo + 1;
    objects[pageNo] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNo} 0 R >>`;
    // every char is <= 0xFF, so string length === byte length
    objects[contentNo] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let out = '%PDF-1.4\n%âãÏÓ\n';
  const offsets: number[] = [];
  for (let n = 1; n < objects.length; n++) {
    offsets[n] = out.length;
    out += `${n} 0 obj\n${objects[n]}\nendobj\n`;
  }
  const xrefAt = out.length;
  const count = objects.length; // objects 0..count-1
  out += `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let n = 1; n < count; n++) out += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${count} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

// ---------- DOCX (store-only ZIP) ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of data) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** 2026-10-15 00:00:00 in DOS date/time, fixed so the output is reproducible. */
const DOS_DATE = ((2026 - 1980) << 9) | (10 << 5) | 15;
const DOS_TIME = 0;

export function buildZip(files: { name: string; data: Buffer }[]): Buffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8');
    const crc = crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // flags: UTF-8 names
    local.writeUInt16LE(0, 8); // method: store
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(f.data.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, name, f.data);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4); // version made by
    cd.writeUInt16LE(20, 6); // version needed
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(DOS_TIME, 12);
    cd.writeUInt16LE(DOS_DATE, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(f.data.length, 20);
    cd.writeUInt32LE(f.data.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt16LE(0, 30); // extra
    cd.writeUInt16LE(0, 32); // comment
    cd.writeUInt16LE(0, 34); // disk
    cd.writeUInt16LE(0, 36); // internal attrs
    cd.writeUInt32LE(0, 38); // external attrs
    cd.writeUInt32LE(offset, 42);
    central.push(cd, name);
    offset += local.length + name.length + f.data.length;
  }
  const cdSize = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cdSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, ...central, end]);
}

const xmlEscape = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A minimal DOCX: [Content_Types].xml, _rels/.rels and word/document.xml with one paragraph per line. */
export function buildDocx(lines: string[]): Buffer {
  const paragraphs = lines
    .map((line, i) => {
      if (line === '') return '<w:p/>';
      const bold = styleOf(line, i) !== 'body';
      const rPr = bold ? '<w:rPr><w:b/></w:rPr>' : '';
      return `<w:p><w:r>${rPr}<w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r></w:p>`;
    })
    .join('');
  const documentXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    paragraphs +
    '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>' +
    '</w:body></w:document>';
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>';
  const rels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>';
  return buildZip([
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rels, 'utf8') },
    { name: 'word/document.xml', data: Buffer.from(documentXml, 'utf8') },
  ]);
}

// ---------- main ----------

export function writeResumeFixtures(outDir: string): string[] {
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  for (const persona of PERSONAS) {
    const name = persona.lines[0] ?? persona.slug;
    const bytes = persona.kind === 'pdf' ? buildPdf(persona.lines, `${name} - Resume`) : buildDocx(persona.lines);
    const path = join(outDir, persona.file);
    writeFileSync(path, bytes);
    written.push(`${persona.file} (${bytes.length} bytes)`);
  }
  return written;
}

if (import.meta.main) {
  const outDir = join(import.meta.dirname, '..', 'e2e', 'fixtures', 'resumes');
  for (const line of writeResumeFixtures(outDir)) console.info(`wrote ${line}`);
}
