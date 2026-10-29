import QRCode from 'qrcode';
import { api, onServerEvent, type PaintingSummary } from '../api';
import { h, attempt, confirmDialog, toast, refreshUndo } from '../ui';

// Verifica e pubblicazione: rapporto in italiano, lista delle cose da fare,
// pubblicazione con URL e QR stampabili, cartella per Cloudflare.

interface Version { sha: string; at: string; message: string; paintings: string[] }
interface Versions { available: boolean; versions: Version[]; changed: boolean }

interface Report { at: string; ok: boolean; steps: { label: string; ok: boolean; detail?: string }[]; problems: { id: string; message: string }[] }

export async function publishView(root: HTMLElement) {
  const [todo, report, list] = await Promise.all([
    api<{ markdown: string; problems: { id: string; message: string }[]; checked: Record<string, boolean> }>('todo'),
    api<Report | null>('report'),
    api<{ paintings: PaintingSummary[] }>('paintings'),
  ]);
  const checked = todo.checked;

  const verifyBox = h('div.panel', {}, h('h2', {}, '1. Verifica tutto'), h('p.muted', {}, 'Prepara tutti i quadri, controlla i dati e prova l\'app con una fotocamera simulata. Ci vogliono alcuni minuti.'));
  const steps = h('ul.steps', {});
  const runVerify = h('button.btn.primary.big', { onclick: () => attempt(() => api('verify', { method: 'POST' })) }, 'Verifica tutto');
  verifyBox.append(runVerify, steps);
  const showReport = (r: Report | null) => {
    steps.replaceChildren();
    if (!r) return;
    steps.append(
      h('li', { class: r.ok ? 'ok' : 'ko' }, r.ok ? `Tutto a posto (${new Date(r.at).toLocaleString('it-IT')}).` : `Ci sono problemi (${new Date(r.at).toLocaleString('it-IT')}):`),
      ...r.steps.map((s) => h('li', { class: s.ok ? 'ok' : 'ko' }, `${s.ok ? '✅' : '❌'} ${s.label}`, s.detail ? h('small', {}, ` — ${s.detail}`) : null)));
  };
  showReport(report);

  // Cose da fare: avvisi della pipeline (spuntabili) + DA_FARE_UTENTE.md.
  const saveChecks = () => api('todo', { method: 'PUT', body: { checked } });
  const todoBox = h('div.panel', {}, h('h2', {}, 'Cose da fare'),
    todo.problems.length
      ? h('ul.todo', {}, todo.problems.map((p) => {
          const key = `${p.id}:${p.message}`;
          const cb = h('input', { type: 'checkbox', checked: !!checked[key] }) as HTMLInputElement;
          cb.addEventListener('change', () => {
            checked[key] = cb.checked;
            void saveChecks();
          });
          return h('li', {}, h('label.check', {}, cb, h('span', {}, h('strong', {}, p.id), `: ${p.message}`)));
        }))
      : h('p.muted', {}, 'Nessun avviso dai contenuti.'),
    h('details', {}, h('summary', {}, 'Elenco completo (DA_FARE_UTENTE.md)'), renderMarkdown(todo.markdown, checked, saveChecks)));

  const pubBox = h('div.panel', {}, h('h2', {}, '2. Pubblica'),
    h('p.muted', {}, 'Salva le modifiche su GitHub e aggiorna il sito dei visitatori (1-2 minuti).'));
  const pubLog = h('div.publog', {});
  pubBox.append(
    h('div.row', {},
      h('button.btn.primary.big', { onclick: () => attempt(() => api('publish', { method: 'POST' })) }, 'Pubblica'),
      h('button.btn', { onclick: () => attempt(() => api('zip', { method: 'POST' })), title: 'Alternativa senza GitHub' }, 'Crea la cartella per Cloudflare Pages')),
    pubLog);

  const off = onServerEvent(async (e) => {
    if (e.event === 'verify') {
      const ev = e as unknown as { step: string; state: string; detail?: string };
      if (ev.state === 'start') steps.append(h('li', {}, `⏳ ${ev.step}…`));
      else steps.lastElementChild?.replaceWith(h('li', { class: ev.state === 'ok' ? 'ok' : 'ko' }, `${ev.state === 'ok' ? '✅' : '❌'} ${ev.step}`, ev.detail ? h('small', {}, ` — ${ev.detail}`) : null));
    }
    if (e.event === 'job' && e.name === 'verifica' && e.state === 'done') showReport(e.result as Report);
    if (e.event === 'job' && e.name === 'verifica' && e.state === 'start') steps.replaceChildren();
    if (e.event === 'job' && e.name === 'pubblica' && e.state === 'done') void history.refresh();
    if (e.event === 'publish') {
      const ev = e as unknown as { step: string; message: string; url?: string; file?: string; detail?: string };
      pubLog.append(h('p', {}, ev.message));
      if (ev.step === 'login') pubLog.append(loginHelp());
      if (ev.url) pubLog.append(await qrSheet(ev.url, list.paintings));
      if (ev.file) pubLog.append(h('div', {}, h('p', {}, `File pronto: ${ev.file}`), cloudflareHelp()));
    }
  });

  const history = historyPanel();
  const assistant = await assistantPanel();
  root.replaceChildren(h('h1', {}, 'Verifica e pubblica'), h('div.split', {}, h('div', {}, verifyBox, pubBox, history.el, assistant.el), todoBox));
  void history.refresh();
  return () => {
    off();
    assistant.destroy();
  };
}

