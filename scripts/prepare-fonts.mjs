import fs from "node:fs/promises";
const families = [
  [
    "dm-sans-regular.ttf",
    "https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAopxhTg.ttf",
  ],
  [
    "dm-sans-medium.ttf",
    "https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAkJxhTg.ttf",
  ],
  [
    "dm-sans-semibold.ttf",
    "https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAfJthTg.ttf",
  ],
  [
    "dm-sans-bold.ttf",
    "https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwARZthTg.ttf",
  ],
  [
    "ibm-plex-mono.ttf",
    "https://fonts.gstatic.com/s/ibmplexmono/v20/-F63fjptAgt5VM-kVkqdyU8n5ig.ttf",
  ],
];
await fs.mkdir("public/fonts", { recursive: true });
await Promise.all(
  families.map(async ([name, url]) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Font download failed: ${r.status}`);
    await fs.writeFile(
      `public/fonts/${name}`,
      Buffer.from(await r.arrayBuffer()),
    );
  }),
);
const css = families
  .map(
    ([name], i) =>
      `@font-face{font-family:'${i === 4 ? "IBM Plex Mono" : "DM Sans"}';font-style:normal;font-weight:${[400, 500, 600, 700, 400][i]};font-display:swap;src:url('/fonts/${name}') format('truetype')}`,
  )
  .join("\n");
await fs.writeFile("public/fonts/fonts.css", css);
