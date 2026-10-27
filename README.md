# Quadri che prendono vita

App per il telefono dei visitatori del museo: si inquadra un quadro e prende vita (particolari da scoprire, caccia con la lente, personaggio che parla, racconto animato). Funziona nel browser, senza installare nulla, a costo zero.

**Stato: Fase 0 (verifica tecnica).** Per ora c'è un solo quadro di prova (*Arnolfini*) con due particolari.

- Sito: https://fabione-gssi.github.io/museo-noixvoi-ar/
- Cose da fare per te: [DA_FARE_UTENTE.md](DA_FARE_UTENTE.md)
- Risultati dei test: [docs/RISULTATI_TEST.md](docs/RISULTATI_TEST.md)
- Limiti noti: [docs/LIMITI_NOTI.md](docs/LIMITI_NOTI.md) · Hosting: [docs/HOSTING.md](docs/HOSTING.md)
- Crediti delle immagini: [crediti.md](crediti.md)

## Come è fatto (per chi programma)

- `contenuti/<nn-nome>/`: i quadri, cioè la fonte di verità (immagine, testi, audio).
- `npm run build:content`: pipeline che genera `public/data/` (target di riconoscimento, ritagli, `meta.json`, anteprime in `revisione/`). È incrementale e scrive una riga JSON per evento.
- `src/`: app (Vite + TypeScript + three.js). Il riconoscimento passa dall'interfaccia `src/tracker/Tracker.ts` (implementazione: MindAR).
- Pagine di prova: `diagnostica.html` (cosa funziona sul telefono), `benchmark.html` (set per quadro vs globale), `?debug=1` (fps e stato del tracking).
- Test: `node scripts/make-test-videos.mjs` e poi `npm test` (Playwright con fotocamera simulata).
- Pubblicazione: GitHub Actions a ogni push su `main`.
