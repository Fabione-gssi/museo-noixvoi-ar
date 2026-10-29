import * as THREE from 'three';
import { makeFrame } from '../ar/ArView';
import type { ArSession } from '../ar/ArSession';
import { dataUrl, type CacciaItem, type DettaglioMeta, type PaintingMeta } from '../data';
import { openDetail, closeDetail, bindDetailCard } from '../ui/detailCard';
import { getPref, setPref } from '../prefs';
import { log, probe } from '../probe';

// Caccia: una lente rivelatrice al centro dello schermo mostra il quadro
// ingrandito (dall'immagine ad alta risoluzione, mai dalla fotocamera). Gli
// elementi nascosti sono invisibili finché non entrano nella lente; tenerli
// dentro per DWELL_MS li scopre. Dopo HINT_AFTER_MS senza scoperte compare un
// luccichio verso un elemento non ancora trovato. Ordine libero, progresso
// salvato, finale quando sono tutti trovati.
//
// La stessa logica serve anche senza fotocamera: la lente si trascina col dito
// sull'immagine del quadro.

const DWELL_MS = 1000;
const HINT_AFTER_MS = 20_000;
const ZOOM = 2;
const ZOOM_FX = 3.4;
const $ = <T extends HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;

/** Dove si trova la lente: centro in coordinate dell'immagine (u, v 0-1) e raggio in "larghezze immagine". */
export interface LensPose { u: number; v: number; rW: number; sx: number; sy: number; sr: number }

interface Hunt {
  frame(pose: LensPose | null): void;
  found: Set<string>;
}

const key = (id: string) => `caccia:${id}`;
const asDetail = (it: { label: string; media: DettaglioMeta['media']; text: string }, id: string): DettaglioMeta =>
  ({ id, label: it.label, crop: { x: 0, y: 0, w: 1, h: 1 }, trigger: [], media: it.media, text: it.text });

