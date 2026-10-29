// Punti del volto per l'esperienza "personaggio": MediaPipe Face Landmarker
// (Apache-2.0) dentro Chromium headless, come per la compilazione dei target.
// Restituisce pochi punti con nome, in coordinate normalizzate dell'immagine
// (0-1): sono gli stessi che lo Studio permette di spostare a mano.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '../..');
const DIST = path.join(ROOT, 'node_modules/@mediapipe/tasks-vision');
const ORIGIN = 'http://volto.local';

/** Indici dei 478 punti di MediaPipe. "Sx"/"Dx" = sinistra/destra di chi guarda il quadro. */
export const LANDMARKS = {
  occhioSxEsterno: 33, occhioSxInterno: 133, occhioSxSopra: 159, occhioSxSotto: 145, occhioSxIride: 468,
  occhioDxEsterno: 263, occhioDxInterno: 362, occhioDxSopra: 386, occhioDxSotto: 374, occhioDxIride: 473,
  boccaSx: 61, boccaDx: 291, labbroSopra: 13, labbroSotto: 14, mento: 152,
};

/** Riquadri in cui cercare il volto: l'immagine intera, poi la parte alta (ritratti a mezza figura). */
const TRIES = [{ x: 0, y: 0, w: 1, h: 1 }, { x: 0, y: 0, w: 1, h: 0.6 }, { x: 0.15, y: 0.05, w: 0.7, h: 0.5 }];

/**
 * @param {string} imagePath
 * @returns {Promise<{ punti: Record<string, [number, number]>, volto: {x:number,y:number,w:number,h:number} } | null>}
 */
export async function detectFace(imagePath, modelPath) {
  if (!fs.existsSync(modelPath)) throw new Error('Manca il modello dei volti (.models/face): eseguire npm run setup');
  const { width: W, height: H } = await sharp(imagePath).metadata();
  const crops = await Promise.all(TRIES.map((c) => sharp(imagePath)
    .extract({ left: Math.round(c.x * W), top: Math.round(c.y * H), width: Math.round(c.w * W), height: Math.round(c.h * H) })
    .resize({ width: 1280, height: 1280, fit: 'inside' }).jpeg({ quality: 90 }).toBuffer()));

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route(`${ORIGIN}/**`, (route) => {
      const p = new URL(route.request().url()).pathname;
      if (p === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>v</title>' });
      if (p === '/vision.mjs') return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(DIST, 'vision_bundle.mjs')) });
      if (p.startsWith('/wasm/')) {
        const f = path.join(DIST, 'wasm', path.basename(p));
        return route.fulfill({ contentType: f.endsWith('.wasm') ? 'application/wasm' : 'text/javascript', body: fs.readFileSync(f) });
      }
      if (p === '/model') return route.fulfill({ contentType: 'application/octet-stream', body: fs.readFileSync(modelPath) });
      if (p.startsWith('/img/')) return route.fulfill({ contentType: 'image/jpeg', body: crops[Number(p.slice(5))] });
      return route.fulfill({ status: 404, body: '' });
    });
    await page.goto(`${ORIGIN}/`);
    const result = await page.evaluate(async ({ count, indices }) => {
      const { FaceLandmarker, FilesetResolver } = await import('/vision.mjs');
      const fileset = await FilesetResolver.forVisionTasks('/wasm');
      const lm = await FaceLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: '/model', delegate: 'CPU' }, runningMode: 'IMAGE', numFaces: 1 });
      for (let i = 0; i < count; i++) {
        const img = new Image();
        img.src = `/img/${i}`;
        await img.decode();
        const r = lm.detect(img);
        const pts = r.faceLandmarks?.[0];
        if (!pts) continue;
        const named = Object.fromEntries(Object.entries(indices).map(([k, j]) => [k, [pts[j].x, pts[j].y]]));
        const xs = pts.map((p) => p.x);
        const ys = pts.map((p) => p.y);
        return { tryIndex: i, named, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
      }
      return null;
    }, { count: crops.length, indices: LANDMARKS });
    if (!result) return null;
    const c = TRIES[result.tryIndex];
    const map = ([x, y]) => [round(c.x + x * c.w), round(c.y + y * c.h)];
    const [x0, y0] = map([result.box[0], result.box[1]]);
    const [x1, y1] = map([result.box[2], result.box[3]]);
    return {
      punti: Object.fromEntries(Object.entries(result.named).map(([k, p]) => [k, map(p)])),
      volto: { x: x0, y: y0, w: round(x1 - x0), h: round(y1 - y0) },
    };
  } finally {
    await browser.close();
  }
}

const round = (v) => Math.round(v * 10000) / 10000;
