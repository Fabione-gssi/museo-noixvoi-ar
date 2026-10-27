import { api, fileUrl, onServerEvent, type PaintingDetails } from '../api';
import { h, attempt, uploadBox, toast, budgetBar, confirmDialog } from '../ui';
import { raccontoEditor } from './racconto-editor';
import { previewPanel } from './preview';

const TABS: [string, string][] = [
  ['info', 'Informazioni'],
  ['immagine', 'Immagine'],
  ['testo', 'Testo e audio'],
  ['interazione', 'Interazione'],
  ['racconto', 'Racconto'],
  ['anteprima', 'Anteprima'],
];

const EXPERIENCES = [
  { id: 'racconto', name: 'Racconto', line: 'Dopo aver inquadrato il quadro parte una storia animata (o un video) con voce e sottotitoli.', ready: true },
  { id: 'dettagli', name: 'Dettagli', line: 'Il visitatore inquadra un particolare e parte un contenuto. L\'editor dei particolari arriva nella Fase 2.', ready: true },
  { id: 'caccia', name: 'Caccia', line: 'Una lente rivela elementi nascosti. In arrivo nella Fase 3.', ready: false },
  { id: 'personaggio', name: 'Personaggio', line: 'Il personaggio si anima e risponde alle domande. In arrivo nella Fase 4.', ready: false },
];

const enc = encodeURIComponent;

export async function paintingView(root: HTMLElement, folder: string, tab = 'info'): Promise<() => void> {
  const cleanups: (() => void)[] = [];
  const d = await api<PaintingDetails>(`paintings/${enc(folder)}`);
  const reload = () => paintingView(root, folder, tab).then((c) => cleanups.push(c));
  const visibleTabs = TABS.filter(([id]) => id !== 'racconto' || d.experience === 'racconto');
  if (!visibleTabs.some(([id]) => id === tab)) tab = 'info';

  const prepare = () =>
    attempt(async () => {
      await api('build', { body: { folders: [folder] } });
      toast('Preparazione avviata: puoi continuare a lavorare.');
    });
  // A fine preparazione si ricarica la scheda, per mostrare risultati e avvisi aggiornati.
  cleanups.push(onServerEvent((e) => {
    if (e.event === 'job' && e.name === 'prepara' && e.state !== 'start') void reload();
  }));

  const body = h('div.tab-body', {});
  root.replaceChildren(
    h('div.headline', {},
      h('div', {}, h('a.muted', { href: '#/' }, '← Tutti i quadri'), h('h1', {}, d.title || '(senza titolo)')),
      h('div.row', {},
        d.problems.length ? h('span.chip.warn', { title: d.problems.join('\n') }, `${d.problems.length} avvisi`) : null,
        h('button.btn.primary.big', { onclick: prepare, title: 'Prepara immagini, riconoscimento, audio e sottotitoli' }, 'Prepara'))),
    d.problems.length ? h('details.problems.panel', {}, h('summary', {}, 'Avvisi da controllare'), h('ul', {}, d.problems.map((p) => h('li', {}, p)))) : '',
    h('nav.tabs', { role: 'tablist' }, visibleTabs.map(([id, label]) => h('a', { href: `#/q/${enc(folder)}/${id}`, role: 'tab', 'aria-selected': String(id === tab), class: id === tab ? 'active' : '' }, label))),
    body,
  );

  if (tab === 'info') body.append(infoTab(d, folder));
  if (tab === 'immagine') body.append(imageTab(d, folder, reload));
  if (tab === 'testo') body.append(textTab(d, folder, reload, prepare));
  if (tab === 'interazione') body.append(experienceTab(d, folder, reload));
  if (tab === 'racconto') {
    const ed = raccontoEditor(d, folder, reload, prepare);
    body.append(ed.el);
    cleanups.push(ed.destroy);
  }
  if (tab === 'anteprima') {
    const p = previewPanel(d, folder);
    body.append(p.el);
    cleanups.push(p.destroy);
  }
  return () => cleanups.forEach((c) => c());
}

