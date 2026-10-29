// Testo completo del museo: divisione in passaggi e ricerca del passaggio che
// risponde alla domanda (sul telefono, senza rete).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseApprofondimento } from '../../scripts/lib/approfondimento.mjs';
import { PassageSearch, MIN_COVER, preferPassage } from '../../src/character/approfondimento';
import { LocalQA } from '../../src/character/dialog';

const read = (dir: string) => parseApprofondimento(fs.readFileSync(path.resolve(import.meta.dirname, `../../contenuti/${dir}/approfondimento.txt`), 'utf8'));

describe('approfondimento.txt', () => {
  it('chi parla, sezioni, fonti e paragrafi', () => {
    const ap = parseApprofondimento('Chi parla: Tizio.\n\n## Vita\nPrima frase. Seconda frase.\nFonte: libro A; libro B.\n\nAltro paragrafo.');
    expect(ap.chiParla).toBe('Tizio.');
    expect(ap.passages).toEqual([
      { id: 'p1', section: 'Vita', text: 'Prima frase. Seconda frase.', fonte: 'libro A; libro B.' },
      { id: 'p2', section: 'Vita', text: 'Altro paragrafo.' },
    ]);
  });

  it('i paragrafi lunghi si spezzano tra le frasi', () => {
    const long = Array.from({ length: 30 }, (_, i) => `Questa è la frase numero ${i} del paragrafo.`).join(' ');
    const ap = parseApprofondimento(long);
    expect(ap.passages.length).toBeGreaterThan(1);
    for (const p of ap.passages) expect(p.text.split(/\s+/).length).toBeLessThanOrEqual(110);
    expect(ap.passages.map((p) => p.text).join(' ')).toBe(long);
  });

  it('ogni paragrafo dei personaggi ha la sua fonte', () => {
    for (const dir of ['01-autoritratto-durer', '02-ginevra-de-benci']) {
      const ap = read(dir);
      expect(ap.chiParla).not.toBe('');
      expect(ap.passages.filter((p) => !p.fonte)).toEqual([]);
    }
  });
});

describe('ricerca dei passaggi', () => {
  const durer = new PassageSearch(read('01-autoritratto-durer').passages);
  const ginevra = new PassageSearch(read('02-ginevra-de-benci').passages);
  const top = (s: PassageSearch, q: string) => {
    const [h] = s.search(q);
    return h && h.cover >= MIN_COVER ? h.passage.text : '';
  };

  it.each([
    ['Quando sei nato?', /21 maggio 1471/],
    ['dove sei morto', /6 aprile 1528/],
    ['Eri sposato?', /Agnes Frey/],
    ['Hai avuto figli?', /figli/],
    ['Sei mai stato in Italia?', /Venezia/],
    ['Hai visto davvero il rinoceronte?', /rinoceronte/],
    ['Chi era il tuo maestro?', /Wolgemut/],
    ['Hai lavorato per l\'imperatore?', /Massimiliano/],
    ['Hai scritto dei libri?', /proporzioni/],
    ['Quanti autoritratti hai fatto?', /autoritratt|ritratto molte volte/],
    ['Da dove veniva tuo papà?', /Ungheria/],
  ])('Dürer: «%s»', (q, re) => expect(top(durer, q)).toMatch(re));

  it.each([
    ['Chi ti ha dipinto?', /Leonardo/],
    ['Quanto è grande il quadro?', /38 centimetri/],
    ['Sei l\'unico Leonardo in America?', /Americhe/],
    ['Lorenzo de Medici ti conosceva?', /Lorenzo/],
    ['Perché c\'è il ginepro?', /ginepro/],
  ])('Ginevra: «%s»', (q, re) => expect(top(ginevra, q)).toMatch(re));

  it.each(['Che tempo fa domani?', 'Qual è la tua squadra di calcio preferita?', 'Mi consigli una pizzeria?'])('fuori tema: «%s» non trova nulla', (q) => {
    expect(top(durer, q)).toBe('');
  });
});

describe('risposta preparata o testo del museo', () => {
  const meta = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../public/data/autoritratto-durer/meta.json'), 'utf8'));
  const qa = new LocalQA(meta.personaggio);
  const search = new PassageSearch(read('01-autoritratto-durer').passages);
  const passage = (q: string) => preferPassage(qa.match(q)?.score ?? null, search.search(q)[0]);

  it.each(['Sei mai stato in Italia?', 'Quando sei nato?', 'Eri sposato?', 'Hai visto il rinoceronte?', 'Chi era il tuo maestro?'])('«%s» → testo del museo', (q) => expect(passage(q)).toBe(true));
  it.each(['Chi sei?', 'Quando hai dipinto questo quadro?', 'Quanti anni avevi?', 'Dove si trova oggi il quadro?', 'Cosa sono le lettere A e D?'])('«%s» → risposta preparata', (q) => expect(passage(q)).toBe(false));
  it('fuori tema: né l’una né l’altro', () => {
    expect(passage('Che tempo farà domani a Milano?')).toBe(false);
    expect(qa.match('Che tempo farà domani a Milano?')).toBeNull();
  });
});
