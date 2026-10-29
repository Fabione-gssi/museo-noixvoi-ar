import { api, fileUrl, type FacePoint, type PaintingDetails, type RegionCharacter, type RegionQuestion } from '../api';
import { h, attempt, toast, confirmDialog } from '../ui';
import { parseApprofondimento } from '../../../scripts/lib/approfondimento.mjs';
import { PassageSearch, MIN_COVER } from '../../../src/character/approfondimento';

// Editor del personaggio: punti del volto (trovati da soli, si possono
// trascinare), tipo di animazione (completa o solo "presenza") e tabella delle
// domande e risposte, ognuna con la frase del testo da cui viene.

const enc = encodeURIComponent;

/** Nomi dei punti (come in scripts/lib/face-landmarks.mjs) e come li vede l'utente. */
const POINTS: [string, string][] = [
  ['occhioSxEsterno', 'Occhio a sinistra: angolo esterno'],
  ['occhioSxInterno', 'Occhio a sinistra: angolo interno'],
  ['occhioSxSopra', 'Occhio a sinistra: palpebra sopra'],
  ['occhioSxSotto', 'Occhio a sinistra: palpebra sotto'],
  ['occhioSxIride', 'Occhio a sinistra: centro dell\'iride'],
  ['occhioDxEsterno', 'Occhio a destra: angolo esterno'],
  ['occhioDxInterno', 'Occhio a destra: angolo interno'],
  ['occhioDxSopra', 'Occhio a destra: palpebra sopra'],
  ['occhioDxSotto', 'Occhio a destra: palpebra sotto'],
  ['occhioDxIride', 'Occhio a destra: centro dell\'iride'],
  ['boccaSx', 'Bocca: angolo a sinistra'],
  ['boccaDx', 'Bocca: angolo a destra'],
  ['labbroSopra', 'Labbro di sopra (al centro, dove si chiude)'],
  ['labbroSotto', 'Labbro di sotto (al centro, dove si chiude)'],
  ['mento', 'Punta del mento'],
];

