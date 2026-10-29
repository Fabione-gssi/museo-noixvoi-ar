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
    // Formulazioni libere e sinonimi (come le scrivono i visitatori).
    ["chi è l'autore del quadro?", 'chi-sei'],
    ['che abiti porti?', 'vestito'],
    ['come mai sei vestito con la pelliccia', 'vestito'],
    ['che significa la frase in latino', 'scritta'],
    ['in quale museo è esposto il ritratto?', 'dove'],
    ['dove posso vederlo dal vero', 'dove'],
    ['cosa è successo al quadro dopo la tua morte', 'storia'],
    ['perché guardi così fisso?', 'posa'],
    ['che tecnica hai usato, è una tela?', 'tecnica'],
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
    ['chi era tuo marito?', 'matrimonio'],
    ['come si chiamava il tuo papà', 'famiglia'],
    ['perché il quadro è tagliato?', 'mani'],
    ['che albero hai alle spalle', 'ginepro'],
    ['chi ti ha comprata?', 'dove'],
    ['che vuol dire la scritta in latino?', 'motto'],
    ["chi è l'artista", 'pittore'],
    ["chi era l'ambasciatore veneziano", 'bembo'],
  ]],
] as const)('%s', (id, cases) => {
  const qa = new LocalQA(load(id));
  it.each(cases)('"%s" → %s', (text, expected) => {
    expect(qa.ask(text).id).toBe(expected);
  });
  it.each(['qual è il tuo piatto preferito?', 'che tempo fa domani', 'asdfgh', ''])('fuori tema: "%s" → non so', (text) => {
    const a = qa.ask(text);
    expect(a.known).toBe(false);
    expect(a.text).toMatch(/Non so rispondere/);
  });
  it('una parola sola presente in più risposte: propone le domande vicine', () => {
    const a = qa.ask(id === 'autoritratto-durer' ? 'Norimberga' : 'Firenze');
    expect(['forse', 'chi-sei']).toContain(a.id);
    if (a.id === 'forse') expect(a.suggestions!.map((s) => s.id)).toContain('chi-sei');
  });
  it('incerto: "forse volevi chiedere" con al massimo 3 domande vicine, mai una risposta inventata', () => {
    const a = qa.ask('quanto costa il biglietto del museo');
    expect(a.known).toBe(false);
    if (a.id === 'forse') {
      expect(a.suggestions!.length).toBeGreaterThan(0);
      expect(a.suggestions!.length).toBeLessThanOrEqual(3);
      expect(a.audio).toBeUndefined();
    } else expect(a.id).toBe('nonso');
  });
  it('ogni domanda prevista trova sé stessa e ha una fonte', () => {
    for (const q of load(id).domande) {
      expect(qa.ask(q.domanda).id).toBe(q.id);
      expect(q.fonte).toBeTruthy();
    }
  });
});
