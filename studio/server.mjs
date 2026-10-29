// Studio: pannello di gestione locale. Gira solo su questo computer
// (127.0.0.1), legge e scrive contenuti/, esegue la pipeline e pubblica.
// Non fa parte del sito dei visitatori e non viene mai pubblicato.
//
// Sicurezza: ascolto solo su 127.0.0.1, token casuale richiesto da ogni API,
// controllo dell'header Host (contro il DNS rebinding) e dell'Origin.
//
// Uso: node studio/server.mjs [--open] [--port 5300]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { createServer as createVite } from 'vite';
import sharp from 'sharp';
import { readInfo, writeInfo, readRegions, writeRegions, findFile, folderId, AUDIO_EXT, EXPERIENCES } from '../scripts/lib/contenuti.mjs';
import { Backups } from './backups.mjs';
import { publish, buildZip, versions, restoreVersion } from './publish.mjs';
import { startPreviewTunnel, stopPreviewTunnel } from './tunnel.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'contenuti');
const DATA = path.join(ROOT, 'public/data');
const STATE = path.join(ROOT, '.studio');
const args = process.argv.slice(2);
const PORT = Number(args[args.indexOf('--port') + 1]) || Number(process.env.STUDIO_PORT) || 5300;
const TOKEN = process.env.STUDIO_TOKEN || crypto.randomBytes(18).toString('hex');
const IMAGE_EXT = ['.jpg', '.jpeg', '.png'];
const VIDEO_EXT = ['.mp4', '.mov', '.webm', '.m4v'];

fs.mkdirSync(STATE, { recursive: true });
const backups = new Backups(ROOT);

// ---- Eventi verso l'interfaccia (Server-Sent Events) -----------------------
const clients = new Set();
function broadcast(event, data) {
  const line = `data: ${JSON.stringify({ event, ...data })}\n\n`;
  for (const res of clients) res.write(line);
}

// ---- Lavori lunghi (pipeline, verifica, pubblicazione): uno alla volta -----
let job = null;
function runJob(name, fn) {
  if (job) throw httpError(409, `È già in corso: ${job}. Attendi che finisca.`);
  job = name;
  broadcast('job', { name, state: 'start' });
  Promise.resolve()
    .then(fn)
    .then((result) => broadcast('job', { name, state: 'done', result }))
    .catch((e) => broadcast('job', { name, state: 'error', message: String(e?.message ?? e) }))
    .finally(() => (job = null));
}

/** Esegue un comando inoltrando le righe JSON (eventi pipeline) all'interfaccia. */
function runStreaming(cmd, cmdArgs, tag) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, cmdArgs, { cwd: ROOT, shell: process.platform === 'win32' && !cmd.endsWith('.exe') && cmd !== process.execPath, env: { ...process.env, FORCE_COLOR: '0' } });
    let out = '';
    let last = null;
    const onData = (d) => {
      out += d;
      for (const line of String(d).split('\n')) {
        const t = line.trim();
        if (!t) continue;
        try {
          last = JSON.parse(t);
          broadcast(tag, last);
        } catch {
          broadcast(tag, { event: 'log', text: t.slice(0, 300) });
        }
      }
    };
    p.stdout.on('data', onData);
    p.stderr.on('data', onData);
    p.on('close', (code) => (code === 0 ? resolve({ out, last }) : reject(Object.assign(new Error(`${tag}: uscito con codice ${code}`), { out, last }))));
  });
}

const ASSISTANT_FILE = path.join(SRC, 'assistente.json');
function readAssistantUrl() {
  try {
    return JSON.parse(fs.readFileSync(ASSISTANT_FILE, 'utf8')).url ?? '';
  } catch {
    return '';
  }
}
function writeAssistantUrl(url) {
  if (url) fs.writeFileSync(ASSISTANT_FILE, `${JSON.stringify({ url }, null, 2)}
`);
  else fs.rmSync(ASSISTANT_FILE, { force: true });
}

