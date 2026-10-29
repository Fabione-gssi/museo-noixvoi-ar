import * as THREE from 'three';
import type { Rect } from './timeline';

// Racconto animato in tempo reale: l'immagine ad alta risoluzione su un quad a
// tutto schermo; lo shader inquadra un rettangolo dell'immagine (pan/zoom) e
// sposta leggermente i piani secondo la mappa di profondità (parallasse).

const vertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const fragment = /* glsl */ `
precision highp float;
uniform sampler2D uImage;
uniform sampler2D uDepth;
uniform vec4 uView;     // x, y, w, h nell'immagine (0-1, y verso il basso)
uniform vec2 uTilt;     // spostamento di parallasse
uniform float uHasDepth;
uniform float uFade;
varying vec2 vUv;
void main() {
  vec2 uv = vec2(uView.x + vUv.x * uView.z, uView.y + (1.0 - vUv.y) * uView.w);
  float d = uHasDepth > 0.5 ? texture2D(uDepth, vec2(uv.x, 1.0 - uv.y)).r : 0.5;
  // I piani vicini (chiari) si spostano più dei lontani; scala con lo zoom.
  uv += uTilt * (d - 0.5) * uView.z;
  vec3 bg = vec3(0.07, 0.065, 0.06);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(bg * uFade, 1.0); return; }
  vec3 c = texture2D(uImage, vec2(uv.x, 1.0 - uv.y)).rgb;
  // Vignettatura leggera.
  float v = smoothstep(1.15, 0.35, length(vUv - 0.5) * 1.4);
  gl_FragColor = vec4(c * mix(0.78, 1.0, v) * uFade, 1.0);
  // Texture in sRGB: lo shader lavora in lineare, qui si torna allo spazio dello schermo.
  #include <colorspace_fragment>
}
`;

export class StoryRenderer {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private material: THREE.ShaderMaterial;
  private tilt = new THREE.Vector2();
  private tiltTarget = new THREE.Vector2();
  private orientationBase: { beta: number; gamma: number } | null = null;
  private onOrientation = (e: DeviceOrientationEvent) => {
    if (e.beta === null || e.gamma === null) return;
    this.orientationBase ??= { beta: e.beta, gamma: e.gamma };
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    this.tiltTarget.set(clamp((e.gamma - this.orientationBase.gamma) / 25) * 0.02, clamp((e.beta - this.orientationBase.beta) / 25) * 0.02);
  };

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    Object.assign(this.renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
    container.prepend(this.renderer.domElement);
    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        uImage: { value: null },
        uDepth: { value: null },
        uView: { value: new THREE.Vector4(0, 0, 1, 1) },
        uTilt: { value: this.tilt },
        uHasDepth: { value: 0 },
        uFade: { value: 1 },
      },
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
    window.addEventListener('deviceorientation', this.onOrientation);
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  async load(imageUrl: string, depthUrl?: string) {
    const loader = new THREE.TextureLoader();
    const img = await loader.loadAsync(imageUrl);
    img.colorSpace = THREE.SRGBColorSpace;
    img.minFilter = THREE.LinearMipmapLinearFilter;
    img.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.material.uniforms.uImage.value = img;
    if (depthUrl) {
      try {
        this.material.uniforms.uDepth.value = await loader.loadAsync(depthUrl);
        this.material.uniforms.uHasDepth.value = 1;
      } catch {
        // Senza profondità il racconto funziona lo stesso, senza parallasse.
      }
    }
  }

  get aspect() {
    return this.container.clientWidth / Math.max(1, this.container.clientHeight);
  }

  resize() {
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight, false);
  }

  render(view: Rect, fade = 1) {
    this.tilt.lerp(this.tiltTarget, 0.08);
    (this.material.uniforms.uView.value as THREE.Vector4).set(view.x, view.y, view.w, view.h);
    this.material.uniforms.uFade.value = fade;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('deviceorientation', this.onOrientation);
    (this.material.uniforms.uImage.value as THREE.Texture | null)?.dispose();
    (this.material.uniforms.uDepth.value as THREE.Texture | null)?.dispose();
    this.material.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
