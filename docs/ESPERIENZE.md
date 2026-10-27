# Esperienze per quadro

Questa tabella viene aggiornata a ogni fase. Alla fine dell'MVP dirà che cosa ha funzionato sui 6 quadri di esempio, per guidare la scelta dei quadri reali.

| # | Quadro | Esperienza | Stato | Consiglio e motivazione | Rischi |
|---|---|---|---|---|---|
| 4 | Van Eyck, *Arnolfini* | dettagli | Fase 0: riconoscimento + 2 particolari (specchio, cagnolino). Contenuti dei particolari nella Fase 2 | Molti particolari piccoli e ben documentati. Quadro intero: 2180 punti; specchio 2271; cagnolino 1571 | Particolari piccoli: da lontano solo col mirino |
| 6 | Géricault, *Zattera della Medusa* | racconto | **Fase 1: completo** (voce DEMO, sottotitoli, camera sincronizzata, parallasse) | Racconto naturale dal primo piano alla nave lontana. Nonostante la tela scura: 3725 punti, riconosciuto in 0,2-0,4 s nei test simulati e in 0,5 s con la fotocamera simulata dello Studio | Tela scura e riflessi in sala: da verificare dal vero. Annerimento da bitume |

## Come lo Studio calcola l'idoneità (euristica)

- **Racconto**: sempre 100%, perché funziona con qualsiasi quadro ed è il ripiego universale.
- **Dettagli**: cresce con il numero di particolari segnati e con quanti di essi hanno abbastanza punti per essere riconosciuti da vicino (≥ 250).
- **Caccia, Personaggio**: verranno calcolate nelle Fasi 3 e 4.

Limiti dell'euristica: i "punti" misurano la texture dell'immagine digitale, non la tela in sala (luce, riflessi, distanza). Un punteggio alto è necessario ma non sufficiente: la prova sul posto resta indispensabile.
