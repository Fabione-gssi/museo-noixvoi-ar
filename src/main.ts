import './style.css';
import { ArSession } from './ar/ArSession';
import { makeFrame } from './ar/ArView';
import { unlockAll } from './media';
import { loadIndex, loadMeta, dataUrl, type PaintingMeta, type PaintingIndex } from './data';
import { registerServiceWorker, reconcile, bindOfflinePanel, markPicker, downloadInBackground } from './offline';
import { setupDettagli, dettagliWithoutCamera } from './experiences/dettagli';
import { setupCaccia, cacciaWithoutCamera } from './experiences/caccia';
import { startRacconto, type StoryHandle } from './experiences/racconto';
import { startPersonaggio } from './experiences/personaggio';
import { probe, log } from './probe';
import { getPref, setPref } from './prefs';
import { startDebug, debugInfo, APP_VERSION } from './debug';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const MAX_TRACK = Number(params.get('maxTrack') ?? 1);

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const show = (id: string) => document.querySelectorAll<HTMLElement>('.screen').forEach((s) => (s.hidden = s.id !== id));

const TUTORIAL: Record<string, string> = {
  racconto: 'Inquadra il quadro intero. Quando lo riconosco parte il racconto: puoi abbassare il telefono e ascoltare.',
  dettagli: 'Inquadra il quadro, poi avvicinati ai particolari tenendoli nel cerchio al centro.',
  personaggio: 'Inquadra il quadro intero. Quando lo riconosco il personaggio si presenta: poi puoi abbassare il telefono e fargli delle domande.',
  caccia: 'Muovi il telefono sul quadro: la lente al centro rivela cose nascoste. Quando ne vedi una, tienila nella lente per un secondo.',
};

let stream: MediaStream | null = null;
let session: ArSession | null = null;
let story: StoryHandle | null = null;
let index: PaintingIndex = { paintings: [], totalBytes: 0 };
/** Nomi dei target del quadro aperto (0 = quadro intero), per ?debug=1. */
let targetLabels = new Map<number, string>();

/** Esperienze non ancora realizzate usano il racconto, ripiego universale. */
const experienceOf = (m: PaintingMeta) =>
  m.experience === 'dettagli' ? 'dettagli' : m.experience === 'caccia' && m.caccia ? 'caccia' : m.experience === 'personaggio' && m.personaggio ? 'personaggio' : 'racconto';

async function init() {
  debugInfo.maxTrack = MAX_TRACK;
  if (DEBUG) startDebug($('#debug'));
  $('#version').textContent = `Versione ${APP_VERSION}`;
  $('#start').addEventListener('click', onStart);
  // Versione nuova dell'app: si ricarica solo se il visitatore non sta usando un quadro.
  void registerServiceWorker(() => {
    if (!$('#welcome').hidden || !$('#picker').hidden) location.reload();
  });
  index = await loadIndex();
  await reconcile(index).catch(() => undefined);
  const list = $('#painting-list');
  for (const p of index.paintings) {
    const a = document.createElement('a');
    a.href = `?p=${encodeURIComponent(p.id)}${DEBUG ? '&debug=1' : ''}`;
    a.className = 'painting-item';
    a.dataset.id = p.id;
    a.innerHTML = '<strong></strong><span></span>';
    a.querySelector('strong')!.textContent = p.title;
    a.querySelector('span')!.textContent = [p.artist, p.year].filter(Boolean).join(', ');
    list.append(a);
  }
  const id = params.get('p');
  if (id && !index.paintings.some((p) => p.id === id)) $('#welcome-note').textContent = 'Quadro non trovato: scegline uno dall\'elenco.';
  void markPicker(index);
  void bindOfflinePanel(index, $('#offline'));
  // Segnale per i test e per l'anteprima dello Studio: l'app è pronta a ricevere il tap.
  document.body.dataset.ready = '1';
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
  const [unlock, meta] = await Promise.all([unlockP, loadMeta(id).catch(() => null)]);
  if (!meta) {
    show('welcome');
    $('#welcome-note').textContent = navigator.onLine ? 'Non riesco a caricare il quadro: riprova tra poco.' : 'Senza internet questo quadro non è disponibile: non è stato scaricato sul telefono.';
    return;
  }
  downloadInBackground(index.paintings.find((p) => p.id === id));
  debugInfo.painting = meta.title;
  debugInfo.experience = experienceOf(meta);
  if (!unlock.camera) {
    probe.error = unlock.cameraError ?? 'camera';
    return withoutCamera(meta, unlock.cameraError);
  }
  stream = unlock.camera;
  await showTutorial(meta);
  try {
    await runAr(meta);
  } catch (e) {
    probe.error = String(e);
    console.error(e);
    withoutCamera(meta, 'Il riconoscimento non è partito su questo telefono.');
  }
}

function showTutorial(meta: PaintingMeta) {
  const kind = experienceOf(meta);
  if (getPref(`tutorial:${kind}`, '') || params.has('notutorial')) return Promise.resolve();
  return new Promise<void>((resolve) => {
    $('#tutorial-text').textContent = TUTORIAL[kind];
    show('tutorial');
    $('#tutorial-ok').onclick = () => {
      setPref(`tutorial:${kind}`, '1');
      resolve();
    };
  });
}

