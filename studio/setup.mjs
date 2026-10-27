// Installa ciò che manca per lo Studio e la pipeline, senza domande:
// pacchetti npm, ffmpeg, Python con i suoi pacchetti, modelli (voce demo,
// trascrizione, profondità), Chromium per la compilazione dei target.
// Ogni passo si salta se è già a posto. Uscita: righe JSON + messaggi leggibili.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const WIN = process.platform === 'win32';
const VENV_PY = path.join(ROOT, WIN ? '.venv/Scripts/python.exe' : '.venv/bin/python');
const MODELS = path.join(ROOT, '.models');
const say = (msg) => console.log(`• ${msg}`);
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: WIN, ...opts });
const ok = (cmd, args) => spawnSync(cmd, args, { cwd: ROOT, stdio: 'ignore', shell: WIN }).status === 0;

const DOWNLOADS = [
  // Voce DEMO: Piper "serena" (dataset sintetico, CC-BY-4.0).
  ['piper/it_IT-serena-medium.onnx', 'https://huggingface.co/rhasspy/piper-voices/resolve/main/it/it_IT/serena/medium/it_IT-serena-medium.onnx'],
  ['piper/it_IT-serena-medium.onnx.json', 'https://huggingface.co/rhasspy/piper-voices/resolve/main/it/it_IT/serena/medium/it_IT-serena-medium.onnx.json'],
  // Profondità: Depth Anything V2 Small (Apache-2.0).
  ['depth/depth-anything-v2-small.onnx', 'https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model.onnx'],
  // Anteprima sul telefono via internet: cloudflared ufficiale (Apache-2.0), versione fissata.
  ...(process.platform === 'win32' ? [['bin/cloudflared.exe', 'https://github.com/cloudflare/cloudflared/releases/download/2026.10.0/cloudflared-windows-amd64.exe']] : []),
];

async function main() {
  let problems = 0;

  if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
    say('Installo i pacchetti del progetto (una sola volta, qualche minuto)…');
    if (run('npm', ['ci']).status !== 0) problems++;
  }

  const wingetFfmpeg = path.join(process.env.LOCALAPPDATA ?? '', 'Microsoft/WinGet/Links/ffmpeg.exe');
  if (!ok('ffmpeg', ['-version']) && !fs.existsSync(wingetFfmpeg)) {
    say('Installo ffmpeg (conversione di audio e video)…');
    if (!WIN || run('winget', ['install', '--id', 'Gyan.FFmpeg', '-e', '--silent', '--accept-source-agreements', '--accept-package-agreements']).status !== 0) {
      say('⚠ Non sono riuscito a installare ffmpeg da solo: vedi DA_FARE_UTENTE.md.');
      problems++;
    }
  }

  if (!fs.existsSync(VENV_PY)) {
    const py = WIN ? (ok('py', ['-3.12', '--version']) ? ['py', ['-3.12']] : ok('python', ['--version']) ? ['python', []] : null) : ['python3', []];
    if (!py && WIN) {
      say('Installo Python 3.12…');
      run('winget', ['install', '--id', 'Python.Python.3.12', '-e', '--silent', '--accept-source-agreements', '--accept-package-agreements']);
    }
    const [cmd, pre] = py ?? ['py', ['-3.12']];
    say('Preparo l\'ambiente Python della pipeline…');
    if (run(cmd, [...pre, '-m', 'venv', '.venv']).status !== 0) {
      say('⚠ Non sono riuscito a creare l\'ambiente Python: vedi DA_FARE_UTENTE.md.');
      problems++;
    }
  }
  if (fs.existsSync(VENV_PY) && !ok(VENV_PY, ['-c', 'import piper, faster_whisper, onnxruntime, PIL'])) {
    say('Installo i pacchetti Python (voce demo, trascrizione, profondità)…');
    run(VENV_PY, ['-m', 'pip', 'install', '-q', '--upgrade', 'pip'], { shell: false });
    if (run(VENV_PY, ['-m', 'pip', 'install', '-q', '-r', 'scripts/py/requirements.txt'], { shell: false }).status !== 0) problems++;
  }

  for (const [rel, url] of DOWNLOADS) {
    const file = path.join(MODELS, rel);
    if (fs.existsSync(file) && fs.statSync(file).size > 0) continue;
    say(`Scarico il modello ${path.basename(rel)}…`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    } catch (e) {
      say(`⚠ Download non riuscito (${e.message}): riprova più tardi con una connessione attiva.`);
      problems++;
    }
  }

  // Chromium serve a compilare i target di riconoscimento e ai test.
  const pwCache = path.join(process.env.LOCALAPPDATA ?? path.join(process.env.HOME ?? '', '.cache'), 'ms-playwright');
  if (!fs.existsSync(pwCache) || !fs.readdirSync(pwCache).some((d) => d.startsWith('chromium'))) {
    say('Installo il browser interno per la preparazione dei contenuti…');
    if (run('npx', ['playwright', 'install', 'chromium']).status !== 0) problems++;
  }

  console.log(JSON.stringify({ event: 'setup', ok: problems === 0, problems }));
  say(problems ? 'Installazione completata con qualche avviso (vedi sopra).' : 'Tutto pronto.');
  process.exitCode = problems ? 1 : 0;
}

main();
