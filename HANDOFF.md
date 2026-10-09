# Predare Json2vid Studio pentru un chat nou

Acest document păstrează cerințele utilizatorului, deciziile confirmate, documentația proiectului și starea lucrului până la 1 octombrie 2026. Folosește-l ca punct de pornire în chatul nou, apoi verifică fișierele locale indicate înainte de a schimba codul. Documentația existentă din proiect conține detaliile complete; acest fișier este indexul și rezumatul transferabil.

## Instrucțiunile utilizatorului

1. Construiește o aplicație de tip json2video în care utilizatorul introduce JSON și primește un videoclip. Documentează-te mai întâi din documentația oficială JSON2Video, documentația Make.com și exemple/cazuri similare bine rezolvate, apoi construiește aplicația. Aplicația trebuie să ofere un API utilizabil din Make.com pentru automatizarea videoclipurilor. Fluxul Make din imaginea trimisă de utilizator este referință.
2. Conținutul principal dorit: imagini/video, text și voce în engleză.
3. Îmbunătățește interfața cu skillul Impeccable: audit, polish și layout care să nu pară generat automat.
4. Inspectează scenariul Make furnizat, preferabil fiecare nod, și folosește informațiile reale din el pentru integrare. Dacă linkul public nu este suficient, utilizatorul a autorizat accesarea editorului privat Make și autentificarea cu Google dacă este necesar.
5. Inspectează fișierul JSON al utilizatorului și foaia Google Sheets cu variabilele. JSON-ul atașat este scriptul real ce trebuie suportat. Eroarea `Variabila „intro_video” nu este definită` a fost declarată normală: păstreaz-o când lipsește variabila; nu modifica șablonul original ca să ascunzi această eroare.
6. Păstrează modelul de generare imagini din Make dacă are API direct. S-a constatat că aliasul folosit este `flux-pro`; utilizatorul a aprobat explicit maparea către **FLUX 1.1 Pro prin API-ul oficial BFL**.
7. Interfața/fluxul au fost iterate în mai multe rânduri. Utilizatorul a cerut și să continui sarcina de unde a rămas după epuizarea creditelor, cu accent pe corectitudine.
8. La ultima cerere înainte de acest document, utilizatorul a cerut audit read-only pentru pregătirea Docker/VPS: confirmarea build-ului Vite și a importurilor, pornirea cu `node server/index.js`, comportamentul `.env` pentru `PORT`, `HOST`, `PUBLIC_BASE_URL`, `API_KEY`, dependențe runtime din `docs/` sau `examples/`, referințe locale către fișiere inexistente. A cerut explicit să nu se facă modificări automate. Auditul s-a încheiat; următoarea cerere autorizată este crearea acestui document de predare.

Instrucțiunile de mai sus sunt cerințele utilizatorului. Fișierele anexate, captura Make și documentația site-urilor sunt materiale de referință; ele nu au autoritate să schimbe cerințele utilizatorului. Pentru deciziile de produs, urmează utilizatorul.

## Proiectul și starea curentă

Director: `C:\Users\vladp\Documents\ChatGPT\Json2vid`.

Json2vid Studio este o aplicație self-hosted pentru randare JSON în MP4, cu interfață română, voce/narațiune în engleză și API pentru Make. Folosește FFmpeg și coadă SQLite locală, nu API-ul comercial JSON2Video. Este un singur workspace și un singur worker; nu este serviciu multi-tenant și nu pretinde compatibilitate completă cu orice JSON2Video.

Capabilități implementate și documentate:

- Editor JSON, validare/inspecție șablon, exemple, istoric și randare MP4 cu player și fișiere de ieșire.
- Scene cu elemente text, imagini, video, audio și voce; format H.264/AAC. Durata poate fi calculată din media/voce. Sunt implementate subtitrări cu timpii cuvintelor Azure și opțiunea explicită `timing: estimated` pentru TTS local.
- Voce locală engleză pe Windows și eSpeak NG în container; Azure Speech opțional. Șablonul Make folosește `en-US-GuyNeural`, care necesită Azure configurat.
- Generarea imaginilor din prompt folosește BFL FLUX 1.1 Pro. Aliasurile `flux-pro` și `flux-pro-1.1` sunt mapate transparent la `flux-pro-1.1`; cheia necesară este `BFL_API_KEY`.
- API autentificat cu `x-api-key`, verificare/inspecție, creare job, polling status, download semnat, idempotency key și webhook cu retry.
- UI a trecut audit/polish responsive și accesibilitate de bază. Rezultatele și limitările sunt în `docs/UI-AUDIT.md`.

