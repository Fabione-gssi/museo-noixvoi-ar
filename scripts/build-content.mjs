// Pipeline dei contenuti: legge contenuti/<cartella>/ e produce public/data/.
// Incrementale (cache per hash dei file sorgente) e con avanzamento leggibile
// da macchina: una riga JSON per evento su stdout.
//
// Fase 0: target principale + ritagli dei particolari, file .mind, anteprima
// di revisione, meta.json e index.json minimi.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { compileMind, inspectMind } from './lib/mind-compiler.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'contenuti');
const OUT = path.join(ROOT, 'public/data');
const REVIEW = path.join(ROOT, 'revisione');
const CACHE = path.join(ROOT, '.cache/build');

// Lato lungo delle immagini date al compilatore: sopra ~1000 px il tracking
// non migliora e il .mind cresce molto.
const TARGET_SIZE = 1024;
const DETAIL_TARGET_SIZE = 768;
// Sotto questa soglia di punti caratteristici un target è considerato debole
// e il particolare usa anche il metodo mirino.
const WEAK_POINTS = 250;
const PIPELINE_VERSION = 1;

const emit = (event, data = {}) => process.stdout.write(JSON.stringify({ event, ...data }) + '\n');

function hashFiles(files) {
  const h = crypto.createHash('sha256').update(String(PIPELINE_VERSION));
  for (const f of files) {
    h.update(path.basename(f));
    h.update(fs.readFileSync(f));
  }
  return h.digest('hex');
}

