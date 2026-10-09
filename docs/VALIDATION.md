# Verificare — 26 septembrie 2026

- `node --test tests/*.test.js`: **13 / 13 teste trecute** (ultima execuție: aproximativ23s).
- `node node_modules/vite/bin/vite.js build`: build de producție reușit. Două avertismente neblocante despre comentarii de optimizare din dependența Zod; aplicația nu are erori de compilare.
- `git diff --check`: fără erori raportate.
- API testat cu cheie lipsă, JSON greșit, proprietăți/durate invalide, chei de idempotență identice și conflictuale, job necunoscut, media privată, link semnat modificat/expirat, download și cerere Range.
- Persistență testată după restart și reluarea unei randări marcate running înainte de repornire.
- FFmpeg real: imagine + video + text + audio pe scenă + audio global. Verificate pixeli roșii/albaștri în cadru și flux audio nenul. Testele media folosesc fișiere locale controlate printr-un downloader injectat numai în test; nu relaxează protecția HTTP a aplicației.
- Voce Windows în engleză sintetizată și integrată într-un MP4 real.
- Webhook: eroare temporară, păstrarea jobului done, reîncercare și livrare. Livrarea externă a fost simulată în test, fără trimitere către contul Make al utilizatorului.
- Browser: editor, navigare API & Make, randare pornită din UI, player video cu `readyState=4`, fără eroare media, redare efectivă (`paused=false`, timpul avansează), fără erori în consola browserului.
- Desktop și mobil 390 px: controale accesibile; documentul nu depășește lățimea viewportului. Timeline-ul și codul se pot derula în propriile panouri.

## Extensia pentru șablonul Make

- Copia `examples/make-longform.json` și originalul din Desktop au hash SHA-256 identic; originalul nu a fost modificat.
- Inspectorul găsește25 variabile, 10 imagini generate,10 voci și10 subtitrări. Cererea fără variables păstrează exact eroarea pentru intro_video. Cererea cu toate mapările se validează și normalizează în11 scene,1920×1080, voce Azure GuyNeural.
- Testele HTTP verifică listarea șablonului, inspectorul, validarea și refuzul unui job plătit când lipsesc cheile AI. `/api/config` confirmă versiunea1.1.0, FFmpeg ready, fluxImages=false, azureSpeech=false, publicReady=false în instalarea locală actuală.
- MP4 real cu durată calculată din fișierul vocii, imagine de test furnizată prin adapterul de generare, zoom10, fade-in/out și subtitrări arse în cadru. Verificări de pixeli: imaginea se luminează după fade-in; marginea reperului se deplasează în timpul zoomului; textul apare în zona inferioară.
- Adapterul FLUX a fost testat cu răspunsuri HTTP simulate: modelul aprobat flux-pro-1.1, dimensiuni1440×800 pentru un canvas1920×1080, polling și download, refuzarea unui polling_url pe domeniu străin. Nu se trimit chei către adrese arbitrare.
- Subtitrările folosesc offseturile vocii; lipsa timpilor produce o eroare explicită. Modul estimated este o alegere separată și aproximativă.
- Browser final: desktop1440×900 și mobil390×844 fără overflow orizontal; Tab părăsește editorul și ajunge la Format video. Pe mobil toate cele4 butoane de navigare au44px înălțime. Previzualizarea landscape și portret respectă raportul. Timeline-ul se termină la845px în viewportul desktop de900px. Consola: fără erori.
- Șablonul Make a fost încărcat din UI și inspectorul a afișat25 rânduri cu25 valori lipsă. Ciorna inițială a utilizatorului a fost restaurată după probă.

## Exemplu livrat

`data/renders/adc32391f5f3256e.mp4`: 12.02 s, H.264, 720×1280, 30 fps, AAC stereo la 48 kHz. Verificarea `volumedetect` raportează -23.9 dB mediu și -2.6 dB maxim. Două scene cu text și narațiune engleză locală, generate prin butonul din editor. Fișierul și SQLite sunt ignorate de Git și rămân în spațiul local al aplicației.

## Ce nu a fost executat

- Deploy Docker/Linux (Docker nu este instalat pe acest calculator).
- HTTPS public, modificarea efectivă a URL-urilor Make sau publicare în conturi sociale. Toate nodurile Make au fost inspectate în contul autentificat; scenariul nu a fost rulat sau salvat.
- Apeluri reale Azure Speech și Black Forest Labs: cheile lipsesc. Nu se revendică un test end-to-end cu aceste servicii plătite.
- Teste de încărcare pentru utilizatori multipli; aplicația este gândită pentru un singur workspace și un singur worker.

## Actualizare: format vertical și subtitrări karaoke

- `examples/make-longform.json` este acum vertical (`9:16`, `full-hd` ⇒ 1080×1920), cu subtitrări `word-color #FFD400`, `max-words 4`, `y 66%`. Contractul Make (25 variabile, `intro_video` nedefinit implicit) nu s-a schimbat.
- Teste noi: cue-uri karaoke (număr, indice `highlight`, fără goluri sau suprapuneri, cuvinte despărțite de voce), comportament identic fără `word-color`, validarea strictă a câmpurilor noi și un MP4 vertical real în care cuvântul galben se mută între două momente.
- Măsurat local (Windows, aceeași scenă de 3×8s, 1080×1920, fundal simplu): 30 s fără `word-color`, 48 s cu `word-color`. Pe VPS-ul 1 vCPU timpul total crește corespunzător; nu a fost măsurat acolo și nici cu Azure/FLUX reale.

## Actualizare: font Poppins, efect „pop" și subtitrări ASS

- Subtitrările se desenează acum cu un script ASS per scenă (`server/ass.js`) și filtrul libass din FFmpeg, cu fonturile din `server/fonts/` (Poppins ExtraBold, DejaVu Sans Bold) transmise prin `fontsdir`. Titlurile (`text`) citesc aceleași fonturi prin fontconfig/sharp.
- Câmpuri noi, opționale: `font-family` (`DejaVu Sans` | `Poppins`) și `word-scale` (1–1.6). Șablonul Make folosește `Poppins` și `1.15`.
- Același test de 3×8 s, 1080×1920 (Windows): 30 s subtitrări simple (PNG), 48 s karaoke PNG, **29,7 s karaoke ASS**. Pe VPS-ul cu 1 vCPU nu a fost măsurat.
- Teste noi: script ASS (culori BGR, tag-uri de pop, evenimente unite, escape), Poppins aplicat real pe titlu și pe subtitrări (lățime diferită față de fontul implicit), varianta PNG (`J2V_SUBTITLES=png`) încă funcțională.
- Neverificat: randarea în containerul Docker (ffmpeg din Debian); verificarea automată de la prima randare cade pe PNG dacă libass nu merge acolo.
