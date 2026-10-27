import { h } from '../ui';
import type { Rect } from '../api';

// Rettangoli disegnati sull'immagine del quadro (coordinate 0-1, nessun numero
// da scrivere). Trascinando fuori dal riquadro selezionato se ne disegna uno
// nuovo al suo posto; trascinando dentro lo si sposta; l'angolo in basso a
// destra lo ridimensiona.

export interface RectItem { rect: Rect; label: string }

export interface RectEditor {
  el: HTMLElement;
  /** Ridisegna con l'elenco e la selezione correnti. */
  render(items: RectItem[], selected: number): void;
}

export const isFull = (r: Rect) => r.x <= 0.001 && r.y <= 0.001 && r.w >= 0.999 && r.h >= 0.999;
export const roundRect = (r: Rect): Rect => ({ x: +r.x.toFixed(4), y: +r.y.toFixed(4), w: +r.w.toFixed(4), h: +r.h.toFixed(4) });

export function rectEditor(imageUrl: string, onChange: (index: number, rect: Rect) => void): RectEditor {
  const img = h('img', { src: imageUrl, alt: '', draggable: false });
  const layer = h('div.rect-layer', {});
  const stage = h('div.rect-stage', {}, img, layer);
  let items: RectItem[] = [];
  let selected = 0;
  let drag: null | { mode: 'draw' | 'move' | 'resize'; x0: number; y0: number; start: Rect } = null;

  const pos = (e: PointerEvent) => {
    const b = stage.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)) };
  };

  stage.addEventListener('pointerdown', (e) => {
    if (!items[selected]) return;
    const p = pos(e);
    const r = items[selected].rect;
    const resize = (e.target as HTMLElement).classList.contains('rect-handle');
    const inside = p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h && !isFull(r);
    drag = { mode: resize ? 'resize' : inside ? 'move' : 'draw', x0: p.x, y0: p.y, start: { ...r } };
    stage.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = pos(e);
    const s = drag.start;
    let r: Rect;
    if (drag.mode === 'move') r = { ...s, x: Math.min(1 - s.w, Math.max(0, s.x + p.x - drag.x0)), y: Math.min(1 - s.h, Math.max(0, s.y + p.y - drag.y0)) };
    else if (drag.mode === 'resize') r = { ...s, w: Math.max(0.02, Math.min(1 - s.x, p.x - s.x)), h: Math.max(0.02, Math.min(1 - s.y, p.y - s.y)) };
    else r = { x: Math.min(p.x, drag.x0), y: Math.min(p.y, drag.y0), w: Math.max(0.02, Math.abs(p.x - drag.x0)), h: Math.max(0.02, Math.abs(p.y - drag.y0)) };
    items[selected].rect = r;
    onChange(selected, r);
    draw();
  });
  stage.addEventListener('pointerup', () => (drag = null));

  function draw() {
    layer.replaceChildren(...items.map((it, i) => {
      const r = it.rect;
      return h('div.rect', { class: i === selected ? 'selected' : '', style: `left:${r.x * 100}%;top:${r.y * 100}%;width:${r.w * 100}%;height:${r.h * 100}%` },
        h('span', {}, it.label),
        i === selected && !isFull(r) ? h('i.rect-handle', { title: 'Trascina per ridimensionare' }) : null);
    }));
  }

  return {
    el: stage,
    render(next, sel) {
      items = next;
      selected = sel;
      draw();
    },
  };
}
