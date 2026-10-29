// Dialogo locale del personaggio: domande scritte in modi diversi (anche con
// errori di battitura) trovano la risposta giusta; quelle fuori tema ricevono
// l'onesto "non so rispondere".
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { LocalQA, tokens } from '../../src/character/dialog';
import type { Personaggio } from '../../src/data';

const DATA = path.resolve(import.meta.dirname, '../../public/data');
const load = (id: string) => JSON.parse(fs.readFileSync(path.join(DATA, id, 'meta.json'), 'utf8')).personaggio as Personaggio;

describe('tokens', () => {
  it('toglie accenti, punteggiatura e parole vuote, unifica singolare e plurale', () => {
    expect(tokens('Quanti anni avevi?')).toEqual(tokens('quanti ANNO avevi'));
    expect(tokens('Perché è così?')).toEqual(['perch']);
  });
});

describe.each([
  ['autoritratto-durer', [
    ['Chi sei?', 'chi-sei'],
    ['come ti chiami', 'chi-sei'],
    ['quanti anni avevi quando lo hai dipinto', 'eta'],
    ['che cosa dice la scrita in latino', 'scritta'],
    ['perché sembri Gesù Cristo?', 'posa'],
    ['in che anno hai fatto il quadro', 'quando'],
    ['dove si trova adesso il ritratto', 'dove'],
    ['che vestito porti', 'vestito'],
    ['la pelliccia', 'vestito'],
    ['cosa sono le lettere A e D', 'iniziali'],
    ['cosa fai con la mano?', 'mano'],
  ]],
  ['ginevra-de-benci', [
    ['chi sei', 'chi-sei'],
    ['chi era tuo padre', 'famiglia'],
    ['chi ti ha dipinto?', 'pittore'],
    ['perche ce un ginepro dietro', 'ginepro'],
    ['cosa vuol dire virtutem forma decorat', 'motto'],
    ['dove sono le tue mani?', 'mani'],
    ['eri sposata', 'matrimonio'],
    ['chi era Bembo', 'bembo'],
    ['cosa ce sul retro della tavola', 'retro'],
  ]],
] as const)('%s', (id, cases) => {
  const qa = new LocalQA(load(id));
  it.each(cases)('"%s" → %s', (text, expected) => {
    expect(qa.ask(text).id).toBe(expected);
  });
  it.each(['qual è il tuo piatto preferito?', 'che tempo fa domani', 'quanto costa il biglietto del museo', 'asdfgh', ''])('fuori tema: "%s" → non so', (text) => {
    const a = qa.ask(text);
    expect(a.known).toBe(false);
    expect(a.text).toMatch(/Non so rispondere/);
  });
  it('ogni domanda prevista trova sé stessa e ha una fonte', () => {
    for (const q of load(id).domande) {
      expect(qa.ask(q.domanda).id).toBe(q.id);
      expect(q.fonte).toBeTruthy();
    }
  });
});
