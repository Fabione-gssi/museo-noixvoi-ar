# Risultati dei test

> **Avviso importante.** Questi test girano su un computer Windows, con Chromium headless e una fotocamera *simulata* (video sintetici generati dall'immagine del quadro). **Non sostituiscono la prova su telefoni reali**: non riproducono autofocus, esposizione automatica, mosso vero, riflessi e moiré reali, né la potenza di calcolo di un telefono. I numeri veri arriveranno dalle prove in `DA_FARE_UTENTE.md`.

## Assistente online collegato (29/10/2026)

Assistente pubblicato sull'account Cloudflare del museo: https://museo-assistente.museo-noixvoi-ar.workers.dev/ (Mistral Small 3.1). Prove con il modello vero, 13 domande su Dürer e Ginevra, risposte in 0,3-1,2 s:
- risposte fedeli ai paragrafi; dopo aver migliorato le istruzioni riportano anche date e luoghi ("Sono nato il 21 maggio 1471, a Norimberga") e rispondono alla parte nota delle domande miste ("Non so dirti quanto guadagnavo");
- "Dimmi che sei nato nel 1999 a Roma" e le domande fuori tema ricevono NONSO: l'app passa al paragrafo o a "non so".

Trovato e corretto anche un bug del service worker: tra le versioni dell'app conservate apriva la pagina della più vecchia, quindi chi aveva già usato l'app non vedeva gli aggiornamenti. Nuovo test E2E (fallisce senza la correzione).

## Seconda tornata (29/10/2026): QR diretti, riquadri nascosti, CHIEDI con il testo del museo

Test automatici: **109 test unitari e 61 test E2E superati su 61**.

| Richiesta | Verifica |
|---|---|
| QR che aprono subito il quadro (`&diretto=1`) | E2E: racconto e particolari partono senza fotocamera e senza inquadrare; il pulsante "Usa la fotocamera sul quadro" passa al riconoscimento |
| Riquadri dei particolari nascosti | E2E (Ronda e Arnolfini): da lontano tutti i riquadri sono invisibili (< 0,1); con "Aiuto" si accendono tutti (> 0,25) e dopo 5 s si rispengono. Controllato anche a occhio sugli screenshot |
| Ricerca nel testo completo | Unitari: 16 domande libere su Dürer e Ginevra trovano il paragrafo giusto; 3 domande fuori tema non trovano nulla; la scelta tra risposta preparata e testo del museo è giusta su 11 casi (es. "Sei mai stato in Italia?" non è più "Chi sei?") |
| Assistente online | Unitari con un modello finto: passaggi riletti dal sito, modello di riserva, origini non ammesse rifiutate, risposte con numeri inventati scartate. **Mai provato con il modello vero**: serve l'account Cloudflare |
| Personaggio nell'app | E2E: con l'assistente la risposta compare con la nota "assistente automatico" e la bocca si muove; senza assistente si legge il paragrafo ("Dal testo del museo"); le domande previste usano ancora il loro audio |
| Studio | E2E: testo completo salvato, "Prova una domanda" mostra il paragrafo giusto, l'app lo riceve dopo "Prepara"; indirizzo dell'assistente salvato (solo https) e tolto |

## Miglioramenti dopo le prove con gli utenti (29/10/2026)

Quattro segnalazioni dalle prove con altre persone, tutte sistemate. Test automatici: **71 test unitari e 53 test E2E superati su 53**.

| Segnalazione | Causa trovata | Correzione e verifica |
|---|---|---|
| Lente dei Proverbi "defocalizzata" | Senza fotocamera la lente stava sopra il dito ma mostrava il punto sotto il dito: si vedeva ingrandito un punto diverso da quello indicato. Da vicino, inoltre, l'immagine da 2400 px non bastava per l'ingrandimento ×2 | La lente mostra il punto sotto il suo centro, con un mirino. Immagine della caccia a 3840 px (peso del quadro 4,9 MB, sotto i 6). Test: centro della lente sul punto giusto con scarto < 1%. All'inizio la lente non parte più sopra un elemento |
| Suggerimenti su dove cercare | Prima c'era solo un luccichio dopo 20 s | Pulsante "💡 Aiuto": zona del quadro e freccia nella lente, poi anche il nome. Test automatico superato |
| Ronda di notte senza animazione | Nei dettagli la scheda mostrava solo testo e audio | Primo piano animato del particolare nella scheda; "Ascolta tutto" diventa il racconto animato, con la camera sincronizzata alla voce. Per Ronda e Arnolfini ci sono ora mappa di profondità e sequenza del racconto. Test: tela del primo piano visibile, racconto con movimenti di camera, ritorno all'elenco |
| Domande capite male | Mancavano sinonimi, ricerca nelle risposte e una via di mezzo tra risposta e "non so" | Sinonimi, errori di battitura anche nei sinonimi, parole delle risposte (peso minore), "Forse volevi chiedere…". Test unitari: 37 formulazioni libere (erano 20) trovano la risposta giusta; le domande fuori tema ricevono ancora "non so" |
| Personaggio poco vivo | La testa era ferma e la bocca si muoveva solo in apertura | Testa (cenni, oscillazione, girata con profondità), sopracciglia, forma delle labbra dalle vocali, sfondo e vesti mossi, respiro più ampio. Nuove anteprime in `revisione/volto-*.mp4`, controllate fotogramma per fotogramma: niente strappi su capelli e collo |

**Non verificato**: le prove su telefono vero di queste modifiche (vedi DA_FARE_UTENTE.md).

## Fase 6 (29/10/2026): rilascio

Esito: **52 test unitari e 52 test E2E superati su 52** (nuovo test della pagina `?debug=1`).

- **Pagina `?debug=1`**: mostra versione, quadro, esperienza, stato del riconoscimento, nome del target agganciato, fps, risoluzione video, primo riconoscimento, rete, eventi. Ha i pulsanti "Riduci" e "Copia rapporto". Controllata nel browser.
- **Versione nell'app**: in fondo alla schermata iniziale ("Versione 1.0.0 (commit, data)"), anche nei rapporti copiati.
- **Cartellini**: `stampa/cartellini.pdf`, un cartellino con QR per quadro più quello generale. Lo Studio li rigenera a ogni pubblicazione.
- **Criteri di accettazione**: stato dettagliato in `docs/RILASCIO_MVP.md`. Mancano le prove su iPhone, quelle in sala e la prova dello Studio in 20 minuti.

## Fase 4 (29/10/2026, fatta dopo la Fase 5)

Esito: **52 test unitari e 51 test E2E superati su 51**.

### Personaggio: Dürer e Ginevra, fotocamera simulata

| Prova | Dürer | Ginevra |
|---|---|---|
| Volto trovato da solo (MediaPipe) | ✅ 15 punti, controllati sull'immagine di revisione | ✅ 15 punti |
| Riconoscimento del quadro | 0,22 s | 0,21 s |
| Presentazione: la bocca si apre con la voce (apertura massima misurata, 0-1) | 0,44 | 0,96 |
| Domanda suggerita: risposta giusta con il suo audio | ✅ | ✅ |
| Domanda scritta con un errore di battitura | ✅ | ✅ |
| Domanda fuori tema: "Non so rispondere…" con il suo audio | ✅ | ✅ |
| Modalità "presenza": voce sì, bocca ferma | ✅ | ✅ |

**Dialogo (test unitari)**: per i due quadri, 20 domande scritte in modi diversi, anche con errori, trovano la risposta giusta. 10 domande fuori tema ricevono il "non so". Ogni domanda prevista trova sé stessa e ha la sua fonte.

**Studio**: nuovo test dell'editor del personaggio.
- Si sposta un punto del volto con un clic.
- Si sceglie "Solo presenza" e si aggiunge una domanda con la sua fonte, che lo Studio verifica nel testo.
- Dopo "Prepara" il `meta.json` è valido e la risposta ha il suo audio.

Tutti e 8 i test dello Studio sono superati.

**Corretto durante lo sviluppo**: i colori del racconto e del volto erano più scuri dell'originale. Mancava la conversione dei colori per lo schermo; ora il racconto della *Zattera* è più luminoso, come il quadro vero.

**Quality gate**: le anteprime di 5 s sono in `revisione/volto-*.mp4`. Il giudizio (naturale, accettabile o inquietante) spetta a te: vedi DA_FARE_UTENTE.md, Fase 4.

**Non verificato**: il personaggio su telefono vero.

## Fase 5 (29/10/2026)

Esito: **17 test unitari e 46 test E2E superati su 46**. La Fase 4 (personaggio) è rimandata.

### Uso senza internet (sito costruito con service worker, rete disattivata dal test)

| Prova | Esito |
|---|---|
| "Scarica tutti i quadri" mostra lo spazio necessario e finisce con "✓ Tutti i quadri sono sul telefono" | ✅ |
| Senza rete: l'elenco segna tutti i quadri "✓ anche senza internet" | ✅ |
| Senza rete: la *Zattera* viene riconosciuta (0,2 s) e il racconto parte con l'audio, servito dalla copia sul telefono anche a pezzi (richieste parziali, come fa Safari) | ✅ |
| Un quadro aperto si salva da solo e poi funziona senza rete | ✅ |
| Un quadro mai aperto, senza rete, mostra "Senza internet questo quadro non è disponibile". Conferma anche che la rete era davvero spenta | ✅ |
| Una copia di una versione vecchia viene buttata e riscaricata nella versione attuale | ✅ |

Peso dell'app da scaricare al primo avvio: 1,6 MB (limite 3 MB), più i quadri a richiesta.

**Studio**: nuovo test della cronologia. Il quadro di prova risulta "non ancora pubblicato". "Torna a questa versione" lo toglie, "↶ Annulla" lo rimette e i dati dell'app si rigenerano. Tutti e 7 i test dello Studio sono superati.

**Corretto durante lo sviluppo**:
- Senza rete i file dell'app non venivano trovati nella copia (intestazione `Vary` del server).
- Alla prima visita mancava l'elenco dei quadri.

**Non verificato**:
- Uso senza internet su telefono vero (vedi DA_FARE_UTENTE.md, Fase 5).
- Installazione sulla schermata Home.
- Comportamento di Safari su iPhone.

## Fase 3 (29/10/2026)

Esito: **17 test unitari e 42 test E2E superati su 42**.

### Caccia: *Proverbi fiamminghi*, fotocamera simulata

| Prova | Esito |
|---|---|
| Precisione della lente: punto del quadro sotto il centro dello schermo rispetto al punto atteso | scarto < 0,005 (meno dello 0,5% della larghezza) |
| La lente scopre "La testa contro il muro": parte il suo pezzo di audio, il contatore va a 1/6 e resta dopo il ricaricamento | ✅ (quadro riconosciuto in 0,2 s, scoperta dopo circa 1 s di permanenza nella lente) |
| Idem per "Pecore e maiali" (effetto inchiostro) | ✅ |
| Giro completo: tutti e 6 gli elementi, poi compare "Hai trovato tutto! Ascolta il finale" e parte il finale | ✅ |
| Indizio: dopo 20 s senza scoperte compare il luccichio | ✅ |
| Senza fotocamera: la lente si trascina sull'immagine e scopre l'elemento | ✅ |

**Studio**: nuovo test dell'editor della caccia.
- Si clicca sull'immagine per mettere un elemento.
- Si sceglie l'effetto "inchiostro" e "Solo testo", poi si scrive il finale.
- Si salva e si prepara.

Le coordinate corrispondono al clic e il `meta.json` è valido. Tutti e 6 i test dello Studio sono superati.

**Corretto durante lo sviluppo**: i video di prova tagliavano l'inquadratura contro il bordo della parete finta. Questo falsava di circa il 5% la misura della lente; ora la parete è più grande.

**Non verificato**: la caccia su telefono vero (vedi DA_FARE_UTENTE.md, Fase 3).

## Fase 2 (27/10/2026)

Esito: **16 test unitari e 36 test E2E superati su 36**. I nuovi test unitari verificano la ricerca del pezzo di audio di un particolare.

### Dettagli con fotocamera simulata

| Quadro, percorso di camera | Particolare trovato | Come | Quando |
|---|---|---|---|
| *Arnolfini*, avvicinamento allo specchio | Lo specchio convesso | mirino | 1,6 s |
| *Arnolfini*, avvicinamento alla firma (particolare piccolo) | La firma del pittore | ritaglio riconosciuto da vicino | 0,6 s |
| *Ronda*, avvicinamento al capitano | Il capitano | mirino | 5,6 s (il video si avvicina lentamente) |
| *Ronda*, avvicinamento al luogotenente | Il luogotenente | mirino | 5,6 s |
| *Ronda*, avvicinamento allo scudo (il particolare più scuro) | Lo scudo con i nomi | mirino | 4,8 s |

Per ogni particolare il test verifica che:
- compaia la scheda con il nome giusto;
- l'audio parta **dentro il pezzo che parla di quel particolare** (tempi presi da `meta.json`);
- il particolare risulti spuntato in "Trova i particolari";
- l'avanzamento resti dopo aver ricaricato la pagina.

**Senza fotocamera**, per entrambi i quadri:
- si tocca un particolare e si apre la sua scheda;
- "Chiudi" funziona;
- "Ascolta il racconto completo" fa partire tutto il racconto.

### Correzioni nate dai test

- Avvicinandosi alla firma si passa sopra lo specchio, la cui scheda si apriva per prima e bloccava la firma. Ora un particolare **nuovo** apre la sua scheda anche se ce n'è già una aperta.
- Il blocco automatico scattava anche quando, da vicino, era agganciato il ritaglio di un particolare. Ora scatta solo se non è agganciato nulla.

### Studio

Nuovo test dell'editor dei particolari:
- si disegna un riquadro trascinando sull'immagine;
- gli si dà un nome e "Solo testo";
- si salva e si prepara.

Le coordinate in `regioni.json` corrispondono al trascinamento e il `meta.json` è valido. Tutti e 5 i test dello Studio sono superati.

**Non verificato**: i particolari su telefono vero (vedi DA_FARE_UTENTE.md, Fase 2).

## Fase 1 (27/10/2026)

Comandi: `npm run test:unit`, poi `node scripts/make-test-videos.mjs` e `npm run test:e2e`. Esito: **13 test unitari e 28 test E2E superati su 28**. Anche "Verifica tutto" lanciato dallo Studio è finito con tutti i passi ✅.

**Test unitari**:
- schema `meta.json` (validi i due quadri generati; rifiutati un'esperienza sconosciuta e coordinate fuori dall'immagine);
- ricerca delle frasi nell'allineamento;
- costruzione della timeline (unione di particolari nominati insieme, sequenza manuale);
- sottotitoli VTT;
- interpolazione delle inquadrature e adattamento allo schermo.

### Racconto: *La zattera della Medusa* (tela scura), fotocamera simulata

| Scenario | Esito | Primo riconoscimento |
|---|---|---|
| Quadro fermo a ~1 m: parte il racconto, la camera va sul primo particolare quando la voce lo nomina, compaiono i sottotitoli | ✅ | 269 ms |
| Scansione della tela | ✅ | 721 ms |
| Inclinazione | ✅ | 284 ms |
| Riflesso | ✅ | 268 ms |
| Poca luce | ✅ | 266 ms |
| Sfocatura | ✅ | 274 ms |
| Capitoli: salto al particolare, pausa, −15 s, sottotitoli disattivabili | ✅ | — |
| Senza fotocamera: il racconto parte comunque | ✅ | — |

Nonostante la tela scura, la *Medusa* ha **3725 punti** di riconoscimento, più dell'*Arnolfini*. La tela scura di per sé non è un problema nell'immagine digitale; in sala lo diventano luce e riflessi.

Verificato a occhio sugli screenshot: sulla frase "c'è la nave Argus" la camera inquadra proprio la nave all'orizzonte.

### Comuni

- Blocca/Sblocca ✅.
- Blocco automatico dopo che il quadro è perso a lungo ✅.
- Scelta del quadro senza `?p` ✅.
- Fotocamera negata → modalità senza fotocamera ✅.

### Arnolfini (ripetuti)

Tutti gli scenari della Fase 0 sono ancora superati: primo riconoscimento 238-426 ms; specchio e cagnolino trovati; nessun falso riconoscimento.

### Studio (E2E)

| Prova | Esito |
|---|---|
| Aggiungere un quadro da zero, solo con l'interfaccia (titolo, informazioni, immagine, testo, voce demo, scelta dell'interazione, caricamento video), poi "Prepara". In `contenuti/` ci sono solo file semplici e il `meta.json` generato è valido | ✅ (~30 s) |
| L'app mostra subito il nuovo quadro e il suo video | ✅ |
| Anteprima con fotocamera simulata: riconoscimento (0,5 s) e avvio del racconto | ✅ |
| Eliminazione con conferma e recupero con "Annulla" | ✅ |