/**
 * Assistente online dei personaggi (Cloudflare Workers AI, gratuito): lo
 * pubblica sull'account Cloudflare del museo e ne salva l'indirizzo, che
 * entra nell'app alla prossima pubblicazione.
 */
async function assistantPanel() {
  const { url } = await api<{ url: string }>('assistant');
  const input = h('input.input', { value: url, placeholder: 'https://museo-assistente.<nome>.workers.dev/', 'aria-label': 'Indirizzo dell’assistente online' }) as HTMLInputElement;
  const status = h('p', {});
  const log = h('div.publog', {});
  const showStatus = (u: string) => (status.textContent = u ? `✅ Collegato: ${u}. Entra nell'app alla prossima pubblicazione.` : 'Non collegato: alle domande libere il personaggio legge il paragrafo del testo del museo.');
  showStatus(url);
  const off = onServerEvent((e) => {
    if (e.event === 'assistente') {
      const ev = e as unknown as { text?: string };
      if (ev.text) log.append(h('p', {}, ev.text));
    }
    if (e.event === 'job' && e.name === 'assistente' && e.state === 'done') {
      const u = (e.result as { url: string }).url;
      input.value = u;
      showStatus(u);
      toast('Assistente pubblicato e collegato. Ora premi "Pubblica".');
    }
    if (e.event === 'job' && e.name === 'assistente' && e.state === 'error') log.append(h('p.ko', {}, `❌ ${e.message}`));
  });
  const el = h('div.panel', {}, h('h2', {}, '4. Assistente online dei personaggi'),
    h('p.muted', {}, 'Facoltativo. Con internet, alle domande non previste il personaggio risponde con frasi brevi preparate da un modello linguistico open source (Cloudflare Workers AI, piano gratuito), usando solo il testo completo del museo. Le domande arrivano a Cloudflare senza dati personali.'),
    h('ol', {},
      h('li', {}, 'Premi "Pubblica l’assistente". La prima volta si apre il browser: accedi a Cloudflare, o crea un account gratuito, e consenti l’accesso.'),
      h('li', {}, 'Quando compare "Collegato", premi "Pubblica" qui sopra: l’app dei visitatori inizia a usarlo.')),
    h('div.row', {},
      h('button.btn.primary', { onclick: () => attempt(() => api('assistant/deploy', { method: 'POST' })) }, 'Pubblica l’assistente'),
      input,
      h('button.btn', { onclick: () => attempt(() => api<{ url: string }>('assistant', { method: 'PUT', body: { url: input.value.trim() } }).then((r) => showStatus(r.url)), 'Indirizzo salvato.') }, 'Salva l’indirizzo')),
    status, log);
  return { el, destroy: off };
}

/** Cronologia delle pubblicazioni con "Ripristina questa versione". */
function historyPanel() {
  const list = h('ol.versions', {});
  const el = h('div.panel', {}, h('h2', {}, '3. Cronologia delle pubblicazioni'),
    h('p.muted', {}, 'Ogni pubblicazione è una versione del sito. Puoi riportare i contenuti com’erano in una versione precedente: le modifiche attuali restano tra le copie di sicurezza (↶ Annulla).'),
    list);
  const fmt = (at: string) => new Date(at).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' });

  const restore = async (v: Version, online: boolean) => {
    const text = online
      ? `Togliere le modifiche non ancora pubblicate e tornare ai contenuti che sono online (${fmt(v.at)})?`
      : `Riportare i contenuti com'erano il ${fmt(v.at)}? Per rimettere online questa versione dovrai poi premere "Pubblica".`;
    if (!(await confirmDialog(text, 'Ripristina'))) return;
    const r = await attempt(() => api<{ when: string }>('versions/restore', { method: 'POST', body: { sha: v.sha } }));
    if (!r) return;
    toast(`Ripristinata la versione del ${r.when}. Controlla l'anteprima, poi premi "Pubblica".`);
    void refreshUndo();
    await refresh();
  };

  const refresh = async () => {
    const data = await api<Versions>('versions').catch(() => null);
    list.replaceChildren();
    if (!data?.available) {
      list.append(h('li.muted', {}, 'La cronologia compare dopo la prima pubblicazione su GitHub.'));
      return;
    }
    data.versions.forEach((v, i) => {
      const online = i === 0;
      const button = online
        ? (data.changed ? h('button.btn', { onclick: () => restore(v, true) }, 'Torna a questa versione') : null)
        : h('button.btn', { onclick: () => restore(v, false) }, 'Ripristina questa versione');
      list.append(h('li.version', {},
        h('div', {},
          h('strong', {}, fmt(v.at)), online ? h('span.badge.online', {}, 'online') : null,
          h('br', {}), h('span', {}, v.message),
          h('br', {}), h('small.muted', {}, `${v.paintings.length} quadri: ${v.paintings.map((p) => p.replace(/^\d+-/, '')).join(', ')}`)),
        button));
    });
    if (data.changed) list.prepend(h('li.version.pending', {}, h('div', {}, h('strong', {}, 'Modifiche non ancora pubblicate'), h('br', {}), h('small.muted', {}, 'Premi "Pubblica" per metterle online.'))));
  };
  return { el, refresh };
}

