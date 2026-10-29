# Crediti delle immagini

Tutte le immagini sono state scaricate da Wikimedia Commons il 27/10/2026 e sono di **pubblico dominio** (opere di autori morti da oltre 70 anni; riproduzioni fotografiche fedeli di opere bidimensionali).

## Contenuti dell'app

| Opera | Uso | Pagina della fonte | Licenza |
|---|---|---|---|
| Jan van Eyck, *Ritratto dei coniugi Arnolfini* (1434), National Gallery, Londra | quadro 04-arnolfini (originale 4386×6000 px) | https://commons.wikimedia.org/wiki/File:Van_Eyck_-_Arnolfini_Portrait.jpg | Public domain (credito su Commons: sito della National Gallery, Londra) |

| Albrecht Dürer, *Autoritratto con pelliccia* (1500), Alte Pinakothek, Monaco | quadro 01-autoritratto-durer (miniatura Commons a 3840 px, scaricata il 29/10/2026) | https://commons.wikimedia.org/wiki/File:Albrecht_D%C3%BCrer_-_1500_self-portrait_(High_resolution_and_detail).jpg | Public domain |
| Leonardo da Vinci, *Ritratto di Ginevra de' Benci* (1474-1478 circa), National Gallery of Art, Washington | quadro 02-ginevra-de-benci (miniatura Commons a 3840 px, scaricata il 29/10/2026) | https://commons.wikimedia.org/wiki/File:Leonardo_da_Vinci_-_Ginevra_de%27_Benci_-_Google_Art_Project.jpg | Public domain |
| Rembrandt, *La ronda di notte* (1642), Rijksmuseum | quadro 03-ronda-di-notte (miniatura Commons a 3840 px, cornice ritagliata) | https://commons.wikimedia.org/wiki/File:The_Night_Watch_-_HD.jpg | Public domain |
| Pieter Bruegel il Vecchio, *Proverbi fiamminghi* (1559), Gemäldegalerie, Berlino | quadro 05-proverbi-fiamminghi (miniatura Commons a 3840 px) | https://commons.wikimedia.org/wiki/File:Pieter_Brueghel_the_Elder_-_The_Dutch_Proverbs_-_Google_Art_Project.jpg | Public domain |
| Théodore Géricault, *La zattera della Medusa* (1818-1819), Louvre | quadro 06-zattera-medusa (originale 5872×4008 px) | https://commons.wikimedia.org/wiki/File:JEAN_LOUIS_TH%C3%89ODORE_G%C3%89RICAULT_-_La_Balsa_de_la_Medusa_(Museo_del_Louvre,_1818-19).jpg | Public domain (riproduzione fedele di opera bidimensionale in pubblico dominio; fonte indicata su Commons: sconosciuta) |

## Voce e modelli (usati solo sul computer, non nell'app)

