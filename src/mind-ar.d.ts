declare module 'mind-ar/dist/mindar-image.prod.js' {
  export interface MindUpdate {
    type: 'updateMatrix' | 'processDone';
    targetIndex?: number;
    worldMatrix?: number[] | null;
  }
  export class Controller {
    constructor(opts: {
      inputWidth: number;
      inputHeight: number;
      onUpdate?: (d: MindUpdate) => void;
      maxTrack?: number;
      warmupTolerance?: number | null;
      missTolerance?: number | null;
      filterMinCF?: number | null;
      filterBeta?: number | null;
    });
    inputWidth: number;
    inputHeight: number;
    addImageTargets(url: string): Promise<{ dimensions: [number, number][] }>;
    dummyRun(input: HTMLVideoElement): Promise<void>;
    processVideo(input: HTMLVideoElement): void;
    stopProcessVideo(): void;
    getProjectionMatrix(): number[];
    dispose(): void;
  }
}
