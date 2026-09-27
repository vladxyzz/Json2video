import test from "node:test";
import assert from "node:assert/strict";
import {
  templates,
  makeTemplateId,
  resolveTemplate,
} from "../shared/templates.js";
import { inspectTemplate } from "../shared/template.js";
import { validateMovie, dimensions } from "../shared/schema.js";
import { generateImage } from "../server/providers.js";
import { subtitleCues } from "../server/subtitles.js";

const source = templates[0].movie;
const variables = Object.fromEntries(
  inspectTemplate(source).variables.map((v) => [
    v.name,
    v.name === "intro_video"
      ? "https://fixture.test/intro.mp4"
      : v.name === "bg_music"
        ? "https://fixture.test/music.mp3"
        : v.name === "voice"
          ? "en-US-GuyNeural"
          : v.name === "image_model"
            ? "flux-pro"
            : "English narration for this scene.",
  ]),
);
test("șablonul original păstrează eroarea intro_video și acceptă cele 25 de variabile Make", () => {
  const before = JSON.stringify(source),
    inspection = inspectTemplate(source);
  assert.equal(inspection.variables.length, 25);
  assert.equal(inspection.generatedImages, 10);
  assert.equal(inspection.subtitles, 10);
  assert.match(validateMovie(source).error.issues[0].message, /intro_video/);
  const result = validateMovie({ template: makeTemplateId, variables });
  assert.equal(result.success, true, JSON.stringify(result.error));
  assert.deepEqual(dimensions(result.data), [1920, 1080]);
  assert.equal(result.data.scenes.length, 11);
  assert.equal(result.data.scenes[1].elements[1].provider, "azure");
  assert.equal(result.data.scenes[1].elements[1].voice, "en-US-GuyNeural");
  assert.equal(result.data.scenes[1].elements[2].y, "85%");
  assert.equal(result.data.scenes[0].elements[1]["font-size"], "48px");
  assert.equal(result.data.elements[0]["fade-out"], 2);
  assert.equal(JSON.stringify(source), before);
  assert.throws(() => resolveTemplate({ template: "missing" }), /nu există/);
  assert.throws(
    () => resolveTemplate({ template: makeTemplateId, scenes: [] }),
    /Câmp neacceptat/,
  );
});
test("subtitrările folosesc offseturile vocii și refuză o sincronizare inventată", () => {
  const text = "One two three four five six. Seven eight nine.";
  const words = [...text.matchAll(/\S+/g)].map((m, i) => ({
    offset: m.index,
    length: m[0].length,
    start: i * 0.3,
    end: i * 0.3 + 0.2,
  }));
  const cues = subtitleCues({ text, timing: "speech" }, { words }, 3);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].text, "One two three four five six.");
  assert.equal(cues[1].start, 1.7999999999999998);
  assert.throws(
    () => subtitleCues({ text, timing: "speech" }, {}, 3),
    /nu a returnat timpi/,
  );
  assert.equal(subtitleCues({ text, timing: "estimated" }, null, 3).length, 2);
});
test("FLUX: model aprobat, dimensiuni valide, polling, descărcare și respingerea gazdelor străine", async () => {
  const previous = process.env.BFL_API_KEY;
  process.env.BFL_API_KEY = "test-key-only";
  try {
    let calls = 0,
      downloaded = false;
    await generateImage(
      { model: "flux-pro", prompt: "Test image" },
      "fixture.png",
      1920,
      1080,
      {
        sleep: async () => {},
        fetchImpl: async (url, options) => {
          assert.equal(options.redirect, "error");
          if (calls++ === 0) {
            assert.equal(url, "https://api.bfl.ai/v1/flux-pro-1.1");
            const body = JSON.parse(options.body);
            assert.equal(body.width, 1440);
            assert.equal(body.height, 800);
            return {
              ok: true,
              json: async () => ({
                polling_url: "https://api.eu.bfl.ai/v1/get_result?id=test",
              }),
            };
          }
          return {
            ok: true,
            json: async () => ({
              status: "Ready",
              result: { sample: "https://delivery.eu.bfl.ai/test.png" },
            }),
          };
        },
        downloadAsset: async (url, target) => {
          assert.equal(target, "fixture.png");
          assert.match(url, /delivery.eu.bfl.ai/);
          downloaded = true;
        },
      },
    );
    assert.equal(downloaded, true);
    await assert.rejects(
      generateImage({ model: "flux-pro", prompt: "x" }, "x", 640, 360, {
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({ polling_url: "https://evil.example/get" }),
        }),
      }),
      /nu este validă/,
    );
  } finally {
    if (previous === undefined) delete process.env.BFL_API_KEY;
    else process.env.BFL_API_KEY = previous;
  }
});
