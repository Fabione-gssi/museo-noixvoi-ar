import * as THREE from 'three';
import { makeFrame } from '../ar/ArView';
import type { ArSession } from '../ar/ArSession';
import type { PaintingMeta } from '../data';
import { log } from '../probe';

// Dettagli (versione Fase 0): ogni particolare si attiva come ritaglio
// riconosciuto da vicino, oppure tenendolo nel mirino per DWELL_MS col quadro
// intero agganciato. Il contenuto (video/audio/testo) arriva nella Fase 2.

const DWELL_MS = 1200;
const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

export function setupDettagli(meta: PaintingMeta, session: ArSession) {
  const found = new Set<string>();
  const view = session.view;
  const mainH = 1 / session.aspects[0];
  const main = view.anchor(0);
  main.add(makeFrame(1, mainH, 0xffffff));
  const centers = meta.dettagli.map((d) => {
    const c = d.crop;
    const cx = c.x + c.w / 2 - 0.5;
    const cy = (0.5 - (c.y + c.h / 2)) * mainH;
    const frame = makeFrame(c.w, c.h * mainH);
    frame.position.set(cx, cy, 0.001);
    main.add(frame);
    return { d, center: new THREE.Vector3(cx, cy, 0), edge: new THREE.Vector3(cx + c.w / 2, cy, 0) };
  });
  for (const d of meta.dettagli) if (d.targetIndex) view.anchor(d.targetIndex).add(makeFrame(1, 1 / session.aspects[d.targetIndex]));

  const progress = $('#progress');
  progress.hidden = false;
  progress.textContent = `Particolari trovati: 0/${meta.dettagli.length}`;
  $('#reticle').hidden = false;

  function discover(id: string, label: string, via: string) {
    if (found.has(id)) return;
    found.add(id);
    log(`discover:${via}`, label);
    progress.textContent = `Particolari trovati: ${found.size}/${meta.dettagli.length}`;
    const card = $('#card');
    card.querySelector('h2')!.textContent = label;
    card.querySelector('p')!.textContent = via === 'target' ? 'Riconosciuto da vicino.' : 'Trovato con il mirino.';
    card.hidden = false;
  }
  $('#card-close').onclick = () => ($('#card').hidden = true);

  const reticle = $('#reticle');
  let dwell: { id: string; since: number } | null = null;

  return {
    onFound(i: number) {
      const d = meta.dettagli.find((x) => x.targetIndex === i);
      if (d && d.trigger.includes('target')) discover(d.id, d.label, 'target');
    },
    onFrame() {
      let target: { id: string; label: string } | null = null;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      for (const { d, center, edge } of centers) {
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
      if (target && !session.locked) {
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
    },
  };
}
