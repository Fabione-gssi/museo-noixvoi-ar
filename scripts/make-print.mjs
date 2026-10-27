// PDF stampabili della Fase 0: il quadro in A3 (da stampare o mostrare a
// schermo) e un foglio con i QR delle pagine di prova. Generati con Chromium.
// Uso: node scripts/make-print.mjs <url-base-del-sito>
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import QRCode from 'qrcode';

const ROOT = path.resolve(import.meta.dirname, '..');
const BASE = (process.argv[2] ?? 'https://fabione-gssi.github.io/museo-noixvoi-ar/').replace(/\/?$/, '/');
const OUT = path.join(ROOT, 'public/stampa');
fs.mkdirSync(OUT, { recursive: true });

const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/arnolfini/meta.json'), 'utf8'));
const img = fs.readFileSync(path.join(ROOT, 'public/data/arnolfini', meta.image)).toString('base64');

const links = [
  ['1. Diagnostica del telefono', `${BASE}diagnostica.html`],
  ['2. Riconoscimento (Arnolfini)', `${BASE}?p=arnolfini&debug=1`],
  ['3. Benchmark', `${BASE}benchmark.html`],
];
const qrs = await Promise.all(links.map(([, url]) => QRCode.toDataURL(url, { margin: 1, width: 600 })));

const browser = await chromium.launch();
const page = await browser.newPage();

await page.setContent(`<!doctype html><style>
  @page { size: A3; margin: 12mm; }
  body { margin: 0; display: flex; flex-direction: column; align-items: center; font-family: Arial, sans-serif; }
  img { max-width: 100%; max-height: 385mm; }
  p { font-size: 10pt; color: #555; margin: 4mm 0 0; }
</style><img src="data:image/jpeg;base64,${img}"><p>${meta.artist}, ${meta.title} (${meta.year}). Pubblico dominio, Wikimedia Commons. Solo per la prova tecnica.</p>`);
await page.pdf({ path: path.join(OUT, 'arnolfini-A3.pdf'), format: 'A3', printBackground: true });

await page.setContent(`<!doctype html><style>
  @page { size: A4; margin: 14mm; }
  body { font-family: Arial, sans-serif; }
  h1 { font-size: 20pt; margin: 0 0 4mm; }
  .row { display: flex; align-items: center; gap: 8mm; margin: 6mm 0; }
  .row img { width: 55mm; height: 55mm; }
  .row h2 { font-size: 15pt; margin: 0 0 2mm; }
  .row code { font-size: 9pt; word-break: break-all; }
</style><h1>Prova Fase 0: inquadra un codice con il telefono</h1>
${links.map(([label, url], i) => `<div class="row"><img src="${qrs[i]}"><div><h2>${label}</h2><code>${url}</code></div></div>`).join('')}`);
await page.pdf({ path: path.join(OUT, 'prova-fase0.pdf'), format: 'A4', printBackground: true });

await browser.close();
process.stdout.write(JSON.stringify({ event: 'end', files: fs.readdirSync(OUT) }) + '\n');
