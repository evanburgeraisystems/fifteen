/** HTML -> readable plain text. Handles double-escaped ATS content (Greenhouse). */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
  bull: '•',
  middot: '·',
  copy: '©',
  reg: '®',
  trade: '™',
  eacute: 'é',
  egrave: 'è',
  aacute: 'á',
  agrave: 'à',
  uuml: 'ü',
  ouml: 'ö',
  auml: 'ä',
  ntilde: 'ñ',
  ccedil: 'ç',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  deg: '°',
  euro: '€',
  pound: '£',
  cent: '¢',
  times: '×',
  shy: '',
  zwnj: '',
  zwj: '',
};

function fromCodePoint(n: number): string {
  if (!Number.isFinite(n) || n <= 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return '';
  return String.fromCodePoint(n);
}

/** Decode named and numeric entities in a single pass (so `&amp;lt;` becomes `&lt;`, not `<`). */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const n = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return fromCodePoint(n);
    }
    const hit = NAMED_ENTITIES[body.toLowerCase()];
    return hit === undefined ? whole : hit;
  });
}

const INVISIBLE_SPACES = new RegExp(`[${[0xa0, 0x2007, 0x202f, 0x200b, 0x2060, 0xfeff].map((c) => String.fromCharCode(c)).join('')}]`, 'g');

const ESCAPED_TAG = /&(?:amp;)*lt;\/?[a-z!]/i;

/** Strip HTML to readable plain text (keeps list items as lines, decodes entities). */
export function htmlToText(html: string): string {
  let s = html;
  // Greenhouse (and others) ship HTML as escaped text: "&lt;p&gt;..." (sometimes twice).
  for (let i = 0; i < 3 && ESCAPED_TAG.test(s); i++) s = decodeEntities(s);

  s = s
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|head|noscript|svg)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/li\s*>/gi, '\n')
    .replace(/<\/?(?:p|div|h[1-6]|ul|ol|tr|table|section|article|header|footer|blockquote|pre|hr|br)\b[^>]*>/gi, '\n')
    .replace(/<\/?[a-z!][^>]*>/gi, '');

  s = decodeEntities(s);

  s = s
    .replace(/•[ \t]*\n+[ \t]*/g, '• ')
    .replace(/\r\n?/g, '\n')
    .replace(INVISIBLE_SPACES, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .split('\n')
    .map((line) => (line.trim() === '•' ? '' : line.trim()))
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
  return s;
}
