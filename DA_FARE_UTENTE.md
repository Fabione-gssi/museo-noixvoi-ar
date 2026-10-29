# Cose da fare (per te)

Questo è l'unico elenco delle azioni che devi fare a mano. Lo aggiorno io a ogni fase.
Per rispondere basta scrivermi in chat, per esempio: "1 iPhone: sì sì no".

---

## Seconda tornata di modifiche (29/10/2026): da ricontrollare

| Richiesta | Cosa ho cambiato | Da provare |
|---|---|---|
| QR che portano subito al quadro | I codici QR (anteprima dello Studio, pagina di pubblicazione, cartellini) aprono direttamente l'interazione: dopo "Inizia" non chiede più di inquadrare il quadro. Racconto e personaggio partono subito; i particolari si toccano sull'immagine; la caccia usa la lente sullo schermo. Chi vuole può passare alla fotocamera con **📷 Usa la fotocamera sul quadro** | **Ristampa i cartellini**: quelli vecchi aprono ancora la versione "da inquadrare" |
| Ronda: niente riquadri gialli | I riquadri dei particolari da trovare sono nascosti. Compaiono man mano che il cerchio al centro ci si avvicina, oppure tutti insieme per 5 secondi con **💡 Aiuto**. Toccando la miniatura di un particolare non trovato si accende solo il suo riquadro e compare la zona ("in basso a sinistra"). I particolari già trovati restano segnati in verde | Ronda e Arnolfini con la fotocamera: si trovano ancora i particolari? |
| CHIEDI più realistico | Fatto l'ibrido: testo completo del museo + assistente online facoltativo (vedi sotto) | Vedi la sezione qui sotto |

## CHIEDI con il testo completo del museo (29/10/2026)

Come funziona adesso:
- **Domanda prevista**: risposta preparata, con la sua voce (come prima).
- **Domanda diversa**: il telefono cerca il paragrafo giusto nel **testo completo del museo**.
  - **Con internet e con l'assistente collegato**: un modello open source lo trasforma in una risposta breve in prima persona.
  - **Senza internet**: il personaggio legge il paragrafo.
  - In entrambi i casi la voce è quella italiana del telefono.
- **Domanda fuori tema**: "Non so rispondere".

Da fare:
1. **Rivedere i testi completi** che ho preparato per le prove: `contenuti/01-autoritratto-durer/approfondimento.txt` e `contenuti/02-ginevra-de-benci/approfondimento.txt` (o nello Studio, scheda Personaggio, in fondo). Ho aggiunto vita, viaggi, opere e autoritratti di Dürer e qualche fatto su Ginevra, ognuno su due fonti (`fonti.md`). È il museo che deve scrivere la versione definitiva: più il testo è ricco, più domande trovano risposta.
2. **Collegare l'assistente online** (facoltativo, gratuito): nello Studio, **Verifica e pubblica** → riquadro **4** → **Pubblica l'assistente**. La prima volta serve un account Cloudflare gratuito: lo crei tu nella pagina che si apre (io non posso creare account). Poi premi **Pubblica**.
   - Finché non lo colleghi, l'app funziona lo stesso: legge il paragrafo.
   - Dopo il collegamento dimmelo: provo io qualche domanda vera e controllo che le risposte restino fedeli al testo.
3. **Provare sul telefono** (Dürer e Ginevra), scrivendo domande che non sono tra i pulsanti, per esempio "Sei mai stato in Italia?", "Avevi figli?", "Quanto è grande il quadro?". Mandami quelle a cui risponde male.

## Dopo le prove con gli utenti (29/10/2026): da ricontrollare

Ho sistemato i 4 punti segnalati. Ti chiedo di rifare queste prove sul Galaxy, meglio se con le stesse persone.

