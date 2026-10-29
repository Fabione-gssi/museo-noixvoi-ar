// Uso senza internet, sul sito costruito (vite preview, con service worker):
// "Scarica tutti i quadri" e poi riconoscimento e audio senza rete; un quadro
// aperto si salva da solo; un quadro mai aperto avvisa con un messaggio chiaro;
// una copia di una versione vecchia viene buttata.
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { launchWithCamera, newPage, probe, saveResult } from './helpers';

const SITE = 'http://localhost:5181';
const DATA = path.resolve(import.meta.dirname, '../../public/data');
const index = JSON.parse(fs.readFileSync(path.join(DATA, 'index.json'), 'utf8'));
const racconto = index.paintings.find((p: { experience: string }) => p.experience === 'racconto');
const caccia = index.paintings.find((p: { experience: string }) => p.experience === 'caccia');
const other = index.paintings.find((p: { id: string }) => p.id !== caccia?.id);

/** Attende che il service worker controlli la pagina (alla prima visita serve un attimo). */
async function waitServiceWorker(page: Page) {
  await page.waitForSelector('body[data-ready]');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
}

const cacheState = (page: Page, id: string) => page.evaluate(async (id) => {
  if (!(await caches.has(`quadro-${id}`))) return null;
  const c = await caches.open(`quadro-${id}`);
  const mark = await c.match(`./data/${id}/__versione__`);
  return { files: (await c.keys()).length, mark: mark ? await mark.text() : '' };
}, id);

test.describe('offline', () => {
  test('scarica tutti i quadri, poi riconoscimento e racconto senza internet @principale', async () => {
    test.skip(!racconto, 'nessun quadro racconto');
    const browser = await launchWithCamera(`${racconto.id}/fermo`);
    try {
      const page = await newPage(browser);
      await page.goto(`${SITE}/`);
      await waitServiceWorker(page);
      const btn = page.locator('#offline-btn');
      await expect(btn).toHaveText(/Scarica tutti i quadri per usarli senza internet \(\d+ MB\)/);
      await btn.click();
      await expect(page.locator('#offline-note')).toHaveText(/Tutti i quadri sono sul telefono/, { timeout: 60_000 });

      await page.context().setOffline(true);
      // L'elenco segna i quadri disponibili senza internet.
      await page.goto(`${SITE}/`);
      await page.click('#start');
      await expect(page.locator('#painting-list .offline-ok')).toHaveCount(index.paintings.length);

      await page.goto(`${SITE}/?p=${racconto.id}&notutorial`);
      await page.click('#start');
      await expect(page.locator('#story')).toBeVisible({ timeout: 30_000 });
      // L'audio arriva dalla copia sul telefono (richieste parziali comprese) e avanza.
      await expect.poll(() => page.evaluate(() => (window as unknown as { __audio: HTMLAudioElement }).__audio.currentTime), { timeout: 15_000 }).toBeGreaterThan(1.5);
      const p = await probe(page);
      saveResult('offline-racconto', p);
      expect(p.firstFoundMs).toBeLessThan(1500);
    } finally {
      await browser.close();
    }
  });

  test('un quadro aperto si salva da solo; uno mai aperto avvisa', async () => {
    test.skip(!caccia, 'nessun quadro caccia');
    const browser = await launchWithCamera(null);
    try {
      const page = await newPage(browser, { camera: false });
      await page.goto(`${SITE}/?p=${caccia.id}&notutorial`);
      await waitServiceWorker(page);
      await page.click('#start');
      await expect(page.locator('#fallback-hunt img')).toBeVisible({ timeout: 20_000 });
      await expect.poll(async () => (await cacheState(page, caccia.id))?.mark, { timeout: 30_000 }).toBe(`${caccia.version} completo`);

      await page.context().setOffline(true);
      await page.goto(`${SITE}/?p=${caccia.id}&notutorial`);
      await page.click('#start');
      await expect(page.locator('#fallback-hunt img')).toBeVisible({ timeout: 20_000 });
      expect(await page.locator('#fallback-hunt img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

      await page.goto(`${SITE}/?p=${other.id}&notutorial`);
      await page.click('#start');
      await expect(page.locator('#welcome-note')).toHaveText(/Senza internet questo quadro non è disponibile/);
    } finally {
      await browser.close();
    }
  });

  test('la copia di una versione vecchia viene sostituita', async () => {
    const browser = await launchWithCamera(null);
    try {
      const page = await newPage(browser, { camera: false });
      await page.goto(`${SITE}/`);
      await waitServiceWorker(page);
      const id = index.paintings[0].id;
      await page.evaluate(async (id) => {
        const c = await caches.open(`quadro-${id}`);
        await c.put(`./data/${id}/vecchio.jpg`, new Response('x'));
        await c.put(`./data/${id}/__versione__`, new Response('versione-vecchia completo'));
      }, id);
      await page.reload();
      await page.waitForSelector('body[data-ready]');
      // Buttata e, poiché era scaricata per intero, riscaricata nella versione attuale.
      await expect.poll(async () => (await cacheState(page, id))?.mark, { timeout: 30_000 }).toBe(`${index.paintings[0].version} completo`);
      expect(await page.evaluate(async (id) => !!(await (await caches.open(`quadro-${id}`)).match(`./data/${id}/vecchio.jpg`)), id)).toBe(false);
    } finally {
      await browser.close();
    }
  });
});