/** Pubblica assistente/ su Cloudflare (accesso dal browser la prima volta) e ne salva l'indirizzo. */
async function deployAssistant() {
  const wrangler = (...a) => runStreaming('npx', ['--yes', 'wrangler@4', ...a], 'assistente');
  const who = await wrangler('whoami').catch((e) => e);
  if (/not authenticated|non autenticat|wrangler login/i.test(who.out ?? '')) {
    broadcast('assistente', { event: 'log', text: 'Si apre il browser: accedi a Cloudflare (o crea un account gratuito) e consenti l’accesso.' });
    await wrangler('login');
  }
  const { out } = await wrangler('deploy', '--config', path.join(ROOT, 'assistente/wrangler.toml'));
  const url = out.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/i)?.[0];
  if (!url) throw new Error('Assistente pubblicato, ma non trovo il suo indirizzo: copialo dalla pagina di Cloudflare e incollalo qui.');
  writeAssistantUrl(`${url}/`);
  return { url: `${url}/` };
}

const buildContent = (folders = []) => runStreaming(process.execPath, [path.join(ROOT, 'scripts/build-content.mjs'), ...folders], 'pipeline');

// ---- Lettura dello stato dei quadri ----------------------------------------
function listFolders() {
  if (!fs.existsSync(SRC)) fs.mkdirSync(SRC, { recursive: true });
  return fs.readdirSync(SRC, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('_'))
    .map((d) => d.name)
    .sort();
}

function problemsFor(id) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, '.cache/problemi.json'), 'utf8')).filter((p) => p.id === id).map((p) => p.message);
  } catch {
    return [];
  }
}

function readMeta(id) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, id, 'meta.json'), 'utf8'));
  } catch {
    return null;
  }
}

