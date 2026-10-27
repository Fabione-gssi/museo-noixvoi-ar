// Riconoscimento con fotocamera simulata (video sintetici da scripts/make-test-videos.mjs).
// Gli scenari "principali" devono passare; quelli di robustezza registrano solo l'esito
// in test-results/ (finiscono in docs/RISULTATI_TEST.md).
import { test, expect } from '@playwright/test';
import { launchWithCamera, newPage, probe, saveResult, type Probe } from './helpers';

const WATCH_MS = 25_000;

async function runScenario(video: string, until: (p: Probe) => boolean, watchMs = WATCH_MS) {
  const browser = await launchWithCamera(`arnolfini/${video}`);
  try {
    const page = await newPage(browser);
    await page.goto('/?p=arnolfini&debug=1&notutorial');
    await page.click('#start');
    await expect(page.locator('#ar-screen')).toBeVisible({ timeout: 60_000 });
    const t0 = Date.now();
    let p = await probe(page);
    while (!until(p) && Date.now() - t0 < watchMs) {
      await page.waitForTimeout(500);
      p = await probe(page);
    }
    const result = { video, ...p, passed: until(p) };
    saveResult(`tracking-arnolfini-${video}`, result);
    return result;
  } finally {
    await browser.close();
  }
}

const mainFound = (p: Probe) => p.events.some((e) => e.type === 'found' && e.target === 'Ritratto dei coniugi Arnolfini');
const discovered = (label: string) => (p: Probe) => p.events.some((e) => e.type.startsWith('discover') && e.target === label);

test.describe('scenari principali', () => {
  test('quadro fermo: riconosciuto @principale', async () => {
    const r = await runScenario('fermo', mainFound);
    expect(r.passed, JSON.stringify(r.events)).toBe(true);
  });
  test('avvicinamento allo specchio: particolare trovato @principale', async () => {
    const r = await runScenario('avvicinamento-specchio', discovered('Lo specchio convesso'), 40_000);
    expect(r.passed, JSON.stringify(r.events)).toBe(true);
  });
  test('avvicinamento alla firma (particolare piccolo): trovato', async () => {
    const r = await runScenario('avvicinamento-firma', discovered('La firma del pittore'), 40_000);
    expect(r.passed, JSON.stringify(r.events)).toBe(true);
  });
  test('nessun quadro: nessun falso riconoscimento', async () => {
    const r = await runScenario('nessun-quadro', () => false, 12_000);
    expect(r.events.filter((e) => e.type === 'found')).toEqual([]);
  });
});

test.describe('robustezza (solo registrazione)', () => {
  for (const video of ['scansione', 'inclinazione', 'riflesso', 'poca-luce', 'sfocatura']) {
    test(video, async () => {
      const r = await runScenario(video, mainFound);
      test.info().annotations.push({ type: 'esito', description: r.passed ? `riconosciuto in ${r.firstFoundMs} ms` : 'non riconosciuto' });
    });
  }
});

test('fotocamera negata: si apre la modalità senza fotocamera @principale', async () => {
  const browser = await launchWithCamera(null);
  try {
    const page = await newPage(browser, { camera: false });
    await page.goto('/?p=arnolfini&notutorial');
    await page.click('#start');
    await expect(page.locator('#fallback')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#fallback .find-item')).toHaveCount(6);
  } finally {
    await browser.close();
  }
});

test('senza ?p si apre la scelta del quadro', async () => {
  const browser = await launchWithCamera('arnolfini/fermo');
  try {
    const page = await newPage(browser);
    await page.goto('/');
    await page.click('#start');
    await expect(page.locator('#picker')).toBeVisible();
    await expect(page.locator('.painting-item')).toContainText(['Arnolfini']);
  } finally {
    await browser.close();
  }
});
