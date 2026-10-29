# Quadri che prendono vita

App per il telefono dei visitatori del museo: si inquadra un quadro e prende vita (particolari da scoprire, caccia con la lente, personaggio che parla, racconto animato). Funziona nel browser, senza installare nulla, a costo zero.

**Stato: Fase 3** (motore generico, esperienze "racconto", "dettagli" e "caccia", Studio con i loro editor). Quadri di prova:

- *La zattera della Medusa*: racconto;
- *La ronda di notte*: 7 particolari;
- *Arnolfini*: 6 particolari;
- *Proverbi fiamminghi*: caccia con la lente, 6 proverbi nascosti.

Tutti hanno la voce DEMO.

## Per te

- **Gestire i quadri**: doppio clic su **"Avvia Studio"**. Guida: [docs/GUIDA_STUDIO.md](docs/GUIDA_STUDIO.md).
- Sito: https://fabione-gssi.github.io/museo-noixvoi-ar/
- Cose da fare: [DA_FARE_UTENTE.md](DA_FARE_UTENTE.md)
- Risultati dei test: [docs/RISULTATI_TEST.md](docs/RISULTATI_TEST.md) · Esperienze: [docs/ESPERIENZE.md](docs/ESPERIENZE.md)
- Limiti noti: [docs/LIMITI_NOTI.md](docs/LIMITI_NOTI.md) · Hosting: [docs/HOSTING.md](docs/HOSTING.md)
- Crediti e fonti: [crediti.md](crediti.md), [fonti.md](fonti.md)

## Come è fatto (per chi programma)

- `contenuti/<nn-nome>/`: fonte di verità. Contiene:
  - `quadro.jpg`, `testo.txt`, `audio.*`, `racconto.mp4`;
  - `info.txt` (titolo, autore, anno, sala; facoltativi `esperienza:` e `voce: demo`);
  - `regioni.json` (particolari e sequenza del racconto, scritto dallo Studio);
  - `pronuncia.txt` (correzioni di pronuncia della voce DEMO).
- `npm run build:content`: la pipeline genera `public/data/` e i passi pesanti hanno una cache. Fa:
  - target MindAR;
  - voce DEMO Piper;
  - allineamento faster-whisper;
  - sottotitoli VTT;
  - profondità Depth Anything V2;
  - timeline del racconto;
  - Opus/M4A;
  - `meta.json` validato da `schema/meta.schema.json`;
  - budget di peso.

  Scrive una riga JSON per evento.
- `src/`: app dei visitatori (Vite + TypeScript + three.js).
  - Esperienze in `src/experiences/`.
  - Il riconoscimento passa dall'interfaccia `src/tracker/Tracker.ts`.
- `studio/`: Studio locale (`npm run studio`, solo 127.0.0.1 con token). Non viene pubblicato.
- `npm run setup`: installa strumenti e modelli mancanti.
- Test: `npm run test:unit` (Vitest) e `npm run test:e2e` (Playwright con fotocamera simulata; prima `node scripts/make-test-videos.mjs`).
- Pubblicazione: GitHub Actions a ogni push su `main`.
