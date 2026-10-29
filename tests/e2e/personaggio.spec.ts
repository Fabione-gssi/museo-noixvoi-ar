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

        // Domanda incerta: "forse volevi chiedere" con pulsanti che portano alla risposta.
        await page.getByRole('textbox', { name: 'Scrivi una domanda' }).fill(p.domande[0].risposta.split(/[ ,.]+/).sort((a: string, b: string) => b.length - a.length)[0]);
        await page.getByRole('button', { name: 'Chiedi' }).click();
        const maybe = page.locator('#character .char-maybe');
        if (await maybe.isVisible()) {
          const label = await maybe.locator('button').first().textContent();
          await maybe.locator('button').first().click();
          const q = p.domande.find((d: { domanda: string }) => d.domanda === label);
          await expect(page.locator('#character .char-subs')).toHaveText(q.risposta);
          await expect(maybe).toBeHidden();
        }

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

    test('domanda non prevista: dal testo del museo, con l\'assistente online o leggendo il passaggio', async () => {
      test.skip(!p.approfondimento, 'questo quadro non ha il testo completo');
      const ap = JSON.parse(fs.readFileSync(path.join(DATA, meta.id, p.approfondimento), 'utf8'));
      // Una domanda sul primo passaggio che non è tra quelle previste: le sue parole più lunghe.
      const passage = ap.passages.find((x: { text: string }) => !p.domande.some((d: { risposta: string }) => d.risposta.includes(x.text.slice(0, 30)))) ?? ap.passages[0];
      const question = `Parlami di ${passage.text.split(/[^\p{L}]+/u).filter((w: string) => w.length > 6).slice(0, 3).join(' ')}`;
      const browser = await launchWithCamera(null);
      try {
        const page = await newPage(browser, { camera: false });
        let sent: { quadro: string; domanda: string; passaggi: string[] } | null = null;
        const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST' };
        await page.route('https://assistente.test/**', async (route) => {
          if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
          sent = route.request().postDataJSON();
          await route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ risposta: 'Risposta di prova preparata dal testo.' }) });
        });
        await page.goto(`/?p=${meta.id}&notutorial`);
        await page.click('#start');
        await expect(page.locator('#character')).toBeVisible({ timeout: 20_000 });
        await expect(page.locator('#character .reconstruction')).toContainText('assistente automatico');
        const ask = async (q: string) => {
          await page.getByRole('textbox', { name: 'Scrivi una domanda' }).fill(q);
          await page.getByRole('button', { name: 'Chiedi' }).click();
        };

        // Con internet: risponde l'assistente, con i passaggi trovati sul telefono; la bocca si muove.
        await ask(question);
        await expect(page.locator('#character .char-subs')).toHaveText('Risposta di prova preparata dal testo.');
        await expect(page.locator('#character .char-source')).toContainText('assistente');
        expect(sent).toMatchObject({ quadro: meta.id, domanda: question });
        expect(sent!.passaggi).toContain(passage.id);
        expect((await probe(page)).answer).toBe('libera:assistente');
        let maxMouth = 0;
        await expect.poll(async () => (maxMouth = Math.max(maxMouth, await mouth(page))), { timeout: 5000, intervals: [50] }).toBeGreaterThan(0.25);

        // Assistente irraggiungibile (o senza internet): si legge il passaggio del testo del museo.
        await page.unroute('https://assistente.test/**');
        await page.route('https://assistente.test/**', (route) => route.abort());
        await ask(question);
        await expect(page.locator('#character .char-subs')).toHaveText(passage.text, { timeout: 15_000 });
        await expect(page.locator('#character .char-source')).toHaveText('Dal testo del museo');
        expect((await probe(page)).answer).toBe('libera:testo');

        // Una domanda prevista usa ancora la risposta preparata, con il suo audio.
        const sug = p.domande.find((q: { id: string }) => q.id === p.suggerite[0]);
        await page.getByRole('button', { name: sug.domanda }).click();
        await expect(page.locator('#character .char-subs')).toHaveText(sug.risposta);
        await expect(page.locator('#character .char-source')).toBeHidden();
        expect(await audioSrc(page)).toContain(`risposta-${sug.id}.`);
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
