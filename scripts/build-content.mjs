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
import { buildTimeline, toVtt, segmentFor } from './lib/timeline.mjs';
import { readInfo, readRegions, findFile, AUDIO_EXT, folderId } from './lib/contenuti.mjs';
import { detectFace, LANDMARKS } from './lib/face-landmarks.mjs';

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

async function reviewImage(srcImg, regions, timeline, outFile, points = [], face = null) {
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
  // Elementi della caccia: cerchio del raggio di scoperta e nome.
  for (const [i, p] of points.entries()) {
    const label = `${i + 1}. ${p.label} (${p.fx ?? 'glow'})`;
    items.push(`<circle cx="${p.x * w}" cy="${p.y * h}" r="${(p.r ?? 0.05) * w}" fill="none" stroke="#00e5ff" stroke-width="4"/>
      <circle cx="${p.x * w}" cy="${p.y * h}" r="5" fill="#00e5ff"/>
      <rect x="${p.x * w + 8}" y="${p.y * h - 34}" width="${label.length * 11 + 16}" height="30" fill="#00838f"/>
      <text x="${p.x * w + 16}" y="${p.y * h - 13}" font-family="Arial" font-size="19" fill="#fff">${esc(label)}</text>`);
  }
  // Punti del volto del personaggio (occhi, iridi, bocca, mento).
  for (const [x, y] of Object.values(face ?? {})) items.push(`<circle cx="${x * w}" cy="${y * h}" r="4" fill="#ffd166" stroke="#000" stroke-width="1"/>`);
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
  const detailDir = path.join(dir, 'dettagli');
  const detailFiles = fs.existsSync(detailDir) ? fs.readdirSync(detailDir).sort().map((f) => path.join(detailDir, f)) : [];
  const answerDir = path.join(dir, 'risposte');
  const answerFiles = fs.existsSync(answerDir) ? fs.readdirSync(answerDir).sort().map((f) => path.join(answerDir, f)) : [];
  const allInputs = [image, path.join(dir, 'info.txt'), path.join(dir, 'regioni.json'), path.join(dir, 'dettagli.txt'), textFile, pronFile, audioSrc, videoSrc, order, ...detailFiles, ...answerFiles];
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

  // Miniature per la schermata "Trova i particolari".
  if (experience === 'dettagli') {
    for (const d of regions.dettagli) {
      const c = d.crop;
      await sharp(image)
        .extract({ left: Math.round(c.x * W), top: Math.round(c.y * H), width: Math.max(1, Math.round(c.w * W)), height: Math.max(1, Math.round(c.h * H)) })
        .resize(240, 240, { fit: 'cover' })
        .jpeg({ quality: 78 })
        .toFile(path.join(outDir, `mini-${d.id}.jpg`));
    }
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
  if (experience === 'racconto' || experience === 'personaggio') {
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

  const dettagli = [];
  for (const d of regions.dettagli) {
    const ci = crops.indexOf(d);
    const s = ci >= 0 ? stats[ci + 1] : null;
    const out = { id: d.id, label: d.label, crop: d.crop, trigger: s && s.matchingPoints >= WEAK_POINTS ? ['target', 'reticle'] : ['reticle'] };
    if (s) Object.assign(out, { targetIndex: ci + 1, image: `dettaglio-${d.id}.jpg`, points: s.matchingPoints });
    if (experience === 'dettagli') out.thumb = `mini-${d.id}.jpg`;
    if (s && s.matchingPoints < WEAK_POINTS) problems.push(`particolare "${d.label}": pochi punti (${s.matchingPoints}), si attiverà solo col mirino`);
    if (experience === 'dettagli') {
      Object.assign(out, await detailContent(d, { id, dir, outDir, image, W, H, alignment, audioMeta, problems }));
    }
    if (d.source) out.source = d.source;
    dettagli.push(out);
  }
  if (experience === 'dettagli') problems.push(...dettagliTxtProblems(dir, regions));

  // Caccia: elementi nascosti (punti) con la loro storia, e il finale.
  // Solo particolari reali del quadro; elementi di fantasia solo se descritti in caccia.txt.
  let caccia;
  if (experience === 'caccia') {
    const c = regions.caccia ?? { items: [] };
    const items = [];
    for (const it of c.items ?? []) {
      const content = await detailContent(it, { id, dir, outDir, alignment, audioMeta, problems });
      items.push({ id: it.id, label: it.label, x: it.x, y: it.y, r: it.r ?? 0.05, fx: it.fx ?? 'glow', ...content });
    }
    if (items.length < 3) problems.push(`caccia: solo ${items.length} elementi nascosti (ne servono almeno 3)`);
    const finale = c.finale ? await detailContent({ id: 'finale', label: 'Finale', ...c.finale }, { id, dir, outDir, alignment, audioMeta, problems }) : null;
    if (!finale) problems.push('caccia: manca il finale');
    caccia = { lensRadius: c.lensRadius ?? 0.18, items, ...(finale ? { finale } : {}) };
    if (fs.existsSync(path.join(dir, 'caccia.txt'))) problems.push('caccia.txt presente: gli elementi descritti vanno posizionati nello Studio (scheda Caccia)');
  }

  const personaggio = experience === 'personaggio' ? await characterContent({ id, dir, outDir, image, regions, pronFile, audioFile, demoVoice, problems }) : null;

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
    ...(caccia ? { caccia } : {}),
    ...(personaggio ? { personaggio } : {}),
  };

  // Budget di peso: le alternative (fallback) non si scaricano entrambe, quindi conta la più grande.
  const size = (f) => (fs.existsSync(path.join(outDir, f)) ? fs.statSync(path.join(outDir, f)).size : 0);
  const all = fs.readdirSync(outDir);
  const alt = [['racconto.mp4', 'racconto.webm'], ...all.filter((f) => f.endsWith('.opus')).map((f) => [f, f.replace(/\.opus$/, '.m4a')])];
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
  await reviewImage(image, regions, racconto?.timeline, path.join(REVIEW, `${id}.jpg`), experience === 'caccia' ? regions.caccia?.items : [], personaggio?.volto?.punti);

  fs.writeFileSync(stamp, JSON.stringify({ key: fullKey, problems }));
  emit('done', { id, bytes });
  return { id, ok: true, problems };
}

/**
 * Contenuto di un particolare (esperienza "dettagli"), in ordine di priorità:
 * 1. video o audio caricato (contenuti/<quadro>/dettagli/<file>);
 * 2. pezzo dell'audio principale scelto nello Studio (media.type = "segmento");
 * 3. pezzo dell'audio principale ricavato dalla frase "ancora" del testo;
 * 4. solo testo (scritto nello Studio, o la frase del testo).
 * Non si inventa nulla: senza testo né audio il particolare ha solo il nome e viene segnalato.
 */
async function detailContent(d, { id, dir, outDir, alignment, audioMeta, problems }) {
  const m = d.media ?? {};
  const auto = alignment && d.ancora ? segmentFor(alignment, d.ancora) : null;
  if (d.ancora && alignment && !auto) problems.push(`particolare "${d.label}": la frase "${d.ancora}" non è nel testo o nell'audio`);
  const text = d.text ?? auto?.text ?? '';
  const source = auto ? `testo.txt: "${auto.text.slice(0, 90)}${auto.text.length > 90 ? '…' : ''}"` : undefined;
  const file = m.file ? path.join(dir, m.file) : null;
  if (file && !fs.existsSync(file)) problems.push(`particolare "${d.label}": manca il file ${m.file}`);
  if (file && fs.existsSync(file) && m.type === 'video') {
    const [mp4] = await cached(id, `video-${d.id}`, hash(file), ['dettaglio.mp4'], (out) =>
      ffmpeg(['-i', file, '-vf', "scale='min(960,iw)':-2", '-c:v', 'libx264', '-profile:v', 'main', '-crf', '28', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', out], { id, step: 'video' }));
    fs.copyFileSync(mp4, path.join(outDir, `video-${d.id}.mp4`));
    return { media: { type: 'video', src: `video-${d.id}.mp4` }, text, ...(source ? { source } : {}) };
  }
  if (file && fs.existsSync(file) && m.type === 'audio') {
    const [opus, m4a] = await cached(id, `audio-${d.id}`, hash(file), ['a.opus', 'a.m4a'], async (o, a) => {
      await ffmpeg(['-i', file, '-ac', '1', '-c:a', 'libopus', '-b:a', '48k', '-f', 'ogg', o], { id, step: 'audio' });
      await ffmpeg(['-i', file, '-ac', '1', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', '-f', 'mp4', a], { id, step: 'audio' });
    });
    fs.copyFileSync(opus, path.join(outDir, `audio-${d.id}.opus`));
    fs.copyFileSync(m4a, path.join(outDir, `audio-${d.id}.m4a`));
    return { media: { type: 'audio', src: `audio-${d.id}.opus`, fallback: `audio-${d.id}.m4a` }, text, ...(source ? { source } : {}) };
  }
  if (m.type === 'segmento' && audioMeta && m.to > m.from) {
    return { media: { type: 'audio', audioSegment: { from: m.from, to: Math.min(m.to, audioMeta.durationSec) } }, text: d.text ?? segmentText(alignment, m.from, m.to), ...(source ? { source } : {}) };
  }
  if (m.type !== 'testo' && auto && audioMeta) {
    return { media: { type: 'audio', audioSegment: { from: auto.from, to: auto.to } }, text, source };
  }
  if (!text) problems.push(`particolare "${d.label}": nessun contenuto (né audio, né video, né testo)`);
  return { media: { type: 'text' }, text, ...(source ? { source } : {}) };
}

/** Testo delle frasi comprese (anche in parte) nell'intervallo from-to. */
function segmentText(alignment, from, to) {
  return (alignment?.sentences ?? []).filter((s) => s.end > from + 0.2 && s.start < to - 0.2).map((s) => s.text).join(' ');
}

/**
 * dettagli.txt (formato a mano: "descrizione | file"): le righe senza un
 * riquadro corrispondente in regioni.json vanno posizionate nello Studio.
 */
function dettagliTxtProblems(dir, regions) {
  const f = path.join(dir, 'dettagli.txt');
  if (!fs.existsSync(f)) return [];
  const labels = regions.dettagli.map((d) => d.label.toLowerCase());
  return fs.readFileSync(f, 'utf8').split(/\r?\n/).map((l) => l.split('|')[0].trim()).filter(Boolean)
    .filter((desc) => !labels.some((l) => desc.toLowerCase().includes(l.replace(/^(il|lo|la|l'|i|gli|le)\s*/i, ''))))
    .map((desc) => `dettagli.txt: "${desc}" va disegnato sull'immagine nello Studio (scheda Dettagli)`);
}

const NON_SO = 'Non so rispondere a questa domanda. Posso raccontarti solo quello che sappiamo di questo quadro: prova con una delle domande suggerite.';
const ENVELOPE_HZ = 25;

/**
 * Personaggio: punti del volto (MediaPipe, corretti a mano nello Studio),
 * domande e risposte con la loro fonte, audio di ogni risposta e "inviluppo"
 * (volume nel tempo) che muove la bocca.
 */
async function characterContent({ id, dir, outDir, image, regions, pronFile, audioFile, demoVoice, problems }) {
  const p = regions.personaggio ?? {};
  let auto = null;
  try {
    const [f] = await cached(id, 'volto', hash(image), ['volto.json'], async (out) =>
      fs.writeFileSync(out, JSON.stringify(await detectFace(image, path.join(MODELS, 'face/face_landmarker.task')))));
    auto = JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    problems.push(`punti del volto non calcolati: ${e.message.slice(0, 120)}`);
  }
  const punti = { ...(auto?.punti ?? {}), ...(p.punti ?? {}) };
  const complete = Object.keys(LANDMARKS).every((k) => punti[k]);
  if (!complete) problems.push('personaggio: volto non trovato automaticamente, segna i punti nello Studio (scheda Personaggio). Intanto si usa la "presenza" senza bocca');
  const modo = complete && p.modo !== 'presenza' ? 'completa' : 'presenza';

  const envelopes = {};
  if (audioFile) envelopes.audio = await envelope(audioFile);

  // Audio di una risposta: registrazione in risposte/<id>.*, altrimenti voce DEMO.
  const speak = async (key, text) => {
    const recorded = findFile(path.join(dir, 'risposte'), key, AUDIO_EXT);
    let src = recorded;
    if (!src && demoVoice) {
      [src] = await cached(id, 'risposta', hash(text, pronFile, 'serena-medium'), ['risposta.wav'], async (wav) => {
        const txt = `${wav}.txt`;
        fs.writeFileSync(txt, text);
        await python('tts.py', [txt, wav, `${wav}.json`, path.join(MODELS, 'piper/it_IT-serena-medium.onnx'), ...(fs.existsSync(pronFile) ? [pronFile] : [])], { id, step: 'risposte' });
      });
    }
    if (!src) return null;
    const name = `risposta-${key}`;
    const [opus, m4a] = await cached(id, 'audio', hash(src), ['r.opus', 'r.m4a'], async (o, m) => {
      await ffmpeg(['-i', src, '-ac', '1', '-c:a', 'libopus', '-b:a', '32k', '-f', 'ogg', o], { id, step: 'risposte' });
      await ffmpeg(['-i', src, '-ac', '1', '-c:a', 'aac', '-b:a', '48k', '-movflags', '+faststart', '-f', 'mp4', m], { id, step: 'risposte' });
    });
    fs.copyFileSync(opus, path.join(outDir, `${name}.opus`));
    fs.copyFileSync(m4a, path.join(outDir, `${name}.m4a`));
    envelopes[name] = await envelope(src);
    return { src: `${name}.opus`, fallback: `${name}.m4a`, durationSec: Math.round((envelopes[name].length / ENVELOPE_HZ) * 10) / 10 };
  };

  const domande = [];
  for (const q of p.domande ?? []) {
    if (!q.id || !q.domanda?.trim() || !q.risposta?.trim()) continue;
    const audio = await speak(q.id, q.risposta.trim());
    if (!audio) problems.push(`personaggio: manca l'audio della risposta "${q.domanda}" (risposte/${q.id}.mp3)`);
    if (!q.fonte?.trim()) problems.push(`personaggio: la risposta a "${q.domanda}" non indica la fonte nel testo`);
    domande.push({ id: q.id, domanda: q.domanda.trim(), varianti: (q.varianti ?? []).map((v) => v.trim()).filter(Boolean), risposta: q.risposta.trim(), ...(q.fonte ? { fonte: q.fonte.trim() } : {}), ...(audio ? { audio } : {}) });
  }
  if (domande.length < 8 || domande.length > 15) problems.push(`personaggio: ${domande.length} domande (ne servono da 8 a 15)`);
  const ids = new Set(domande.map((q) => q.id));
  const suggerite = (p.suggerite ?? []).filter((s) => ids.has(s)).slice(0, 4);
  for (const q of domande) if (suggerite.length < 4 && !suggerite.includes(q.id)) suggerite.push(q.id);
  const nonSoText = p.nonSo?.trim() || NON_SO;
  const nonSoAudio = await speak('nonso', nonSoText);

  fs.writeFileSync(path.join(outDir, 'inviluppi.json'), JSON.stringify({ hz: ENVELOPE_HZ, ...envelopes }));
  return {
    modo,
    ...(complete ? { volto: { punti: Object.fromEntries(Object.keys(LANDMARKS).map((k) => [k, punti[k]])), box: auto?.volto ?? faceBox(punti) } } : {}),
    inviluppi: 'inviluppi.json',
    domande,
    suggerite,
    nonSo: { text: nonSoText, ...(nonSoAudio ? { audio: nonSoAudio } : {}) },
  };
}

/** Riquadro del volto ricavato dai punti (quando sono stati messi a mano). */
function faceBox(punti) {
  const xs = Object.values(punti).map((q) => q[0]);
  const ys = Object.values(punti).map((q) => q[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const padX = (x1 - x0) * 0.35, padY = (y1 - y0) * 0.6;
  const x = Math.max(0, x0 - padX), y = Math.max(0, y0 - padY);
  return { x, y, w: Math.min(1 - x, x1 - x0 + 2 * padX), h: Math.min(1 - y, y1 - y0 + 1.6 * padY) };
}

/** Volume della voce nel tempo (0-100, ENVELOPE_HZ valori al secondo), normalizzato sul 95° percentile. */
function envelope(file) {
  return new Promise((resolve, reject) => {
    const rate = 8000;
    const p = spawn(ffmpegPath(), ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(rate), '-f', 's16le', '-']);
    const chunks = [];
    p.stdout.on('data', (d) => chunks.push(d));
    p.on('error', reject);
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(`inviluppo: ffmpeg ${code}`));
      const buf = Buffer.concat(chunks);
      const samples = new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 2));
      const win = rate / ENVELOPE_HZ;
      const rms = [];
      for (let i = 0; i < samples.length; i += win) {
        let s = 0;
        const end = Math.min(samples.length, i + win);
        for (let j = i; j < end; j++) s += samples[j] * samples[j];
        rms.push(Math.sqrt(s / Math.max(1, end - i)));
      }
      const ref = [...rms].sort((a, b) => a - b)[Math.floor(rms.length * 0.95)] || 1;
      resolve(rms.map((v) => Math.min(100, Math.round((v / ref) * 100))));
    });
  });
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
  // Elenco dei file e impronta del contenuto: l'app li usa per scaricare il quadro
  // per l'uso senza internet e per capire quando la copia sul telefono è vecchia.
  const offlineFiles = (id) => {
    const dir = path.join(OUT, id);
    const files = fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isFile()).sort().map((f) => [f, fs.statSync(path.join(dir, f)).size]);
    const hash = crypto.createHash('sha1');
    for (const [f] of files) hash.update(f).update(fs.readFileSync(path.join(dir, f)));
    return { version: hash.digest('hex').slice(0, 12), files };
  };
  const total = metas.reduce((n, m) => n + (m.budget?.bytes ?? 0), 0);
  const index = {
    paintings: metas.map(({ id, title, artist, year, room, experience, demo, budget }) => ({ id, title, artist, year, room, experience, demo, bytes: budget?.bytes ?? 0, ...offlineFiles(id) })),
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
