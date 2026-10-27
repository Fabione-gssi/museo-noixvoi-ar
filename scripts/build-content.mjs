// Pipeline dei contenuti: legge contenuti/<cartella>/ e produce public/data/.
//
// - Incrementale: ogni passo pesante ha una cache per hash dei suoi ingressi
//   (.cache/build/<id>/), e un quadro invariato viene saltato del tutto.
// - Avanzamento leggibile da macchina: una riga JSON per evento su stdout
//   (lo Studio la legge per le barre di avanzamento).
// - Fallisce se un meta.json non rispetta lo schema o se si supera il budget di peso.
//
// Uso: node scripts/build-content.mjs [parte-del-nome-cartella ...] [--force]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import Ajv from 'ajv';
import { compileMind, inspectMind } from './lib/mind-compiler.mjs';
import { ffmpegPath } from './lib/ffmpeg.mjs';
import { buildTimeline, toVtt } from './lib/timeline.mjs';
import { readInfo, readRegions, findFile, AUDIO_EXT, folderId } from './lib/contenuti.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'contenuti');
const OUT = path.join(ROOT, 'public/data');
const REVIEW = path.join(ROOT, 'revisione');
const CACHE = path.join(ROOT, '.cache/build');
const PY = path.join(ROOT, '.venv/Scripts/python.exe');
const MODELS = path.join(ROOT, '.models');

const TARGET_SIZE = 1024; // sopra ~1000 px il tracking non migliora e il .mind cresce
const DETAIL_TARGET_SIZE = 768;
const WEAK_POINTS = 250; // sotto questa soglia il ritaglio usa solo il mirino
const BUDGET_PAINTING = 6 * 1024 * 1024;
const BUDGET_TOTAL = 120 * 1024 * 1024;
const MAX_FILE = 25 * 1024 * 1024; // limite per file di Cloudflare Pages, il più stretto
const PIPELINE_VERSION = 2;

const emit = (event, data = {}) => process.stdout.write(JSON.stringify({ event, ...data }) + '\n');
const ajv = new Ajv({ allErrors: true });
const validateMeta = ajv.compile(JSON.parse(fs.readFileSync(path.join(ROOT, 'schema/meta.schema.json'), 'utf8')));

function hash(...parts) {
  const h = crypto.createHash('sha256').update(String(PIPELINE_VERSION));
  for (const p of parts) {
    if (p && typeof p === 'string' && fs.existsSync(p) && fs.statSync(p).isFile()) h.update(fs.readFileSync(p));
    else h.update(JSON.stringify(p ?? null));
  }
  return h.digest('hex').slice(0, 16);
}

/** Esegue fn solo se i file di uscita in cache per questa chiave mancano. */
async function cached(id, step, key, names, fn) {
  const dir = path.join(CACHE, id);
  fs.mkdirSync(dir, { recursive: true });
  const files = names.map((n) => path.join(dir, `${step}-${key}-${n}`));
  if (files.every((f) => fs.existsSync(f))) {
    emit('cache', { id, step });
    return files;
  }
  emit('step', { id, step });
  await fn(...files);
  return files;
}