function field(label: string, value: string, hint = '') {
  const input = h('input.input', { value, 'aria-label': label });
  return { input, el: h('label.field', {}, h('span', {}, label), input, hint ? h('small.muted', {}, hint) : null) };
}

function infoTab(d: PaintingDetails, folder: string) {
  const title = field('Titolo', d.title);
  const artist = field('Autore', d.artist);
  const year = field('Anno', d.year);
  const room = field('Sala', d.room, 'Dove si trova il quadro nel museo (es. "Sala 3").');
  return h('form.panel.form', {
    onsubmit: async (e: Event) => {
      e.preventDefault();
      await attempt(() => api(`paintings/${enc(folder)}/info`, { method: 'PUT', body: { title: title.input.value.trim(), artist: artist.input.value.trim(), year: year.input.value.trim(), room: room.input.value.trim() } }), 'Informazioni salvate.');
    },
  }, title.el, artist.el, year.el, room.el, h('button.btn.primary', { type: 'submit' }, 'Salva'));
}

function imageTab(d: PaintingDetails, folder: string, reload: () => void) {
  const upload = uploadBox(d.hasImage ? 'Sostituisci l\'immagine del quadro' : 'Carica l\'immagine del quadro', 'image/jpeg,image/png', async (f) => {
    toast('Carico l\'immagine…');
    if (await attempt(() => api(`paintings/${enc(folder)}/upload?kind=image&name=${enc(f.name)}`, { raw: f }), 'Immagine caricata. Premi "Prepara".')) reload();
  });
  return h('div.split', {},
    h('div.panel', {}, d.hasImage ? h('img.preview-img', { src: fileUrl(folder, 'image', '&w=1400'), alt: `Immagine di ${d.title}` }) : h('p.muted', {}, 'Nessuna immagine caricata.'), upload),
    h('div.panel', {},
      h('h2', {}, 'Controllo qualità'),
      d.quality
        ? h('ul.tips', {}, d.quality.tips.map((t) => h('li', { class: `tip-${t.level}` }, t.text)))
        : h('p.muted', {}, 'Carica un\'immagine per il controllo.'),
      h('p.muted', {}, 'Usa solo immagini di cui hai i diritti (es. pubblico dominio o foto del museo) e annota la fonte in crediti.md.')));
}

