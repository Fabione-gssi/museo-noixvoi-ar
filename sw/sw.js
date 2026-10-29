// Service worker del sito dei visitatori: rende l'app utilizzabile senza internet.
// Generato da vite.config.ts al momento della costruzione del sito: __VERSION__ e
// __PRECACHE__ vengono sostituiti con l'impronta e l'elenco dei file dell'app.
//
// - App (pagina, codice, icone): salvata subito all'installazione ("precache").
// - Elenco dei quadri e meta.json: prima la rete (per gli aggiornamenti), poi la copia.
// - Altri file dei quadri: prima la copia, poi la rete; ogni file scaricato resta
//   nella cache del suo quadro ("quadro-<id>"), gestita anche dalla pagina (src/offline.ts).
// - Audio e video: le richieste parziali (Range, usate da Safari) ricevono la parte
//   richiesta del file salvato, altrimenti iOS non li riproduce.

const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const SHELL = `app-${VERSION}`;
const KEEP_SHELLS = 3;
const SCOPE = new URL(self.registration.scope);
const DATA = new URL('data/', SCOPE).pathname;
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await cache.addAll(PRECACHE.map((f) => new Request(new URL(f, SCOPE), { cache: 'reload' })));
    // Alla prima visita la pagina ha già letto l'elenco dei quadri senza passare di qui.
    await caches.open('dati').then((c) => c.add(new Request(new URL('data/index.json', SCOPE), { cache: 'reload' }))).catch(() => undefined);
    await self.skipWaiting();
  })());
});

// Le versioni precedenti dell'app restano per un po': una pagina già aperta può
// ancora chiedere un pezzo di codice della sua versione (es. il riconoscimento).
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const book = await caches.open('versioni');
    const old = await book.match('elenco');
    const list = [...(old ? await old.json() : []).filter((v) => v !== SHELL), SHELL].slice(-KEEP_SHELLS);
    await book.put('elenco', new Response(JSON.stringify(list)));
    for (const key of await caches.keys()) if (key.startsWith('app-') && !list.includes(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;

  if (url.pathname.startsWith(DATA)) {
    const rest = url.pathname.slice(DATA.length).split('/');
    const id = rest.length > 1 ? decodeURIComponent(rest[0]) : '';
    const isJson = url.pathname.endsWith('/index.json') || url.pathname.endsWith('/meta.json');
    event.respondWith(isJson ? networkFirst(req, id ? `quadro-${id}` : 'dati') : cacheFirst(req, id ? `quadro-${id}` : 'dati'));
    return;
  }
  if (req.mode === 'navigate') {
    const page = url.pathname === SCOPE.pathname || url.pathname === `${SCOPE.pathname}index.html`;
    if (page) event.respondWith(fromShell(new URL('index.html', SCOPE), req));
    return;
  }
  event.respondWith(fromShell(req, req));
});

async function fromShell(key, req) {
  return (await caches.match(key, { ignoreSearch: true, ignoreVary: true })) ?? fetch(req);
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const network = fetch(req).then(async (res) => {
    if (res.ok) await cache.put(req.url.split('?')[0], res.clone());
    return res;
  });
  network.catch(() => {});
  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS, null));
  try {
    const res = await Promise.race([network, timeout]);
    if (res) return res;
  } catch {
    // Senza rete: si usa la copia.
  }
  return (await cache.match(req, { ignoreSearch: true, ignoreVary: true })) ?? network;
}

async function cacheFirst(req, cacheName) {
  const hit = await caches.match(req, { ignoreSearch: true, ignoreVary: true });
  const range = req.headers.get('range');
  if (hit) return range ? partial(hit, range) : hit;
  // Senza copia: le richieste parziali vanno alla rete così come sono.
  if (range) return fetch(req);
  const res = await fetch(req);
  if (res.ok && res.status === 200) {
    const cache = await caches.open(cacheName);
    await cache.put(req.url.split('?')[0], res.clone());
  }
  return res;
}

/** Risposta 206 con la parte richiesta ("bytes=inizio-fine") del file salvato. */
async function partial(res, range) {
  const buf = await res.arrayBuffer();
  const size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  let start = 0;
  let end = size - 1;
  if (m && m[1]) {
    start = Number(m[1]);
    if (m[2]) end = Math.min(Number(m[2]), size - 1);
  } else if (m && m[2]) {
    start = Math.max(0, size - Number(m[2]));
  }
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'application/octet-stream',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}