/** Disposizione di partenza se il volto non è stato trovato: un volto al centro, da spostare. */
const DEFAULT: Record<string, FacePoint> = {
  occhioSxEsterno: [0.42, 0.35], occhioSxInterno: [0.47, 0.35], occhioSxSopra: [0.445, 0.34], occhioSxSotto: [0.445, 0.36], occhioSxIride: [0.445, 0.35],
  occhioDxEsterno: [0.58, 0.35], occhioDxInterno: [0.53, 0.35], occhioDxSopra: [0.555, 0.34], occhioDxSotto: [0.555, 0.36], occhioDxIride: [0.555, 0.35],
  boccaSx: [0.46, 0.45], boccaDx: [0.54, 0.45], labbroSopra: [0.5, 0.448], labbroSotto: [0.5, 0.452], mento: [0.5, 0.52],
};

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export function personaggioEditor(d: PaintingDetails, folder: string, prepare: () => void) {
  const destroyers: (() => void)[] = [];
  const pg: RegionCharacter = structuredClone(d.regions.personaggio ?? {});
  pg.domande ??= [];
  pg.suggerite ??= [];
  const auto = d.meta?.personaggio?.volto?.punti;
  // Punti mostrati: quelli corretti a mano, poi gli automatici, poi la disposizione di partenza.
  const points: Record<string, FacePoint> = { ...DEFAULT, ...(auto ?? {}), ...(pg.punti ?? {}) };
  let dirty = false;
  let selected = 0;
  const saveBtn = h('button.btn.primary', { disabled: true, onclick: () => void save() }, 'Salva il personaggio');
  const markDirty = () => {
    dirty = true;
    saveBtn.removeAttribute('disabled');
  };

  // --- Volto: l'immagine ingrandita sul viso, con i punti trascinabili ---
  const xs = Object.values(points).map((p) => p[0]);
  const ys = Object.values(points).map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const span = Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...ys) - Math.min(...ys)) * (d.meta?.aspect ? 1 / d.meta.aspect : 1)) * 1.9;
  // Riquadro visibile (coordinate dell'immagine): quadrato attorno al volto.
  const aspect = d.meta?.aspect ?? 0.75;
  const view = { x: cx - span / 2, y: cy - (span * aspect) / 2, w: span, h: span * aspect };
  const img = h('img', { src: fileUrl(folder, 'image', '&w=2400'), alt: '', draggable: false }) as HTMLImageElement;
  img.style.cssText = `position:absolute;left:${(-view.x / view.w) * 100}%;top:${(-view.y / view.h) * 100}%;width:${(1 / view.w) * 100}%;max-width:none`;
  const layer = h('div.rect-layer', {});
  const stage = h('div.rect-stage.face-stage', {}, img, layer);
  const toView = (p: FacePoint) => [((p[0] - view.x) / view.w) * 100, ((p[1] - view.y) / view.h) * 100];
  const fromEvent = (e: PointerEvent): FacePoint => {
    const b = stage.getBoundingClientRect();
    const u = (e.clientX - b.left) / b.width;
    const v = (e.clientY - b.top) / b.height;
    return [+Math.min(1, Math.max(0, view.x + u * view.w)).toFixed(4), +Math.min(1, Math.max(0, view.y + v * view.h)).toFixed(4)];
  };
  let dragging = false;
  stage.addEventListener('pointerdown', (e) => {
    const hit = (e.target as HTMLElement).closest<HTMLElement>('.face-dot');
    if (hit) selected = Number(hit.dataset.i);
    points[POINTS[selected][0]] = fromEvent(e);
    dragging = true;
    stage.setPointerCapture(e.pointerId);
    markDirty();
    renderPoints();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    points[POINTS[selected][0]] = fromEvent(e);
    drawDots();
  });
  stage.addEventListener('pointerup', () => (dragging = false));
  const drawDots = () => {
    layer.replaceChildren(...POINTS.map(([k, label], i) => {
      const [x, y] = toView(points[k]);
      return h('div.face-dot', { 'data-i': i, class: i === selected ? 'selected' : '', style: `left:${x}%;top:${y}%`, title: label });
    }));
  };
  const pointList = h('ol.face-points', {});
  const renderPoints = () => {
    drawDots();
    pointList.replaceChildren(...POINTS.map(([, label], i) => h('li', { class: i === selected ? 'selected' : '' }, h('button.kf-main', {
      onclick: () => {
        selected = i;
        renderPoints();
      },
    }, label))));
  };
  const resetPoints = h('button.btn.small', {
    disabled: !pg.punti,
    onclick: () => {
      delete pg.punti;
      Object.assign(points, DEFAULT, auto ?? {});
      markDirty();
      renderPoints();
      toast('Punti automatici ripristinati. Salva per confermare.');
    },
  }, 'Rimetti i punti trovati da soli');

  // --- Tipo di animazione ---
  const modeRadio = (value: 'completa' | 'presenza', label: string, help: string) => {
    const r = h('input', { type: 'radio', name: 'modo', value, checked: (pg.modo ?? 'completa') === value }) as HTMLInputElement;
    r.addEventListener('change', () => {
      pg.modo = value;
      markDirty();
    });
    return h('label.check', {}, r, h('span', {}, h('strong', {}, label), h('br', {}), h('small.muted', {}, help)));
  };

  // --- Domande e risposte ---
  const textNorm = norm(d.text);
  const count = h('p.muted', {});
  const table = h('div.qa-list', {});
  const renderQuestions = () => {
    const n = pg.domande!.length;
    count.textContent = `${n} domande (ne servono da 8 a 15). Le prime 4 spuntate come "suggerita" compaiono come pulsanti.`;
    count.className = n < 8 || n > 15 ? 'warn' : 'muted';
    table.replaceChildren(...pg.domande!.map((q, i) => questionRow(q, i)));
  };
  const questionRow = (q: RegionQuestion, i: number) => {
    const input = (label: string, value: string, set: (v: string) => void, rows = 0) => {
      const el = (rows ? h('textarea.input', { rows, 'aria-label': label }, value) : h('input.input', { value, 'aria-label': label })) as HTMLInputElement;
      el.addEventListener('input', () => {
        set(el.value);
        markDirty();
        if (label.startsWith('Fonte')) check();
      });
      return h('label.field', {}, h('span', {}, label), el);
    };
    const warn = h('small.warn', {});
    const check = () => {
      // Ogni frase della fonte deve comparire nel testo storico (anche in punti diversi).
      const ok = q.fonte?.trim() && q.fonte.split(/(?<=[.!?»])\s+/).every((s) => !norm(s) || textNorm.includes(norm(s)));
      warn.textContent = !q.fonte?.trim() ? 'Manca la fonte: copia qui la frase del testo da cui viene la risposta.' : ok ? '' : 'Questa frase non si trova nel testo storico: controlla la risposta.';
    };
    check();
    const sug = h('input', { type: 'checkbox', checked: pg.suggerite!.includes(q.id), 'aria-label': `Suggerita: ${q.domanda}` }) as HTMLInputElement;
    sug.addEventListener('change', () => {
      pg.suggerite = sug.checked ? [...pg.suggerite!.filter((s) => s !== q.id), q.id] : pg.suggerite!.filter((s) => s !== q.id);
      if (pg.suggerite.length > 4) toast('Al massimo 4 domande suggerite: verranno usate le prime 4.', 'ko');
      markDirty();
    });
    return h('details.qa', { open: !q.risposta },
      h('summary', {}, h('strong', {}, `${i + 1}. ${q.domanda || 'Nuova domanda'}`), pg.suggerite!.includes(q.id) ? h('span.badge', {}, 'suggerita') : ''),
      input('Domanda (come appare sul pulsante)', q.domanda, (v) => (q.domanda = v)),
      input('Altri modi di chiederlo (uno per riga)', (q.varianti ?? []).join('\n'), (v) => (q.varianti = v.split('\n').map((x) => x.trim()).filter(Boolean)), 3),
      input('Risposta (in prima persona, solo fatti del testo storico)', q.risposta, (v) => (q.risposta = v), 3),
      input('Fonte: la frase del testo storico da cui viene', q.fonte ?? '', (v) => (q.fonte = v), 2),
      warn,
      h('div.row', {},
        h('label.check', {}, sug, h('span', {}, 'Suggerita (pulsante)')),
        h('button.btn.danger.small', {
          onclick: async () => {
            if (!(await confirmDialog(`Eliminare la domanda "${q.domanda}"?`, 'Elimina'))) return;
            pg.domande!.splice(i, 1);
            pg.suggerite = pg.suggerite!.filter((s) => s !== q.id);
            markDirty();
            renderQuestions();
          },
        }, 'Elimina')));
  };
  const addQuestion = h('button.btn', {
    onclick: () => {
      let n = pg.domande!.length + 1;
      while (pg.domande!.some((x) => x.id === `domanda-${n}`)) n++;
      pg.domande!.push({ id: `domanda-${n}`, domanda: '', varianti: [], risposta: '', fonte: '' });
      markDirty();
      renderQuestions();
    },
  }, '+ Aggiungi domanda');
  const nonSo = h('textarea.input', { rows: 2, 'aria-label': 'Risposta quando non sa', placeholder: 'Non so rispondere a questa domanda. Posso raccontarti solo quello che sappiamo di questo quadro: prova con una delle domande suggerite.' }, pg.nonSo ?? '') as HTMLTextAreaElement;
  nonSo.addEventListener('input', () => {
    pg.nonSo = nonSo.value.trim() || undefined;
    markDirty();
  });

  async function save() {
    const punti = POINTS.every(([k]) => auto?.[k] && auto[k][0] === points[k][0] && auto[k][1] === points[k][1]) ? undefined : Object.fromEntries(POINTS.map(([k]) => [k, points[k]]));
    const bad = pg.domande!.find((q) => !q.domanda.trim() || !q.risposta.trim());
    if (bad) return toast('Ogni domanda deve avere il testo della domanda e la risposta.', 'ko');
    const personaggio: RegionCharacter = { ...pg, ...(punti ? { punti } : {}) };
    if (!punti) delete personaggio.punti;
    if (await attempt(() => api(`paintings/${enc(folder)}/regions`, { method: 'PUT', body: { regions: { ...structuredClone(d.regions), personaggio } } }), 'Personaggio salvato. Premi "Prepara" per aggiornare voce e animazione.')) {
      dirty = false;
      saveBtn.setAttribute('disabled', '');
      if (punti) pg.punti = punti;
      resetPoints.toggleAttribute('disabled', !pg.punti);
    }
  }

  // --- Testo completo del museo: per le domande non previste ---
  const apText = h('textarea.input.ap-text', { rows: 16, 'aria-label': 'Testo completo del personaggio', placeholder: 'Chi parla: Nome, chi è, in quale quadro.\n\n## Titolo di una sezione\nUn paragrafo per idea, in prima persona.\nFonte: da dove viene il paragrafo.' }, d.approfondimento) as HTMLTextAreaElement;
  const apInfo = h('p.muted', {});
  const apSave = h('button.btn.primary', { disabled: true, onclick: () => void saveAp() }, 'Salva il testo completo');
  const apQuestion = h('input.input', { placeholder: 'Scrivi una domanda di prova, per esempio: Quando sei nato?', 'aria-label': 'Domanda di prova' }) as HTMLInputElement;
  const apResults = h('div.ap-results', {});
  const refreshAp = () => {
    const ap = parseApprofondimento(apText.value);
    const noSource = ap.passages.filter((x) => !x.fonte).length;
    apInfo.textContent = !apText.value.trim()
      ? 'Nessun testo: le domande non previste ricevono la risposta "non so".'
      : `${ap.passages.length} paragrafi.${ap.chiParla ? '' : ' Manca la riga "Chi parla: …".'}${noSource ? ` ${noSource} paragrafi senza la riga "Fonte: …".` : ''}`;
    return ap;
  };
  const tryQuestion = () => {
    const q = apQuestion.value.trim();
    if (!q) return apResults.replaceChildren();
    const hits = new PassageSearch(refreshAp().passages).search(q);
    const ok = hits[0] && hits[0].cover >= MIN_COVER;
    apResults.replaceChildren(
      h('p', {}, ok ? 'Il personaggio risponderebbe con questo paragrafo (con internet l\'assistente lo riformula in breve):' : 'Nessun paragrafo risponde abbastanza bene: il personaggio direbbe che non lo sa.'),
      ...hits.map((x, i) => h(`blockquote.ap-hit${i === 0 && ok ? '.best' : ''}`, {}, h('small', {}, `${x.passage.section || 'Senza sezione'} · pertinenza ${Math.round(x.cover * 100)}%`), h('br', {}), x.passage.text)));
  };
  apText.addEventListener('input', () => {
    apSave.removeAttribute('disabled');
    refreshAp();
  });
  apQuestion.addEventListener('keydown', (e) => e.key === 'Enter' && tryQuestion());
  refreshAp();
  async function saveAp() {
    if (await attempt(() => api(`paintings/${enc(folder)}/approfondimento`, { method: 'PUT', body: { text: apText.value } }), 'Testo completo salvato. Premi "Prepara" per aggiornarlo nell\'app.')) apSave.setAttribute('disabled', '');
  }

  const faceNote = auto
    ? 'Il volto è stato trovato da solo. Se un punto è fuori posto, sceglilo nell\'elenco e cliccalo (o trascinalo) nel punto giusto.'
    : d.meta?.personaggio
      ? 'Il volto non è stato trovato da solo: sposta i punti sul viso (scegli un punto nell\'elenco e clicca dove va), poi salva e premi "Prepara".'
      : 'Premi "Prepara" per cercare il volto da solo.';

  const el = h('div.panel', {},
    h('h2', {}, 'Personaggio'),
    h('p.muted', {}, 'Il personaggio si presenta con il testo storico e risponde alle domande con le risposte scritte qui, con la loro voce. Alle domande che non sono nell\'elenco risponde usando il "Testo completo del museo" (in fondo alla pagina); se lì non c\'è la risposta, dice che non lo sa.'),
    h('div.row', {}, saveBtn, h('button.btn', { onclick: prepare }, 'Prepara'),
      h('a.btn', { href: `/index.html?p=${enc(d.id)}&notutorial`, target: '_blank', rel: 'noopener' }, 'Prova il personaggio')),
    h('h3', {}, 'Volto'),
    h('p.muted', {}, faceNote),
    h('div.split.editor', {}, h('div', {}, stage), h('div', {}, pointList, resetPoints)),
    h('h3', {}, 'Animazione'),
    h('fieldset.det-kinds', {},
      h('legend', {}, 'Come si muove il volto?'),
      modeRadio('completa', 'Completa', 'La bocca si muove con la voce, gli occhi sbattono le ciglia e seguono il visitatore.'),
      modeRadio('presenza', 'Solo presenza', 'Niente bocca: solo sguardo, respiro e un leggero movimento. Da usare se l\'animazione completa sembra innaturale.')),
    h('h3', {}, 'Domande e risposte'),
    h('p.muted', {}, 'Scrivi le risposte solo con i fatti del testo storico e indica sempre la frase da cui vengono. Controllale tutte prima di pubblicare.'),
    count, h('div.row', {}, addQuestion), table,
    h('label.field', {}, h('span', {}, 'Risposta quando la domanda non è prevista (vuoto = frase standard)'), nonSo),
    h('h3', {}, 'Testo completo del museo'),
    h('p.muted', {}, 'Per le domande che non sono nell\'elenco qui sopra. Scrivi tutto quello che il museo sa del personaggio, in prima persona, un paragrafo per idea, con la fonte sotto ogni paragrafo. Il telefono cerca il paragrafo che risponde. Con internet un assistente automatico (intelligenza artificiale open source) lo trasforma in una risposta breve, usando solo questo testo. Senza internet il personaggio legge il paragrafo.'),
    h('div.row', {}, apSave), apInfo, apText,
    h('h4', {}, 'Prova una domanda'),
    h('div.row', {}, apQuestion, h('button.btn', { onclick: tryQuestion }, 'Prova')), apResults);

  img.addEventListener('load', drawDots);
  renderPoints();
  renderQuestions();
  const beforeUnload = (e: BeforeUnloadEvent) => {
    if (dirty) e.preventDefault();
  };
  window.addEventListener('beforeunload', beforeUnload);
  destroyers.push(() => window.removeEventListener('beforeunload', beforeUnload));
  return { el, destroy: () => destroyers.forEach((f) => f()) };
}
