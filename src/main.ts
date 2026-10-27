import * as THREE from 'three';
import './style.css';
import { ArView, makeFrame } from './ar/ArView';
import { MindArTracker } from './tracker/MindArTracker';
import { unlockAll, attachCamera } from './media';
import { loadIndex, loadMeta, dataUrl, type PaintingMeta } from './data';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const MAX_TRACK = Number(params.get('maxTrack') ?? 1);
const DWELL_MS = 1200;

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const show = (id: string) => document.querySelectorAll<HTMLElement>('.screen').forEach((s) => (s.hidden = s.id !== id));

/** Stato esposto per i test automatici e la pagina ?debug=1. */
const probe = {
  phase: 'welcome' as string,
  startedAt: 0,
  firstFoundMs: null as number | null,
  events: [] as { t: number; type: string; target?: string }[],
  renderFps: 0,
  trackerFps: 0,
  tracking: [] as string[],
  video: '',
  error: '',
};
(window as unknown as { __ar: typeof probe }).__ar = probe;
const log = (type: string, target?: string) => probe.events.push({ t: Math.round(performance.now() - probe.startedAt), type, target });

async function init() {
  if (DEBUG) $('#debug').hidden = false;
  $('#start').addEventListener('click', onStart);
  const id = params.get('p');
  const index = await loadIndex();
  const list = $('#painting-list');
  for (const p of index.paintings) {
    const a = document.createElement('a');
    a.href = `?p=${encodeURIComponent(p.id)}${DEBUG ? '&debug=1' : ''}`;
    a.className = 'painting-item';
    a.innerHTML = `<strong></strong><span></span>`;
    a.querySelector('strong')!.textContent = p.title;
    a.querySelector('span')!.textContent = [p.artist, p.year].filter(Boolean).join(', ');
    list.append(a);
  }
  if (id && !index.paintings.some((p) => p.id === id)) $('#welcome-note').textContent = 'Quadro non trovato: scegline uno dall\'elenco.';
}

async function onStart() {
  const id = params.get('p');
  // Nessun await prima di unlockAll: il tap deve restare "fresco" per Safari.
  const unlockP = unlockAll();
  if (!id) {
    await unlockP;
    show('picker');
    return;
  }
  show('loading');
  const unlock = await unlockP;
  const meta = await loadMeta(id);
  if (!unlock.camera) {
    probe.error = unlock.cameraError ?? 'camera';
    return showFallback(meta, unlock.cameraError);
  }
  try {
    await runAr(meta, unlock.camera);
  } catch (e) {
    probe.error = String(e);
    console.error(e);
    showFallback(meta, 'Il riconoscimento non è partito su questo telefono.');
  }
}

