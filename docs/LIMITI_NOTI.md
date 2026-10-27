# Limiti noti

Elenco aggiornato a ogni fase. Ultimo aggiornamento: Fase 2.

## Riconoscimento delle immagini (MindAR)

- **Libreria non più mantenuta**: MindAR 1.2.5 è del gennaio 2024 e da allora non ci sono aggiornamenti. Se un aggiornamento di iOS o Chrome la rompesse, nessuno la sistemerebbe. L'app la usa attraverso un'interfaccia (`src/tracker/Tracker.ts`), quindi si può sostituire senza riscrivere il resto.
- **Alternativa AR.js scartata per licenza**: il riconoscimento di immagini di AR.js si basa su `artoolkit5-js`, che ha licenza **LGPL-3.0** e non è permissiva. Usarla sarebbe un'eccezione ai vincoli: va decisa da te.
- **Il compilatore Node di MindAR non si installa su Windows** (richiede il modulo nativo `canvas`). I target si compilano dentro Chromium headless: il risultato è lo stesso. Il modulo `canvas` è sostituito da uno stub vuoto (`stubs/canvas`), che serve solo all'installazione.
- **Quadri scuri o uniformi** (es. *La zattera della Medusa*): pochi punti caratteristici, quindi riconoscimento più lento o instabile. La pipeline lo segnala.
- **Riflessi del vetro e luce radente**: una macchia di luce copre i punti caratteristici. Il test con riflesso simulato è registrato in `docs/RISULTATI_TEST.md`; serve comunque la prova sul campo.
- **Distanza**: se ci si avvicina molto, il quadro intero esce dall'inquadratura e il tracking si perde. Per questo i particolari hanno anche un proprio target (il ritaglio) oltre al metodo mirino.
- **Particolari piccoli o con poca texture**: se un ritaglio ha pochi punti, si usa solo il mirino (soglia nella pipeline: 250 punti, da tarare con le prove reali).
- **Soglia dei punti poco selettiva**: MindAR conta i punti sul ritaglio ingrandito, quindi finora tutti i particolari (anche lo scudo scuro della *Ronda*, 682 punti) superano la soglia di 250 e hanno sia il riconoscimento da vicino sia il mirino. La soglia andrà tarata sui risultati dei telefoni.
- **Particolari vicini tra loro** (firma e specchio dell'*Arnolfini*): avvicinandosi a uno si può trovare anche l'altro. Un particolare nuovo apre la sua scheda anche se ce n'è già una aperta; uno già trovato non interrompe l'ascolto.
- **Un target alla volta (`maxTrack 1`)**: mentre il quadro intero è agganciato, i ritagli non vengono cercati. Da vicino il quadro intero si perde e il ritaglio subentra. È una scelta di prestazioni, misurata nel benchmark.

## Test automatici

- I test con fotocamera simulata girano su un computer: velocità e fps **non** sono quelli di un telefono. Il rallentamento della CPU 4x è solo un'approssimazione.
- I video sintetici non riproducono messa a fuoco automatica, esposizione automatica, mosso reale, moiré e riflessi veri. **Non sostituiscono la prova su telefoni reali.**

## Voce DEMO e allineamento

- La voce sintetica sbaglia i nomi stranieri (es. "Géricault"). Si corregge con il file `pronuncia.txt` del quadro (nello Studio: "Correggi la pronuncia"), che cambia solo l'audio, non i sottotitoli.
- Per le registrazioni vere l'allineamento audio-testo usa Whisper "small" in locale. Sulla voce demo della *Medusa* ha riconosciuto l'87% delle parole, con uno scarto medio di 0,11 s rispetto ai tempi esatti. Se la registrazione si discosta molto dal testo (sotto il 60% di parole riconosciute) la pipeline lo segnala.
- Lo scorrimento delle parole nei sottotitoli è stimato in proporzione alla lunghezza delle parole: preciso per frase, approssimato per parola.

## Racconto

- I movimenti di camera automatici dipendono dalle frasi "ancora" in `regioni.json`: se il testo cambia e una frase non si trova più, quel movimento salta e la pipeline lo segnala. Dallo Studio si può sempre passare a una sequenza fatta a mano.
- La parallasse col giroscopio è leggera per scelta (niente effetti che diano fastidio). Su iPhone richiede il permesso al primo tap: se viene negato, il racconto funziona lo stesso.
- Il video caricato non ha sottotitoli automatici (vanno inclusi nel video stesso).

## Blocca/Sblocca

- Quando il quadro si perde, per 1,5 s si tiene l'ultima posizione. Poi per 3 s la sovrapposizione si sposta col giroscopio: è una compensazione approssimata, non un vero tracciamento. Dopo si passa da soli alla modalità bloccata, sull'ultima inquadratura buona.

## Studio

- **Anteprima sul telefono**: usa un "quick tunnel" gratuito di Cloudflare (`cloudflared` 2026.10.0, firmato da Cloudflare, Apache-2.0, nessun account). Limiti: indirizzo casuale che cambia a ogni apertura; servizio gratuito senza garanzie di disponibilità; chi conosce l'indirizzo vede l'anteprima finché resta attiva. Viene esposto solo il sito dei visitatori, mai lo Studio. Se il tunnel non parte, si usa la rete locale (stesso Wi-Fi, certificato autofirmato da accettare).
- Il pannello di gestione è solo locale. Un pannello online (es. modifiche via GitHub dal browser) è escluso dalla v1, perché la pipeline pesante (compilazione target, trascrizione audio, mappe di profondità) non gira nel browser e un sito statico non può salvare nulla.

## Hosting

- Con GitHub Pages gratuito il repository è pubblico: chiunque può scaricare immagini e testi. Va bene per le opere di pubblico dominio dell'MVP, ma va rivalutato per le foto dei quadri reali (vedi `docs/HOSTING.md`).
