// Esperienza "personaggio" con fotocamera simulata: riconoscimento, presentazione
// con la bocca che segue la voce, domande suggerite e scritte (anche con errori),
// "non so rispondere" onesto, modalità "presenza" senza bocca, uso senza fotocamera.
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { launchWithCamera, newPage, probe, saveResult } from './helpers';

const DATA = path.resolve(import.meta.dirname, '../../public/data');
const metas = fs.readdirSync(DATA)
  .filter((d) => fs.existsSync(path.join(DATA, d, 'meta.json')))
  .map((d) => JSON.parse(fs.readFileSync(path.join(DATA, d, 'meta.json'), 'utf8')))
  .filter((m) => m.experience === 'personaggio' && m.personaggio);

const audioSrc = (page: Page) => page.evaluate(() => (window as unknown as { __audio: HTMLAudioElement }).__audio.src);
const mouth = (page: Page) => page.evaluate(() => (window as unknown as { __ar: { mouth: number } }).__ar.mouth);

for (const meta of metas) {
  const p = meta.personaggio;
  test.describe(`personaggio: ${meta.id}`, () => {
    test('riconosce il quadro, si presenta muovendo la bocca e risponde @principale', async () => {
      const browser = await launchWithCamera(`${meta.id}/fermo`);
      try {
        const page = await newPage(browser);
        await page.goto(`/?p=${meta.id}&notutorial`);
        await page.click('#start');
        await expect(page.locator('#character')).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('#character .badge-demo')).toBeVisible({ visible: meta.demo });
        // Presentazione: la bocca si apre mentre la voce parla e compaiono i sottotitoli.
        let maxMouth = 0;
        await expect.poll(async () => (maxMouth = Math.max(maxMouth, await mouth(page))), { timeout: 15_000, intervals: [100] }).toBeGreaterThan(0.25);
        await expect(page.locator('#character .char-subs')).not.toBeEmpty();
        const first = await probe(page);
        expect(first.firstFoundMs).toBeLessThan(1500);

        // Domanda suggerita.
        const sug = p.domande.find((q: { id: string }) => q.id === p.suggerite[1]);
        await page.getByRole('button', { name: sug.domanda }).click();
        await expect(page.locator('#character .char-subs')).toHaveText(sug.risposta);
        expect(await audioSrc(page)).toContain(`risposta-${sug.id}.`);

        // Domanda scritta, con un errore di battitura: si usa una variante della domanda.
        const q = p.domande.find((d: { id: string; varianti: string[] }) => d.id !== sug.id && d.varianti.some((v) => v.length > 12));
        // Errore di battitura: manca una lettera nella parola più lunga.
        const text: string = q.varianti.find((v: string) => v.length > 12);
        const long = text.split(/[^\p{L}]+/u).sort((a, b) => b.length - a.length)[0];
        const variant = text.replace(long, long.slice(0, 2) + long.slice(3));
        await page.getByRole('textbox', { name: 'Scrivi una domanda' }).fill(variant);
        await page.getByRole('button', { name: 'Chiedi' }).click();
        await expect(page.locator('#character .char-subs')).toHaveText(q.risposta);

        // Fuori tema: risposta onesta.
        await page.getByRole('textbox', { name: 'Scrivi una domanda' }).fill('Che tempo farà domani a Milano?');
        await page.getByRole('button', { name: 'Chiedi' }).click();
        await expect(page.locator('#character .char-subs')).toContainText('Non so rispondere');
        expect(await audioSrc(page)).toContain('risposta-nonso.');
        saveResult(`personaggio-${meta.id}`, { ...(await probe(page)), maxMouth });
      } finally {
        await browser.close();
      }
    });

    test('modalità "presenza": niente bocca, la voce parla lo stesso', async () => {
      const browser = await launchWithCamera(null);
      try {
        const page = await newPage(browser, { camera: false });
        await page.goto(`/?p=${meta.id}&notutorial&modo=presenza`);
        await page.click('#start');
        await expect(page.locator('#character')).toBeVisible({ timeout: 20_000 });
        await expect.poll(() => page.evaluate(() => (window as unknown as { __audio: HTMLAudioElement }).__audio.currentTime), { timeout: 10_000 }).toBeGreaterThan(1.5);
        const samples: number[] = [];
        for (let i = 0; i < 15; i++) {
          samples.push(await mouth(page));
          await page.waitForTimeout(100);
        }
        expect(Math.max(...samples)).toBe(0);
      } finally {
        await browser.close();
      }
    });
  });
}
