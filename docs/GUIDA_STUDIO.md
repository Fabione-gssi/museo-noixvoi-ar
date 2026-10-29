# Guida allo Studio

Lo Studio è il pannello con cui gestisci i quadri **senza toccare file**. Gira solo sul tuo computer: non è online e i visitatori non lo vedono.

## Aprire lo Studio

1. Apri la cartella del progetto (`museoNOIXVOI`).
2. Fai **doppio clic su "Avvia Studio"**.
3. Si apre una finestra nera (non chiuderla finché lavori) e poi il browser con lo Studio.
   - La prima volta il programma installa da solo ciò che serve: può volerci qualche minuto.
   - Se Windows chiede il permesso di installare qualcosa (Node.js, Python, ffmpeg), rispondi **Sì**.
4. Per chiudere lo Studio, chiudi la finestra nera.

**Se compare "porta già in uso" (o "Port … is already in use")**: lo Studio è già aperto in un'altra finestra nera. Usa quella, oppure chiudila e fai di nuovo doppio clic. Se non trovi la finestra, apri PowerShell e incolla:

```
Get-NetTCPConnection -State Listen -LocalPort 5300 | ForEach-Object { Stop-Process -Id $_.OwningProcess }
```

## Aggiungere un quadro

1. Nella pagina **Quadri** premi **+ Aggiungi quadro** e scrivi il titolo.
2. **Informazioni**: autore, anno, sala → **Salva**.
3. **Immagine**: trascina la foto del quadro nel riquadro tratteggiato.
   - Più è grande, meglio è: almeno 3000 pixel sul lato lungo.
   - Il "Controllo qualità" ti dice in parole semplici se va bene.
4. **Testo e audio**:
   - incolla il testo storico (350-450 parole) → **Salva il testo**;
   - carica la registrazione della voce (MP3, WAV o M4A), oppure spunta **"Usa la voce sintetica DEMO"** finché non hai una registrazione vera.
5. **Interazione**: scegli che cosa succede quando il visitatore inquadra il quadro. Per ora sono pronte **Racconto** e **Dettagli**; le altre arriveranno nelle prossime fasi.
6. Premi **Prepara** (in alto a destra). Una barra gialla mostra l'avanzamento: puoi continuare a lavorare intanto.

## Il racconto

Nella scheda **Racconto**:

- **Con un video già pronto**: caricalo nel primo riquadro. Viene compresso da solo.
- **Senza video**: l'app crea un racconto animato. La "camera" si avvicina ai particolari quando la voce li nomina.
  - Per cambiare i movimenti, scegli un movimento nell'elenco **Sequenza** e trascina un rettangolo sull'immagine.
  - **"+ Aggiungi movimento all'istante scelto"**: prima clicca sull'onda sonora (o su una parola della trascrizione) nel punto in cui deve partire.
  - **"Sposta qui"** sposta un movimento all'istante scelto.
  - **"Nome"** è la scritta che il visitatore vede (es. "La nave Argus").
  - Alla fine premi **Salva la sequenza** e poi **Prepara**.
  - **"Torna alla sequenza automatica"** annulla le modifiche fatte a mano.

**Selettore di audio**: clicca sull'onda per scegliere un istante; trascina il dito o il mouse sulle parole per selezionare un pezzo; **"Ascolta la selezione"** per sentirlo.

## I dettagli

Se l'interazione è **Dettagli**, nella scheda **Dettagli** segni i particolari da far scoprire:

1. **+ Aggiungi particolare**, poi **trascina sull'immagine** per disegnare il riquadro. Per spostarlo trascina dentro il riquadro; per ridimensionarlo usa il pallino giallo nell'angolo.
2. Scrivi il **nome**: è quello che vede il visitatore (es. "Lo specchio").
3. Scegli **che cosa parte** quando il visitatore lo trova:
   - **il pezzo dell'audio principale che ne parla** (automatico): lo trova da solo, usando la frase del testo indicata in "Frase del testo che parla di questo particolare";
   - **un pezzo scelto da te**: trascina sulle parole della trascrizione in basso, poi **"Usa la selezione fatta sulla traccia"**;
   - **un audio o un video caricato**: trascina il file nel riquadro tratteggiato;
   - **solo testo**: scrivilo in "Testo della scheda".
4. **Salva i particolari**, poi **Prepara**.

Accanto a ogni particolare vedi quanto è riconoscibile:
- **"Riconoscibile da vicino e col mirino"**: il telefono lo riconosce sia avvicinandosi sia tenendolo nel cerchio al centro dello schermo;
- **"Solo col mirino"**: c'è poca texture, quindi funziona solo con il cerchio al centro, guardando il quadro intero.

## La caccia

Se l'interazione è **Caccia**, nella scheda **Caccia** metti gli elementi nascosti. Il visitatore li vede solo quando li inquadra con la lente al centro dello schermo.

1. **+ Aggiungi elemento**, poi **clicca sull'immagine** nel punto in cui si trova. Puoi anche trascinare il cerchio.
2. Dai un **nome** e scegli **come si rivela nella lente**: bagliore dorato, contorno a inchiostro o ingrandimento.
3. Regola la **grandezza dell'area da trovare**: più è piccola, più è difficile.
4. Scegli **che cosa si ascolta**: il pezzo dell'audio che ne parla (automatico), un pezzo scelto da te o solo testo.
5. In basso imposta il **finale**: il testo o l'audio che arriva quando il visitatore ha trovato tutto.
6. Con il cursore **"Grandezza della lente"** decidi quanto è grande il cerchio sullo schermo del telefono.
7. **Salva la caccia**, poi **Prepara**.

