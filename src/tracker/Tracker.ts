// Interfaccia del motore di riconoscimento immagini. L'app dipende solo da
// questa: MindAR è una delle implementazioni e si può sostituire.

export interface TargetPose {
  targetIndex: number;
  /** Matrice 4x4 (column-major) già scalata: il target è un piano largo 1, centrato nell'origine. */
  matrix: number[];
}

export interface TrackerStats {
  /** Cicli di elaborazione al secondo del tracker (non del rendering). */
  trackerFps: number;
  tracking: number[];
}

export interface TrackerEvents {
  onFound?: (targetIndex: number) => void;
  onLost?: (targetIndex: number) => void;
  onPose?: (pose: TargetPose) => void;
}

export interface Tracker {
  /** Carica il set di target (es. file .mind) e prepara il motore sul video. */
  load(targetsUrl: string, video: HTMLVideoElement): Promise<{ aspects: number[] }>;
  start(): void;
  stop(): void;
  dispose(): void;
  /** Matrice di proiezione nelle coordinate del fotogramma video. */
  projectionMatrix(): number[];
  stats(): TrackerStats;
}