| Segnalazione | Cosa ho cambiato | Da provare |
|---|---|---|
| 1. Personaggio poco vivo (Dürer) | La testa annuisce mentre parla, oscilla e si gira un po' verso di te. Le sopracciglia si alzano sulle sillabe forti, le labbra si stringono su "o" e "u". Lo sfondo ondeggia in profondità e capelli e vesti si muovono appena. Respiro più visibile | Dürer e Ginevra: è più naturale? Guarda anche i nuovi video in `revisione/volto-*.mp4` |
| 2. Domande capite male | Sinonimi (papà = padre, abito = vestito, autore = pittore…), errori di battitura anche nei sinonimi, ricerca anche nelle parole delle risposte. Quando non è sicuro propone "Forse volevi chiedere…" con 2-3 pulsanti, invece di dire subito "non so" | Fai scrivere le domande alle stesse persone di prima. Se una domanda sbaglia ancora, mandami il testo esatto |
| 3. Ronda di notte senza animazione | Ogni particolare si apre con un primo piano animato: la camera si avvicina piano, con effetto di profondità. "Ascolta tutto" ora è un racconto animato come quello della *Zattera*. Racconto e particolari "respirano" e ondeggiano in profondità | Ronda e Arnolfini: apri due particolari e poi "Ascolta tutto" |
| 4. Lente dei Proverbi non precisa | La lente mostra sempre il punto sotto il suo centro, indicato da un mirino (+). Prima, senza fotocamera, mostrava il punto sotto il dito, non quello sotto la lente. Immagine più definita (da 2400 a 3840 pixel), così è nitida anche da vicino. Pulsante **💡 Aiuto**: al primo tocco dice la zona e mostra una freccia nella lente, al secondo anche il nome | Proverbi: la lente è centrata sul punto giusto? Gli aiuti bastano? |

---

## Fase 6: rilascio dell'MVP

Lo stato dei criteri di accettazione è in `docs/RILASCIO_MVP.md`. Per chiudere l'MVP mancano solo prove che puoi fare tu.

### 1. Prova dello Studio: un settimo quadro in meno di 20 minuti (criterio b)

Fai partire un cronometro e, **senza guardare la guida se puoi**:

1. Doppio clic su **"Avvia Studio"**, poi **+ Aggiungi quadro** con un quadro a tua scelta. Va bene un'immagine qualsiasi di un quadro di pubblico dominio, da almeno 2000 pixel.
2. Carica l'immagine e scrivi due righe di testo. Attiva la voce DEMO.
3. Scheda **Interazione**: scegli **Racconto**.
4. Scheda **Racconto**: carica un video breve qualsiasi.
5. Scheda **Anteprima**: guardalo con la fotocamera simulata.
6. **Verifica e pubblica** → **Pubblica**.

Dimmi quanti minuti ci hai messo e dove ti sei bloccato. Alla fine, se vuoi, elimina il quadro di prova e ripubblica: con **↶ Annulla** o dalla **Cronologia** torni indietro.

### 2. Test sul campo, in sala (quando i quadri veri sono pronti)

Segui `docs/TEST_SUL_CAMPO.md`: luce, distanza, riflessi, affollamento, rumore. Aggiungi `&debug=1` all'indirizzo e, alla fine di ogni prova, tocca **"Copia rapporto"** e incollalo in chat.

### 3. Cartellini

Stampa https://fabione-gssi.github.io/museo-noixvoi-ar/stampa/cartellini.pdf: c'è un cartellino con QR per ogni quadro, più uno con l'elenco di tutti i quadri. Ritagliali lungo la linea tratteggiata.

### Ancora aperte dalle fasi precedenti

- **Fase 4**: giudizio sulle 4 anteprime del volto e prova del personaggio sul Galaxy.
- **Fase 5**: prova senza internet sul Galaxy e cronologia nello Studio.
- **iPhone**: tutte le prove, appena ne hai uno, anche in prestito. È il rischio principale prima del pubblico.

---

## Fase 5: uso senza internet e cronologia

### 1. Senza internet sul telefono (Galaxy A56), circa 10 minuti

Prepara il quadro *Arnolfini* a schermo o stampato, come nelle prove precedenti: https://fabione-gssi.github.io/museo-noixvoi-ar/stampa/arnolfini-A3.pdf

1. **Con internet**, apri sul telefono https://fabione-gssi.github.io/museo-noixvoi-ar/
   - Se compare la pagina vecchia, chiudi la scheda e riaprila: la versione nuova arriva alla seconda apertura.
2. In basso tocca **"Scarica tutti i quadri per usarli senza internet (… MB)"** e aspetta il messaggio con il segno ✓.
3. Attiva la **modalità aereo** (Wi-Fi spento compreso).
4. Da https://fabione-gssi.github.io/museo-noixvoi-ar/stampa/prova.pdf (sul computer) inquadra il QR dell'**Arnolfini**, tocca **Inizia** e avvicinati allo specchio.
5. Sempre in modalità aereo, torna all'elenco dei quadri e prova anche la **Zattera della Medusa** o i **Proverbi**.
6. Facoltativo: nel menu di Chrome (⋮) tocca **"Aggiungi a schermata Home"** (o "Installa app"), poi apri l'app dall'icona nuova.

