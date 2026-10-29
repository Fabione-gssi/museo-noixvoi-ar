// Pubblicazione dallo Studio: commit e push su GitHub, poi attesa della
// pubblicazione automatica (GitHub Actions → GitHub Pages). In alternativa,
// una cartella compressa da trascinare su Cloudflare Pages (caricamento diretto).
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

function sh(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd, maxBuffer: 20 * 1024 * 1024, shell: process.platform === 'win32' && cmd === 'npx' }, (err, stdout, stderr) =>
      err ? reject(Object.assign(new Error((stderr || err.message).trim().slice(0, 500)), { code: err.code })) : resolve(stdout.trim()));
  });
}

async function githubReady(root) {
  try {
    await sh('git', ['rev-parse', '--is-inside-work-tree'], root);
    const remote = await sh('git', ['remote', 'get-url', 'origin'], root);
    await sh('gh', ['auth', 'status'], root);
    return { ok: true, remote };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

const HISTORY = (root) => path.join(root, '.studio/pubblicazioni.json');

export function publications(root) {
  try {
    return JSON.parse(fs.readFileSync(HISTORY(root), 'utf8'));
  } catch {
    return [];
  }
}

export async function publish(root, emit, buildContent) {
  const gh = await githubReady(root);
  if (!gh.ok) {
    emit({ step: 'login', message: 'GitHub non è configurato su questo computer. Puoi accedere una volta sola (vedi la guida) oppure creare la cartella da caricare su Cloudflare Pages.', detail: gh.reason });
    throw new Error('GitHub non configurato');
  }
  emit({ step: 'prepara', message: 'Preparo i contenuti…' });
  await buildContent();
  emit({ step: 'salva', message: 'Salvo le modifiche…' });
  await sh('git', ['add', '--', 'contenuti', 'public', 'revisione', 'crediti.md', 'fonti.md', 'DA_FARE_UTENTE.md'], root);
  const pending = await sh('git', ['diff', '--cached', '--name-only'], root);
  if (pending) {
    const when = new Date().toLocaleString('it-IT');
    await sh('git', ['commit', '-m', `Contenuti aggiornati dallo Studio (${when})`], root);
  } else {
    emit({ step: 'salva', message: 'Nessuna modifica nuova da pubblicare: ripubblico la versione attuale.' });
  }
  const sha = await sh('git', ['rev-parse', 'HEAD'], root);
  emit({ step: 'invia', message: 'Invio a GitHub…' });
  await sh('git', ['push', 'origin', 'HEAD'], root);

  // Attesa del lavoro di pubblicazione legato a questo commit.
  emit({ step: 'attesa', message: 'Attendo la pubblicazione (di solito 1-2 minuti)…' });
  let runId = null;
  for (let i = 0; i < 30 && !runId; i++) {
    const out = await sh('gh', ['run', 'list', '--commit', sha, '--json', 'databaseId', '--limit', '1'], root).catch(() => '[]');
    runId = JSON.parse(out || '[]')[0]?.databaseId ?? null;
    if (!runId) await new Promise((r) => setTimeout(r, 4000));
  }
  if (!pending && !runId) {
    // Nessun nuovo commit: lancia comunque il lavoro di pubblicazione.
    await sh('gh', ['workflow', 'run', 'deploy.yml'], root);
  }
  if (runId) await sh('gh', ['run', 'watch', String(runId), '--exit-status'], root);
  const url = await sh('gh', ['api', `repos/{owner}/{repo}/pages`, '--jq', '.html_url'], root).catch(() => '');
  const entry = { at: new Date().toISOString(), sha, url, message: pending ? 'Contenuti aggiornati' : 'Ripubblicazione' };
  fs.writeFileSync(HISTORY(root), JSON.stringify([...publications(root), entry], null, 1));
  emit({ step: 'fatto', message: 'Pubblicato!', url });
  return entry;
}

/**
 * Cronologia: le versioni dei contenuti pubblicate su GitHub (ogni invio aggiorna
 * il sito), dalla più recente. La prima è quella online.
 */
export async function versions(root) {
  try {
    await sh('git', ['rev-parse', '--verify', 'origin/main'], root);
  } catch {
    return { available: false, versions: [], changed: false };
  }
  const log = await sh('git', ['log', 'origin/main', '-n', '30', '--format=%H%x09%cI%x09%s', '--', 'contenuti'], root);
  const list = await Promise.all(log.split('\n').filter(Boolean).map(async (line) => {
    const [sha, at, message] = line.split('\t');
    const tree = await sh('git', ['ls-tree', '--name-only', sha, 'contenuti/'], root).catch(() => '');
    const paintings = tree.split('\n').filter(Boolean).map((p) => p.replace(/^contenuti\//, '')).filter((p) => !p.startsWith('.') && !p.includes('.'));
    return { sha, at, message, paintings };
  }));
  // Modifiche fatte nello Studio e non ancora pubblicate.
  const status = await sh('git', ['status', '--porcelain', '--', 'contenuti'], root).catch(() => '');
  const ahead = await sh('git', ['rev-list', '--count', 'origin/main..HEAD', '--', 'contenuti'], root).catch(() => '0');
  return { available: true, versions: list, changed: !!status || Number(ahead) > 0 };
}

/** Riporta contenuti/ com'era nella versione pubblicata indicata (non pubblica nulla). */
export async function restoreVersion(root, sha) {
  const { versions: list } = await versions(root);
  if (!/^[0-9a-f]{40}$/.test(sha ?? '') || !list.some((v) => v.sha === sha)) throw new Error('Versione sconosciuta');
  const src = path.join(root, 'contenuti');
  for (const f of fs.readdirSync(src)) fs.rmSync(path.join(src, f), { recursive: true, force: true });
  await sh('git', ['checkout', sha, '--', 'contenuti'], root);
  // Le modifiche restano da pubblicare: niente nell'area di commit.
  await sh('git', ['reset', '-q', '--', 'contenuti'], root);
  return list.find((v) => v.sha === sha);
}

/** Cartella compressa del sito da trascinare su Cloudflare Pages ("caricamento diretto"). */
export async function buildZip(root, emit) {
  emit({ step: 'costruisci', message: 'Costruisco il sito…' });
  await sh('npx', ['vite', 'build', '--logLevel', 'warn'], root);
  const outDir = path.join(root, 'pubblicazione');
  fs.mkdirSync(outDir, { recursive: true });
  const zip = path.join(outDir, 'sito.zip');
  fs.rmSync(zip, { force: true });
  // tar di Windows 10+ crea archivi zip con -a.
  await sh('tar', ['-a', '-c', '-f', zip, '-C', path.join(root, 'dist'), '.'], root);
  emit({ step: 'fatto', message: 'Cartella pronta.', file: zip });
  return { file: zip };
}
