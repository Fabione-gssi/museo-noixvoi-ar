# Test sul campo (in sala, con i quadri veri)

Le prove fatte finora usano stampe, schermi e una fotocamera simulata. In sala cambiano luce, distanza, riflessi del vetro, persone davanti al quadro e rumore. Questa guida serve a provare tutto in modo ordinato, **prima di aprire al pubblico** e ogni volta che si aggiunge un quadro.

## Che cosa serve

- Almeno **un iPhone e un Android**, meglio se uno dei due ha 3-4 anni. Batteria carica, volume medio, auricolari.
- I **cartellini** stampati e appesi: `https://fabione-gssi.github.io/museo-noixvoi-ar/stampa/cartellini.pdf`.
- Questo foglio, oppure il telefono per scrivere le risposte.
- Circa **5 minuti per quadro**.

## Come registrare un risultato

Aggiungi `&debug=1` all'indirizzo, oppure usa il QR del foglio `stampa/prova.pdf`. In alto a sinistra compare un riquadro verde con:
- la versione dell'app;
- lo stato ("cerco il quadro…", "agganciato: …", "bloccato");
- gli fps;
- il tempo del primo riconoscimento.

Con **"Riduci"** resta solo lo stato. Alla fine di ogni prova tocca **"Copia rapporto"** e incolla il testo in una mail o in chat: contiene i numeri della prova e il modello del telefono, nessun dato personale.

## Le prove, per ogni quadro

Per ogni prova scrivi **sì**, **no** o **a fatica**, e annota il tempo se serve.

### 1. Luce

| Prova | Come farla | Risultato atteso |
|---|---|---|
| Luce normale di sala | Inquadra il quadro intero da 1-2 m | Riconosciuto entro 2 s |
| Luce bassa (sera, faretti spenti in parte) | Come sopra | Riconosciuto entro 4 s; se no, annotalo: serve più luce sul quadro |
| Faretto puntato o sole dalla finestra | Mettiti dove la luce è più forte | Riconosciuto; annota se la parte illuminata "sparisce" |

### 2. Distanza

| Prova | Come farla | Risultato atteso |
|---|---|---|
| Lontano | Allontanati finché il quadro occupa metà dello schermo in altezza | Riconosciuto. Annota la distanza massima in passi |
| Vicino | Avvicinati finché il quadro esce dallo schermo | Resta agganciato o si blocca da solo ("Bloccato") |
| Dettagli (solo esperienza "dettagli") | Avvicinati a ogni particolare | Si apre la scheda giusta |
| Caccia (solo "caccia") | Cerca tutti gli elementi | Si trovano tutti in meno di 5 minuti |

### 3. Riflessi del vetro

| Prova | Come farla | Risultato atteso |
|---|---|---|
| Di fronte | Inquadra dritto, al centro | Riconosciuto |
| Di lato | Spostati di lato di circa 30° | Riconosciuto, anche se più lento |
| Riflesso di una finestra o lampada sul vetro | Cerca la posizione con il riflesso peggiore | Annota se il riflesso blocca il riconoscimento e da dove |

### 4. Affollamento

| Prova | Come farla | Risultato atteso |
|---|---|---|
| Una persona davanti | Chiedi a qualcuno di passare davanti al quadro | Dopo che è passata, l'app ritrova il quadro da sola entro 2 s |
| Gruppo davanti | Inquadra con altre persone vicine | Annota quanta parte del quadro deve restare visibile perché venga riconosciuto |
| "Blocca" | Tocca **Blocca** e abbassa il telefono | Il contenuto continua; con **Sblocca** si torna alla fotocamera |

### 5. Rumore

| Prova | Come farla | Risultato atteso |
|---|---|---|
| Audio senza auricolari | Volume medio, in una sala con persone | La voce si capisce; annota il volume necessario |
| Sottotitoli | Ascolta un racconto o una risposta | Sottotitoli leggibili e a tempo |
| Disturbo agli altri | Chiedi a qualcuno vicino | Con volume medio la voce non disturba; consigliare gli auricolari |

### 6. Uso senza internet (una volta sola, non per ogni quadro)

1. Con il Wi-Fi del museo, tocca **"Scarica tutti i quadri"** nella schermata iniziale.
2. Attiva la modalità aereo e prova due quadri qualsiasi.
3. Annota quanto tempo ha richiesto lo scaricamento.

### 7. Il telefono

| Prova | Risultato atteso |
|---|---|
| Fluidità (fps nel riquadro di debug) | Almeno 24 fps |
| Calore dopo 10 minuti di uso | Tiepido, non caldo |
| Batteria dopo 10 minuti | Scende di meno del 10% |

## Che cosa fare se una prova non va

| Problema | Prima cosa da provare |
|---|---|
| Non riconosce il quadro con poca luce | Più luce sul quadro, oppure accettare il pulsante "Guarda senza fotocamera" |
| Riflessi del vetro | Inclinare il faretto, o indicare sul cartellino da dove inquadrare |
| Un particolare non si apre da vicino | Nello Studio, rendilo più grande o lascialo "solo col mirino" |
| Elemento della caccia troppo difficile | Nello Studio, aumenta la "grandezza dell'area da trovare" |
| Il personaggio non convince | Nello Studio, scheda Personaggio, scegli "Solo presenza" |
| Telefono lento o caldo | Annota il modello: lo valuto e riduco la risoluzione per quei telefoni |

## Dove scrivere i risultati

Mandami i rapporti copiati. Li riporto in `docs/RISULTATI_TEST.md` e aggiorno `docs/ESPERIENZE.md` con cosa ha funzionato in sala e cosa no.
