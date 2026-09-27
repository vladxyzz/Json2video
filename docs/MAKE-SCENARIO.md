# Scenariul Make inspectat

Verificat în editorul autentificat la 26 septembrie 2026: [Integration Google Sheets](https://eu2.make.com/1052247/scenarios/9663557/edit). Scenariul a rămas inactiv; nu s-a apăsat Run sau Save. Nu s-au copiat acreditările din conexiuni în aplicație.

## Nodurile și mapările

| Nod | Configurație observată | Legătura cu aplicația |
| --- | --- | --- |
| Google Sheets 6 · Search Rows | Foaie1, A–Z, antet; production_status = `for production`; limită 1 | `idea (B)` devine title, caption (C) descrierea; rândul trebuie păstrat pentru callback |
| Google Gemini AI 7 | Model afișat `Gemini 3.5 Flash`; mesajul folosește idea, caption, character_style_prompt | Produce 10 perechi scene_N_voice / scene_N_prompt; instrucțiunea cere narațiune în engleză, 15–25 cuvinte, JSON brut |
| JSON 8 · Parse JSON | Candidates → Content.Parts → Text din Gemini | Cele 20 câmpuri de scenă se mapează în variables |
| Google Sheets 37 · Search Rows | Foaie2, A–Z, antet; to_use (B) = `final`; limită 1 | intro_video (D), randomized_audio (C) |
| HTTP 29 · POST | `/v2/movies`, JSON string, răspuns parsabil, header x-api-key | `template: qbTOTIiERdOb3Ib3grfl`; 25 variabile, voce `en-US-GuyNeural`, model `flux-pro` |
| Tools 40 · Sleep | 240 secunde | Așteptare fixă după POST |
| Tools 48 · Sleep | 150 secunde | Încă 2m30s; total 6m30s |
| HTTP 41 · GET | `/v2/movies?project=trim(29.data.project)`, aceeași autentificare | Contractul aplicației păstrează `movie.status`, `movie.url`, `movie.message` |
| HTTP 44 · Download a file | URL = 41.data.movie.url | Descarcă fișierul pentru YouTube/TikTok |
| Router 50 | 3 rute în ordinea YouTube, Instagram, TikTok | Randarea este comună; rezultatele publicării trebuie urmărite separat |
| YouTube 45 · Upload a Video | Titlu idea (B), fișier HTTP44, Film & Animation, Public; caption + #shorts #viral #fyp #funny #story; made for kids No; altered/synthetic No | Primește MP4 H.264 + AAC. Setările de publicare rămân în Make |
| Filtru Doar noi idei | 6.production_status != `done`, între YouTube și Sheets46 | Verifică valoarea citită inițial, după upload; nu deduplică publicarea |
| Google Sheets 46 · Update a Row | Foaie1, Row number din6; production_status=`done`, publishing_status=`published`; final_output gol | Recomandat: completează final_output cu movie.url și păstrează project separat |
| Instagram 60 · Create a reel post | Video URL din41, caption + #reels #viral #fyp #funny #story, Share to Feed Yes | URL-ul semnat trebuie să fie public HTTPS. MP4 faststart, H.264, AAC128k,48kHz |
| HTTP 62 · POST TikTok | OAuth; `/v2/post/publish/inbox/video/init/`; FILE_UPLOAD; video_size și chunk_size = length(44.Data), total_chunk_count=1 | Creează uploadul în inbox, nu o confirmare de publicare finală |
| HTTP 63 · PUT | get(62.Data; data.upload_url), Content-Length=length(44.Data), Content-Range=bytes0…N-1/N; video/mp4; corp44.Data | Trimite binarul descărcat |
| Tools 64 · Sleep | 10 secunde | Nu apare un nod ulterior de verificare a procesării TikTok în scenariul inspectat |

Sursa Sheets: [documentul furnizat](https://docs.google.com/spreadsheets/d/12fqfrlZ1Qv39yV2LPdehvuUJKQE-JM325I0gLPQCQGY/edit). Foaie1 are coloanele id, idea, caption, channel_style_prompt, character_style_prompt, production_status, final_output, publishing_status, error_log. Cele două rânduri citite sunt done/published. Foaie2 are audio_list, to_use, randomized_audio, intro_video; rândul selectat are to_use=final, muzică Phantom Lane și intro Pexels. `channel_style_prompt` nu este folosit în mesajul Gemini observat.

## Șablonul și compatibilitatea

`examples/make-longform.json` este o copie nemodificată a fișierului json_answer.txt. Are 11 scene (intro4s +10 scene), 10 imagini, 10 voci, 10 subtitrări, muzică globală și 25 variabile. Nu definește variables. **Eroarea intro_video lipsește rămâne intenționat.** Valorile din Sheets nu sunt introduse automat în șablon.

ID-ul template din HTTP29 este înregistrat local cu acest fișier. Serverul acceptă atât JSON-ul complet cu variables, cât și `{template, variables}`. Metadatele id/comment/quality, font-size48px/34px, y85%, zoom10, fade-in/out sunt tratate de motor. Fără aspect-ratio explicit, rezultatul este landscape16:9, conform elementelor1920×1080. Nu se promite compatibilitate cu orice șablon extern JSON2Video.

Vocea explicită GuyNeural folosește Azure. Durata scenelor se calculează din fișierul audio generat; subtitrările cu același text folosesc evenimentele WordBoundary ale Azure. Pentru voce locală, `timing: estimated` trebuie cerut explicit, deoarece sincronizarea este aproximativă. Elementele video sunt fără sunetul original; folosește audio separat.

Modelul `flux-pro` este un alias în serviciul JSON2Video; implementarea sa internă exactă nu este expusă de nod. La verificare, API-ul actual BFL include `/v1/flux-pro-1.1`, iar vechiul FLUX.1 Pro este marcat deprecated de fal. Utilizatorul a aprobat explicit folosirea **FLUX1.1 Pro prin API oficial**, deci aplicația mapează transparent aliasul flux-pro la flux-pro-1.1. Imaginile sunt generate la dimensiuni acceptate de BFL (multipli32, maximum1440/axă), apoi încadrate în1920×1080 de FFmpeg; nu reprezintă generare nativă Full HD.

Surse: [BFL — generare și polling](https://docs.bfl.ai/quick_start/generating_images), [OpenAPI BFL](https://api.bfl.ai/openapi.json), [FLUX.1 Pro legacy](https://fal.ai/models/fal-ai/flux-pro/api), [Azure WordBoundary](https://learn.microsoft.com/en-us/javascript/api/microsoft-cognitiveservices-speech-sdk/speechsynthesiswordboundaryeventargs), [JSON2Video image](https://json2video.com/docs/v2/reference/json-syntax/element/image).

## Schimbările necesare când există un domeniu public

1. Configurează BFL_API_KEY, AZURE_SPEECH_KEY și AZURE_SPEECH_REGION în `.env`; repornește serverul. Cheia JSON2Video nu autentifică aceste servicii.
2. HTTP29 și HTTP41: schimbă baza URL în domeniul public al aplicației și x-api-key în cheia aplicației. Păstrează template și mapările variables.
3. Preferă un corp structurat în HTTP/JSON Create JSON, ca ghilimelele și liniile noi generate de Gemini să fie escapate corect.
4. Adaugă Idempotency-Key stabil (ID idee + versiune) și client-data cu row number și ID idee. Nu trimite un alt POST la fiecare verificare de status.
5. Înainte de HTTP44, continuă doar pentru `movie.status=done`. Pentru pending/running reîncearcă GET cu termen limită; pentru error salvează movie.message. Alternativ, înlocuiește așteptările cu webhook conform MAKE.md.
6. Păstrează YouTube/Instagram/TikTok în Make. După randare salvează final_output; marchează succesul fiecărei ramuri după confirmarea ei. Un upload TikTok în inbox nu înseamnă că postarea este publicată.

Acestea sunt instrucțiuni de migrare, nu modificări aplicate în contul Make. Nu s-a publicat nimic pe rețelele sociale.
