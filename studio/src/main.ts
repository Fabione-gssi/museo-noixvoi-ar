import './studio.css';
import { api, TOKEN } from './api';
import { h, initJobBar, refreshUndo, attempt } from './ui';
import { listView } from './views/list';
import { paintingView } from './views/painting';
import { publishView } from './views/publish';

// Navigazione semplice con l'hash: #/  ·  #/q/<cartella>/<scheda>  ·  #/pubblica
const view = document.getElementById('view')!;
let cleanup: (() => void) | void;

async function route() {
  cleanup?.();
  cleanup = undefined;
  view.replaceChildren(h('p.muted', {}, 'Carico…'));
  const [, page, folder, tab] = location.hash.split('/');
  try {
    if (page === 'q' && folder) cleanup = await paintingView(view, decodeURIComponent(folder), tab);
    else if (page === 'pubblica') cleanup = await publishView(view);
    else cleanup = await listView(view);
  } catch (e) {
    view.replaceChildren(h('div.panel', {}, h('h2', {}, 'Qualcosa non va'), h('p', {}, (e as Error).message), h('a.btn', { href: '#/' }, 'Torna all\'elenco')));
  }
  document.querySelectorAll('.topbar nav a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#/${page ?? ''}` || (!page && a.getAttribute('href') === '#/')));
}

if (!TOKEN) {
  view.replaceChildren(h('div.panel', {}, h('h2', {}, 'Apri lo Studio dal suo avviatore'), h('p', {}, 'Fai doppio clic su "Avvia Studio" nella cartella del progetto: si aprirà questa pagina con l\'accesso già pronto.')));
} else {
  initJobBar();
  document.getElementById('undo')!.addEventListener('click', async () => {
    const r = await attempt(() => api<{ undone: string | null }>('undo', { method: 'POST' }));
    if (r?.undone) {
      document.getElementById('toast')!.textContent = `Annullato: ${r.undone}`;
      await route();
    }
  });
  window.addEventListener('hashchange', route);
  void refreshUndo();
  void route();
}
