// Prepara il benchmark "set globale": ~15 quadri di dominio pubblico + 2 ritagli
// ciascuno (~45 target) in un unico .mind, con l'Arnolfini ai primi 3 indici
// (gli stessi del suo set per quadro). Le immagini extra servono solo al
// benchmark e non sono contenuti dell'app.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { compileMind, inspectMind } from './lib/mind-compiler.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE = path.join(ROOT, '.cache/bench');
const OUT = path.join(ROOT, 'public/bench');
const UA = 'museo-noixvoi-ar/0.1 (fabio.tedone.hg@gmail.com)';
const emit = (event, data = {}) => process.stdout.write(JSON.stringify({ event, ...data }) + '\n');

const TITLES = [
  "Albrecht Dürer - Selbstbildnis im Pelzrock - Alte Pinakothek.jpg",
  "Leonardo da Vinci - Ginevra de' Benci - Google Art Project.jpg",
  'The Night Watch - HD.jpg',
  'Pieter Brueghel the Elder - The Dutch Proverbs - Google Art Project.jpg',
  'JEAN LOUIS THÉODORE GÉRICAULT - La Balsa de la Medusa (Museo del Louvre, 1818-19).jpg',
  'Mona Lisa, by Leonardo da Vinci, from C2RMF retouched.jpg',
  '1665 Girl with a Pearl Earring.jpg',
  'Van Gogh - Starry Night - Google Art Project.jpg',
  'Sandro Botticelli - La nascita di Venere - Google Art Project - edited.jpg',
  'Las Meninas, by Diego Velázquez, from Prado in Google Earth.jpg',
  'John Constable - The Hay Wain (1821).jpg',
  'Eugène Delacroix - Le 28 Juillet. La Liberté guidant le peuple.jpg',
  'Caspar David Friedrich - Wanderer above the sea of fog.jpg',
  'Pieter Bruegel the Elder - Hunters in the Snow (Winter) - Google Art Project.jpg',
];

async function fetchThumbs() {
  fs.mkdirSync(CACHE, { recursive: true });
  const api = new URL('https://commons.wikimedia.org/w/api.php');
  Object.entries({ action: 'query', prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '1280', format: 'json', iiextmetadatafilter: 'LicenseShortName', titles: TITLES.map((t) => `File:${t}`).join('|') })
    .forEach(([k, v]) => api.searchParams.set(k, v));
  const res = await (await fetch(api, { headers: { 'User-Agent': UA } })).json();
  const out = [];
  for (const p of Object.values(res.query.pages)) {
    const info = p.imageinfo?.[0];
    if (!info) { emit('warn', { message: `non trovato: ${p.title}` }); continue; }
    const file = path.join(CACHE, `${out.length}.jpg`);
    if (!fs.existsSync(file)) {
      const r = await fetch(info.thumburl, { headers: { 'User-Agent': UA } });
      fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    }
    out.push({ title: p.title, file, url: info.descriptionurl, license: info.extmetadata?.LicenseShortName?.value });
    emit('downloaded', { title: p.title });
  }
  return out;
}

/** I due riquadri (25% del lato) con più contrasto: ritagli "facili" da riconoscere. */
async function bestCrops(file) {
  const { width: W, height: H } = await sharp(file).metadata();
  const cw = Math.round(W * 0.25), ch = Math.round(H * 0.25);
  const cells = [];
  for (let gy = 0; gy < 4; gy++)
    for (let gx = 0; gx < 4; gx++) {
      const region = { left: Math.round(gx * (W - cw) / 3), top: Math.round(gy * (H - ch) / 3), width: cw, height: ch };
      const st = await sharp(file).extract(region).greyscale().stats();
      cells.push({ region, score: st.channels[0].stdev });
    }
  return cells.sort((a, b) => b.score - a.score).slice(0, 2).map((c) => c.region);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const thumbs = await fetchThumbs();
  const work = path.join(CACHE, 'targets');
  fs.mkdirSync(work, { recursive: true });
  // Arnolfini per primo: stessi file del suo set per quadro.
  const arn = path.join(ROOT, 'public/data/arnolfini');
  const files = ['target.jpg', 'dettaglio-specchio.jpg', 'dettaglio-cane.jpg'].map((f) => path.join(arn, f));
  for (const [i, t] of thumbs.entries()) {
    const main = path.join(work, `${i}-main.jpg`);
    await sharp(t.file).resize({ width: 1024, height: 1024, fit: 'inside' }).jpeg({ quality: 88 }).toFile(main);
    files.push(main);
    for (const [j, region] of (await bestCrops(t.file)).entries()) {
      const f = path.join(work, `${i}-crop${j}.jpg`);
      await sharp(t.file).extract(region).resize({ width: 768, height: 768, fit: 'inside' }).jpeg({ quality: 88 }).toFile(f);
      files.push(f);
    }
  }
  emit('compile', { targets: files.length });
  const t0 = Date.now();
  let last = -1;
  const mind = await compileMind(files, (p) => {
    const r = Math.floor(p / 10) * 10;
    if (r !== last) emit('progress', { percent: (last = r) });
  });
  fs.writeFileSync(path.join(OUT, 'global.mind'), mind);
  fs.copyFileSync(path.join(arn, 'targets.mind'), path.join(OUT, 'arnolfini.mind'));
  const stats = await inspectMind(mind);
  const manifest = {
    note: 'Solo per il benchmark della Fase 0. Indici 0-2 = Arnolfini (quadro, specchio, cane).',
    targets: files.length,
    compileMs: Date.now() - t0,
    sizes: { global: mind.length, arnolfini: fs.statSync(path.join(OUT, 'arnolfini.mind')).size },
    sources: thumbs.map(({ title, url, license }) => ({ title, url, license })),
    points: stats.map((s) => s.matchingPoints),
  };
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  emit('end', { targets: files.length, bytes: mind.length, compileMs: manifest.compileMs });
}

main();
