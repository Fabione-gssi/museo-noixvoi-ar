import { tokens, normalize, QUESTION_STEMS } from './dialog';

// Testo completo del museo sul personaggio ("approfondimento"), già diviso in
// passaggi dalla preparazione (scripts/lib/approfondimento.mjs). Qui si cercano
// i passaggi che rispondono alla domanda del visitatore, tutto sul telefono:
// BM25 sulle stesse parole del dialogo (sinonimi, radici, senza parole vuote).
// I passaggi trovati vanno all'assistente online, se c'è, o si leggono così come sono.

export interface Passage { id: string; section: string; text: string; fonte?: string }
export interface Approfondimento { chiParla: string; passages: Passage[] }

/** Nelle domande libere anche queste parole non dicono nulla sull'argomento. */
const STOP = new Set(['sei', 'ero', 'eravate', 'avevi', 'avete', 'davvero', 'veramente', 'proprio', 'ancora', 'molto', 'tanto', 'qualcosa', 'cosa', 'mai', 'stato', 'stata']);

export interface Hit { passage: Passage; score: number; cover: number }

/** Quota della domanda spiegata dal passaggio migliore sotto cui non si risponde. */
export const MIN_COVER = 0.5;

export class PassageSearch {
  private docs: { p: Passage; tf: Map<string, number>; len: number }[];
  private idf = new Map<string, number>();
  private avg: number;
  private known: Set<string>;

  constructor(passages: Passage[]) {
    this.known = new Set(passages.flatMap((p) => normalize(`${p.section} ${p.text}`).split(' ')));
    this.docs = passages.map((p) => {
      const words = tokens(`${p.section} ${p.text}`, { typos: false });
      const tf = new Map<string, number>();
      for (const w of words) tf.set(w, (tf.get(w) ?? 0) + 1);
      return { p, tf, len: words.length };
    });
    const df = new Map<string, number>();
    for (const d of this.docs) for (const w of d.tf.keys()) df.set(w, (df.get(w) ?? 0) + 1);
    const n = this.docs.length;
    for (const [w, k] of df) this.idf.set(w, Math.log(1 + (n - k + 0.5) / (k + 0.5)));
    this.avg = this.docs.reduce((s, d) => s + d.len, 0) / Math.max(1, n);
  }

  /** I passaggi più pertinenti (al massimo k), con il punteggio BM25 e la quota di domanda spiegata. */
  search(question: string, k = 3): Hit[] {
    const q = tokens(question, { known: this.known, stop: STOP });
    // Parole mai viste nel testo pesano come le più rare: la domanda fuori tema resta poco spiegata.
    // Le parole interrogative contano poco: "quando" non deve stare scritto nel passaggio.
    const maxIdf = Math.max(1, ...this.idf.values());
    const weight = (w: string) => (this.idf.get(w) ?? maxIdf) * (QUESTION_STEMS.has(w) ? 0.15 : 1);
    const total = q.reduce((s, w) => s + weight(w), 0);
    if (!total) return [];
    const hits: Hit[] = [];
    for (const d of this.docs) {
      let score = 0;
      let got = 0;
      for (const w of q) {
        const f = d.tf.get(w);
        if (!f) continue;
        got += weight(w);
        score += weight(w) * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * d.len / this.avg));
      }
      if (score > 0) hits.push({ passage: d.p, score, cover: got / total });
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, k);
  }
}

/** Sopra questo punteggio la domanda prevista vince sempre: ha la risposta preparata con la sua voce. */
const STRONG_QA = 0.6;

/**
 * Risposta preparata o testo del museo? qaScore = punteggio della domanda
 * prevista più vicina (null se nessuna). Vince il passaggio quando spiega la
 * domanda meglio di quanto faccia la domanda prevista ("Sei mai stato in
 * Italia?" non è "Chi sei?").
 */
export function preferPassage(qaScore: number | null, hit: Hit | undefined) {
  if (!hit || hit.cover < MIN_COVER) return false;
  return qaScore === null || (qaScore < STRONG_QA && hit.cover > qaScore);
}
