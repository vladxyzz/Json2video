# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
A Romanian-speaking creator who automates short, English-voiced videos through Make.com. Today the only user is the owner, working at a desktop alongside the Make editor; other creators may use it later, but the product is a single workspace with a single worker, not multi-tenant. The job: paste or edit JSON, confirm it is valid, render a real MP4, and have Make call the same renderer unattended.

## Product Purpose
Json2vid Studio turns JSON into MP4 on infrastructure the user controls, and exposes an API Make can call. Success is a Make scenario that creates a job, waits for it, downloads the MP4 and publishes it with no manual step, plus a UI where the user can reproduce, inspect and fix any job by hand.

## Positioning
Fidelity to the user's own Make template. It runs the real script (`examples/make-longform.json`, template `qbTOTIiERdOb3Ib3grfl`, 25 variables) and the real scenario contract, and refuses what it cannot render with explicit validation errors instead of silently dropping properties. JSON2Video is a functional reference, not a promise of schema or API compatibility.

## Operating Context
- Reference workflow in Make: Sheets → Gemini → Parse JSON → Sheets → HTTP POST `/v2/movies` → waits → HTTP GET → download → router → YouTube / Instagram / TikTok → Sheets update. Scenario "Integration Google Sheets" (ID 9663557) was inspected and left unchanged.
- Sheets supply the variables (`Foaie1`: idea, caption, prompts, statuses; `Foaie2`: audio list, intro video). Make maps them into `variables`; the app never reads Sheets directly.
- Make needs a public HTTPS host; localhost is not reachable. Deployment is a Docker/Compose VPS behind a reverse proxy, with a persistent `/app/data` volume. Local Windows operation also works (`start.cmd`).
- Content is images/video + text + English voice. The interface and all messages are Romanian; voice, subtitles and scene text are English.
- Desktop-first editing workspace used beside Make. Narrow screens stack the panes.

## Capabilities and Constraints
- Editable JSON with strict validation and template inspection; schematic scene preview until a real MP4 exists; render history of real jobs only; MP4 (H.264/AAC) with player, cover image and signed download links (about 6–7 days).
- Scenes with text, image, video, audio and voice layers, variables, computed durations, fades/zoom, and subtitles timed from Azure word boundaries (or explicit `timing: estimated` for local TTS).
- Voice: local Windows voice or eSpeak NG in the container (synthetic); Azure Speech optional and required for the Make template voice `en-US-GuyNeural`. Images from prompts via BFL FLUX 1.1 Pro (`flux-pro` and `flux-pro-1.1` map to it, approved by the user).
- API: `x-api-key` auth, `POST/GET /v2/movies`, validate/inspect, idempotency key, webhook with up to 5 retries and manual retry. `202` means queued, not rendered. SQLite queue, one worker, one process.
- The error `Variabila „intro_video” nu este definită` is expected when that variable is not supplied. It is accepted behavior, not a defect; do not hide it or alter the original template.
- Not yet verified: real Azure and BFL calls (no credentials or credits supplied), public host, domain and TLS.

## Brand Commitments
Name: Json2vid Studio. Romanian UI copy. Functional reference to JSON2Video's editor → preview → render workflow, without claiming affiliation or full compatibility.

## Evidence on Hand
- `examples/make-longform.json` (exact copy of the user's script, 11 scenes, 10 prompted images, 10 voices), `examples/english-voice.json`.
- `docs/RESEARCH.md`, `docs/MAKE.md`, `docs/MAKE-SCENARIO.md`, `docs/UI-AUDIT.md`, `docs/VALIDATION.md`, `docs/openapi.json`, `HANDOFF.md`.
- A local rendered MP4 example is described in `docs/VALIDATION.md`.
- Absent, so never fabricate: customer testimonials, usage numbers, benchmarks, pricing, hosting account, domain, speech or image-provider credentials.

## Product Principles
1. The Make workflow is the ground truth; the UI exists to reproduce, inspect and debug it.
2. Fail loudly: unsupported or missing properties are validation errors, never silent omissions.
3. Show only real state: previews are labelled schematic, history lists real jobs, status is always text.
4. Rendering must work end to end without external credentials; paid providers are additive.
5. Secrets stay on the server; the UI never puts keys in JSON, URLs or Git.

## Accessibility & Inclusion
WCAG 2.2 AA as the default target: sufficient contrast, full keyboard operation, visible focus, status conveyed by text and not color alone, and respect for reduced motion.
