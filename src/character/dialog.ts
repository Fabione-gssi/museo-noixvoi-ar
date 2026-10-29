import Fuse from 'fuse.js';
import type { AudioRef, Personaggio } from '../data';

// Dialogo del personaggio, tutto sul telefono: nessuna intelligenza artificiale,
// nessuna rete. Le risposte sono preparate dal museo (con la loro fonte nel testo);
// la domanda scritta dal visitatore si confronta con le domande previste e le loro
// varianti, tollerando errori di battitura. Se nulla corrisponde abbastanza, il
// personaggio dice onestamente che non sa rispondere.
//
// DialogEngine è l'interfaccia: un domani una conversazione "dal vivo" (vedi
// docs/ROADMAP_CONVERSAZIONE_LIVE.md) potrà implementarla senza cambiare l'app.

export interface Answer { id: string; question: string; text: string; audio?: AudioRef; known: boolean }

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
  + 'puoi può dimmi dirmi raccontami sai mai qui li là così poi anche non').split(' '));
const QUESTION_WORDS = new Set(['chi', 'cosa', 'cos', 'come', 'dove', 'quando', 'perche', 'quanti', 'quante', 'quanto', 'quale', 'quali', 'qual']);

/** Radice grezza: senza vocale finale, così "anno/anni", "dipinto/dipinta" coincidono. */
const stem = (w: string) => (w.length > 3 ? w.replace(/[aeiou]$/, '') : w);

interface Token { stem: string; question: boolean }

function words(s: string): Token[] {
  const seen = new Set<string>();
  const out: Token[] = [];
  for (const w of normalize(s).split(' ')) {
    if (!w || STOP.has(w)) continue;
    const t = { stem: stem(w), question: QUESTION_WORDS.has(w) };
    if (!seen.has(t.stem)) out.push(t);
    seen.add(t.stem);
  }
  return out;
}

export const tokens = (s: string) => words(s).map((t) => t.stem);

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

interface Entry { id: string; all: Set<string>; texts: string[][] }

const MIN_SCORE = 0.4;

export class LocalQA implements DialogEngine {
  private entries: Entry[] = [];
  private idf = new Map<string, number>();
  private vocab: Fuse<string>;

  constructor(private p: Personaggio) {
    const df = new Map<string, number>();
    for (const q of p.domande) {
      const texts = [q.domanda, ...q.varianti].map(tokens);
      const all = new Set(texts.flat());
      this.entries.push({ id: q.id, all, texts });
      for (const t of all) df.set(t, (df.get(t) ?? 0) + 1);
    }
    for (const [t, n] of df) this.idf.set(t, Math.log(1 + this.entries.length / n));
    this.vocab = new Fuse([...df.keys()], { includeScore: true, threshold: 0.4, ignoreLocation: true });
  }

  suggestions() {
    return this.p.suggerite.map((id) => ({ id, label: this.p.domande.find((q) => q.id === id)?.domanda ?? id }));
  }

  byId(id: string): Answer {
    const q = this.p.domande.find((d) => d.id === id);
    if (!q) return this.unknown('');
    return { id: q.id, question: q.domanda, text: q.risposta, audio: q.audio, known: true };
  }

  ask(text: string): Answer {
    const best = this.match(text);
    return best ? { ...this.byId(best.id), question: text } : this.unknown(text);
  }

  /** La domanda prevista più vicina, con il suo punteggio (0-1), oppure null. */
  match(text: string): { id: string; score: number } | null {
    const query = words(text).map((t) => ({ ...t, known: this.resolve(t.stem), fuzzy: !this.idf.has(t.stem) }));
    // Parole sconosciute pesano come quelle rare: una domanda fuori tema resta poco spiegata.
    const weight = (t: (typeof query)[number]) => (t.known ? this.idf.get(t.known)! : 0.6 * Math.log(1 + this.entries.length)) * (t.question ? 0.5 : 1);
    const total = query.reduce((n, t) => n + weight(t), 0);
    const onlyQuestions = query.every((t) => t.question);
    if (!total) return null;
    let best: { id: string; score: number } | null = null;
    for (const e of this.entries) {
      const hit = query.filter((t) => t.known && e.all.has(t.known));
      if (!hit.length || (!onlyQuestions && hit.every((t) => t.question))) continue;
      // Una parola corretta per errore di battitura conta meno di una scritta giusta.
      const got = hit.reduce((n, t) => n + weight(t) * (t.fuzzy ? 0.6 : 1), 0);
      // Quanto della domanda è spiegato, e quanto della variante più vicina è stato toccato.
      const cover = Math.max(...e.texts.map((tx) => hit.filter((t) => tx.includes(t.known!)).length / Math.max(1, tx.length)));
      const score = (got / total) * (0.7 + 0.3 * cover);
      if (!best || score > best.score) best = { id: e.id, score };
    }
    return best && best.score >= MIN_SCORE ? best : null;
  }

  /** Parola della domanda → parola nota: uguale, oppure con un errore di battitura (stessa iniziale). */
  private resolve(t: string) {
    if (this.idf.has(t)) return t;
    if (t.length < 4) return null;
    const max = t.length >= 7 ? 2 : 1;
    const hit = this.vocab.search(t).find((r) => r.item[0] === t[0] && distance(r.item, t) <= max);
    return hit?.item ?? null;
  }

  private unknown(question: string): Answer {
    return { id: 'nonso', question, text: this.p.nonSo.text, audio: this.p.nonSo.audio, known: false };
  }
}
