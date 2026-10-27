import { describe, it, expect } from 'vitest';
// @ts-expect-error modulo JS della pipeline
import { findPhraseTime, buildTimeline, toVtt } from '../../scripts/lib/timeline.mjs';
import { rectAt, fitToScreen, parseVtt, cueAt, keyIndexAt, FULL, type Keyframe } from '../../src/story/timeline';

const alignment = {
  sentences: [
    { text: 'Guarda prima in basso.', start: 0, end: 2, words: [
      { w: 'Guarda', start: 0, end: 0.5 }, { w: 'prima', start: 0.5, end: 1 }, { w: 'in', start: 1, end: 1.2 }, { w: 'basso', start: 1.2, end: 2 }] },
    { text: "Laggiù, minuscola, c'è la nave Argus.", start: 3, end: 6, words: [
      { w: 'Laggiù', start: 3, end: 3.5 }, { w: 'minuscola', start: 3.5, end: 4.2 }, { w: "c'è", start: 4.2, end: 4.5 },
      { w: 'la', start: 4.5, end: 4.7 }, { w: 'nave', start: 4.7, end: 5.1 }, { w: 'Argus', start: 5.1, end: 6 }] },
  ],
};

describe('findPhraseTime', () => {
  it('trova la frase ignorando accenti, maiuscole e punteggiatura', () => {
    expect(findPhraseTime(alignment, 'laggiu, MINUSCOLA')).toEqual({ start: 3, end: 4.2 });
    expect(findPhraseTime(alignment, "c'è la nave")).toEqual({ start: 4.2, end: 5.1 });
  });
  it('restituisce null se la frase non c\'è', () => {
    expect(findPhraseTime(alignment, 'nave pirata')).toBeNull();
    expect(findPhraseTime(alignment, '')).toBeNull();
  });
});

describe('buildTimeline', () => {
  const det = [
    { id: 'argus', label: 'La nave', crop: { x: 0.8, y: 0.4, w: 0.05, h: 0.05 }, ancora: 'laggiù minuscola' },
    { id: 'manca', label: 'Manca', crop: { x: 0, y: 0, w: 0.1, h: 0.1 }, ancora: 'frase assente' },
  ];
  it('parte dal quadro intero e aggiunge un movimento per ogni ancora trovata', () => {
    const { timeline, missing } = buildTimeline(alignment, det);
    expect(timeline[0]).toMatchObject({ t: 0, args: { rect: FULL } });
    expect(timeline[1]).toMatchObject({ t: 2.7, args: { id: 'argus' } });
    expect(missing).toEqual(['frase assente']);
  });
  it('unisce due particolari nominati quasi insieme', () => {
    const two = [
      { id: 'a', label: 'A', crop: { x: 0.1, y: 0.1, w: 0.1, h: 0.1 }, ancora: 'minuscola' },
      { id: 'b', label: 'B', crop: { x: 0.5, y: 0.5, w: 0.1, h: 0.1 }, ancora: 'nave Argus' },
    ];
    const { timeline } = buildTimeline(alignment, two);
    expect(timeline).toHaveLength(2);
    expect(timeline[1].args.rect).toEqual({ x: 0.1, y: 0.1, w: 0.5, h: 0.5 });
  });
  it('usa la sequenza manuale se presente', () => {
    const manual = [{ t: 5, action: 'cameraTo', args: { rect: FULL } }, { t: 0, action: 'cameraTo', args: { rect: FULL } }];
    expect(buildTimeline(alignment, det, [], manual).timeline.map((k: Keyframe) => k.t)).toEqual([0, 5]);
  });
});

describe('sottotitoli', () => {
  it('genera WebVTT con la punteggiatura del testo e lo rilegge', () => {
    const vtt = toVtt(alignment);
    expect(vtt.startsWith('WEBVTT')).toBe(true);
    const cues = parseVtt(vtt);
    expect(cues).toHaveLength(2);
    expect(cues[1].text).toBe("Laggiù, minuscola, c'è la nave Argus.");
    expect(cueAt(cues, 4)?.start).toBe(3);
    expect(cueAt(cues, 2.5)).toBeNull();
  });
  it('spezza le frasi lunghe', () => {
    expect(parseVtt(toVtt(alignment, 20)).length).toBeGreaterThan(2);
  });
});

describe('inquadrature del racconto', () => {
  const tl: Keyframe[] = [
    { t: 0, action: 'cameraTo', args: { rect: FULL } },
    { t: 10, action: 'cameraTo', args: { rect: { x: 0.5, y: 0.5, w: 0.2, h: 0.2 } } },
  ];
  it('trova il fotogramma chiave corrente', () => {
    expect(keyIndexAt(tl, -1)).toBe(-1);
    expect(keyIndexAt(tl, 9.9)).toBe(0);
    expect(keyIndexAt(tl, 10)).toBe(1);
  });
  it('si muove in modo continuo tra due inquadrature', () => {
    const a = rectAt(tl, 10.05), b = rectAt(tl, 11.2), c = rectAt(tl, 30);
    expect(a.w).toBeGreaterThan(b.w);
    expect(b.w).toBeGreaterThan(c.w);
    expect(c.w).toBeCloseTo(0.2 * 0.94, 2);
  });
  it('adatta il rettangolo alle proporzioni dello schermo', () => {
    // Quadro orizzontale (1,5) su telefono verticale (0,5): l'altezza si allarga.
    const r = fitToScreen({ x: 0.4, y: 0.4, w: 0.2, h: 0.2 }, 1.5, 0.5, 1);
    expect((r.w * 1.5) / r.h).toBeCloseTo(0.5, 5);
    expect(r.x + r.w / 2).toBeCloseTo(0.5, 5);
  });
});
