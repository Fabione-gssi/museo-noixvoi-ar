// Compila immagini in un file .mind di MindAR dentro Chromium headless.
// Il compilatore Node di MindAR richiede il modulo nativo "canvas", che su
// Windows non si installa: il compilatore da browser produce lo stesso file.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const MINDAR_DIST = path.join(ROOT, 'node_modules/mind-ar/dist');
const ORIGIN = 'http://compiler.local';

const MIME = { '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.html': 'text/html' };

/**
 * @param {string[]} imagePaths file immagine (jpg/png), nell'ordine dei targetIndex
 * @param {(percent:number)=>void} [onProgress]
 * @returns {Promise<Buffer>} contenuto del file .mind
 */
export async function compileMind(imagePaths, onProgress = () => {}) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route(`${ORIGIN}/**`, (route) => {
      const url = new URL(route.request().url());
      let file;
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>c</title>' });
      if (url.pathname.startsWith('/mindar/')) file = path.join(MINDAR_DIST, url.pathname.slice(8));
      else if (url.pathname.startsWith('/img/')) file = imagePaths[Number(url.pathname.slice(5))];
      if (!file || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
      route.fulfill({ contentType: MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream', body: fs.readFileSync(file) });
    });
    await page.exposeFunction('reportProgress', (p) => onProgress(p));
    await page.goto(`${ORIGIN}/`);
    const b64 = await page.evaluate(async (count) => {
      const { Compiler } = await import('/mindar/mindar-image.prod.js');
      const images = await Promise.all(
        Array.from({ length: count }, (_, i) => new Promise((res, rej) => {
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = rej;
          img.src = `/img/${i}`;
        })),
      );
      const compiler = new Compiler();
      await compiler.compileImageTargets(images, (p) => window.reportProgress(p));
      const buf = compiler.exportData();
      let s = '';
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return btoa(s);
    }, imagePaths.length);
    return Buffer.from(b64, 'base64');
  } finally {
    await browser.close();
  }
}

/**
 * Conta i punti caratteristici per immagine leggendo un .mind già compilato:
 * è il punteggio di "riconoscibilità" usato per segnalare target deboli.
 */
export async function inspectMind(mindBuffer) {
  const { decode } = await import('@msgpack/msgpack');
  const data = decode(mindBuffer);
  return data.dataList.map((d) => ({
    width: d.targetImage.width,
    height: d.targetImage.height,
    matchingPoints: d.matchingData.reduce((n, m) => n + m.maximaPoints.length + m.minimaPoints.length, 0),
    trackingPoints: d.trackingData.reduce((n, t) => n + t.points.length, 0),
  }));
}
