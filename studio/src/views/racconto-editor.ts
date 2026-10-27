import { api, fileUrl, type PaintingDetails, type Keyframe, type Rect } from '../api';
import { h, attempt, uploadBox, toast, confirmDialog, promptDialog, formatTime } from '../ui';
import { segmentPicker } from '../components/segment-picker';
import { rectEditor, isFull, roundRect } from '../components/rect-editor';

// Editor del racconto: video caricato, oppure racconto automatico di cui si
// modifica la sequenza di inquadrature disegnando rettangoli sull'immagine,
// ciascuno a un istante scelto sulla traccia audio.

const enc = encodeURIComponent;
const FULL: Rect = { x: 0, y: 0, w: 1, h: 1 };

export function raccontoEditor(d: PaintingDetails, folder: string, reload: () => void, prepare: () => void) {
  const destroyers: (() => void)[] = [];
  const el = h('div.racconto-editor', {});

  // --- Video ---
  const videoPanel = h('div.panel', {}, h('h2', {}, 'Video del racconto (facoltativo)'));
  if (d.video) {
    videoPanel.append(
      h('p', {}, `Video caricato: ${d.video}. Il visitatore vedrà questo video al posto del racconto automatico.`),
      h('video.preview-video', { controls: true, src: fileUrl(folder, 'video'), preload: 'metadata', playsinline: true }),
      h('button.btn.danger', {
        onclick: async () => {
          if (!(await confirmDialog('Rimuovere il video e tornare al racconto automatico?', 'Rimuovi'))) return;
          if (await attempt(() => api(`paintings/${enc(folder)}/media?kind=video`, { method: 'DELETE' }), 'Video rimosso.')) reload();
        },
      }, 'Rimuovi il video'));
  } else {
    videoPanel.append(h('p.muted', {}, 'Se hai già un video pronto caricalo qui: verrà compresso automaticamente. Senza video, l\'app crea da sola un racconto animato con immagine, voce e sottotitoli.'));
  }
  videoPanel.append(uploadBox(d.video ? 'Sostituisci il video' : 'Carica un video (MP4 o MOV)', 'video/*', async (f) => {
    toast('Carico il video, può volerci un po\'…');
    if (await attempt(() => api(`paintings/${enc(folder)}/upload?kind=video&name=${enc(f.name)}`, { raw: f }), 'Video caricato. Premi "Prepara" per comprimerlo.')) reload();
  }));
  el.append(videoPanel);
  if (d.video) return { el, destroy: () => undefined };

  // --- Racconto automatico ---
  const auto = h('div.panel', {}, h('h2', {}, 'Racconto automatico: movimenti della camera'));
  el.append(auto);
  if (!d.meta?.racconto || !d.alignment) {
    auto.append(h('p', {}, 'Per modificare i movimenti servono immagine, testo e audio (o voce demo) già preparati.'), h('button.btn.primary', { onclick: prepare }, 'Prepara ora'));
    return { el, destroy: () => undefined };
  }
  const manual = !!d.regions.racconto?.timeline?.length;
  let kfs: Keyframe[] = structuredClone(d.regions.racconto?.timeline ?? d.meta.racconto.timeline);
  let selected = 0;
  let dirty = false;

  auto.append(h('p.muted', {}, manual
    ? 'Stai usando una sequenza modificata a mano.'
    : 'Sequenza automatica: la camera va su ogni particolare quando la voce lo nomina. Puoi modificarla.'));

  // Immagine con i rettangoli (componente comune agli editor).
  const editor = rectEditor(fileUrl(folder, 'image', '&w=1600'), (i, rect) => {
    kfs[i].args.rect = rect;
    markDirty();
    renderList();
  });
  const stage = editor.el;
  const list = h('ol.kf-list', {});
  const saveBtn = h('button.btn.primary', { disabled: true, onclick: save }, 'Salva la sequenza');

  const picker = segmentPicker(`/data/${d.id}/audio.m4a?v=${Date.now()}`, d.alignment);
  destroyers.push(picker.destroy);

  function markDirty() {
    dirty = true;
    saveBtn.removeAttribute('disabled');
  }

  function render() {
    editor.render(kfs.map((k, i) => ({ rect: k.args.rect, label: String(i + 1) })), selected);
    renderList();
  }

  function renderList() {
    list.replaceChildren(...kfs.map((k, i) =>
      h('li', { class: i === selected ? 'selected' : '' },
        h('button.kf-main', {
          onclick: () => {
            selected = i;
            picker.seek(k.t);
            render();
          },
        }, h('strong', {}, formatTime(k.t)), ' ', k.args.label || (isFull(k.args.rect) ? 'Quadro intero' : 'Inquadratura')),
        h('button.btn.small', {
          onclick: async () => {
            const v = await promptDialog('Nome mostrato al visitatore (vuoto = nessuno)', k.args.label ?? '');
            if (v === null) return;
            k.args.label = v;
            markDirty();
            render();
          },
        }, 'Nome'),
        h('button.btn.small', {
          onclick: () => {
            k.t = Math.round(picker.time() * 10) / 10;
            kfs.sort((a, b) => a.t - b.t);
            selected = kfs.indexOf(k);
            markDirty();
            render();
          },
          title: 'Sposta questo movimento all\'istante scelto sull\'audio',
        }, 'Sposta qui'),
        i > 0 ? h('button.btn.small.danger', {
          onclick: () => {
            kfs.splice(i, 1);
            selected = Math.max(0, i - 1);
            markDirty();
            render();
          },
        }, 'Elimina') : null)));
  }

  async function save() {
    const regions = structuredClone(d.regions);
    regions.racconto = { ...(regions.racconto ?? {}), timeline: kfs.map((k) => ({ t: k.t, action: 'cameraTo' as const, args: { rect: roundRect(k.args.rect), ...(k.args.label ? { label: k.args.label } : {}) } })) };
    if (await attempt(() => api(`paintings/${enc(folder)}/regions`, { method: 'PUT', body: { regions } }), 'Sequenza salvata. Premi "Prepara" e poi guarda l\'anteprima.')) {
      dirty = false;
      saveBtn.setAttribute('disabled', '');
    }
  }

  auto.append(
    h('div.split.editor', {},
      h('div', {}, stage, h('p.muted', {}, 'Trascina sull\'immagine per disegnare l\'inquadratura del movimento selezionato; trascina dentro il riquadro per spostarlo.')),
      h('div', {},
        h('h3', {}, 'Sequenza'),
        list,
        h('div.row', {},
          h('button.btn', {
            onclick: () => {
              const t = Math.round(picker.time() * 10) / 10;
              const k: Keyframe = { t, action: 'cameraTo', args: { rect: { ...kfs[selected].args.rect } } };
              kfs.push(k);
              kfs.sort((a, b) => a.t - b.t);
              selected = kfs.indexOf(k);
              markDirty();
              render();
            },
          }, '+ Aggiungi movimento all\'istante scelto'),
          h('button.btn', {
            onclick: () => {
              kfs[selected].args.rect = { ...FULL };
              markDirty();
              render();
            },
          }, 'Quadro intero'),
          saveBtn),
        manual ? h('button.btn.ghost', {
          onclick: async () => {
            if (!(await confirmDialog('Tornare alla sequenza automatica? Le modifiche fatte a mano andranno perse (recuperabili con "Annulla").', 'Sì, torna all\'automatica'))) return;
            const regions = structuredClone(d.regions);
            if (regions.racconto) delete regions.racconto.timeline;
            if (await attempt(() => api(`paintings/${enc(folder)}/regions`, { method: 'PUT', body: { regions } }), 'Sequenza automatica ripristinata: premi "Prepara".')) reload();
          },
        }, 'Torna alla sequenza automatica') : null)),
    h('h3', {}, 'Traccia audio'),
    h('p.muted', {}, 'Clicca sull\'onda o su una parola per scegliere l\'istante; trascina sulle parole per selezionare un pezzo e ascoltarlo.'),
    picker.el,
  );
  render();

  const beforeUnload = (e: BeforeUnloadEvent) => {
    if (dirty) e.preventDefault();
  };
  window.addEventListener('beforeunload', beforeUnload);
  destroyers.push(() => window.removeEventListener('beforeunload', beforeUnload));
  return { el, destroy: () => destroyers.forEach((f) => f()) };
}