| Domanda | Risposta |
|---|---|
| a. Il pulsante mostra quanti MB servono e alla fine compare "✓ Tutti i quadri sono sul telefono"? | |
| b. In modalità aereo, l'Arnolfini viene riconosciuto e lo specchio fa partire l'audio? | |
| c. Nell'elenco dei quadri c'è la scritta "✓ anche senza internet"? E gli altri quadri funzionano? | |
| d. (Facoltativo) L'icona sulla schermata Home si vede bene e l'app si apre a schermo intero? | |

Alla fine ricordati di **togliere la modalità aereo**.

### 2. Cronologia nello Studio, circa 3 minuti

Doppio clic su **"Avvia Studio"** → **Verifica e pubblica** → in fondo **"3. Cronologia delle pubblicazioni"**.

1. Guarda l'elenco: la prima versione ha l'etichetta verde **online**.
2. Su una versione più vecchia premi **"Ripristina questa versione"** e conferma. Nell'elenco dei quadri controlla che i contenuti siano quelli di allora (per esempio, prima della Fase 3 non c'erano i *Proverbi*).
3. Premi **↶ Annulla** (in alto): tutto torna come prima.
4. **Non premere "Pubblica"** durante questa prova.

Dimmi se è chiaro.

---

## Fase 4: personaggio (Dürer e Ginevra de' Benci)

### 1. Giudica l'animazione del volto, circa 3 minuti (la decisione più importante)

Nella cartella `revisione` del progetto ci sono 4 video di 5 secondi. Aprili con un doppio clic, con l'audio acceso:

- `volto-autoritratto-durer-completa.mp4` e `volto-autoritratto-durer-presenza.mp4`;
- `volto-ginevra-de-benci-completa.mp4` e `volto-ginevra-de-benci-presenza.mp4`.

"Completa" vuol dire con la bocca che si muove e il battito di ciglia. "Presenza" vuol dire solo sguardo, respiro e un leggero movimento.

Per ciascuno scrivi **naturale**, **accettabile** o **inquietante**:

| Video | Giudizio |
|---|---|
| Dürer, completa | |
| Dürer, presenza | |
| Ginevra, completa | |
| Ginevra, presenza | |

Regola: se la versione "completa" di un quadro è **inquietante**, per quel quadro passo alla "presenza" (basta un clic nello Studio) e lo scrivo nel rapporto.

### 2. Prova sul telefono (Galaxy A56), circa 10 minuti

1. Sul computer apri a schermo intero (o stampa) https://fabione-gssi.github.io/museo-noixvoi-ar/stampa/autoritratto-durer-A3.pdf
2. Da https://fabione-gssi.github.io/museo-noixvoi-ar/stampa/prova.pdf inquadra il QR di **Dürer**, tocca **Inizia** e inquadra il quadro.
3. Quando si presenta, abbassa pure il telefono. Prova due domande suggerite, poi scrivine una a modo tuo (es. "quanti anni avevi?") e una fuori tema (es. "qual è il tuo cibo preferito?").
4. Ripeti con **Ginevra de' Benci** (`ginevra-de-benci-A3.pdf`).

| Domanda | Risposta |
|---|---|
| a. Dopo il riconoscimento il personaggio si presenta, con voce e sottotitoli? | |
| b. Inclinando il telefono, gli occhi ti seguono? | |
| c. Le domande scritte a modo tuo trovano la risposta giusta? | |
| d. A quella fuori tema risponde "Non so rispondere…"? | |
| e. Il telefono resta fluido? | |

### 3. Revisione dei testi e delle risposte (obbligatoria prima del rilascio)

- **Testi in prima persona**: `contenuti/01-autoritratto-durer/testo.txt` e `contenuti/02-ginevra-de-benci/testo.txt`. Le fonti di ogni fatto sono in `fonti.md`.
- **Domande e risposte**: nello Studio, scheda **Personaggio**, 11 per quadro. Ognuna indica la frase del testo da cui viene. Correggi, aggiungi o togli quello che vuoi, poi premi **Salva il personaggio** e **Prepara**.
- **Punti del volto**: `revisione/autoritratto-durer.jpg` e `revisione/ginevra-de-benci.jpg` (puntini gialli su occhi, bocca e mento).

---

## Fase 3: prova della caccia

