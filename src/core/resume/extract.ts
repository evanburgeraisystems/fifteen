/**
 * Browser-side resume text extraction. PDF via pdf.js, DOCX via mammoth.
 * Nothing leaves the browser: the file is read locally and only the text is used.
 */
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { joinPdfPageItems, joinPdfPages, normalizeResumeText } from './pdf-text.ts';
import type { PdfItemLike } from './pdf-text.ts';

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export type ResumeReadErrorCode = 'too-large' | 'unsupported-type' | 'empty' | 'encrypted' | 'corrupt';

/** A problem reading the resume, with a message safe to show the student as-is. */
export class ResumeReadError extends Error {
  code: ResumeReadErrorCode;
  constructor(code: ResumeReadErrorCode, message: string) {
    super(message);
    this.name = 'ResumeReadError';
    this.code = code;
  }
}

export type ResumeFileKind = 'pdf' | 'docx';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Decide PDF vs DOCX from the file's extension and MIME type; null for anything else. */
export function resumeFileKind(name: string, mime: string): ResumeFileKind | null {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? '';
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
  if (ext === 'docx' || mime === DOCX_MIME) return 'docx';
  return null;
}

/** Shown when a resume has (almost) no text layer, i.e. a scan or a photo. */
export const EMPTY_TEXT_MESSAGE =
  "We couldn't find any text in that file. It may be a scan or a photo of a page. Export your resume as a PDF or DOCX from Word or Google Docs and try again.";

export function friendlyUnsupportedMessage(name: string): string {
  if (/\.doc$/i.test(name)) return 'Old .doc files are not supported. Open it in Word and save it as .docx or PDF, then upload again.';
  if (/\.(png|jpe?g|heic|gif|webp)$/i.test(name)) return 'That looks like an image. Upload your resume as a PDF or DOCX.';
  return 'Please upload your resume as a PDF or a Word (.docx) file.';
}

/** pdf.js and mammoth are loaded on first use, so the main bundle stays small until a resume is dropped. */
let pdfjsModule: Promise<typeof import('pdfjs-dist')> | null = null;
function loadPdfjs(): Promise<typeof import('pdfjs-dist')> {
  pdfjsModule ??= import('pdfjs-dist').then((m) => {
    m.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    return m;
  });
  return pdfjsModule;
}

async function pdfToText(data: Uint8Array): Promise<string> {
  const pdfjs = await loadPdfjs();
  // Text extraction only; the standard fonts are served by the pdfjs-standard-fonts Vite plugin.
  const task = pdfjs.getDocument({ data, useSystemFonts: false, standardFontDataUrl: '/pdfjs/standard_fonts/' });
  let doc: PDFDocumentProxy;
  try {
    doc = await task.promise;
  } catch (err) {
    if (err instanceof Error && err.name === 'PasswordException') {
      throw new ResumeReadError('encrypted', 'That PDF is password-protected. Remove the password (or export a fresh copy) and upload it again.');
    }
    throw new ResumeReadError('corrupt', "We couldn't open that PDF. Try exporting it again from the app you made it in.");
  }
  try {
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      pages.push(joinPdfPageItems(content.items as PdfItemLike[]));
    }
    return joinPdfPages(pages);
  } finally {
    await doc.destroy();
  }
}

async function docxToText(buffer: ArrayBuffer): Promise<string> {
  try {
    const { default: mammoth } = await import('mammoth');
    // mammoth's browser build takes an ArrayBuffer; its Node build (used by tests) only takes a Buffer
    const input = typeof Buffer === 'undefined' ? { arrayBuffer: buffer } : { buffer: Buffer.from(buffer) };
    const result = await mammoth.extractRawText(input);
    // mammoth separates paragraphs with a blank line; one paragraph = one line is what the parser wants
    return result.value.replace(/\n{2,}/g, '\n');
  } catch {
    throw new ResumeReadError('corrupt', "We couldn't open that Word file. Try saving it again as .docx, or upload a PDF instead.");
  }
}

/** Read a resume file and return its plain text (lines separated by \n). */
export async function extractResumeText(file: File): Promise<string> {
  const kind = resumeFileKind(file.name, file.type);
  if (!kind) throw new ResumeReadError('unsupported-type', friendlyUnsupportedMessage(file.name));
  if (file.size > MAX_RESUME_BYTES) {
    throw new ResumeReadError('too-large', 'That file is over 5 MB. Export a smaller PDF or DOCX (no embedded photos) and try again.');
  }
  const buffer = await file.arrayBuffer();
  const raw = kind === 'pdf' ? await pdfToText(new Uint8Array(buffer)) : await docxToText(buffer);
  const text = normalizeResumeText(raw);
  if (text.replace(/\s+/g, '').length < 20) throw new ResumeReadError('empty', EMPTY_TEXT_MESSAGE);
  return text;
}
