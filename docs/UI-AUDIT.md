# Audit, layout și polish — 26 septembrie 2026

Evaluare inițială: 11/20 — accesibilitate 2/4, performanță 3/4, responsive 2/4, teme 1/4, integritate 3/4. Evaluare tehnică și de sursă, fără pretenție de certificare WCAG. Scanul mecanic layout nu a raportat probleme; constatările manuale de mai jos sunt independente de scan.

| Prioritate | Problemă verificată | Impact | Acțiune |
| --- | --- | --- | --- |
| P1 | Tab și Shift+Tab capturate de textarea | Nu se putea ieși firesc din editor cu tastatura (WCAG 2.1.2) | Restabilită navigarea standard Tab |
| P1 | Etichete secundare 10–11px, contrast sub 4.5:1 | Stare și timp greu de citit | Consolidate culorile muted și mărite etichetele |
| P1 | max-width portret impus și în landscape/pătrat | Previzualizare cu raport incorect | Canvas încadrat după ambele dimensiuni disponibile |
| P2 | Polling ștergea erorile acțiunilor | Mesajele dispăreau înainte de rezolvare | Separate erorile de rețea de cele ale acțiunilor |
| P2 | Stări selectate doar prin culoare | Navigare neclară pentru cititoare de ecran | aria-current, aria-pressed, aria-invalid și descrierea validării |
| P2 | Revalidare JSON la orice poll | Lucru inutil pe șabloane mari | Memoizare după sursă, polling adaptiv și pauză în fundal |
| P2 | Panouri înguste pe tabletă | Citirea codului și a cadrului devenea dificilă | Panouri stivuite sub 820px |
| P2 | Avatar și iconiță settings fără funcție | Impresie de controale neimplementate | Înlocuite cu informația reală despre server |
| P2 | Multe margini, titlu generic și chrome înalt | Editorul/timeline-ul coborau sub fold | Antet compact, spațiere 8/16/24px, înălțime bazată pe viewport |

Se păstrează identitatea existentă: grafit, suprafețe deschise, accent verde și un singur workspace pentru sursă, monitor și scene. Nu este o schimbare completă de branding. Puncte bune păstrate: butoane semantice, focus vizibil, stare textuală, istoric real, distincția Schiță/MP4.

Ordinea aplicată: audit → layout → polish. Verificarea vizuală finală se face după integrarea modificărilor funcționale, pe desktop și mobil, urmată de cel mult un lot de corecții.

Verificarea finală a fost încheiată: primul lot desktop/mobil a identificat timeline-ul sub fold și tabelul prea îngust pe telefon. Un singur lot de corecții a redus înălțimea editorului, a păstrat tabelul lizibil prin scroll propriu și a corectat formatul implicit afișat pentru șablonul necompletat. Confirmare la1440×900 și390×844: fără overflow orizontal, timeline vizibil pe desktop, navigare mobilă44px, Tab fără blocare, raport corect pentru preview. Nu s-au raportat erori în consola browserului.

Interfața include acum inspectorul variabilelor, stări de încărcare reale, mesajele persistente de eroare și starea configurării furnizorilor. Limita verificării: audit manual și tehnic, nu certificare WCAG sau test cu cititor de ecran real. Nu s-au adăugat animații decorative, profil fictiv sau valori inventate.
