import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { resolve } from 'node:path';

// HTTPS in sviluppo solo con VITE_HTTPS=1 (prova da telefono in rete locale):
// la fotocamera richiede un contesto sicuro, localhost escluso.
export default defineConfig({
  base: './',
  plugins: process.env.VITE_HTTPS ? [basicSsl()] : [],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        diagnostica: resolve(import.meta.dirname, 'diagnostica.html'),
        benchmark: resolve(import.meta.dirname, 'benchmark.html'),
      },
    },
  },
});