function run(cmd, args, { id, step } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, PYTHONUTF8: '1' } });
    let err = '';
    p.stdout.on('data', (d) => {
      for (const line of String(d).split('\n').filter(Boolean)) {
        try {
          const ev = JSON.parse(line);
          if (ev.event === 'progress') emit('progress', { id, step, percent: ev.percent });
        } catch { /* uscita non JSON (es. ffmpeg): ignorata */ }
      }
    });
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} ha fallito (${code}): ${err.slice(-600)}`))));
  });
}

const python = (script, args, ctx) => {
  if (!fs.existsSync(PY)) throw new Error('Manca l\'ambiente Python (.venv): eseguire npm run setup');
  return run(PY, [path.join(ROOT, 'scripts/py', script), ...args], ctx);
};
const ffmpeg = (args, ctx) => run(ffmpegPath(), ['-v', 'error', '-y', ...args], ctx);

async function reviewImage(srcImg, regions, timeline, outFile) {
  const meta = await sharp(srcImg).metadata();
  const w = 1400;
  const h = Math.round((meta.height / meta.width) * w);
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const items = regions.dettagli.map((d, i) => {
    const { x, y, w: cw, h: ch } = d.crop;
    const t = timeline?.find((k) => k.args.id === d.id);
    const label = `${i + 1}. ${d.label}${t ? ` (${t.t.toFixed(1)} s)` : ''}`;
    return `<rect x="${x * w}" y="${y * h}" width="${cw * w}" height="${ch * h}" fill="none" stroke="#ff2d55" stroke-width="4"/>
      <rect x="${x * w}" y="${Math.max(0, y * h - 30)}" width="${label.length * 11 + 16}" height="30" fill="#ff2d55"/>
      <text x="${x * w + 8}" y="${Math.max(0, y * h - 30) + 21}" font-family="Arial" font-size="19" fill="#fff">${esc(label)}</text>`;
  });
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${items.join('')}</svg>`);
  await sharp(srcImg).resize(w, h).composite([{ input: svg }]).jpeg({ quality: 82 }).toFile(outFile);
}

