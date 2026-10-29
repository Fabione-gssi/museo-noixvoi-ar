# Limiti noti

Elenco aggiornato a ogni fase. Ultimo aggiornamento: Fase 3.

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

## Quadro vivo (racconto, particolari, personaggio)

- Il movimento viene dalla mappa di profondità calcolata dal computer: i piani vicini si spostano più dei lontani e "respirano" appena. Le figure **non si muovono davvero** (niente braccia o gambe animate): servirebbero video generati con l'intelligenza artificiale, esclusi dai vincoli del progetto. Si può sempre caricare un video già pronto (racconto o particolare).
- Dove la profondità cambia di colpo (bordi delle figure) può comparire un leggero stiramento: l'ondeggiamento è tenuto piccolo apposta.

## Caccia

- La lente mostra l'immagine ad alta risoluzione nel punto del quadro che sta sotto il centro dello schermo (precisione misurata nei test: meno di 0,5% della larghezza). Ignora però la prospettiva: se si guarda il quadro molto di lato, il contenuto della lente è leggermente diverso da quello visto dalla fotocamera.
- Mentre la scheda di una scoperta è aperta, la lente non scopre altri elementi: si chiude la scheda e si continua.
- L'indizio (luccichio) compare dopo 20 secondi senza scoperte, sull'elemento non ancora trovato che viene per primo nell'elenco.
- Il finale fa parte del testo del quadro, quindi si sente anche alla fine di "Ascolta tutto".

## Personaggio

- **Domande previste**: risponde con le risposte scritte nello Studio, con il loro audio. La ricerca tollera errori di battitura, sinonimi comuni e modi diversi di chiedere, e guarda anche le parole delle risposte. Quando è incerta propone 2-3 domande vicine ("Forse volevi chiedere…"); se nulla corrisponde, dice che non sa rispondere. Può ancora sbagliare con domande lunghe o ambigue. Il rimedio è aggiungere nello Studio altri modi di chiedere: è normale farlo dopo le prime settimane in sala.
- **Volto animato**: è una deformazione dell'immagine attorno a occhi, bocca, sopracciglia e testa, non un modello 3D.
  - La bocca si apre seguendo il volume della voce. La forma delle labbra (strette su o/u) viene dalle vocali del testo allineato alla voce, quindi c'è solo con la voce DEMO o con registrazioni allineate al testo. Per le risposte registrate da un attore c'è solo l'apertura.
  - L'interno della bocca è un'ombra scura: niente denti né lingua.
  - La testa si gira di pochi gradi: girate più ampie stirerebbero capelli e sfondo.
  - Funziona bene con volti grandi, frontali o di tre quarti. Con volti piccoli, di profilo o coperti (barba folta, mani) va usata la "presenza".
- **Punti del volto**: li trova MediaPipe sul computer. Con un dipinto può sbagliare: lo Studio permette di correggerli a mano.
- **Dopo il riconoscimento** il personaggio si guarda a tutto schermo, non sovrapposto alla tela inquadrata. È più nitido e stabile, e permette di abbassare il telefono. L'animazione sopra la tela vera è stata scartata per ora: i colori della fotocamera e quelli dell'immagine non coincidono.
- **Testi in prima persona**: il personaggio dice solo fatti documentati e tradotti dalle fonti (vedi `fonti.md`). Lo dichiara sotto: "Risposte preparate dal museo a partire dalle fonti".
- **LivePortrait (facoltativo)**: un video animato da Colab per la sola presentazione non è stato fatto. Richiede un account Google e un servizio esterno, e non è necessario per l'MVP.
- **Domande libere (testo completo + assistente online)**:
  - Il telefono cerca nel testo completo del museo (`approfondimento.txt`) il paragrafo che risponde. Vince sulla domanda prevista solo quando spiega la domanda meglio di lei.
  - Con internet e con l'assistente collegato, un modello open source (Mistral Small 3.1, riserva Qwen3, licenza Apache 2.0, su Cloudflare Workers AI) ne ricava una risposta breve in prima persona. Ha l'ordine di usare solo i paragrafi trovati; se cita un numero che nei paragrafi non c'è, la risposta viene scartata e si legge il paragrafo. Può comunque riformulare in modo impreciso: per questo l'app dichiara "Risposta dell'assistente automatico, dal testo del museo".
  - **Non ancora provato con il modello vero**: serve l'account Cloudflare del museo (vedi `DA_FARE_UTENTE.md`). I test usano un assistente finto.
  - Piano gratuito: circa 10.000 "neuroni" al giorno, cioè da qualche decina a un paio di centinaia di risposte (stime non ufficiali). Finita la quota, o senza internet, il personaggio legge il paragrafo: funziona sempre.
  - Privacy: la domanda scritta arriva a Cloudflare senza cookie né dati del telefono; l'assistente non la registra. Se il visitatore scrive un dato personale nella domanda, quel testo esce dal telefono: l'app lo dichiara nella pagina iniziale e sotto il personaggio.
  - Voce: le risposte libere usano la voce italiana del telefono, che cambia da telefono a telefono. Se il telefono non ha una voce italiana compaiono solo i sottotitoli. La bocca si muove a sillabe, non segue il volume vero.
  - Microfono: escluso; si scrive.

