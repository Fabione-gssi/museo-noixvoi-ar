import * as THREE from 'three';
import { makeFrame } from '../ar/ArView';
import type { ArSession } from '../ar/ArSession';
import { dataUrl, type DettaglioMeta, type PaintingMeta } from '../data';
import { openDetail, closeDetail, bindDetailCard } from '../ui/detailCard';
import { getPref, setPref } from '../prefs';
import { log } from '../probe';

// Dettagli: ogni particolare si attiva in due modi.
// - Ritaglio riconosciuto da vicino (target proprio nel set del quadro).
// - Mirino: col quadro intero agganciato, tenere il particolare nel cerchio
//   centrale per DWELL_MS.
// Al riconoscimento: anello di conferma sul quadro, poi la scheda col contenuto.
// La schermata "Trova i particolari" mostra miniature e avanzamento.

const DWELL_MS = 1200;
const RING_MS = 900;
const $ = <T extends HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;

const foundKey = (id: string) => `trovati:${id}`;
function loadFound(meta: PaintingMeta) {
  try {
    const ids = JSON.parse(getPref(foundKey(meta.id), '[]')) as string[];
    return new Set(ids.filter((i) => meta.dettagli.some((d) => d.id === i)));
  } catch {
    return new Set<string>();
  }
}

/** Schermata "Trova i N particolari": miniature con segno di spunta e avanzamento. */
function renderFindList(meta: PaintingMeta, found: Set<string>, host: HTMLElement, onPick: (d: DettaglioMeta) => void) {
  const n = meta.dettagli.length;
  $('.find-count', host).textContent = `${found.size}/${n}`;
  $('.find-title', host).textContent = found.size === n ? `Hai trovato tutti i ${n} particolari!` : `Trova i ${n} particolari`;
  $('.find-list', host).replaceChildren(
    ...meta.dettagli.map((d) => {
      const b = document.createElement('button');
      b.className = `find-item${found.has(d.id) ? ' found' : ''}`;
      b.setAttribute('aria-label', found.has(d.id) ? `${d.label}: trovato, riascolta` : `${d.label}: da trovare`);
      b.innerHTML = '<img alt="" /><span></span>';
      (b.querySelector('img') as HTMLImageElement).src = dataUrl(meta.id, d.thumb ?? d.image ?? meta.image);
      b.querySelector('span')!.textContent = d.label;
      b.onclick = () => onPick(d);
      return b;
    }),
  );
}

