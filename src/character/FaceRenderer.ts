import * as THREE from 'three';
import type { Personaggio } from '../data';
import type { Rect } from '../story/timeline';

// Volto animato in tempo reale. L'immagine ad alta risoluzione su un quad a
// tutto schermo; lo shader deforma l'immagine attorno ai punti del volto
// (deformazione all'indietro: ogni pixel legge il colore da un punto spostato):
// - bocca: la mascella scende seguendo il volume della voce, tra le labbra si apre il buio;
// - palpebre: la pelle sopra l'occhio scende sull'occhio (battito di ciglia);
// - sguardo: l'iride si sposta verso chi guarda (orientamento del telefono);
// - labbra: più strette e tonde sulle vocali o/u (forma calcolata dal testo);
// - sopracciglia: si alzano appena sulle sillabe accentate;
// - testa: annuisce mentre parla, oscilla e si gira un poco verso chi guarda
//   (la rotazione usa la profondità: il naso si sposta più delle orecchie);
// - quadro vivo: respiro, parallasse che ondeggia, capelli e vesti appena mossi.
// In modalità "presenza" restano sguardo, testa, respiro e sfondo: niente bocca, palpebre, sopracciglia.

const vertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const fragment = /* glsl */ `
precision highp float;
uniform sampler2D uImage;
uniform sampler2D uDepth;
uniform vec4 uView;       // x, y, w, h nell'immagine (0-1, y verso il basso)
uniform vec2 uTilt;
uniform float uHasDepth;
uniform float uAspect;    // larghezza / altezza dell'immagine
uniform float uBreath;
uniform float uHasFace;
uniform vec2 uMouthC;     // centro della bocca (spazio isotropo: x * aspect)
uniform vec2 uMouthAxis;  // direzione da angolo sinistro a destro
uniform float uMouthHalf; // metà larghezza della bocca
uniform float uChin;      // distanza labbra-mento
uniform float uOpen;      // apertura (stesse unità)
uniform vec4 uEyeL;       // centro x, y, metà larghezza, metà altezza
uniform vec4 uEyeR;
uniform vec2 uIrisL;
uniform vec2 uIrisR;
uniform float uLid;       // 0 aperto, 1 chiuso
uniform vec2 uGaze;       // -1..1
uniform float uTime;
uniform vec3 uHead;       // girata, cenno, inclinazione (-1..1)
uniform vec2 uFaceC;      // centro della testa (spazio isotropo)
uniform vec2 uFaceR;      // raggi della testa
uniform vec2 uNeck;       // perno del collo
uniform float uBrow;      // sopracciglia alzate (0..1)
uniform float uRound;     // labbra tonde (0..1)
uniform float uLife;      // intensità di sfondo e vesti che si muovono
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

vec2 eyeWarp(vec2 p, vec4 eye, vec2 iris, inout float lash) {
  vec2 q = p - eye.xy;
  float nx = q.x / eye.z;
  float ny = q.y / eye.w;
  if (abs(nx) > 1.7 || ny > 1.6 || ny < -7.0) return p;
  float ex = clamp(1.0 - nx * nx, 0.0, 1.0);
  // Sopracciglia: la fascia sopra l'occhio sale (la pelle sotto si stira).
  if (uBrow > 0.01) {
    float bx = clamp(1.0 - pow(nx / 1.6, 2.0), 0.0, 1.0);
    float band = smoothstep(-7.0, -4.0, ny) * (1.0 - smoothstep(-2.2, -1.1, ny)) * bx;
    p.y += uBrow * eye.w * 0.7 * band;
  }
  // Sguardo: si sposta solo un cerchio attorno all'iride (raggio ~ metà altezza
  // dell'occhio), così palpebre e angoli restano fermi.
  float r = eye.w * 1.25;
  vec2 qi = (p - iris) / r;
  float bump = clamp(1.0 - dot(qi, qi), 0.0, 1.0) * ex;
  bump *= bump;
  p -= vec2(uGaze.x * r * 0.4, uGaze.y * r * 0.15) * bump;
  // Palpebra: la linea della palpebra scende da -1 (alto) a quasi +1 (basso),
  // con un bordo sfumato invece di un taglio netto.
  if (uLid > 0.01) {
    float lid = mix(-1.0, 0.85, uLid);
    float fall = (lid + 1.0) * eye.w * ex;
    float g = smoothstep(-4.0, -1.0, ny) * (1.0 - smoothstep(lid - 0.12, lid + 0.12, ny));
    p.y -= fall * g;
    lash = max(lash, ex * smoothstep(0.3, 0.0, abs(ny - lid)) * uLid * 0.7);
  }
  return p;
}

void main() {
  vec2 uv = vec2(uView.x + vUv.x * uView.z, uView.y + (1.0 - vUv.y) * uView.w);
  // Respiro: leggera dilatazione verticale dal basso.
  uv.y += uBreath * (uv.y - 1.0);
  float d = uHasDepth > 0.5 ? texture2D(uDepth, vec2(uv.x, 1.0 - uv.y)).r : 0.5;
  uv += uTilt * (d - 0.5) * uView.z;

  vec3 bg = vec3(0.07, 0.065, 0.06);
  float inside = 0.0;
  float lash = 0.0;
  vec2 p = vec2(uv.x * uAspect, uv.y);
  float hw = 0.0;
  if (uHasFace > 0.5) {
    // Testa: peso pieno sul volto, sfuma su capelli e collo, nullo sulle spalle.
    hw = 1.0 - smoothstep(0.75, 1.35, length((p - uFaceC) / uFaceR));
    if (hw > 0.0) {
      vec2 rel = p - uNeck;
      float a = -uHead.z * 0.045 * hw;
      rel = mat2(cos(a), sin(a), -sin(a), cos(a)) * rel;
      p = uNeck + rel;
      // Girata: i punti vicini (naso) si spostano più dei lontani (orecchie, capelli).
      p.x -= uHead.x * uFaceR.x * 0.09 * hw * (0.4 + (d - 0.5) * 2.5);
      p.y -= uHead.y * uFaceR.y * 0.06 * hw;
    }
  }
  // Quadro vivo: capelli, vesti e sfondo si muovono appena, il volto no.
  vec2 n = vec2(noise(p * 6.0 + uTime * 0.15), noise(p * 6.0 + 17.0 - uTime * 0.12)) - 0.5;
  p += n * 0.004 * uLife * (1.0 - hw);
  if (uHasFace > 0.5) {
    p = eyeWarp(p, uEyeL, uIrisL, lash);
    p = eyeWarp(p, uEyeR, uIrisR, lash);
    if (uOpen > 0.0001) {
      vec2 m = p - uMouthC;
      vec2 q = vec2(dot(m, uMouthAxis), dot(m, vec2(-uMouthAxis.y, uMouthAxis.x)));
      // Peso orizzontale: pieno al centro, nullo poco oltre gli angoli (apertura a forma di lente).
      float wx = 1.0 - smoothstep(0.35, 1.15, abs(q.x) / uMouthHalf);
      if (wx > 0.0 && q.y > -uChin && q.y < uChin * 1.7) {
        // Labbra tonde (o, u): la bocca si stringe verso il centro.
        float rz = 1.0 - smoothstep(0.0, uChin * 0.7, abs(q.y));
        q.x *= 1.0 + uRound * 0.22 * rz * (1.0 - smoothstep(0.9, 1.5, abs(q.x) / uMouthHalf));
        float edge = uOpen * 0.12 + 0.0004;
        if (q.y >= 0.0) {
          // Labbro inferiore e mento scendono; il collo resta fermo.
          float sy = q.y - uOpen * wx * (1.0 - smoothstep(uChin * 0.55, uChin * 1.7, q.y));
          inside = smoothstep(0.0, -edge, sy);
          q.y = sy;
        } else {
          // Il labbro superiore sale appena.
          float sy = q.y + uOpen * 0.22 * wx * (1.0 - smoothstep(0.0, uChin * 0.5, -q.y));
          inside = smoothstep(0.0, edge, sy);
          q.y = sy;
        }
        m = q.x * uMouthAxis + q.y * vec2(-uMouthAxis.y, uMouthAxis.x);
        p = uMouthC + m;
      }
    }
  }
  uv = vec2(p.x / uAspect, p.y);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(bg, 1.0); return; }
  vec3 c = texture2D(uImage, vec2(uv.x, 1.0 - uv.y)).rgb;
  // Interno della bocca: scuro, appena rossastro, con un velo del colore delle labbra.
  c = mix(c, c * vec3(0.22, 0.12, 0.11) + vec3(0.03, 0.008, 0.006), clamp(inside, 0.0, 1.0));
  c *= 1.0 - lash * 0.45;
  float v = smoothstep(1.15, 0.35, length(vUv - 0.5) * 1.4);
  gl_FragColor = vec4(c * mix(0.8, 1.0, v), 1.0);
  // Texture in sRGB: lo shader lavora in lineare, qui si torna allo spazio dello schermo.
  #include <colorspace_fragment>
}
`;

