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
  assert.deepEqual(dimensions(result.data), [1080, 1920]);
  assert.equal(result.data.scenes.length, 11);
  assert.equal(result.data.scenes[1].elements[1].provider, "azure");
  assert.equal(result.data.scenes[1].elements[1].voice, "en-US-GuyNeural");
  assert.equal(result.data.scenes[1].elements[2].y, "66%");
  assert.equal(result.data.scenes[1].elements[2]["word-color"], "#FFD400");
  assert.equal(result.data.scenes[1].elements[2]["max-words"], 4);
  assert.equal(result.data.scenes[0].elements[1]["font-size"], "64px");
  assert.equal(result.data.elements[0]["fade-out"], 2);
  assert.equal(JSON.stringify(source), before);
  assert.throws(() => resolveTemplate({ template: "missing" }), /does not exist/);
  assert.throws(
    () => resolveTemplate({ template: makeTemplateId, scenes: [] }),
    /Unsupported field/,
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
    /did not return subtitle timings/,
  );
  assert.equal(subtitleCues({ text, timing: "estimated" }, null, 3).length, 2);
});
test("karaoke: un cue pe cuvânt, fără goluri sau suprapuneri, cu cuvântul evidențiat", () => {
  const text = "One two three four five six seven.";
  const words = [...text.matchAll(/\S+/g)].map((m, i) => ({
    offset: m.index,
    length: m[0].length,
    start: i * 0.3,
    end: i * 0.3 + 0.2,
  }));
  const element = {
    text,
    timing: "speech",
    "word-color": "#FFD400",
    "max-words": 4,
  };
  const cues = subtitleCues(element, { words }, 3);
  assert.equal(cues.length, 7);
  assert.deepEqual(
    cues.map((c) => c.highlight),
    [0, 1, 2, 3, 0, 1, 2],
  );
  assert.equal(cues[0].text, "One two three four");
  assert.equal(cues[4].text, "five six seven.");
  for (let i = 1; i < cues.length; i++) {
    const gap = cues[i].start - (cues[i - 1].start + cues[i - 1].duration);
    assert.ok(Math.abs(gap) < 1e-9, `cue ${i} gap ${gap}`);
  }
  const last = cues.at(-1);
  assert.ok(last.start + last.duration <= 3 + 1e-9);
  // A voice that splits "well-known" into two tokens must not shift the highlight.
  const hyphen = "A well-known fact today";
  const split = [
    { offset: 0, length: 1, start: 0, end: 0.2 },
    { offset: 2, length: 4, start: 0.3, end: 0.5 },
    { offset: 7, length: 5, start: 0.6, end: 0.8 },
    { offset: 13, length: 4, start: 0.9, end: 1.1 },
    { offset: 18, length: 5, start: 1.2, end: 1.4 },
  ];
  const marks = subtitleCues(
    { text: hyphen, timing: "speech", "word-color": "#FFD400", "max-words": 6 },
    { words: split },
    2,
  ).map((c) => c.highlight);
  assert.deepEqual(marks, [0, 1, 1, 2, 3]);
});
test("sem word-color, subtitrările se comportă exact ca înainte (max-words schimbă doar gruparea)", () => {
  const text = "One two three four five six seven eight nine.";
  const words = [...text.matchAll(/\S+/g)].map((m, i) => ({
    offset: m.index,
    length: m[0].length,
    start: i * 0.3,
    end: i * 0.3 + 0.2,
  }));
  const plain = subtitleCues({ text, timing: "speech" }, { words }, 4);
  assert.equal(plain.length, 2);
  assert.ok(plain.every((c) => c.highlight === undefined));
  const grouped = subtitleCues(
    { text, timing: "speech", "max-words": 3 },
    { words },
    4,
  );
  assert.equal(grouped.length, 3);
  assert.ok(grouped.every((c) => c.highlight === undefined));
});
test("schema: word-color, max-words și all-caps sunt validate strict", () => {
  const scene = (extra) => ({
    scenes: [
      {
        duration: 2,
        elements: [
          { type: "subtitles", text: "Hello there", timing: "estimated", ...extra },
        ],
      },
    ],
  });
  assert.equal(validateMovie(scene({})).data.scenes[0].elements[0]["all-caps"], false);
  assert.equal(
    validateMovie(scene({ "word-color": "#FFD400", "max-words": 4, "all-caps": true }))
      .success,
    true,
  );
  assert.equal(validateMovie(scene({ "word-color": "yellow" })).success, false);
  assert.equal(validateMovie(scene({ "max-words": 0 })).success, false);
  assert.equal(validateMovie(scene({ "max-words": 13 })).success, false);
  assert.equal(validateMovie(scene({ "max-words": 2.5 })).success, false);
  assert.equal(validateMovie(scene({ "all-caps": "yes" })).success, false);
  assert.equal(validateMovie(scene({ "word-colour": "#FFD400" })).success, false);
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
      /is not valid/,
    );
  } finally {
    if (previous === undefined) delete process.env.BFL_API_KEY;
    else process.env.BFL_API_KEY = previous;
  }
});
