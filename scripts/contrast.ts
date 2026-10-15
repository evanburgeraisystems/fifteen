// Quick WCAG contrast calculator used while choosing tokens.
const hex = (h: string): number[] => {
  const x = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16) / 255);
};
const lum = (h: string): number => {
  const [r, g, b] = hex(h).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
};
export const contrast = (a: string, b: string): number => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return ((l1 ?? 0) + 0.05) / ((l2 ?? 0) + 0.05);
};
if (process.argv[1]?.endsWith('contrast.ts')) {
  const pairs = process.argv.slice(2);
  for (const p of pairs) {
    const [a, b] = p.split('/');
    if (a && b) console.info(`${p.padEnd(18)} ${contrast(a, b).toFixed(2)}`);
  }
}
