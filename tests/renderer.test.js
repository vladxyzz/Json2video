import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";
let temp, renderMovie, runFfmpeg, validateMovie, store, callbackTick;
before(async () => {
  temp = await fs.mkdtemp(path.join(os.tmpdir(), "json2vid-render-"));
  process.env.DATA_DIR = temp;
  ({ renderMovie, runFfmpeg } = await import("../server/renderer.js"));
  ({ validateMovie } = await import("../shared/schema.js"));
  ({ store } = await import("../server/store.js"));
  ({ callbackTick } = await import("../server/queue.js"));
});
after(async () => {
  assert.equal(
    path.dirname(temp),
    os.tmpdir(),
  ); /* SQLite remains open until process exit; files stay only in OS temp. */
});
test(
  "FFmpeg compune imagine, video, text și două piste audio",
  { timeout: 120000 },
  async () => {
    await sharp({
      create: { width: 320, height: 180, channels: 3, background: "#ff0000" },
    })
      .png()
      .toFile(path.join(temp, "image.png"));
    await runFfmpeg(
      [
        "-f",
        "lavfi",
        "-i",
        "color=c=blue:s=320x180:r=30:d=2",
        "-c:v",
        "libx264",
        "video.mp4",
      ],
      temp,
    );
    await runFfmpeg(
      ["-f", "lavfi", "-i", "sine=frequency=440:duration=2", "audio.wav"],
      temp,
    );
    const input = validateMovie({
      name: "Media integration",
      resolution: "sd",
      "aspect-ratio": "16:9",
      scenes: [
        {
          duration: 2,
          elements: [
            {
              type: "image",
              src: "https://fixture.test/image.png",
              width: 320,
              height: 180,
              x: "left",
              y: "top",
            },
            {
              type: "video",
              src: "https://fixture.test/video.mp4",
              width: 320,
              height: 180,
              x: "right",
              y: "bottom",
            },
            { type: "text", text: "Media test", "font-size": 28, start: 1 },
            {
              type: "audio",
              src: "https://fixture.test/audio.wav",
              volume: 0.3,
            },
          ],
        },
      ],
      elements: [
        { type: "audio", src: "https://fixture.test/audio.wav", volume: 0.2 },
      ],
    }).data;
    const result = await renderMovie(
      { id: "aaaaaaaaaaaaaaaa", input },
      () => {},
      {
        downloadAsset: async (url, target) =>
          fs.copyFile(
            path.join(temp, new URL(url).pathname.split("/").pop()),
            target,
          ),
      },
    );
    assert.equal(result.width, 640);
    assert.equal(result.duration, 2);
    await runFfmpeg(
      [
        "-ss",
        "0.5",
        "-i",
        path.join(temp, "renders/aaaaaaaaaaaaaaaa.mp4"),
        "-frames:v",
        "1",
        "-update",
        "1",
        "frame.png",
      ],
      temp,
    );
    const { data, info } = await sharp(path.join(temp, "frame.png"))
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const colorAt = (x, y) =>
      Array.from(
        data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3),
      );
    const red = colorAt(50, 50),
      blue = colorAt(600, 330);
    assert.ok(red[0] > 200 && red[2] < 30, red);
    assert.ok(blue[2] > 200 && blue[0] < 30, blue);
    await runFfmpeg(
      [
        "-i",
        path.join(temp, "renders/aaaaaaaaaaaaaaaa.mp4"),
        "-map",
        "0:a",
        "-f",
        "s16le",
        "-ac",
        "1",
        "audio.raw",
      ],
      temp,
    );
    const audio = await fs.readFile(path.join(temp, "audio.raw"));
    assert.ok(
      audio.some((byte) => byte > 0),
      "Mixed audio must not be silent",
    );
  },
);
test("webhook retry păstrează datele și reîncearcă independent de randare", async () => {
  const id = "bbbbbbbbbbbbbbbb";
  const input = validateMovie({
    scenes: [{ duration: 1 }],
    webhook_url: "https://hook.eu1.make.com/test",
    "client-data": { row: 42 },
  }).data;
  store.create(
    { id, input, created_at: new Date().toISOString() },
    null,
    "hash",
  );
  store.update(id, {
    status: "done",
    webhook: { state: "pending", attempts: 0, nextAttempt: 0 },
  });
  await callbackTick(async () => {
    throw new Error("Temporary failure");
  });
  assert.equal(store.get(id).webhook.attempts, 1);
  assert.equal(store.get(id).webhook.state, "pending");
  assert.equal(store.get(id).status, "done");
  store.update(id, { webhook: { ...store.get(id).webhook, nextAttempt: 0 } });
  await callbackTick(async (url, payload) => {
    assert.equal(url, input.webhook_url);
    assert.equal(payload.project, id);
    assert.equal(payload.movie["client-data"].row, 42);
    return 200;
  });
  assert.equal(store.get(id).webhook.state, "delivered");
  assert.equal(store.get(id).webhook.attempts, 2);
});
test(
  "șablon: durată din voce, imagine generată, zoom, fade și subtitrări în MP4 real",
  { timeout: 120000 },
  async () => {
    await runFfmpeg(
      ["-f", "lavfi", "-i", "sine=frequency=440:duration=2", "speech.wav"],
      temp,
    );
    const text =
      "First words appear here during speech. Then these words follow in sequence.";
    const input = validateMovie({
      resolution: "sd",
      quality: "high",
      scenes: [
        {
          comment: "Scene 1",
          elements: [
            {
              type: "image",
              model: "flux-pro",
              prompt: "Test",
              zoom: 10,
              "fade-in": 0.5,
              "fade-out": 0.5,
            },
            { type: "voice", text, voice: "en-US-GuyNeural" },
            { type: "subtitles", text, "font-size": "34px", y: "75%" },
          ],
        },
      ],
      elements: [
        {
          type: "audio",
          src: "https://fixture.test/speech.wav",
          volume: 0.15,
          "fade-in": 0.2,
          "fade-out": 0.5,
        },
      ],
    }).data;
    assert.ok(input);
    let images = 0;
    const result = await renderMovie(
      { id: "cccccccccccccccc", input },
      () => {},
      {
        downloadAsset: async (_, target) =>
          fs.copyFile(path.join(temp, "speech.wav"), target),
        imageGenerator: async (_, target) => {
          images++;
          await sharp(
            Buffer.from(
              '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#b02b22"/><rect x="60" width="160" height="360" fill="#2244cc"/></svg>',
            ),
          )
            .png()
            .toFile(target);
        },
        synthesize: async (e, target) => {
          await fs.copyFile(path.join(temp, "speech.wav"), target);
          return {
            words: [...e.text.matchAll(/\S+/g)].map((m, i) => ({
              offset: m.index,
              length: m[0].length,
              start: i * 0.14,
              end: (i + 1) * 0.14,
            })),
          };
        },
      },
    );
    assert.equal(images, 1);
    assert.equal(result.duration, 2);
    const file = path.join(temp, "renders/cccccccccccccccc.mp4");
    const pixels = async (time, name) => {
      await runFfmpeg(
        [
          "-ss",
          String(time),
          "-i",
          file,
          "-frames:v",
          "1",
          "-update",
          "1",
          name,
        ],
        temp,
      );
      return sharp(path.join(temp, name))
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    };
    const early = await pixels(0.05, "fade-frame.png"),
      mid = await pixels(0.6, "subtitle-frame.png"),
      late = await pixels(1.3, "zoom-frame.png");
    assert.ok(mid.data[0] > early.data[0] + 60, "Image fades in visibly");
    let white = 0;
    for (let y = 270; y < 355; y++)
      for (let x = 20; x < 620; x++) {
        const i = (y * mid.info.width + x) * 3;
        if (mid.data[i] > 210 && mid.data[i + 1] > 210 && mid.data[i + 2] > 210)
          white++;
      }
    assert.ok(white > 100, "Subtitles are burnt into lower portion of frame");
    const blueEdge = (frame) => {
      for (let x = 0; x < 300; x++) {
        const i = (50 * frame.info.width + x) * 3;
        if (frame.data[i + 2] > frame.data[i] + 80) return x;
      }
      return 300;
    };
    assert.ok(
      blueEdge(late) < blueEdge(mid) - 4,
      "Zoom moves the image boundary between frames",
    );
  },
);