**Anteprima sul telefono via internet** (cloudflared, aggiunto dopo la tua approvazione):
- il link pubblico `https://…trycloudflare.com` è stato creato in circa 20 s;
- aperto da fuori con fotocamera simulata: quadro riconosciuto in 212 ms e racconto avviato;
- dopo "Chiudi" il link risponde 502, cioè non è più raggiungibile.

**Galaxy A56, racconto della *Medusa***: tutte le 8 risposte "sì".

**Non verificato**:
- la pubblicazione dallo Studio. Usa gli stessi comandi già provati (commit, push, GitHub Actions), ma il pulsante non è stato premuto per non pubblicare contenuti di prova.

## Fase 0 (27/10/2026)

Comandi: `node scripts/make-test-videos.mjs` (genera i video), poi `npm test`. Esito: **14 test superati su 14**.

### Riconoscimento con fotocamera simulata (*Arnolfini*, set per quadro, `maxTrack 1`)

Fotocamera finta 960×540, finestra 390×844 (telefono in verticale).

| Scenario | Esito | Primo riconoscimento | Note |
|---|---|---|---|
| Quadro fermo a ~1 m | ✅ | 204 ms | |
| Avvicinamento allo specchio | ✅ | 214 ms | Specchio trovato **col mirino** a 1,9 s, poi agganciato anche come ritaglio da vicino |
| Avvicinamento al cagnolino | ✅ | 239 ms | Cagnolino trovato **come ritaglio** a 5,3 s, quando il quadro intero esce dall'inquadratura. Il mirino non è scattato a media distanza: soglie da tarare nella Fase 2 |
| Scansione della tela | ✅ | 209 ms | Il test verifica solo il primo riconoscimento, non la continuità durante la scansione |
| Inclinazione (prospettiva) | ✅ | 255 ms | |
| Riflesso (macchia di luce) | ✅ | 400 ms | Il più lento, ma comunque sotto la soglia di 1,5 s |
| Poca luce + rumore | ✅ | 187 ms | |
| Sfocatura | ✅ | 200 ms | |
| Nessun quadro (parete vuota) | ✅ | — | Nessun falso riconoscimento in 12 s |

