import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * pdf.js needs its standard font data to read PDFs that use the 14 standard
 * fonts (most resume exports). Serve it in dev and ship it in the build at
 * /pdfjs/standard_fonts/ so the extractor can point standardFontDataUrl there.
 */
function pdfjsStandardFonts(): Plugin {
  const require = createRequire(import.meta.url);
  const dir = join(dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts');
  const files = readdirSync(dir).filter((f) => /\.(pfb|ttf)$/.test(f) || f.startsWith('LICENSE'));
  const base = '/pdfjs/standard_fonts/';
  return {
    name: 'pdfjs-standard-fonts',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (!url.startsWith(base)) return next();
        const name = url.slice(base.length);
        if (!files.includes(name)) return next();
        res.setHeader('Content-Type', 'application/octet-stream');
        res.end(readFileSync(join(dir, name)));
      });
    },
    generateBundle() {
      for (const f of files) {
        this.emitFile({ type: 'asset', fileName: `pdfjs/standard_fonts/${f}`, source: readFileSync(join(dir, f)) });
      }
    },
  };
}

export default defineConfig({
  // GitHub Pages serves the site under /<repo>/; the Pages workflow sets PAGES_BASE=/fifteen/.
  base: process.env.PAGES_BASE ?? '/',
  plugins: [react(), pdfjsStandardFonts()],
  server: { port: 5173, strictPort: true },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
