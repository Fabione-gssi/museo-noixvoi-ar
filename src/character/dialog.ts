import Fuse from 'fuse.js';
import type { AudioRef, Personaggio } from '../data';

// Dialogo del personaggio, tutto sul telefono: nessuna intelligenza artificiale,
// nessuna rete. Le risposte sono preparate dal museo (con la loro fonte nel testo);
// la domanda scritta dal visitatore si confronta con le domande previste, le loro
// varianti e (con peso minore) le parole delle risposte. Tollera errori di
// battitura e sinonimi comuni. Se è incerto propone le domande più vicine ("forse
// volevi chiedere…"); se nulla corrisponde, dice onestamente che non sa rispondere.
//
// DialogEngine è l'interfaccia: un domani una conversazione "dal vivo" (vedi
// docs/ROADMAP_CONVERSAZIONE_LIVE.md) potrà implementarla senza cambiare l'app.

export interface Answer {
  /** id della domanda, 'nonso' o 'forse' (incerto: vedi suggestions). */
  id: string;
  question: string;
  text: string;
  audio?: AudioRef;
  known: boolean;
  suggestions?: { id: string; label: string }[];
}

export interface DialogEngine {
  suggestions(): { id: string; label: string }[];
  ask(text: string): Answer;
  byId(id: string): Answer;
}

/** Minuscole, senza accenti né punteggiatura. */
export function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

// Parole che non distinguono una domanda dall'altra. Le parole interrogative
// (chi, dove, quando, perché...) restano, con peso minore: dicono cosa si vuole sapere.
const STOP = new Set(normalize('il lo la i gli le l un uno una di del dello della dei degli delle d a al allo alla ai agli alle da dal dallo dalla dai '
  + 'in nel nello nella nei negli nelle con su sul sullo sulla sui per tra fra e ed o ma che mi ti si ci vi me te tu io noi voi lui lei '
  + 'è sono era eri c ce quel quella quello quei questo questa questi queste suo sua tuo tua tuoi tue mio mia miei mie hai ho ha '
  + 'puoi può dimmi dirmi raccontami parlami spiegami sai mai qui li là così poi anche non lo la essere stato stata').split(' '));
const QUESTION_WORDS = new Set(['chi', 'cosa', 'cos', 'come', 'dove', 'quando', 'perche', 'quanti', 'quante', 'quanto', 'quale', 'quali', 'qual']);

// Sinonimi comuni dell'italiano (non legati a un quadro): ogni parola diventa la
// sua parola "di riferimento", sia nelle domande previste sia in quelle scritte.
const PHRASES: [RegExp, string][] = [
  [/\bvuol(e)? dire\b/g, 'significa'],
  [/\bcome mai\b/g, 'perche'],
  [/\bper quale motivo\b/g, 'perche'],
  [/\bin che anno\b/g, 'quando anno'],
  [/\bchi (ti |vi |lo |la |l )?(ha|hanno) (dipint|ritratt)[oa]\b/g, 'chi pittore dipingere'],
  [/\b(ha|hai|ho|abbia|avete|hanno) dipint[oa]\b/g, 'dipingere'],
];
const SYNONYMS: Record<string, string[]> = {
  famiglia: ['padre', 'papa', 'babbo', 'madre', 'mamma', 'genitori', 'parenti'],
  quadro: ['dipinto', 'opera', 'tela', 'pittura', 'tavola', 'quadri', 'dipinti', 'opere'],
  dipingere: ['dipinse', 'dipingesti', 'dipinta', 'realizzato', 'realizzata', 'creato', 'creata', 'fatto', 'fatta', 'eseguito', 'ritratta', 'ritratto', 'ritrasse'],
  pittore: ['artista', 'autore', 'pittrice'],
  eta: ['vecchio', 'giovane', 'anziano'],
  vestito: ['vestiti', 'abito', 'abiti', 'veste', 'indossi', 'indossa', 'indossare', 'porti', 'vestita', 'vestire', 'abbigliamento'],
  scritta: ['scritto', 'scritte', 'iscrizione', 'iscrizioni', 'frase', 'parole', 'testo', 'motto', 'scrivere', 'scrivesti'],
  significa: ['significato', 'significano', 'significare', 'traduzione', 'tradotto', 'tradurre'],
  sposa: ['marito', 'sposo', 'sposata', 'sposato', 'sposasti', 'moglie', 'matrimonio', 'nozze', 'sposare', 'sposai', 'fidanzata', 'fidanzamento'],
  museo: ['galleria', 'pinacoteca', 'esposto', 'esposta', 'conservato', 'conservata'],
  nome: ['chiami', 'chiamavi', 'chiamava', 'chiama'],
  guardare: ['guardi', 'guarda', 'sguardo', 'occhi', 'fissi', 'osservi'],
  mano: ['mani', 'dita', 'dito', 'gesto'],
  pianta: ['albero', 'alberi', 'cespuglio', 'piante', 'foglie', 'rami'],
  perche: ['motivo'],
  quando: ['epoca', 'secolo', 'periodo', 'data'],
  manca: ['tagliato', 'tagliata', 'mancano', 'perduta', 'perso', 'persa', 'perduto', 'mancante'],
  comprare: ['comprato', 'comprata', 'acquistato', 'acquistata', 'acquisto', 'venduto', 'venduta'],
  tecnica: ['materiale', 'colori', 'olio'],
  nascere: ['nato', 'nata', 'nascesti', 'nascita', 'nacqui', 'nacque'],
  morire: ['morto', 'morta', 'morte', 'moristi', 'morii', 'mori'],
  maestro: ['apprendista', 'bottega', 'insegnante', 'allievo', 'imparato', 'imparare', 'studiato', 'studiare'],
  misura: ['grande', 'grandi', 'piccolo', 'piccola', 'misure', 'centimetri', 'dimensioni', 'dimensione', 'grandezza'],
  figli: ['figlio', 'figlia', 'figlie', 'bambini'],
  viaggio: ['viaggi', 'viaggiato', 'viaggiare', 'visitato', 'visitare'],
  libro: ['libri', 'trattato', 'trattati'],
  imperatore: ['imperatori', 'sovrano', 're'],
  america: ['americhe'],
};
const CANON = new Map(Object.entries(SYNONYMS).flatMap(([k, ws]) => ws.map((w) => [w, k] as [string, string])));

