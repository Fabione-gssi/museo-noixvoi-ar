// Esperienza "racconto" con fotocamera simulata: riconoscimento della tela,
// avvio del racconto, movimenti di camera sincronizzati, controlli, ripieghi.
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { launchWithCamera, newPage, probe, saveResult } from './helpers';

// Il quadro di prova "racconto" è il primo in public/data con experience = racconto.
const DATA = path.resolve(import.meta.dirname, '../../public/data');
const meta = fs.readdirSync(DATA)
  .filter((d) => fs.existsSync(path.join(DATA, d, 'meta.json')))
  .map((d) => JSON.parse(fs.readFileSync(path.join(DATA, d, 'meta.json'), 'utf8')))
  .find((m) => m.experience === 'racconto');

async function waitStory(page: Page, timeout = 30_000) {
  await expect(page.locator('#story')).toBeVisible({ timeout });
}

test.describe('racconto', () => {
  test.skip(!meta, 'nessun quadro con esperienza racconto');

  test('riconosce la tela e avvia il racconto con audio e sottotitoli', async () => {
    const browser = await launchWithCamera(`${meta.id}/fermo`);
    try {
      const page = await newPage(browser);
      await page.goto(`/?p=${meta.id}&notutorial`);
      await page.click('#start');
      await waitStory(page);
      await expect(page.locator('.badge-demo')).toBeVisible({ visible: meta.demo });
      // Il primo movimento di camera arriva quando l'audio nomina il primo particolare.
      const first = meta.racconto.timeline.find((k: { args: { label?: string } }) => k.args.label);
      await expect.poll(async () => (await probe(page)).events.some((e) => e.type === 'camera'), { timeout: (first.t + 8) * 1000 }).toBe(true);
      await expect(page.locator('.subtitles')).not.toBeEmpty();
      const p = await probe(page);
      saveResult(`racconto-${meta.id}-fermo`, p);
      expect(p.firstFoundMs).toBeLessThan(1500);
    } finally {
      await browser.close();
    }
  });

  test('capitoli e controlli: salta a un particolare, pausa, ±15 s', async () => {
    const browser = await launchWithCamera(null);
    try {
      const page = await newPage(browser, { camera: false });
      await page.goto(`/?p=${meta.id}&notutorial`);
      await page.click('#start');
      await waitStory(page);
      const last = meta.racconto.timeline.filter((k: { args: { label?: string } }) => k.args.label).at(-1);
      await page.getByRole('button', { name: last.args.label }).click();
      await expect.poll(async () => (await probe(page)).storyTime, { timeout: 10_000 }).toBeGreaterThanOrEqual(last.t);
      await expect(page.locator('.story-label')).toHaveText(last.args.label);
      await page.getByRole('button', { name: 'Pausa' }).click();
      const t0 = (await probe(page)).storyTime;
      await page.getByRole('button', { name: 'Indietro di 15 secondi' }).click();
      await expect.poll(async () => (await probe(page)).storyTime).toBeLessThan(t0 - 10);
      await page.getByRole('button', { name: 'Sottotitoli' }).click();
      await expect(page.locator('.subtitles')).toBeHidden();
    } finally {
      await browser.close();
    }
  });

  test('senza fotocamera il racconto parte comunque', async () => {
    const browser = await launchWithCamera(null);
    try {
      const page = await newPage(browser, { camera: false });
      await page.goto(`/?p=${meta.id}&notutorial`);
      await page.click('#start');
      await waitStory(page, 15_000);
      expect((await probe(page)).events.some((e) => e.type === 'fallback')).toBe(true);
    } finally {
      await browser.close();
    }
  });

  for (const video of ['scansione', 'inclinazione', 'riflesso', 'poca-luce', 'sfocatura']) {
    test(`robustezza tela scura: ${video} (solo registrazione)`, async () => {
      const browser = await launchWithCamera(`${meta.id}/${video}`);
      try {
        const page = await newPage(browser);
        await page.goto(`/?p=${meta.id}&notutorial`);
        await page.click('#start');
        const ok = await page.locator('#story').waitFor({ state: 'visible', timeout: 25_000 }).then(() => true, () => false);
        const p = await probe(page);
        saveResult(`racconto-${meta.id}-${video}`, { ...p, passed: ok });
        test.info().annotations.push({ type: 'esito', description: ok ? `riconosciuto in ${p.firstFoundMs} ms` : 'non riconosciuto' });
      } finally {
        await browser.close();
      }
    });
  }
});

test('blocca e sblocca nella vista AR', async () => {
  const browser = await launchWithCamera('arnolfini/fermo');
  try {
    const page = await newPage(browser);
    await page.goto('/?p=arnolfini&notutorial');
    await page.click('#start');
    await expect.poll(async () => (await probe(page)).firstFoundMs, { timeout: 30_000 }).not.toBeNull();
    await page.getByRole('button', { name: 'Blocca' }).click();
    await expect.poll(async () => (await probe(page)).locked).toBe(true);
    await expect(page.locator('#status')).toContainText('Bloccato');
    await page.getByRole('button', { name: 'Sblocca' }).click();
    await expect.poll(async () => (await probe(page)).locked).toBe(false);
  } finally {
    await browser.close();
  }
});

test('quadro perso a lungo: blocco automatico sull\'ultima inquadratura buona', async () => {
  // Il video "avvicinamento" a un certo punto esce dal quadro intero per oltre 1,5 s.
  const browser = await launchWithCamera('arnolfini/avvicinamento-cane');
  try {
    const page = await newPage(browser);
    await page.goto('/?p=arnolfini&notutorial');
    await page.click('#start');
    await expect.poll(async () => (await probe(page)).events.map((e) => e.type), { timeout: 40_000 }).toContain('lock:auto');
  } finally {
    await browser.close();
  }
});
