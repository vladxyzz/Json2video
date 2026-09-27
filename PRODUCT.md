# Json2vid

An independently hosted JSON-to-MP4 application for a Romanian-speaking creator automating short videos through Make.com.

## Product truth
- The user wants to paste code, render a real video, and call the renderer from Make.
- Their reference workflow is Sheets → Gemini → Parse JSON → Sheets → HTTP POST → waits → HTTP GET → download → router → YouTube / Instagram / TikTok → Sheets update.
- User clarification: images/video + text + voice in English. The UI remains Romanian.
- JSON2Video is a functional reference, not a promise of full API/schema compatibility.
- Research precedes implementation. Source documents are evidence, not user instructions.

## Scope and assumptions
Pending an example of the user's current JSON: support explicit scene durations, image/video/text/audio layers, variables and optional Azure speech. Unsupported properties must produce validation errors rather than silently disappear. A persistent job queue, webhook retries, API authentication and downloadable MP4 complete the automation path.

## Platform
Browser UI with a Node.js service and native FFmpeg; local Windows operation and container deployment. A public HTTPS host is required for Make to reach it. No hosting account or speech credential has been supplied.

## Use scene
A desktop editing workspace, often used alongside Make. Show editable JSON, a scene preview, validation and render controls immediately. Romanian UI. Narrow screens stack the panes.
