import { api, fileUrl, type PaintingDetails, type RegionDetail } from '../api';
import { h, attempt, uploadBox, toast, confirmDialog, formatTime } from '../ui';
import { segmentPicker } from '../components/segment-picker';
import { rectEditor, roundRect } from '../components/rect-editor';

// Editor dei particolari: si disegnano rettangoli sull'immagine, si dà un nome
// e si sceglie il contenuto (pezzo dell'audio principale, audio o video
// caricato, oppure solo testo). Si vede quanto ogni ritaglio è riconoscibile.

const enc = encodeURIComponent;
type Kind = 'auto' | 'segmento' | 'audio' | 'video' | 'testo';

const slug = (s: string) => s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'particolare';

function kindOf(d: RegionDetail): Kind {
  if (!d.media) return 'auto';
  return d.media.type as Kind;
}

export function dettagliEditor(d: PaintingDetails, folder: string, prepare: () => void) {
  const destroyers: (() => void)[] = [];
  const list: RegionDetail[] = structuredClone(d.regions.dettagli ?? []);
  let selected = 0;
  let dirty = false;
  const builtById = new Map((d.meta?.dettagli ?? []).map((x) => [x.id, x]));

  const saveBtn = h('button.btn.primary', { disabled: true, onclick: () => void save() }, 'Salva i particolari');
  const markDirty = () => {
    dirty = true;
    saveBtn.removeAttribute('disabled');
  };
  const editor = rectEditor(fileUrl(folder, 'image', '&w=1600'), (i, rect) => {
    list[i].crop = rect;
    markDirty();
  });
  const rows = h('ol.kf-list.det-list', {});
  const form = h('div.det-form', {});
  const hasAudio = !!(d.meta?.audio && d.alignment);
  const picker = hasAudio ? segmentPicker(`/data/${d.id}/audio.m4a?v=${Date.now()}`, d.alignment) : null;
  if (picker) destroyers.push(picker.destroy);

  function recognizability(item: RegionDetail) {
    const b = builtById.get(item.id);
    if (!b) return h('span.chip', {}, 'Premi "Prepara" per calcolare');
    if (b.trigger.includes('target')) return h('span.chip.ok', { title: `${b.points} punti` }, 'Riconoscibile da vicino e col mirino');
    return h('span.chip.warn', { title: `${b.points ?? 0} punti` }, 'Solo col mirino (poca texture)');
  }

  function render() {
    editor.render(list.map((x, i) => ({ rect: x.crop, label: `${i + 1}. ${x.label}` })), selected);
    rows.replaceChildren(...list.map((x, i) =>
      h('li', { class: i === selected ? 'selected' : '' },
        h('button.kf-main', {
          onclick: () => {
            selected = i;
            render();
          },
        }, h('strong', {}, `${i + 1}. ${x.label}`), h('br', {}), recognizability(x)))));
    renderForm();
  }

  function renderForm() {
    const item = list[selected];
    if (!item) {
      form.replaceChildren(h('p.muted', {}, 'Nessun particolare. Premi "+ Aggiungi particolare" e disegnalo sull\'immagine.'));
      return;
    }
    const name = h('input.input', { value: item.label, 'aria-label': 'Nome del particolare' }) as HTMLInputElement;
    name.addEventListener('input', () => {
      item.label = name.value;
      markDirty();
      editor.render(list.map((x, i) => ({ rect: x.crop, label: `${i + 1}. ${x.label}` })), selected);
    });
    const kind = kindOf(item);
    const auto = builtById.get(item.id);
    const radio = (k: Kind, label: string, disabled = false) => {
      const r = h('input', { type: 'radio', name: 'det-kind', value: k, checked: kind === k, disabled }) as HTMLInputElement;
      r.addEventListener('change', () => {
        if (k === 'auto') delete item.media;
        else if (k === 'testo') item.media = { type: 'testo' };
        else if (k === 'segmento') {
          const sel = picker?.selection();
          item.media = { type: 'segmento', from: sel?.from ?? 0, to: sel?.to ?? 5 };
        }
        // audio/video: il file si sceglie col riquadro di caricamento.
        if (k !== 'audio' && k !== 'video') markDirty();
        renderForm();
      });
      return h('label.check', {}, r, h('span', {}, label));
    };

    const extra: HTMLElement[] = [];
    if (kind === 'auto') {
      const seg = auto?.media?.audioSegment;
      extra.push(h('p.muted', {}, seg
        ? `Pezzo trovato nel testo: da ${formatTime(seg.from)} a ${formatTime(seg.to)}.`
        : 'Il pezzo viene cercato con la frase qui sotto ("frase del testo"); premi "Prepara" per vederlo.'));
      if (seg && picker) extra.push(h('button.btn.small', { onclick: () => picker.seek(seg.from) }, 'Ascoltalo sulla traccia qui sotto'));
    }
    if (kind === 'segmento' && item.media?.type === 'segmento') {
      const m = item.media;
      extra.push(h('p', {}, `Pezzo scelto: da ${formatTime(m.from)} a ${formatTime(m.to)}`),
        h('button.btn.small', {
          onclick: () => {
            const sel = picker?.selection();
            if (!sel) return toast('Prima seleziona delle parole sulla trascrizione qui sotto.', 'ko');
            item.media = { type: 'segmento', from: Math.round(sel.from * 100) / 100, to: Math.round(sel.to * 100) / 100 };
            markDirty();
            renderForm();
          },
        }, 'Usa la selezione fatta sulla traccia'));
    }
    if (kind === 'audio' || kind === 'video' || item.media?.type === 'audio' || item.media?.type === 'video') {
      const current = item.media && 'file' in item.media ? item.media.file : null;
      if (current) {
        extra.push(h('p', {}, `File caricato: ${current}`));
        extra.push(item.media!.type === 'video'
          ? h('video.preview-video', { controls: true, src: fileUrl(folder, 'detail', `&id=${item.id}`), preload: 'metadata', playsinline: true })
          : h('audio', { controls: true, src: fileUrl(folder, 'detail', `&id=${item.id}`), preload: 'none' }));
      }
    }
    const upload = uploadBox('Carica un audio o un video per questo particolare', 'audio/*,video/*', async (f) => {
      toast('Carico il file…');
      const r = await attempt(() => api<{ type: 'audio' | 'video'; file: string }>(`paintings/${enc(folder)}/upload?kind=detail&id=${enc(item.id)}&name=${enc(f.name)}`, { raw: f }));
      if (!r) return;
      item.media = { type: r.type, file: r.file };
      markDirty();
      await save();
      renderForm();
    });

    const text = h('textarea.input', { rows: 4, 'aria-label': 'Testo della scheda', placeholder: auto?.text ?? 'Testo mostrato al visitatore' }, item.text ?? '') as HTMLTextAreaElement;
    text.addEventListener('input', () => {
      item.text = text.value.trim() ? text.value : undefined;
      markDirty();
    });
    const anchor = h('input.input', { value: item.ancora ?? '', 'aria-label': 'Frase del testo che parla del particolare' }) as HTMLInputElement;
    anchor.addEventListener('input', () => {
      item.ancora = anchor.value.trim() || undefined;
      markDirty();
    });

    form.replaceChildren(
      h('h3', {}, `Particolare ${selected + 1}`),
      h('label.field', {}, h('span', {}, 'Nome (lo vede il visitatore)'), name),
      h('fieldset.det-kinds', {}, h('legend', {}, 'Che cosa parte quando il visitatore lo inquadra?'),
        radio('auto', 'Il pezzo dell\'audio principale che ne parla (automatico)', !hasAudio),
        radio('segmento', 'Un pezzo dell\'audio principale scelto da me', !hasAudio),
        radio('audio', 'Un audio caricato'),
        radio('video', 'Un video caricato'),
        radio('testo', 'Solo testo')),
      ...extra,
      kind === 'audio' || kind === 'video' ? upload : '',
      h('label.field', {}, h('span', {}, 'Testo della scheda (vuoto = la frase del testo storico)'), text),
      h('details', {}, h('summary', {}, 'Frase del testo che parla di questo particolare'),
        h('p.muted', {}, 'Serve per trovare da sola il pezzo di audio. Copiala dal testo storico, anche solo l\'inizio.'), anchor),
      h('button.btn.danger.small', {
        onclick: async () => {
          if (!(await confirmDialog(`Eliminare il particolare "${item.label}"?`, 'Elimina'))) return;
          list.splice(selected, 1);
          selected = Math.max(0, selected - 1);
          markDirty();
          render();
        },
      }, 'Elimina questo particolare'));
  }

  async function save() {
    for (const x of list) x.crop = roundRect(x.crop);
    const regions = { ...structuredClone(d.regions), dettagli: list };
    if (await attempt(() => api(`paintings/${enc(folder)}/regions`, { method: 'PUT', body: { regions } }), 'Particolari salvati. Premi "Prepara" per aggiornare l\'app.')) {
      dirty = false;
      saveBtn.setAttribute('disabled', '');
    }
  }

  const add = h('button.btn', {
    onclick: () => {
      const base = slug(`particolare ${list.length + 1}`);
      let id = base;
      for (let k = 2; list.some((x) => x.id === id); k++) id = `${base}-${k}`;
      list.push({ id, label: `Particolare ${list.length + 1}`, crop: { x: 0.4, y: 0.4, w: 0.2, h: 0.2 } });
      selected = list.length - 1;
      markDirty();
      render();
      toast('Trascina sull\'immagine per disegnare il riquadro del nuovo particolare.');
    },
  }, '+ Aggiungi particolare');

  const el = h('div.panel', {},
    h('h2', {}, 'Particolari da scoprire'),
    h('p.muted', {}, 'Disegna un riquadro per ogni particolare: trascina sull\'immagine, sposta trascinando dentro, ridimensiona dall\'angolo. Riquadri grandi e ricchi di dettagli si riconoscono meglio anche da vicino; per gli altri si usa il mirino al centro dello schermo.'),
    h('div.split.editor', {},
      h('div', {}, editor.el),
      h('div', {}, h('div.row', {}, add, saveBtn, h('button.btn', { onclick: prepare }, 'Prepara')), rows, form)),
    picker ? h('div', {}, h('h3', {}, 'Traccia audio'), h('p.muted', {}, 'Trascina sulle parole per selezionare un pezzo, poi "Usa la selezione fatta sulla traccia".'), picker.el) : h('p.muted', {}, 'Per usare pezzi dell\'audio servono testo e audio (o voce demo) già preparati.'));

  render();
  const beforeUnload = (e: BeforeUnloadEvent) => {
    if (dirty) e.preventDefault();
  };
  window.addEventListener('beforeunload', beforeUnload);
  destroyers.push(() => window.removeEventListener('beforeunload', beforeUnload));
  return { el, destroy: () => destroyers.forEach((f) => f()) };
}
