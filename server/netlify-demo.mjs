import serverless from "serverless-http";
import { createApp } from "./index.mjs";
import { seedDemo } from "./demo.mjs";
import { hashPassword, verifyPassword } from "./auth.mjs";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { gzipSync, gunzipSync } from "node:zlib";

const STATE_KEY = "snapshot-v1";
const MAX_STATE = 32 * 1024 * 1024;
const MAX_EXPANDED = 64 * 1024 * 1024;
const errorResponse = (statusCode, error) => ({
  statusCode,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
  body: JSON.stringify({ error }),
});
function files(root, dir = "") {
  return readdirSync(resolve(root, dir), { withFileTypes: true }).flatMap(
    (entry) => {
      const path = dir ? dir + "/" + entry.name : entry.name;
      if (entry.isDirectory()) return files(root, path);
      if (
        entry.isFile() &&
        (path === "fukpages.sqlite" || path.startsWith("assets/"))
      )
        return [[path, readFileSync(resolve(root, path)).toString("base64")]];
      return [];
    },
  );
}
function pack(root) {
  const data = Buffer.from(JSON.stringify({ version: 1, files: files(root) }));
  if (data.length > MAX_EXPANDED)
    throw new RangeError(
      "Demo depolama sınırına ulaşıldı. Kaydedilmeyen taslağı dışa aktar; medya kütüphanesini küçült veya kalıcı sunucuya geç.",
    );
  const packed = gzipSync(data);
  if (packed.length > MAX_STATE)
    throw new RangeError(
      "Demo depolama sınırına ulaşıldı. Kaydedilmeyen taslağı dışa aktar; medya kütüphanesini küçült veya kalıcı sunucuya geç.",
    );
  return packed;
}
function restore(root, data) {
  const snapshot = JSON.parse(
    gunzipSync(Buffer.from(data), { maxOutputLength: MAX_EXPANDED }).toString(),
  );
  if (snapshot.version !== 1 || !Array.isArray(snapshot.files))
    throw new Error("Unsupported snapshot");
  for (const [path, bytes] of snapshot.files) {
    if (
      !/^(fukpages\.sqlite|assets\/[\w./-]+)$/.test(path) ||
      path.split("/").includes("..")
    )
      throw new Error("Unsafe snapshot path");
    const target = resolve(root, path);
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    writeFileSync(target, Buffer.from(bytes, "base64"), { mode: 0o600 });
  }
}
function credential(db, { password, ownerHash, ownerLogin = "owner" }) {
  const old =
    db
      .prepare("SELECT value FROM demo_settings WHERE key='owner-credential'")
      .get()?.value || "";
  const previous = old ? JSON.parse(old) : { hash: "", login: "" };
  let hash = "";
  if (ownerHash) {
    if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(ownerHash))
      throw new Error("Invalid owner hash");
    hash = ownerHash;
  } else if (password) {
    if (password.length < 12 || password.length > 1024)
      throw new Error("Invalid demo password");
    hash = verifyPassword(password, previous.hash)
      ? previous.hash
      : hashPassword(password);
  }
  if (hash !== previous.hash || ownerLogin !== previous.login) {
    db.prepare("DELETE FROM sessions").run();
    db.prepare(
      "INSERT INTO demo_settings VALUES('owner-credential',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    ).run(JSON.stringify({ hash, login: ownerLogin }));
  }
  return hash;
}
// Every invocation uses an isolated SQLite database. A strong-consistency,
// conditional write commits DB + media together before returning success.
// On contention the full request is re-evaluated against the latest version.
export function createDemoHandler({
  store,
  password,
  ownerHash,
  ownerLogin = "owner",
  secureCookies = true,
} = {}) {
  return async (input, context = {}) => {
    const body = input.body || "";
    if (
      Buffer.byteLength(body, input.isBase64Encoded ? "base64" : "utf8") >
      4 * 1024 * 1024
    )
      return errorResponse(
        413,
        "Netlify demosunda tek yükleme 4 MB altında olmalı. Daha küçük dosyalarla tekrar dene.",
      );
    const event = {
      ...input,
      body,
      headers: input.headers || {},
      requestContext: {
        ...input.requestContext,
        identity: {
          ...input.requestContext?.identity,
          sourceIp:
            input.headers?.["x-nf-client-connection-ip"] ||
            input.requestContext?.identity?.sourceIp ||
            "unknown",
        },
      },
    };
    for (let attempt = 0; attempt < 5; attempt++) {
      const dir = mkdtempSync(resolve(tmpdir(), "fukpages-netlify-"));
      let db;
      try {
        const saved = await store.getWithMetadata(STATE_KEY, {
          type: "arrayBuffer",
          consistency: "strong",
        });
        if (saved) restore(dir, saved.data);
        const before = existsSync(resolve(dir, "fukpages.sqlite"))
          ? createHash("sha256")
              .update(readFileSync(resolve(dir, "fukpages.sqlite")))
              .digest("hex")
          : "";
        // First initialize/migrate the database. No HTTP requests use this app.
        const initial = createApp({
          dataDir: dir,
          ownerHash: "",
          ownerLogin,
          demoMode: true,
          secureCookies,
        });
        db = initial.db;
        seedDemo(db);
        const hash = credential(db, { password, ownerHash, ownerLogin });
        db.close();
        db = null;
        const service = createApp({
          dataDir: dir,
          ownerHash: hash,
          ownerLogin,
          demoMode: true,
          secureCookies,
        });
        db = service.db;
        service.studio.runSchedules();
        const response = await serverless(service.app, {
          basePath: "/.netlify/functions/api",
          binary: ["image/*", "font/*", "application/octet-stream"],
        })(event, context);
        db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
        db.close();
        db = null;
        const after = createHash("sha256")
          .update(readFileSync(resolve(dir, "fukpages.sqlite")))
          .digest("hex");
        if (saved && before === after) return response;
        const data = pack(dir);
        const committed = await store.set(STATE_KEY, data, {
          ...(saved ? { onlyIfMatch: saved.etag } : { onlyIfNew: true }),
          metadata: { version: 1 },
        });
        if (committed.modified) return response;
      } catch (error) {
        // Never return a successful mutation before durable storage succeeds.
        return errorResponse(
          error instanceof RangeError ? 507 : 503,
          error instanceof RangeError
            ? error.message
            : "Demo kaydı şu anda tamamlanamadı. Taslağın korunur; biraz sonra tekrar dene.",
        );
      } finally {
        if (db) db.close();
        rmSync(dir, { recursive: true, force: true });
      }
    }
    return errorResponse(
      409,
      "Aynı anda başka bir kayıt yapıldı. Sayfayı yenileyip tekrar dene; yerel taslağın korunur.",
    );
  };
}