export interface FaceState {
  open: number;
  lid: number;
  gaze: { x: number; y: number };
  breath: number;
  /** Testa: girata, cenno, inclinazione (-1..1). */
  head: { x: number; y: number; z: number };
  brow: number;
  round: number;
}

export class FaceRenderer {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private material: THREE.ShaderMaterial;
  private imageAspect = 1;
  /** Apertura massima della bocca, in proporzione alla sua larghezza. */
  readonly maxOpen: number;
  private u: Record<string, THREE.IUniform>;

  constructor(private container: HTMLElement, private p: Personaggio) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    Object.assign(this.renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
    container.prepend(this.renderer.domElement);
    this.u = {
      uImage: { value: null }, uDepth: { value: null }, uView: { value: new THREE.Vector4(0, 0, 1, 1) },
      uTilt: { value: new THREE.Vector2() }, uHasDepth: { value: 0 }, uAspect: { value: 1 }, uBreath: { value: 0 },
      uHasFace: { value: 0 }, uMouthC: { value: new THREE.Vector2() }, uMouthAxis: { value: new THREE.Vector2(1, 0) },
      uMouthHalf: { value: 0.01 }, uChin: { value: 0.02 }, uOpen: { value: 0 },
      uEyeL: { value: new THREE.Vector4() }, uEyeR: { value: new THREE.Vector4() },
      uIrisL: { value: new THREE.Vector2() }, uIrisR: { value: new THREE.Vector2() },
      uLid: { value: 0 }, uGaze: { value: new THREE.Vector2() },
      uTime: { value: 0 }, uHead: { value: new THREE.Vector3() }, uFaceC: { value: new THREE.Vector2() },
      uFaceR: { value: new THREE.Vector2(1, 1) }, uNeck: { value: new THREE.Vector2() },
      uBrow: { value: 0 }, uRound: { value: 0 }, uLife: { value: 1 },
    };
    this.material = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms: this.u });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
    this.maxOpen = 0.32;
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  async load(imageUrl: string, depthUrl?: string) {
    const loader = new THREE.TextureLoader();
    const img = await loader.loadAsync(imageUrl);
    img.colorSpace = THREE.SRGBColorSpace;
    img.minFilter = THREE.LinearMipmapLinearFilter;
    img.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.u.uImage.value = img;
    this.imageAspect = img.image.width / img.image.height;
    this.u.uAspect.value = this.imageAspect;
    if (depthUrl) {
      try {
        this.u.uDepth.value = await loader.loadAsync(depthUrl);
        this.u.uHasDepth.value = 1;
      } catch {
        // Senza profondità: niente parallasse.
      }
    }
    this.setupFace();
  }

  /** Converte i punti del volto nello spazio isotropo dello shader. */
  private setupFace() {
    const pts = this.p.volto?.punti;
    if (!pts) return;
    const a = this.imageAspect;
    const P = (k: string) => new THREE.Vector2(pts[k][0] * a, pts[k][1]);
    const sx = P('boccaSx');
    const dx = P('boccaDx');
    const axis = dx.clone().sub(sx);
    const half = axis.length() / 2;
    axis.normalize();
    const lips = P('labbroSopra').add(P('labbroSotto')).multiplyScalar(0.5);
    // Centro: a metà fra gli angoli in orizzontale, sulla linea delle labbra.
    const mid = sx.clone().add(dx).multiplyScalar(0.5);
    const c = mid.clone().add(axis.clone().multiplyScalar(lips.clone().sub(mid).dot(axis)));
    c.y = lips.y;
    this.u.uMouthC.value.copy(c);
    this.u.uMouthAxis.value.copy(axis);
    this.u.uMouthHalf.value = half;
    this.u.uChin.value = Math.max(half * 0.8, P('mento').distanceTo(c));
    const eye = (side: 'Sx' | 'Dx', target: THREE.Vector4, iris: THREE.Vector2) => {
      const e = P(`occhio${side}Esterno`);
      const i = P(`occhio${side}Interno`);
      const top = P(`occhio${side}Sopra`);
      const bot = P(`occhio${side}Sotto`);
      target.set((e.x + i.x) / 2, (top.y + bot.y) / 2, Math.abs(e.x - i.x) / 2, Math.max(Math.abs(bot.y - top.y) / 2, Math.abs(e.x - i.x) * 0.12));
      iris.copy(P(`occhio${side}Iride`));
    };
    eye('Sx', this.u.uEyeL.value, this.u.uIrisL.value);
    eye('Dx', this.u.uEyeR.value, this.u.uIrisR.value);
    // Testa: il riquadro del volto un po' allargato (capelli); perno sotto il mento.
    const b = this.p.volto!.box;
    this.u.uFaceC.value.set((b.x + b.w / 2) * a, b.y + b.h / 2);
    this.u.uFaceR.value.set((b.w / 2) * a * 1.15, (b.h / 2) * 1.2);
    this.u.uNeck.value.set(P('mento').x, P('mento').y + b.h * 0.3);
    this.u.uHasFace.value = 1;
  }

  get hasFace() {
    return !!this.p.volto;
  }

  /** Inquadratura: il volto con spalle, adattato allo schermo; senza volto, il quadro intero. */
  view(screenAspect: number): Rect {
    const b = this.p.volto?.box;
    const fit = (r: Rect) => {
      let { w, h } = r;
      if ((w * this.imageAspect) / h > screenAspect) h = (w * this.imageAspect) / screenAspect;
      else w = (h * screenAspect) / this.imageAspect;
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      return { x: w <= 1 ? Math.min(Math.max(cx - w / 2, 0), 1 - w) : cx - w / 2, y: h <= 1 ? Math.min(Math.max(cy - h / 2, 0), 1 - h) : cy - h / 2, w, h };
    };
    if (!b) return fit({ x: 0, y: 0, w: 1, h: 1 });
    // Il volto occupa circa metà dell'altezza visibile, un po' sopra il centro.
    const h = Math.min(1, b.h * 2.1);
    const w = Math.min(1, b.w * 2.1);
    return fit({ x: b.x + b.w / 2 - w / 2, y: b.y + b.h * 0.62 - h / 2, w, h });
  }

  resize = () => {
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight, false);
  };

  render(view: Rect, s: FaceState, tilt: { x: number; y: number }) {
    (this.u.uView.value as THREE.Vector4).set(view.x, view.y, view.w, view.h);
    this.u.uOpen.value = this.p.modo === 'completa' ? s.open * this.maxOpen * (this.u.uMouthHalf.value as number) : 0;
    this.u.uLid.value = this.p.modo === 'completa' ? s.lid : 0;
    (this.u.uGaze.value as THREE.Vector2).set(s.gaze.x, s.gaze.y);
    (this.u.uHead.value as THREE.Vector3).set(s.head.x, s.head.y, s.head.z);
    this.u.uBrow.value = this.p.modo === 'completa' ? s.brow : 0;
    this.u.uRound.value = this.p.modo === 'completa' ? s.round : 0;
    this.u.uTime.value = performance.now() / 1000;
    this.u.uBreath.value = s.breath;
    (this.u.uTilt.value as THREE.Vector2).set(tilt.x, tilt.y);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('resize', this.resize);
    (this.u.uImage.value as THREE.Texture | null)?.dispose();
    (this.u.uDepth.value as THREE.Texture | null)?.dispose();
    this.material.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