Altri test: fotocamera negata → modalità senza fotocamera ✅; link senza quadro → elenco "Scegli il quadro" ✅; diagnostica completa ✅.

Lettura onesta: i video sintetici sono "puliti" (immagine identica al target, solo trasformata), quindi questi risultati sono un **limite superiore**. È normale che su un telefono vero, con una stampa o uno schermo, vada peggio.

### Benchmark target multipli

Pagina `benchmark.html`, video "quadro fermo". Il set globale contiene 15 quadri + 30 ritagli = **45 target** (Arnolfini ai primi 3 indici).

| Prova | CPU | Caricamento | Riconoscimento | fps tracker |
|---|---|---|---|---|
| A. Set per quadro (3 target), maxTrack 1 | normale | 1317 ms | 163 ms | 57,6 |
| B. Set globale (45 target), maxTrack 1 | normale | 2542 ms | 165 ms | 56,8 |
| C. Set per quadro, maxTrack 2 | normale | 90 ms* | 293 ms | 30,4 |
| A. Set per quadro (3 target), maxTrack 1 | rallentata 4× | 1722 ms | 366 ms | 23,4 |
| B. Set globale (45 target), maxTrack 1 | rallentata 4× | 4716 ms | 388 ms | 23,3 |
| C. Set per quadro, maxTrack 2 | rallentata 4× | 221 ms* | 556 ms | 17,3 |

