# Integrarea cu Make.com

Documentație oficială consultată: [HTTP v4](https://apps.make.com/http), [Custom webhooks](https://help.make.com/webhooks). Ai nevoie de o adresă publică HTTPS a acestui server; localhost nu poate fi apelat de Make.

## Scenariul A — creare

Păstrează modulele Sheets6 → Gemini7 → Parse JSON8 → Sheets37. Configurația fiecărui nod a fost inspectată în cont: [mapările exacte](MAKE-SCENARIO.md). Șablonul `qbTOTIiERdOb3Ib3grfl` este inclus local și acceptă același obiect `variables` din HTTP29. Eroarea pentru intro_video nedefinit rămâne validă în șablonul gol.

Configurează modulul HTTP de creare:

| Câmp | Valoare |
| --- | --- |
| Module | HTTP → Make a request |
| Authentication type | API key |
| Credentials | O cheie nouă cu plasare în header și nume `x-api-key`; valoarea din Json2vid → API & Make |
| URL | `https://DOMENIUL-TAU/v2/movies` |
| Method | POST |
| Body content type | application/JSON |
| Body input | JSON string sau Data structure; mapează JSON-ul valid al filmului |
| Parse response | Yes |
| Header opțional | `Idempotency-Key`: de exemplu `sheet-123-row-42-v1` |

Cheia de idempotență trebuie să fie stabilă la reîncercarea aceluiași job și diferită pentru o versiune nouă. Nu folosi un timestamp nou pentru fiecare retry. Același ID cu alt payload produce 409.

Adaugă la rădăcina filmului:

```json
{
  "client-data": { "sheet_row": 42, "title": "My video" },
  "webhook_url": "https://hook.eu1.make.com/URLUL_TAU_REAL"
}
```

Fragmentul de mai sus se combină cu `scenes` și celelalte câmpuri ale filmului. Folosește modulul JSON pentru escaparea corectă a textului provenit din Gemini; evită concatenarea manuală de ghilimele. Nu include instrucțiuni, fences Markdown sau text în afara JSON-ului. În Google Sheets poți salva `project` din răspunsul 202, dar corelarea din callback trebuie să se bazeze pe `client-data` pentru a evita o cursă între salvare și finalizare.

## Scenariul B — finalizare și distribuire

1. Creează **Webhooks → Custom webhook**. Copiază adresa în `webhook_url` din scenariul A. Activează „Run once”, apoi trimite un job de test ca Make să învețe structura.
2. Callbackul are `event`, `success`, `project`, `movie.status`, `movie.url`, `movie.message` și `movie.client-data`.
3. Adaugă o cheie de deduplicare pentru `project` într-un Data Store/registru persistent. Callbackurile pot fi repetate; nu publica de două ori același videoclip. Stochează separat starea fiecărei platforme dacă o ramură reușește și alta eșuează.
4. Ramura de succes: filtru `movie.status = done` și URL nevid → **HTTP → Download a file**, URL=`movie.url` → Router către modulele de publicare existente.
5. YouTube primește fișierul descărcat. Pentru modulul Instagram care așteaptă un URL, mapează URL-ul semnat public, nu conținutul binar. Păstrează logica autorizării și încărcării TikTok din scenariul tău.
6. Actualizează rândul Sheets indicat de `movie.client-data.sheet_row`, cu ID-ul jobului, linkul și rezultatele platformelor.
7. Ramura de eroare: filtru `movie.status = error` → salvează `movie.message` în Sheets și oprește publicarea.

Răspunde rapid 2xx la primirea callbackului. Serverul reîncearcă maximum 5 ori după erori; verifică webhook state în istoric. Un răspuns 2xx confirmă primirea în Make, nu publicarea pe platformele sociale. Folosește tratarea erorilor Make pentru pașii ulteriori.

Linkul de descărcare expiră în aproximativ 6–7 zile. Dacă ai nevoie de el mai târziu, cere statusul din nou cu cheia API. Pentru păstrare permanentă, descarcă MP4-ul sau mută-l în spațiul tău de stocare.

## Varianta cu un singur scenariu și polling

Înlocuiește HTTP GET existent cu `https://DOMENIUL-TAU/v2/movies?project={{project}}`, autentificat identic. `movie.status`:

- `pending` / `running`: așteaptă și verifică din nou, cu un număr maxim de încercări/termen limită.
- `done`: descarcă `movie.url`.
- `error`: salvează `movie.message`, fără a apela publicarea.

Nu lega descărcarea direct după un Sleep fără verificarea stării. În cazul expirării termenului tău, marchează procesul pentru verificare; nu retrimite POST cu altă cheie de idempotență dacă nu dorești un videoclip nou.

## Securitatea notificării

URL-ul Custom webhook este un secret: nu îl publica. Serverul poate semna corpul JSON cu HMAC-SHA256 în headerul `x-json2vid-signature` dacă setezi `WEBHOOK_SIGNING_SECRET`. Pentru verificare simplă în Make, recitește statusul din API folosind `project` și cheia ta, apoi folosește datele acelui răspuns. Nu confunda existența câmpului `success` cu autenticitatea expeditorului.

Nu este nevoie să controlezi Make prin API-ul său administrativ pentru acest flux: modulul HTTP apelează API-ul aplicației, iar Custom webhook primește rezultatul. Contul a fost accesat pentru inspecție. Configurația nodurilor nu a fost salvată sau rulată; migrarea URL-urilor și publicarea HTTPS rămân de făcut după configurarea serverului public.
