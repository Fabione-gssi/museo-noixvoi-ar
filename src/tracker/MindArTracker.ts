import { Controller } from 'mind-ar/dist/mindar-image.prod.js';
import type { Tracker, TrackerEvents, TrackerStats } from './Tracker';

export interface MindArOptions extends TrackerEvents {
  /** Target seguiti insieme. Con 1, mentre il quadro intero è agganciato i ritagli non vengono cercati. */
  maxTrack?: number;
}

export class MindArTracker implements Tracker {
  private controller?: Controller;
  private video?: HTMLVideoElement;
  private tracking = new Set<number>();
  private postMatrices: number[][] = [];
  private frames = 0;
  private fpsWindowStart = performance.now();
  private fps = 0;

  constructor(private opts: MindArOptions = {}) {}

  async load(targetsUrl: string, video: HTMLVideoElement) {
    this.video = video;
    this.controller = new Controller({
      inputWidth: video.videoWidth,
      inputHeight: video.videoHeight,
      maxTrack: this.opts.maxTrack ?? 1,
      onUpdate: (d) => {
        if (d.type === 'processDone') return this.countFrame();
        const i = d.targetIndex!;
        if (!d.worldMatrix) {
          if (this.tracking.delete(i)) this.opts.onLost?.(i);
          return;
        }
        if (!this.tracking.has(i)) {
          this.tracking.add(i);
          this.opts.onFound?.(i);
        }
        this.opts.onPose?.({ targetIndex: i, matrix: multiply(d.worldMatrix, this.postMatrices[i]) });
      },
    });
    const { dimensions } = await this.controller.addImageTargets(targetsUrl);
    // Come in mindar-image-three: porta l'unità a "larghezza del target = 1",
    // con l'origine al centro dell'immagine.
    this.postMatrices = dimensions.map(([w, h]) => [w, 0, 0, 0, 0, w, 0, 0, 0, 0, w, 0, w / 2, h / 2, 0, 1]);
    await this.controller.dummyRun(video);
    return { aspects: dimensions.map(([w, h]) => w / h) };
  }

  start() {
    this.controller?.processVideo(this.video!);
  }

  stop() {
    this.controller?.stopProcessVideo();
    for (const i of this.tracking) this.opts.onLost?.(i);
    this.tracking.clear();
  }

  dispose() {
    this.stop();
    this.controller?.dispose();
    this.controller = undefined;
  }

  projectionMatrix() {
    return this.controller!.getProjectionMatrix();
  }

  stats(): TrackerStats {
    return { trackerFps: this.fps, tracking: [...this.tracking] };
  }

  private countFrame() {
    this.frames++;
    const now = performance.now();
    if (now - this.fpsWindowStart >= 1000) {
      this.fps = (this.frames * 1000) / (now - this.fpsWindowStart);
      this.frames = 0;
      this.fpsWindowStart = now;
    }
  }
}

function multiply(a: number[], b: number[]) {
  const out = new Array<number>(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  return out;
}