async function runAr(meta: PaintingMeta, stream: MediaStream) {
  const video = $<HTMLVideoElement>('#camera');
  await attachCamera(video, stream);
  probe.video = `${video.videoWidth}x${video.videoHeight}`;
  const view = new ArView($('#ar'), video);
  const labels = new Map<number, string>([[0, meta.title], ...meta.dettagli.map((d) => [d.targetIndex, d.label] as [number, string])]);
  const found = new Set<string>();

  const tracker = new MindArTracker({
    maxTrack: MAX_TRACK,
    onFound: (i) => {
      log('found', labels.get(i));
      probe.firstFoundMs ??= Math.round(performance.now() - probe.startedAt);
      if (i === 0) setStatus(`Quadro riconosciuto: ${meta.title}`);
      const d = meta.dettagli.find((x) => x.targetIndex === i);
      if (d && d.trigger.includes('target')) discover(d.id, d.label, 'target');
    },
    onLost: (i) => {
      log('lost', labels.get(i));
      view.setPose(i, null);
      if (!tracker.stats().tracking.length) setStatus('Inquadra il quadro');
    },
    onPose: ({ targetIndex, matrix }) => view.setPose(targetIndex, matrix),
  });

  setStatus('Preparo il riconoscimento…');
  const { aspects } = await tracker.load(dataUrl(meta.id, meta.targets.mind), video);
  view.setProjection(tracker.projectionMatrix());

  // Ancoraggio 0 = quadro intero: cornice esterna e riquadri dei particolari.
  const main = view.anchor(0);
  const mainH = 1 / aspects[0];
  main.add(makeFrame(1, mainH, 0xffffff));
  const detailCenters = meta.dettagli.map((d) => {
    const c = d.crop;
    const cx = c.x + c.w / 2 - 0.5;
    const cy = (0.5 - (c.y + c.h / 2)) * mainH;
    const frame = makeFrame(c.w, c.h * mainH);
    frame.position.set(cx, cy, 0.001);
    main.add(frame);
    return { d, center: new THREE.Vector3(cx, cy, 0), edge: new THREE.Vector3(cx + c.w / 2, cy, 0) };
  });
  // Ancoraggi dei ritagli: cornice sul ritaglio stesso.
  for (const d of meta.dettagli) view.anchor(d.targetIndex).add(makeFrame(1, 1 / aspects[d.targetIndex]));

  function discover(id: string, label: string, via: string) {
    if (found.has(id)) return;
    found.add(id);
    log(`discover:${via}`, label);
    $('#progress').textContent = `Particolari trovati: ${found.size}/${meta.dettagli.length}`;
    const card = $('#card');
    card.querySelector('h2')!.textContent = label;
    card.querySelector('p')!.textContent = via === 'target' ? 'Riconosciuto da vicino.' : 'Trovato con il mirino.';
    card.hidden = false;
  }
  $('#card-close').onclick = () => ($('#card').hidden = true);
  $('#progress').textContent = `Particolari trovati: 0/${meta.dettagli.length}`;

  show('ar-screen');
  view.layout();
  setStatus('Inquadra il quadro');
  probe.phase = 'tracking';
  probe.startedAt = performance.now();
  tracker.start();

  // Metodo mirino: con il quadro intero agganciato, tenere un particolare nel
  // cerchio centrale (e abbastanza grande) per DWELL_MS lo attiva.
  const reticle = $('#reticle');
  let dwell: { id: string; since: number } | null = null;
  const loop = () => {
    view.render();
    let target: { id: string; label: string } | null = null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    for (const { d, center, edge } of detailCenters) {
      if (found.has(d.id)) continue;
      const p = view.toScreen(0, center);
      const e = view.toScreen(0, edge);
      if (!p || !e) break;
      const dist = Math.hypot(p.x - vw / 2, p.y - vh / 2);
      const halfWidth = Math.abs(e.x - p.x);
      if (dist < Math.max(48, halfWidth) && halfWidth * 2 > vw * 0.2) {
        target = d;
        break;
      }
    }
    const now = performance.now();
    if (target) {
      if (dwell?.id !== target.id) dwell = { id: target.id, since: now };
      const k = Math.min(1, (now - dwell.since) / DWELL_MS);
      reticle.style.setProperty('--k', String(k));
      reticle.classList.add('active');
      if (k >= 1) {
        discover(target.id, target.label, 'reticle');
        dwell = null;
      }
    } else {
      dwell = null;
      reticle.classList.remove('active');
      reticle.style.setProperty('--k', '0');
    }
    const s = tracker.stats();
    probe.renderFps = Math.round(view.renderFps);
    probe.trackerFps = Math.round(s.trackerFps);
    probe.tracking = s.tracking.map((i) => labels.get(i) ?? String(i));
    if (DEBUG) {
      $('#debug').textContent = [
        `render ${probe.renderFps} fps · tracker ${probe.trackerFps} fps`,
        `video ${probe.video} · maxTrack ${MAX_TRACK}`,
        `agganciati: ${probe.tracking.join(', ') || '—'}`,
        `primo riconoscimento: ${probe.firstFoundMs ?? '—'} ms`,
      ].join('\n');
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function setStatus(text: string) {
  $('#status').textContent = text;
}

function showFallback(meta: PaintingMeta, reason?: string) {
  probe.phase = 'fallback';
  show('fallback');
  $('#fallback-reason').textContent = reason ?? '';
  $<HTMLImageElement>('#fallback-img').src = dataUrl(meta.id, meta.image);
  $('#fallback-title').textContent = meta.title;
  const ul = $('#fallback-list');
  ul.replaceChildren(...meta.dettagli.map((d) => Object.assign(document.createElement('li'), { textContent: d.label })));
}

$('#fallback-btn').addEventListener('click', async () => {
  const id = params.get('p');
  if (id) showFallback(await loadMeta(id));
});

init().catch((e) => {
  probe.error = String(e);
  $('#welcome-note').textContent = 'Errore nel caricamento dei contenuti.';
});
