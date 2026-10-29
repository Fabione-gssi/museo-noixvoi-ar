// Stato esposto per i test automatici e per la pagina ?debug=1 (window.__ar).

export const probe = {
  phase: 'welcome' as string,
  startedAt: 0,
  firstFoundMs: null as number | null,
  events: [] as { t: number; type: string; target?: string }[],
  renderFps: 0,
  trackerFps: 0,
  tracking: [] as string[],
  video: '',
  error: '',
  locked: false,
  storyTime: 0,
  /** Caccia: punto del quadro sotto il centro della lente (u, v 0-1). */
  lens: null as null | { u: number; v: number; rW: number },
  /** Personaggio: apertura attuale della bocca (0-1) e ultima risposta data. */
  mouth: 0,
  answer: '' as string,
};
(window as unknown as { __ar: typeof probe }).__ar = probe;

export const log = (type: string, target?: string) =>
  probe.events.push({ t: Math.round(performance.now() - probe.startedAt), type, target });
