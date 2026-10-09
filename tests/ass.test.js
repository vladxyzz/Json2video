import test from "node:test";
import assert from "node:assert/strict";
import { buildAss, fonts } from "../server/ass.js";
import { wrapText } from "../server/renderer.js";
import { validateMovie, pixelValue } from "../shared/schema.js";

const coordinate = (value, size, object) => {
  const pixels = pixelValue(value, size);
  return pixels !== undefined
    ? pixels
    : value === "center"
      ? (size - object) / 2
      : ["right", "bottom"].includes(value)
        ? size - object
        : 0;
};
const element = (extra = {}) =>
  validateMovie({
    scenes: [
      {
        duration: 4,
        elements: [
          {
            type: "subtitles",
            text: "One two three four",
            timing: "estimated",
            "font-size": "72px",
            y: "66%",
            ...extra,
          },
        ],
      },
    ],
  }).data.scenes[0].elements[0];
const build = (el, cues) =>
  buildAss([{ element: el, cues }], 1080, 1920, { wrapText, coordinate });

test("ASS: un singur script cu stil, font Poppins și culori în format BGR", () => {
  const el = element({
    "font-family": "Poppins",
    "word-color": "#FFD400",
    "word-scale": 1.15,
  });
  const cues = [
    { text: "One two three four", start: 0, duration: 0.5, highlight: 0 },
    { text: "One two three four", start: 0.5, duration: 0.5, highlight: 1 },
  ];
  const ass = build(el, cues);
  assert.match(ass, /PlayResX: 1080/);
  assert.match(ass, /PlayResY: 1920/);
  assert.match(ass, new RegExp(`Style: S0,${fonts.Poppins.name},`));
  // #FFD400 is &H00D4FF& in ASS (blue, green, red).
  assert.match(ass, /\\c&H00D4FF&/);
  assert.match(ass, /\\t\(0,90,\\fscx115\\fscy115\)/);
  assert.equal((ass.match(/^Dialogue:/gm) || []).length, 2 * 1);
});

test("ASS: liniile care nu se schimbă între cue-uri devin un singur eveniment", () => {
  const el = element({
    "word-color": "#FFD400",
    "font-size": 40,
    width: 400,
  });
  const text = "alpha beta gamma delta epsilon zeta";
  const cues = [0, 1, 2, 3, 4, 5].map((highlight) => ({
    text,
    start: highlight * 0.5,
    duration: 0.5,
    highlight,
  }));
  const ass = build(el, cues);
  const lines = wrapText(text, 400, 40).length;
  assert.ok(lines >= 2, "the sample must wrap over several lines");
  // Each line is rewritten once per highlighted word it contains, not once per cue.
  const dialogue = ass.match(/^Dialogue:.*$/gm);
  assert.ok(dialogue.length < 6 * lines, `${dialogue.length} events`);
  assert.ok(dialogue.every((d) => /\\pos\(/.test(d)));
});

test("ASS: timpii sunt în centisecunde, text simplu fără evidențiere și all-caps", () => {
  const el = element({ "all-caps": true, style: "plain" });
  const ass = build(el, [
    { text: "quiet words", start: 1.234, duration: 0.5 },
  ]);
  assert.match(ass, /Dialogue: 0,0:00:01\.23,0:00:01\.73,S0,/);
  assert.match(ass, /QUIET WORDS/);
  assert.doesNotMatch(ass, /\\c&H/);
  assert.match(ass, /,1,0,0,8,0,0,0,1/, "plain style has no outline or shadow");
});

test("ASS: acoladele și backslash-urile din text nu pot injecta taguri", () => {
  const ass = build(element(), [
    { text: "{\\fs200}Hello \\N world", start: 0, duration: 1 },
  ]);
  const body = ass.match(/^Dialogue:.*$/m)[0].split(",,").pop();
  assert.doesNotMatch(body.replace(/^\{[^}]*\}/, ""), /[{}\\]/);
});
