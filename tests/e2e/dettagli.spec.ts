// Esperienza "dettagli" con fotocamera simulata: particolare trovato (ritaglio
// o mirino), anello di conferma e scheda con il pezzo di audio giusto;
// "Trova i particolari" con avanzamento che resta dopo il ricaricamento;
// ripiego senza fotocamera. Vale per ogni quadro con esperienza "dettagli".
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { launchWithCamera, newPage, probe, saveResult } from './helpers';

const DATA = path.resolve(import.meta.dirname, '../../public/data');
const VIDEO = path.resolve(import.meta.dirname, '../video');
const metas = fs.readdirSync(DATA)
  .filter((d) => fs.existsSync(path.join(DATA, d, 'meta.json')))
  .map((d) => JSON.parse(fs.readFileSync(path.join(DATA, d, 'meta.json'), 'utf8')))
  .filter((m) => m.experience === 'dettagli');

type Det = { id: string; label: string; media: { type: string; audioSegment?: { from: number; to: number } } };
const audioState = (page: Page) => page.evaluate(() => {
  const a = document.querySelector('audio') ?? (window as unknown as { __audio?: HTMLAudioElement }).__audio;
  return a ? { paused: a.paused, t: a.currentTime } : null;
});

for (const meta of metas) {
  test.describe(`dettagli: ${meta.id}`, () => {
    const approaches = fs.readdirSync(path.join(VIDEO, meta.id)).filter((f) => f.startsWith('avvicinamento-')).map((f) => f.slice(14, -6));

    for (const id of approaches) {
      const d: Det = meta.dettagli.find((x: Det) => x.id === id);
      test(`avvicinamento a "${d.label}": trovato, scheda e audio del particolare @principale`, async () => {
        const browser = await launchWithCamera(`${meta.id}/avvicinamento-${id}`);
        try {
          const page = await newPage(browser);
          await page.goto(`/?p=${meta.id}&notutorial`);
          await page.click('#start');
          await expect(page.locator('#find')).toBeVisible({ timeout: 30_000 });
          await expect(page.locator('#find .find-item')).toHaveCount(meta.dettagli.length);
          await expect(page.locator('#detail-card h2')).toHaveText(d.label, { timeout: 40_000 });
          // Primo piano animato del particolare nella scheda.
          await expect(page.locator('#detail-card .detail-stage canvas')).toBeVisible();
          const p = await probe(page);
          saveResult(`dettagli-${meta.id}-${id}`, p);
          if (d.media.type === 'audio' && d.media.audioSegment) {
            // L'audio parte dall'inizio del pezzo che parla del particolare.
            await expect.poll(async () => (await audioState(page))?.paused, { timeout: 5000 }).toBe(false);
            const t = (await audioState(page))!.t;
            expect(t).toBeGreaterThanOrEqual(d.media.audioSegment.from - 0.5);
            expect(t).toBeLessThanOrEqual(d.media.audioSegment.to + 0.5);
          }
          // Lungo il percorso si possono trovare anche particolari vicini: conta che ci sia questo.
          await expect(page.locator('#find .find-item.found', { hasText: d.label })).toHaveCount(1);
          const n = await page.locator('#find .find-item.found').count();
          // L'avanzamento resta dopo il ricaricamento della pagina.
          await page.reload();
          await page.click('#start');
          await expect(page.locator('#find .find-item.found')).toHaveCount(n, { timeout: 30_000 });
        } finally {
          await browser.close();
        }
      });
    }

    test('senza fotocamera: si toccano i particolari e parte il contenuto', async () => {
      const browser = await launchWithCamera(null);
      try {
        const page = await newPage(browser, { camera: false });
        await page.goto(`/?p=${meta.id}&notutorial`);
        await page.click('#start');
        await expect(page.locator('#fallback .find-item')).toHaveCount(meta.dettagli.length, { timeout: 20_000 });
        const last: Det = meta.dettagli.at(-1);
        await page.locator('#fallback .find-item', { hasText: last.label }).click();
        await expect(page.locator('#detail-card h2')).toHaveText(last.label);
        await expect(page.locator('#detail-card')).toContainText(/\w/);
        await page.getByRole('button', { name: 'Chiudi' }).click();
        await expect(page.locator('#detail-card')).toBeHidden();
        await page.getByRole('button', { name: 'Ascolta il racconto completo' }).click();
        // Racconto animato: la camera va sui particolari quando la voce li nomina.
        await expect(page.locator('#story')).toBeVisible({ timeout: 20_000 });
        await expect(page.locator('#story .story-title')).toHaveText(meta.title);
        const first = meta.racconto.timeline.find((k: { args: { label?: string } }) => k.args.label);
        await expect.poll(async () => (await probe(page)).events.some((e) => e.type === 'camera'), { timeout: (first.t + 8) * 1000 }).toBe(true);
        // Indietro: si torna all'elenco dei particolari.
        await page.locator('#story .story-back').click();
        await expect(page.locator('#fallback .find-item')).toHaveCount(meta.dettagli.length);
      } finally {
        await browser.close();
      }
    });
  });
}
