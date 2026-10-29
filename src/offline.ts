// Uso senza internet. Nel sito pubblicato un service worker (sw/sw.js) salva
// l'app; i file di ogni quadro stanno in una cache "quadro-<id>" che si riempie
// in due modi: aprendo il quadro (scaricamento in sottofondo) o con il pulsante
// "Scarica tutti i quadri". Ogni cache porta l'impronta del contenuto: se il
// museo pubblica una versione nuova, la copia vecchia si butta e si riscarica.
import { dataUrl, type PaintingEntry, type PaintingIndex } from './data';
import { audioEl, mediaVideoEl } from './media';
import { log } from './probe';

const CACHE = (id: string) => `quadro-${id}`;
const MARK = (id: string) => dataUrl(id, '__versione__');
const BACKGROUND_DELAY_MS = 5000;

export const offlineSupported = () => import.meta.env.PROD && 'serviceWorker' in navigator && 'caches' in window;

/** Registra il service worker. onUpdate: una versione nuova dell'app ha preso il controllo. */
export async function registerServiceWorker(onUpdate: () => void) {
  if (!offlineSupported()) return false;
  try {
    const hadController = !!navigator.serviceWorker.controller;
    await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
    if (hadController) navigator.serviceWorker.addEventListener('controllerchange', onUpdate, { once: true });
    return true;
  } catch (e) {
    log('sw-errore', String(e));
    return false;
  }
}

/** File da scaricare: dei formati alternativi (opus/m4a, mp4/webm) solo quello che questo telefono riproduce. */
export function wantedFiles(files: [string, number][]) {
  const names = new Set(files.map(([f]) => f));
  const opus = !!audioEl.canPlayType('audio/ogg; codecs=opus');
  const webm = !!mediaVideoEl.canPlayType('video/webm; codecs="vp9, opus"');
  return files.filter(([f]) => {
    if (f.endsWith('.opus')) return opus || !names.has(f.replace(/\.opus$/, '.m4a'));
    if (f.endsWith('.m4a')) return !opus || !names.has(f.replace(/\.m4a$/, '.opus'));
    if (f.endsWith('.webm')) return webm || !names.has(f.replace(/\.webm$/, '.mp4'));
    if (f.endsWith('.mp4')) return !webm || !names.has(f.replace(/\.mp4$/, '.webm'));
    return true;
  });
}

export const paintingBytes = (p: PaintingEntry) => wantedFiles(p.files ?? []).reduce((n, [, b]) => n + b, 0);

async function mark(id: string) {
  if (!(await caches.has(CACHE(id)))) return null;
  const res = await (await caches.open(CACHE(id))).match(MARK(id));
  const [version, state] = res ? (await res.text()).split(' ') : ['', ''];
  return { version, complete: state === 'completo' };
}

export async function isDownloaded(p: PaintingEntry) {
  if (!offlineSupported()) return false;
  const m = await mark(p.id);
  return !!m?.complete && m.version === p.version;
}

const running = new Map<string, Promise<void>>();

/** Scarica i file del quadro mancanti nella sua cache. onBytes riceve i byte di ogni file pronto. */
export function downloadPainting(p: PaintingEntry, onBytes?: (bytes: number) => void) {
  const prev = running.get(p.id);
  if (prev && !onBytes) return prev;
  const job = (async () => {
    const cache = await caches.open(CACHE(p.id));
    for (const [f, b] of wantedFiles(p.files ?? [])) {
      const url = dataUrl(p.id, f);
      if (!(await cache.match(url, { ignoreVary: true }))) {
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`${url}: ${res.status}`);
        await cache.put(url, res);
      }
      onBytes?.(b);
    }
    await cache.put(MARK(p.id), new Response(`${p.version} completo`));
    log('offline', p.id);
  })();
  running.set(p.id, job);
  return job.finally(() => running.delete(p.id));
}

/** Dopo aver aperto un quadro: lo salva in sottofondo, senza disturbare l'avvio del riconoscimento. */
export function downloadInBackground(p: PaintingEntry | undefined) {
  if (!p || !offlineSupported() || !p.files) return;
  setTimeout(() => void downloadPainting(p).catch(() => undefined), BACKGROUND_DELAY_MS);
}

/**
 * Allinea le copie sul telefono all'elenco dei quadri: butta i quadri tolti e le
 * copie di versioni vecchie; i quadri che erano scaricati per intero si riscaricano.
 */
export async function reconcile(index: PaintingIndex) {
  if (!offlineSupported()) return;
  const byId = new Map(index.paintings.map((p) => [p.id, p]));
  for (const key of await caches.keys()) {
    if (!key.startsWith('quadro-')) continue;
    const p = byId.get(key.slice('quadro-'.length));
    const m = p ? await mark(p.id) : null;
    if (p && m && m.version === p.version) continue;
    await caches.delete(key);
    if (p && m?.complete) downloadInBackground(p);
  }
}

const MB = (b: number) => `${Math.max(1, Math.round(b / 1048576))} MB`;

/** Riquadro "Scarica tutti i quadri" nella schermata iniziale. */
export async function bindOfflinePanel(index: PaintingIndex, root: HTMLElement) {
  if (!offlineSupported() || !index.paintings.some((p) => p.files)) return;
  const btn = root.querySelector<HTMLButtonElement>('#offline-btn')!;
  const bar = root.querySelector<HTMLProgressElement>('#offline-progress')!;
  const note = root.querySelector<HTMLElement>('#offline-note')!;
  const total = index.paintings.reduce((n, p) => n + paintingBytes(p), 0);
  const done = async () => (await Promise.all(index.paintings.map(isDownloaded))).every(Boolean);

  const showDone = () => {
    btn.hidden = true;
    bar.hidden = true;
    note.textContent = '✓ Tutti i quadri sono sul telefono: funzionano anche senza internet.';
  };
  root.hidden = false;
  if (await done()) return showDone();
  btn.textContent = `Scarica tutti i quadri per usarli senza internet (${MB(total)})`;

  btn.onclick = async () => {
    btn.disabled = true;
    note.textContent = '';
    try {
      const est = await navigator.storage?.estimate?.();
      if (est?.quota && est.quota - (est.usage ?? 0) < total * 1.2) {
        note.textContent = 'Non c\'è abbastanza spazio libero sul telefono.';
        return;
      }
      // Chiede al browser di non cancellare i file per liberare spazio (se lo consente).
      void navigator.storage?.persist?.().catch(() => false);
      bar.hidden = false;
      bar.max = total;
      let got = 0;
      for (const p of index.paintings) {
        await downloadPainting(p, (b) => {
          got += b;
          bar.value = got;
          note.textContent = `Scarico… ${MB(got)} di ${MB(total)}`;
        });
      }
      showDone();
      markPicker(index);
    } catch {
      bar.hidden = true;
      note.textContent = 'Scaricamento interrotto: controlla la connessione e riprova.';
    } finally {
      btn.disabled = false;
    }
  };
}

/** Nell'elenco dei quadri, segna quelli disponibili senza internet. */
export async function markPicker(index: PaintingIndex) {
  if (!offlineSupported()) return;
  for (const p of index.paintings) {
    const a = document.querySelector(`#painting-list [data-id="${CSS.escape(p.id)}"]`);
    if (a && !a.querySelector('.offline-ok') && (await isDownloaded(p))) {
      const em = document.createElement('em');
      em.className = 'offline-ok';
      em.textContent = '✓ anche senza internet';
      a.append(em);
    }
  }
}
