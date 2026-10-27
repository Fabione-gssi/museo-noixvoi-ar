import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  // Un test alla volta: le misure di fps non devono contendersi la CPU.
  workers: 1,
  reporter: [['list']],
  // WebGL software in headless: senza questi flag TensorFlow.js e three.js non partono.
  use: { baseURL: 'http://localhost:5179', launchOptions: { args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } },
  webServer: [
    {
      command: 'npx vite --port 5179 --strictPort',
      url: 'http://localhost:5179',
      reuseExistingServer: true,
    },
    {
      // Studio con token fisso, solo per i test (tests/e2e/studio.spec.ts).
      command: 'node studio/server.mjs --port 5310',
      url: 'http://127.0.0.1:5310/studio/',
      env: { STUDIO_TOKEN: 'e2e-token' },
      reuseExistingServer: true,
    },
  ],
});
