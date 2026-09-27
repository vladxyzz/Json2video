import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { examples } from "../shared/examples.js";
import { templates, makeTemplateId } from "../shared/templates.js";
import { inspectTemplate } from "../shared/template.js";

let child,
  base,
  temp,
  key = "test-api-key-with-at-least-32-chars",
  logs = "";
const request = (url, options = {}) =>
  fetch(base + url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      ...options.headers,
    },
  });
async function start() {
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ["server/index.js"], {
    env: {
      ...process.env,
      DATA_DIR: temp,
      PORT: String(port),
      HOST: "127.0.0.1",
      API_KEY: key,
      PUBLIC_BASE_URL: base,
      BFL_API_KEY: "",
      AZURE_SPEECH_KEY: "",
      AZURE_SPEECH_REGION: "",
    },
    windowsHide: true,
  });
  child.stderr.on("data", (c) => {
    logs += c;
  });
  child.stdout.on("data", (c) => {
    logs += c;
  });
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(base + "/healthz")).ok) return;
    } catch {}
    await delay(200);
  }
  throw new Error(logs);
}
async function stop() {
  if (child && child.exitCode === null) {
    const closed = new Promise((resolve) => child.once("close", resolve));
    child.kill();
    await closed;
  }
}
before(async () => {
  temp = await fs.mkdtemp(path.join(os.tmpdir(), "json2vid-tests-"));
  await start();
});
test("API Make: șablon, inspector, validare și lipsa cheilor fără job plătit", async () => {
  const list = await (await request("/api/templates")).json();
  assert.equal(list[0].id, makeTemplateId);
  const inspect = await (
    await request("/api/inspect", {
      method: "POST",
      body: JSON.stringify({ template: makeTemplateId }),
    })
  ).json();
  assert.equal(inspect.missing.length, 25);
  const missing = await request("/api/validate", {
    method: "POST",
    body: JSON.stringify({ template: makeTemplateId }),
  });
  assert.equal(missing.status, 422);
  assert.match((await missing.json()).errors[0].message, /intro_video/);
  const variables = Object.fromEntries(
    inspectTemplate(templates[0].movie).variables.map((v) => [
      v.name,
      v.name === "intro_video"
        ? "https://fixture.test/intro.mp4"
        : v.name === "bg_music"
          ? "https://fixture.test/music.mp3"
          : v.name === "voice"
            ? "en-US-GuyNeural"
            : v.name === "image_model"
              ? "flux-pro"
              : "English text.",
    ]),
  );
  const body = JSON.stringify({ template: makeTemplateId, variables });
  const validated = await request("/api/validate", { method: "POST", body });
  assert.equal(validated.status, 200);
  const parsed = await validated.json();
  assert.equal(parsed.movie.scenes.length, 11);
  assert.equal(parsed.configuration.length, 2);
  const submitted = await request("/v2/movies", { method: "POST", body });
  assert.equal(submitted.status, 422);
  assert.equal((await submitted.json()).configuration.length, 2);
});
after(async () => {
  await stop();
  assert.equal(path.dirname(temp), os.tmpdir());
  await fs.rm(temp, { recursive: true, force: true });
});
test(
  "API: autentificare, validare, idempotență, MP4, descărcare și persistență",
  { timeout: 120000 },
  async () => {
    assert.equal((await fetch(base + "/v2/movies")).status, 401);
    assert.equal((await fetch(base + "/api/session")).status, 200);
    assert.deepEqual(await (await fetch(base + "/api/session")).json(), {
      local: false,
    });
    assert.equal(
      (await request("/v2/movies", { method: "POST", body: "{broken" })).status,
      400,
    );
    assert.equal(
      (
        await request("/v2/movies", {
          method: "POST",
          body: JSON.stringify({ scenes: [{ duration: -1 }] }),
        })
      ).status,
      422,
    );
    const movie = {
      name: "Test MP4 – engleză",
      resolution: "sd",
      "aspect-ratio": "9:16",
      scenes: [
        {
          duration: 1,
          "background-color": "#c6f36b",
          elements: [
            { type: "text", text: "HELLO", "font-size": 48, color: "#182019" },
          ],
        },
        {
          duration: 1,
          "background-color": "#20282c",
          elements: [{ type: "text", text: "WORLD", "font-size": 48 }],
        },
      ],
      "client-data": { row: 42 },
    };
    const result = await request("/v2/movies", {
      method: "POST",
      headers: { "Idempotency-Key": "row42v1" },
      body: JSON.stringify(movie),
    });
    assert.equal(result.status, 202);
    const { project } = await result.json();
    assert.match(project, /^[0-9a-f]{16}$/);
    const duplicate = await (
      await request("/v2/movies", {
        method: "POST",
        headers: { "Idempotency-Key": "row42v1" },
        body: JSON.stringify(movie),
      })
    ).json();
    assert.equal(duplicate.project, project);
    assert.equal(duplicate.reused, true);
    assert.equal(
      (
        await request("/v2/movies", {
          method: "POST",
          headers: { "Idempotency-Key": "row42v1" },
          body: JSON.stringify({ ...movie, name: "Different" }),
        })
      ).status,
      409,
    );
    let status;
    for (let i = 0; i < 100; i++) {
      status = (await (await request(`/v2/movies?project=${project}`)).json())
        .movie;
      if (["done", "error"].includes(status.status)) break;
      await delay(300);
    }
    assert.equal(status.status, "done", status.message);
    assert.equal(status.duration, 2);
    assert.deepEqual(status["client-data"], { row: 42 });
    assert.equal(status.width, 360);
    assert.equal(status.height, 640);
    const mp4 = await fetch(status.url);
    assert.equal(mp4.status, 200);
    assert.match(mp4.headers.get("content-type"), /video\/mp4/);
    const bytes = Buffer.from(await mp4.arrayBuffer());
    assert.ok(bytes.length > 1000);
    assert.ok(bytes.includes(Buffer.from("ftyp")));
    assert.equal(
      (await fetch(status.url, { headers: { range: "bytes=0-99" } })).status,
      206,
    );
    assert.equal((await fetch(status.thumbnail)).status, 200);
    assert.equal(
      (await fetch(status.url.replace(/signature=[^&]+/, "signature=bad")))
        .status,
      403,
    );
    assert.equal(
      (await fetch(status.url.replace(/expires=\d+/, "expires=1"))).status,
      403,
    );
    assert.equal((await request("/v2/movies?project=missing")).status, 404);
    await stop();
    await start();
    const persisted = (
      await (await request(`/v2/movies?project=${project}`)).json()
    ).movie;
    assert.equal(persisted.status, "done");
    assert.ok(
      (await (await request("/api/movies/" + project + "/source")).json())
        .scenes,
    );
  },
);
test(
  "voce locală engleză este inclusă într-un MP4 real",
  {
    timeout: 120000,
    skip: process.platform !== "win32" && !process.env.ESPEAK_PATH,
  },
  async () => {
    const movie = structuredClone(
      examples.find((e) => e.id === "english").movie,
    );
    movie.resolution = "sd";
    movie.scenes = movie.scenes.slice(0, 1);
    movie.scenes[0].elements[0]["font-size"] = 44;
    const { project } = await (
      await request("/v2/movies", {
        method: "POST",
        body: JSON.stringify(movie),
      })
    ).json();
    assert.ok(project);
    let result;
    for (let i = 0; i < 150; i++) {
      result = (await (await request("/v2/movies?project=" + project)).json())
        .movie;
      if (["done", "error"].includes(result.status)) break;
      await delay(300);
    }
    assert.equal(result.status, "done", result.message);
    assert.ok(result.size > 20000);
  },
);
test(
  "job întrerupt este reluat după restart, iar sursa privată produce eroare",
  { timeout: 120000 },
  async () => {
    await stop();
    const seed = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        "import {store} from './server/store.js'; import {validateMovie} from './shared/schema.js'; const input=validateMovie({name:'Resumed',resolution:'sd',scenes:[{duration:0.5}]}).data; store.create({id:'cccccccccccccccc',input,created_at:new Date().toISOString()},null,'resume');store.update('cccccccccccccccc',{status:'running'});",
      ],
      {
        env: { ...process.env, DATA_DIR: temp, API_KEY: key },
        encoding: "utf8",
        windowsHide: true,
      },
    );
    assert.equal(seed.status, 0, seed.stderr);
    await start();
    let resumed;
    for (let i = 0; i < 100; i++) {
      resumed = (
        await (await request("/v2/movies?project=cccccccccccccccc")).json()
      ).movie;
      if (["done", "error"].includes(resumed.status)) break;
      await delay(200);
    }
    assert.equal(resumed.status, "done", resumed.message);
    const { project } = await (
      await request("/v2/movies", {
        method: "POST",
        body: JSON.stringify({
          scenes: [
            {
              duration: 1,
              elements: [
                { type: "image", src: "https://127.0.0.1/private.png" },
              ],
            },
          ],
        }),
      })
    ).json();
    let failed;
    for (let i = 0; i < 80; i++) {
      failed = (await (await request("/v2/movies?project=" + project)).json())
        .movie;
      if (failed.status === "error") break;
      await delay(150);
    }
    assert.equal(failed.status, "error");
    assert.match(failed.message, /private|locale|rezervate/);
    assert.equal(failed.url, null);
  },
);
