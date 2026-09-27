# Cercetare înainte de implementare

Consultat la 25 septembrie 2026. Cererea utilizatorului definește scopul; documentația și captura sunt numai referințe.

Pagina cerută, https://json2video.com/dashboard/welcome/, redirecționează spre login în browserul disponibil. Nu am avut acces la conținutul privat. Am folosit documentația publică oficială și am citit captura fluxului Make furnizată de utilizator.

## Constatări și decizii

| Sursă primară | Constatări relevante | Aplicare |
| --- | --- | --- |
| [JSON2Video quickstart](https://json2video.com/docs/v2/getting-started/quickstart) și [JSON syntax](https://json2video.com/docs/v2/reference/json-syntax) | Un film este un document cu scene și elemente. API-ul produce un job. | Același model conceptual, cu subset strict și documentat. |
| [JSON2Video GET status](https://json2video.com/docs/v2/reference/api-endpoints/movies-status) | `project`, stări pending/running/done/error și URL de rezultat. | Endpointuri familiare; nu revendicăm paritate completă. |
| [JSON2Video webhooks](https://json2video.com/docs/v2/reference/webhooks) | Notificarea finală poate alimenta alte sisteme. | Notificări distincte de starea randării, retry persistent și HMAC opțional. |
| [Make HTTP](https://apps.make.com/http) | Modulul poate face POST JSON și descărca fișiere. HTTP v4 cere HTTPS și are credențiale dedicate. | Cheie în credential/keychain, adresă HTTPS publică și pași exacți în ghid. |
| [Make webhooks](https://help.make.com/webhooks) | Custom webhooks pot porni instant un scenariu și folosesc cozi. | Două scenarii: trimitere și finalizare. Deduplificare după project. |
| [Creatomate + Make](https://creatomate.com/blog/how-to-automate-video-creation-with-make) | Exemplu de conținut scurt din template, date și integrare socială. | Exemple reutilizabile și separarea generării de distribuire. |
| [Creatomate API](https://creatomate.com/blog/how-to-automate-video-generation-using-an-api) | Randare în fundal, status sau callback. | POST rapid, worker serial, webhook în locul unei pauze presupuse suficiente. |
| [Shotstack: newsreels personalizate cu Make](https://shotstack.io/learn/make-tutorial-video/) | Caz descris de autor: datele participanților alimentează șabloane video pentru evenimente. | Variabile și client-data pentru corelarea cu rândurile Sheets. |
| [FFmpeg filters](https://ffmpeg.org/ffmpeg-filters.html) | Operații de scalare, suprapunere și mixare audio. | FFmpeg nativ pentru randare independentă de servicii SaaS. |
| [Microsoft SpeechSynthesizer](https://learn.microsoft.com/en-us/dotnet/api/system.speech.synthesis.speechsynthesizer) | Voci Windows instalate, sintetizare în fișier WAV. | Voce engleză locală funcțională fără credențiale. |
| [Azure REST TTS](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech) | Sinteză prin SSML și cheie de serviciu. | Provider opțional pentru voci neuronale; secretul rămâne pe server. |
| [eSpeak NG](https://github.com/espeak-ng/espeak-ng/blob/master/src/espeak-ng.1.ronn) | CLI pentru sintetizare în fișier WAV. | Alternativă locală inclusă în containerul Linux. |

Acestea sunt exemple tehnice publicate de furnizori, nu dovezi independente ale rentabilității sau performanței lor. Nu am identificat măsurători independente comparabile; selecția arhitecturii este o concluzie tehnică proprie.

## Captura Make

Fluxul observat: Google Sheets Search Rows → Gemini Generate a response → Parse JSON → Sheets Search Rows → HTTP POST `/v2/movies` → Sleep 4m → Sleep 2m30s → HTTP GET → Download a file → Router. Ramurile duc spre YouTube, Instagram și un flux HTTP pentru TikTok; există și actualizarea unui rând Sheets.

Schimbarea propusă: păstrează generarea conținutului și ramurile sociale, înlocuiește serviciul video și, opțional, mută finalizarea într-un al doilea scenariu declanșat de webhook. Filtrele `done` și `error` trebuie să decidă următoarea acțiune. Sleep poate fi folosit între verificări de status, dar trecerea timpului nu confirmă finalizarea.

Aplicația randează media și sintetizează voce; nu este un model text-to-video generativ. Gemini și publicarea socială rămân în Make. Extensia din26 septembrie adaugă imagini FLUX din prompt, apoi animație/compunere FFmpeg. Nicio publicare pe conturile sociale și nicio modificare salvată a scenariului Make nu au fost efectuate.

## Cercetarea ulterioară — 26 septembrie

Scenariul autentificat și documentul Sheets au fost inspectate; raportul complet este [MAKE-SCENARIO.md](MAKE-SCENARIO.md). Documentația [BFL](https://docs.bfl.ai/quick_start/generating_images) și [OpenAPI live](https://api.bfl.ai/openapi.json) au confirmat contractul de generare/polling pentru FLUX1.1 Pro. Alegerea a fost aprobată de utilizator. [Azure SDK WordBoundary](https://learn.microsoft.com/en-us/javascript/api/microsoft-cognitiveservices-speech-sdk/speechsynthesiswordboundaryeventargs) a înlocuit sinteza REST simplă pentru a obține timpii necesari subtitrărilor. Schema a fost extinsă după câmpurile din fișierul utilizatorului, nu după presupuneri despre formatul ascuns al template-ului.
