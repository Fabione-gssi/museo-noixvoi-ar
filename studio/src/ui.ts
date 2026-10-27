// Piccoli aiuti per costruire l'interfaccia senza framework.
import { onServerEvent, api } from './api';

type Attrs = Record<string, string | number | boolean | EventListener | undefined | null>;
type Child = Node | string | null | undefined | false;

/** h('button.big', { onclick }, 'Testo') */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K | `${K}.${string}`, attrs: Attrs = {}, ...children: (Child | Child[])[]) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name as K);
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') el.className += ` ${v}`;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

let toastTimer = 0;
export function toast(text: string, kind: 'ok' | 'ko' = 'ok') {
  const t = document.getElementById('toast')!;
  t.textContent = text;
  t.className = `toast ${kind}`;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (t.hidden = true), kind === 'ko' ? 7000 : 3500);
}

/** Esegue un'azione mostrando l'errore in parole semplici se fallisce. */
export async function attempt<T>(fn: () => Promise<T>, okText?: string): Promise<T | undefined> {
  try {
    const r = await fn();
    if (okText) toast(okText);
    void refreshUndo();
    return r;
  } catch (e) {
    toast((e as Error).message, 'ko');
    return undefined;
  }
}

export function confirmDialog(text: string, yes = 'Sì', no = 'Annulla'): Promise<boolean> {
  return new Promise((resolve) => {
    const d = h('dialog.dialog', {}, h('p', {}, text), h('div.row', {},
      h('button.btn', { onclick: () => close(false) }, no),
      h('button.btn.danger', { onclick: () => close(true) }, yes)));
    const close = (v: boolean) => {
      d.close();
      d.remove();
      resolve(v);
    };
    document.body.append(d);
    d.showModal();
  });
}

export function promptDialog(text: string, value = ''): Promise<string | null> {
  return new Promise((resolve) => {
    const input = h('input.input', { value, 'aria-label': text });
    const d = h('dialog.dialog', {}, h('label', {}, text, input), h('div.row', {},
      h('button.btn', { onclick: () => close(null) }, 'Annulla'),
      h('button.btn.primary', { onclick: () => close(input.value.trim()) }, 'OK')));
    input.addEventListener('keydown', (e) => e.key === 'Enter' && close(input.value.trim()));
    const close = (v: string | null) => {
      d.close();
      d.remove();
      resolve(v);
    };
    document.body.append(d);
    d.showModal();
    input.focus();
  });
}

export const formatBytes = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
export const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

export function budgetBar(bytes: number, limit: number) {
  const k = Math.min(1, bytes / limit);
  return h('div.budget', { title: `${formatBytes(bytes)} su ${formatBytes(limit)}` },
    h('div.budget-fill', { style: `width:${k * 100}%`, class: k > 0.9 ? 'warn' : '' }),
    h('span', {}, `${formatBytes(bytes)} / ${formatBytes(limit)}`));
}

/** Carica un file scelto dall'utente (o trascinato) verso un quadro. */
export function uploadBox(label: string, accept: string, onFile: (f: File) => Promise<void>) {
  const input = h('input', { type: 'file', accept, hidden: true });
  const box = h('label.upload', {}, h('strong', {}, label), h('span', {}, 'Clicca o trascina qui il file'), input);
  input.addEventListener('change', () => input.files?.[0] && void onFile(input.files[0]));
  box.addEventListener('dragover', (e) => {
    e.preventDefault();
    box.classList.add('over');
  });
  box.addEventListener('dragleave', () => box.classList.remove('over'));
  box.addEventListener('drop', (e) => {
    e.preventDefault();
    box.classList.remove('over');
    const f = e.dataTransfer?.files[0];
    if (f) void onFile(f);
  });
  return box;
}

// ---- Barra dei lavori lunghi (preparazione, verifica, pubblicazione) ----
const STEP_LABELS: Record<string, string> = {
  immagini: 'Preparo le immagini',
  tracking: 'Calcolo il riconoscimento del quadro',
  voce: 'Genero la voce demo',
  allineamento: 'Allineo audio e testo',
  audio: 'Comprimo l\'audio',
  profondita: 'Calcolo la profondità per l\'effetto 3D',
  video: 'Comprimo il video',
  anteprima: 'Creo l\'anteprima di revisione',
};
const JOB_LABELS: Record<string, string> = { prepara: 'Preparazione', verifica: 'Verifica', pubblica: 'Pubblicazione', cartella: 'Cartella per Cloudflare', 'anteprima-telefono': 'Anteprima sul telefono' };

export function initJobBar() {
  const bar = document.getElementById('jobbar')!;
  const text = bar.querySelector('.jobbar-text')!;
  const fill = bar.querySelector<HTMLElement>('.jobbar-fill')!;
  let current = '';
  onServerEvent((e) => {
    if (e.event === 'hello' && e.job) {
      current = String(e.job);
      bar.hidden = false;
      text.textContent = `${JOB_LABELS[current] ?? current} in corso…`;
    }
    if (e.event === 'job') {
      current = String(e.name);
      if (e.state === 'start') {
        bar.hidden = false;
        fill.style.width = '3%';
        text.textContent = `${JOB_LABELS[current] ?? current} in corso…`;
      } else {
        bar.hidden = true;
        if (e.state === 'error') toast(`${JOB_LABELS[current] ?? current}: ${e.message}`, 'ko');
        else toast(`${JOB_LABELS[current] ?? current} completata.`);
      }
    }
    if (e.event === 'pipeline' || e.event === 'verify' || e.event === 'publish' || e.event === 'tunnel') {
      const ev = e as Record<string, unknown>;
      if (ev.step && STEP_LABELS[String(ev.step)]) text.textContent = `${STEP_LABELS[String(ev.step)]}${ev.id ? ` · ${ev.id}` : ''}${ev.percent !== undefined ? ` (${ev.percent}%)` : ''}`;
      else if (ev.message) text.textContent = String(ev.message);
      else if (e.event === 'verify' && ev.step) text.textContent = `${ev.step}…`;
      if (typeof ev.percent === 'number') fill.style.width = `${Math.max(3, Number(ev.percent))}%`;
    }
  });
}

export async function refreshUndo() {
  const b = document.getElementById('undo')!;
  const { last } = await api<{ last: string | null }>('history').catch(() => ({ last: null }));
  b.hidden = !last;
  b.title = last ? `Annulla: ${last}` : '';
  b.textContent = last ? `↶ Annulla: ${last.length > 32 ? last.slice(0, 30) + '…' : last}` : '↶ Annulla';
}
