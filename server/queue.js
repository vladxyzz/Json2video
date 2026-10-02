import crypto from "node:crypto";
import { store } from "./store.js";
import { renderMovie } from "./renderer.js";
import { postJson } from "./network.js";
import { publicUrl, signingKey } from "./config.js";

export function signFile(id, ext, expires) {
  return crypto
    .createHmac("sha256", signingKey)
    .update(`${id}.${ext}:${expires}`)
    .digest("hex");
}
export function fileUrl(id, ext = "mp4") {
  const expires = (Math.floor(Date.now() / 86400000) + 7) * 86400;
  return `${publicUrl}/files/${id}.${ext}?expires=${expires}&signature=${signFile(id, ext, expires)}`;
}
export function publicJob(job) {
  return {
    project: job.id,
    name: job.input.name,
    status: job.status,
    success: job.status === "done",
    progress: job.progress,
    message: job.message || "",
    created_at: job.created_at,
    ended_at: job.ended_at,
    url: job.status === "done" ? fileUrl(job.id) : null,
    thumbnail: job.status === "done" ? fileUrl(job.id, "jpg") : null,
    duration: job.duration,
    width: job.width,
    height: job.height,
    size: job.size,
    "client-data": job.input["client-data"],
    webhook: job.webhook || null,
  };
}
let busy = false,
  callbackBusy = false;
export async function tick() {
  if (busy) return;
  busy = true;
  try {
    const job = store.pending()[0];
    if (!job) return;
    store.update(job.id, {
      status: "running",
      progress: 1,
      message: "Preparing files",
    });
    const callback = job.input.webhook_url
      ? { webhook: { state: "pending", attempts: 0, nextAttempt: Date.now() } }
      : {};
    try {
      const result = await renderMovie(job, (progress, message) =>
        store.update(job.id, { progress, message }),
      );
      store.update(job.id, {
        ...result,
        ...callback,
        status: "done",
        progress: 100,
        message: "Video finished",
        ended_at: new Date().toISOString(),
      });
    } catch (error) {
      store.update(job.id, {
        ...callback,
        status: "error",
        progress: 0,
        message: error.message,
        ended_at: new Date().toISOString(),
      });
    }
  } finally {
    busy = false;
  }
}
export async function callbackTick(deliver = postJson) {
  if (callbackBusy) return;
  callbackBusy = true;
  try {
    for (const job of store.callbacks()) {
      if (job.webhook.nextAttempt > Date.now()) continue;
      const attempts = job.webhook.attempts + 1;
      try {
        const payload = {
          event: job.status === "done" ? "movie.done" : "movie.error",
          success: job.status === "done",
          project: job.id,
          movie: publicJob(job),
        };
        const headers = {};
        if (process.env.WEBHOOK_SIGNING_SECRET)
          headers["x-json2vid-signature"] = crypto
            .createHmac("sha256", process.env.WEBHOOK_SIGNING_SECRET)
            .update(JSON.stringify(payload))
            .digest("hex");
        const code = await deliver(job.input.webhook_url, payload, headers);
        store.update(job.id, {
          webhook: { state: "delivered", attempts, http_status: code },
        });
      } catch (error) {
        store.update(job.id, {
          webhook: {
            state: attempts >= 5 ? "failed" : "pending",
            attempts,
            nextAttempt:
              Date.now() + [5000, 30000, 120000, 600000, 1800000][attempts - 1],
            message: error.message,
          },
        });
      }
    }
  } finally {
    callbackBusy = false;
  }
}
export function startQueue() {
  setInterval(() => void tick().catch(console.error), 750).unref();
  setInterval(() => void callbackTick().catch(console.error), 2000).unref();
  void tick();
}
