import * as THREE from 'three';
import type { Rect } from './timeline';

// Racconto animato in tempo reale: l'immagine ad alta risoluzione su un quad a
// tutto schermo; lo shader inquadra un rettangolo dell'immagine (pan/zoom) e
// sposta leggermente i piani secondo la mappa di profondità (parallasse).
// "Quadro vivo": la parallasse ondeggia da sola, lentamente (come una camera
// che respira), e i piani in primo piano si dilatano appena, a ritmo di respiro.

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
uniform float uBreath;  // dilatazione dei piani vicini (respiro)
varying vec2 vUv;
void main() {
  vec2 uv = vec2(uView.x + vUv.x * uView.z, uView.y + (1.0 - vUv.y) * uView.w);
  // Profondità sfumata (livello di mipmap più basso): niente scalini sui bordi delle figure.
  float d = uHasDepth > 0.5 ? texture2D(uDepth, vec2(uv.x, 1.0 - uv.y), 2.5).r : 0.5;
  // I piani vicini (chiari) si spostano più dei lontani; scala con lo zoom.
  uv += uTilt * (d - 0.5) * uView.z;
  // Respiro: i piani vicini si dilatano attorno al centro dell'inquadratura.
  vec2 mid = uView.xy + uView.zw * 0.5;
  uv = mid + (uv - mid) * (1.0 - uBreath * smoothstep(0.45, 0.95, d));
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
        uBreath: { value: 0 },
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

  /** Intensità del "quadro vivo" (0 = immagine ferma salvo l'orientamento del telefono). */
  life = 1;

  render(view: Rect, fade = 1) {
    const t = performance.now() / 1000;
    // Ondeggiamento automatico della parallasse, sommato a quello del telefono.
    const orbit = new THREE.Vector2(Math.sin(t * 0.45) * 0.014, Math.sin(t * 0.31 + 1) * 0.009).multiplyScalar(this.life);
    this.tilt.lerp(orbit.add(this.tiltTarget), 0.08);
    this.material.uniforms.uBreath.value = (0.004 + 0.004 * Math.sin(t * 1.25)) * this.life;
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