async function buildPainting(folder, order, force) {
  const dir = path.join(SRC, folder);
  const id = folderId(folder);
  const problems = [];
  const image = findFile(dir, 'quadro', ['.jpg', '.jpeg', '.png']);
  const { info, problems: infoProblems } = readInfo(dir);
  problems.push(...infoProblems);
  if (!image) return { id, ok: false, problems: [...problems, 'manca l\'immagine del quadro (quadro.jpg)'] };
  const regions = readRegions(dir);
  const textFile = path.join(dir, 'testo.txt');
  const hasText = fs.existsSync(textFile);
  const audioSrc = findFile(dir, 'audio', AUDIO_EXT);
  const pronFile = path.join(dir, 'pronuncia.txt');
  const videoSrc = findFile(dir, 'racconto', ['.mp4', '.mov', '.webm', '.m4v']);
  const demoVoice = !audioSrc && info.voce === 'demo' && hasText;
  const experience = info.experience ?? 'racconto';

  const outDir = path.join(OUT, id);
  const allInputs = [image, path.join(dir, 'info.txt'), path.join(dir, 'regioni.json'), textFile, pronFile, audioSrc, videoSrc, order];
  const fullKey = hash(...allInputs);
  const stamp = path.join(CACHE, id, 'ultimo.json');
  if (!force && fs.existsSync(stamp) && JSON.parse(fs.readFileSync(stamp, 'utf8')).key === fullKey && fs.existsSync(path.join(outDir, 'meta.json'))) {
    emit('skip', { id, reason: 'invariato' });
    return { id, ok: true, problems: JSON.parse(fs.readFileSync(stamp, 'utf8')).problems };
  }

  emit('start', { id });
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const { width: W, height: H } = await sharp(image).metadata();
  if (Math.max(W, H) < 2000) problems.push(`immagine piccola (${W}×${H} px): consigliati almeno 3000 px sul lato lungo`);

  // Immagini: target del tracking, versione alta risoluzione per racconto/lente, ritagli.
  emit('step', { id, step: 'immagini' });
  await sharp(image).resize({ width: TARGET_SIZE, height: TARGET_SIZE, fit: 'inside' }).jpeg({ quality: 88 }).toFile(path.join(outDir, 'target.jpg'));
  await sharp(image).resize({ width: 2400, height: 2400, fit: 'inside' }).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(outDir, 'immagine.jpg'));
  const crops = regions.dettagli.filter((d) => experience === 'dettagli' || d.target === true);
  const targetFiles = [path.join(outDir, 'target.jpg')];
  for (const d of crops) {
    const c = d.crop;
    const f = path.join(outDir, `dettaglio-${d.id}.jpg`);
    await sharp(image)
      .extract({ left: Math.round(c.x * W), top: Math.round(c.y * H), width: Math.max(1, Math.round(c.w * W)), height: Math.max(1, Math.round(c.h * H)) })
      .resize({ width: DETAIL_TARGET_SIZE, height: DETAIL_TARGET_SIZE, fit: 'inside' })
      .jpeg({ quality: 88 })
      .toFile(f);
    targetFiles.push(f);
  }

  // Tracking (.mind): la compilazione è lenta, quindi in cache.
  const [mindFile] = await cached(id, 'tracking', hash(...targetFiles), ['targets.mind'], async (out) => {
    let last = -1;
    const buf = await compileMind(targetFiles, (p) => {
      const r = Math.floor(p / 10) * 10;
      if (r !== last) emit('progress', { id, step: 'tracking', percent: (last = r) });
    });
    fs.writeFileSync(out, buf);
  });
  fs.copyFileSync(mindFile, path.join(outDir, 'targets.mind'));
  const stats = await inspectMind(fs.readFileSync(mindFile));
  if (stats[0].matchingPoints < WEAK_POINTS * 2) problems.push(`quadro intero: pochi punti di riconoscimento (${stats[0].matchingPoints}); il riconoscimento potrebbe essere lento`);

  // Audio: registrazione vera, oppure voce DEMO generata dal testo.
  let audioFile = audioSrc;
  let alignment = null;
  if (demoVoice) {
    const [wav, align] = await cached(id, 'voce', hash(textFile, pronFile, 'serena-medium'), ['voce.wav', 'allineamento.json'], (wavOut, alignOut) =>
      python('tts.py', [textFile, wavOut, alignOut, path.join(MODELS, 'piper/it_IT-serena-medium.onnx'), ...(fs.existsSync(pronFile) ? [pronFile] : [])], { id, step: 'voce' }));
    audioFile = wav;
    alignment = JSON.parse(fs.readFileSync(align, 'utf8'));
  } else if (audioSrc && hasText) {
    const [align] = await cached(id, 'allineamento', hash(audioSrc, textFile), ['allineamento.json'], (out) =>
      python('align.py', [audioSrc, textFile, out, path.join(MODELS, 'whisper'), ffmpegPath()], { id, step: 'allineamento' }));
    alignment = JSON.parse(fs.readFileSync(align, 'utf8'));
    if (alignment.coverage < 0.6) problems.push(`l'audio corrisponde poco al testo (${Math.round(alignment.coverage * 100)}% delle parole riconosciute): sottotitoli e tempi potrebbero essere imprecisi`);
  } else if (!audioSrc) {
    problems.push('manca l\'audio (audio.mp3)');
  }
  if (!hasText) problems.push('manca il testo (testo.txt)');

  let audioMeta;
  if (audioFile) {
    const [opus, m4a] = await cached(id, 'audio', hash(audioFile), ['audio.opus', 'audio.m4a'], async (o, m) => {
      // Mono, voce: Opus 48 kbps per i browser che lo supportano, AAC 64 kbps per iOS.
      await ffmpeg(['-i', audioFile, '-ac', '1', '-c:a', 'libopus', '-b:a', '48k', '-f', 'ogg', o], { id, step: 'audio' });
      await ffmpeg(['-i', audioFile, '-ac', '1', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', '-f', 'mp4', m], { id, step: 'audio' });
    });
    fs.copyFileSync(opus, path.join(outDir, 'audio.opus'));
    fs.copyFileSync(m4a, path.join(outDir, 'audio.m4a'));
    const durationSec = alignment?.durationSec ?? (await probeDuration(m4a));
    audioMeta = { src: 'audio.opus', fallback: 'audio.m4a', durationSec: Math.round(durationSec * 10) / 10 };
  }
  if (alignment) {
    fs.writeFileSync(path.join(outDir, 'alignment.json'), JSON.stringify(alignment));
    fs.writeFileSync(path.join(outDir, 'subtitles.vtt'), toVtt(alignment));
  }

  // Profondità per la parallasse del racconto.
  let depth;
  if (experience === 'racconto') {
    try {
      const [d] = await cached(id, 'profondita', hash(image), ['depth.jpg'], (out) =>
        python('depth.py', [image, out, path.join(MODELS, 'depth/depth-anything-v2-small.onnx')], { id, step: 'profondita' }));
      fs.copyFileSync(d, path.join(outDir, 'depth.jpg'));
      depth = 'depth.jpg';
    } catch (e) {
      problems.push(`mappa di profondità non generata (il racconto funziona senza parallasse): ${e.message.slice(0, 120)}`);
    }
  }

  // Racconto: video fornito, oppure animazione automatica sincronizzata all'audio.
  let racconto;
  if (experience === 'racconto') {
    let video;
    if (videoSrc) {
      const [mp4, webm] = await cached(id, 'video', hash(videoSrc), ['racconto.mp4', 'racconto.webm'], async (m, w) => {
        const scale = 'scale=\'min(1280,iw)\':-2';
        await ffmpeg(['-i', videoSrc, '-vf', scale, '-c:v', 'libx264', '-profile:v', 'main', '-crf', '28', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', m], { id, step: 'video' });
        await ffmpeg(['-i', videoSrc, '-vf', scale, '-c:v', 'libvpx-vp9', '-crf', '36', '-b:v', '0', '-row-mt', '1', '-c:a', 'libopus', '-b:a', '64k', w], { id, step: 'video' });
      });
      fs.copyFileSync(mp4, path.join(outDir, 'racconto.mp4'));
      fs.copyFileSync(webm, path.join(outDir, 'racconto.webm'));
      video = { src: 'racconto.mp4', fallback: 'racconto.webm' };
    }
    const { timeline, missing } = alignment
      ? buildTimeline(alignment, regions.dettagli, regions.racconto?.inquadraturaIntera ?? [], regions.racconto?.timeline)
      : { timeline: regions.racconto?.timeline ?? [{ t: 0, action: 'cameraTo', args: { rect: { x: 0, y: 0, w: 1, h: 1 } } }], missing: [] };
    for (const m of missing) problems.push(`racconto: la frase "${m}" non è stata trovata nell'audio, il movimento di camera è stato saltato`);
    racconto = { auto: !video, ...(video ? { video } : {}), timeline };
  }

  const dettagli = regions.dettagli.map((d) => {
    const ci = crops.indexOf(d);
    const s = ci >= 0 ? stats[ci + 1] : null;
    const out = { id: d.id, label: d.label, crop: d.crop, trigger: s && s.matchingPoints >= WEAK_POINTS ? ['target', 'reticle'] : ['reticle'] };
    if (s) Object.assign(out, { targetIndex: ci + 1, image: `dettaglio-${d.id}.jpg`, points: s.matchingPoints });
    if (s && s.matchingPoints < WEAK_POINTS) problems.push(`particolare "${d.label}": pochi punti (${s.matchingPoints}), userà il mirino`);
    if (d.source) out.source = d.source;
    return out;
  });

  const meta = {
    schemaVersion: 1,
    id,
    order,
    title: info.title ?? id,
    artist: info.artist ?? '',
    year: info.year ?? '',
    room: /^\[DA COMPLETARE/i.test(info.room ?? '') ? '' : info.room ?? '',
    experience,
    demo: demoVoice,
    aspect: W / H,
    image: 'immagine.jpg',
    ...(depth ? { depth } : {}),
    ...(audioMeta ? { audio: audioMeta } : {}),
    ...(alignment ? { subtitles: 'subtitles.vtt', alignment: 'alignment.json' } : {}),
    targets: { mind: 'targets.mind', main: { targetIndex: 0, image: 'target.jpg', points: stats[0].matchingPoints } },
    dettagli,
    ...(racconto ? { racconto } : {}),
  };

  // Budget di peso: le alternative (fallback) non si scaricano entrambe, quindi conta la più grande.
  const size = (f) => (fs.existsSync(path.join(outDir, f)) ? fs.statSync(path.join(outDir, f)).size : 0);
  const all = fs.readdirSync(outDir);
  const alt = [['audio.opus', 'audio.m4a'], ['racconto.mp4', 'racconto.webm']];
  let bytes = all.filter((f) => !alt.flat().includes(f)).reduce((n, f) => n + size(f), 0);
  for (const pair of alt) bytes += Math.max(...pair.map(size));
  if (bytes > BUDGET_PAINTING) {
    // Compressione automatica: immagine più leggera.
    await sharp(image).resize({ width: 1800, height: 1800, fit: 'inside' }).jpeg({ quality: 70, mozjpeg: true }).toFile(path.join(outDir, 'immagine.jpg'));
    bytes = all.filter((f) => !alt.flat().includes(f)).reduce((n, f) => n + size(f), 0) + alt.reduce((n, p) => n + Math.max(...p.map(size)), 0);
    problems.push('peso oltre il budget: immagine compressa automaticamente');
  }
  for (const f of all) if (size(f) > MAX_FILE) throw new Error(`il file ${f} supera i 25 MB`);
  meta.budget = { bytes, limit: BUDGET_PAINTING };
  if (bytes > BUDGET_PAINTING) throw new Error(`peso del quadro ${(bytes / 1048576).toFixed(1)} MB oltre il budget di 6 MB (video troppo lungo?)`);

  if (!validateMeta(meta)) throw new Error(`meta.json non valido: ${ajv.errorsText(validateMeta.errors, { dataVar: 'meta' })}`);
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));

  emit('step', { id, step: 'anteprima' });
  fs.mkdirSync(REVIEW, { recursive: true });
  await reviewImage(image, regions, racconto?.timeline, path.join(REVIEW, `${id}.jpg`));

  fs.writeFileSync(stamp, JSON.stringify({ key: fullKey, problems }));
  emit('done', { id, bytes });
  return { id, ok: true, problems };
}

function probeDuration(file) {
  return new Promise((resolve) => {
    const p = spawn(ffmpegPath(), ['-i', file]);
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', () => {
      const m = err.match(/Duration: (\d+):(\d+):([\d.]+)/);
      resolve(m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0);
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const only = args.filter((a) => !a.startsWith('--'));
  const folders = fs.readdirSync(SRC, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('_'))
    .map((d) => d.name)
    .sort();
  emit('begin', { paintings: folders.length });
  const results = [];
  for (const [i, folder] of folders.entries()) {
    if (only.length && !only.some((o) => folder.includes(o))) continue;
    try {
      results.push(await buildPainting(folder, i + 1, force));
    } catch (e) {
      emit('error', { id: folderId(folder), message: String(e?.message ?? e) });
      results.push({ id: folderId(folder), ok: false, problems: [String(e?.message ?? e)] });
    }
  }
  // Rimuove da public/data i quadri non più presenti in contenuti/.
  const ids = new Set(folders.map(folderId));
  for (const d of fs.readdirSync(OUT, { withFileTypes: true })) if (d.isDirectory() && !ids.has(d.name)) fs.rmSync(path.join(OUT, d.name), { recursive: true });

  const metas = fs.readdirSync(OUT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(OUT, d.name, 'meta.json')))
    .map((d) => JSON.parse(fs.readFileSync(path.join(OUT, d.name, 'meta.json'), 'utf8')))
    .sort((a, b) => a.order - b.order);
  const total = metas.reduce((n, m) => n + (m.budget?.bytes ?? 0), 0);
  const index = {
    paintings: metas.map(({ id, title, artist, year, room, experience, demo, budget }) => ({ id, title, artist, year, room, experience, demo, bytes: budget?.bytes ?? 0 })),
    totalBytes: total,
  };
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 2));
  if (total > BUDGET_TOTAL) results.push({ id: 'totale', ok: false, problems: [`peso totale ${(total / 1048576).toFixed(0)} MB oltre il budget di 120 MB`] });
  const problems = results.flatMap((r) => (r.problems ?? []).map((p) => ({ id: r.id, message: p })));
  fs.mkdirSync(path.join(ROOT, '.cache'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, '.cache/problemi.json'), JSON.stringify(problems, null, 2));
  emit('end', { ok: results.every((r) => r.ok), totalBytes: total, problems });
  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

main();
