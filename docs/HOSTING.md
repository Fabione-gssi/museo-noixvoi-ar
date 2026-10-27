# Hosting: scelta e limiti

Limiti verificati il 27/10/2026 sulle pagine ufficiali (non da memoria).

## Scelta: GitHub Pages (repository pubblico)

Ci si arriva senza azioni manuali: il computer è già collegato a GitHub e la pubblicazione avviene da GitHub Actions a ogni modifica.

| Limite GitHub Pages | Valore | Effetto sul progetto |
|---|---|---|
| Dimensione del sito pubblicato | 1 GB | Obiettivo MVP < 120 MB: ampio margine |
| Banda | 100 GB/mese (limite "morbido") | ~800 visite complete al mese da 120 MB, molte di più perché si scarica un quadro alla volta (~2-6 MB) |
| Dimensione file | Nessun limite proprio delle Pages; Git rifiuta file > 100 MB e avvisa sopra 50 MB | Noi restiamo comunque ≤ 25 MB per file |
| Pubblicazioni | 10/ora (morbido), ma non vale con Actions personalizzate; timeout 10 min | Nessun problema |
| Visibilità | Con l'account gratuito il repository deve essere **pubblico** | Va bene per opere di pubblico dominio. Per foto di quadri reali coperte da diritti: rivalutare (vedi sotto) |

Fonte: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

## Alternativa: Cloudflare Pages

| Limite Cloudflare Pages (piano gratuito) | Valore |
|---|---|
| Dimensione file | **25 MiB** per file |
| Numero di file | 20.000 per sito |
| Build | 500/mese, una alla volta, timeout 20 min |
| Banda | non indicata nella pagina dei limiti |

Fonte: https://developers.cloudflare.com/pages/platform/limits/

Richiede un account Cloudflare e un codice di accesso (azione manuale). Permette un repository privato e il "caricamento diretto" di una cartella dal browser, utile se un giorno GitHub non fosse disponibile.

## Regola di progetto

Ogni file pubblicato ≤ 25 MB (il limite più stretto tra i due), così si può passare da un hosting all'altro senza modifiche.

## Quando rivalutare

Se le fotografie dei quadri reali non sono di pubblico dominio (es. foto fornite dal museo con diritti riservati), un repository pubblico le renderebbe scaricabili da chiunque. Opzioni: repository privato + Cloudflare Pages, oppure tenere le foto fuori dal repository e caricarle con il caricamento diretto.
