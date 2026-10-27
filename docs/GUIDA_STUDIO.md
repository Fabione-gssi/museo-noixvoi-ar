# Guida allo Studio

Lo Studio è il pannello con cui gestisci i quadri **senza toccare file**. Gira solo sul tuo computer: non è online e i visitatori non lo vedono.

## Aprire lo Studio

1. Apri la cartella del progetto (`museoNOIXVOI`).
2. Fai **doppio clic su "Avvia Studio"**.
3. Si apre una finestra nera (non chiuderla finché lavori) e poi il browser con lo Studio.
   - La prima volta il programma installa da solo ciò che serve: può volerci qualche minuto.
   - Se Windows chiede il permesso di installare qualcosa (Node.js, Python, ffmpeg), rispondi **Sì**.
4. Per chiudere lo Studio, chiudi la finestra nera.

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

## Provare

Scheda **Anteprima**: a sinistra c'è la vera app in una cornice a forma di telefono.

- **Fotocamera simulata**: con i cursori ti avvicini, inclini il telefono, aggiungi un riflesso o abbassi la luce, senza bisogno di un telefono.
- **Webcam del computer**: inquadri una stampa del quadro con la webcam.
- **Crea il link per il telefono**: compare un codice QR da inquadrare con un telefono collegato **allo stesso Wi-Fi** del computer.
  - Al primo accesso il telefono avvisa che il certificato "non è attendibile". È normale: tocca **Avanzate → Procedi**.
  - Se Windows chiede di consentire l'accesso alla rete, scegli **Consenti** (rete privata).

## Pubblicare

Pagina **Verifica e pubblica**:

1. **Verifica tutto**: prepara tutti i quadri e prova l'app da solo (alcuni minuti). Alla fine trovi un rapporto: ✅ tutto bene, ❌ cosa sistemare.
2. **Pubblica**: aggiorna il sito dei visitatori (1-2 minuti).
   - Alla fine trovi l'indirizzo del sito e i **codici QR** (uno generale e uno per quadro).
   - **"Stampa i codici QR"** apre la pagina pronta per la stampa.
3. Se GitHub non è configurato, compaiono le istruzioni per l'accesso (una sola volta). In alternativa, **"Crea la cartella per Cloudflare Pages"** prepara un file da caricare sul sito di Cloudflare: le istruzioni compaiono sullo schermo.

A destra, **Cose da fare** elenca gli avvisi dei contenuti (es. "sala da completare") e le azioni manuali, con caselle da spuntare.

## Se sbagli

- **↶ Annulla** (in alto) annulla l'ultima azione: modifica, eliminazione, caricamento, cambio d'ordine.
- Prima di ogni modifica lo Studio fa una copia di sicurezza del quadro (cartella `.studio/backup`).
- Eliminare un quadro chiede sempre conferma.

## Alternativa senza Studio

Puoi copiare a mano una cartella in `contenuti/`, per esempio `07-nome-quadro`, con dentro:

- `quadro.jpg`;
- `testo.txt`;
- `audio.mp3`;
- `info.txt`, con titolo, autore, anno e sala, uno per riga.

Poi apri lo Studio e premi **Prepara** (o "Verifica tutto").
