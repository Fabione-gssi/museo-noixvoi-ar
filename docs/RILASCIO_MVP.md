# Rilascio dell'MVP

Versione **1.0.0**, 29/10/2026. Sito: https://fabione-gssi.github.io/museo-noixvoi-ar/

## In sintesi

L'MVP è **pubblicato e completo nelle funzioni**:
- 6 quadri, ciascuno con la sua esperienza: racconto, dettagli, caccia e personaggio;
- Studio per gestirli senza scrivere codice;
- uso senza internet;
- cronologia delle versioni;
- pagina di prova `?debug=1`;
- cartellini con i QR.

**Non è ancora "accettato"**: due criteri richiedono prove che può fare solo una persona, sui telefoni veri e in sala (vedi sotto). Finché non sono fatte, è da considerare una **versione di prova**.

## Criteri di accettazione

| Criterio | Stato | Dettaglio |
|---|---|---|
| **(a)** I 6 quadri funzionano, ciascuno con la sua esperienza, su un iPhone e un Android reali | ⚠️ **In parte** | **Android (Galaxy A56), a schermo e su stampa**: confermati riconoscimento (Fase 0), racconto (Fase 1), dettagli (Fase 2) e caccia (Fase 3). **Non ancora provati su telefono**: personaggio (Fase 4) e uso senza internet (Fase 5). **iPhone: nessuna prova** (nessun iPhone disponibile): è il rischio principale. Su iOS Safari i punti delicati sono fotocamera, sblocco dell'audio, permesso del giroscopio e velocità del riconoscimento |
| **(b)** Dallo Studio, senza aiuto, aggiungere un settimo quadro, assegnargli un'interazione, caricare un video, vedere l'anteprima e pubblicare in meno di 20 minuti | ⏳ **Da provare** | Il percorso è coperto dai test automatici dello Studio: aggiungere, caricare, assegnare le 4 esperienze, anteprima, preparare. Il tempo e il "senza aiuto" li può misurare solo una persona: vedi DA_FARE_UTENTE.md, Fase 6 |
| **(c)** Rapporto di test onesto | ✅ | `docs/RISULTATI_TEST.md`: 52 test unitari e 52 test E2E superati, con la fotocamera simulata. Il rapporto dice chiaramente che non sostituiscono i telefoni veri. Le prove su telefono sono riportate fase per fase |
| **(d)** `docs/ESPERIENZE.md` aggiornato con cosa ha funzionato e cosa no | ✅ (da completare dopo la sala) | Aggiornato con i risultati di ogni fase. Dopo il test sul campo (`docs/TEST_SUL_CAMPO.md`) aggiungerò i risultati in sala |

## Prima di aprire al pubblico (lista di controllo)

1. **Prova su iPhone** di tutti e 6 i quadri (criterio a).
2. **Prova su Android** di personaggio e uso senza internet (criterio a).
3. **Quality gate del personaggio**: giudizio sulle anteprime di 5 secondi (`revisione/volto-*.mp4`). Se "inquietante", si passa a "Solo presenza".
4. **Prova dello Studio in 20 minuti** (criterio b).
5. **Test sul campo** in sala, con `docs/TEST_SUL_CAMPO.md`.
6. **Revisione dei testi**: tutti i `testo.txt`, le domande del personaggio, i punti e i riquadri in `revisione/`.
7. **Voce**: nell'MVP tutti i quadri hanno la voce sintetica DEMO. Per i quadri reali servono le registrazioni dell'attore. La sintesi o clonazione della sua voce è esclusa senza la tua approvazione esplicita.
8. **Quadri reali**: le foto dei quadri del museo vanno nello Studio. Con GitHub Pages gratuito il repository è pubblico: chiunque può scaricare immagini e testi. Rivaluta l'hosting (vedi `docs/HOSTING.md`) se le foto non devono essere pubbliche.
9. **Sale**: compila il campo "Sala" di ogni quadro (oggi è "da completare").
10. **Cartellini**: stampa `stampa/cartellini.pdf` e appendili accanto ai quadri, all'altezza degli occhi, in un punto senza riflessi.

## Cosa contiene la versione 1.0.0

| Parte | Stato |
|---|---|
| Esperienza **racconto** (*Zattera della Medusa*) | completa |
| Esperienza **dettagli** (*Ronda di notte*, *Arnolfini*) | completa |
| Esperienza **caccia** (*Proverbi fiamminghi*) | completa |
| Esperienza **personaggio** (*Dürer*, *Ginevra de' Benci*) | completa; animazione da approvare (quality gate) |
| **Studio**: quadri, testi, audio, video, editor delle 4 esperienze, anteprima con fotocamera simulata e sul telefono, verifica, pubblicazione, cronologia, Annulla | completo |
| **Uso senza internet** e installazione sulla schermata Home | completo |
| **Pagina `?debug=1`**: versione, stato del riconoscimento, target agganciato, fps, eventi, "Copia rapporto" | completa |
| **Cartellini** con QR (`stampa/cartellini.pdf`), rigenerati a ogni pubblicazione dallo Studio | completi |
| Conversazione libera con il personaggio | non prevista nella v1: `docs/ROADMAP_CONVERSAZIONE_LIVE.md` |

Peso: app 1,6 MB al primo avvio; 6 quadri in tutto circa 21 MB. Ogni quadro è sotto il limite di 6 MB.

## Documenti

- Per te: `DA_FARE_UTENTE.md`, `docs/GUIDA_STUDIO.md`, `docs/TEST_SUL_CAMPO.md`.
- Risultati e limiti: `docs/RISULTATI_TEST.md`, `docs/ESPERIENZE.md`, `docs/LIMITI_NOTI.md`.
- Altro: `docs/HOSTING.md`, `docs/ROADMAP_CONVERSAZIONE_LIVE.md`, `crediti.md`, `fonti.md`.
