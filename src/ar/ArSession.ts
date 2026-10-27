import { ArView } from './ArView';
import { MindArTracker } from '../tracker/MindArTracker';
import { attachCamera } from '../media';

// Sessione AR comune a tutte le esperienze: fotocamera, tracker, vista,
// blocca/sblocca e tenuta della sovrapposizione quando il quadro si perde.

const LOST_GRACE_MS = 1500; // perso per meno di così: si mantiene l'ultima posa
const GYRO_HOLD_MS = 3000;  // poi per qualche secondo si compensa col giroscopio
const SNAPSHOT_EVERY_MS = 400;

export interface ArSessionOptions {
  container: HTMLElement;
  video: HTMLVideoElement;
  stream: MediaStream;
  targetsUrl: string;
  maxTrack?: number;
  onFound?: (targetIndex: number) => void;
  onLost?: (targetIndex: number) => void;
  onFrame?: () => void;
  onLockChange?: (locked: boolean, auto: boolean) => void;
}

export class ArSession {
  view!: ArView;
  tracker!: MindArTracker;
  aspects: number[] = [];
  locked = false;
  private lastPose = new Map<number, number[]>();
  private lostAt = new Map<number, number>();
  private snapshot = document.createElement('canvas');
  private lastSnapshot = 0;
  private gyro = { alpha: 0, beta: 0, gamma: 0, has: false };
  private gyroAtLost: typeof this.gyro | null = null;
  private running = false;
  private onOrientation = (e: DeviceOrientationEvent) => {
    if (e.beta === null) return;
    this.gyro = { alpha: e.alpha ?? 0, beta: e.beta, gamma: e.gamma ?? 0, has: true };
  };

  constructor(private o: ArSessionOptions) {}

  async start() {
    await attachCamera(this.o.video, this.o.stream);
    this.view = new ArView(this.o.container, this.o.video);
    this.tracker = new MindArTracker({
      maxTrack: this.o.maxTrack ?? 1,
      onFound: (i) => {
        this.lostAt.delete(i);
        this.o.onFound?.(i);
      },
      onLost: (i) => {
        // Non si nasconde subito: si tiene l'ultima posa (vedi tick).
        this.lostAt.set(i, performance.now());
        if (i === 0) this.gyroAtLost = { ...this.gyro };
        this.o.onLost?.(i);
      },
      onPose: ({ targetIndex, matrix }) => {
        this.lastPose.set(targetIndex, matrix);
        if (!this.locked) this.view.setPose(targetIndex, matrix);
      },
    });
    const { aspects } = await this.tracker.load(this.o.targetsUrl, this.o.video);
    this.aspects = aspects;
    this.view.setProjection(this.tracker.projectionMatrix());
    window.addEventListener('deviceorientation', this.onOrientation);
    this.snapshot.className = 'ar-snapshot';
    this.snapshot.hidden = true;
    this.o.container.append(this.snapshot);
  }

  run() {
    this.view.layout();
    this.tracker.start();
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.tick();
      this.o.onFrame?.();
      this.view.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  isTracking(i = 0) {
    return this.tracker.stats().tracking.includes(i);
  }

  private tick() {
    const now = performance.now();
    if (!this.locked && this.isTracking(0) && now - this.lastSnapshot > SNAPSHOT_EVERY_MS) this.takeSnapshot(now);
    if (this.locked) return;
    for (const [i, t] of this.lostAt) {
      const gone = now - t;
      if (gone < LOST_GRACE_MS) {
        const m = this.lastPose.get(i);
        if (m) this.view.setPose(i, m);
      } else if (i === 0 && gone < LOST_GRACE_MS + GYRO_HOLD_MS && this.gyro.has && this.gyroAtLost) {
        // Compensazione col giroscopio: sposta la sovrapposizione al contrario del movimento del telefono.
        const m = this.lastPose.get(0);
        if (m) {
          const dx = (this.gyro.gamma - this.gyroAtLost.gamma) * 0.012;
          const dy = (this.gyro.beta - this.gyroAtLost.beta) * 0.012;
          const shifted = [...m];
          shifted[12] -= dx * Math.abs(m[14]);
          shifted[13] += dy * Math.abs(m[14]);
          this.view.setPose(0, shifted);
        }
      } else {
        this.view.setPose(i, null);
        this.lostAt.delete(i);
        // Quadro perso da troppo: si passa da soli alla modalità bloccata sull'ultima inquadratura buona.
        // Non se da vicino è agganciato il ritaglio di un particolare.
        if (i === 0 && this.lastSnapshot && !this.tracker.stats().tracking.length) this.lock(true);
      }
    }
  }

  private takeSnapshot(now: number) {
    const v = this.o.video;
    if (!v.videoWidth) return;
    this.snapshot.width = v.videoWidth;
    this.snapshot.height = v.videoHeight;
    this.snapshot.getContext('2d')!.drawImage(v, 0, 0);
    this.snapshotPose = this.lastPose.get(0) ?? null;
    this.lastSnapshot = now;
  }
  private snapshotPose: number[] | null = null;

  /** Congela a schermo l'ultima inquadratura in cui il quadro era riconosciuto. */
  lock(auto = false) {
    if (this.locked) return;
    this.locked = true;
    this.tracker.stop();
    if (this.snapshotPose) {
      this.snapshot.setAttribute('style', this.o.video.getAttribute('style') ?? '');
      this.snapshot.hidden = false;
      this.view.setPose(0, this.snapshotPose);
    } else {
      this.o.video.pause();
    }
    this.o.onLockChange?.(true, auto);
  }

  unlock() {
    if (!this.locked) return;
    this.locked = false;
    this.snapshot.hidden = true;
    this.lostAt.clear();
    void this.o.video.play();
    this.view.setPose(0, null);
    this.tracker.start();
    this.o.onLockChange?.(false, false);
  }

  /** Ferma tracker e rendering; la fotocamera resta accesa per poter tornare all'AR. */
  stop() {
    this.running = false;
    this.tracker.dispose();
    this.view.dispose();
    this.snapshot.remove();
    window.removeEventListener('deviceorientation', this.onOrientation);
  }
}
