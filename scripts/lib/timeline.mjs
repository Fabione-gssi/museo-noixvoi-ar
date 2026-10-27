// Logica pura della pipeline: sottotitoli, ricerca di frasi nell'allineamento,
// sequenza dei movimenti di camera del racconto. Testata in tests/unit/.

/** Forma confrontabile di una parola: minuscole, senza accenti né apostrofi. */
export const norm = (w) => w.normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const tokens = (s) => (s.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []).map(norm).filter(Boolean);

/**
 * Tempo (s) della prima parola di `phrase` nell'allineamento, oppure null.
 * Le parole sono confrontate senza accenti e maiuscole.
 */
export function findPhraseTime(alignment, phrase) {
  const want = tokens(phrase);
  if (!want.length) return null;
  const flat = alignment.sentences.flatMap((s) => s.words.map((w) => ({ n: norm(w.w), start: w.start, end: w.end })));
  outer: for (let i = 0; i + want.length <= flat.length; i++) {
    for (let k = 0; k < want.length; k++) if (flat[i + k].n !== want[k]) continue outer;
    return { start: flat[i].start, end: flat[i + want.length - 1].end };
  }
  return null;
}

const FULL = { x: 0, y: 0, w: 1, h: 1 };

/**
 * Sequenza di inquadrature: all'inizio il quadro intero, poi ogni particolare
 * quando l'audio lo nomina (`ancora`), e il quadro intero sulle frasi indicate.
 * Un'inquadratura che arriva meno di MIN_GAP s dopo la precedente la sostituisce.
 */
export function buildTimeline(alignment, dettagli, fullPhrases = [], manual = null) {
  const MIN_GAP = 2.5;
  if (manual?.length) return { timeline: [...manual].sort((a, b) => a.t - b.t), missing: [] };
  const keys = [{ t: 0, action: 'cameraTo', args: { rect: FULL, label: '' }, source: 'inizio' }];
  const missing = [];
  for (const d of dettagli) {
    if (!d.ancora) continue;
    const hit = findPhraseTime(alignment, d.ancora);
    if (!hit) missing.push(d.ancora);
    else keys.push({ t: round(Math.max(0, hit.start - 0.3)), action: 'cameraTo', args: { rect: d.crop, label: d.label, id: d.id }, source: `ancora: "${d.ancora}"` });
  }
  for (const p of fullPhrases) {
    const hit = findPhraseTime(alignment, p);
    if (!hit) missing.push(p);
    else keys.push({ t: round(Math.max(0, hit.start - 0.3)), action: 'cameraTo', args: { rect: FULL, label: '' }, source: `ancora: "${p}"` });
  }
  keys.sort((a, b) => a.t - b.t);
  const out = [];
  for (const k of keys) {
    const prev = out[out.length - 1];
    if (out.length > 1 && k.t - prev.t < MIN_GAP) {
      // Due particolari nominati quasi insieme: un'unica inquadratura che li contiene entrambi.
      const both = prev.args.id && k.args.id;
      out[out.length - 1] = both
        ? { ...prev, args: { rect: union(prev.args.rect, k.args.rect), label: `${prev.args.label} · ${k.args.label}`, id: `${prev.args.id}+${k.args.id}` }, source: `${prev.source} + ${k.source}` }
        : k;
    } else out.push(k);
  }
  return { timeline: out, missing };
}

const round = (n) => Math.round(n * 100) / 100;

function union(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

function vttTime(s) {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}

/**
 * WebVTT da allineamento: una frase per sottotitolo, spezzata in parti di
 * massimo `maxChars` caratteri usando i tempi delle parole.
 */
export function toVtt(alignment, maxChars = 84) {
  const cues = [];
  for (const s of alignment.sentences) {
    let cur = [];
    const flush = () => {
      if (!cur.length) return;
      cues.push({ start: cur[0].start, end: cur[cur.length - 1].end, text: cur.map((w) => w.w).join(' ') });
      cur = [];
    };
    // Si lavora sulle parole del testo originale per conservare la punteggiatura.
    const parts = s.text.split(/\s+/);
    const words = alignWordsToParts(parts, s.words);
    for (const w of words) {
      const len = cur.reduce((n, x) => n + x.w.length + 1, 0);
      if (cur.length && len + w.w.length > maxChars) flush();
      cur.push(w);
    }
    flush();
  }
  return 'WEBVTT\n\n' + cues.map((c, i) => `${i + 1}\n${vttTime(c.start)} --> ${vttTime(Math.max(c.end, c.start + 0.5))}\n${c.text}\n`).join('\n');
}

/** Associa a ogni pezzo di testo (con punteggiatura) i tempi della parola allineata corrispondente. */
function alignWordsToParts(parts, words) {
  const out = [];
  let wi = 0;
  for (const p of parts) {
    const n = tokens(p);
    if (!n.length) {
      if (out.length) out[out.length - 1].w += ` ${p}`;
      continue;
    }
    const first = words[Math.min(wi, words.length - 1)];
    wi += n.length;
    const last = words[Math.min(wi - 1, words.length - 1)];
    out.push({ w: p, start: first.start, end: last.end });
  }
  return out;
}
