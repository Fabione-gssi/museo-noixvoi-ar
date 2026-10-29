// Video di prova di 5 secondi del volto animato (quality gate della Fase 4):
// per ogni quadro "personaggio", una versione "completa" (bocca, ciglia,
// sguardo) e una "presenza" (solo sguardo, respiro, parallasse), con l'audio.
// Escono in revisione/volto-<id>-<modo>.mp4, da giudicare: naturale,
// accettabile o inquietante.
//
// Uso: node scripts/make-face-previews.mjs [id...]   (serve il sito su http://localhost:5179)
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ffmpegPath } from './lib/ffmpeg.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'public/data');
const OUT = path.join(ROOT, 'revisione');
const SITE = process.env.SITE ?? 'http://localhost:5179';
const SECONDS = 5;
const START = 2; // si parte da un punto in cui la voce sta già parlando
const SIZE = { width: 540, height: 720 };

const wanted = process.argv.slice(2);
const metas = fs.readdirSync(DATA)
  .filter((d) => fs.existsSync(path.join(DATA, d, 'meta.json')))
  .map((d) => JSON.parse(fs.readFileSync(path.join(DATA, d, 'meta.json'), 'utf8')))
  .filter((m) => m.personaggio && (!wanted.length || wanted.includes(m.id)));

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const tmp = path.join(ROOT, '.cache/anteprime');
try {
  for (const meta of metas) {
    for (const modo of ['completa', 'presenza']) {
      fs.rmSync(tmp, { recursive: true, force: true });
      const ctx = await browser.newContext({ viewport: SIZE, recordVideo: { dir: tmp, size: SIZE } });
      const page = await ctx.newPage();
      const t0 = Date.now();
      await page.goto(`${SITE}/?p=${meta.id}&notutorial&anteprima=1&modo=${modo}`);
      await page.click('#start');
      await page.waitForFunction(() => window.__ar?.phase === 'character');
      // Si porta l'audio al punto di partenza e si misura quando riparte.
      await page.evaluate((s) => { window.__audio.currentTime = s; }, START);
      await page.waitForFunction((s) => !window.__audio.paused && window.__audio.currentTime > s + 0.05, START);
      const offset = (Date.now() - t0) / 1000 - 0.05;
      await page.waitForTimeout(SECONDS * 1000 + 300);
      const video = await page.video().path();
      await ctx.close();
      const audio = path.join(DATA, meta.id, meta.audio.fallback);
      const out = path.join(OUT, `volto-${meta.id}-${modo}.mp4`);
      execFileSync(ffmpegPath(), ['-v', 'error', '-y', '-ss', String(offset), '-t', String(SECONDS), '-i', video, '-ss', String(START + 0.05), '-t', String(SECONDS), '-i', audio,
        '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', out]);
      console.log(`Anteprima pronta: ${path.relative(ROOT, out)}`);
    }
  }
} finally {
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