function createHunt(meta: PaintingMeta, lensCanvas: HTMLCanvasElement, counter: HTMLElement, toScreen: (u: number, v: number) => { x: number; y: number } | null): Hunt {
  bindDetailCard();
  const c = meta.caccia!;
  const img = new Image();
  img.src = dataUrl(meta.id, meta.image);
  const ctx = lensCanvas.getContext('2d')!;
  let found: Set<string>;
  try {
    found = new Set((JSON.parse(getPref(key(meta.id), '[]')) as string[]).filter((i) => c.items.some((x) => x.id === i)));
  } catch {
    found = new Set();
  }
  const hint = $('#hunt-hint');
  const updateCounter = () => (counter.textContent = `${found.size}/${c.items.length}`);
  updateCounter();
  let dwell: { id: string; since: number } | null = null;
  let lastDiscovery = performance.now();
  let flash = 0;
  let zoom = ZOOM;

  function discover(it: CacciaItem) {
    found.add(it.id);
    setPref(key(meta.id), JSON.stringify([...found]));
    updateCounter();
    lastDiscovery = performance.now();
    flash = performance.now();
    log('discover:lente', it.label);
    hint.hidden = true;
    const done = found.size === c.items.length;
    void openDetail(meta, asDetail(it, it.id)).then(() => {
      if (!done || !c.finale) return;
      // Finale: dopo la storia dell'ultimo elemento.
      const card = $('#detail-card');
      const btn = document.createElement('button');
      btn.className = 'big finale-btn';
      btn.textContent = 'Hai trovato tutto! Ascolta il finale';
      btn.onclick = () => {
        log('finale');
        void openDetail(meta, asDetail({ label: 'Hai trovato tutto!', media: c.finale!.media, text: c.finale!.text }, 'finale'));
      };
      $('.detail-body', card).append(btn);
    });
  }

  function drawLens(p: LensPose, now: number, inside: { it: CacciaItem; d: number }[]) {
    const size = Math.round(p.sr * 2 * Math.min(2, devicePixelRatio));
    if (lensCanvas.width !== size) lensCanvas.width = lensCanvas.height = size;
    Object.assign(lensCanvas.style, { left: `${p.sx - p.sr}px`, top: `${p.sy - p.sr}px`, width: `${p.sr * 2}px`, height: `${p.sr * 2}px` });
    lensCanvas.hidden = false;
    // Gli effetti che cambiano tutta la lente valgono solo con l'elemento vicino al centro.
    const near = (fx: CacciaItem['fx']) => inside.some((x) => x.it.fx === fx && !found.has(x.it.id) && x.d < p.rW * 0.6);
    const fxZoom = near('zoom');
    zoom += ((fxZoom ? ZOOM_FX : ZOOM) - zoom) * 0.12;
    ctx.clearRect(0, 0, size, size);
    if (!img.complete || !img.naturalWidth) return;
    // Area dell'immagine mostrata: raggio della lente diviso per l'ingrandimento.
    const half = (p.rW / zoom) * img.naturalWidth;
    const cx = p.u * img.naturalWidth;
    const cy = p.v * img.naturalHeight;
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#1a1714';
    ctx.fillRect(0, 0, size, size);
    const inkActive = near('ink');
    if (inkActive) ctx.filter = 'sepia(0.8) contrast(1.1)';
    ctx.drawImage(img, cx - half, cy - half, half * 2, half * 2, 0, 0, size, size);
    ctx.filter = 'none';
    // Effetti degli elementi che sono dentro la lente.
    const k = size / (2 * half); // pixel lente per pixel immagine
    for (const { it } of inside) {
      const x = size / 2 + (it.x * img.naturalWidth - cx) * k;
      const y = size / 2 + (it.y * img.naturalHeight - cy) * k;
      const r = it.r * img.naturalWidth * k;
      const pulse = 0.6 + 0.4 * Math.sin(now / 180);
      if (found.has(it.id)) {
        ctx.strokeStyle = 'rgba(123, 216, 143, 0.9)';
        ctx.lineWidth = Math.max(2, size / 90);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (it.fx === 'glow') {
        const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.3);
        g.addColorStop(0, `rgba(255, 214, 102, ${0.55 * pulse})`);
        g.addColorStop(1, 'rgba(255, 214, 102, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r * 1.4, y - r * 1.4, r * 2.8, r * 2.8);
      } else if (it.fx === 'ink') {
        ctx.strokeStyle = 'rgba(40, 25, 10, 0.9)';
        ctx.lineWidth = Math.max(2, size / 70);
        ctx.setLineDash([size / 30, size / 60]);
        ctx.lineDashOffset = -now / 40;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 + 0.4 * pulse})`;
        ctx.lineWidth = Math.max(2, size / 100);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
    // Avanzamento della scoperta: anello che si riempie sul bordo della lente.
    if (dwell) {
      const a = Math.min(1, (now - dwell.since) / DWELL_MS);
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = Math.max(4, size / 40);
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - ctx.lineWidth / 2, -Math.PI / 2, -Math.PI / 2 + a * Math.PI * 2);
      ctx.stroke();
    }
    if (now - flash < 600) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.6 * (1 - (now - flash) / 600)})`;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function showHint(now: number) {
    // Anti-frustrazione: luccichio sull'elemento non trovato più vicino alla lente.
    const missing = c.items.filter((it) => !found.has(it.id));
    if (!missing.length || now - lastDiscovery < HINT_AFTER_MS || !$('#detail-card').hidden) {
      hint.hidden = true;
      return;
    }
    const target = missing[0];
    const s = toScreen(target.x, target.y);
    if (!s) {
      hint.hidden = true;
      return;
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const x = Math.min(vw - 24, Math.max(24, s.x));
    const y = Math.min(vh - 24, Math.max(24, s.y));
    hint.style.left = `${x}px`;
    hint.style.top = `${y}px`;
    if (hint.hidden) log('hint', target.label);
    hint.hidden = false;
  }

  return {
    found,
    frame(p) {
      const now = performance.now();
      probe.lens = p && { u: +p.u.toFixed(3), v: +p.v.toFixed(3), rW: +p.rW.toFixed(3) };
      if (!p) {
        lensCanvas.hidden = true;
        dwell = null;
        hint.hidden = true;
        return;
      }
      const aspect = meta.aspect;
      const inside: { it: CacciaItem; d: number }[] = [];
      for (const it of c.items) {
        const d = Math.hypot(it.x - p.u, (it.y - p.v) / aspect);
        if (d < p.rW + it.r) inside.push({ it, d });
      }
      drawLens(p, now, inside);
      showHint(now);
      if (!$('#detail-card').hidden) {
        dwell = null;
        return;
      }
      // Si scopre l'elemento non trovato più vicino al centro, se ben dentro la lente.
      const cand = inside.filter((x) => !found.has(x.it.id) && x.d < Math.max(x.it.r, p.rW * 0.55)).sort((a, b) => a.d - b.d)[0];
      if (!cand) dwell = null;
      else if (dwell?.id !== cand.it.id) dwell = { id: cand.it.id, since: now };
      else if (now - dwell.since >= DWELL_MS) {
        dwell = null;
        discover(cand.it);
      }
    },
  };
}

/** Caccia con la fotocamera: la lente è fissa al centro, il telefono si muove sul quadro. */
export function setupCaccia(meta: PaintingMeta, session: ArSession) {
  const view = session.view;
  const mainH = 1 / session.aspects[0];
  const main = view.anchor(0);
  main.add(makeFrame(1, mainH, 0xffffff));
  const lens = $<HTMLCanvasElement>('#lens');
  $('#hunt').hidden = false;
  const local = (u: number, v: number) => new THREE.Vector3(u - 0.5, (0.5 - v) * mainH, 0);
  const hunt = createHunt(meta, lens, $('#hunt-count'), (u, v) => view.toScreen(0, local(u, v)));

  // Segno verde (sul quadro, fuori dalla lente) per gli elementi già trovati.
  const marks = new Map<string, THREE.Mesh>();
  const syncMarks = () => {
    for (const it of meta.caccia!.items) {
      if (!hunt.found.has(it.id) || marks.has(it.id)) continue;
      const m = new THREE.Mesh(new THREE.RingGeometry(it.r * 0.85, it.r, 40), new THREE.MeshBasicMaterial({ color: 0x7bd88f, transparent: true, opacity: 0.85 }));
      m.position.copy(local(it.x, it.y)).setZ(0.002);
      main.add(m);
      marks.set(it.id, m);
    }
  };

  return {
    onFound() {},
    onFrame() {
      syncMarks();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const sx = vw / 2;
      const sy = vh * 0.45;
      const sr = meta.caccia!.lensRadius * Math.min(vw, vh * 0.75);
      const c = view.toLocal(0, sx, sy);
      const e = view.toLocal(0, sx + sr, sy);
      if (!c || !e || session.locked) return hunt.frame(null);
      hunt.frame({ u: c.x + 0.5, v: 0.5 - c.y / mainH, rW: Math.hypot(e.x - c.x, e.y - c.y), sx, sy, sr });
    },
    stop: () => {
      closeDetail();
      lens.hidden = true;
    },
  };
}

/** Senza fotocamera: immagine del quadro e lente da trascinare col dito. */
export function cacciaWithoutCamera(meta: PaintingMeta) {
  const host = $('#fallback-hunt');
  host.hidden = false;
  const pic = $<HTMLImageElement>('img', host);
  pic.src = dataUrl(meta.id, meta.image);
  const lens = $<HTMLCanvasElement>('#fallback-lens');
  const toScreen = (u: number, v: number) => {
    const b = pic.getBoundingClientRect();
    return { x: b.left + u * b.width, y: b.top + v * b.height };
  };
  const hunt = createHunt(meta, lens, $('#hunt-count-fb'), toScreen);
  let pointer: { x: number; y: number } | null = null;
  const move = (e: PointerEvent) => {
    pointer = { x: e.clientX, y: e.clientY };
  };
  pic.addEventListener('pointerdown', (e) => {
    pic.setPointerCapture(e.pointerId);
    move(e);
  });
  pic.addEventListener('pointermove', (e) => pointer && move(e));
  // La lente resta dove la si lascia (si può alzare il dito e ascoltare).
  const loop = () => {
    const b = pic.getBoundingClientRect();
    if (!b.width) return requestAnimationFrame(loop);
    pointer ??= { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    const sr = meta.caccia!.lensRadius * Math.min(window.innerWidth, window.innerHeight * 0.75);
    // Sullo schermo la lente sta un po' sopra il dito, per non coprirla.
    const sx = pointer.x;
    const sy = pointer.y - sr * 0.9;
    const u = (pointer.x - b.left) / b.width;
    const v = (pointer.y - b.top) / b.height;
    hunt.frame({ u: Math.min(1, Math.max(0, u)), v: Math.min(1, Math.max(0, v)), rW: sr / b.width, sx, sy, sr });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  (window as unknown as { __huntMove?: (u: number, v: number) => void }).__huntMove = (u, v) => {
    const b = pic.getBoundingClientRect();
    pointer = { x: b.left + u * b.width, y: b.top + v * b.height };
  };
}