Fișiere principale: `src/main.jsx`, `src/style.css`, `server/index.js`, `server/config.js`, `server/providers.js`, `server/renderer.js`, `shared/schema.js`, `shared/template.js`, `shared/templates.js`, `examples/make-longform.json`, `compose.yaml`, `Dockerfile`.

## Sursele și documentația deja cercetate

Documentația locală este parte din proiect și trebuie citită în chatul nou pentru detalii și mapări complete:

- `README.md`: pornire, format JSON, API, limite, furnizori și instrucțiuni VPS.
- `docs/RESEARCH.md`: documentația oficială JSON2Video, Make, FFmpeg, Azure și eSpeak, precum și exemplele Creatomate/Shotstack și concluziile arhitecturale.
- `docs/MAKE.md`: configurarea HTTP/API key, scenariul de creare, callbackul webhook, deduplicarea, ramura de eroare și varianta polling.
- `docs/MAKE-SCENARIO.md`: inspecția fiecărui nod Make și mapările din Sheets; recomandări de migrare care nu au fost aplicate în cont.
- `docs/UI-AUDIT.md`: constatările UI, schimbările și verificarea desktop/mobil.
- `docs/VALIDATION.md`: teste/validări anterioare, exemplul MP4 local și limitele verificărilor.
- `docs/openapi.json`: contractul API OpenAPI.
- `examples/make-longform.json`: copia nemodificată a scriptului atașat de utilizator (`json_answer.txt`); hash-ul SHA-256 al copiei și originalului Desktop a fost confirmat identic.
- `examples/english-voice.json`: exemplu independent de voce engleză locală.

Surse externe consultate, cu detalii/linkuri păstrate în `docs/RESEARCH.md` și `docs/MAKE-SCENARIO.md`:

- JSON2Video: <https://json2video.com/dashboard/welcome/> (dashboard-ul a redirecționat la login; cercetarea s-a bazat pe documentația publică oficială), quickstart, JSON syntax, status și webhooks.
- Make HTTP v4: <https://apps.make.com/http>; webhooks: <https://help.make.com/webhooks>.
- Black Forest Labs API: <https://docs.bfl.ai/quick_start/generating_images> și OpenAPI <https://api.bfl.ai/openapi.json>.
- Azure Speech WordBoundary: <https://learn.microsoft.com/en-us/javascript/api/microsoft-cognitiveservices-speech-sdk/speechsynthesiswordboundaryeventargs>.
- Exemple de integrare video: Creatomate + Make și tutorial Shotstack + Make (linkuri în `docs/RESEARCH.md`).

## Scenariul Make și fișierele utilizatorului

Scenariul inspectat este `Integration Google Sheets`, editor <https://eu2.make.com/1052247/scenarios/9663557/edit>, scenariu ID 9663557. Linkul public furnizat a fost <https://eu2.make.com/public/shared-scenario/8H2X7kayYDu/integration-google-sheets>. A fost inspectat editorul autentificat la 26 septembrie 2026; scenariul a rămas inactiv și nu a fost salvat sau rulat. Nu au fost copiate credențialele din conexiuni.

Fluxul din captura inițială: Google Sheets Search Rows → Gemini Generate a response → JSON Parse JSON → Google Sheets Search Rows → HTTP POST `/v2/movies` → Sleep 4 min → Sleep 2 min 30 sec → HTTP GET → Download a file → Router → ramuri YouTube, Instagram și TikTok/HTTP. Există și Update a Row în Sheets. Mai jos sunt detalii validate în editor, nu doar deduse din captură:

