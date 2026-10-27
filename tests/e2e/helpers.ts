import { chromium, type Browser, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

export const VIDEO_DIR = path.resolve(import.meta.dirname, '../video');
export const RESULTS_DIR = path.resolve(import.meta.dirname, '../../test-results');

/** Chromium con fotocamera finta che riproduce in loop un video MJPEG di tests/video. */
export async function launchWithCamera(video: string | null): Promise<Browser> {
  const args = ['--use-fake-device-for-media-stream', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  if (video) {
    const file = path.join(VIDEO_DIR, `${video}.mjpeg`);
    if (!fs.existsSync(file)) throw new Error(`Manca ${file}: esegui node scripts/make-test-videos.mjs`);
    args.push('--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${file}`);
  }
  return chromium.launch({ args });
}

export async function newPage(browser: Browser, opts: { camera?: boolean; cpuThrottle?: number } = {}): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: opts.camera === false ? [] : ['camera'] });
  const page = await ctx.newPage();
  if (opts.cpuThrottle && opts.cpuThrottle > 1) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: opts.cpuThrottle });
  }
  return page;
}

export function saveResult(name: string, data: unknown) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(RESULTS_DIR, `${name}.json`), JSON.stringify(data, null, 2));
}

export interface Probe {
  phase: string;
  firstFoundMs: number | null;
  events: { t: number; type: string; target?: string }[];
  renderFps: number;
  trackerFps: number;
  tracking: string[];
  video: string;
  error: string;
}
export const probe = (page: Page) => page.evaluate(() => (window as unknown as { __ar: Probe }).__ar);