function loginHelp() {
  return h('div.help', {},
    h('p', {}, 'Accesso a GitHub (una sola volta):'),
    h('ol', {},
      h('li', {}, 'Apri il menu Start, scrivi "cmd" e premi Invio.'),
      h('li', {}, 'Scrivi: ', h('code', {}, 'gh auth login'), ' e premi Invio.'),
      h('li', {}, 'Rispondi con Invio a tutte le domande, poi copia il codice mostrato e accedi dal browser che si apre.'),
      h('li', {}, 'Torna qui e premi di nuovo "Pubblica".')));
}

function cloudflareHelp() {
  return h('ol.help', {},
    h('li', {}, 'Apri dash.cloudflare.com e accedi (o crea un account gratuito).'),
    h('li', {}, 'Vai su "Workers e Pages" → "Crea" → "Pages" → "Carica risorse".'),
    h('li', {}, 'Dai un nome al progetto e trascina il file sito.zip della cartella "pubblicazione".'),
    h('li', {}, 'Premi "Distribuisci": l\'indirizzo del sito compare alla fine.'));
}

async function qrSheet(url: string, paintings: PaintingSummary[]) {
  const base = url.endsWith('/') ? url : `${url}/`;
  const items = [{ label: 'Ingresso generale', link: base }, ...paintings.map((p) => ({ label: p.title || p.id, link: `${base}?p=${encodeURIComponent(p.id)}&diretto=1` }))];
  const cards = await Promise.all(items.map(async (i) => h('figure.qr', {}, h('img', { src: await QRCode.toDataURL(i.link, { margin: 1, width: 300 }), alt: `Codice QR: ${i.label}` }), h('figcaption', {}, h('strong', {}, i.label), h('br', {}), h('code', {}, i.link)))));
  const sheet = h('div.qr-sheet', {}, ...cards);
  return h('div', {},
    h('p', {}, 'Sito pubblicato: ', h('a', { href: base, target: '_blank', rel: 'noopener' }, base)),
    h('button.btn', {
      onclick: () => {
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.write(`<!doctype html><title>Codici QR</title><style>body{font-family:Arial;margin:12mm}.qr-sheet{display:grid;grid-template-columns:repeat(2,1fr);gap:10mm}figure{margin:0;break-inside:avoid;text-align:center}img{width:60mm;height:60mm}code{font-size:8pt;word-break:break-all}</style>${sheet.outerHTML}<script>onload=()=>print()<\/script>`);
        w.document.close();
      },
    }, 'Stampa i codici QR'),
    ' ',
    h('a.btn', { href: `${base}stampa/cartellini.pdf`, target: '_blank', rel: 'noopener' }, 'Cartellini per la sala (PDF)'),
    sheet);
}

/** Markdown minimo: titoli, paragrafi, elenchi, grassetto e link; le voci di elenco numerate sono spuntabili. */
function renderMarkdown(md: string, checked: Record<string, boolean>, save: () => void) {
  const out = h('div.md', {});
  let listEl: HTMLElement | null = null;
  const inline = (s: string) => {
    const span = h('span', {});
    span.innerHTML = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>').replace(/(https:\/\/[^\s)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    return span;
  };
  for (const line of md.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t === '---') {
      listEl = null;
      continue;
    }
    const heading = t.match(/^(#{1,4})\s+(.*)/);
    if (heading) {
      listEl = null;
      out.append(h(`h${Math.min(4, heading[1].length + 1)}` as 'h3', {}, heading[2]));
      continue;
    }
    const item = t.match(/^(?:[-*]|\d+\.)\s+(.*)/);
    if (item) {
      listEl ??= out.appendChild(h('ul.todo', {}));
      const key = `md:${item[1].slice(0, 80)}`;
      const cb = h('input', { type: 'checkbox', checked: !!checked[key] }) as HTMLInputElement;
      cb.addEventListener('change', () => {
        checked[key] = cb.checked;
        save();
      });
      listEl.append(h('li', {}, h('label.check', {}, cb, inline(item[1]))));
      continue;
    }
    if (t.startsWith('|')) continue; // tabelle: si vedono nel file
    listEl = null;
    out.append(h('p', {}, inline(t)));
  }
  return out;
}
