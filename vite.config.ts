import { defineConfig, type Plugin } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { resolve } from 'node:path';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const ROOT = import.meta.dirname;

/**
 * Service worker (uso senza internet), solo nel sito costruito: parte da
 * sw/sw.js e vi inserisce l'elenco dei file dell'app da salvare subito e
 * un'impronta che cambia a ogni modifica dell'app. Le pagine di prova
 * (diagnostica, benchmark) restano fuori.
 */
function serviceWorker(): Plugin {
  return {
    name: 'service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter((f) => !/^(diagnostica|benchmark)\.html$|^assets\/(diagnostica|benchmark)-/.test(f)).sort();
      const icons = fs.readdirSync(resolve(ROOT, 'public/icons')).map((f) => `icons/${f}`);
      const precache = [...files, 'manifest.webmanifest', ...icons];
      const hash = createHash('sha1');
      for (const f of files) {
        const item = bundle[f];
        hash.update(f).update(item.type === 'chunk' ? item.code : item.source);
      }
      for (const f of ['manifest.webmanifest', ...icons]) hash.update(fs.readFileSync(resolve(ROOT, 'public', f)));
      const source = fs.readFileSync(resolve(ROOT, 'sw/sw.js'), 'utf8')
        .replace("const VERSION = '__VERSION__'", `const VERSION = ${JSON.stringify(hash.digest('hex').slice(0, 12))}`)
        .replace('const PRECACHE = __PRECACHE__', `const PRECACHE = ${JSON.stringify(precache)}`);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// HTTPS in sviluppo solo con VITE_HTTPS=1 (prova da telefono in rete locale):
// la fotocamera richiede un contesto sicuro, localhost escluso.
export default defineConfig({
  base: './',
  plugins: [...(process.env.VITE_HTTPS ? [basicSsl()] : []), serviceWorker()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      input: {
        main: resolve(ROOT, 'index.html'),
        diagnostica: resolve(ROOT, 'diagnostica.html'),
        benchmark: resolve(ROOT, 'benchmark.html'),
      },
    },
  },
});