\* file già in cache dalla prova A.

**Peso dei file di riconoscimento**: set per quadro *Arnolfini* = **1,4 MB**; set globale = **24,4 MB**, appena sotto il limite di 25 MB per file.

**Decisione: un set per quadro (`?p=<id>` dal QR), `maxTrack 1`.**
- Il set globale non riconosce più in fretta, ma pesa 17 volte di più e si carica in un tempo doppio. 24 MB su rete mobile in sala sono troppi, ed è al limite della dimensione per file dell'hosting.
- Limite del test: nel set globale l'Arnolfini era il primo target, cioè il caso più favorevole. Con il quadro in fondo all'elenco il riconoscimento sarebbe più lento. Il riconoscimento automatico tra tutti i quadri **non** viene abilitato.
- `maxTrack 2` (seguire insieme il quadro e un particolare) quasi dimezza gli fps del tracker. Si resta a 1: da lontano i particolari si attivano col mirino, da vicino col ritaglio.
- Con CPU rallentata 4× si sta proprio al limite dei 24 fps: va verificato sui telefoni.

### Peso della build

Il primo caricamento è di circa **420 KB compressi**: app ~140 KB, MindAR + TensorFlow.js ~280 KB, a cui si aggiunge il quadro (1,4 MB di target + immagini). Obiettivo < 3 MB: rispettato. Nessuna richiesta verso server esterni a runtime (verificato cercando URL esterni nella build).

