# Esperienze per quadro

Questa tabella viene aggiornata a ogni fase. Alla fine dell'MVP dirà che cosa ha funzionato sui 6 quadri di esempio, per guidare la scelta dei quadri reali.

| # | Quadro | Esperienza | Stato | Consiglio e motivazione | Rischi |
|---|---|---|---|---|---|
| 1 | Dürer, *Autoritratto con pelliccia* | personaggio | **Fase 4: completo** (presentazione in prima persona 63 s, 11 domande, volto trovato da solo, voce DEMO). Animazione completa o "presenza" da decidere con le anteprime di 5 s | Volto frontale e grande, ideale per l'animazione. 1763 punti | Fondo scuro e barba: la bocca che si apre si vede meno. Rischio "effetto inquietante" da valutare |
| 2 | Leonardo, *Ginevra de' Benci* | personaggio | **Fase 4: completo** (presentazione 73 s, 11 domande, volto trovato da solo, voce DEMO). Animazione da decidere con le anteprime | Volto chiaro e ben illuminato, tavola quasi quadrata: il volto riempie lo schermo. 3102 punti | Volto di tre quarti: lo sguardo laterale è meno naturale. Viso molto liscio: le deformazioni si notano di più |
| 3 | Rembrandt, *Ronda di notte* | dettagli | **Fase 2: completo** (7 particolari con il loro pezzo di audio, voce DEMO) | Molte figure grandi e distinte: ritagli grandi. Quadro intero 2563 punti; particolari da 682 (scudo) a 1920 (bambina) | Tela molto scura: lo scudo e il cane sono poco leggibili anche a occhio. In sala serve luce buona |
| 4 | Van Eyck, *Arnolfini* | dettagli | **Fase 2: completo** (6 particolari: specchio, firma, lampadario, cagnolino, zoccoli, arance) | Particolari piccoli e densi: ottimo test per il mirino. Firma (1019 punti) trovata sia col mirino sia da vicino nei test | Quadro piccolo (82 × 60 cm): per avvicinarsi ai particolari bisogna stare molto vicini |
| 5 | Bruegel, *Proverbi fiamminghi* | caccia | **Fase 3: completo** (6 proverbi nascosti con il loro pezzo di audio, finale, indizi, voce DEMO) | Decine di scene-proverbio documentate, texture fittissima: 3950 punti, il più alto finora. Ideale per la lente | Molti dettagli piccoli: a distanza normale la lente ingrandisce l'immagine, non la fotocamera, quindi resta nitida |
| 6 | Géricault, *Zattera della Medusa* | racconto | **Fase 1: completo** (voce DEMO, sottotitoli, camera sincronizzata, parallasse). Galaxy A56: tutto sì | Racconto naturale dal primo piano alla nave lontana. 3725 punti | Tela scura e riflessi in sala: da verificare dal vero |

## Riepilogo dell'MVP: che cosa ha funzionato (29/10/2026)

Basato sui test automatici e sulle prove su Galaxy A56 (a schermo e su stampa). Manca ancora la prova in sala e su iPhone.

**Ha funzionato bene**
- **Racconto**: è l'esperienza più semplice e robusta. Funziona con qualsiasi quadro ed è il ripiego universale.
- **Dettagli** su quadri con figure grandi e distinte (*Ronda*). Sui particolari piccoli (*Arnolfini*) il mirino al centro è essenziale: avvicinarsi a un quadro piccolo è scomodo.
- **Caccia** su quadri fitti di scene (*Proverbi*). La lente usa l'immagine ad alta risoluzione, quindi resta nitida anche da lontano. Precisione della lente nei test: meglio dello 0,5% della larghezza.
- **Personaggio**: i volti dei due ritratti sono stati trovati da soli, con i punti al posto giusto. Il dialogo locale riconosce le domande scritte in modi diversi e dice "non so" a quelle fuori tema.
- **Riconoscimento**: un set di target per quadro, un quadro alla volta. Riconoscimento in circa 0,2 s nei test e in 0,6 s sul Galaxy (benchmark della Fase 0).

**Da verificare o con limiti**
- **Personaggio**: la naturalezza dell'animazione dipende dal volto. È da giudicare con le anteprime, ed esiste il ripiego "presenza".
- **Quadri scuri** (*Ronda*, *Zattera*): in sala serve buona luce.
- **iPhone**: nessuna prova.

**Come scegliere l'esperienza per un quadro reale**

| Il quadro ha… | Esperienza consigliata |
|---|---|
| una storia da raccontare, o è scuro o uniforme | racconto |
| poche figure o oggetti grandi e ben distinti | dettagli |
| tante piccole scene o simboli sparsi | caccia |
| un volto grande, frontale o di tre quarti, ben illuminato | personaggio |

## Come lo Studio calcola l'idoneità (euristica)

- **Racconto**: sempre 100%, perché funziona con qualsiasi quadro ed è il ripiego universale.
- **Dettagli**: cresce con il numero di particolari segnati e con quanti di essi hanno abbastanza punti per essere riconosciuti da vicino (≥ 250).
- **Caccia**: 18% per ogni elemento nascosto segnato (ne servono almeno 3), fino a 100%.
- **Personaggio**: 60% se il volto viene trovato da solo (20% se no), più 4% per ogni domanda scritta, fino a 100%. Prima di "Prepara" non si può sapere: serve un volto grande, frontale o di tre quarti, ben illuminato.

Limiti dell'euristica:
- I "punti" misurano la texture dell'immagine digitale, non la tela in sala (luce, riflessi, distanza).
- MindAR calcola i punti sul ritaglio ingrandito, quindi anche particolari scuri (lo scudo della *Ronda*) superano la soglia: un punteggio alto è necessario ma non sufficiente.
- La prova sul posto resta indispensabile.