async function runAr(meta: PaintingMeta) {
  show('loading');
  const kind = experienceOf(meta);
  let exp: { onFound(i: number): void; onFrame(): void; stop(): void } | null = null;
  let leaving = false;
  const labels = new Map<number, string>([[0, meta.title], ...meta.dettagli.filter((d) => d.targetIndex).map((d) => [d.targetIndex!, d.label] as [number, string])]);
  targetLabels = labels;
  session = new ArSession({
    container: $('#ar'),
    video: $<HTMLVideoElement>('#camera'),
    stream: stream!,
    targetsUrl: dataUrl(meta.id, meta.targets.mind),
    maxTrack: MAX_TRACK,
    onFound: (i) => {
      log('found', labels.get(i));
      probe.firstFoundMs ??= Math.round(performance.now() - probe.startedAt);
      if (i === 0) setStatus(kind === 'racconto' ? 'Riconosciuto! Parte il racconto…' : kind === 'personaggio' ? 'Riconosciuto!' : 'Quadro riconosciuto');
      exp?.onFound(i);
      if ((kind === 'racconto' || kind === 'personaggio') && i === 0 && !leaving) {
        leaving = true;
        setTimeout(() => toStory(meta), 900);
      }
    },
    onLost: (i) => {
      log('lost', labels.get(i));
      if (!session?.tracker.stats().tracking.length && !session?.locked) setStatus('Inquadra il quadro');
    },
    onLockChange: (locked, auto) => {
      probe.locked = locked;
      log(locked ? (auto ? 'lock:auto' : 'lock') : 'unlock');
      $('#lock').textContent = locked ? 'Sblocca' : 'Blocca';
      $('#lock').setAttribute('aria-pressed', String(locked));
      setStatus(locked ? 'Bloccato: puoi abbassare il telefono' : 'Inquadra il quadro');
    },
    onFrame: () => {
      exp?.onFrame();
      updateDebug();
    },
  });
  setStatus('Preparo il riconoscimento…');
  await session.start();
  $('#find').hidden = true;
  $('#hunt').hidden = true;
  $('#reticle').hidden = true;
  if (kind === 'dettagli') {
    exp = setupDettagli(meta, session, () => {
      exp?.stop();
      void toStory(meta);
    });
  }
  else if (kind === 'caccia') exp = setupCaccia(meta, session);
  else session.view.anchor(0).add(makeFrame(1, 1 / session.aspects[0], 0xffd166));

  $('#lock').onclick = () => (session!.locked ? session!.unlock() : session!.lock());
  $('#fallback-btn').onclick = () => {
    exp?.stop();
    session?.stop();
    session = null;
    withoutCamera(meta);
  };
  show('ar-screen');
  setStatus('Inquadra il quadro');
  probe.phase = 'tracking';
  probe.startedAt = performance.now();
  session.run();
}

async function toStory(meta: PaintingMeta) {
  session?.stop();
  session = null;
  const kind = experienceOf(meta);
  show(kind === 'personaggio' ? 'character' : 'story');
  story = await (kind === 'personaggio' ? startPersonaggio : startRacconto)(meta, $(kind === 'personaggio' ? '#character' : '#story'), () => {
    story = null;
    if (stream) void runAr(meta);
    // Senza fotocamera, dal racconto completo dei dettagli si torna all'elenco dei particolari.
    else if (kind === 'dettagli') withoutCamera(meta);
    else show('welcome');
  });
}

/** Senza fotocamera: il racconto parte comunque; le altre esperienze mostrano la scheda del quadro. */
function withoutCamera(meta: PaintingMeta, reason?: string) {
  log('fallback', reason);
  if (experienceOf(meta) === 'racconto' || experienceOf(meta) === 'personaggio') {
    $(experienceOf(meta) === 'personaggio' ? '#character-note' : '#story-note').textContent = reason ?? '';
    void toStory(meta);
    return;
  }
  probe.phase = 'fallback';
  show('fallback');
  $('#fallback-reason').textContent = reason ?? '';
  $<HTMLImageElement>('#fallback-img').src = dataUrl(meta.id, meta.image);
  $('#fallback-title').textContent = meta.title;
  if (experienceOf(meta) === 'caccia') {
    $('#fallback-img').hidden = true;
    $('#fallback-find').hidden = true;
    cacciaWithoutCamera(meta);
  } else dettagliWithoutCamera(meta, () => void toStory(meta));
}

function setStatus(text: string) {
  $('#status').textContent = text;
}

function updateDebug() {
  if (!session) return;
  const s = session.tracker.stats();
  probe.renderFps = Math.round(session.view.renderFps);
  probe.trackerFps = Math.round(s.trackerFps);
  probe.tracking = s.tracking.map((i) => targetLabels.get(i) ?? String(i));
  probe.video = `${$<HTMLVideoElement>('#camera').videoWidth}x${$<HTMLVideoElement>('#camera').videoHeight}`;
}

window.addEventListener('pagehide', () => {
  story?.stop();
  session?.stop();
  stream?.getTracks().forEach((t) => t.stop());
});

init().catch((e) => {
  probe.error = String(e);
  $('#welcome-note').textContent = 'Errore nel caricamento dei contenuti.';
});
