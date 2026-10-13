import { createApp } from "../server/index.mjs";
import { hashPassword } from "../server/auth.mjs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
const directory = mkdtempSync(join(tmpdir(), "fukpages-remote-image-"));
const password = randomBytes(24).toString("base64url");
const { app, db } = createApp({
  dataDir: directory,
  ownerLogin: "owner",
  ownerHash: hashPassword(password),
});
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
try {
  const base = "http://127.0.0.1:" + server.address().port;
  const login = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login: "owner", password }),
  });
  if (!login.ok) throw new Error("Test login failed");
  const csrf = (await login.json()).csrf,
    cookie = login.headers.get("set-cookie").split(";")[0];
  const response = await fetch(base + "/api/stores/demo/assets/import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      "X-CSRF-Token": csrf,
    },
    body: JSON.stringify({
      url: "https://raw.githubusercontent.com/yusufkngg/fukpages/main/public/assets/headphones.svg",
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  if (
    result.format !== "webp" ||
    !result.width ||
    !result.height ||
    result.variants.length !== 4
  )
    throw new Error("Imported image metadata is invalid");
  console.log(
    "PASS: real HTTPS import through the proxy, persistent normalized image and four variants",
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  rmSync(directory, { recursive: true, force: true });
}
