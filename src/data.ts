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
  audioSegment?: { from: number; to: number };
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
  racconto?: { auto: boolean; video?: { src: string; fallback?: string }; timeline: Keyframe[] };
}

export interface PaintingIndex {
  paintings: (Pick<PaintingMeta, 'id' | 'title' | 'artist' | 'year' | 'room' | 'experience' | 'demo'> & { bytes: number })[];
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