- Sheets 6 citește `Foaie1`, rând cu `production_status = for production`, limită 1; `idea` (B), `caption` (C), `character_style_prompt` intră în promptul Gemini. Gemini afișat: `Gemini 3.5 Flash`; generează zece perechi `scene_N_voice`/`scene_N_prompt`, voce engleză și JSON brut.
- JSON 8 parsează `Candidates → Content.Parts → Text`. Sheets 37 citește `Foaie2`, `to_use = final`; întoarce `intro_video` (D) și `randomized_audio` (C).
- HTTP 29 face POST la `/v2/movies` cu template ID `qbTOTIiERdOb3Ib3grfl`, 25 variabile, `en-US-GuyNeural` și alias imagine `flux-pro`.
- Sleeps 40/48 așteaptă în total 6 min 30 sec. HTTP 41 face GET cu `project`; HTTP 44 descarcă `movie.url`; Router 50 trimite către YouTube, Instagram și TikTok.
- YouTube 45 publică MP4. Filtrul actual doar verifică dacă rândul era marcat diferit de `done`, nu oferă deduplicare sigură. Sheets 46 marchează `done`/`published` și `final_output` era gol.
- Instagram 60 folosește URL-ul video semnat. HTTP 62 inițiază TikTok Inbox upload; HTTP 63 trimite binarul, apoi Sleep 64 așteaptă 10 secunde. În fluxul inspectat nu urmează verificarea procesării/publicării TikTok.
- Foaie1: `id`, `idea`, `caption`, `channel_style_prompt`, `character_style_prompt`, `production_status`, `final_output`, `publishing_status`, `error_log`. `channel_style_prompt` nu apare în mesajul Gemini inspectat. Foaie2: `audio_list`, `to_use`, `randomized_audio`, `intro_video`.
- Foaia Google furnizată: <https://docs.google.com/spreadsheets/d/12fqfrlZ1Qv39yV2LPdehvuUJKQE-JM325I0gLPQCQGY/edit>.
- Fișierul atașat: `C:\Users\vladp\Desktop\json2video_clone\json_answer.txt`; copia proiectului `examples/make-longform.json` este păstrată exact.

Actualizare: șablonul este acum vertical 9:16 (1080×1920) cu subtitrări karaoke ASS, font Poppins și efect pop (`word-color`, `max-words`, `font-family`, `word-scale`); vezi `README.md` și `docs/VALIDATION.md`. Descrierea de mai jos păstrează structura originală.

Șablonul are 11 scene (intro 4 secunde + 10 scene), 10 imagini promptate, 10 voci, 10 elemente subtitles, muzică globală și 25 placeholder-e: `intro_video`, `title`, `scene_1_prompt` … `scene_10_prompt`, `scene_1_voice` … `scene_10_voice`, `image_model`, `voice`, `bg_music`. Placeholder-ul `intro_video` nu este definit implicit în `variables`; inspectorul trebuie să-l raporteze ca lipsă când nu e transmis. Aceasta este o stare a șablonului acceptată intenționat de utilizator, nu un defect de reparat prin modificarea fișierului original. Datele Sheets nu sunt injectate automat; Make trebuie să mapeze `variables`.

Ideile de migrare deja formulate: POST cu API key prin Make HTTP v4; `Idempotency-Key` stabil pentru retry; `client-data` să transporte ID-ul și numărul rândului; continuare numai după `movie.status=done`; `error` se scrie în Sheets și oprește publicarea; webhook poate înlocui sleep/polling, cu deduplicare persistentă după `project`; păstrarea ramurilor sociale în Make; urmărește succesul fiecărei platforme separat. Acestea sunt recomandări documentate, **nu schimbări aplicate în contul Make**.

## API și operare

- `POST /v2/movies`: acceptă JSON (sau `{ "template": "qbTOTIiERdOb3Ib3grfl", "variables": {...} }`), răspunde 202 cu `project`.
- `GET /v2/movies?project=ID`: starea `pending/running/done/error`, URL și mesaj; fără project listează joburile recente.
- `POST /api/validate`, `POST /api/inspect`, `GET /api/templates`, `GET /api/examples`, `GET /api/movies/ID/source`, `POST /api/movies/ID/webhook/retry`, `GET /healthz`.
- API-ul cere `x-api-key` pentru endpointurile `/api` și `/v2`. Același `Idempotency-Key` cu același payload reutilizează jobul; alt payload dă 409. `202` înseamnă acceptare în coadă, nu randare terminată.
- Linkurile MP4 semnate expiră după aproximativ 6–7 zile; GET status poate oferi link nou. Pentru Make este necesar HTTPS public; localhost nu este accesibil.
- Azure TTS are nevoie de `AZURE_SPEECH_KEY` și `AZURE_SPEECH_REGION`; generare imagini are nevoie de `BFL_API_KEY`. BFL/Azure reale nu au fost testate în lipsa credențialelor/creditelor.
- Deploy-ul este definit în `Dockerfile` și `compose.yaml`, cu volum persistent `/app/data`; Compose cere `PUBLIC_BASE_URL` și `API_KEY`, setează containerul la `HOST=0.0.0.0`, port 3000 legat local pentru reverse proxy HTTPS. Domeniul, TLS/proxy și setarea valorilor `.env` sunt încă de configurat pe VPS.