function summary(folder) {
  const dir = path.join(SRC, folder);
  const id = folderId(folder);
  const { info, problems } = readInfo(dir);
  const image = findFile(dir, 'quadro', IMAGE_EXT);
  const audio = findFile(dir, 'audio', AUDIO_EXT);
  const hasText = fs.existsSync(path.join(dir, 'testo.txt'));
  const meta = readMeta(id);
  const built = problemsFor(id);
  const missing = [];
  if (!image) missing.push('immagine');
  if (!hasText) missing.push('testo');
  if (!audio && info.voce !== 'demo') missing.push('audio');
  if (!info.title) missing.push('titolo');
  const stale = meta && image ? fs.statSync(image).mtimeMs > fs.statSync(path.join(DATA, id, 'meta.json')).mtimeMs : false;
  let status = 'completo';
  if (missing.length) status = 'incompleto';
  else if (!meta || stale) status = 'da-preparare';
  return {
    folder,
    id,
    order: Number(folder.match(/^\d+/)?.[0] ?? 0),
    title: info.title ?? '',
    artist: info.artist ?? '',
    year: info.year ?? '',
    room: /^\[DA COMPLETARE/i.test(info.room ?? '') ? '' : info.room ?? '',
    experience: info.experience ?? 'racconto',
    voce: info.voce ?? '',
    status,
    missing,
    problems: [...new Set([...problems, ...built])],
    hasImage: !!image,
    hasText,
    audio: audio ? path.basename(audio) : null,
    video: findFile(dir, 'racconto', VIDEO_EXT) ? path.basename(findFile(dir, 'racconto', VIDEO_EXT)) : null,
    built: !!meta,
    bytes: meta?.budget?.bytes ?? 0,
  };
}

async function imageQuality(file, meta) {
  const m = await sharp(file).metadata();
  const st = await sharp(file).resize(600).greyscale().stats();
  const mean = st.channels[0].mean;
  const contrast = st.channels[0].stdev;
  const tips = [];
  const side = Math.max(m.width, m.height);
  if (side < 2000) tips.push({ level: 'ko', text: `Immagine piccola (${m.width}×${m.height}): cercane una di almeno 3000 pixel sul lato lungo.` });
  else if (side < 3000) tips.push({ level: 'warn', text: `Risoluzione discreta (${m.width}×${m.height}): va bene, ma con 3000 pixel o più gli zoom sono più nitidi.` });
  else tips.push({ level: 'ok', text: `Risoluzione buona (${m.width}×${m.height}).` });
  if (mean < 60) tips.push({ level: 'warn', text: 'Quadro molto scuro: il riconoscimento può essere più lento. In sala serve una buona illuminazione.' });
  else tips.push({ level: 'ok', text: 'Luminosità adeguata.' });
  if (contrast < 35) tips.push({ level: 'warn', text: 'Poco contrasto: il riconoscimento potrebbe essere difficile.' });
  const points = meta?.targets?.main?.points;
  if (points == null) tips.push({ level: 'info', text: 'Punti di riconoscimento: premi "Prepara" per calcolarli.' });
  else if (points < 500) tips.push({ level: 'ko', text: `Pochi punti di riconoscimento (${points}): il quadro potrebbe non essere riconosciuto.` });
  else if (points < 1200) tips.push({ level: 'warn', text: `Punti di riconoscimento sufficienti (${points}).` });
  else tips.push({ level: 'ok', text: `Molti punti di riconoscimento (${points}): verrà riconosciuto facilmente.` });
  return { width: m.width, height: m.height, mean: Math.round(mean), contrast: Math.round(contrast), points, tips };
}

/** Idoneità alle esperienze (euristica semplice; vedi docs/ESPERIENZE.md). */
function triage(meta, regions) {
  const strong = (meta?.dettagli ?? []).filter((d) => (d.points ?? 0) >= 250).length;
  return {
    racconto: { score: 100, note: 'Sempre possibile: è il ripiego per ogni quadro.' },
    dettagli: { score: Math.min(100, strong * 30 + (regions.dettagli?.length ?? 0) * 10), note: regions.dettagli?.length ? `${regions.dettagli.length} particolari segnati, ${strong} ben riconoscibili da vicino.` : 'Nessun particolare segnato.' },
    caccia: { score: Math.min(100, (regions.caccia?.items?.length ?? 0) * 18), note: regions.caccia?.items?.length ? `${regions.caccia.items.length} elementi nascosti segnati (ne servono almeno 3).` : 'Nessun elemento nascosto segnato: servono particolari descritti nel testo.' },
    personaggio: personaggioTriage(meta, regions),
  };
}

function personaggioTriage(meta, regions) {
  const n = regions.personaggio?.domande?.length ?? 0;
  if (!meta?.personaggio) return { score: null, note: `Serve un volto grande e ben visibile. Scegli Personaggio e premi "Prepara" per sapere se il volto viene trovato. ${n} domande scritte.` };
  const face = !!meta.personaggio.volto;
  return {
    score: (face ? 60 : 20) + Math.min(40, n * 4),
    note: `${face ? 'Volto trovato' : 'Volto non trovato: segna i punti a mano'}; ${n} domande (ne servono da 8 a 15).`,
  };
}

async function details(folder) {
  const dir = path.join(SRC, folder);
  if (!fs.existsSync(dir)) throw httpError(404, 'Quadro non trovato');
  const s = summary(folder);
  const regions = readRegions(dir);
  const meta = readMeta(s.id);
  const text = s.hasText ? fs.readFileSync(path.join(dir, 'testo.txt'), 'utf8') : '';
  const image = findFile(dir, 'quadro', IMAGE_EXT);
  let alignment = null;
  try {
    alignment = JSON.parse(fs.readFileSync(path.join(DATA, s.id, 'alignment.json'), 'utf8'));
  } catch { /* non ancora preparato */ }
  return {
    ...s,
    text,
    regions,
    meta,
    alignment,
    quality: image ? await imageQuality(image, meta) : null,
    triage: triage(meta, regions),
    pronuncia: fs.existsSync(path.join(dir, 'pronuncia.txt')) ? fs.readFileSync(path.join(dir, 'pronuncia.txt'), 'utf8') : '',
    approfondimento: fs.existsSync(path.join(dir, 'approfondimento.txt')) ? fs.readFileSync(path.join(dir, 'approfondimento.txt'), 'utf8') : '',
  };
}

// ---- Modifiche ---------------------------------------------------------------
const slug = (s) => s.normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '').slice(0, 40) || 'quadro';

