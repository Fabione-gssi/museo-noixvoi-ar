// Diagnostica del telefono: verifica con test reali (non per supposizione) ciò
// che su iOS Safari è incerto: sblocco audio/video con un solo tap e cambio di
// sorgente senza nuovo gesto, permesso orientamento, fotocamera, WebGL, storage.
import './style.css';
import { unlockAll, attachCamera, audioEl, mediaVideoEl } from './media';

type Status = 'ok' | 'ko' | 'warn';
const results: { name: string; status: Status; detail: string }[] = [];
(window as unknown as { __diag: unknown }).__diag = { results, done: false };
const $ = (s: string) => document.querySelector(s) as HTMLElement;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const asset = (f: string) => `${import.meta.env.BASE_URL}diag/${f}`;

function add(name: string, status: Status, detail = '') {
  results.push({ name, status, detail });
  const li = document.createElement('li');
  li.className = `diag-${status}`;
  li.textContent = `${status === 'ok' ? '✅' : status === 'warn' ? '⚠️' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`;
  $('#list').append(li);
}

async function playAfterDelay(el: HTMLMediaElement, src: string) {
  // Il ritardo simula il caso reale: il media parte dopo il riconoscimento,
  // lontano dal tap che ha sbloccato l'elemento.
  await wait(1200);
  el.src = src;
  try {
    await el.play();
    await wait(600);
    const ok = !el.paused && el.currentTime > 0;
    el.pause();
    return ok ? '' : 'avviato ma fermo';
  } catch (e) {
    return (e as Error).name || String(e);
  }
}

$('#run').addEventListener('click', async () => {
  const unlockP = unlockAll();
  $('#run').hidden = true;
  const u = await unlockP;

  add('Connessione sicura (https)', window.isSecureContext ? 'ok' : 'ko');
  if (u.camera) {
    const v = $('#cam') as HTMLVideoElement;
    await attachCamera(v, u.camera);
    const facing = u.camera.getVideoTracks()[0]?.getSettings().facingMode ?? 'n/d';
    add('Fotocamera', 'ok', `${v.videoWidth}x${v.videoHeight}, ${facing}`);
  } else add('Fotocamera', 'ko', u.cameraError ?? '');
  add('Sblocco audio al tap', u.audio ? 'ok' : 'ko');

  const a1 = await playAfterDelay(audioEl, asset('beep1.m4a'));
  add('Audio 1 (stesso elemento, nuova sorgente, senza tap)', a1 ? 'ko' : 'ok', a1);
  const a2 = await playAfterDelay(audioEl, asset('beep2.mp3'));
  add('Audio 2 (secondo cambio sorgente)', a2 ? 'ko' : 'ok', a2);
  const opus = audioEl.canPlayType('audio/ogg; codecs=opus') || audioEl.canPlayType('audio/webm; codecs=opus');
  add('Formato Opus supportato', opus ? 'ok' : 'warn', opus ? opus : 'serve il fallback M4A');

  $('#vid').append(mediaVideoEl);
  const v1 = await playAfterDelay(mediaVideoEl, asset('clip.mp4'));
  add('Video con audio (elemento sbloccato, senza tap)', v1 ? 'ko' : 'ok', v1);
  mediaVideoEl.remove();

  if (u.orientation === 'granted' || u.orientation === 'not-needed') {
    let got = false;
    const h = (e: DeviceOrientationEvent) => { if (e.beta !== null) got = true; };
    window.addEventListener('deviceorientation', h);
    await wait(1500);
    window.removeEventListener('deviceorientation', h);
    add('Giroscopio / orientamento', got ? 'ok' : 'warn', got ? u.orientation : 'nessun dato ricevuto');
  } else add('Giroscopio / orientamento', u.orientation === 'denied' ? 'warn' : 'ko', u.orientation);

  const gl = document.createElement('canvas').getContext('webgl2');
  add('WebGL2', gl ? 'ok' : 'ko');
  try {
    localStorage.setItem('diag', '1');
    localStorage.removeItem('diag');
    add('Memoria locale', 'ok');
  } catch {
    add('Memoria locale', 'warn', 'non disponibile (es. navigazione privata): l\'app funziona lo stesso');
  }
  add('Service worker (offline)', 'serviceWorker' in navigator ? 'ok' : 'warn');
  try {
    const ctx = new AudioContext();
    await ctx.resume();
    add('Web Audio', ctx.state === 'running' ? 'ok' : 'warn', ctx.state);
    ctx.close();
  } catch (e) {
    add('Web Audio', 'ko', String(e));
  }
  add('Browser', 'ok', navigator.userAgent);
  (window as unknown as { __diag: { done: boolean } }).__diag.done = true;
  $('#copy').hidden = false;
});

$('#copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(results.map((r) => `${r.status.toUpperCase()} ${r.name} ${r.detail}`).join('\n'));
    $('#copy').textContent = 'Copiato';
  } catch {
    $('#copy').textContent = 'Copia non riuscita: fai uno screenshot';
  }
});
