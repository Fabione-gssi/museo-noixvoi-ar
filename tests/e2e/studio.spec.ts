// E2E dello Studio: aggiungere un quadro, caricare immagine/testo/video,
// assegnare le esperienze disponibili, preparare, controllare che contenuti/
// sia valido e che l'app lo mostri; anteprima con fotocamera simulata.
// Il quadro di prova viene creato in contenuti/ e rimosso alla fine.
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';

const ROOT = path.resolve(import.meta.dirname, '../..');
const STUDIO = 'http://127.0.0.1:5310/studio/?t=e2e-token';
const TITLE = 'Prova automatica Studio';
const ID = 'prova-automatica-studio';
const validate = new Ajv().compile(JSON.parse(fs.readFileSync(path.join(ROOT, 'schema/meta.schema.json'), 'utf8')));

const folderOf = () => fs.readdirSync(path.join(ROOT, 'contenuti')).find((f) => f.endsWith(`-${ID}`));

function cleanup() {
  const f = folderOf();
  if (f) fs.rmSync(path.join(ROOT, 'contenuti', f), { recursive: true, force: true });
  fs.rmSync(path.join(ROOT, 'public/data', ID), { recursive: true, force: true });
  fs.rmSync(path.join(ROOT, 'revisione', `${ID}.jpg`), { force: true });
  // index.json senza il quadro di prova.
  const idx = path.join(ROOT, 'public/data/index.json');
  const j = JSON.parse(fs.readFileSync(idx, 'utf8'));
  j.paintings = j.paintings.filter((p: { id: string }) => p.id !== ID);
  j.totalBytes = j.paintings.reduce((n: number, p: { bytes: number }) => n + p.bytes, 0);
  fs.writeFileSync(idx, JSON.stringify(j, null, 2));
}

async function waitJob(page: Page, timeout = 240_000) {
  await expect(page.locator('#jobbar')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#jobbar')).toBeHidden({ timeout });
}

test.describe.serial('Studio', () => {
  test.beforeAll(cleanup);
  test.afterAll(cleanup);

  test('aggiungere e preparare un quadro senza toccare file', async ({ page }) => {
    test.setTimeout(400_000);
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(STUDIO);
    await page.getByRole('button', { name: '+ Aggiungi quadro' }).click();
    await page.getByLabel('Titolo del nuovo quadro').fill(TITLE);
    await page.getByRole('button', { name: 'OK' }).click();
    await expect(page.getByRole('heading', { name: TITLE })).toBeVisible();
    const folder = folderOf()!;
    expect(folder).toBeTruthy();

    // Informazioni
    await page.getByLabel('Autore').fill('Autore di prova');
    await page.getByLabel('Anno').fill('2026');
    await page.getByLabel('Sala').fill('Sala 1');
    await page.getByRole('button', { name: 'Salva' }).click();
    await expect(page.locator('#toast')).toContainText('Informazioni salvate');

    // Immagine (si usa un quadro di pubblico dominio già presente)
    await page.getByRole('tab', { name: 'Immagine' }).click();
    await page.locator('input[type=file]').setInputFiles(path.join(ROOT, 'contenuti/06-zattera-medusa/quadro.jpg'));
    await expect(page.locator('.preview-img')).toBeVisible({ timeout: 30_000 });

    // Testo + voce demo
    await page.getByRole('tab', { name: 'Testo e audio' }).click();
    await page.getByLabel('Testo storico').fill('Questa è una prova automatica dello Studio. In primo piano si vede la zattera.');
    await page.getByRole('button', { name: 'Salva il testo' }).click();
    await expect(page.locator('#toast')).toContainText('Testo salvato');
    await page.getByLabel(/Usa la voce sintetica DEMO/).check();
    await expect(page.locator('#toast')).toContainText('Voce demo attivata');

    // Interazione: tutte quelle disponibili si possono assegnare; si torna al racconto.
    await page.getByRole('tab', { name: 'Interazione' }).click();
    await page.getByRole('button', { name: /^Dettagli/ }).click();
    await expect(page.locator('#toast')).toContainText('Interazione: Dettagli');
    await page.getByRole('button', { name: /^Racconto/ }).click();
    await expect(page.locator('#toast')).toContainText('Interazione: Racconto');
    await expect(page.getByRole('button', { name: /^Caccia/ })).toBeDisabled();

    // Racconto: caricamento di un video
    await page.getByRole('tab', { name: 'Racconto' }).click();
    await page.locator('input[type=file][accept="video/*"]').setInputFiles(path.join(ROOT, 'public/diag/clip.mp4'));
    await expect(page.locator('.preview-video')).toBeVisible({ timeout: 30_000 });

    // Preparazione
    await page.getByRole('button', { name: 'Prepara', exact: true }).click();
    await waitJob(page);

    // contenuti/ contiene solo file semplici e il risultato è valido.
    const files = fs.readdirSync(path.join(ROOT, 'contenuti', folder)).sort();
    expect(files).toEqual(['info.txt', 'quadro.jpg', 'racconto.mp4', 'testo.txt']);
    expect(fs.readFileSync(path.join(ROOT, 'contenuti', folder, 'info.txt'), 'utf8')).toContain('voce: demo');
    const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data', ID, 'meta.json'), 'utf8'));
    expect(validate(meta), JSON.stringify(validate.errors)).toBe(true);
    expect(meta).toMatchObject({ title: TITLE, room: 'Sala 1', experience: 'racconto', demo: true, racconto: { video: { src: 'racconto.mp4' } } });
  });

  test('l\'app mostra il nuovo quadro e il suo video', async ({ page }) => {
    await page.goto('http://localhost:5179/');
    await page.click('#start');
    await expect(page.locator('.painting-item', { hasText: TITLE })).toBeVisible();
    await page.goto(`http://localhost:5179/?p=${ID}&notutorial`);
    await page.click('#start');
    await expect(page.locator('#story .story-video')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#story .story-title')).toHaveText(TITLE);
  });

  test('anteprima con fotocamera simulata: il racconto parte', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    const medusa = fs.readdirSync(path.join(ROOT, 'contenuti')).find((f) => f.endsWith('zattera-medusa'))!;
    await page.goto(`${STUDIO}#/q/${medusa}/anteprima`);
    const app = page.frameLocator('iframe.phone-screen');
    await app.locator('body[data-ready]').waitFor({ timeout: 60_000 });
    await app.locator('#start').click();
    // Il tutorial compare solo la prima volta, dopo lo sblocco della fotocamera.
    const ok = app.locator('#tutorial-ok');
    await ok.waitFor({ timeout: 10_000 }).then(() => ok.click(), () => undefined);
    await expect(app.locator('#story')).toBeVisible({ timeout: 30_000 });
  });

  test('eliminare con conferma e recuperare con Annulla', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(STUDIO);
    const card = page.locator('.card', { hasText: TITLE });
    await card.getByRole('button', { name: 'Elimina' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Elimina' }).click();
    await expect(card).toHaveCount(0);
    expect(folderOf()).toBeUndefined();
    await page.locator('#undo').click();
    await expect(page.locator('.card', { hasText: TITLE })).toBeVisible();
    expect(folderOf()).toBeTruthy();
  });
});