function nextNumber() {
  const nums = listFolders().map((f) => Number(f.match(/^\d+/)?.[0] ?? 0));
  return String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, '0');
}

function createPainting(title) {
  const id = slug(title);
  if (listFolders().some((f) => folderId(f) === id)) throw httpError(409, `Esiste già un quadro con un nome simile ("${id}"). Scegli un titolo diverso.`);
  const folder = `${nextNumber()}-${id}`;
  const dir = path.join(SRC, folder);
  fs.mkdirSync(dir);
  writeInfo(dir, { title, experience: 'racconto' });
  backups.record({ type: 'create', folder, label: `Aggiunto "${title}"` });
  return folder;
}

function safeFolder(folder) {
  if (!/^[\w.-]+$/.test(folder) || !fs.existsSync(path.join(SRC, folder))) throw httpError(404, 'Quadro non trovato');
  return folder;
}

function removeExisting(dir, base, exts) {
  for (const e of exts) for (const n of [base + e, base + e.toUpperCase()]) if (fs.existsSync(path.join(dir, n))) fs.rmSync(path.join(dir, n));
}

async function saveUpload(folder, kind, filename, body, detailId) {
  const dir = path.join(SRC, folder);
  const ext = path.extname(filename || '').toLowerCase();
  backups.snapshot(folder, `Caricato ${kind}`);
  if (kind === 'image') {
    if (!IMAGE_EXT.includes(ext)) throw httpError(400, 'Formato immagine non supportato: usa JPG o PNG.');
    removeExisting(dir, 'quadro', IMAGE_EXT);
    // Sempre JPEG, orientamento corretto: il resto della pipeline si aspetta quadro.jpg.
    await sharp(body).rotate().jpeg({ quality: 95 }).toFile(path.join(dir, 'quadro.jpg'));
  } else if (kind === 'audio') {
    if (!AUDIO_EXT.includes(ext)) throw httpError(400, 'Formato audio non supportato: usa MP3, WAV o M4A.');
    removeExisting(dir, 'audio', AUDIO_EXT);
    fs.writeFileSync(path.join(dir, `audio${ext}`), body);
  } else if (kind === 'video') {
    if (!VIDEO_EXT.includes(ext)) throw httpError(400, 'Formato video non supportato: usa MP4 o MOV.');
    removeExisting(dir, 'racconto', VIDEO_EXT);
    fs.writeFileSync(path.join(dir, `racconto${ext}`), body);
  } else if (kind === 'detail') {
    // File di un particolare: contenuti/<quadro>/dettagli/<id>.<ext>
    const id = String(detailId ?? '');
    if (!/^[a-z0-9-]{1,40}$/.test(id)) throw httpError(400, 'Particolare non valido');
    const type = AUDIO_EXT.includes(ext) ? 'audio' : VIDEO_EXT.includes(ext) ? 'video' : null;
    if (!type) throw httpError(400, 'Formato non supportato: usa MP3, WAV, M4A per l\'audio o MP4, MOV per il video.');
    const ddir = path.join(dir, 'dettagli');
    fs.mkdirSync(ddir, { recursive: true });
    for (const f of fs.readdirSync(ddir)) if (path.parse(f).name === id) fs.rmSync(path.join(ddir, f));
    fs.writeFileSync(path.join(ddir, `${id}${ext}`), body);
    return { type, file: `dettagli/${id}${ext}` };
  } else if (kind === 'text') {
    fs.writeFileSync(path.join(dir, 'testo.txt'), body.toString('utf8').replace(/^﻿/, ''));
  } else throw httpError(400, 'Tipo di file sconosciuto');
}

