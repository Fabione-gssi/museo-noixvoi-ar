// Esperienza "caccia" con fotocamera simulata: la lente scopre gli elementi
// nascosti, ogni scoperta apre la sua storia, il contatore avanza e resta dopo
// il ricaricamento, il finale arriva quando sono tutti trovati, l'indizio
// compare dopo 20 s senza scoperte; senza fotocamera la lente si trascina.
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { launchWithCamera, newPage, probe, saveResult } from './helpers';

const DATA = path.resolve(import.meta.dirname, '../../public/data');
const metas = fs.readdirSync(DATA)
  .filter((d) => fs.existsSync(path.join(DATA, d, 'meta.json')))
  .map((d) => JSON.parse(fs.readFileSync(path.join(DATA, d, 'meta.json'), 'utf8')))
  .filter((m) => m.experience === 'caccia' && m.caccia);

type Item = { id: string; label: string; x: number; y: number; media: { type: string; audioSegment?: { from: number; to: number } } };
const audioState = (page: Page) => page.evaluate(() => {
  const a = (window as unknown as { __audio: HTMLAudioElement }).__audio;
  return { paused: a.paused, t: a.currentTime };
});

for (const meta of metas) {
  const items: Item[] = meta.caccia.items;
  const N = items.length;

  test.describe(`caccia: ${meta.id}`, () => {
    for (const it of items.slice(0, 2)) {
      test(`la lente scopre "${it.label}" e parte la sua storia @principale`, async () => {
        const browser = await launchWithCamera(`${meta.id}/caccia-${it.id}`);
        try {
          const page = await newPage(browser);
          await page.goto(`/?p=${meta.id}&notutorial`);
          await page.click('#start');
          await expect(page.locator('#hunt')).toBeVisible({ timeout: 30_000 });
          await expect(page.locator('#hunt-count')).toHaveText(`0/${N}`);
          await expect(page.locator('#detail-card h2')).toHaveText(it.label, { timeout: 30_000 });
          await expect(page.locator('#hunt-count')).toHaveText(`1/${N}`);
          if (it.media.audioSegment) {
            await expect.poll(async () => (await audioState(page)).paused, { timeout: 5000 }).toBe(false);
            const t = (await audioState(page)).t;
            expect(t).toBeGreaterThanOrEqual(it.media.audioSegment.from - 0.5);
            expect(t).toBeLessThanOrEqual(it.media.audioSegment.to + 0.5);
          }
          saveResult(`caccia-${meta.id}-${it.id}`, await probe(page));
          await page.reload();
          await page.click('#start');
          await expect(page.locator('#hunt-count')).toHaveText(`1/${N}`, { timeout: 30_000 });
        } finally {
          await browser.close();
        }
      });
    }

    test('giro completo: tutti gli elementi e poi il finale', async () => {
      test.setTimeout(240_000);
      const browser = await launchWithCamera(`${meta.id}/caccia-giro`);
      try {
        const page = await newPage(browser);
        await page.goto(`/?p=${meta.id}&notutorial`);
        await page.click('#start');
        await expect(page.locator('#hunt')).toBeVisible({ timeout: 30_000 });
        // Ogni scoperta apre una scheda: la si chiude per continuare (il video gira in tondo).
        for (let found = 1; found <= N; found++) {
          await expect(page.locator('#hunt-count')).toHaveText(`${found}/${N}`, { timeout: 120_000 });
          if (found < N) await page.locator('#detail-close').click();
        }
        const finale = page.getByRole('button', { name: /Ascolta il finale/ });
        await expect(finale).toBeVisible();
        await finale.click();
        await expect(page.locator('#detail-card h2')).toHaveText('Hai trovato tutto!');
        saveResult(`caccia-${meta.id}-giro`, await probe(page));
      } finally {
        await browser.close();
      }
    });

    test('indizio dopo 20 secondi senza scoperte', async () => {
      test.setTimeout(90_000);
      const browser = await launchWithCamera(`${meta.id}/fermo`);
      try {
        const page = await newPage(browser);
        await page.goto(`/?p=${meta.id}&notutorial`);
        await page.click('#start');
        await expect(page.locator('#hunt')).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('#hunt-hint')).toBeHidden();
        await expect(page.locator('#hunt-hint')).toBeVisible({ timeout: 35_000 });
        expect((await probe(page)).events.some((e) => e.type === 'hint')).toBe(true);
      } finally {
        await browser.close();
      }
    });

    test('senza fotocamera: la lente si trascina sull\'immagine', async () => {
      const browser = await launchWithCamera(null);
      try {
        const page = await newPage(browser, { camera: false });
        await page.goto(`/?p=${meta.id}&notutorial`);
        await page.click('#start');
        await expect(page.locator('#fallback-hunt img')).toBeVisible({ timeout: 20_000 });
        const last = items.at(-1)!;
        // Si porta la lente sull'elemento (come col dito) e la si tiene ferma.
        await page.evaluate(([u, v]) => (window as unknown as { __huntMove: (u: number, v: number) => void }).__huntMove(u, v), [last.x, last.y]);
        await expect(page.locator('#detail-card h2')).toHaveText(last.label, { timeout: 10_000 });
        await expect(page.locator('#hunt-count-fb')).toHaveText(`1/${N}`);
      } finally {
        await browser.close();
      }
    });
  });
}