function textTab(d: PaintingDetails, folder: string, reload: () => void, prepare: () => void) {
  const ta = h('textarea.input.text', { rows: 16, 'aria-label': 'Testo storico' }, d.text) as HTMLTextAreaElement;
  const words = h('small.muted', {});
  const count = () => (words.textContent = `${ta.value.trim().split(/\s+/).filter(Boolean).length} parole (consigliate 350-450, circa 2-3 minuti di voce)`);
  ta.addEventListener('input', count);
  count();
  const saveText = h('button.btn.primary', { onclick: () => attempt(() => api(`paintings/${enc(folder)}/text`, { method: 'PUT', body: { text: ta.value } }), 'Testo salvato. Premi "Prepara" per aggiornare sottotitoli e voce.') }, 'Salva il testo');
  const textUpload = uploadBox('Oppure carica un file di testo (.txt)', '.txt,text/plain', async (f) => {
    if (await attempt(() => api(`paintings/${enc(folder)}/upload?kind=text&name=${enc(f.name)}`, { raw: f }), 'Testo caricato.')) reload();
  });

  const audioBox = h('div.panel', {}, h('h2', {}, 'Audio'));
  if (d.audio) {
    audioBox.append(
      h('p', {}, `Registrazione caricata: ${d.audio}`),
      h('audio', { controls: true, src: fileUrl(folder, 'audio'), preload: 'none' }),
      h('button.btn.danger', {
        onclick: async () => {
          if (!(await confirmDialog('Rimuovere la registrazione? Potrai recuperarla con "Annulla".', 'Rimuovi'))) return;
          if (await attempt(() => api(`paintings/${enc(folder)}/media?kind=audio`, { method: 'DELETE' }), 'Registrazione rimossa.')) reload();
        },
      }, 'Rimuovi la registrazione'));
  } else if (d.voce === 'demo') {
    audioBox.append(h('p', {}, h('span.chip.demo', {}, 'Voce DEMO'), ' Si usa una voce sintetica generica, generata dal testo. Nell\'app compare il badge "DEMO". Sostituiscila caricando una registrazione vera.'));
    if (d.meta?.audio) audioBox.append(h('audio', { controls: true, src: `/data/${d.id}/audio.m4a?v=${Date.now()}`, preload: 'none' }));
  } else {
    audioBox.append(h('p.muted', {}, 'Nessun audio. Carica la registrazione della voce (italiano, 2-3 minuti).'));
  }
  audioBox.append(uploadBox(d.audio ? 'Sostituisci la registrazione' : 'Carica la registrazione (MP3, WAV, M4A)', 'audio/*', async (f) => {
    toast('Carico l\'audio…');
    if (await attempt(() => api(`paintings/${enc(folder)}/upload?kind=audio&name=${enc(f.name)}`, { raw: f }), 'Audio caricato. Premi "Prepara" per allinearlo al testo.')) reload();
  }));
  if (!d.audio) {
    const demo = h('input', { type: 'checkbox', checked: d.voce === 'demo' }) as HTMLInputElement;
    demo.addEventListener('change', async () => {
      if (await attempt(() => api(`paintings/${enc(folder)}/info`, { method: 'PUT', body: { voce: demo.checked ? 'demo' : '' } }), demo.checked ? 'Voce demo attivata: premi "Prepara".' : 'Voce demo disattivata.')) reload();
    });
    audioBox.append(h('label.check', {}, demo, ' Usa la voce sintetica DEMO finché non c\'è una registrazione'));
  }
  if (d.voce === 'demo' && !d.audio) {
    const pron = h('textarea.input', { rows: 5, 'aria-label': 'Pronuncia' }, d.pronuncia) as HTMLTextAreaElement;
    audioBox.append(h('details', {}, h('summary', {}, 'La voce sbaglia un nome? Correggi la pronuncia'),
      h('p.muted', {}, 'Una riga per parola: "parola = come leggerla". Esempio: Géricault = Gericò. I sottotitoli non cambiano.'),
      pron,
      h('button.btn', { onclick: () => attempt(() => api(`paintings/${enc(folder)}/pronuncia`, { method: 'PUT', body: { text: pron.value } }), 'Pronuncia salvata: premi "Prepara".') }, 'Salva la pronuncia')));
  }
  if (d.alignment) audioBox.append(h('p.muted', {}, `Sottotitoli pronti: ${d.alignment.sentences.length} frasi allineate all'audio.`));
  if (d.meta?.budget) audioBox.append(h('p', {}, 'Peso del quadro'), budgetBar(d.meta.budget.bytes, d.meta.budget.limit));
  void prepare;

  return h('div.split', {}, h('div.panel', {}, h('h2', {}, 'Testo storico'), h('p.muted', {}, 'Solo fatti verificati, con le fonti annotate in fonti.md. Da questo testo nascono sottotitoli e voce demo.'), ta, words, saveText, textUpload), audioBox);
}

function experienceTab(d: PaintingDetails, folder: string, reload: () => void) {
  return h('div.panel', {},
    h('h2', {}, 'Che cosa succede quando il visitatore inquadra il quadro?'),
    h('p.muted', {}, 'Cambiare interazione non cancella nulla: i dati delle altre restano salvati.'),
    h('div.exp-grid', {}, EXPERIENCES.map((x) => {
      const t = d.triage[x.id];
      return h('button.exp', {
        class: d.experience === x.id ? 'selected' : '',
        disabled: !x.ready,
        'aria-pressed': String(d.experience === x.id),
        onclick: async () => {
          if (await attempt(() => api(`paintings/${enc(folder)}/info`, { method: 'PUT', body: { experience: x.id } }), `Interazione: ${x.name}. Premi "Prepara".`)) reload();
        },
      },
      h('strong', {}, x.name),
      h('span', {}, x.line),
      t?.score != null ? h('span.score', {}, `Idoneità: ${t.score}%`) : null,
      t ? h('small.muted', {}, t.note) : null);
    })));
}
