# Esperienze per quadro

Questa tabella viene aggiornata a ogni fase. Alla fine dell'MVP dirà che cosa ha funzionato sui 6 quadri di esempio, per guidare la scelta dei quadri reali.

| # | Quadro | Esperienza | Stato | Consiglio e motivazione | Rischi |
|---|---|---|---|---|---|
| 3 | Rembrandt, *Ronda di notte* | dettagli | **Fase 2: completo** (7 particolari con il loro pezzo di audio, voce DEMO) | Molte figure grandi e distinte: ritagli grandi. Quadro intero 2563 punti; particolari da 682 (scudo) a 1920 (bambina) | Tela molto scura: lo scudo e il cane sono poco leggibili anche a occhio. In sala serve luce buona |
| 4 | Van Eyck, *Arnolfini* | dettagli | **Fase 2: completo** (6 particolari: specchio, firma, lampadario, cagnolino, zoccoli, arance) | Particolari piccoli e densi: ottimo test per il mirino. Firma (1019 punti) trovata sia col mirino sia da vicino nei test | Quadro piccolo (82 × 60 cm): per avvicinarsi ai particolari bisogna stare molto vicini |
| 6 | Géricault, *Zattera della Medusa* | racconto | **Fase 1: completo** (voce DEMO, sottotitoli, camera sincronizzata, parallasse). Galaxy A56: tutto sì | Racconto naturale dal primo piano alla nave lontana. 3725 punti | Tela scura e riflessi in sala: da verificare dal vero |

## Come lo Studio calcola l'idoneità (euristica)

- **Racconto**: sempre 100%, perché funziona con qualsiasi quadro ed è il ripiego universale.
- **Dettagli**: cresce con il numero di particolari segnati e con quanti di essi hanno abbastanza punti per essere riconosciuti da vicino (≥ 250).
- **Caccia, Personaggio**: verranno calcolate nelle Fasi 3 e 4.

Limiti dell'euristica:
- I "punti" misurano la texture dell'immagine digitale, non la tela in sala (luce, riflessi, distanza).
- MindAR calcola i punti sul ritaglio ingrandito, quindi anche particolari scuri (lo scudo della *Ronda*) superano la soglia: un punteggio alto è necessario ma non sufficiente.
- La prova sul posto resta indispensabile.