## Blocca/Sblocca

- Quando il quadro si perde, per 1,5 s si tiene l'ultima posizione. Poi per 3 s la sovrapposizione si sposta col giroscopio: è una compensazione approssimata, non un vero tracciamento. Dopo si passa da soli alla modalità bloccata, sull'ultima inquadratura buona.

## Uso senza internet

- **Serve una prima visita con internet.** L'app si salva sul telefono alla prima apertura. Il quadro aperto si salva da solo circa 5 secondi dopo l'avvio: se la connessione cade subito, può mancare qualche file.
- **"Scarica tutti i quadri"** salva solo il formato audio e video che quel telefono sa riprodurre (Opus o M4A).
- **iPhone (Safari)**: se il sito non viene aperto per 7 giorni, Safari può cancellare i dati salvati. Non succede se il visitatore aggiunge l'app alla schermata Home. Non è ancora verificato su un iPhone vero.
- Lo spazio disponibile lo decide il browser. Prima di scaricare tutto, l'app controlla lo spazio libero e avvisa se non basta.
- **Aggiornamenti**: quando il museo pubblica una versione nuova, il telefono la scarica in sottofondo e la usa alla prossima apertura. Se il visitatore è sulla schermata iniziale, la pagina si ricarica da sola. I quadri già salvati, se sono cambiati, si riscaricano.
- Le pagine di prova (diagnostica, benchmark) e i PDF da stampare non sono salvati per l'uso senza internet.

## Studio

- **Anteprima sul telefono**: usa un "quick tunnel" gratuito di Cloudflare (`cloudflared` 2026.10.0, firmato da Cloudflare, Apache-2.0, nessun account). Limiti: indirizzo casuale che cambia a ogni apertura; servizio gratuito senza garanzie di disponibilità; chi conosce l'indirizzo vede l'anteprima finché resta attiva. Viene esposto solo il sito dei visitatori, mai lo Studio. Se il tunnel non parte, si usa la rete locale (stesso Wi-Fi, certificato autofirmato da accettare).
- **Cronologia**: elenca le versioni inviate a GitHub che hanno cambiato `contenuti/` (le ultime 30). Il ripristino cambia solo `contenuti/`, non il codice dell'app. Le copie di sicurezza degli ultimi 30 passi stanno in `.studio/backup`.
- Il pannello di gestione è solo locale. Un pannello online (es. modifiche via GitHub dal browser) è escluso dalla v1, perché la pipeline pesante (compilazione target, trascrizione audio, mappe di profondità) non gira nel browser e un sito statico non può salvare nulla.

## Hosting

- Con GitHub Pages gratuito il repository è pubblico: chiunque può scaricare immagini e testi. Va bene per le opere di pubblico dominio dell'MVP, ma va rivalutato per le foto dei quadri reali (vedi `docs/HOSTING.md`).
