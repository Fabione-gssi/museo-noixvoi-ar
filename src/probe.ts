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
};
(window as unknown as { __ar: typeof probe }).__ar = probe;

export const log = (type: string, target?: string) =>
  probe.events.push({ t: Math.round(performance.now() - probe.startedAt), type, target });
