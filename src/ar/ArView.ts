import * as THREE from 'three';

// Vista AR: il video della fotocamera riempie lo schermo ("cover") e il canvas
// three.js ha esattamente la stessa posizione e dimensione del video, così la
// matrice di proiezione del tracker si usa senza correzioni.

export interface Rect { x: number; y: number; w: number; h: number }

export class ArView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera();
  /** Un gruppo per targetIndex; visibile solo quando il target è agganciato. */
  readonly anchors = new Map<number, THREE.Group>();
  private box = { left: 0, top: 0, width: 0, height: 0 };
  private frames = 0;
  private fpsStart = performance.now();
  renderFps = 0;
  /** Scala della risoluzione di rendering; scende se gli fps non reggono. */
  private pixelRatio = Math.min(window.devicePixelRatio, 2);

  private onResize = () => this.layout();

  constructor(private container: HTMLElement, private video: HTMLVideoElement) {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(this.pixelRatio);
    Object.assign(this.renderer.domElement.style, { position: 'absolute', pointerEvents: 'none' });
    container.append(this.renderer.domElement);
    this.camera.matrixAutoUpdate = false;
    window.addEventListener('resize', this.onResize);
  }

  setProjection(proj: number[]) {
    this.camera.projectionMatrix.fromArray(proj);
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    this.layout();
  }

  layout() {
    const cw = this.container.clientWidth;
    const ch = this.container.clientHeight;
    const vr = this.video.videoWidth / this.video.videoHeight || 16 / 9;
    let w = cw;
    let h = cw / vr;
    if (h < ch) {
      h = ch;
      w = ch * vr;
    }
    this.box = { left: (cw - w) / 2, top: (ch - h) / 2, width: w, height: h };
    for (const el of [this.video, this.renderer.domElement]) {
      Object.assign(el.style, { position: 'absolute', left: `${this.box.left}px`, top: `${this.box.top}px`, width: `${w}px`, height: `${h}px` });
    }
    this.renderer.setSize(w, h, false);
  }

  anchor(targetIndex: number) {
    let g = this.anchors.get(targetIndex);
    if (!g) {
      g = new THREE.Group();
      g.matrixAutoUpdate = false;
      g.visible = false;
      this.scene.add(g);
      this.anchors.set(targetIndex, g);
    }
    return g;
  }

  setPose(targetIndex: number, matrix: number[] | null) {
    const g = this.anchor(targetIndex);
    g.visible = matrix !== null;
    if (matrix) g.matrix.fromArray(matrix);
    g.matrixWorldNeedsUpdate = true;
  }

  /** Proietta un punto dello spazio di un ancoraggio in pixel dello schermo (viewport). */
  toScreen(targetIndex: number, local: THREE.Vector3) {
    const g = this.anchors.get(targetIndex);
    if (!g?.visible) return null;
    const p = local.clone().applyMatrix4(g.matrix).applyMatrix4(this.camera.projectionMatrix);
    return { x: this.box.left + ((p.x + 1) / 2) * this.box.width, y: this.box.top + ((1 - p.y) / 2) * this.box.height };
  }

  render() {
    this.renderer.render(this.scene, this.camera);
    this.frames++;
    const now = performance.now();
    if (now - this.fpsStart >= 1000) {
      this.renderFps = (this.frames * 1000) / (now - this.fpsStart);
      this.frames = 0;
      this.fpsStart = now;
      this.adaptResolution();
    }
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material | undefined)?.dispose?.();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private adaptResolution() {
    if (this.renderFps > 0 && this.renderFps < 24 && this.pixelRatio > 1) {
      this.pixelRatio = Math.max(1, this.pixelRatio - 0.5);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.layout();
    }
  }
}

/** Cornice luminosa che evidenzia un rettangolo (in unità del target). */
export function makeFrame(w: number, h: number, color = 0xffd166) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, -h / 2).lineTo(w / 2, -h / 2).lineTo(w / 2, h / 2).lineTo(-w / 2, h / 2).lineTo(-w / 2, -h / 2);
  // Spessore proporzionato ma limitato: sui riquadri grandi una cornice spessa copre il quadro.
  const t = Math.min(Math.min(w, h) * 0.04, 0.007);
  const hole = new THREE.Path();
  hole.moveTo(-w / 2 + t, -h / 2 + t).lineTo(-w / 2 + t, h / 2 - t).lineTo(w / 2 - t, h / 2 - t).lineTo(w / 2 - t, -h / 2 + t).lineTo(-w / 2 + t, -h / 2 + t);
  shape.holes.push(hole);
  return new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
}
