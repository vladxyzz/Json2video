import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { dataDir } from "./config.js";

const db = new DatabaseSync(path.join(dataDir, "studio.sqlite"));
db.exec(
  "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, status TEXT NOT NULL, created_at TEXT NOT NULL, json TEXT NOT NULL, result TEXT NOT NULL, idempotency TEXT UNIQUE, hash TEXT NOT NULL);",
);
const unpack = (row) =>
  row
    ? {
        id: row.id,
        status: row.status,
        created_at: row.created_at,
        input: JSON.parse(row.json),
        ...JSON.parse(row.result),
      }
    : undefined;
export const store = {
  get: (id) => unpack(db.prepare("SELECT * FROM jobs WHERE id=?").get(id)),
  list: (limit = 100) =>
    db
      .prepare("SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?")
      .all(limit)
      .map(unpack),
  pending: () =>
    db
      .prepare(
        "SELECT * FROM jobs WHERE status IN ('pending','running') ORDER BY created_at",
      )
      .all()
      .map(unpack),
  callbacks: () =>
    db
      .prepare("SELECT * FROM jobs WHERE status IN ('done','error')")
      .all()
      .map(unpack)
      .filter((j) => j.webhook?.state === "pending"),
  findKey: (key) =>
    db.prepare("SELECT id,hash FROM jobs WHERE idempotency=?").get(key),
  create(job, key, hash) {
    db.prepare("INSERT INTO jobs VALUES (?,?,?,?,?,?,?)").run(
      job.id,
      "pending",
      job.created_at,
      JSON.stringify(job.input),
      JSON.stringify({ progress: 0, message: "Waiting" }),
      key || null,
      hash,
    );
  },
  update(id, patch) {
    const job = this.get(id);
    const { input, created_at, status, ...result } = { ...job, ...patch };
    db.prepare("UPDATE jobs SET status=?,result=? WHERE id=?").run(
      patch.status || status,
      JSON.stringify(result),
      id,
    );
    return this.get(id);
  },
};
