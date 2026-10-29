import QRCode from 'qrcode';
import { api, fileUrl, onServerEvent, type PaintingDetails } from '../api';
import { h, attempt } from '../ui';
import { simCam } from '../components/simcam';

// Anteprima: la vera app in una cornice-telefono. La "fotocamera" è quella
// simulata (immagine del quadro regolabile) oppure la webcam del computer.

export function previewPanel(d: PaintingDetails, folder: string) {
  const cam = simCam(fileUrl(folder, 'image', '&w=1600'));
  (window as unknown as { __studioSimCamera?: MediaStream }).__studioSimCamera = cam.stream;
  const frame = h('iframe.phone-screen', { title: 'Anteprima dell\'app', allow: 'camera; autoplay; fullscreen' }) as HTMLIFrameElement;
  let mode: 'sim' | 'webcam' = 'sim';
  const load = () => (frame.src = `/index.html?p=${encodeURIComponent(d.id)}&debug=1${mode === 'sim' ? '&simcam=1' : ''}&t=${Date.now()}`);
  load();

  const modeSim = h('button.btn', { 'aria-pressed': 'true', onclick: () => setMode('sim') }, 'Fotocamera simulata');
  const modeCam = h('button.btn', { 'aria-pressed': 'false', onclick: () => setMode('webcam') }, 'Webcam del computer');
  function setMode(m: 'sim' | 'webcam') {
    mode = m;
    modeSim.setAttribute('aria-pressed', String(m === 'sim'));
    modeCam.setAttribute('aria-pressed', String(m === 'webcam'));
    cam.el.hidden = m !== 'sim';
    load();
  }

  const phoneBox = h('div', {});
  const off = onServerEvent((e) => {
    if (e.event !== 'tunnel') return;
    const ev = e as { step?: string; urls?: string[]; message?: string; local?: boolean };
    if (ev.step === 'fatto' && ev.urls) void showPhone(ev.urls.map((u) => `${u}?p=${encodeURIComponent(d.id)}&diretto=1`), !!ev.local);
    else if (ev.message) phoneBox.replaceChildren(h('p.muted', {}, ev.message));
  });
  async function showPhone(urls: string[], local: boolean) {
    phoneBox.replaceChildren(
      h('p', {}, local ? 'Inquadra il codice con il telefono collegato allo stesso Wi-Fi di questo computer.' : 'Inquadra il codice con il telefono: funziona anche in rete mobile. Il link resta valido finché lo Studio è aperto (o finché premi "Chiudi").'),
      ...(await Promise.all(urls.map(async (u) => h('div.qr', {}, h('img', { src: await QRCode.toDataURL(u, { margin: 1, width: 220 }), alt: `Codice QR per ${u}` }), h('code', {}, u))))),
      local
        ? h('p.muted', {}, 'Al primo accesso il telefono avvisa che il certificato "non è attendibile": è normale per un\'anteprima locale. Tocca "Avanzate" e poi "Procedi". Se Windows chiede di consentire l\'accesso alla rete, scegli "Consenti" (rete privata).')
        : h('p.muted', {}, 'Chi conosce questo indirizzo casuale può vedere l\'anteprima mentre è attiva: chiudila quando hai finito.'),
      h('button.btn', { onclick: () => attempt(() => api('preview-link', { method: 'DELETE' }), 'Anteprima sul telefono chiusa.').then(() => phoneBox.replaceChildren()) }, 'Chiudi l\'anteprima sul telefono'));
  }

  const el = h('div.preview', {},
    h('div.phone', {}, h('div.phone-notch', {}), frame),
    h('div.panel.preview-side', {},
      h('h2', {}, 'Prova l\'app'),
      h('p.muted', {}, 'È la vera app dei visitatori con i contenuti preparati. Premi "Inizia" dentro il telefono. Se hai appena modificato qualcosa, premi prima "Prepara".'),
      h('div.row', {}, modeSim, modeCam, h('button.btn', { onclick: load }, '↻ Ricarica')),
      cam.el,
      h('h2', {}, 'Prova sul telefono'),
      h('button.btn.primary', { onclick: () => attempt(() => api('preview-link', { method: 'POST' })) }, 'Crea il link per il telefono'),
      phoneBox));
  return {
    el,
    destroy() {
      off();
      cam.destroy();
      frame.src = 'about:blank';
    },
  };
}