| Cosa | Uso | Licenza |
|---|---|---|
| Voce Piper **it_IT-serena-medium** (addestrata sul dataset sintetico "serena-synthetic-it-27h" di committa) | Voce DEMO dei quadri dell'MVP. Non è la voce di una persona reale né un'imitazione | Dataset CC-BY-4.0 (https://huggingface.co/datasets/committa/serena-synthetic-it-27h), modello https://huggingface.co/rhasspy/piper-voices |
| Piper (motore di sintesi vocale, piper-tts 1.8) | Genera l'audio DEMO in locale | GPL-3.0: strumento usato solo offline, non distribuito con l'app; l'audio prodotto non è soggetto alla GPL |
| faster-whisper + modello Whisper "small" | Allinea le registrazioni vere al testo (sottotitoli) | MIT |
| cloudflared 2026.10.0 (Cloudflare, firmato) | Link di anteprima sul telefono dallo Studio (quick tunnel gratuito) | Apache-2.0 |
| MediaPipe Face Landmarker (modello `face_landmarker.task` e libreria @mediapipe/tasks-vision 1.1.0) | Trova occhi, bocca e mento dei personaggi (Fase 4) | Apache-2.0 (https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) |
| Depth Anything V2 Small (ONNX) | Mappa di profondità per la parallasse del racconto e del personaggio | Apache-2.0 (https://huggingface.co/depth-anything/Depth-Anything-V2-Small) |

## Assistente online (facoltativo, solo se collegato dallo Studio)

| Cosa | Uso | Licenza |
|---|---|---|
| Cloudflare Workers e Workers AI (piano gratuito) | Ospita l'assistente delle domande libere (`assistente/`) | Servizio gratuito di Cloudflare |
| Mistral Small 3.1 24B Instruct (`@cf/mistralai/mistral-small-3.1-24b-instruct`) | Modello principale dell'assistente | Apache-2.0 |
| Qwen3 30B A3B (`@cf/qwen/qwen3-30b-a3b-fp8`) | Modello di riserva | Apache-2.0 |
| Wrangler (strumento di Cloudflare, scaricato al momento con npx) | Pubblica l'assistente dallo Studio | MIT / Apache-2.0 |
| Voce italiana del telefono (sintesi vocale del sistema) | Legge le risposte libere | Del sistema operativo del visitatore, nessun file distribuito |

Quando nell'app si sente la voce DEMO, compare il badge "DEMO". Credito: "Voce sintetica: Piper, voce serena (dataset CC-BY-4.0 di committa)".

## Librerie dentro l'app

| Libreria | Uso | Licenza |
|---|---|---|
| three.js 0.186.1 | Grafica 3D, racconto, volto animato | MIT |
| MindAR 1.2.5 | Riconoscimento delle immagini | MIT |
| Fuse.js 7.5.0 | Domande scritte con errori di battitura (personaggio) | Apache-2.0 |

## Solo per il benchmark della Fase 0 (`public/bench/`, non sono contenuti dell'app)

| Immagine | Pagina della fonte | Licenza |
|---|---|---|
| Albrecht Dürer - Selbstbildnis im Pelzrock - Alte Pinakothek.jpg | https://commons.wikimedia.org/wiki/File:Albrecht_D%C3%BCrer_-_Selbstbildnis_im_Pelzrock_-_Alte_Pinakothek.jpg | Public domain |
| Caspar David Friedrich - Wanderer above the sea of fog.jpg | https://commons.wikimedia.org/wiki/File:Caspar_David_Friedrich_-_Wanderer_above_the_sea_of_fog.jpg | Public domain |
| Pieter Brueghel the Elder - The Dutch Proverbs - Google Art Project.jpg | https://commons.wikimedia.org/wiki/File:Pieter_Brueghel_the_Elder_-_The_Dutch_Proverbs_-_Google_Art_Project.jpg | Public domain |
| Mona Lisa, by Leonardo da Vinci, from C2RMF retouched.jpg | https://commons.wikimedia.org/wiki/File:Mona_Lisa,_by_Leonardo_da_Vinci,_from_C2RMF_retouched.jpg | Public domain |
| JEAN LOUIS THÉODORE GÉRICAULT - La Balsa de la Medusa (Museo del Louvre, 1818-19).jpg | https://commons.wikimedia.org/wiki/File:JEAN_LOUIS_TH%C3%89ODORE_G%C3%89RICAULT_-_La_Balsa_de_la_Medusa_(Museo_del_Louvre,_1818-19).jpg | Public domain |
| Leonardo da Vinci - Ginevra de' Benci - Google Art Project.jpg | https://commons.wikimedia.org/wiki/File:Leonardo_da_Vinci_-_Ginevra_de%27_Benci_-_Google_Art_Project.jpg | Public domain |
| Pieter Bruegel the Elder - Hunters in the Snow (Winter) - Google Art Project.jpg | https://commons.wikimedia.org/wiki/File:Pieter_Bruegel_the_Elder_-_Hunters_in_the_Snow_(Winter)_-_Google_Art_Project.jpg | Public domain |
| Sandro Botticelli - La nascita di Venere - Google Art Project - edited.jpg | https://commons.wikimedia.org/wiki/File:Sandro_Botticelli_-_La_nascita_di_Venere_-_Google_Art_Project_-_edited.jpg | Public domain |
| Las Meninas, by Diego Velázquez, from Prado in Google Earth.jpg | https://commons.wikimedia.org/wiki/File:Las_Meninas,_by_Diego_Vel%C3%A1zquez,_from_Prado_in_Google_Earth.jpg | Public domain |
| Van Gogh - Starry Night - Google Art Project.jpg | https://commons.wikimedia.org/wiki/File:Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg | Public domain |
| Eugène Delacroix - Le 28 Juillet. La Liberté guidant le peuple.jpg | https://commons.wikimedia.org/wiki/File:Eug%C3%A8ne_Delacroix_-_Le_28_Juillet._La_Libert%C3%A9_guidant_le_peuple.jpg | Public domain |
| John Constable - The Hay Wain (1821).jpg | https://commons.wikimedia.org/wiki/File:John_Constable_-_The_Hay_Wain_(1821).jpg | Public domain |
| 1665 Girl with a Pearl Earring.jpg | https://commons.wikimedia.org/wiki/File:1665_Girl_with_a_Pearl_Earring.jpg | Public domain |
| The Night Watch - HD.jpg | https://commons.wikimedia.org/wiki/File:The_Night_Watch_-_HD.jpg | Public domain |