### 1. Caccia sul telefono: ✅ fatto (tutto ok)

### 2. Editor nello Studio: ✅ fatto

### 3. Revisione dei contenuti (quando hai tempo)

- Testo: `contenuti/05-proverbi-fiamminghi/testo.txt`, con le fonti in `fonti.md`.
- Punti della caccia: `revisione/proverbi-fiamminghi.jpg`.

---

## Fase 2: prova dei dettagli

### 1. Dettagli sul telefono: ✅ fatto (funziona tutto)

### 2. Editor nello Studio: ✅ fatto

### 3. Revisione dei contenuti (quando hai tempo)

- Testi: `contenuti/03-ronda-di-notte/testo.txt` e `contenuti/04-arnolfini/testo.txt`. Le fonti sono in `fonti.md`, con l'elenco dei fatti che ho tolto perché confermati da una sola fonte.
- Riquadri dei particolari: `revisione/ronda-di-notte.jpg` e `revisione/arnolfini.jpg`.

---

## Fase 1: prova del racconto e dello Studio

### 1. Racconto sul telefono: ✅ fatto (Galaxy A56, tutto sì)

### 2. Studio sul computer: ✅ fatto (funziona tutto, anche il link per il telefono)

### 3. Revisione dei contenuti (quando hai tempo)

- Leggi `contenuti/06-zattera-medusa/testo.txt` e `fonti.md`: ogni fatto ha due fonti. Alcuni fatti interessanti (Delacroix come modello, il modellino della zattera) li ho tolti perché li ho trovati confermati da una sola fonte.
- Guarda `revisione/zattera-medusa.jpg`: i riquadri dei particolari sono al posto giusto?

### 4. cloudflared: ✅ approvato e installato (anteprima via internet)

---

## Fase 0: prova sui telefoni

**Stato:** ✅ Android fatto il 27/10 (Galaxy A56, a schermo e su stampa): tutto funziona.

⏸️ **iPhone rimandato**: quando ne avrai uno a disposizione, anche in prestito per 10 minuti, rifai i passi qui sotto (2, 3, 4 e 5). Serve prima del rilascio finale.

Ti servono: un iPhone e un telefono Android (anche di qualche anno fa) e un computer.

### 1. Prepara il quadro da inquadrare

Fai **entrambe** le prove, se puoi: lo schermo crea riflessi e righe ("moiré") che falsano il risultato.

- **A schermo**: sul computer apri https://fabione-gssi.github.io/museo-noixvoi-ar/stampa/arnolfini-A3.pdf a schermo intero.
- **Stampato**: stampa lo stesso file su un foglio A3 (va bene anche A4) e appendilo al muro, all'altezza degli occhi.

### 2. Apri la prova sul telefono

Sul computer apri https://fabione-gssi.github.io/museo-noixvoi-ar/stampa/prova.pdf: ci sono tre codici QR. Inquadra il primo con la fotocamera del telefono e tocca il link che compare.

### 3. Diagnostica (QR n. 1), circa 30 secondi

Tocca **Avvia la prova** e consenti fotocamera e movimento se te lo chiede. Alla fine tocca **Copia risultati** e incollali in chat, oppure fai uno screenshot e mandamelo.

### 4. Riconoscimento (QR n. 2)

Tocca **Inizia**, poi rispondi sì/no a ogni domanda, per ciascun telefono:

| Domanda | iPhone | Android |
|---|---|---|
| a. Stando a circa 1 metro, compare la cornice bianca attorno al quadro entro 2-3 secondi? | | |
| b. La cornice resta "attaccata" al quadro quando muovi un po' il telefono? | | |
| c. Avvicinandoti allo **specchio rotondo** (tenendolo dentro il cerchio al centro), compare la scheda "Lo specchio convesso"? | | |
| d. Avvicinandoti al **cagnolino**, compare la scheda "Il cagnolino"? | | |
| e. Il telefono resta fluido (niente scatti forti) e non si scalda troppo? | | |

### 5. Benchmark (QR n. 3), circa 1 minuto

Tocca **Avvia** e tieni il telefono puntato sul quadro finché compare "Finito". Poi tocca **Copia risultati** e incollali in chat (oppure fai uno screenshot).

Indicami anche il **modello** dei due telefoni (es. "iPhone 12, Samsung A52").

---

## Da completare più avanti (non urgente)

- Sala del quadro *Arnolfini*: è un quadro di esempio, va bene lasciarla vuota fino ai quadri reali.
