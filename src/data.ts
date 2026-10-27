// Contenuti generati da `npm run build:content` in public/data/.

export interface DettaglioMeta {
  id: string;
  label: string;
  crop: { x: number; y: number; w: number; h: number };
  targetIndex: number;
  image: string;
  points: number;
  trigger: ('target' | 'reticle')[];
}

export interface PaintingMeta {
  id: string;
  title: string;
  artist: string;
  year: string;
  room: string;
  experience: string;
  aspect: number;
  image: string;
  targets: { mind: string; main: { targetIndex: number; image: string; points: number } };
  dettagli: DettaglioMeta[];
}

export interface PaintingIndex {
  paintings: Pick<PaintingMeta, 'id' | 'title' | 'artist' | 'year' | 'room' | 'experience'>[];
}

const BASE = `${import.meta.env.BASE_URL}data/`;

export const dataUrl = (id: string, file: string) => `${BASE}${encodeURIComponent(id)}/${file}`;

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json() as Promise<T>;
}

export const loadIndex = () => getJson<PaintingIndex>(`${BASE}index.json`);
export const loadMeta = (id: string) => getJson<PaintingMeta>(dataUrl(id, 'meta.json'));
