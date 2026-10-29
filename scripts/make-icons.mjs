// Icone dell'app (schermata Home del telefono) e manifest, in public/.
// Uso: node scripts/make-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public/icons');
const BG = '#111111';
const GOLD = '#ffd166';

/** Cornice dorata con una lente: il quadro e lo sguardo che lo esplora. pad = margine (0-1). */
const svg = (pad) => {
  const s = 512;
  const m = s * pad;
  const w = s - 2 * m;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" fill="${BG}"/>
  <rect x="${m + w * 0.14}" y="${m + w * 0.2}" width="${w * 0.72}" height="${w * 0.6}" rx="${w * 0.02}" fill="none" stroke="${GOLD}" stroke-width="${w * 0.07}"/>
  <circle cx="${m + w * 0.58}" cy="${m + w * 0.47}" r="${w * 0.15}" fill="none" stroke="#ffffff" stroke-width="${w * 0.045}"/>
  <line x1="${m + w * 0.68}" y1="${m + w * 0.58}" x2="${m + w * 0.78}" y2="${m + w * 0.69}" stroke="#ffffff" stroke-width="${w * 0.06}" stroke-linecap="round"/>
</svg>`;
};

fs.mkdirSync(OUT, { recursive: true });
const icons = [
  ['icon-192.png', 192, 0.04],
  ['icon-512.png', 512, 0.04],
  ['icon-maskable-512.png', 512, 0.14],
  ['apple-touch-icon.png', 180, 0.08],
];
for (const [name, size, pad] of icons) await sharp(Buffer.from(svg(pad))).resize(size, size).png().toFile(path.join(OUT, name));

const manifest = {
  name: 'Quadri che prendono vita',
  short_name: 'Quadri',
  description: 'Inquadra un quadro con il telefono: i particolari raccontano la loro storia.',
  lang: 'it',
  start_url: './',
  scope: './',
  display: 'standalone',
  orientation: 'portrait',
  background_color: BG,
  theme_color: BG,
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
fs.writeFileSync(path.join(ROOT, 'public/manifest.webmanifest'), JSON.stringify(manifest, null, 2));
console.log('Icone e manifest creati.');
