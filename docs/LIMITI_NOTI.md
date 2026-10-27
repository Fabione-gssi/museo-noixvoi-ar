# Limiti noti

Elenco aggiornato a ogni fase. Ultimo aggiornamento: Fase 0.

## Riconoscimento delle immagini (MindAR)

- **Libreria non più mantenuta**: MindAR 1.2.5 è del gennaio 2024 e da allora non ci sono aggiornamenti. Se un aggiornamento di iOS o Chrome la rompesse, nessuno la sistemerebbe. L'app la usa attraverso un'interfaccia (`src/tracker/Tracker.ts`), quindi si può sostituire senza riscrivere il resto.
- **Alternativa AR.js scartata per licenza**: il riconoscimento di immagini di AR.js si basa su `artoolkit5-js`, che ha licenza **LGPL-3.0** e non è permissiva. Usarla sarebbe un'eccezione ai vincoli: va decisa da te.
- **Il compilatore Node di MindAR non si installa su Windows** (richiede il modulo nativo `canvas`). I target si compilano dentro Chromium headless: il risultato è lo stesso. Il modulo `canvas` è sostituito da uno stub vuoto (`stubs/canvas`), che serve solo all'installazione.
- **Quadri scuri o uniformi** (es. *La zattera della Medusa*): pochi punti caratteristici, quindi riconoscimento più lento o instabile. La pipeline lo segnala.
- **Riflessi del vetro e luce radente**: una macchia di luce copre i punti caratteristici. Il test con riflesso simulato è registrato in `docs/RISULTATI_TEST.md`; serve comunque la prova sul campo.
- **Distanza**: se ci si avvicina molto, il quadro intero esce dall'inquadratura e il tracking si perde. Per questo i particolari hanno anche un proprio target (il ritaglio) oltre al metodo mirino.
- **Particolari piccoli o con poca texture**: se un ritaglio ha pochi punti, si usa solo il mirino (soglia nella pipeline: 250 punti, da tarare con le prove reali).
- **Un target alla volta (`maxTrack 1`)**: mentre il quadro intero è agganciato, i ritagli non vengono cercati. Da vicino il quadro intero si perde e il ritaglio subentra. È una scelta di prestazioni, misurata nel benchmark.

## Test automatici

- I test con fotocamera simulata girano su un computer: velocità e fps **non** sono quelli di un telefono. Il rallentamento della CPU 4x è solo un'approssimazione.
- I video sintetici non riproducono messa a fuoco automatica, esposizione automatica, mosso reale, moiré e riflessi veri. **Non sostituiscono la prova su telefoni reali.**

## Studio

- Il pannello di gestione è solo locale. Un pannello online (es. modifiche via GitHub dal browser) è escluso dalla v1, perché la pipeline pesante (compilazione target, trascrizione audio, mappe di profondità) non gira nel browser e un sito statico non può salvare nulla.

## Hosting

- Con GitHub Pages gratuito il repository è pubblico: chiunque può scaricare immagini e testi. Va bene per le opere di pubblico dominio dell'MVP, ma va rivalutato per le foto dei quadri reali (vedi `docs/HOSTING.md`).
