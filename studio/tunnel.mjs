// Anteprima sul telefono. Il sito costruito (cartella dist, mai lo Studio)
// viene servito in locale e reso raggiungibile in due modi:
// 1. via internet con un "quick tunnel" gratuito di Cloudflare (cloudflared,
//    nessun account): indirizzo https://….trycloudflare.com, funziona anche
//    col telefono in rete mobile. L'indirizzo è casuale e vale finché resta attivo;
// 2. sulla rete locale (stesso Wi-Fi) in https con certificato autofirmato,
//    come ripiego se il tunnel non parte.
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { preview } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

const PORT = 5443;
let server = null;
let tunnel = null;

function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal && !/^169\.254\./.test(a.address) && !/vEthernet|VirtualBox|VMware|WSL/i.test(name)) out.push(a.address);
    }
  }
  return out;
}

function startTunnel(root) {
  const exe = path.join(root, '.models/bin', process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
  if (!fs.existsSync(exe)) return Promise.resolve(null);
  return new Promise((resolve) => {
    // Il preview locale ha un certificato autofirmato: cloudflared non lo verifica (tratto solo locale).
    tunnel = spawn(exe, ['tunnel', '--no-autoupdate', '--url', `https://127.0.0.1:${PORT}`, '--no-tls-verify'], { windowsHide: true });
    let found = false;
    const onData = (d) => {
      const m = String(d).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (m && !found) {
        found = true;
        resolve(m[0]);
      }
    };
    tunnel.stdout.on('data', onData);
    tunnel.stderr.on('data', onData);
    tunnel.on('close', () => !found && resolve(null));
    setTimeout(() => !found && resolve(null), 30_000);
  });
}

/** Attende che l'indirizzo pubblico risponda davvero (il DNS del tunnel impiega qualche secondo). */
async function waitReachable(url) {
  for (let i = 0; i < 20; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (r.ok) return true;
    } catch { /* non ancora pronto */ }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

export async function startPreviewTunnel(root, emit) {
  stopPreviewTunnel();
  emit({ step: 'costruisci', message: 'Costruisco il sito…' });
  await new Promise((resolve, reject) =>
    execFile('npx', ['vite', 'build', '--logLevel', 'warn'], { cwd: root, shell: process.platform === 'win32' }, (e, _o, err) => (e ? reject(new Error(err || e.message)) : resolve())));
  server = await preview({
    root,
    configFile: path.join(root, 'vite.config.ts'),
    plugins: [basicSsl()],
    preview: { host: '0.0.0.0', port: PORT, strictPort: true },
    logLevel: 'warn',
  });
  emit({ step: 'tunnel', message: 'Apro il collegamento via internet…' });
  const publicUrl = await startTunnel(root);
  const reachable = publicUrl ? await waitReachable(publicUrl) : false;
  const lan = lanAddresses().map((ip) => `https://${ip}:${PORT}/`);
  if (publicUrl && reachable) {
    emit({ step: 'fatto', message: 'Anteprima attiva via internet.', urls: [`${publicUrl}/`], lan });
    return { urls: [`${publicUrl}/`], lan };
  }
  if (!lan.length) throw new Error('Non riesco a creare il collegamento: il computer non sembra connesso a internet.');
  emit({ step: 'fatto', message: 'Il collegamento via internet non è partito: uso la rete locale (stesso Wi-Fi).', urls: lan, local: true });
  return { urls: lan, local: true };
}

export function stopPreviewTunnel() {
  tunnel?.kill();
  tunnel = null;
  void server?.close();
  server = null;
}

process.on('exit', () => tunnel?.kill());
