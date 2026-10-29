import { api, fileUrl, type PaintingDetails, type RegionHunt, type RegionHuntItem, type RegionDetail } from '../api';
import { h, attempt, toast, confirmDialog, formatTime } from '../ui';
import { segmentPicker } from '../components/segment-picker';

// Editor della caccia: si clicca sull'immagine per mettere gli elementi
// nascosti (e si trascinano per spostarli), si sceglie l'effetto con cui si
// rivelano nella lente, la storia (pezzo dell'audio o testo), il raggio della
// lente e il finale. Solo particolari reali del quadro, o descritti in caccia.txt.

const enc = encodeURIComponent;
const FX: [NonNullable<RegionHuntItem['fx']>, string][] = [
  ['glow', 'Bagliore dorato'],
  ['ink', 'Contorno a inchiostro'],
  ['zoom', 'Ingrandimento'],
];
type Kind = 'auto' | 'segmento' | 'testo';
const kindOf = (m?: RegionDetail['media']): Kind => (m?.type === 'segmento' ? 'segmento' : m?.type === 'testo' ? 'testo' : 'auto');

export function cacciaEditor(d: PaintingDetails, folder: string, prepare: () => void) {
  const destroyers: (() => void)[] = [];
  const hunt: RegionHunt = structuredClone(d.regions.caccia ?? { lensRadius: 0.18, items: [] });
  hunt.lensRadius ??= 0.18;
  hunt.finale ??= {};
  let selected = 0;
  let dirty = false;
  const built = d.meta?.caccia;
  const saveBtn = h('button.btn.primary', { disabled: true, onclick: () => void save() }, 'Salva la caccia');
  const markDirty = () => {
    dirty = true;
    saveBtn.removeAttribute('disabled');
  };
  const hasAudio = !!(d.meta?.audio && d.alignment);
  const picker = hasAudio ? segmentPicker(`/data/${d.id}/audio.m4a?v=${Date.now()}`, d.alignment) : null;
  if (picker) destroyers.push(picker.destroy);

  // --- Immagine con i punti ---
  const img = h('img', { src: fileUrl(folder, 'image', '&w=1600'), alt: '', draggable: false }) as HTMLImageElement;
  const layer = h('div.rect-layer', {});
  const stage = h('div.rect-stage.hunt-stage', {}, img, layer);
  let drag = false;
  const pos = (e: PointerEvent) => {
    const b = stage.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)) };
  };
  stage.addEventListener('pointerdown', (e) => {
    const hit = (e.target as HTMLElement).closest<HTMLElement>('.hunt-dot');
    if (hit) selected = Number(hit.dataset.i);
    const it = hunt.items[selected];
    if (!it) return;
    const p = pos(e);
    Object.assign(it, { x: +p.x.toFixed(4), y: +p.y.toFixed(4) });
    drag = true;
    stage.setPointerCapture(e.pointerId);
    markDirty();
    render();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag || !hunt.items[selected]) return;
    const p = pos(e);
    Object.assign(hunt.items[selected], { x: +p.x.toFixed(4), y: +p.y.toFixed(4) });
    drawDots();
  });
  stage.addEventListener('pointerup', () => (drag = false));

  function drawDots() {
    const aspect = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1.4;
    layer.replaceChildren(...hunt.items.map((it, i) => {
      const r = it.r ?? 0.05;
      return h('div.hunt-dot', {
        'data-i': i,
        class: i === selected ? 'selected' : '',
        style: `left:${(it.x - r) * 100}%;top:${(it.y - r * aspect) * 100}%;width:${r * 200}%;height:${r * aspect * 200}%`,
        title: it.label,
      }, h('span', {}, `${i + 1}`));
    }));
    // Grandezza della lente, attorno all'elemento selezionato (a distanza normale ~ quadro intero sullo schermo).
    const sel = hunt.items[selected];
    if (sel) {
      const lr = (hunt.lensRadius ?? 0.18) * 0.5;
      layer.append(h('div.hunt-lens', { style: `left:${(sel.x - lr) * 100}%;top:${(sel.y - lr * aspect) * 100}%;width:${lr * 200}%;height:${lr * aspect * 200}%` }));
    }
  }
  img.addEventListener('load', drawDots);

  // --- Elenco e modulo ---
  const rows = h('ol.kf-list.det-list', {});
  const form = h('div.det-form', {});

  function contentChoice(name: string, current: RegionDetail['media'], set: (m: RegionDetail['media']) => void, autoInfo: string) {
    const kind = kindOf(current);
    const radio = (k: Kind, label: string, disabled = false) => {
      const r = h('input', { type: 'radio', name, value: k, checked: kind === k, disabled }) as HTMLInputElement;
      r.addEventListener('change', () => {
        if (k === 'auto') set(undefined);
        else if (k === 'testo') set({ type: 'testo' });
        else {
          const sel = picker?.selection();
          set({ type: 'segmento', from: sel?.from ?? 0, to: sel?.to ?? 5 });
        }
        markDirty();
        renderForm();
      });
      return h('label.check', {}, r, h('span', {}, label));
    };
    const extra: (HTMLElement | string)[] = [];
    if (kind === 'auto') extra.push(h('p.muted', {}, autoInfo));
    if (current?.type === 'segmento') {
      extra.push(h('p', {}, `Pezzo scelto: da ${formatTime(current.from)} a ${formatTime(current.to)}`),
        h('button.btn.small', {
          onclick: () => {
            const sel = picker?.selection();
            if (!sel) return toast('Prima seleziona delle parole sulla trascrizione qui sotto.', 'ko');
            set({ type: 'segmento', from: Math.round(sel.from * 100) / 100, to: Math.round(sel.to * 100) / 100 });
            markDirty();
            renderForm();
          },
        }, 'Usa la selezione fatta sulla traccia'));
    }
    return h('fieldset.det-kinds', {}, h('legend', {}, 'Che cosa si ascolta?'),
      radio('auto', 'Il pezzo dell\'audio che ne parla (automatico)', !hasAudio),
      radio('segmento', 'Un pezzo dell\'audio scelto da me', !hasAudio),
      radio('testo', 'Solo testo'),
      ...extra);
  }

  const segInfo = (seg?: { from: number; to: number }) =>
    seg ? `Pezzo trovato nel testo: da ${formatTime(seg.from)} a ${formatTime(seg.to)}.` : 'Il pezzo si cerca con la frase del testo indicata qui sotto; premi "Prepara" per vederlo.';

  function render() {
    drawDots();
    rows.replaceChildren(...hunt.items.map((it, i) =>
      h('li', { class: i === selected ? 'selected' : '' },
        h('button.kf-main', {
          onclick: () => {
            selected = i;
            render();
          },
        }, h('strong', {}, `${i + 1}. ${it.label}`), ' ', h('small.muted', {}, FX.find((f) => f[0] === (it.fx ?? 'glow'))?.[1] ?? '')))));
    renderForm();
  }

  function renderForm() {
    const it = hunt.items[selected];
    if (!it) {
      form.replaceChildren(h('p.muted', {}, 'Nessun elemento nascosto. Premi "+ Aggiungi elemento", poi clicca sull\'immagine dove si trova.'));
      return;
    }
    const name = h('input.input', { value: it.label, 'aria-label': 'Nome dell\'elemento' }) as HTMLInputElement;
    name.addEventListener('input', () => {
      it.label = name.value;
      markDirty();
    });
    const fx = h('select.input', { 'aria-label': 'Effetto nella lente' }, ...FX.map(([v, l]) => h('option', { value: v, selected: (it.fx ?? 'glow') === v }, l))) as HTMLSelectElement;
    fx.addEventListener('change', () => {
      it.fx = fx.value as RegionHuntItem['fx'];
      markDirty();
    });
    const size = h('input', { type: 'range', min: 0.02, max: 0.12, step: 0.005, value: it.r ?? 0.05, 'aria-label': 'Grandezza dell\'area' }) as HTMLInputElement;
    size.addEventListener('input', () => {
      it.r = Number(size.value);
      markDirty();
      drawDots();
    });
    const text = h('textarea.input', { rows: 3, 'aria-label': 'Storia dell\'elemento', placeholder: built?.items.find((b) => b.id === it.id)?.text ?? 'Storia mostrata quando viene scoperto' }, it.text ?? '') as HTMLTextAreaElement;
    text.addEventListener('input', () => {
      it.text = text.value.trim() ? text.value : undefined;
      markDirty();
    });
    const anchor = h('input.input', { value: it.ancora ?? '', 'aria-label': 'Frase del testo che parla di questo elemento' }) as HTMLInputElement;
    anchor.addEventListener('input', () => {
      it.ancora = anchor.value.trim() || undefined;
      markDirty();
    });
    form.replaceChildren(
      h('h3', {}, `Elemento ${selected + 1}`),
      h('p.muted', {}, 'Clicca sull\'immagine (o trascina il cerchio) per metterlo nel punto giusto.'),
      h('label.field', {}, h('span', {}, 'Nome (lo vede il visitatore)'), name),
      h('label.field', {}, h('span', {}, 'Come si rivela nella lente'), fx),
      h('label.field', {}, h('span', {}, 'Grandezza dell\'area da trovare'), size),
      contentChoice('hunt-kind', it.media, (m) => (it.media = m), segInfo(built?.items.find((b) => b.id === it.id)?.media.audioSegment)),
      h('label.field', {}, h('span', {}, 'Storia (vuoto = la frase del testo storico)'), text),
      h('details', {}, h('summary', {}, 'Frase del testo che parla di questo elemento'), anchor),
      h('button.btn.danger.small', {
        onclick: async () => {
          if (!(await confirmDialog(`Eliminare "${it.label}"?`, 'Elimina'))) return;
          hunt.items.splice(selected, 1);
          selected = Math.max(0, selected - 1);
          markDirty();
          render();
        },
      }, 'Elimina questo elemento'));
  }

  // --- Lente e finale ---
  const lens = h('input', { type: 'range', min: 0.1, max: 0.3, step: 0.01, value: hunt.lensRadius, 'aria-label': 'Grandezza della lente' }) as HTMLInputElement;
  lens.addEventListener('input', () => {
    hunt.lensRadius = Number(lens.value);
    markDirty();
    drawDots();
  });
  const finaleBox = h('div', {});
  const renderFinale = () => {
    const f = hunt.finale!;
    const ft = h('textarea.input', { rows: 3, 'aria-label': 'Testo del finale', placeholder: built?.finale?.text ?? 'Testo mostrato quando sono stati trovati tutti' }, f.text ?? '') as HTMLTextAreaElement;
    ft.addEventListener('input', () => {
      f.text = ft.value.trim() ? ft.value : undefined;
      markDirty();
    });
    const fa = h('input.input', { value: f.ancora ?? '', 'aria-label': 'Frase del testo per il finale' }) as HTMLInputElement;
    fa.addEventListener('input', () => {
      f.ancora = fa.value.trim() || undefined;
      markDirty();
    });
    finaleBox.replaceChildren(
      contentChoice('finale-kind', f.media, (m) => {
        f.media = m;
        renderFinale();
      }, segInfo(built?.finale?.media.audioSegment)),
      h('label.field', {}, h('span', {}, 'Testo del finale (vuoto = la frase del testo storico)'), ft),
      h('label.field', {}, h('span', {}, 'Frase del testo per il finale'), fa));
  };
  renderFinale();

  async function save() {
    if (await attempt(() => api(`paintings/${enc(folder)}/regions`, { method: 'PUT', body: { regions: { ...structuredClone(d.regions), caccia: hunt } } }), 'Caccia salvata. Premi "Prepara" per aggiornare l\'app.')) {
      dirty = false;
      saveBtn.setAttribute('disabled', '');
    }
  }

  const add = h('button.btn', {
    onclick: () => {
      let n = hunt.items.length + 1;
      while (hunt.items.some((x) => x.id === `elemento-${n}`)) n++;
      hunt.items.push({ id: `elemento-${n}`, label: `Elemento ${n}`, x: 0.5, y: 0.5, r: 0.05, fx: 'glow' });
      selected = hunt.items.length - 1;
      markDirty();
      render();
      toast('Clicca sull\'immagine nel punto in cui si trova il nuovo elemento.');
    },
  }, '+ Aggiungi elemento');

  const el = h('div.panel', {},
    h('h2', {}, 'Caccia con la lente'),
    h('p.muted', {}, 'Ogni elemento è invisibile finché il visitatore non lo inquadra con la lente al centro dello schermo. Usa solo cose che si vedono davvero nel quadro (o descritte in caccia.txt). Ne servono almeno 3.'),
    h('div.split.editor', {},
      h('div', {}, stage, h('label.field', {}, h('span', {}, 'Grandezza della lente (il cerchio tratteggiato è una stima a distanza normale)'), lens)),
      h('div', {}, h('div.row', {}, add, saveBtn, h('button.btn', { onclick: prepare }, 'Prepara')), rows, form)),
    h('h3', {}, 'Finale (quando ha trovato tutto)'),
    finaleBox,
    picker ? h('div', {}, h('h3', {}, 'Traccia audio'), picker.el) : '');

  render();
  const beforeUnload = (e: BeforeUnloadEvent) => {
    if (dirty) e.preventDefault();
  };
  window.addEventListener('beforeunload', beforeUnload);
  destroyers.push(() => window.removeEventListener('beforeunload', beforeUnload));
  return { el, destroy: () => destroyers.forEach((f) => f()) };
}