/** Radice grezza: senza vocale finale, così "anno/anni", "dipinto/dipinta" coincidono. */
const stem = (w: string) => (w.length > 3 ? w.replace(/[aeiou]$/, '') : w);

interface Token { stem: string; question: boolean }

/**
 * Opzioni: typos=false per i testi del museo (scritti giusti: "morto" non va
 * "corretto" in "motto"); known = parole che esistono nel testo e quindi non si
 * correggono; stop = altre parole da ignorare.
 */
export interface WordOptions { typos?: boolean; known?: Set<string>; stop?: Set<string> }

function words(s: string, o: WordOptions = {}): Token[] {
  let text = normalize(s);
  for (const [re, to] of PHRASES) text = text.replace(re, to);
  const seen = new Set<string>();
  const out: Token[] = [];
  for (const raw of text.split(' ')) {
    if (!raw || STOP.has(raw) || o.stop?.has(raw)) continue;
    const w = CANON.get(raw) ?? (o.typos === false || o.known?.has(raw) ? null : canonTypo(raw)) ?? raw;
    const t = { stem: stem(w), question: QUESTION_WORDS.has(w) };
    if (!seen.has(t.stem)) out.push(t);
    seen.add(t.stem);
  }
  return out;
}

export const tokens = (s: string, o?: WordOptions) => words(s, o).map((t) => t.stem);
/** Radici delle parole interrogative (chi, dove, quando…): dicono cosa si chiede, non di cosa. */
export const QUESTION_STEMS = new Set([...QUESTION_WORDS].map((w) => stem(CANON.get(w) ?? w)));

/** Sinonimo scritto con un errore di battitura ("chami" → "chiami" → nome). */
function canonTypo(raw: string) {
  if (raw.length < 5) return null;
  const max = raw.length >= 7 ? 2 : 1;
  for (const [w, k] of CANON) if (w[0] === raw[0] && Math.abs(w.length - raw.length) <= max && distance(w, raw) <= max) return k;
  return null;
}

/** Distanza di modifica (errori di battitura). */
function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

/** Una domanda prevista: parole delle domande e varianti, e parole della risposta (peso minore). */
interface Entry { id: string; all: Set<string>; answer: Set<string>; texts: string[][] }

const MIN_SCORE = 0.4;
/** Sotto MIN_SCORE ma sopra questa soglia: "forse volevi chiedere…". */
const MAYBE_SCORE = 0.2;
const ANSWER_WEIGHT = 0.55;

export class LocalQA implements DialogEngine {
  private entries: Entry[] = [];
  private idf = new Map<string, number>();
  private vocab: Fuse<string>;

  constructor(private p: Personaggio) {
    const df = new Map<string, number>();
    for (const q of p.domande) {
      const texts = [q.domanda, ...q.varianti].map((t) => tokens(t));
      const all = new Set(texts.flat());
      const answer = new Set(tokens(`${q.risposta} ${q.fonte ?? ''}`).filter((t) => !all.has(t)));
      this.entries.push({ id: q.id, all, answer, texts });
      for (const t of new Set([...all, ...answer])) df.set(t, (df.get(t) ?? 0) + 1);
    }
    for (const [t, n] of df) this.idf.set(t, Math.log(1 + this.entries.length / n));
    this.vocab = new Fuse([...df.keys()], { includeScore: true, threshold: 0.4, ignoreLocation: true });
  }