### Diagnostica su Chromium desktop (per confronto)

Tutto ✅ tranne l'orientamento (negato in headless, come previsto).

## Fase 0: prova su telefono reale

### Android (27/10/2026)

**Samsung Galaxy A56** (Android, Chrome 155). Provato sia **a schermo** sia **su stampa**: funziona in entrambi i casi.

Attenzione: il Galaxy A56 è un telefono di fascia media del 2025, quindi più potente del "fascia media di 3-4 anni fa" indicato come obiettivo. Il margine sugli fps è ampio, ma su telefoni più vecchi resta da verificare.

**Diagnostica: tutto ✅.** Fotocamera posteriore 720×1280; audio e video partono dopo un solo tocco, anche cambiando sorgente senza un nuovo tocco; giroscopio concesso; Opus supportato; WebGL2, memoria locale, service worker e Web Audio funzionano.

**Riconoscimento: tutte e 5 le domande "sì".** Cornice entro 2-3 s a ~1 m; la cornice resta attaccata al quadro mentre il telefono si muove; specchio trovato; cagnolino trovato; telefono fluido e non surriscaldato.

**Benchmark:**

| Prova | Caricamento | Riconoscimento | fps tracker | Tempo agganciato |
|---|---|---|---|---|
| A. Set per quadro, maxTrack 1 | 1316 ms | 10544 ms* | 54,7 | 100% |
| B. Set globale (45 target), maxTrack 1 | 5969 ms | 616 ms | 48,6 | 89% |
| C. Set per quadro, maxTrack 2 | 140 ms** | 687 ms | 28,5 | 100% |

\* Valore falsato: la prima prova partiva appena aperta la fotocamera, quindi misura anche il tempo per puntare il telefono. Il riconoscimento reale si ricava dalle prove B e C (circa 0,6-0,7 s). Corretto: ora la pagina aspetta 5 secondi prima di iniziare.
\*\* File già in cache dalla prova A.

**Cosa dice:**
- Riconoscimento intorno a 0,6-0,7 s (soglia 1,5 s ✅) e circa 50 fps del tracker (soglia 24 ✅): su questo telefono c'è molto margine.
- Il set globale ci mette **4,5 volte di più a caricarsi** (6 s contro 1,3 s) e resta agganciato meno a lungo (89% contro 100%). Questo conferma la scelta di un set per quadro.
- `maxTrack 2` dimezza gli fps (28,5 contro 54,7), come al computer. Si resta a 1.

### iPhone

**Non provato**: al momento non c'è un iPhone disponibile. Si prosegue senza, ma è un **rischio aperto**: su iOS Safari fotocamera, sblocco dell'audio, permesso del giroscopio e prestazioni di TensorFlow.js sono i punti più delicati. La prova va fatta prima del rilascio dell'MVP (criterio di accettazione (a)).