function readInfo(dir) {
  const file = path.join(dir, 'info.txt');
  const problems = [];
  if (!fs.existsSync(file)) return { info: {}, problems: ['manca info.txt'] };
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const kv = {};
  const plain = [];
  for (const l of lines) {
    const m = l.match(/^(esperienza)\s*:\s*(.+)$/i);
    if (m) kv[m[1].toLowerCase()] = m[2].trim().toLowerCase();
    else plain.push(l);
  }
  const [title, artist, year, room] = plain;
  const info = { title, artist, year, room, experience: kv.esperienza };
  for (const [k, label] of [['title', 'titolo'], ['artist', 'autore'], ['year', 'anno'], ['room', 'sala']]) {
    if (!info[k]) problems.push(`manca ${label} in info.txt`);
    else if (/^\[DA COMPLETARE/i.test(info[k])) problems.push(`${label} da completare in info.txt`);
  }
  return { info, problems };
}

function readRegions(dir) {
  const file = path.join(dir, 'regioni.json');
  if (!fs.existsSync(file)) return { dettagli: [] };
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function reviewImage(srcImg, dettagli, outFile) {
  const meta = await sharp(srcImg).metadata();
  const w = 1200;
  const h = Math.round((meta.height / meta.width) * w);
  const rects = dettagli.map((d, i) => {
    const { x, y, w: cw, h: ch } = d.crop;
    return `<rect x="${x * w}" y="${y * h}" width="${cw * w}" height="${ch * h}" fill="none" stroke="#ff2d55" stroke-width="5"/>
      <rect x="${x * w}" y="${y * h - 34}" width="${Math.max(cw * w, 260)}" height="34" fill="#ff2d55"/>
      <text x="${x * w + 8}" y="${y * h - 10}" font-family="Arial" font-size="22" fill="#fff">${i + 1}. ${d.label}</text>`;
  });
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${rects.join('')}</svg>`);
  await sharp(srcImg).resize(w, h).composite([{ input: svg }]).jpeg({ quality: 82 }).toFile(outFile);
}

async function buildPainting(folder, order) {
  const dir = path.join(SRC, folder);
  const id = folder.replace(/^\d+[-_]?/, '') || folder;
  const image = ['quadro.jpg', 'quadro.jpeg', 'quadro.png'].map((f) => path.join(dir, f)).find((f) => fs.existsSync(f));
  const { info, problems } = readInfo(dir);
  if (!image) {
    emit('error', { id, message: 'manca quadro.jpg' });
    return { id, problems: [...problems, 'manca quadro.jpg'], ok: false };
  }
  const regions = readRegions(dir);
  const sources = [image, ...['info.txt', 'regioni.json'].map((f) => path.join(dir, f)).filter((f) => fs.existsSync(f))];
  const hash = hashFiles(sources);
  const outDir = path.join(OUT, id);
  const cacheFile = path.join(CACHE, `${id}.json`);
  const cached = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : null;
  if (cached?.hash === hash && fs.existsSync(path.join(outDir, 'meta.json'))) {
    emit('skip', { id, reason: 'invariato' });
    return { ...cached.result, problems };
  }

  emit('start', { id });
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const { width: W, height: H } = await sharp(image).metadata();

  emit('step', { id, step: 'immagini' });
  await sharp(image).resize({ width: TARGET_SIZE, height: TARGET_SIZE, fit: 'inside' }).jpeg({ quality: 88 }).toFile(path.join(outDir, 'target.jpg'));
  // Versione alta risoluzione per zoom e lente (mai la fotocamera).
  await sharp(image).resize({ width: 2400, height: 2400, fit: 'inside' }).jpeg({ quality: 82 }).toFile(path.join(outDir, 'immagine.jpg'));
  const targetFiles = [path.join(outDir, 'target.jpg')];
  for (const d of regions.dettagli) {
    const c = d.crop;
    const f = path.join(outDir, `dettaglio-${d.id}.jpg`);
    await sharp(image)
      .extract({ left: Math.round(c.x * W), top: Math.round(c.y * H), width: Math.round(c.w * W), height: Math.round(c.h * H) })
      .resize({ width: DETAIL_TARGET_SIZE, height: DETAIL_TARGET_SIZE, fit: 'inside' })
      .jpeg({ quality: 88 })
      .toFile(f);
    targetFiles.push(f);
  }

  emit('step', { id, step: 'tracking', targets: targetFiles.length });
  let last = -1;
  const mind = await compileMind(targetFiles, (p) => {
    const r = Math.floor(p / 10) * 10;
    if (r !== last) emit('progress', { id, step: 'tracking', percent: (last = r) });
  });
  fs.writeFileSync(path.join(outDir, 'targets.mind'), mind);
  const stats = await inspectMind(mind);

  const dettagli = regions.dettagli.map((d, i) => {
    const s = stats[i + 1];
    const weak = s.matchingPoints < WEAK_POINTS;
    return {
      id: d.id,
      label: d.label,
      crop: d.crop,
      targetIndex: i + 1,
      image: `dettaglio-${d.id}.jpg`,
      points: s.matchingPoints,
      // Target debole: il mirino sul quadro intero resta comunque attivo.
      trigger: weak ? ['reticle'] : ['target', 'reticle'],
    };
  });
  for (const d of dettagli) if (d.points < WEAK_POINTS) problems.push(`particolare "${d.label}": pochi punti (${d.points}), userà il mirino`);
  if (stats[0].matchingPoints < WEAK_POINTS * 2) problems.push(`quadro intero: pochi punti di tracking (${stats[0].matchingPoints})`);

  const meta = {
    id,
    order,
    title: info.title ?? id,
    artist: info.artist ?? '',
    year: info.year ?? '',
    room: info.room ?? '',
    experience: info.experience ?? 'racconto',
    aspect: W / H,
    image: 'immagine.jpg',
    targets: { mind: 'targets.mind', main: { targetIndex: 0, image: 'target.jpg', points: stats[0].matchingPoints } },
    dettagli,
  };
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));

  emit('step', { id, step: 'anteprima' });
  fs.mkdirSync(REVIEW, { recursive: true });
  await reviewImage(image, regions.dettagli, path.join(REVIEW, `${id}.jpg`));

  const result = { id, ok: true, title: meta.title, experience: meta.experience };
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify({ hash, result }));
  emit('done', { id, points: stats.map((s) => s.matchingPoints) });
  return { ...result, problems };
}

async function main() {
  const only = process.argv.slice(2);
  const folders = fs.readdirSync(SRC, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('_'))
    .map((d) => d.name)
    .sort();
  emit('begin', { paintings: folders.length });
  const results = [];
  for (const [i, folder] of folders.entries()) {
    if (only.length && !only.some((o) => folder.includes(o))) continue;
    try {
      results.push(await buildPainting(folder, i + 1));
    } catch (e) {
      emit('error', { folder, message: String(e?.message ?? e) });
      results.push({ id: folder, ok: false, problems: [String(e?.message ?? e)] });
    }
  }
  // index.json elenca ciò che è presente in public/data, anche se non ricostruito ora.
  const index = fs.readdirSync(OUT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(OUT, d.name, 'meta.json')))
    .map((d) => JSON.parse(fs.readFileSync(path.join(OUT, d.name, 'meta.json'), 'utf8')))
    .sort((a, b) => a.order - b.order)
    .map(({ id, title, artist, year, room, experience }) => ({ id, title, artist, year, room, experience }));
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ paintings: index }, null, 2));
  emit('end', { problems: results.flatMap((r) => (r.problems ?? []).map((p) => `${r.id}: ${p}`)) });
  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

main();
