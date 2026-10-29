// Pagina ?debug=1 per i test sul campo: versione, stato del riconoscimento con
// il nome del target agganciato, fps e rapporto da copiare.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { launchWithCamera, newPage } from './helpers';

const DATA = path.resolve(import.meta.dirname, '../../public/data');
const meta = JSON.parse(fs.readFileSync(path.join(DATA, 'arnolfini', 'meta.json'), 'utf8'));
const { version } = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../package.json'), 'utf8'));

test('?debug=1 mostra stato, target agganciato, fps e copia il rapporto', async () => {
  const browser = await launchWithCamera('arnolfini/fermo');
  try {
    const page = await newPage(browser);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/?p=arnolfini&debug=1&notutorial');
    await expect(page.locator('#version')).toContainText(`Versione ${version}`);
    await page.click('#start');
    const panel = page.locator('#debug');
    await expect(panel).toContainText(`versione ${version}`);
    await expect(panel).toContainText(`agganciato: ${meta.title}`, { timeout: 30_000 });
    await expect(panel).toContainText(/render [1-9]\d* fps/);
    await page.getByRole('button', { name: 'Riduci' }).click();
    await expect(panel.locator('pre')).not.toContainText('versione');
    await page.getByRole('button', { name: 'Copia rapporto' }).click();
    const copied = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
    expect(copied).toMatchObject({ painting: meta.title, experience: 'dettagli' });
    expect(copied.probe.firstFoundMs).toBeGreaterThan(0);
  } finally {
    await browser.close();
  }
});
