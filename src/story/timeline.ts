// Logica pura del racconto automatico: dall'istante dell'audio all'inquadratura.

export interface Rect { x: number; y: number; w: number; h: number }
export interface Keyframe { t: number; action: 'cameraTo' | 'highlight'; args: { rect?: Rect; label?: string; id?: string } }

export const FULL: Rect = { x: 0, y: 0, w: 1, h: 1 };
const TRANSITION = 2.4; // secondi di movimento tra un'inquadratura e la successiva

const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpRect = (a: Rect, b: Rect, k: number): Rect => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k) });

/** Indice dell'ultimo fotogramma chiave con t <= time (-1 se nessuno). */
export function keyIndexAt(timeline: Keyframe[], time: number) {
  let i = -1;
  for (let k = 0; k < timeline.length; k++) if (timeline[k].t <= time) i = k;
  return i;
}

/**
 * Inquadratura (in coordinate normalizzate dell'immagine) all'istante `time`:
 * movimento morbido dal fotogramma precedente al corrente, poi un leggerissimo
 * avvicinamento continuo per non lasciare l'immagine ferma.
 */
export function rectAt(timeline: Keyframe[], time: number): Rect {
  const cams = timeline.filter((k) => k.action === 'cameraTo' && k.args.rect);
  const i = keyIndexAt(cams, time);
  if (i < 0) return FULL;
  const cur = cams[i].args.rect!;
  const prev = i > 0 ? cams[i - 1].args.rect! : cur;
  const since = time - cams[i].t;
  const moved = since < TRANSITION ? lerpRect(prev, cur, ease(since / TRANSITION)) : cur;
  const nextT = cams[i + 1]?.t ?? Infinity;
  const hold = Math.min(since, nextT - cams[i].t, 20);
  const drift = 1 - Math.min(0.06, hold * 0.004); // "Ken Burns" lento
  return scaleAround(moved, drift);
}

function scaleAround(r: Rect, s: number): Rect {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  return { x: cx - (r.w * s) / 2, y: cy - (r.h * s) / 2, w: r.w * s, h: r.h * s };
}

/**
 * Allarga il rettangolo per avere le proporzioni dello schermo (con margine),
 * così il particolare è tutto visibile. `imageAspect` e `screenAspect` = larghezza/altezza.
 */
export function fitToScreen(r: Rect, imageAspect: number, screenAspect: number, pad = 1.12): Rect {
  let w = r.w * pad;
  let h = r.h * pad;
  // Rapporto del rettangolo in pixel reali dell'immagine.
  const rectAspect = (w * imageAspect) / h;
  if (rectAspect > screenAspect) h = (w * imageAspect) / screenAspect;
  else w = (h * screenAspect) / imageAspect;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  // Se sta dentro l'immagine evita di uscire dai bordi; se è più grande, resta centrato (bande scure).
  const x = w <= 1 ? Math.min(Math.max(cx - w / 2, 0), 1 - w) : cx - w / 2;
  const y = h <= 1 ? Math.min(Math.max(cy - h / 2, 0), 1 - h) : cy - h / 2;
  return { x, y, w, h };
}

export interface Cue { start: number; end: number; text: string }

/** Parser WebVTT minimo (solo i tempi e il testo dei sottotitoli). */
export function parseVtt(src: string): Cue[] {
  const toSec = (s: string) => {
    const p = s.trim().split(':').map(Number);
    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
  };
  const cues: Cue[] = [];
  for (const block of src.replace(/\r/g, '').split(/\n\n+/)) {
    const lines = block.split('\n');
    const ti = lines.findIndex((l) => l.includes('-->'));
    if (ti < 0) continue;
    const [a, b] = lines[ti].split('-->');
    cues.push({ start: toSec(a), end: toSec(b.trim().split(/\s+/)[0]), text: lines.slice(ti + 1).join('\n').trim() });
  }
  return cues;
}

export const cueAt = (cues: Cue[], t: number) => cues.find((c) => t >= c.start && t < c.end) ?? null;
