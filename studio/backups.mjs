// Copie di sicurezza e "Annulla" dello Studio. Prima di ogni modifica la
// cartella del quadro viene copiata in .studio/backup/; "Annulla" ripristina
// l'ultima azione. Si tengono le ultime MAX azioni.
import fs from 'node:fs';
import path from 'node:path';
import { folderId } from '../scripts/lib/contenuti.mjs';

const MAX = 30;

export class Backups {
  constructor(root) {
    this.src = path.join(root, 'contenuti');
    this.dir = path.join(root, '.studio/backup');
    this.file = path.join(root, '.studio/storia.json');
    fs.mkdirSync(this.dir, { recursive: true });
  }

  load() {
    try {
      return JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
      return [];
    }
  }

  save(list) {
    const keep = list.slice(-MAX);
    for (const old of list.slice(0, -MAX)) if (old.copy) fs.rmSync(old.copy, { recursive: true, force: true });
    fs.writeFileSync(this.file, JSON.stringify(keep, null, 1));
  }

  record(entry) {
    this.save([...this.load(), { ...entry, at: new Date().toISOString() }]);
  }

  copyOf(folder) {
    const copy = path.join(this.dir, `${Date.now()}-${folder}`);
    fs.cpSync(path.join(this.src, folder), copy, { recursive: true });
    return copy;
  }

  /** Copia di sicurezza prima di modificare un quadro. */
  snapshot(folder, label) {
    this.record({ type: 'snapshot', folder, copy: this.copyOf(folder), label });
  }

  /** Copia di tutta la cartella contenuti/ (prima di ripristinare una versione pubblicata). */
  snapshotAll(label) {
    const copy = path.join(this.dir, `${Date.now()}-tutto`);
    fs.cpSync(this.src, copy, { recursive: true });
    this.record({ type: 'all', copy, label });
  }

  /** Eliminazione: la cartella viene spostata nelle copie, non cancellata. */
  remove(folder) {
    const copy = path.join(this.dir, `${Date.now()}-${folder}`);
    fs.renameSync(path.join(this.src, folder), copy);
    this.record({ type: 'remove', folder, copy, label: `Eliminato ${folder}` });
  }

  lastLabel() {
    return this.load().at(-1)?.label ?? null;
  }

  undo() {
    const list = this.load();
    const e = list.pop();
    if (!e) return null;
    const target = path.join(this.src, e.folder ?? '');
    if (e.type === 'all') {
      fs.rmSync(this.src, { recursive: true, force: true });
      fs.cpSync(e.copy, this.src, { recursive: true });
      fs.rmSync(e.copy, { recursive: true, force: true });
    } else if (e.type === 'snapshot') {
      fs.rmSync(target, { recursive: true, force: true });
      fs.cpSync(e.copy, target, { recursive: true });
      fs.rmSync(e.copy, { recursive: true, force: true });
    } else if (e.type === 'remove') {
      fs.renameSync(e.copy, target);
    } else if (e.type === 'create') {
      fs.rmSync(target, { recursive: true, force: true });
    } else if (e.type === 'reorder') {
      // Ogni cartella torna al nome che aveva prima (stesso quadro, numero diverso).
      const byId = new Map(e.after.map((f) => [folderId(f), f]));
      e.before.forEach((b, i) => fs.renameSync(path.join(this.src, byId.get(folderId(b))), path.join(this.src, `_annulla-${i}`)));
      e.before.forEach((b, i) => fs.renameSync(path.join(this.src, `_annulla-${i}`), path.join(this.src, b)));
    }
    this.save(list);
    return e.label;
  }
}
