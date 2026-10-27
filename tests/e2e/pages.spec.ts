// Pagina diagnostica e benchmark; il benchmark gira anche con CPU rallentata 4x,
// approssimazione grossolana di un telefono di fascia media.
import { test, expect } from '@playwright/test';
import { launchWithCamera, newPage, saveResult } from './helpers';

type W = { __diag: { done: boolean; results: { name: string; status: string }[] }; __bench: { done: boolean; results: unknown[] } };

test('diagnostica: completa e fotocamera ok', async () => {
  const browser = await launchWithCamera('fermo');
  try {
    const page = await newPage(browser);
    await page.goto('/diagnostica.html');
    await page.click('#run');
    await page.waitForFunction(() => (window as unknown as W).__diag.done, null, { timeout: 60_000 });
    const d = await page.evaluate(() => (window as unknown as W).__diag.results);
    saveResult('diagnostica-chromium', d);
    expect(d.find((r) => r.name === 'Fotocamera')?.status).toBe('ok');
  } finally {
    await browser.close();
  }
});

for (const cpuThrottle of [1, 4]) {
  test(`benchmark target multipli (CPU x${cpuThrottle})`, async () => {
    test.setTimeout(300_000);
    const browser = await launchWithCamera('fermo');
    try {
      const page = await newPage(browser, { cpuThrottle });
      await page.goto('/benchmark.html');
      await page.click('#run');
      await page.waitForFunction(() => (window as unknown as W).__bench.done, null, { timeout: 280_000, polling: 1000 });
      const b = await page.evaluate(() => (window as unknown as W).__bench);
      saveResult(`benchmark-cpu${cpuThrottle}`, b);
      expect(b.results).toHaveLength(3);
    } finally {
      await browser.close();
    }
  });
}
