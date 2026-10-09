import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  apiKey,
  port,
  host,
  localMode,
  publicUrl,
  outputDir,
  workDir,
} from "./config.js";
import { validateMovie } from "../shared/schema.js";
import { examples } from "../shared/examples.js";
import { store } from "./store.js";
import { startQueue, publicJob, signFile } from "./queue.js";
import { ffmpeg } from "./renderer.js";
import { providerIssues, imageModels } from "./providers.js";
import { inspectTemplate } from "../shared/template.js";
import { templates, resolveTemplate } from "../shared/templates.js";

const app = express(),
  root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const built = fs.existsSync(path.join(root, "dist", "index.html"));
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: built
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            mediaSrc: ["'self'", publicUrl],
            connectSrc: ["'self'"],
            upgradeInsecureRequests: publicUrl.startsWith("https:") ? [] : null,
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity: publicUrl.startsWith("https:") ? undefined : false,
  }),
);
app.use(express.json({ limit: "512kb" }));
function equal(a, b) {
  const x = Buffer.from(String(a)),
    y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
const localRequest = (req) =>
  localMode &&
  ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress) &&
  /^localhost(?::\d+)?$|^127\.0\.0\.1(?::\d+)?$/.test(req.headers.host || "");
// Public, key-free facts about this deployment. The UI needs them before a key
// exists (connect screen), so they must not depend on the authenticated /api/config.
const deployment = {
  publicUrl,
  publicReady: publicUrl.startsWith("https:"),
};
app.get("/api/session", (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!localRequest(req)) return res.json({ local: false, ...deployment });
  res.json({ local: true, key: apiKey, ...deployment });
});
app.get("/healthz", (_req, res) => res.json({ ok: true }));
const auth = (req, res, next) => {
  if (!equal(req.get("x-api-key") || "", apiKey))
    return res.status(401).json({
      success: false,
      message: "The API key is missing or invalid.",
    });
  next();
};
app.use(
  ["/api", "/v2"],
  rateLimit({
    windowMs: 60000,
    limit: 180,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
  auth,
);
app.get("/api/config", (_req, res) =>
  res.json({
    publicUrl,
    publicReady: publicUrl.startsWith("https:"),
    engine: fs.existsSync(ffmpeg) ? "ready" : "missing",
    speech:
      process.platform === "win32"
        ? "Windows (English)"
        : process.env.ESPEAK_PATH
          ? "eSpeak NG"
          : "not configured",
    azureSpeech: !!(
      process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION
    ),
    fluxImages: !!process.env.BFL_API_KEY,
    imageModels,
    version: "1.1.0",
  }),
);
app.get("/api/examples", (_req, res) => res.json(examples));
app.get("/api/templates", (_req, res) =>
  res.json(
    templates.map((t) => ({ ...t, inspection: inspectTemplate(t.movie) })),
  ),
);
app.post("/api/inspect", (req, res) => {
  try {
    res.json(inspectTemplate(resolveTemplate(req.body)));
  } catch (error) {
    res.status(422).json({ message: error.message });
  }
});
app.post("/api/validate", (req, res) => {
  const parsed = validateMovie(req.body);
  res
    .status(parsed.success ? 200 : 422)
    .json(
      parsed.success
        ? {
            valid: true,
            movie: parsed.data,
            configuration: providerIssues(parsed.data),
          }
        : { valid: false, errors: parsed.error.issues },
    );
});
app.post("/v2/movies", (req, res) => {
  const parsed = validateMovie(req.body);
  if (!parsed.success)
    return res.status(422).json({
      success: false,
      message: "The JSON is not valid.",
      errors: parsed.error.issues,
    });
  const configuration = providerIssues(parsed.data);
  if (configuration.length)
    return res.status(422).json({
      success: false,
      message: configuration.join(" "),
      configuration,
    });
  const key = req.get("Idempotency-Key"),
    hash = crypto
      .createHash("sha256")
      .update(JSON.stringify(parsed.data))
      .digest("hex");
  if (key && key.length > 200)
    return res.status(400).json({
      success: false,
      message: "Idempotency-Key can be at most 200 characters long.",
    });
  const found = key ? store.findKey(key) : null;
  if (found) {
    if (found.hash !== hash)
      return res.status(409).json({
        success: false,
        message: "The same Idempotency-Key was used for different content.",
      });
    return res.json({ success: true, project: found.id, reused: true });
  }
  if (store.pending().length >= 50)
    return res.status(429).json({
      success: false,
      message: "The queue is full. Try again later.",
    });
  const job = {
    id: crypto.randomBytes(8).toString("hex"),
    input: parsed.data,
    created_at: new Date().toISOString(),
  };
  store.create(job, key, hash);
  res.status(202).json({ success: true, project: job.id, status: "pending" });
});
app.get("/v2/movies", (req, res) => {
  const id = req.query.project || req.query.id;
  if (id) {
    const job = store.get(String(id));
    return job
      ? res.json({ success: true, movie: publicJob(job) })
      : res
          .status(404)
          .json({ success: false, message: "That video does not exist." });
  }
  const jobs = store.list();
  res.json({ success: true, movies: jobs.map(publicJob), count: jobs.length });
});
// Deleting a finished or failed render removes its record and its files.
// A render that is queued or running is left alone so the worker never loses
// the job it is busy with.
app.delete("/api/movies/:id", async (req, res) => {
  const id = String(req.params.id);
  const job = /^[a-f0-9]{16}$/.test(id) ? store.get(id) : undefined;
  if (!job)
    return res.status(404).json({ message: "That video does not exist." });
  if (!["done", "error"].includes(job.status))
    return res.status(409).json({
      message: "This video is still rendering. Delete it once it has finished.",
    });
  store.remove(id);
  await Promise.all([
    fs.promises.rm(path.join(outputDir, `${id}.mp4`), { force: true }),
    fs.promises.rm(path.join(outputDir, `${id}.jpg`), { force: true }),
    fs.promises.rm(path.join(workDir, id), { recursive: true, force: true }),
  ]);
  res.json({ success: true, project: id });
});
app.get("/api/movies/:id/source", (req, res) => {
  const job = store.get(req.params.id);
  return job
    ? res.json(job.input)
    : res.status(404).json({ message: "That video does not exist." });
});
app.post("/api/movies/:id/webhook/retry", (req, res) => {
  const job = store.get(req.params.id);
  if (!job || !job.input.webhook_url || !["done", "error"].includes(job.status))
    return res
      .status(400)
      .json({ message: "This job has no finished webhook." });
  store.update(job.id, {
    webhook: { state: "pending", attempts: 0, nextAttempt: Date.now() },
  });
  res.json({ success: true });
});
app.get("/files/:file", (req, res) => {
  const match = /^([a-f0-9]{16})\.(mp4|jpg)$/.exec(req.params.file);
  const expires = Number(req.query.expires);
  if (
    !match ||
    !Number.isSafeInteger(expires) ||
    expires < Date.now() / 1000 ||
    !equal(req.query.signature || "", signFile(match?.[1], match?.[2], expires))
  )
    return res.status(403).json({
      message:
        "Invalid or expired link. Get a fresh one from the video status.",
    });
  const job = store.get(match[1]);
  if (job?.status !== "done") return res.sendStatus(404);
  res.set("Cache-Control", "private, max-age=3600");
  if (req.query.download === "1")
    res.attachment(
      `${job.input.name.replace(/[^\p{L}\p{N} ._-]/gu, "") || "video"}.${match[2]}`,
    );
  res.sendFile(path.join(outputDir, req.params.file));
});
app.use(["/api", "/v2"], (_req, res) =>
  res.status(404).json({ message: "Endpoint not found." }),
);
if (built) {
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.join(root, "dist", "index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
app.use((error, _req, res, _next) =>
  res.status(error.status || 500).json({
    success: false,
    message:
      error.type === "entity.parse.failed"
        ? "The request body is not valid JSON."
        : error.status === 413
          ? "The JSON is larger than 512 KB."
          : "Internal error. Check the server log.",
  }),
);
const server = app.listen(port, host, () => {
  console.log(`Json2vid Studio: http://${host}:${port}`);
  startQueue();
});
server.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
