# Risultati dei test

> **Avviso importante.** Questi test girano su un computer Windows, con Chromium headless e una fotocamera *simulata* (video sintetici generati dall'immagine del quadro). **Non sostituiscono la prova su telefoni reali**: non riproducono autofocus, esposizione automatica, mosso vero, riflessi e moiré reali, né la potenza di calcolo di un telefono. I numeri veri arriveranno dalle prove in `DA_FARE_UTENTE.md`.

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

**Non verificato**:
- l'anteprima sul telefono via Wi-Fi (serve un telefono vero sulla stessa rete);
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