function reorder(folders) {
  const current = listFolders();
  if (folders.length !== current.length || folders.some((f) => !current.includes(f))) throw httpError(400, 'Elenco non valido: ricarica la pagina.');
  // Due passaggi (nomi temporanei) per evitare collisioni tra i vecchi e i nuovi numeri.
  const tmp = folders.map((f, i) => {
    const t = `_riordino-${i}-${folderId(f)}`;
    fs.renameSync(path.join(SRC, f), path.join(SRC, t));
    return t;
  });
  const result = tmp.map((t, i) => {
    const name = `${String(i + 1).padStart(2, '0')}-${t.replace(/^_riordino-\d+-/, '')}`;
    fs.renameSync(path.join(SRC, t), path.join(SRC, name));
    return name;
  });
  backups.record({ type: 'reorder', before: current, after: result, label: 'Cambiato l\'ordine dei quadri' });
  return result;
}

// ---- Utilità HTTP --------------------------------------------------------------
function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function readBody(req, limit = 600 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(httpError(413, 'File troppo grande.'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const json = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
};

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json', '.vtt': 'text/vtt' };

function sendFile(req, res, file) {
  if (!fs.existsSync(file)) return json(res, 404, { error: 'File non trovato' });
  const stat = fs.statSync(file);
  const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Number(range[2]) : stat.size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Cache-Control': 'no-store' });
    fs.createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  }
}

function todoState() {
  const file = path.join(STATE, 'spunte.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

// ---- Router -----------------------------------------------------------------------
async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean).slice(1); // dopo "api"
  const m = req.method;
  const q = url.searchParams;

  if (parts[0] === 'events' && m === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify({ event: 'hello', job })}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (parts[0] === 'paintings' && parts.length === 1) {
    if (m === 'GET') {
      let index = null;
      try {
        index = JSON.parse(fs.readFileSync(path.join(DATA, 'index.json'), 'utf8'));
      } catch { /* non ancora preparato */ }
      return json(res, 200, { paintings: listFolders().map(summary), totalBytes: index?.totalBytes ?? 0, budgetTotal: 120 * 1024 * 1024, budgetPainting: 6 * 1024 * 1024 });
    }
    if (m === 'POST') {
      const { title } = JSON.parse((await readBody(req)).toString() || '{}');
      if (!title?.trim()) throw httpError(400, 'Scrivi il titolo del quadro.');
      return json(res, 201, { folder: createPainting(title.trim()) });
    }
  }
  if (parts[0] === 'reorder' && m === 'POST') return json(res, 200, { folders: reorder(JSON.parse((await readBody(req)).toString()).folders) });
  if (parts[0] === 'undo' && m === 'POST') {
    // Annullare un ripristino della cronologia cambia tutti i quadri: si rigenerano i dati dell'app.
    const all = backups.load().at(-1)?.type === 'all';
    if (all && job) throw httpError(409, `È già in corso: ${job}. Attendi che finisca.`);
    const undone = backups.undo();
    if (all) runJob('prepara', () => buildContent().then(({ last }) => last));
    return json(res, 200, { undone });
  }
  if (parts[0] === 'history' && m === 'GET') return json(res, 200, { last: backups.lastLabel() });
  if (parts[0] === 'versions' && m === 'GET') return json(res, 200, await versions(ROOT));
  if (parts[0] === 'versions' && parts[1] === 'restore' && m === 'POST') {
    const { sha } = JSON.parse((await readBody(req)).toString() || '{}');
    if (job) throw httpError(409, `È già in corso: ${job}. Attendi che finisca.`);
    const v = (await versions(ROOT)).versions.find((x) => x.sha === sha);
    if (!v) throw httpError(400, 'Versione sconosciuta');
    const when = new Date(v.at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
    backups.snapshotAll(`Ripristinata la versione del ${when}`);
    await restoreVersion(ROOT, sha);
    runJob('prepara', () => buildContent().then(({ last }) => last));
    return json(res, 200, { ok: true, when });
  }

  if (parts[0] === 'paintings' && parts[1]) {
    const folder = safeFolder(decodeURIComponent(parts[1]));
    const dir = path.join(SRC, folder);
    const sub = parts[2];
    if (!sub && m === 'GET') return json(res, 200, await details(folder));
    if (!sub && m === 'DELETE') {
      backups.remove(folder);
      return json(res, 200, { ok: true });
    }
    if (sub === 'duplicate' && m === 'POST') {
      const info = readInfo(dir).info;
      const copy = createPainting(`${info.title ?? folderId(folder)} copia`);
      for (const f of fs.readdirSync(dir)) if (f !== 'info.txt') fs.cpSync(path.join(dir, f), path.join(SRC, copy, f), { recursive: true });
      writeInfo(path.join(SRC, copy), { ...info, title: `${info.title ?? ''} (copia)` });
      return json(res, 201, { folder: copy });
    }
    if (sub === 'info' && m === 'PUT') {
      const body = JSON.parse((await readBody(req)).toString());
      if (body.experience && !EXPERIENCES.includes(body.experience)) throw httpError(400, 'Esperienza sconosciuta');
      backups.snapshot(folder, 'Modificate le informazioni');
      writeInfo(dir, { ...readInfo(dir).info, ...body });
      return json(res, 200, summary(folder));
    }
    if (sub === 'text' && m === 'PUT') {
      backups.snapshot(folder, 'Modificato il testo');
      fs.writeFileSync(path.join(dir, 'testo.txt'), JSON.parse((await readBody(req)).toString()).text ?? '');
      return json(res, 200, { ok: true });
    }
    if (sub === 'pronuncia' && m === 'PUT') {
      backups.snapshot(folder, 'Modificata la pronuncia');
      const text = JSON.parse((await readBody(req)).toString()).text ?? '';
      if (text.trim()) fs.writeFileSync(path.join(dir, 'pronuncia.txt'), text);
      else fs.rmSync(path.join(dir, 'pronuncia.txt'), { force: true });
      return json(res, 200, { ok: true });
    }
    if (sub === 'approfondimento' && m === 'PUT') {
      backups.snapshot(folder, 'Modificato il testo completo del personaggio');
      const text = JSON.parse((await readBody(req)).toString()).text ?? '';
      if (text.trim()) fs.writeFileSync(path.join(dir, 'approfondimento.txt'), text);
      else fs.rmSync(path.join(dir, 'approfondimento.txt'), { force: true });
      return json(res, 200, { ok: true });
    }
    if (sub === 'regions' && m === 'PUT') {
      backups.snapshot(folder, 'Modificati particolari o movimenti');
      writeRegions(dir, JSON.parse((await readBody(req)).toString()).regions);
      return json(res, 200, { ok: true });
    }
    if (sub === 'upload' && m === 'POST') {
      const saved = await saveUpload(folder, q.get('kind'), q.get('name') ?? '', await readBody(req), q.get('id'));
      return json(res, 200, saved ?? summary(folder));
    }
    if (sub === 'media' && m === 'DELETE') {
      const kind = q.get('kind');
      backups.snapshot(folder, `Rimosso ${kind}`);
      if (kind === 'audio') removeExisting(dir, 'audio', AUDIO_EXT);
      else if (kind === 'video') removeExisting(dir, 'racconto', VIDEO_EXT);
      else throw httpError(400, 'Tipo sconosciuto');
      return json(res, 200, summary(folder));
    }
    if (sub === 'file' && m === 'GET') {
      // Solo file noti della cartella: niente percorsi arbitrari.
      const kind = q.get('kind');
      const detail = kind === 'detail' && /^[a-z0-9-]{1,40}$/.test(q.get('id') ?? '') ? findFile(path.join(dir, 'dettagli'), q.get('id'), [...AUDIO_EXT, ...VIDEO_EXT]) : null;
      const f = kind === 'image' ? findFile(dir, 'quadro', IMAGE_EXT) : kind === 'audio' ? findFile(dir, 'audio', AUDIO_EXT) : kind === 'video' ? findFile(dir, 'racconto', VIDEO_EXT) : detail;
      if (!f) return json(res, 404, { error: 'File non trovato' });
      if (kind === 'image' && q.get('w')) {
        const buf = await sharp(f).resize({ width: Math.min(2400, Number(q.get('w'))), withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
        res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' });
        return res.end(buf);
      }
      return sendFile(req, res, f);
    }
  }

  // Assistente online dei personaggi: indirizzo (contenuti/assistente.json) e pubblicazione su Cloudflare.
  if (parts[0] === 'assistant' && !parts[1] && m === 'GET') return json(res, 200, { url: readAssistantUrl() });
  if (parts[0] === 'assistant' && !parts[1] && m === 'PUT') {
    const url = String(JSON.parse((await readBody(req)).toString() || '{}').url ?? '').trim();
    if (url && !/^https:\/\/[^\s/]+(\/\S*)?$/.test(url)) throw httpError(400, 'L’indirizzo deve iniziare con https://');
    writeAssistantUrl(url);
    return json(res, 200, { url });
  }
  if (parts[0] === 'assistant' && parts[1] === 'deploy' && m === 'POST') {
    runJob('assistente', deployAssistant);
    return json(res, 202, { ok: true });
  }
  if (parts[0] === 'build' && m === 'POST') {
    const { folders = [] } = JSON.parse((await readBody(req)).toString() || '{}');
    runJob('prepara', () => buildContent(folders).then(({ last }) => last));
    return json(res, 202, { ok: true });
  }
  if (parts[0] === 'verify' && m === 'POST') {
    runJob('verifica', verifyAll);
    return json(res, 202, { ok: true });
  }
  if (parts[0] === 'publish' && m === 'POST') {
    runJob('pubblica', () => publish(ROOT, (ev) => broadcast('publish', ev), buildContent));
    return json(res, 202, { ok: true });
  }
  if (parts[0] === 'zip' && m === 'POST') {
    runJob('cartella', () => buildZip(ROOT, (ev) => broadcast('publish', ev)));
    return json(res, 202, { ok: true });
  }
  if (parts[0] === 'preview-link' && m === 'POST') {
    runJob('anteprima-telefono', () => startPreviewTunnel(ROOT, (ev) => broadcast('tunnel', ev)));
    return json(res, 202, { ok: true });
  }
  if (parts[0] === 'preview-link' && m === 'DELETE') {
    stopPreviewTunnel();
    return json(res, 200, { ok: true });
  }
  if (parts[0] === 'todo' && m === 'GET') {
    const md = fs.existsSync(path.join(ROOT, 'DA_FARE_UTENTE.md')) ? fs.readFileSync(path.join(ROOT, 'DA_FARE_UTENTE.md'), 'utf8') : '';
    let problems = [];
    try {
      problems = JSON.parse(fs.readFileSync(path.join(ROOT, '.cache/problemi.json'), 'utf8'));
    } catch { /* nessuna preparazione ancora */ }
    return json(res, 200, { markdown: md, problems, checked: todoState() });
  }
  if (parts[0] === 'todo' && m === 'PUT') {
    fs.writeFileSync(path.join(STATE, 'spunte.json'), JSON.stringify(JSON.parse((await readBody(req)).toString()).checked ?? {}));
    return json(res, 200, { ok: true });
  }
  if (parts[0] === 'report' && m === 'GET') {
    try {
      return json(res, 200, JSON.parse(fs.readFileSync(path.join(STATE, 'verifica.json'), 'utf8')));
    } catch {
      return json(res, 200, null);
    }
  }
  throw httpError(404, 'Indirizzo sconosciuto');
}

/** "Verifica tutto": prepara i contenuti, controlla lo schema, esegue i test principali. */
async function verifyAll() {
  const steps = [];
  const step = async (label, fn) => {
    broadcast('verify', { step: label, state: 'start' });
    try {
      await fn();
      steps.push({ label, ok: true });
      broadcast('verify', { step: label, state: 'ok' });
    } catch (e) {
      const detail = String(e?.last?.message ?? e?.message ?? e).slice(0, 400);
      steps.push({ label, ok: false, detail });
      broadcast('verify', { step: label, state: 'ko', detail });
    }
  };
  await step('Preparazione dei contenuti', () => buildContent());
  await step('Controllo dei dati e test di base', () => runStreaming('npx', ['vitest', 'run', 'tests/unit', '--reporter=dot'], 'test'));
  await step('Prova dell\'app con fotocamera simulata', async () => {
    await runStreaming(process.execPath, [path.join(ROOT, 'scripts/make-test-videos.mjs')], 'test');
    await runStreaming('npx', ['playwright', 'test', '--grep', '@principale', '--reporter=line'], 'test');
  });
  await step('Costruzione del sito', () => runStreaming('npx', ['vite', 'build', '--logLevel', 'warn'], 'test'));
  let problems = [];
  try {
    problems = JSON.parse(fs.readFileSync(path.join(ROOT, '.cache/problemi.json'), 'utf8'));
  } catch { /* già segnalato dal passo di preparazione */ }
  const report = { at: new Date().toISOString(), ok: steps.every((s) => s.ok), steps, problems };
  fs.writeFileSync(path.join(STATE, 'verifica.json'), JSON.stringify(report, null, 2));
  return report;
}

// ---- Avvio ------------------------------------------------------------------------
let vite = null;
const ALLOWED_HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);

const server = http.createServer(async (req, res) => {
  // Protezione dal DNS rebinding: si accettano solo richieste rivolte a questo computer.
  if (!ALLOWED_HOSTS.has(req.headers.host ?? '')) {
    res.writeHead(403);
    return res.end('Host non consentito');
  }
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/' || url.pathname === '/studio') {
    res.writeHead(302, { Location: `/studio/${url.search}` });
    return res.end();
  }
  if (url.pathname.startsWith('/api/')) {
    const token = req.headers['x-studio-token'] ?? url.searchParams.get('t');
    const origin = req.headers.origin;
    if (token !== TOKEN || (origin && !ALLOWED_HOSTS.has(origin.replace(/^https?:\/\//, '')))) return json(res, 401, { error: 'Accesso non autorizzato: riapri lo Studio dal suo avviatore.' });
    try {
      await api(req, res, url);
    } catch (e) {
      if (!res.headersSent) json(res, e.status ?? 500, { error: e.status ? e.message : `Errore imprevisto: ${e.message}` });
      if (!e.status) console.error(e);
    }
    return;
  }
  if (!vite) {
    res.writeHead(503);
    return res.end('Lo Studio si sta avviando, riprova tra un attimo.');
  }
  vite.middlewares(req, res);
});

// Vite usa lo stesso server (e la stessa porta) anche per il ricaricamento
// automatico: nessuna seconda porta che possa risultare occupata.
vite = await createVite({
  root: ROOT,
  configFile: path.join(ROOT, 'vite.config.ts'),
  appType: 'mpa',
  server: { middlewareMode: true, hmr: { server } },
  logLevel: 'warn',
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`\nLo Studio sembra già aperto (porta ${PORT} occupata). Usa la finestra del browser già aperta, oppure chiudi l'altra finestra dello Studio e riprova.\n`);
    process.exit(1);
  }
  throw e;
});

server.listen(PORT, '127.0.0.1', () => {
  const link = `http://127.0.0.1:${PORT}/studio/?t=${TOKEN}`;
  console.log(JSON.stringify({ event: 'ready', url: link }));
  console.log(`\nStudio pronto. Se il browser non si apre da solo, copia questo indirizzo:\n${link}\n\nPer chiudere lo Studio chiudi questa finestra.\n`);
  if (args.includes('--open')) {
    const opener = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', link]] : process.platform === 'darwin' ? ['open', [link]] : ['xdg-open', [link]];
    execFile(opener[0], opener[1], () => {});
  }
});
