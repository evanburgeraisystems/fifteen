/**
 * Node-side twin of extract.ts, for tests and scripts: the same page joining and
 * normalisation, but through pdf.js's legacy build (which runs on Node without a
 * browser) and mammoth's Node entry. The browser path stays in extract.ts.
 */
import { readFile } from 'node:fs/promises';
import mammoth from 'mammoth';
import { joinPdfPageItems, joinPdfPages, normalizeResumeText } from './pdf-text.ts';
import type { PdfItemLike } from './pdf-text.ts';

export async function extractPdfTextNode(data: Uint8Array): Promise<string> {
  // pdf.js rejects Node Buffers: always hand it a plain Uint8Array copy.
  const bytes = new Uint8Array(data);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: false, verbosity: 0 }).promise;
  try {
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      pages.push(joinPdfPageItems(content.items as PdfItemLike[]));
    }
    return normalizeResumeText(joinPdfPages(pages));
  } finally {
    await doc.destroy();
  }
}

export async function extractDocxTextNode(data: Uint8Array): Promise<string> {
  // mammoth's Node build reads a Buffer (its `arrayBuffer` input exists only in the browser build)
  const result = await mammoth.extractRawText({ buffer: Buffer.from(data) });
  return normalizeResumeText(result.value.replace(/\n{2,}/g, '\n'));
}

/** Read a resume file from disk (.pdf or .docx) and return its text. */
export async function extractResumeTextFromPath(path: string): Promise<string> {
  const bytes = new Uint8Array(await readFile(path));
  if (/\.pdf$/i.test(path)) return extractPdfTextNode(bytes);
  if (/\.docx$/i.test(path)) return extractDocxTextNode(bytes);
  throw new Error(`Unsupported resume file type: ${path}`);
}
