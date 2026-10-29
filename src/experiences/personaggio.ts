import { FaceRenderer, type FaceState } from '../character/FaceRenderer';
import { LocalQA, type Answer } from '../character/dialog';
import { parseVtt, cueAt, type Cue } from '../story/timeline';
import { audioEl } from '../media';
import { dataUrl, type AudioRef, type PaintingMeta } from '../data';
import { probe, log } from '../probe';
import type { StoryHandle } from './racconto';

// Personaggio: dopo il riconoscimento (o senza fotocamera) la figura del quadro
// si presenta e risponde alle domande. Bocca mossa dal volume della voce
// (inviluppo calcolato in anticipo), battito di ciglia, sguardo che segue il
// telefono, respiro. Domande: 4 suggerite e testo libero, risposte preparate.

const $ = <T extends HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;

type Envelopes = { hz: number; [key: string]: number[] | number };

export async function startPersonaggio(meta: PaintingMeta, screen: HTMLElement, onBack: () => void): Promise<StoryHandle> {
  // ?anteprima=1: solo il volto, per i video di prova del quality gate; ?modo= forza completa/presenza.
  const params = new URLSearchParams(location.search);
  const modo = params.get('modo');
  const p = { ...meta.personaggio!, ...(modo === 'completa' || modo === 'presenza' ? { modo } : {}) } as NonNullable<PaintingMeta['personaggio']>;
  screen.classList.toggle('anteprima', params.has('anteprima'));
  const stage = $('.char-stage', screen);
  const subs = $('.char-subs', screen);
  const asked = $('.char-question', screen);
  const playBtn = $<HTMLButtonElement>('.char-play', screen);
  const input = $<HTMLInputElement>('.char-form input', screen);
  $('.story-title', screen).textContent = meta.title;
  $('.story-artist', screen).textContent = [meta.artist, meta.year].filter(Boolean).join(', ');
  $('.badge-demo', screen).hidden = !meta.demo;
  $('.reconstruction', screen).textContent = `Risposte preparate dal museo a partire dalle fonti: non è un'intelligenza artificiale e non registra nulla.${meta.demo ? ' Voce sintetica DEMO: Piper, voce "serena" (dataset CC-BY-4.0 di committa).' : ''} Volto animato: ricostruzione.`;

  const renderer = new FaceRenderer(stage, p);
  await renderer.load(dataUrl(meta.id, meta.image), meta.depth ? dataUrl(meta.id, meta.depth) : undefined);
  let envelopes = { hz: 25 } as Envelopes;
  if (p.inviluppi) envelopes = await fetch(dataUrl(meta.id, p.inviluppi)).then((r) => r.json()).catch(() => envelopes);
  let cues: Cue[] = [];
  if (meta.subtitles) cues = await fetch(dataUrl(meta.id, meta.subtitles)).then((r) => r.text()).then(parseVtt).catch(() => []);
  const qa = new LocalQA(p);

  // ---- Audio: presentazione o risposta, sempre sull'unico <audio> sbloccato ----
  let current: { key: string; text: string | null } = { key: 'audio', text: null };
  const opus = !!audioEl.canPlayType('audio/ogg; codecs=opus');
  const play = (key: string, ref: AudioRef | undefined, text: string | null) => {
    current = { key, text };
    subs.textContent = text ?? '';
    if (!ref) {
      audioEl.pause();
      return;
    }
    audioEl.src = dataUrl(meta.id, opus ? ref.src : ref.fallback);
    audioEl.currentTime = 0;
    void audioEl.play().catch(() => syncButton());
  };
  const intro = () => {
    asked.hidden = true;
    play('audio', meta.audio, null);
  };
  const answer = (a: Answer) => {
    asked.hidden = false;
    asked.textContent = `«${a.question}»`;
    probe.answer = a.id;
    log('answer', a.id);
    play(a.id === 'nonso' ? 'risposta-nonso' : `risposta-${a.id}`, a.audio, a.text);
  };
  const syncButton = () => {
    playBtn.textContent = audioEl.paused ? '▶' : '❚❚';
    playBtn.setAttribute('aria-label', audioEl.paused ? 'Riproduci' : 'Pausa');
  };
  const onMedia = () => syncButton();
  for (const ev of ['play', 'pause', 'ended']) audioEl.addEventListener(ev, onMedia);
  playBtn.onclick = () => (audioEl.paused ? void audioEl.play().catch(() => undefined) : audioEl.pause());
  $<HTMLButtonElement>('.char-intro', screen).onclick = intro;

  const suggest = $('.char-suggest', screen);
  suggest.replaceChildren(...qa.suggestions().map((s) => {
    const b = document.createElement('button');
    b.textContent = s.label;
    b.onclick = () => answer(qa.byId(s.id));
    return b;
  }));
  $<HTMLFormElement>('.char-form', screen).onsubmit = (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.blur();
    answer(qa.ask(text));
  };

  // ---- Sguardo e parallasse: orientamento del telefono, o il puntatore ----
  const look = { x: 0, y: 0 };
  let base: { beta: number; gamma: number } | null = null;
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  const onOrientation = (e: DeviceOrientationEvent) => {
    if (e.beta === null || e.gamma === null) return;
    base ??= { beta: e.beta, gamma: e.gamma };
    look.x = clamp((e.gamma - base.gamma) / 20);
    look.y = clamp((e.beta - base.beta) / 20);
  };
  const onPointer = (e: PointerEvent) => {
    const r = stage.getBoundingClientRect();
    look.x = clamp(((e.clientX - r.left) / r.width - 0.5) * 2);
    look.y = clamp(((e.clientY - r.top) / r.height - 0.4) * 2);
  };
  window.addEventListener('deviceorientation', onOrientation);
  stage.addEventListener('pointermove', onPointer);

  // ---- Animazione ----
  const bottom = $('.char-bottom', screen);
  const fitStage = () => {
    stage.style.bottom = `${Math.max(0, bottom.offsetHeight - 40)}px`;
    renderer.resize();
  };
  fitStage();
  const state: FaceState = { open: 0, lid: 0, gaze: { x: 0, y: 0 }, breath: 0 };
  const tilt = { x: 0, y: 0 };
  const saccade = { x: 0, y: 0 };
  let nextSaccade = 0;
  let nextBlink = performance.now() + 2500;
  let blinkStart = -1;
  let raf = 0;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    // Bocca: volume della voce nell'istante attuale, con attacco rapido e rilascio lento.
    const env = envelopes[current.key] as number[] | undefined;
    let target = 0;
    if (env && !audioEl.paused) {
      const f = audioEl.currentTime * envelopes.hz;
      const i = Math.floor(f);
      const v = ((env[i] ?? 0) * (1 - (f - i)) + (env[i + 1] ?? 0) * (f - i)) / 100;
      target = Math.pow(Math.max(0, (v - 0.12) / 0.88), 0.8);
    }
    state.open += (target - state.open) * (target > state.open ? 0.55 : 0.25);
    // Ciglia: un battito ogni 2,5-6 s, circa 160 ms.
    if (blinkStart < 0 && now > nextBlink) blinkStart = now;
    if (blinkStart >= 0) {
      const k = (now - blinkStart) / 160;
      state.lid = k >= 1 ? 0 : Math.sin(Math.PI * k);
      if (k >= 1) {
        blinkStart = -1;
        nextBlink = now + 2500 + Math.random() * 3500;
      }
    }
    // Sguardo: verso chi guarda, con piccoli movimenti naturali.
    if (now > nextSaccade) {
      saccade.x = (Math.random() - 0.5) * 0.35;
      saccade.y = (Math.random() - 0.5) * 0.2;
      nextSaccade = now + 1500 + Math.random() * 2500;
    }
    state.gaze.x += (clamp(look.x * 0.8 + saccade.x) - state.gaze.x) * 0.12;
    state.gaze.y += (clamp(look.y * 0.6 + saccade.y) - state.gaze.y) * 0.12;
    tilt.x += (look.x * 0.012 - tilt.x) * 0.06;
    tilt.y += (look.y * 0.012 - tilt.y) * 0.06;
    state.breath = 0.0016 * Math.sin((now / 4500) * Math.PI * 2);
    if (current.key === 'audio') subs.textContent = cueAt(cues, audioEl.currentTime)?.text ?? '';
    renderer.render(renderer.view(stage.clientWidth / Math.max(1, stage.clientHeight)), state, tilt);
    probe.mouth = p.modo === 'completa' ? Math.round(state.open * 100) / 100 : 0;
  };
  raf = requestAnimationFrame(frame);
  window.addEventListener('resize', fitStage);

  probe.phase = 'character';
  log('character', p.modo);
  intro();

  const handle: StoryHandle = {
    stop() {
      cancelAnimationFrame(raf);
      audioEl.pause();
      for (const ev of ['play', 'pause', 'ended']) audioEl.removeEventListener(ev, onMedia);
      window.removeEventListener('deviceorientation', onOrientation);
      window.removeEventListener('resize', fitStage);
      renderer.dispose();
    },
  };
  $<HTMLButtonElement>('.story-back', screen).onclick = () => {
    handle.stop();
    onBack();
  };
  return handle;
}
