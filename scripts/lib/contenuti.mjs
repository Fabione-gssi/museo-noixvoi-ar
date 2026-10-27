// Lettura e scrittura della cartella contenuti/ (fonte di verità), condivise
// tra pipeline e Studio.
import fs from 'node:fs';
import path from 'node:path';

export const AUDIO_EXT = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.flac'];
export const EXPERIENCES = ['dettagli', 'caccia', 'personaggio', 'racconto'];

/** "06-zattera-medusa" → "zattera-medusa" (il numero serve solo all'ordine). */
export const folderId = (folder) => folder.replace(/^\d+[-_]?/, '') || folder;

export function findFile(dir, base, exts) {
  for (const e of exts) {
    for (const name of [base + e, base + e.toUpperCase()]) {
      const f = path.join(dir, name);
      if (fs.existsSync(f)) return f;
    }
  }
  return null;
}

const KEYS = ['esperienza', 'voce'];

/**
 * info.txt: titolo, autore, anno, sala (una riga ciascuno), più righe
 * facoltative "chiave: valore" (esperienza, voce).
 */
export function readInfo(dir) {
  const file = path.join(dir, 'info.txt');
  const problems = [];
  if (!fs.existsSync(file)) return { info: {}, problems: ['manca info.txt (titolo, autore, anno, sala)'] };
  const lines = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const kv = {};
  const plain = [];
  for (const l of lines) {
    const m = l.match(/^([a-zà-ù]+)\s*:\s*(.+)$/i);
    if (m && KEYS.includes(m[1].toLowerCase())) kv[m[1].toLowerCase()] = m[2].trim().toLowerCase();
    else plain.push(l);
  }
  const [title, artist, year, room] = plain;
  const info = { title, artist, year, room, experience: kv.esperienza, voce: kv.voce };
  if (info.experience && !EXPERIENCES.includes(info.experience)) {
    problems.push(`esperienza "${info.experience}" sconosciuta: uso "racconto"`);
    info.experience = undefined;
  }
  for (const [k, label] of [['title', 'titolo'], ['artist', 'autore'], ['year', 'anno'], ['room', 'sala']]) {
    if (!info[k]) problems.push(`manca ${label} in info.txt`);
    else if (/^\[DA COMPLETARE/i.test(info[k])) problems.push(`${label} da completare`);
  }
  return { info, problems };
}

export function writeInfo(dir, info) {
  const lines = [info.title ?? '', info.artist ?? '', info.year ?? '', info.room || '[DA COMPLETARE: sala]'];
  if (info.experience) lines.push(`esperienza: ${info.experience}`);
  if (info.voce) lines.push(`voce: ${info.voce}`);
  fs.writeFileSync(path.join(dir, 'info.txt'), lines.join('\n') + '\n');
}

export function readRegions(dir) {
  const file = path.join(dir, 'regioni.json');
  if (!fs.existsSync(file)) return { dettagli: [] };
  const r = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { dettagli: [], ...r };
}

export function writeRegions(dir, regions) {
  fs.writeFileSync(path.join(dir, 'regioni.json'), JSON.stringify(regions, null, 2) + '\n');
}