  suggestions() {
    return this.p.suggerite.map((id) => ({ id, label: this.label(id) }));
  }

  byId(id: string): Answer {
    const q = this.p.domande.find((d) => d.id === id);
    if (!q) return this.unknown('');
    return { id: q.id, question: q.domanda, text: q.risposta, audio: q.audio, known: true };
  }

  ask(text: string): Answer {
    const ranked = this.rank(text);
    const best = ranked[0];
    if (best && best.score >= MIN_SCORE) return { ...this.byId(best.id), question: text };
    // Per proporre domande serve che metà della domanda sia riconosciuta così com'è scritta.
    const close = ranked.filter((r) => r.score >= MAYBE_SCORE && r.exact).slice(0, 3);
    if (close.length) {
      return {
        id: 'forse',
        question: text,
        text: 'Non sono sicuro di aver capito. Forse volevi chiedere una di queste cose?',
        known: false,
        suggestions: close.map((r) => ({ id: r.id, label: this.label(r.id) })),
      };
    }
    return this.unknown(text);
  }

  /** La domanda prevista più vicina, con il suo punteggio (0-1), oppure null. */
  match(text: string): { id: string; score: number } | null {
    const best = this.rank(text)[0];
    return best && best.score >= MIN_SCORE ? best : null;
  }

  /** Tutte le domande previste con un punteggio, dalla più vicina. */
  rank(text: string): { id: string; score: number; exact: boolean }[] {
    const query = words(text).map((t) => ({ ...t, known: this.resolve(t.stem), fuzzy: !this.idf.has(t.stem) }));
    // Parole sconosciute pesano come quelle rare: una domanda fuori tema resta poco spiegata.
    const weight = (t: (typeof query)[number]) => (t.known ? this.idf.get(t.known)! : 0.6 * Math.log(1 + this.entries.length)) * (t.question ? 0.5 : 1);
    const total = query.reduce((n, t) => n + weight(t), 0);
    const onlyQuestions = query.every((t) => t.question);
    if (!total) return [];
    const out: { id: string; score: number; exact: boolean }[] = [];
    for (const e of this.entries) {
      const hit = query.filter((t) => t.known && e.all.has(t.known));
      const inAnswer = query.filter((t) => t.known && !t.question && e.answer.has(t.known));
      const content = [...hit, ...inAnswer].some((t) => !t.question);
      if (!content && !(onlyQuestions && hit.length)) continue;
      // Una parola corretta per errore di battitura conta meno di una scritta giusta;
      // una parola che compare solo nella risposta conta ancora meno.
      const got = hit.reduce((n, t) => n + weight(t) * (t.fuzzy ? 0.6 : 1), 0)
        + inAnswer.reduce((n, t) => n + weight(t) * ANSWER_WEIGHT * (t.fuzzy ? 0.6 : 1), 0);
      // Quanto della domanda è spiegato, e quanto della variante più vicina è stato toccato.
      const cover = Math.max(...e.texts.map((tx) => hit.filter((t) => tx.includes(t.known!)).length / Math.max(1, tx.length)));
      // "Esatto": metà almeno delle parole di contenuto della domanda trovate così come sono scritte.
      const contentWords = query.filter((t) => !t.question).length;
      const exactHits = new Set([...hit, ...inAnswer].filter((t) => !t.question && !t.fuzzy).map((t) => t.stem)).size;
      const exact = exactHits > 0 && exactHits >= contentWords / 2;
      out.push({ id: e.id, score: Math.min(1, got / total) * (0.7 + 0.3 * cover), exact });
    }
    return out.sort((a, b) => b.score - a.score);
  }

  /** Parola della domanda → parola nota: uguale, oppure con un errore di battitura (stessa iniziale). */
  private resolve(t: string) {
    if (this.idf.has(t)) return t;
    if (t.length < 4) return null;
    const max = t.length >= 7 ? 2 : 1;
    const hit = this.vocab.search(t).find((r) => r.item[0] === t[0] && distance(r.item, t) <= max);
    return hit?.item ?? null;
  }

  private label(id: string) {
    return this.p.domande.find((q) => q.id === id)?.domanda ?? id;
  }

  private unknown(question: string): Answer {
    return { id: 'nonso', question, text: this.p.nonSo.text, audio: this.p.nonSo.audio, known: false };
  }
}
