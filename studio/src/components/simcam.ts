import { h } from '../ui';

// Fotocamera simulata per l'anteprima: l'immagine del quadro appesa a una
// parete, con spostamento, zoom, inclinazione, riflesso e luce regolabili.
// Lo stream del canvas viene offerto all'app nell'iframe (stessa origine),
// che lo usa al posto della fotocamera vera quando l'indirizzo ha ?simcam=1.

export interface SimCam { el: HTMLElement; stream: MediaStream; destroy(): void }

export function simCam(imageUrl: string): SimCam {
  const canvas = h('canvas.simcam-canvas', { width: 720, height: 1280 }) as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const img = new Image();
  img.src = imageUrl;
  const s = { x: 0, y: 0, zoom: 1, tilt: 0, glare: 0, light: 1 };
  const slider = (label: string, key: keyof typeof s, min: number, max: number, step: number) => {
    const input = h('input', { type: 'range', min, max, step, value: s[key] }) as HTMLInputElement;
    input.addEventListener('input', () => (s[key] = Number(input.value)));
    return h('label.slider', {}, h('span', {}, label), input);
  };
  let raf = 0;
  const draw = () => {
    const W = canvas.width;
    const H = canvas.height;
    ctx.save();
    ctx.fillStyle = '#8a857c';
    ctx.fillRect(0, 0, W, H);
    if (img.complete && img.naturalWidth) {
      ctx.filter = `brightness(${s.light})`;
      // Il quadro occupa ~80% della larghezza a zoom 1 (distanza normale di osservazione).
      const base = (W * 0.8) / img.naturalWidth;
      const k = base * s.zoom;
      // Leggero tremolio della mano, così il tracker vede fotogrammi sempre un po' diversi.
      const t = performance.now() / 1000;
      ctx.translate(W / 2 - s.x * img.naturalWidth * k + Math.sin(t * 2.1) * 1.5, H / 2 - s.y * img.naturalHeight * k + Math.cos(t * 1.7) * 1.2);
      // Inclinazione: compressione orizzontale + leggera deformazione prospettica.
      ctx.transform(Math.cos(s.tilt), Math.sin(s.tilt) * 0.15, 0, 1, 0, 0);
      ctx.drawImage(img, (-img.naturalWidth * k) / 2, (-img.naturalHeight * k) / 2, img.naturalWidth * k, img.naturalHeight * k);
    }
    ctx.restore();
    if (s.glare > 0) {
      const g = ctx.createRadialGradient(W * 0.62, H * 0.38, 0, W * 0.62, H * 0.38, W * 0.45);
      g.addColorStop(0, `rgba(255,255,255,${s.glare})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  const stream = canvas.captureStream(30);
  const el = h('div.simcam', {},
    h('p.muted', {}, 'Fotocamera simulata: muovi i cursori per avvicinarti, inclinare il telefono o aggiungere un riflesso.'),
    slider('Destra / sinistra', 'x', -0.5, 0.5, 0.01),
    slider('Su / giù', 'y', -0.5, 0.5, 0.01),
    slider('Avvicinati', 'zoom', 0.4, 6, 0.01),
    slider('Inclinazione', 'tilt', -0.6, 0.6, 0.01),
    slider('Riflesso', 'glare', 0, 0.9, 0.01),
    slider('Luce', 'light', 0.3, 1.4, 0.01),
    h('details', {}, h('summary', {}, 'Vista della fotocamera simulata'), canvas));
  return {
    el,
    stream,
    destroy() {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}
