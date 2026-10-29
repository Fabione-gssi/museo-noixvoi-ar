// Genera i video sintetici di "percorsi di camera" usati come fotocamera finta
// di Chromium nei test E2E (--use-file-for-fake-video-capture, formato MJPEG).
// Il quadro è appeso su una parete grigia; ogni fotogramma è un'inquadratura
// diversa. Riflesso, poca luce, sfocatura e inclinazione si aggiungono con ffmpeg.
//
// Uso: node scripts/make-test-videos.mjs [id-quadro ...]   (default: tutti i quadri in public/data)
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { ffmpegPath } from './lib/ffmpeg.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
if (!process.argv[2]) {
  // Nessun quadro indicato: uno alla volta, tutti quelli già generati.
  const { spawnSync } = await import('node:child_process');
  for (const d of fs.readdirSync(path.join(ROOT, 'public/data'), { withFileTypes: true }).filter((x) => x.isDirectory()))
    spawnSync(process.execPath, [import.meta.filename, d.name], { stdio: 'inherit' });
  process.exit(0);
}
const id = process.argv[2];
const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data', id, 'meta.json'), 'utf8'));
const OUT = path.join(ROOT, 'tests/video', id);
const FW = 960, FH = 540, FPS = 20;
const WALL_W = 6000, WALL_H = 3800, PAINT_H = 2400;

const PAINT_W = Math.round(PAINT_H * meta.aspect);
const PX = Math.round((WALL_W - PAINT_W) / 2), PY = Math.round((WALL_H - PAINT_H) / 2);
const toWall = (nx, ny) => ({ x: PX + nx * PAINT_W, y: PY + ny * PAINT_H });

async function makeWall() {
  const painting = await sharp(path.join(ROOT, 'public/data', id, meta.image)).resize(PAINT_W, PAINT_H).toBuffer();
  const wall = await sharp({ create: { width: WALL_W, height: WALL_H, channels: 3, background: '#8a857c' } })
    .composite([{ input: painting, left: PX, top: PY }])
    .raw()
    .toBuffer({ resolveWithObject: true });
  return wall;
}

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

/** Una "ripresa" = sequenza di chiavi {x,y,h} (centro e altezza inquadrata, in px parete). */
function path_(keys, seconds) {
  const n = Math.round(seconds * FPS);
  const frames = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * (keys.length - 1);
    const k = Math.min(keys.length - 2, Math.floor(t));
    const f = ease(t - k);
    const a = keys[k], b = keys[k + 1];
    // Micro-tremolio della mano.
    const jx = Math.sin(i * 0.7) * 4, jy = Math.cos(i * 0.9) * 3;
    frames.push({ x: lerp(a.x, b.x, f) + jx, y: lerp(a.y, b.y, f) + jy, h: lerp(a.h, b.h, f) });
  }
  return frames;
}

function shots() {
  const full = { ...toWall(0.5, 0.5), h: PAINT_H * 1.15 };
  const out = { fermo: path_([full, full], 8) };
  // Avvicinamenti: al massimo tre particolari (i primi due e quello con meno punti), per contenere i tempi.
  const withTarget = meta.dettagli.filter((x) => x.targetIndex);
  const weakest = [...withTarget].sort((a, b) => a.points - b.points)[0];
  const chosen = [...new Set([...withTarget.slice(0, 2), weakest].filter(Boolean))];
  for (const d of chosen) {
    const c = toWall(d.crop.x + d.crop.w / 2, d.crop.y + d.crop.h / 2);
    const close = { ...c, h: d.crop.h * PAINT_H * 1.7 };
    const mid = { ...c, h: d.crop.h * PAINT_H * 4 };
    // Da lontano al particolare, sosta a media distanza (mirino), poi vicinissimo (ritaglio).
    out[`avvicinamento-${d.id}`] = path_([full, full, mid, mid, mid, close, close, close], 14);
  }
  // Caccia: a distanza normale (quadro quasi intero) la lente al centro passa su
  // ogni elemento nascosto. Un video per i primi due elementi e un giro completo.
  // L'app mette la lente a circa il 45% dell'altezza dello schermo: si centra lì.
  const items = meta.caccia?.items ?? [];
  const near = PAINT_H * 0.75;
  const onItem = (it) => {
    const p = toWall(it.x, it.y);
    return { x: p.x, y: p.y + near * 0.05, h: near };
  };
  for (const it of items.slice(0, 2)) out[`caccia-${it.id}`] = path_([full, onItem(it), onItem(it), onItem(it), onItem(it)], 9);
  if (items.length) out['caccia-giro'] = path_([full, ...items.flatMap((it) => [onItem(it), onItem(it), onItem(it)]), full], items.length * 4.5 + 2);
  const tl = { ...toWall(0.3, 0.25), h: PAINT_H * 0.5 }, br = { ...toWall(0.7, 0.8), h: PAINT_H * 0.5 };
  out.scansione = path_([full, tl, { ...toWall(0.7, 0.25), h: PAINT_H * 0.5 }, br, { ...toWall(0.3, 0.8), h: PAINT_H * 0.5 }, full], 14);
  out['nessun-quadro'] = path_([{ x: 900, y: 900, h: 900 }, { x: 1000, y: 950, h: 900 }], 6);
  return out;
}

// Varianti sul percorso "fermo" ottenute con filtri ffmpeg.
const VARIANTS = {
  inclinazione: 'perspective=x0=90:y0=40:x1=W-20:y1=0:x2=60:y2=H-30:x3=W:y3=H:interpolation=linear',
  riflesso: "geq=lum='min(255,lum(X,Y)+170*exp(-((X-W*0.62)^2+(Y-H*0.35)^2)/(2*(W*0.12)^2)))':cb='cb(X,Y)':cr='cr(X,Y)'",
  'poca-luce': 'eq=brightness=-0.25:contrast=0.7,noise=alls=18:allf=t',
  sfocatura: 'gblur=sigma=3.5',
};

async function writeVideo(name, frames, wall, vf) {
  const file = path.join(OUT, `${name}.mjpeg`);
  // Già generato da un'immagine invariata: si salta (la generazione è lenta).
  const source = path.join(ROOT, 'public/data', id, meta.image);
  if (fs.existsSync(file) && fs.statSync(file).mtimeMs > fs.statSync(source).mtimeMs) return;
  const args = ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-'];
  if (vf) args.push('-vf', vf);
  args.push('-q:v', '4', '-f', 'mjpeg', file);
  const ff = spawn(ffmpegPath(), args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg ${c}`)))));
  for (const f of frames) {
    const h = Math.round(f.h), w = Math.round(h * (FW / FH));
    let left = Math.round(f.x - w / 2), top = Math.round(f.y - h / 2);
    left = Math.max(0, Math.min(WALL_W - w, left));
    top = Math.max(0, Math.min(WALL_H - h, top));
    const jpg = await sharp(wall.data, { raw: wall.info })
      .extract({ left, top, width: Math.min(w, WALL_W), height: Math.min(h, WALL_H) })
      .resize(FW, FH, { fit: 'fill' })
      .jpeg({ quality: 85 })
      .toBuffer();
    if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await done;
  process.stdout.write(JSON.stringify({ event: 'video', name, frames: frames.length }) + '\n');
}

fs.mkdirSync(OUT, { recursive: true });
const wall = await makeWall();
const s = shots();
for (const [name, frames] of Object.entries(s)) await writeVideo(name, frames, wall);
for (const [name, vf] of Object.entries(VARIANTS)) await writeVideo(name, s.fermo, wall, vf);
