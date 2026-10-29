import { probe } from './probe';

// Pagina ?debug=1 per le prove sul campo: versione, quadro, stato del
// riconoscimento, target agganciato, fps, ultimi eventi. "Copia rapporto"
// copia tutto (senza dati personali) per incollarlo in chat o in una mail.

export const APP_VERSION = __APP_VERSION__;

export const debugInfo = { painting: '', experience: '', maxTrack: 1 };

function state() {
  if (probe.phase === 'tracking') {
    if (probe.locked) return 'bloccato (il telefono si può abbassare)';
    return probe.tracking.length ? `agganciato: ${probe.tracking.join(', ')}` : 'cerco il quadro…';
  }
  return ({ welcome: 'schermata iniziale', story: 'racconto', character: 'personaggio', fallback: 'senza fotocamera' } as Record<string, string>)[probe.phase] ?? probe.phase;
}

function lines() {
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  const out = [
    `versione ${APP_VERSION}`,
    `quadro: ${debugInfo.painting || '—'} · ${debugInfo.experience || '—'}`,
    `stato: ${state()}`,
    `render ${probe.renderFps} fps · riconoscimento ${probe.trackerFps} fps`,
    `video ${probe.video || '—'} · maxTrack ${debugInfo.maxTrack}`,
    `primo riconoscimento: ${probe.firstFoundMs ?? '—'} ms`,
    `rete: ${navigator.onLine ? 'sì' : 'no'} · offline pronto: ${navigator.serviceWorker?.controller ? 'sì' : 'no'}${mem ? ` · memoria ${Math.round(mem.usedJSHeapSize / 1048576)} MB` : ''}`,
  ];
  if (probe.phase === 'character') out.push(`bocca ${probe.mouth.toFixed(2)} · ultima risposta: ${probe.answer || '—'}`);
  if (probe.lens) out.push(`lente: u ${probe.lens.u.toFixed(3)} v ${probe.lens.v.toFixed(3)}`);
  if (probe.error) out.push(`errore: ${probe.error}`);
  out.push('ultimi eventi:', ...probe.events.slice(-5).map((e) => `  ${(e.t / 1000).toFixed(1)} s ${e.type}${e.target ? ` ${e.target}` : ''}`));
  return out;
}

export function report() {
  return JSON.stringify({
    versione: APP_VERSION,
    quando: new Date().toISOString(),
    browser: navigator.userAgent,
    schermo: `${screen.width}x${screen.height} @${devicePixelRatio}`,
    ...debugInfo,
    stato: state(),
    probe,
  }, null, 1);
}

export function startDebug(panel: HTMLElement) {
  panel.hidden = false;
  const text = document.createElement('pre');
  const copy = document.createElement('button');
  copy.textContent = 'Copia rapporto';
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(report());
      copy.textContent = 'Copiato ✓';
    } catch {
      // Senza permesso per gli appunti: si mostra il testo da selezionare a mano.
      const area = document.createElement('textarea');
      area.value = report();
      panel.append(area);
      area.select();
      copy.textContent = 'Seleziona e copia';
    }
    setTimeout(() => (copy.textContent = 'Copia rapporto'), 2500);
  };
  // Ridotto: solo stato e fps, per non coprire il quadro durante le prove.
  let small = false;
  const toggle = document.createElement('button');
  toggle.textContent = 'Riduci';
  toggle.onclick = () => {
    small = !small;
    toggle.textContent = small ? 'Espandi' : 'Riduci';
    tick();
  };
  const buttons = document.createElement('div');
  buttons.className = 'debug-buttons';
  buttons.append(toggle, copy);
  panel.replaceChildren(text, buttons);
  const tick = () => (text.textContent = (small ? lines().slice(2, 4) : lines()).join('\n'));
  tick();
  setInterval(tick, 500);
}
