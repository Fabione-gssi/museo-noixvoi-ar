// Chiamate al server locale dello Studio. Il token arriva nell'indirizzo
// aperto dall'avviatore e resta solo in questa scheda.

const params = new URLSearchParams(location.search);
const fromUrl = params.get('t');
if (fromUrl) {
  sessionStorage.setItem('studio-token', fromUrl);
  history.replaceState(null, '', location.pathname + location.hash);
}
export const TOKEN = fromUrl ?? sessionStorage.getItem('studio-token') ?? '';

export class ApiError extends Error {}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; raw?: Blob | ArrayBuffer } = {}): Promise<T> {
  const headers: Record<string, string> = { 'X-Studio-Token': TOKEN };
  let body: BodyInit | undefined;
  if (opts.raw) body = opts.raw;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const r = await fetch(`/api/${path}`, { method: opts.method ?? (body ? 'POST' : 'GET'), headers, body });
  const data = r.headers.get('content-type')?.includes('json') ? await r.json() : null;
  if (!r.ok) throw new ApiError(data?.error ?? `Errore ${r.status}`);
  return data as T;
}

/** URL di un file del quadro (immagine, audio, video), utilizzabile in <img>/<audio>. */
export const fileUrl = (folder: string, kind: string, extra = '') =>
  `/api/paintings/${encodeURIComponent(folder)}/file?kind=${kind}&t=${TOKEN}${extra}&v=${Date.now()}`;

export type JobEvent = { event: string; [k: string]: unknown };
const listeners = new Set<(e: JobEvent) => void>();
export const onServerEvent = (fn: (e: JobEvent) => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

function connect() {
  const es = new EventSource(`/api/events?t=${TOKEN}`);
  es.onmessage = (m) => {
    const e = JSON.parse(m.data) as JobEvent;
    for (const l of listeners) l(e);
  };
  es.onerror = () => {
    es.close();
    setTimeout(connect, 2000);
  };
}
connect();

export interface PaintingSummary {
  folder: string; id: string; order: number; title: string; artist: string; year: string; room: string;
  experience: string; voce: string; status: 'completo' | 'incompleto' | 'da-preparare'; missing: string[]; problems: string[];
  hasImage: boolean; hasText: boolean; audio: string | null; video: string | null; built: boolean; bytes: number;
}

export interface Rect { x: number; y: number; w: number; h: number }
export interface Keyframe { t: number; action: 'cameraTo'; args: { rect: Rect; label?: string; id?: string }; source?: string }
export interface Alignment { durationSec: number; sentences: { text: string; start: number; end: number; words: { w: string; start: number; end: number }[] }[] }

/** Particolare come scritto in contenuti/<quadro>/regioni.json. */
export interface RegionDetail {
  id: string;
  label: string;
  crop: Rect;
  ancora?: string;
  text?: string;
  media?: { type: 'segmento'; from: number; to: number } | { type: 'audio' | 'video'; file: string } | { type: 'testo' };
}

/** Elemento nascosto della caccia in regioni.json. */
export interface RegionHuntItem {
  id: string;
  label: string;
  x: number;
  y: number;
  r?: number;
  fx?: 'glow' | 'ink' | 'zoom';
  ancora?: string;
  text?: string;
  media?: RegionDetail['media'];
}

export interface RegionHunt {
  lensRadius?: number;
  items: RegionHuntItem[];
  finale?: { ancora?: string; text?: string; media?: RegionDetail['media'] };
}

export interface PaintingDetails extends PaintingSummary {
  text: string;
  pronuncia: string;
  regions: { dettagli: RegionDetail[]; caccia?: RegionHunt; racconto?: { inquadraturaIntera?: string[]; timeline?: Keyframe[] } };
  meta: null | {
    aspect: number; demo: boolean; audio?: { durationSec: number }; racconto?: { timeline: Keyframe[]; video?: unknown };
    budget?: { bytes: number; limit: number }; targets: { main: { points: number } };
    dettagli: { id: string; points?: number; trigger: string[]; text?: string; media?: { type: string; audioSegment?: { from: number; to: number } } }[];
    caccia?: { items: { id: string; text: string; media: { type: string; audioSegment?: { from: number; to: number } } }[]; finale?: { text: string; media: { type: string; audioSegment?: { from: number; to: number } } } };
  };
  alignment: Alignment | null;
  quality: null | { width: number; height: number; points?: number; tips: { level: string; text: string }[] };
  triage: Record<string, { score: number | null; note: string }>;
}
