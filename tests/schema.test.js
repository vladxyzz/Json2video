import test from "node:test";
import assert from "node:assert/strict";
import { validateMovie, dimensions } from "../shared/schema.js";
import { isPublicAddress, safeRequest } from "../server/network.js";
import { examples } from "../shared/examples.js";

test("toate exemplele se validează și variabilele sunt expandate", () => {
  for (const example of examples) {
    const result = validateMovie(example.movie);
    assert.equal(result.success, true, JSON.stringify(result.error));
  }
  const result = validateMovie(examples.find((e) => e.id === "manifest").movie);
  assert.equal(result.data.scenes[0].elements[0].text, "STUDIO / 001");
  assert.deepEqual(dimensions(result.data), [720, 1280]);
});
test("JSON necunoscut, variabile lipsă și durate invalide sunt respinse", () => {
  assert.equal(
    validateMovie({
      scenes: [
        { duration: 1, elements: [{ type: "html", html: "<script/>" }] },
      ],
    }).success,
    false,
  );
  assert.equal(
    validateMovie({
      scenes: [
        { duration: 1, elements: [{ type: "text", text: "{{missing}}" }] },
      ],
    }).success,
    false,
  );
  assert.equal(
    validateMovie({
      scenes: [
        { duration: 1, elements: [{ type: "text", text: "x", start: 2 }] },
      ],
    }).success,
    false,
  );
  assert.equal(
    validateMovie({
      scenes: [{ duration: 1, elements: [] }],
      elements: [{ type: "audio", src: "https://example.org/a.wav", start: 2 }],
    }).success,
    false,
  );
  assert.equal(
    validateMovie({ scenes: [{ duration: 1 }], unknown: true }).success,
    false,
  );
  assert.equal(
    validateMovie({
      scenes: [
        { duration: 250 },
        { duration: 250 },
        { duration: 250 },
        { duration: 250 },
      ],
    }).success,
    false,
  );
});
test("SSRF: adrese private, mapped IPv6 și protocoale nesigure sunt blocate", async () => {
  for (const ip of [
    "127.0.0.1",
    "10.2.3.4",
    "169.254.169.254",
    "192.168.1.1",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "100.64.0.1",
    "0.0.0.0",
  ])
    assert.equal(isPublicAddress(ip), false, ip);
  assert.equal(isPublicAddress("8.8.8.8"), true);
  await assert.rejects(safeRequest("file:///etc/passwd"));
  await assert.rejects(safeRequest("http://example.com"));
  await assert.rejects(safeRequest("https://127.0.0.1"));
  await assert.rejects(safeRequest("https://user:password@example.com"));
});