export function setupDettagli(meta: PaintingMeta, session: ArSession) {
  bindDetailCard();
  const found = loadFound(meta);
  const view = session.view;
  const mainH = 1 / session.aspects[0];
  const main = view.anchor(0);
  main.add(makeFrame(1, mainH, 0xffffff));

  const items = meta.dettagli.map((d) => {
    const c = d.crop;
    const cx = c.x + c.w / 2 - 0.5;
    const cy = (0.5 - (c.y + c.h / 2)) * mainH;
    const frame = makeFrame(c.w, c.h * mainH, found.has(d.id) ? 0x7bd88f : 0xffd166);
    frame.position.set(cx, cy, 0.001);
    main.add(frame);
    return { d, frame, center: new THREE.Vector3(cx, cy, 0), edge: new THREE.Vector3(cx + c.w / 2, cy, 0) };
  });
  for (const d of meta.dettagli) if (d.targetIndex) view.anchor(d.targetIndex).add(makeFrame(1, 1 / session.aspects[d.targetIndex], 0x7bd88f));

  // Anello di conferma: cresce e svanisce sul particolare appena trovato.
  const rings: { mesh: THREE.Mesh; born: number }[] = [];
  function ring(d: DettaglioMeta) {
    const it = items.find((x) => x.d.id === d.id)!;
    const r = Math.max(d.crop.w, d.crop.h * mainH) * 0.6;
    const mesh = new THREE.Mesh(new THREE.RingGeometry(r * 0.9, r, 48), new THREE.MeshBasicMaterial({ color: 0x7bd88f, transparent: true }));
    mesh.position.copy(it.center).setZ(0.002);
    main.add(mesh);
    rings.push({ mesh, born: performance.now() });
  }

  const panel = $('#find');
  panel.hidden = false;
  const refresh = () => renderFindList(meta, found, panel, pick);
  function pick(d: DettaglioMeta) {
    if (found.has(d.id)) void openDetail(meta, d);
    else {
      $('#status').textContent = `Cerca: ${d.label}`;
      log('hint', d.label);
    }
  }
  refresh();
  $<HTMLButtonElement>('#find-full').onclick = () => void openDetail(meta, null);
  $<HTMLButtonElement>('#find-toggle').onclick = () => panel.classList.toggle('collapsed');

  function discover(d: DettaglioMeta, via: string) {
    const again = found.has(d.id);
    log(`discover:${via}`, d.label);
    if (!again) {
      found.add(d.id);
      setPref(foundKey(meta.id), JSON.stringify([...found]));
      (items.find((x) => x.d.id === d.id)!.frame.material as THREE.MeshBasicMaterial).color.set(0x7bd88f);
      refresh();
    }
    ring(d);
    setTimeout(() => void openDetail(meta, d), again ? 0 : RING_MS);
  }

  const reticle = $('#reticle');
  reticle.hidden = false;
  let dwell: { id: string; since: number } | null = null;
  const cardOpen = () => !$('#detail-card').hidden;

  return {
    onFound(i: number) {
      const d = meta.dettagli.find((x) => x.targetIndex === i);
      // Un particolare nuovo si apre anche se c'è già una scheda aperta (es. la
      // firma sopra lo specchio); uno già trovato non interrompe l'ascolto.
      if (d && d.trigger.includes('target') && (!cardOpen() || !found.has(d.id))) discover(d, 'target');
    },
    onFrame() {
      const now = performance.now();
      for (let k = rings.length - 1; k >= 0; k--) {
        const a = (now - rings[k].born) / RING_MS;
        rings[k].mesh.scale.setScalar(1 + a * 0.6);
        (rings[k].mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - a);
        if (a >= 1) {
          main.remove(rings[k].mesh);
          rings[k].mesh.geometry.dispose();
          rings.splice(k, 1);
        }
      }
      // Mirino: solo particolari non ancora trovati, con la scheda chiusa.
      let target: DettaglioMeta | null = null;
      if (!cardOpen() && !session.locked) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        for (const { d, center, edge } of items) {
          if (found.has(d.id) || !d.trigger.includes('reticle')) continue;
          const p = view.toScreen(0, center);
          const e = view.toScreen(0, edge);
          if (!p || !e) break;
          const dist = Math.hypot(p.x - vw / 2, p.y - vh / 2);
          const halfWidth = Math.abs(e.x - p.x);
          if (dist < Math.max(56, halfWidth * 0.8) && halfWidth * 2 > vw * 0.18) {
            target = d;
            break;
          }
        }
      }
      if (target) {
        if (dwell?.id !== target.id) dwell = { id: target.id, since: now };
        const k = Math.min(1, (now - dwell.since) / DWELL_MS);
        reticle.style.setProperty('--k', String(k));
        reticle.classList.add('active');
        if (k >= 1) {
          discover(target, 'reticle');
          dwell = null;
        }
      } else {
        dwell = null;
        reticle.classList.remove('active');
        reticle.style.setProperty('--k', '0');
      }
    },
    stop: closeDetail,
  };
}

/** Senza fotocamera: immagine del quadro e particolari da toccare (ripiego manuale). */
export function dettagliWithoutCamera(meta: PaintingMeta) {
  bindDetailCard();
  const found = new Set(meta.dettagli.map((d) => d.id));
  const host = $('#fallback-find');
  renderFindList(meta, found, host, (d) => void openDetail(meta, d));
  $('.find-title', host).textContent = 'Tocca un particolare';
  $<HTMLButtonElement>('#fallback-full').onclick = () => void openDetail(meta, null);
}
