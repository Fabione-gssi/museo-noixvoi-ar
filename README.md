# Quadri che prendono vita

App per il telefono dei visitatori del museo: si inquadra un quadro e prende vita (particolari da scoprire, caccia con la lente, personaggio che parla, racconto animato). Funziona nel browser, senza installare nulla, a costo zero.

**Stato: versione 1.0.0, MVP pubblicato** (tutte le fasi 0-6). Ci sono tutte e quattro le esperienze, con i loro editor nello Studio, più l'uso senza internet, la cronologia, la pagina `?debug=1` e i cartellini con QR. Prima di aprire al pubblico servono le prove su iPhone e in sala: vedi [docs/RILASCIO_MVP.md](docs/RILASCIO_MVP.md). Quadri di prova:

- *Autoritratto con pelliccia* di Dürer e *Ginevra de' Benci*: personaggi che si presentano, rispondono a 11 domande preparate e alle altre con il testo completo del museo (con internet, anche tramite un assistente open source facoltativo);
- *La zattera della Medusa*: racconto;
- *La ronda di notte*: 7 particolari;
- *Arnolfini*: 6 particolari;
- *Proverbi fiamminghi*: caccia con la lente, 6 proverbi nascosti.

Tutti hanno la voce DEMO.

## Per te

- **Gestire i quadri**: doppio clic su **"Avvia Studio"**. Guida: [docs/GUIDA_STUDIO.md](docs/GUIDA_STUDIO.md).
- Sito: https://fabione-gssi.github.io/museo-noixvoi-ar/
- Cose da fare: [DA_FARE_UTENTE.md](DA_FARE_UTENTE.md) · Rilascio: [docs/RILASCIO_MVP.md](docs/RILASCIO_MVP.md) · Test in sala: [docs/TEST_SUL_CAMPO.md](docs/TEST_SUL_CAMPO.md)
- Cartellini da stampare: https://fabione-gssi.github.io/museo-noixvoi-ar/stampa/cartellini.pdf
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
- Personaggio: punti del volto con MediaPipe (`scripts/lib/face-landmarks.mjs`), volto animato in `src/character/FaceRenderer.ts`, dialogo locale in `src/character/dialog.ts` (interfaccia `DialogEngine`). Anteprime di 5 s per il quality gate: `node scripts/make-face-previews.mjs`, con l'app su http://localhost:5179.
- `studio/`: Studio locale (`npm run studio`, solo 127.0.0.1 con token). Non viene pubblicato.
- `npm run setup`: installa strumenti e modelli mancanti.
- Test: `npm run test:unit` (Vitest) e `npm run test:e2e` (Playwright con fotocamera simulata; prima `node scripts/make-test-videos.mjs`).
- Uso senza internet: service worker `sw/sw.js`, completato da `vite.config.ts` con l'elenco dei file dell'app (solo nel sito costruito). I file dei quadri vanno in una cache per quadro, gestita da `src/offline.ts`. L'impronta (`version`) e l'elenco dei file (`files`) di ogni quadro stanno in `public/data/index.json`.
- Icone e manifest: `node scripts/make-icons.mjs`.
- Pubblicazione: GitHub Actions a ogni push su `main`.
