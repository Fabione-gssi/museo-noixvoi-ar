// Fotocamera, audio e orientamento: tutto va sbloccato dentro lo stesso tap.
// Su iOS ogni nuovo elemento <audio>/<video> richiede un suo gesto, quindi
// l'app usa un solo elemento audio e un solo elemento video e ne cambia la sorgente.

// WAV di 0,1 s di silenzio: serve solo a "sbloccare" l'elemento audio.
const SILENCE = URL.createObjectURL(new Blob([silentWav(800)], { type: 'audio/wav' }));

function silentWav(samples: number) {
  const b = new DataView(new ArrayBuffer(44 + samples));
  const str = (o: number, t: string) => [...t].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); b.setUint32(4, 36 + samples, true); str(8, 'WAVEfmt ');
  b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
  b.setUint32(24, 8000, true); b.setUint32(28, 8000, true); b.setUint16(32, 1, true); b.setUint16(34, 8, true);
  str(36, 'data'); b.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) b.setUint8(44 + i, 128);
  return b.buffer;
}

export const audioEl = document.createElement('audio');
audioEl.preload = 'auto';
export const mediaVideoEl = document.createElement('video');
mediaVideoEl.playsInline = true;
mediaVideoEl.setAttribute('playsinline', '');
mediaVideoEl.preload = 'auto';

export interface UnlockResult {
  camera: MediaStream | null;
  cameraError?: string;
  audio: boolean;
  orientation: 'granted' | 'denied' | 'not-needed' | 'unsupported';
}

/** Da chiamare direttamente nel gestore del tap, senza await prima. */
export async function unlockAll(): Promise<UnlockResult> {
  // Avvio sincrono di tutte le richieste che esigono il gesto: un await
  // precedente farebbe perdere l'"attivazione utente" su Safari.
  const audioP = playSilently(audioEl);
  const videoP = playSilently(mediaVideoEl);
  const orientP = requestOrientation();
  const sim = simulatedCamera();
  const camP = sim
    ? Promise.resolve(sim)
    : navigator.mediaDevices?.getUserMedia
    ? navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      })
    : Promise.reject(new Error('getUserMedia non disponibile (serve https)'));

  const [audio, , orientation, cam] = await Promise.all([
    audioP,
    videoP,
    orientP,
    camP.then((s) => ({ s, e: undefined }), (e: unknown) => ({ s: null, e: describeCameraError(e) })),
  ]);
  return { camera: cam.s, cameraError: cam.e, audio, orientation };
}

/**
 * Fotocamera simulata dello Studio (anteprima): con ?simcam=1 l'app usa lo
 * stream offerto dalla pagina che la contiene, se è della stessa origine.
 */
function simulatedCamera(): MediaStream | null {
  if (!new URLSearchParams(location.search).has('simcam')) return null;
  try {
    const s = (window.parent as unknown as { __studioSimCamera?: MediaStream }).__studioSimCamera;
    return s ? new MediaStream(s.getVideoTracks().map((t) => t.clone())) : null;
  } catch {
    return null;
  }
}

async function playSilently(el: HTMLMediaElement) {
  try {
    el.muted = false;
    el.src = SILENCE;
    await el.play();
    el.pause();
    return true;
  } catch {
    return false;
  }
}

async function requestOrientation(): Promise<UnlockResult['orientation']> {
  const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
  if (!DOE) return 'unsupported';
  if (typeof DOE.requestPermission !== 'function') return 'not-needed';
  try {
    return (await DOE.requestPermission()) === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

function describeCameraError(e: unknown) {
  const name = (e as { name?: string })?.name ?? '';
  if (name === 'NotAllowedError') return 'Permesso fotocamera negato. Consentilo nelle impostazioni del browser e ricarica la pagina.';
  if (name === 'NotFoundError') return 'Nessuna fotocamera trovata.';
  if (name === 'NotReadableError') return 'La fotocamera è usata da un\'altra app.';
  return `Fotocamera non disponibile (${name || String(e)}).`;
}

export function attachCamera(video: HTMLVideoElement, stream: MediaStream) {
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.srcObject = stream;
  return new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => {
      // MindAR legge gli attributi width/height (non videoWidth) per copiare il fotogramma.
      video.width = video.videoWidth;
      video.height = video.videoHeight;
      video.play().then(() => resolve(), reject);
    };
  });
}
