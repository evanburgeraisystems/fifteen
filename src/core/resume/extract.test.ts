/**
 * Proves the generated fixture files are real: pdf.js (legacy Node build) and mammoth
 * read them, and the extracted text parses to the right profile. The browser extractor
 * (extract.ts) shares pdf-text.ts with the Node helper; its File-level guards are
 * tested here with a stub File (no DOM needed).
 */
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PERSONAS } from '../../../e2e/fixtures/resumes/personas.ts';
import { buildDocx, buildPdf, buildZip, crc32 } from '../../../scripts/make-resume-fixtures.ts';
import { extractDocxTextNode, extractPdfTextNode, extractResumeTextFromPath } from './extract-node.ts';
import { MAX_RESUME_BYTES, ResumeReadError, extractResumeText, resumeFileKind } from './extract.ts';
import { joinPdfPageItems, normalizeResumeText } from './pdf-text.ts';
import { classYearFromGrad, parseProfile } from './profile.ts';

const NOW = '2026-10-15T12:00:00.000Z';
const DIR = join(import.meta.dirname, '..', '..', '..', 'e2e', 'fixtures', 'resumes');

describe('generated fixture files', () => {
  for (const persona of PERSONAS) {
    describe(persona.file, () => {
      it('is a valid file that extracts to the persona text', async () => {
        const bytes = new Uint8Array(await readFile(join(DIR, persona.file)));
        if (persona.kind === 'pdf') {
          expect(new TextDecoder('latin1').decode(bytes.slice(0, 8))).toBe('%PDF-1.4');
        } else {
          expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
        }
        const text = await extractResumeTextFromPath(join(DIR, persona.file));
        const gotLines = text.split('\n').filter((l) => l.trim() !== '');
        const wantLines = persona.lines.filter((l) => l.trim() !== '');
        expect(gotLines).toEqual(wantLines);
      });

      it('parses to the expected profile', async () => {
        const text = await extractResumeTextFromPath(join(DIR, persona.file));
        const p = parseProfile(text, NOW);
        const want = persona.expected;
        expect(p.name).toBe(want.name);
        expect(p.email).toBe(want.email);
        expect(p.school).toBe(want.school);
        expect(p.gpa).toBe(want.gpa);
        expect(p.gradYear).toBe(want.gradYear);
        expect(classYearFromGrad(p.gradYear, NOW)).toBe(want.classYear);
        for (const id of want.majors) expect(p.majors).toContain(id);
        for (const id of want.skills) expect(p.skills).toContain(id);
        for (const c of want.coursework) expect(p.coursework).toContain(c);
        for (const t of want.titles) expect(p.experience.map((e) => e.title)).toContain(t);
      });
    });
  }

  it('keeps en dashes and bullets through the PDF encoding', async () => {
    const pdf = buildPdf(['Jordan Ellis', 'EDUCATION', 'Piedmont State University | Aug 2025 – May 2029', '• Planned 6 on-campus pop-ups'], 'Jordan');
    const text = await extractPdfTextNode(new Uint8Array(pdf));
    expect(text).toContain('Aug 2025 – May 2029');
    expect(text).toContain('• Planned 6 on-campus pop-ups');
  });

  it('lays long resumes out over several PDF pages', async () => {
    const lines = ['Pat Long', ...Array.from({ length: 120 }, (_v, i) => `Line number ${i + 1} of the long resume`)];
    const text = await extractPdfTextNode(new Uint8Array(buildPdf(lines, 'Long')));
    const got = text.split('\n').filter((l) => l.trim() !== '');
    expect(got).toEqual(lines);
  });

  it('writes a DOCX with correct CRC-32s and escapes XML', async () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    const text = await extractDocxTextNode(new Uint8Array(buildDocx(['A & B <Co>', '', 'Second line'])));
    expect(text).toBe('A & B <Co>\nSecond line');
    const zip = buildZip([{ name: 'x.txt', data: Buffer.from('hello') }]);
    expect(zip.readUInt32LE(14)).toBe(crc32(Buffer.from('hello')));
  });
});

describe('pdf-text helpers', () => {
  it('breaks lines on y changes and joins same-line items with the right spacing', () => {
    const items = [
      { str: 'Hello', transform: [1, 0, 0, 1, 50, 700], width: 25, height: 10 },
      { str: 'World', transform: [1, 0, 0, 1, 80, 700], width: 25, height: 10 },
      { str: 'Next', transform: [1, 0, 0, 1, 50, 686], width: 20, height: 10 },
      { str: 'After a gap', transform: [1, 0, 0, 1, 50, 640], width: 50, height: 10 },
      { type: 'beginMarkedContent' } as { str?: string },
    ];
    expect(joinPdfPageItems(items)).toBe('Hello World\nNext\n\nAfter a gap');
  });

  it('normalises ligatures, nbsp and zero-width characters', () => {
    expect(normalizeResumeText('Ofﬁce Assistant​\r\n\r\n\r\n\r\nNext  ')).toBe('Office Assistant\n\nNext');
  });
});

describe('extractResumeText guards (File-level)', () => {
  const file = (name: string, type: string, bytes: Uint8Array): File => new File([bytes as BlobPart], name, { type });

  it('detects file kinds by extension or MIME', () => {
    expect(resumeFileKind('a.PDF', '')).toBe('pdf');
    expect(resumeFileKind('a', 'application/pdf')).toBe('pdf');
    expect(resumeFileKind('a.docx', '')).toBe('docx');
    expect(resumeFileKind('a.doc', 'application/msword')).toBeNull();
    expect(resumeFileKind('a.png', 'image/png')).toBeNull();
  });

  it('rejects unsupported types with a friendly message', async () => {
    const err = await extractResumeText(file('resume.doc', 'application/msword', new Uint8Array([1, 2, 3]))).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ResumeReadError);
    expect((err as ResumeReadError).code).toBe('unsupported-type');
    expect((err as ResumeReadError).message).toMatch(/\.docx|PDF/);
  });

  it('rejects files over 5 MB before reading them', async () => {
    const big = new Uint8Array(MAX_RESUME_BYTES + 1);
    const err = await extractResumeText(file('big.pdf', 'application/pdf', big)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ResumeReadError);
    expect((err as ResumeReadError).code).toBe('too-large');
  });

  it('reports a corrupt DOCX and a text-less PDF without throwing raw library errors', async () => {
    const bad = await extractResumeText(file('x.docx', '', new Uint8Array([1, 2, 3, 4]))).catch((e: unknown) => e);
    expect(bad).toBeInstanceOf(ResumeReadError);
    expect((bad as ResumeReadError).code).toBe('corrupt');
  });

  it('reports an empty (scanned) document', async () => {
    const blank = buildDocx(['', '']);
    const err = await extractResumeText(file('scan.docx', '', new Uint8Array(blank))).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ResumeReadError);
    expect((err as ResumeReadError).code).toBe('empty');
    expect((err as ResumeReadError).message).toMatch(/scan/i);
  });

  it('reads a real DOCX through the browser extractor path', async () => {
    const jordan = PERSONAS.find((p) => p.kind === 'docx');
    const bytes = new Uint8Array(await readFile(join(DIR, jordan?.file ?? '')));
    const text = await extractResumeText(file('jordan.docx', '', bytes));
    expect(parseProfile(text, NOW).name).toBe('Jordan Ellis');
  });
});
