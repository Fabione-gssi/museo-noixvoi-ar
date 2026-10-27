// Anteprima sul telefono: il sito costruito viene servito in https sulla rete
// locale (stesso Wi-Fi del computer), con certificato autofirmato. Non usa
// servizi esterni. La fotocamera del telefono richiede https: al primo accesso
// il browser mostra un avviso sul certificato, da accettare.
//
// Viene esposto solo il sito dei visitatori (cartella dist), mai lo Studio.
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { preview } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

const PORT = 5443;
let server = null;

function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal && !/^169\.254\./.test(a.address) && !/vEthernet|VirtualBox|VMware|WSL/i.test(name)) out.push({ name, address: a.address });
    }
  }
  return out;
}

export async function startPreviewTunnel(root, emit) {
  emit({ step: 'costruisci', message: 'Costruisco il sito…' });
  await new Promise((resolve, reject) =>
    execFile('npx', ['vite', 'build', '--logLevel', 'warn'], { cwd: root, shell: process.platform === 'win32' }, (e, _o, err) => (e ? reject(new Error(err || e.message)) : resolve())));
  await server?.close();
  server = await preview({
    root,
    configFile: path.join(root, 'vite.config.ts'),
    plugins: [basicSsl()],
    preview: { host: '0.0.0.0', port: PORT, strictPort: true },
    logLevel: 'warn',
  });
  const ips = lanAddresses();
  if (!ips.length) throw new Error('Il computer non sembra collegato a una rete Wi-Fi o via cavo.');
  const urls = ips.map((i) => `https://${i.address}:${PORT}/`);
  emit({ step: 'fatto', message: 'Anteprima attiva sulla rete locale.', urls });
  return { urls };
}

export function stopPreviewTunnel() {
  void server?.close();
  server = null;
}
