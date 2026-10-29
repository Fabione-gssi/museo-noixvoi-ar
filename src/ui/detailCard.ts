import { audioEl, mediaVideoEl } from '../media';
import { parseVtt, cueAt, fitToScreen, type Cue } from '../story/timeline';
import { StoryRenderer } from '../story/StoryRenderer';
import { dataUrl, type DettaglioMeta, type PaintingMeta } from '../data';
import { log } from '../probe';

// Scheda di un particolare: titolo, primo piano animato del particolare (la
// camera si avvicina piano, con parallasse e "quadro vivo"), poi il contenuto
// (pezzo dell'audio principale con sottotitoli, audio o video caricato, oppure solo testo).
// Usa gli unici elementi <audio>/<video> sbloccati al primo tap.

const $ = <T extends HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;

let cues: Cue[] | null = null;
let raf = 0;
let stopAt: number | null = null;
let closeup: { renderer: StoryRenderer; raf: number } | null = null;

/** Primo piano del particolare: dal riquadro un po' allargato fino al particolare, in `seconds`. */
async function showCloseup(meta: PaintingMeta, d: DettaglioMeta, host: HTMLElement, seconds: number) {
  const stage = document.createElement('div');
  stage.className = 'detail-stage';
  host.prepend(stage);
  const renderer = new StoryRenderer(stage);
  const mine = { renderer, raf: 0 };
  closeup = mine;
  await renderer.load(dataUrl(meta.id, meta.image), meta.depth ? dataUrl(meta.id, meta.depth) : undefined);
  if (closeup !== mine) return renderer.dispose();
  const c = d.crop;
  const started = performance.now();
  const loop = () => {
    const k = Math.min(1, (performance.now() - started) / 1000 / Math.max(4, seconds));
    const ease = 1 - Math.pow(1 - k, 2);
    // Allargato di 1,7 volte all'inizio, stretto sul particolare alla fine.
    const pad = 1.7 - 0.62 * ease;
    renderer.render(fitToScreen(c, meta.aspect, renderer.aspect, pad), Math.min(1, (performance.now() - started) / 500));
    mine.raf = requestAnimationFrame(loop);
  };
  mine.raf = requestAnimationFrame(loop);
}

function hideCloseup() {
  if (!closeup) return;
  cancelAnimationFrame(closeup.raf);
  closeup.renderer.dispose();
  closeup.renderer.renderer.domElement.parentElement?.remove();
  closeup = null;
}

async function loadCues(meta: PaintingMeta) {
  if (cues || !meta.subtitles) return cues ?? [];
  try {
    cues = parseVtt(await (await fetch(dataUrl(meta.id, meta.subtitles))).text());
  } catch {
    cues = [];
  }
  return cues;
}

export function closeDetail() {
  cancelAnimationFrame(raf);
  hideCloseup();
  stopAt = null;
  audioEl.pause();
  mediaVideoEl.pause();
  mediaVideoEl.remove();
  $('#detail-card').hidden = true;
}

/** Apre la scheda; `full` = racconto completo del quadro invece di un particolare. */
export async function openDetail(meta: PaintingMeta, d: DettaglioMeta | null) {
  closeDetail();
  const card = $('#detail-card');
  const body = $('.detail-body', card);
  const sub = $('.detail-sub', card);
  const ctl = $('.detail-controls', card);
  $('h2', card).textContent = d ? d.label : meta.title;
  $('.badge-demo', card).hidden = !meta.demo || d?.media.type === 'video';
  sub.textContent = '';
  body.replaceChildren();
  ctl.hidden = true;
  card.hidden = false;
  log('detail-open', d?.label ?? 'racconto completo');

  const media = d?.media ?? { type: 'audio' as const };
  if (media.type === 'video' && media.src) {
    mediaVideoEl.src = dataUrl(meta.id, media.src);
    mediaVideoEl.controls = true;
    mediaVideoEl.className = 'detail-video';
    body.append(mediaVideoEl);
    if (d?.text) body.append(Object.assign(document.createElement('p'), { textContent: d.text }));
    void mediaVideoEl.play().catch(() => undefined);
    return;
  }
  const realDetail = d && (d.crop.w < 1 || d.crop.h < 1);
  if (media.type === 'text' || !meta.audio) {
    body.append(Object.assign(document.createElement('p'), { className: 'detail-text', textContent: d?.text ?? '' }));
    if (realDetail) void showCloseup(meta, d, body, 8);
    return;
  }

  // Audio: file proprio del particolare, oppure un pezzo dell'audio principale.
  const own = media.src && media.fallback;
  const opus = audioEl.canPlayType('audio/ogg; codecs=opus');
  const src = own ? (opus ? media.src! : media.fallback!) : opus ? meta.audio.src : meta.audio.fallback;
  const url = dataUrl(meta.id, src);
  if (!audioEl.src.endsWith(url)) audioEl.src = url;
  const seg = !own && media.audioSegment ? media.audioSegment : null;
  const from = seg?.from ?? 0;
  stopAt = seg?.to ?? null;
  const subs = own ? [] : await loadCues(meta);
  ctl.hidden = false;
  const play = $<HTMLButtonElement>('.detail-play', ctl);
  const bar = $<HTMLElement>('.detail-progress span', ctl);
  const start = () => {
    audioEl.currentTime = from;
    void audioEl.play().catch(() => undefined);
  };
  play.onclick = () => {
    if (!audioEl.paused) audioEl.pause();
    else if (stopAt !== null && audioEl.currentTime >= stopAt - 0.05) start();
    else void audioEl.play();
  };
  $<HTMLButtonElement>('.detail-replay', ctl).onclick = start;
  const tick = () => {
    const t = audioEl.currentTime;
    if (stopAt !== null && t >= stopAt) audioEl.pause();
    const end = stopAt ?? (audioEl.duration || 1);
    bar.style.width = `${Math.min(100, Math.max(0, ((t - from) / Math.max(0.1, end - from)) * 100))}%`;
    play.textContent = audioEl.paused ? '▶' : '❚❚';
    play.setAttribute('aria-label', audioEl.paused ? 'Riproduci' : 'Pausa');
    sub.textContent = cueAt(subs, t)?.text ?? (own ? d?.text ?? '' : '');
    raf = requestAnimationFrame(tick);
  };
  if (own && d?.text) body.append(Object.assign(document.createElement('p'), { className: 'detail-text', textContent: d.text }));
  if (realDetail) void showCloseup(meta, d, body, seg ? seg.to - seg.from : 10);
  start();
  raf = requestAnimationFrame(tick);
}

export function bindDetailCard() {
  $<HTMLButtonElement>('#detail-close').onclick = closeDetail;
}