Usa solo cose che si vedono davvero nel quadro: servono almeno 3 elementi.

## Il personaggio

Se l'interazione è **Personaggio**, la figura del quadro si presenta (con il **testo storico**, scritto in prima persona) e risponde alle domande dei visitatori. Non è un'intelligenza artificiale: dice solo le risposte che scrivi tu.

Nella scheda **Personaggio**:

1. **Volto**: dopo **Prepara**, il computer trova da solo occhi, bocca e mento (puntini gialli). Se un punto è fuori posto, sceglilo nell'elenco a destra e clicca (o trascina) nel punto giusto. **"Rimetti i punti trovati da soli"** annulla le correzioni.
2. **Animazione**:
   - **Completa**: la bocca si muove con la voce, gli occhi sbattono le ciglia e seguono il visitatore.
   - **Solo presenza**: niente bocca, solo sguardo, respiro e un leggero movimento. Scegli questa se l'animazione completa sembra innaturale.
3. **Domande e risposte**: ne servono da 8 a 15. Per ognuna scrivi:
   - la **domanda**, come appare sul pulsante;
   - **altri modi di chiederlo**, uno per riga (aiutano a capire le domande scritte dai visitatori);
   - la **risposta**, in prima persona e solo con fatti del testo storico;
   - la **fonte**, cioè la frase del testo storico da cui viene. Se la frase non si trova nel testo compare un avviso arancione.
   - Spunta **Suggerita** per le 4 domande da mostrare come pulsanti.
4. In fondo puoi cambiare la frase per le domande non previste ("Non so rispondere…").
5. **Salva il personaggio**, poi **Prepara**: la voce DEMO legge ogni risposta. Con un attore vero, metti le sue registrazioni nella cartella `risposte` del quadro, con il nome della domanda (es. `risposte/chi-sei.mp3`).
6. **Prova il personaggio** apre l'app sul computer, senza fotocamera.

## Provare

Scheda **Anteprima**: a sinistra c'è la vera app in una cornice a forma di telefono.

- **Fotocamera simulata**: con i cursori ti avvicini, inclini il telefono, aggiungi un riflesso o abbassi la luce, senza bisogno di un telefono.
- **Webcam del computer**: inquadri una stampa del quadro con la webcam.
- **Crea il link per il telefono**: dopo circa 20 secondi compare un codice QR da inquadrare con il telefono.
  - Il codice apre direttamente l'interazione con il quadro, come i codici dei cartellini: non serve inquadrare il quadro.
  - Funziona anche in rete mobile, attraverso un collegamento gratuito di Cloudflare.
  - L'indirizzo è casuale e resta valido finché premi **"Chiudi l'anteprima sul telefono"** o chiudi lo Studio.
  - Se il collegamento via internet non parte, lo Studio usa la rete locale. In quel caso serve lo stesso Wi-Fi e, al primo accesso, devi toccare **Avanzate → Procedi** sull'avviso del certificato.

## Pubblicare

Pagina **Verifica e pubblica**:

1. **Verifica tutto**: prepara tutti i quadri e prova l'app da solo (alcuni minuti). Alla fine trovi un rapporto: ✅ tutto bene, ❌ cosa sistemare.
2. **Pubblica**: aggiorna il sito dei visitatori (1-2 minuti).
   - Alla fine trovi l'indirizzo del sito e i **codici QR** (uno generale e uno per quadro).
   - I codici dei quadri aprono subito l'interazione, senza inquadrare il quadro. Il codice generale apre l'elenco.
   - **"Stampa i codici QR"** apre la pagina pronta per la stampa.
3. Se GitHub non è configurato, compaiono le istruzioni per l'accesso (una sola volta). In alternativa, **"Crea la cartella per Cloudflare Pages"** prepara un file da caricare sul sito di Cloudflare: le istruzioni compaiono sullo schermo.

### Cronologia delle pubblicazioni

In fondo alla pagina c'è l'elenco delle versioni pubblicate, dalla più recente. Quella con l'etichetta verde **online** è quella che vedono i visitatori.

- **Ripristina questa versione** riporta i contenuti (testi, immagini, audio, particolari) com'erano in quella data. Il sito non cambia finché non premi **Pubblica**: prima puoi controllare con l'anteprima.
- Se hai modifiche non ancora pubblicate, in cima compare "Modifiche non ancora pubblicate". **Torna a questa versione**, sulla versione online, le toglie tutte.
- Hai cambiato idea? **↶ Annulla** rimette i contenuti com'erano prima del ripristino.

A destra, **Cose da fare** elenca gli avvisi dei contenuti (es. "sala da completare") e le azioni manuali, con caselle da spuntare.

## Se sbagli

- **↶ Annulla** (in alto) annulla l'ultima azione: modifica, eliminazione, caricamento, cambio d'ordine.
- Prima di ogni modifica lo Studio fa una copia di sicurezza del quadro (cartella `.studio/backup`).
- Eliminare un quadro chiede sempre conferma.
- Per tornare a una versione già pubblicata, usa la **Cronologia** nella pagina Verifica e pubblica.

## Alternativa senza Studio

Puoi copiare a mano una cartella in `contenuti/`, per esempio `07-nome-quadro`, con dentro:

- `quadro.jpg`;
- `testo.txt`;
- `audio.mp3`;
- `info.txt`, con titolo, autore, anno e sala, uno per riga.

Poi apri lo Studio e premi **Prepara** (o "Verifica tutto").
