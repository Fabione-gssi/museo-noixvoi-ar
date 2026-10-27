// Benchmark della Fase 0: set di target per quadro vs set globale (~45 target).
// Misura tempo di caricamento, tempo al primo riconoscimento e fps.
import './style.css';
import { MindArTracker } from './tracker/MindArTracker';
import { unlockAll, attachCamera } from './media';

interface Config { name: string; file: string; maxTrack: number }
interface Result extends Config {
  loadMs: number;
  recognitionMs: number | null;
  trackerFps: number;
  renderFps: number;
  trackedShare: number;
}

const CONFIGS: Config[] = [
  { name: 'A. Set per quadro (3 target), maxTrack 1', file: 'arnolfini.mind', maxTrack: 1 },
  { name: 'B. Set globale (~45 target), maxTrack 1', file: 'global.mind', maxTrack: 1 },
  { name: 'C. Set per quadro, maxTrack 2', file: 'arnolfini.mind', maxTrack: 2 },
];
const RECOGNITION_TIMEOUT = 15000;
const MEASURE_MS = 8000;

const $ = (s: string) => document.querySelector(s) as HTMLElement;
const out = { results: [] as Result[], done: false, ua: navigator.userAgent, video: '' };
(window as unknown as { __bench: typeof out }).__bench = out;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

$('#run').addEventListener('click', async () => {
  const unlock = unlockAll();
  $('#run').hidden = true;
  const { camera, cameraError } = await unlock;
  if (!camera) return void ($('#log').textContent = cameraError ?? 'Fotocamera non disponibile');
  const video = $('#bench-camera') as HTMLVideoElement;
  await attachCamera(video, camera);
  out.video = `${video.videoWidth}x${video.videoHeight}`;
  for (const cfg of CONFIGS) {
    say(`${cfg.name}: carico…`);
    out.results.push(await runOne(cfg, video));
    render();
    await wait(1500);
  }
  out.done = true;
  say('Finito. Premi "Copia risultati" o fai uno screenshot.');
  $('#copy').hidden = false;
});

$('#copy').addEventListener('click', async () => {
  const text = JSON.stringify(out, null, 1);
  try {
    await navigator.clipboard.writeText(text);
    say('Copiato negli appunti.');
  } catch {
    say('Copia non riuscita: fai uno screenshot.');
  }
});

async function runOne(cfg: Config, video: HTMLVideoElement): Promise<Result> {
  let firstFound: number | null = null;
  let trackedFrames = 0;
  let frames = 0;
  const tracker = new MindArTracker({
    maxTrack: cfg.maxTrack,
    onFound: (i) => {
      if (i === 0 && firstFound === null) firstFound = performance.now();
    },
  });
  const t0 = performance.now();
  await tracker.load(`${import.meta.env.BASE_URL}bench/${cfg.file}`, video);
  const loadMs = performance.now() - t0;
  say(`${cfg.name}: inquadra il quadro…`);
  const start = performance.now();
  tracker.start();
  while (firstFound === null && performance.now() - start < RECOGNITION_TIMEOUT) await wait(50);
  say(`${cfg.name}: misuro gli fps…`);
  const mStart = performance.now();
  let trackerFpsSum = 0;
  let samples = 0;
  await new Promise<void>((resolve) => {
    const tick = () => {
      frames++;
      if (tracker.stats().tracking.includes(0)) trackedFrames++;
      if (performance.now() - mStart >= MEASURE_MS) return resolve();
      requestAnimationFrame(tick);
    };
    const sampler = setInterval(() => {
      const f = tracker.stats().trackerFps;
      if (f > 0) { trackerFpsSum += f; samples++; }
      if (performance.now() - mStart >= MEASURE_MS) clearInterval(sampler);
    }, 1000);
    requestAnimationFrame(tick);
  });
  tracker.dispose();
  return {
    ...cfg,
    loadMs: Math.round(loadMs),
    recognitionMs: firstFound === null ? null : Math.round(firstFound - start),
    trackerFps: samples ? Math.round((trackerFpsSum / samples) * 10) / 10 : 0,
    renderFps: Math.round((frames * 1000) / MEASURE_MS),
    trackedShare: frames ? Math.round((trackedFrames / frames) * 100) / 100 : 0,
  };
}

function say(t: string) {
  $('#log').textContent = t;
}

function render() {
  $('#results').innerHTML = out.results
    .map((r) => `<tr><td>${r.name}</td><td>${r.loadMs}</td><td>${r.recognitionMs ?? 'no'}</td><td>${r.trackerFps}</td><td>${Math.round(r.trackedShare * 100)}%</td></tr>`)
    .join('');
}
