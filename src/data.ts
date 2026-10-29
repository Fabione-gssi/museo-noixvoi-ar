// Contenuti generati da `npm run build:content` in public/data/ (schema: schema/meta.schema.json).
import type { Keyframe, Rect } from './story/timeline';

export type Experience = 'dettagli' | 'caccia' | 'personaggio' | 'racconto';

export interface DettaglioMeta {
  id: string;
  label: string;
  crop: Rect;
  targetIndex?: number;
  image?: string;
  points?: number;
  trigger: ('target' | 'reticle')[];
  thumb?: string;
  /** Contenuto (esperienza dettagli): pezzo dell'audio principale, file proprio o solo testo. */
  media: { type: 'audio' | 'video' | 'text'; src?: string; fallback?: string; audioSegment?: { from: number; to: number } };
  text: string;
  source?: string;
}

/** Elemento nascosto della caccia: punto (x, y 0-1), raggio in larghezze immagine, effetto. */
export interface CacciaItem {
  id: string;
  label: string;
  x: number;
  y: number;
  r: number;
  fx: 'glow' | 'ink' | 'zoom';
  media: DettaglioMeta['media'];
  text: string;
  source?: string;
}

export interface PaintingMeta {
  schemaVersion: 1;
  id: string;
  order: number;
  title: string;
  artist: string;
  year: string;
  room: string;
  experience: Experience;
  demo: boolean;
  aspect: number;
  image: string;
  depth?: string;
  audio?: { src: string; fallback: string; durationSec: number };
  subtitles?: string;
  alignment?: string;
  targets: { mind: string; main: { targetIndex: 0; image: string; points: number } };
  dettagli: DettaglioMeta[];
  caccia?: { lensRadius: number; items: CacciaItem[]; finale?: { media: DettaglioMeta['media']; text: string } };
  racconto?: { auto: boolean; video?: { src: string; fallback?: string }; timeline: Keyframe[] };
}

/** Voce dell'elenco dei quadri; files e version servono all'uso senza internet. */
export type PaintingEntry = Pick<PaintingMeta, 'id' | 'title' | 'artist' | 'year' | 'room' | 'experience' | 'demo'> & { bytes: number; version?: string; files?: [string, number][] };

export interface PaintingIndex {
  paintings: PaintingEntry[];
  totalBytes: number;
}

const BASE = `${import.meta.env.BASE_URL}data/`;

export const dataUrl = (id: string, file: string) => `${BASE}${encodeURIComponent(id)}/${file}`;

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json() as Promise<T>;
}

export const loadIndex = () => getJson<PaintingIndex>(`${BASE}index.json`);
export const loadMeta = (id: string) => getJson<PaintingMeta>(dataUrl(id, 'meta.json'));