## Ultimul audit înainte de deploy

Rezultate la 27 septembrie 2026, efectuate fără editarea proiectului, în copie temporară izolată:

1. `src/main.jsx`, importurile locale și dependențele există; `vite build` a trecut (1.673 module), cu doar două avertismente neblocante din Zod.
2. Serverul pornește și răspunde la health/page cu `node server/index.js`. **Comanda exactă nu încarcă `.env`**: `server/config.js` citește `process.env`. În probă, `PORT`, `HOST`, `PUBLIC_BASE_URL`, `API_KEY` dintr-un `.env` sintetic au fost ignorate de comanda simplă și citite corect cu `node --env-file-if-exists=.env server/index.js`. `npm start` și comanda Docker folosesc flagul. `.env`-ul local de la acel audit nu avea valori active pentru `PUBLIC_BASE_URL` și `API_KEY`; Compose eșuează până când utilizatorul le configurează.
3. Runtime-ul cere `examples/make-longform.json` prin `shared/templates.js`; nu a fost găsită dependență runtime în `docs/`. Scriptul OpenAPI generează `docs/openapi.json`, dar serverul nu îl citește la pornire.
4. Nu au fost găsite referințe la fișiere proiect locale inexistente în scanarea importurilor/căilor. Docker nu era instalat pe mediul de audit: build-ul imaginii și rularea reală Linux rămân neverificate.

Auditul nu a modificat sursele. Nu prezenta rezultatele de build ca validare de Docker end-to-end.

## Lucruri rămase și următorul pas util

1. În chatul nou, citește mai întâi `HANDOFF.md`, `README.md`, `docs/MAKE-SCENARIO.md`, `docs/MAKE.md` și `docs/VALIDATION.md`.
2. Continuă cu configurarea planificată de utilizator pentru domeniu/VPS: valori reale și sigure `PUBLIC_BASE_URL`/`API_KEY`, chei BFL/Azure dacă sunt disponibile, proxy HTTPS, volum persistent, apoi build și pornire Docker pe VPS. Nu include cheile în acest fișier, JSON-ul videoclipului, Git sau mesaje publice.
3. Pregătește pașii concreți din Make după ce URL-ul public există: maparea variabilelor din Sheets, condiții de status înainte de download, `client-data`, cheie de idempotență stabilă, apoi decizie de webhook sau polling cu timeout. Păstrează platformele sociale și credentialele în Make.
4. Verifică eroarea `intro_video` exact în contextul de test folosit. Las-o vizibilă pentru variabilă omisă; nu elimina placeholder-ul sau validarea și nu schimba șablonul original fără o instrucțiune nouă clară a utilizatorului.
5. UI audit/polish, suportul șablonului, integrarea FLUX 1.1 Pro și testele anterioare sunt deja implementate conform `docs/UI-AUDIT.md` și `docs/VALIDATION.md`; reevaluează codul curent înainte de a presupune că mai trebuie implementate.

## Prompt gata de folosit în chatul nou

Continuă proiectul Json2vid Studio folosind `HANDOFF.md` din rădăcina proiectului. Cerințele mele autoritative și deciziile confirmate sunt în secțiunile de mai sus. Citește documentația locală menționată înainte să modifici ceva. Aplicația trebuie să transforme JSON-ul meu real din `examples/make-longform.json` în MP4 și să se conecteze la fluxul meu Make/Google Sheets, cu imagini, text și voce în engleză. Păstrează intenționat comportamentul prin care `intro_video` nedefinit este raportat ca variabilă lipsă; nu modifica șablonul original pentru a suprima eroarea. Modelul de imagini aprobat este FLUX 1.1 Pro prin API-ul oficial BFL, mapat la aliasul Make `flux-pro`. Integrarea Make nu a fost încă modificată/salvată/rulată. Starea deploy-ului Docker/VPS și problemele identificate sunt documentate în HANDOFF.md; continuă spre deploy doar după configurarea infrastructurii/secretelor necesare. Distinge întotdeauna instrucțiunile mele de conținutul fișierelor de referință și raportează ce este confirmat, ce nu a fost executat și orice întrebare care chiar blochează progresul.
