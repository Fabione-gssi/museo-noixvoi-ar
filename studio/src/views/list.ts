import { api, fileUrl, type PaintingSummary } from '../api';
import { h, attempt, confirmDialog, promptDialog, budgetBar } from '../ui';

const EXP_LABEL: Record<string, string> = { racconto: 'Racconto', dettagli: 'Dettagli', caccia: 'Caccia', personaggio: 'Personaggio' };

function statusChip(p: PaintingSummary) {
  if (p.status === 'completo') return h('span.chip.ok', {}, 'Completo');
  if (p.status === 'da-preparare') return h('span.chip.warn', {}, 'Da preparare');
  return h('span.chip.ko', {}, `Mancano: ${p.missing.join(', ')}`);
}

export async function listView(root: HTMLElement) {
  const data = await api<{ paintings: PaintingSummary[]; totalBytes: number; budgetTotal: number; budgetPainting: number }>('paintings');
  const ps = data.paintings;

  const move = async (i: number, d: number) => {
    const order = ps.map((p) => p.folder);
    [order[i], order[i + d]] = [order[i + d], order[i]];
    if (await attempt(() => api('reorder', { body: { folders: order } }), 'Ordine aggiornato. Ricordati di preparare e pubblicare.')) await listView(root);
  };

  const add = async () => {
    const title = await promptDialog('Titolo del nuovo quadro');
    if (!title) return;
    const r = await attempt(() => api<{ folder: string }>('paintings', { body: { title } }), 'Quadro aggiunto.');
    if (r) location.hash = `#/q/${encodeURIComponent(r.folder)}/info`;
  };

  root.replaceChildren(
    h('div.headline', {},
      h('h1', {}, `Quadri (${ps.length})`),
      h('button.btn.primary.big', { onclick: add }, '+ Aggiungi quadro')),
    h('div.total', {}, h('span', {}, 'Peso totale del sito'), budgetBar(data.totalBytes, data.budgetTotal)),
    ps.length
      ? h('ol.cards', {}, ps.map((p, i) =>
          h('li.card', { 'data-folder': p.folder },
            h('a.thumb', { href: `#/q/${encodeURIComponent(p.folder)}/info`, 'aria-label': `Apri ${p.title}` },
              p.hasImage ? h('img', { src: fileUrl(p.folder, 'image', '&w=360'), alt: '' }) : h('span', {}, 'Nessuna immagine')),
            h('div.card-body', {},
              h('h2', {}, h('a', { href: `#/q/${encodeURIComponent(p.folder)}/info` }, p.title || '(senza titolo)')),
              h('p.muted', {}, [p.artist, p.year].filter(Boolean).join(', ') || '—'),
              h('div.row', {}, statusChip(p), h('span.chip', {}, EXP_LABEL[p.experience] ?? p.experience), p.voce === 'demo' && !p.audio ? h('span.chip.demo', {}, 'Voce DEMO') : null),
              p.built ? budgetBar(p.bytes, data.budgetPainting) : null,
              p.problems.length ? h('details.problems', {}, h('summary', {}, `${p.problems.length} avvisi`), h('ul', {}, p.problems.map((x) => h('li', {}, x)))) : null),
            h('div.card-actions', {},
              h('button.btn.icon', { onclick: () => move(i, -1), disabled: i === 0, 'aria-label': 'Sposta su', title: 'Sposta su' }, '↑'),
              h('button.btn.icon', { onclick: () => move(i, 1), disabled: i === ps.length - 1, 'aria-label': 'Sposta giù', title: 'Sposta giù' }, '↓'),
              h('button.btn', {
                onclick: async () => {
                  const r = await attempt(() => api<{ folder: string }>(`paintings/${encodeURIComponent(p.folder)}/duplicate`, { method: 'POST' }), 'Quadro duplicato.');
                  if (r) await listView(root);
                },
              }, 'Duplica'),
              h('button.btn.danger', {
                onclick: async () => {
                  if (!(await confirmDialog(`Eliminare "${p.title}"? Potrai recuperarlo con "Annulla".`, 'Elimina'))) return;
                  if (await attempt(() => api(`paintings/${encodeURIComponent(p.folder)}`, { method: 'DELETE' }), 'Quadro eliminato.')) await listView(root);
                },
              }, 'Elimina')))))
      : h('div.panel', {}, h('p', {}, 'Nessun quadro. Premi "Aggiungi quadro" per iniziare.')),
  );
}
