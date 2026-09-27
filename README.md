# Json2vid Studio

Aplicație funcțională pentru randare **JSON → MP4**, cu interfață în română și voce în engleză. Motor propriu FFmpeg; nu consumă API-ul JSON2Video.

## Pornire

Necesită Node.js 24 LTS. În directorul proiectului:

```sh
npm install
npm run build
npm start
```

Deschide http://localhost:3000. Pe Windows poți folosi și `start.cmd` după instalare. Cu pnpm: `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm start`. `pnpm-lock.yaml` fixează versiunile folosite și testate. `npm run dev` folosește Vite doar dacă `dist/` lipsește; vezi explicația de mai jos.

Serverul ascultă implicit numai pe `127.0.0.1`. Prima pornire creează o cheie aleatoare în `data/local-key`; studioul o preia numai pentru cereri loopback cu host localhost/127.0.0.1, fără origine publică configurată. În modul public cheia trebuie introdusă în UI și este ținută în sessionStorage până la închiderea filei. Nu pune cheia în JSON, în Git sau în URL.

## Ce funcționează

- Editor JSON, validare strictă, import/export și ciornă salvată în browser.
- Previzualizare schematică a fiecărei scene și player pentru MP4-ul real.
- Scene succesive; straturi de imagine, video, text; audio pe scenă sau peste tot filmul.
- Engleză TTS locală: voce Windows instalată; în container, eSpeak NG. Vocea locală este sintetică și mai puțin naturală decât Azure.
- Azure Speech opțional: `provider: "azure"`, cheia și regiunea doar pe server.
- Șablonul Make original inclus: `qbTOTIiERdOb3Ib3grfl`, 25 variabile inspectabile; acceptă `{template, variables}`.
- Imagini din prompt prin FLUX 1.1 Pro; aliasul `flux-pro` este mapat explicit cu acordul utilizatorului. Necesită BFL_API_KEY.
- Durate calculate din voce/media, fade-in/out, zoom, text cu umbră și subtitrări sincronizate cu vocea Azure.
- MP4 H.264 + AAC, imagine de copertă, descărcare și HTTP range pentru redare.
- Coada SQLite persistă pe disc. Un singur worker, un singur proces de server.
- API cu cheie, ID de job, progres, idempotență și webhook de succes/eroare.
- Webhook: maximum 5 încercări, cu pauze progresive; reluare manuală în istoric. Jobul rămâne finalizat chiar dacă webhook-ul eșuează.
- URL-uri semnate de descărcare, valabile aproximativ 6–7 zile. GET status produce linkuri proaspete. Fișierele rămân pe disc până când administratorul le arhivează/șterge.

Primul exemplu din editor are voce în engleză. Fișierul [examples/english-voice.json](examples/english-voice.json) este gata de folosit. Pentru imagini/video înlocuiește sau completează elementele cu propriile URL-uri HTTPS publice.

## Formatul JSON

```json
{
  "name": "English reel",
  "resolution": "hd",
  "aspect-ratio": "9:16",
  "fps": 30,
  "variables": { "title": "Make something great." },
  "client-data": { "sheet_row": 42 },
  "scenes": [{
    "duration": 6,
    "background-color": "#20282c",
    "elements": [
      { "type": "text", "text": "{{title}}", "font-size": 64, "color": "#c6f36b" },
      { "type": "voice", "provider": "local", "language": "en-US", "text": "Make something great. Your next story starts today." }
    ]
  }]
}
```

Pentru media: `{"type":"image","src":"https://your-cdn/photo.jpg","fit":"cover"}` sau `{"type":"video","src":"https://your-cdn/clip.mp4","seek":0}`. Audio: `{"type":"audio","src":"https://your-cdn/music.mp3","volume":0.2}`. URL-urile de exemplu trebuie înlocuite cu fișiere reale.

Dimensiuni: `hd`=1280 pe axa lungă, `full-hd`=1920, `sd`=640. Aspecte `9:16`, `16:9` (implicit), `1:1`. Width/height sunt numere în pixeli. `x` și `y` acceptă pixeli numerici, stringuri px sau procente și aliniere left/center/right respectiv top/center/bottom. `font-size` acceptă număr sau string px. Elementele târzii apar peste cele precedente. Textul acceptă style: shadow.

Durata scenei poate lipsi sau fi -1: se calculează din voce, audio, video sau durata explicită a unui element. O scenă numai cu text/imagine trebuie să specifice o durată. Cel mult 30 scene, 20 elemente/scenă, 300sec/scenă și 900sec total. Fiecare resursă externă are limita100MB. Durata explicită taie vocea/audio la spațiul disponibil. Clipurile video sunt **fără sunetul original**; folosește un element audio separat. Dacă sursa video se termină mai devreme, stratul dispare. Elementele cu -2 urmează părintele; -1/omis folosește media pentru calculul scenei, imaginile/textul urmează scena. Nu se adaugă automat variabile lipsă.

**Compatibilitate parțială cu JSON2Video**, verificată pentru șablonul furnizat. Nu sunt implementate ID-uri de șabloane externe arbitrare, exports/destinations, tranziții între scene, HTML sau componente. Subtitrările au text explicit și sunt sincronizate cu vocea Azure cu același text din scenă; nu transcriu fișiere audio arbitrare. Vocea locală necesită `timing: estimated` pentru subtitrări aproximative. Câmpurile necunoscute sunt respinse. `webhook_url` este convenția acestei aplicații. Previzualizarea este o schiță, imaginile generate și clipurile apar în MP4 după randare.

