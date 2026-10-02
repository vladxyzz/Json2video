import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const dataDir = path.resolve(process.env.DATA_DIR || "data");
fs.mkdirSync(dataDir, { recursive: true });
export const outputDir = path.join(dataDir, "renders");
export const workDir = path.join(dataDir, "work");
for (const dir of [outputDir, workDir]) fs.mkdirSync(dir, { recursive: true });
const secretPath = path.join(dataDir, "local-key");
if (!process.env.API_KEY && !fs.existsSync(secretPath))
  fs.writeFileSync(secretPath, crypto.randomBytes(32).toString("hex"), {
    mode: 0o600,
  });
export const apiKey =
  process.env.API_KEY || fs.readFileSync(secretPath, "utf8").trim();
if (apiKey.length < 24)
  throw new Error("API_KEY must be at least 24 characters long.");
export const port = Number(process.env.PORT || 3000);
export const publicUrl = (
  process.env.PUBLIC_BASE_URL || `http://localhost:${port}`
).replace(/\/$/, "");
export const signingKey = process.env.DOWNLOAD_SIGNING_KEY || apiKey;
export const localMode =
  !process.env.PUBLIC_BASE_URL && process.env.HOST !== "0.0.0.0";
export const host = process.env.HOST || "127.0.0.1";
