// PDF stampabili per le prove: ogni quadro in A3 (da stampare o mostrare a
// schermo) e un foglio con i QR delle pagine di prova. Generati con Chromium.
// Uso: node scripts/make-print.mjs [url-base-del-sito]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import QRCode from 'qrcode';

const ROOT = path.resolve(import.meta.dirname, '..');
const BASE = (process.argv[2] ?? 'https://fabione-gssi.github.io/museo-noixvoi-ar/').replace(/\/?$/, '/');
const OUT = path.join(ROOT, 'public/stampa');
const DATA = path.join(ROOT, 'public/data');
fs.mkdirSync(OUT, { recursive: true });

const metas = JSON.parse(fs.readFileSync(path.join(DATA, 'index.json'), 'utf8')).paintings
  .map((p) => JSON.parse(fs.readFileSync(path.join(DATA, p.id, 'meta.json'), 'utf8')));

const browser = await chromium.launch();
const page = await browser.newPage();

for (const meta of metas) {
  const img = fs.readFileSync(path.join(DATA, meta.id, meta.image)).toString('base64');
  const landscape = meta.aspect > 1;
  await page.setContent(`<!doctype html><style>
    @page { size: A3 ${landscape ? 'landscape' : 'portrait'}; margin: 12mm; }
    body { margin: 0; display: flex; flex-direction: column; align-items: center; font-family: Arial, sans-serif; }
    img { max-width: 100%; max-height: ${landscape ? 255 : 385}mm; }
    p { font-size: 10pt; color: #555; margin: 4mm 0 0; }
  </style><img src="data:image/jpeg;base64,${img}"><p>${meta.artist}, ${meta.title} (${meta.year}). Pubblico dominio, Wikimedia Commons. Solo per le prove.</p>`);
  await page.pdf({ path: path.join(OUT, `${meta.id}-A3.pdf`), format: 'A3', landscape, printBackground: true });
}

const links = [
  ['Diagnostica del telefono', `${BASE}diagnostica.html`],
  ...metas.map((m) => [`${m.title} (${m.experience})`, `${BASE}?p=${encodeURIComponent(m.id)}&debug=1`]),
  ['Benchmark', `${BASE}benchmark.html`],
];
const qrs = await Promise.all(links.map(([, url]) => QRCode.toDataURL(url, { margin: 1, width: 600 })));
await page.setContent(`<!doctype html><style>
  @page { size: A4; margin: 12mm; }
  body { font-family: Arial, sans-serif; }
  h1 { font-size: 18pt; margin: 0 0 4mm; }
  .row { display: flex; align-items: center; gap: 8mm; margin: 4mm 0; break-inside: avoid; }
  .row img { width: 45mm; height: 45mm; }
  .row h2 { font-size: 14pt; margin: 0 0 2mm; }
  .row code { font-size: 9pt; word-break: break-all; }
</style><h1>Prove sul telefono: inquadra un codice</h1>
${links.map(([label, url], i) => `<div class="row"><img src="${qrs[i]}"><div><h2>${i + 1}. ${label}</h2><code>${url}</code></div></div>`).join('')}`);
await page.pdf({ path: path.join(OUT, 'prova.pdf'), format: 'A4', printBackground: true });

// Cartellini da appendere accanto ai quadri: due per foglio A4, da ritagliare.
const HINT = {
  racconto: 'Inquadra il quadro: parte il suo racconto.',
  dettagli: 'Inquadra il quadro, poi avvicinati ai particolari: ognuno racconta la sua storia.',
  caccia: 'Passa il telefono sul quadro: la lente rivela cose nascoste.',
  personaggio: 'Inquadra il quadro: il personaggio si presenta e risponde alle tue domande.',
};
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
const labels = [
  ...metas.map((m) => ({ title: m.title, sub: [m.artist, m.year].filter(Boolean).join(', '), room: m.room, hint: HINT[m.experience] ?? HINT.racconto, url: `${BASE}?p=${encodeURIComponent(m.id)}` })),
  { title: 'Quadri che prendono vita', sub: 'Tutti i quadri del percorso', room: '', hint: 'Scegli un quadro dall\'elenco e inquadralo con il telefono.', url: BASE },
];
const labelQrs = await Promise.all(labels.map((l) => QRCode.toDataURL(l.url, { margin: 1, width: 700, errorCorrectionLevel: 'M' })));
await page.setContent(`<!doctype html><style>
  @page { size: A4; margin: 8mm; }
  body { margin: 0; font-family: Arial, sans-serif; color: #111; }
  .label { height: 136mm; box-sizing: border-box; padding: 10mm 12mm; display: flex; gap: 10mm; align-items: center; border-bottom: 1px dashed #999; break-inside: avoid; }
  .label:nth-child(2n) { break-after: page; border-bottom: 0; }
  .label img { width: 62mm; height: 62mm; flex: none; }
  h1 { font-size: 24pt; margin: 0 0 2mm; }
  .sub { font-size: 14pt; margin: 0 0 1mm; color: #333; }
  .room { font-size: 11pt; margin: 0 0 6mm; color: #666; }
  .hint { font-size: 15pt; margin: 0 0 6mm; font-weight: bold; }
  .small { font-size: 10pt; color: #555; margin: 0; line-height: 1.4; }
</style>${labels.map((l, i) => `<div class="label"><img src="${labelQrs[i]}" alt=""><div>
  <h1>${esc(l.title)}</h1><p class="sub">${esc(l.sub)}</p>${l.room ? `<p class="room">${esc(l.room)}</p>` : '<p class="room"></p>'}
  <p class="hint">${esc(l.hint)}</p>
  <p class="small">Inquadra il codice con la fotocamera del telefono. Si apre nel browser: nessuna app da installare.<br>La fotocamera non registra e non invia nulla. Consigliati gli auricolari.</p>
</div></div>`).join('')}`);
await page.pdf({ path: path.join(OUT, 'cartellini.pdf'), format: 'A4', printBackground: true });

await browser.close();
process.stdout.write(JSON.stringify({ event: 'end', files: fs.readdirSync(OUT) }) + '\n');