## API și Make

Vezi [ghidul Make](docs/MAKE.md) și [contractul OpenAPI](docs/openapi.json).
Inspecția fiecărui nod, mapările exacte și planul de migrare: [scenariul tău Make](docs/MAKE-SCENARIO.md). Copia nemodificată a șablonului: [make-longform.json](examples/make-longform.json).

| Endpoint | Funcție |
| --- | --- |
| `POST /v2/movies` | Creează job; răspuns 202, `project` |
| `GET /v2/movies?project=ID` | `movie.status`: pending / running / done / error |
| `GET /v2/movies` | Ultimele 100 de joburi |
| `POST /api/validate` | Validează fără randare |
| `GET /api/templates` | Șablonul inclus și variabilele sale |
| `POST /api/inspect` | Variabile definite/lipsă și numărul elementelor, fără interpolare |
| `GET /api/movies/ID/source` | JSON-ul jobului |
| `POST /api/movies/ID/webhook/retry` | Reprogramează notificarea |
| `GET /healthz` | Verificare simplă de disponibilitate |

Toate endpointurile de lucru cer `x-api-key`. `Idempotency-Key` pe POST previne duplicarea pentru același payload normalizat; același ID cu alt conținut returnează 409. Succesul POST înseamnă acceptare, nu finalizarea randării. Erori de validare: 422. Lipsă cheie: 401. Job necunoscut: 404. Coada plină: 429.

## Publicare pe un server

Make nu poate apela localhost. Ai nevoie de un server Linux/VPS cu Docker, un domeniu, HTTPS și volum persistent. Docker nu este instalat pe calculatorul pe care a fost construit proiectul; configurația containerului este livrată, dar nu a fost executată aici.

1. Copiază `.env.example` în `.env`. Setează `PUBLIC_BASE_URL=https://video.domeniul-tau.ro` și un `API_KEY` aleator de minimum 24 de caractere.
2. Pe server: `docker compose up -d --build`.
3. Configurează DNS spre server și un reverse proxy HTTPS, de exemplu Caddy, conform `Caddyfile.example`. Portul containerului este legat la loopback; numai proxy-ul trebuie expus pe internet.
4. Deschide domeniul, introdu cheia, generează un test și verifică endpointul din Make.

Recomandare operațională pentru început: 2 vCPU, 2–4 GB RAM, spațiu suficient pentru media. Este o estimare de pornire; consumul depinde de rezoluție, durată și straturi. Un singur server/proces; nu scala orizontal cu aceeași bază SQLite. Monitorizează spațiul pe disc, fă backup și stabilește retenția fișierelor înainte de producție intensă. Proxy-ul este responsabil de HTTPS. API-ul nu oferă conturi separate sau multi-tenancy.

### Voce Azure

Setează `AZURE_SPEECH_KEY` și `AZURE_SPEECH_REGION` în `.env`, repornește serverul și folosește:

```json
{"type":"voice","provider":"azure","language":"en-US","voice":"en-US-JennyNeural","text":"Your English voiceover goes here."}
```

Șablonul Make folosește `en-US-GuyNeural`; o voce numită explicit implică Azure dacă provider nu este specificat. Pentru voce locală folosește explicit provider: local. SDK-ul Azure furnizează și timpii cuvintelor pentru subtitrări. Nu a fost apelat serviciul plătit fără cheia utilizatorului. Windows/eSpeak funcționează local; nu se modifică politica PowerShell.

### Imagini FLUX

Completează `BFL_API_KEY` în `.env` și repornește serverul. Elementul `{ "type":"image", "model":"flux-pro", "prompt":"Your English image description", "zoom":10 }` folosește **FLUX1.1 Pro** prin api.bfl.ai. Serviciul primește doar promptul și dimensiunile imaginii. Rezultatul este descărcat și încadrat de FFmpeg. Modelul are costurile contului BFL; cheia JSON2Video nu poate fi reutilizată. API-ul refuză dinainte joburile AI dacă lipsesc cheile. Testele adapterului folosesc răspunsuri simulate; o probă live necesită chei și credite.

Un restart în timpul randării reia jobul; generările AI deja efectuate pot fi repetate. Idempotency-Key previne joburile duplicate la POST, nu garantează facturare unică în serviciile AI după întreruperea unui worker.

## Dezvoltare și verificări

```sh
npm test
npm run build
npm start
```

În lipsa `dist/index.html`, serverul folosește Vite middleware. Dacă `dist` există, servește build-ul existent: reconstruiește după modificări. Testele folosesc SQLite în directoare temporare și FFmpeg real; acoperă validare, autentificare, idempotență, descărcare semnată, persistență, media mixtă, audio, voce și retry webhook. Endpointurile nu acceptă shell/FFmpeg arbitrar. Sursele sunt descărcate cu HTTPS, DNS verificat și IP fixat pentru fiecare conexiune, cu adrese private blocate și limite de volum/timp. Media este tratată ca date neîncrezute.

Notele de cercetare și limitele comparației: [docs/RESEARCH.md](docs/RESEARCH.md).
