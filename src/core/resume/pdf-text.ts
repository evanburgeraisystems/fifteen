/**
 * Turn pdf.js text items into lines of text. Shared by the browser extractor
 * (extract.ts) and the Node test helper (extract-node.ts); no pdf.js import here,
 * so it works with either build.
 */

/** The fields of a pdf.js TextItem we use (markers have no `str`). */
export interface PdfItemLike {
  str?: string;
  /** [a, b, c, d, e, f]: e = x, f = y of the baseline start. */
  transform?: number[];
  width?: number;
  height?: number;
  hasEOL?: boolean;
}

/** Join the text items of one page into lines, using y-position changes as line breaks. */
export function joinPdfPageItems(items: readonly PdfItemLike[]): string {
  const out: string[] = [];
  let line = '';
  let lastY: number | null = null;
  let lastEnd: number | null = null;
  let lastHeight = 10;

  const flush = (): void => {
    if (line.trim() !== '') out.push(line.replace(/[ \t]+$/g, ''));
    line = '';
    lastEnd = null;
  };

  for (const item of items) {
    if (typeof item.str !== 'string' || !item.transform) continue;
    const x = item.transform[4] ?? 0;
    const y = item.transform[5] ?? 0;
    const height = item.height && item.height > 0 ? item.height : lastHeight;

    if (lastY !== null && Math.abs(y - lastY) > Math.max(2, height * 0.5)) {
      flush();
      // a gap well over one line height means a blank line (paragraph break)
      if (Math.abs(y - lastY) > Math.max(lastHeight, height) * 1.9) out.push('');
    } else if (line !== '' && lastEnd !== null) {
      const gap = x - lastEnd;
      if (gap > height * 0.15 && !line.endsWith(' ') && !item.str.startsWith(' ')) line += gap > height * 1.5 ? '  ' : ' ';
    }

    line += item.str;
    lastY = y;
    lastEnd = x + (item.width ?? 0);
    lastHeight = height;
    if (item.hasEOL) {
      flush();
      lastY = null;
    }
  }
  flush();
  return out.join('\n');
}

/** Join pages with a blank line between them. */
export function joinPdfPages(pages: readonly string[]): string {
  return pages.join('\n\n');
}

const INVISIBLE_CODES = [0x200b, 0x200c, 0x200d, 0xfeff, 0x00ad];
const INVISIBLE_RE = new RegExp(`[${INVISIBLE_CODES.map((c) => String.fromCharCode(c)).join('')}]`, 'g');

/** Normalise extracted text: NFKC (ligatures, nbsp), no zero-width chars, tidy blank lines. */
export function normalizeResumeText(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(INVISIBLE_RE, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
