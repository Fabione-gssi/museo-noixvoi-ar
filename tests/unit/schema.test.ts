import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const validate = new Ajv({ allErrors: true }).compile(JSON.parse(fs.readFileSync(path.join(root, 'schema/meta.schema.json'), 'utf8')));

describe('schema meta.json', () => {
  const dir = path.join(root, 'public/data');
  for (const id of fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'meta.json')))) {
    it(`il meta.json generato di "${id}" è valido`, () => {
      const meta = JSON.parse(fs.readFileSync(path.join(dir, id, 'meta.json'), 'utf8'));
      expect(validate(meta), JSON.stringify(validate.errors)).toBe(true);
    });
  }
  it('rifiuta un\'esperienza sconosciuta e coordinate fuori dall\'immagine', () => {
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'arnolfini/meta.json'), 'utf8'));
    expect(validate({ ...meta, experience: 'magia' })).toBe(false);
    expect(validate({ ...meta, dettagli: [{ ...meta.dettagli[0], crop: { x: 1.5, y: 0, w: 0.1, h: 0.1 } }] })).toBe(false);
  });
});
