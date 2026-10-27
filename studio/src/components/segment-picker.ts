import { h, formatTime } from '../ui';
import type { Alignment } from '../api';

// Selettore di segmenti audio, usato da tutti gli editor: onda sonora +
// trascrizione allineata. Si selezionano le parole col mouse o col dito
// (trascinando) e si ottiene un intervallo da-a da ascoltare prima di confermare.

export interface SegmentPicker {
  el: HTMLElement;
  audio: HTMLAudioElement;
  /** Istante corrente (s): il punto scelto cliccando sull'onda o su una parola. */
  time(): number;
  selection(): { from: number; to: number } | null;
  seek(t: number): void;
  destroy(): void;
}

export function segmentPicker(audioUrl: string, alignment: Alignment | null, onChange?: (sel: { from: number; to: number } | null, time: number) => void): SegmentPicker {
  const audio = h('audio', { src: audioUrl, preload: 'auto' }) as HTMLAudioElement;
  const canvas = h('canvas.wave', { height: 90, 'aria-label': 'Onda sonora: clicca per scegliere un istante' }) as HTMLCanvasElement;
  const info = h('span.muted', {}, 'Clicca sull\'onda o seleziona delle parole');
  const words = h('div.words', { 'aria-label': 'Trascrizione: trascina per selezionare' });
  let peaks: Float32Array | null = null;
  let sel: { from: number; to: number } | null = null;
  let stopAt: number | null = null;
  let raf = 0;

  const flat = alignment?.sentences.flatMap((s) => s.words) ?? [];
  const spans = flat.map((w, i) => h('span.word', { 'data-i': i }, w.w));
  words.append(...spans);
  if (!flat.length) words.append(h('p.muted', {}, 'La trascrizione allineata comparirà dopo "Prepara".'));

  const duration = () => audio.duration || alignment?.durationSec || 1;

  // Selezione delle parole: premi su una parola e trascina fino all'ultima.
  let anchor: number | null = null;
  const indexAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    return el?.dataset.i !== undefined ? Number(el.dataset.i) : null;
  };
  const applyRange = (a: number, b: number) => {
    const [i, j] = a <= b ? [a, b] : [b, a];
    sel = { from: flat[i].start, to: flat[j].end };
    spans.forEach((s, k) => s.classList.toggle('sel', k >= i && k <= j));
    update();
  };
  words.addEventListener('pointerdown', (e) => {
    const i = indexAt(e.clientX, e.clientY);
    if (i === null) return;
    anchor = i;
    words.setPointerCapture(e.pointerId);
    applyRange(i, i);
    audio.currentTime = flat[i].start;
  });
  words.addEventListener('pointermove', (e) => {
    if (anchor === null) return;
    const i = indexAt(e.clientX, e.clientY);
    if (i !== null) applyRange(anchor, i);
  });
  words.addEventListener('pointerup', () => (anchor = null));

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    audio.currentTime = ((e.clientX - r.left) / r.width) * duration();
    update();
  });

  const playSel = h('button.btn', {
    onclick: () => {
      if (!sel) return;
      audio.currentTime = sel.from;
      stopAt = sel.to;
      void audio.play();
    },
  }, '▶ Ascolta la selezione');
  const playPause = h('button.btn', { onclick: () => (audio.paused ? (stopAt = null, void audio.play()) : audio.pause()) }, '▶/❚❚ Riproduci');

  function update() {
    info.textContent = sel ? `Selezione: da ${formatTime(sel.from)} a ${formatTime(sel.to)} · Istante: ${formatTime(audio.currentTime)}` : `Istante: ${formatTime(audio.currentTime)}`;
    onChange?.(sel, audio.currentTime);
  }

  function draw() {
    const w = (canvas.width = canvas.clientWidth * devicePixelRatio || 600);
    const hgt = canvas.height;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, w, hgt);
    const d = duration();
    if (sel) {
      ctx.fillStyle = 'rgba(255, 196, 0, 0.3)';
      ctx.fillRect((sel.from / d) * w, 0, ((sel.to - sel.from) / d) * w, hgt);
    }
    ctx.fillStyle = '#8a8170';
    if (peaks) {
      for (let x = 0; x < w; x++) {
        const v = peaks[Math.floor((x / w) * peaks.length)] * (hgt / 2 - 2);
        ctx.fillRect(x, hgt / 2 - v, 1, v * 2 || 1);
      }
    }
    ctx.fillStyle = '#d64545';
    ctx.fillRect((audio.currentTime / d) * w - 1, 0, 2, hgt);
    const t = audio.currentTime;
    const cur = flat.findIndex((x) => t >= x.start && t < x.end);
    spans.forEach((s, k) => s.classList.toggle('now', k === cur));
    if (stopAt !== null && t >= stopAt) {
      audio.pause();
      stopAt = null;
    }
    raf = requestAnimationFrame(draw);
  }

  // Onda sonora: picchi calcolati decodificando l'audio nel browser.
  void fetch(audioUrl)
    .then((r) => r.arrayBuffer())
    .then((b) => new AudioContext().decodeAudioData(b))
    .then((buf) => {
      const ch = buf.getChannelData(0);
      const n = 1200;
      peaks = new Float32Array(n);
      const step = Math.floor(ch.length / n);
      for (let i = 0; i < n; i++) {
        let m = 0;
        for (let k = i * step; k < (i + 1) * step; k += 16) m = Math.max(m, Math.abs(ch[k]));
        peaks[i] = m;
      }
    })
    .catch(() => undefined);
  audio.addEventListener('timeupdate', update);
  raf = requestAnimationFrame(draw);

  const el = h('div.segment-picker', {}, canvas, h('div.row', {}, playPause, playSel, info), words, audio);
  return {
    el,
    audio,
    time: () => audio.currentTime,
    selection: () => sel,
    seek: (t) => {
      audio.currentTime = t;
      update();
    },
    destroy: () => {
      cancelAnimationFrame(raf);
      audio.pause();
    },
  };
}
