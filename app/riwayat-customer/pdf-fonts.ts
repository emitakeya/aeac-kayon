// app/riwayat-customer/pdf-fonts.ts
// Registers the AEAC identity fonts with @react-pdf/renderer.
// WOFF files live in public/fonts/ (from @fontsource, bundled into the repo —
// no runtime dependency on Google Fonts). Idempotent: safe to call repeatedly.
//
// NOTE: Latin subsets only. The PDF is Indonesian-only by spec; name_kanji is
// intentionally NOT rendered in the PDF (no JP glyphs registered).

import { Font } from '@react-pdf/renderer';

let registered = false;

export function registerPdfFonts(): void {
  if (registered) return;
  registered = true;

  Font.register({
    family: 'Anton',
    src: '/fonts/anton-latin-400-normal.woff',
  });

  Font.register({
    family: 'Archivo',
    fonts: [
      { src: '/fonts/archivo-latin-400-normal.woff', fontWeight: 400 },
      { src: '/fonts/archivo-latin-600-normal.woff', fontWeight: 600 },
      { src: '/fonts/archivo-latin-700-normal.woff', fontWeight: 700 },
    ],
  });

  Font.register({
    family: 'MartianMono',
    fonts: [
      { src: '/fonts/martian-mono-latin-400-normal.woff', fontWeight: 400 },
      { src: '/fonts/martian-mono-latin-600-normal.woff', fontWeight: 600 },
    ],
  });

  // Don't hyphenate Indonesian words mid-line.
  Font.registerHyphenationCallback((word) => [word]);
}
