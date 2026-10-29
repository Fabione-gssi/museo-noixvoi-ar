# Roadmap: conversazione "dal vivo" con il personaggio

**Stato (29/10/2026): fatto un primo passo, su richiesta del museo.** Alle domande non previste il personaggio risponde con il testo completo del museo: ricerca del paragrafo sul telefono (`src/character/approfondimento.ts`) e, con internet, risposta breve di un modello open source su Cloudflare Workers AI (`assistente/`), vincolata ai paragrafi trovati. Il vincolo "nessuna AI esterna a runtime" è stato quindi allentato, solo per questa funzione e solo se l'assistente è collegato; gli altri restano (niente microfono, nessun dato personale raccolto, voce dell'attore solo per le risposte preparate). Il resto di questo documento è l'analisi fatta prima della decisione.

Verifica dei limiti: 29/10/2026, con ricerche web (fonti in fondo).

## Che cosa vorrebbe dire

Il visitatore scrive (o dice) qualsiasi cosa, e il personaggio risponde con frasi nuove, generate da un modello linguistico, restando fedele alle fonti del museo.

## Vincoli del progetto che oggi la escludono

| Vincolo | Perché blocca la conversazione dal vivo |
|---|---|
| Costo zero, nessun servizio a pagamento | I modelli nel cloud (API) costano a ogni domanda |
| Nessuna AI esterna a runtime | Anche un servizio gratuito invierebbe le domande a terzi |
| Nessun dato personale | Le domande libere possono contenere dati personali: inviarle fuori non è accettabile |
| Niente microfono nella v1 | Esclude la conversazione a voce; resterebbe solo il testo |
| Fedeltà alle fonti | Un modello generativo può inventare fatti ("allucinazioni") anche con istruzioni precise |
| Voce dell'attore | Le risposte nuove richiederebbero sintesi della voce dell'attore, che non è approvata |

## Strade possibili, con i limiti verificati

### 1. Modello sul telefono, dentro il browser

- **Chrome con Gemini Nano (Prompt API).** Sul computer funziona nelle versioni recenti di Chrome. Le fonti non concordano su quando sia diventato stabile per i siti web.
  - Android e iOS non sono supportati dal browser. Su Android esiste solo la strada delle app native (ML Kit/AICore).
  - Il modello pesa alcuni GB e richiede molta memoria.
  - Per usarlo bisogna accettare la policy di Google sugli usi vietati dell'AI generativa.
  - **Oggi non serve ai visitatori**, che usano il telefono.
- **Modelli piccoli con WebGPU (WebLLM, transformers.js, wllama).** Safari 26 attiva WebGPU anche su iPhone. Però una prova recente su iPhone ha fallito: un modello da ~1 miliardo di parametri ha scaricato centinaia di MB e poi si è bloccato o ha ricaricato la pagina. Altre prove ottimistiche non usano modelli linguistici.
  - Anche quando funziona, ogni visitatore dovrebbe scaricare 0,7-1 GB con i dati del museo o con i propri.
  - **Oggi non è affidabile sui telefoni.**

### 2. Modello su un server del museo

- Un piccolo computer in sala con un modello locale e la rete Wi-Fi del museo. Niente dati verso terzi.
- Costi: hardware, energia, manutenzione. Non è "costo zero" e va gestito da qualcuno.

### 3. Modello nel cloud

- Escluso dai vincoli (costi e dati inviati a terzi).

## Se un giorno si farà: come restare fedeli alle fonti

- **Risposte vincolate alle fonti** ("RAG"): il modello riceve solo i passaggi di `testo.txt` e delle fonti, e deve citarli.
- **Rifiuto quando non sa**: se nessun passaggio risponde, si torna al "non so" attuale.
- **Testo, non voce dell'attore**: oppure voce sintetica dichiarata e approvata.
- **Revisione**: registro anonimo delle domande senza risposta, per aggiungere nuove risposte preparate (nessun dato personale).

## Come è predisposta l'app

- `DialogEngine` (in `src/character/dialog.ts`) è l'interfaccia del dialogo: `suggestions()`, `ask(testo)`, `byId(id)`.
- Oggi la implementa `LocalQA` (risposte preparate + ricerca tollerante agli errori).
- Un motore "dal vivo" potrebbe implementare la stessa interfaccia senza cambiare schermate, animazione o Studio. Le risposte preparate resterebbero comunque come ripiego senza rete.

## Quando rivalutare

- Quando un modello piccolo funzionerà in modo affidabile nel browser di iPhone e di Android di fascia media, con un download accettabile (< 200 MB).
- Oppure se il museo decidesse di avere un server locale in sala.

## Fonti consultate (29/10/2026)

- Pasquale Pillitteri, "Gemini Nano in the Browser: Client-Side AI for Web Apps with Chrome 148 (2026)": https://pasqualepillitteri.it/en/news/3145/gemini-nano-chrome-built-in-ai-client-side-en
- CodeOfMario, "Gemini Nano in Chrome: a developer's guide to the browser's built-in AI APIs": https://codeofmario.com/blog/gemini-nano-in-chrome-a-developers-guide-to-the-browsers-built-in-ai-apis
- flaming.codes, "Chrome's Built-In AI: Gemini Nano and Prompt API Complete Guide": https://flaming.codes/posts/chrome-gemini-nano-built-in-ai
- Dev|Journal, "Google's Prompt API and the 4GB Gemini Nano Deployment" (6/5/2026): https://earezki.com/ai-news/2026-05-06-googles-prompt-api/
- Wikipedia, "WebGPU": https://en.wikipedia.org/wiki/WebGPU
- App Developer Magazine, "WebGPU in iOS 26": https://appdevelopermagazine.com/webgpu-in-ios-26/
- Hacker News, "WebGPU feature detection was not enough to run small LLMs on phones": https://hackernews-dynamic.seasondane.workers.dev/news/48624985
- Pinggy, "Run LLM in browser with WebGPU" (dimensioni dei modelli): https://pinggy.io/blog/run_llm_in_browser_webgpu/
