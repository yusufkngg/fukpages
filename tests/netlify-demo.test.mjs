import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { createDemoHandler } from "../server/netlify-demo.mjs";

function memoryStore() {
  let value = null,
    version = 0;
  return {
    fail: false,
    loseResponse: false,
    conflicts: 0,
    async getWithMetadata() {
      return value ? { data: Buffer.from(value), etag: String(version) } : null;
    },
    async set(_key, data, options) {
      if (this.fail) throw new Error("storage unavailable");
      if (this.conflicts > 0) {
        this.conflicts--;
        return { modified: false };
      }
      if (
        (options.onlyIfNew && value) ||
        (options.onlyIfMatch && options.onlyIfMatch !== String(version))
      )
        return { modified: false };
      value = Buffer.from(data);
      version++;
      if (this.loseResponse) {
        this.loseResponse = false;
        throw new Error("commit response lost");
      }
      return { modified: true, etag: String(version) };
    },
  };
}
function request(path, method = "GET", body = "", headers = {}) {
  return {
    httpMethod: method,
    path: "/.netlify/functions/api" + path,
    headers: { host: "demo.example", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
    requestContext: { identity: { sourceIp: "127.0.0.1" } },
    isBase64Encoded: false,
  };
}
async function session(handler, password) {
  const login = await handler(
    request(
      "/api/auth/login",
      "POST",
      { login: "owner", password },
      { "content-type": "application/json", origin: "https://demo.example" },
    ),
  );
  assert.equal(login.statusCode, 200, login.body);
  const csrf = JSON.parse(login.body).csrf;
  const cookie =
    Object.entries(login.multiValueHeaders || {}).find(
      ([key]) => key.toLowerCase() === "set-cookie",
    )?.[1]?.[0] ||
    Object.entries(login.headers).find(
      ([key]) => key.toLowerCase() === "set-cookie",
    )?.[1];
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  return {
    cookie: cookie.split(";")[0],
    "x-csrf-token": csrf,
    "content-type": "application/json",
  };
}
test("Netlify demo persists login, edits, media and disable status across cold starts", async () => {
  const store = memoryStore(),
    password = randomBytes(24).toString("hex");
  const fresh = () => createDemoHandler({ store, password });
  let handler = fresh();
  assert.equal((await handler(request("/api/stores"))).statusCode, 401);
  assert.equal(
    JSON.parse((await handler(request("/api/auth/status"))).body).demo,
    true,
  );
  const publicPage = await handler(
    request("/api/public/stores/demo/pages/demo-store"),
  );
  assert.equal(publicPage.statusCode, 200);
  assert.equal(JSON.parse(publicPage.body).catalog.source, "local");
  const html = await handler(request("/p/demo/demo-store"));
  assert.equal(html.statusCode, 200);
  assert.match(html.body, /Aura — FukPages Demo/);
  const headers = await session(handler, password);
  let page = JSON.parse(
    (await fresh()(request("/api/pages/demo-home", "GET", "", headers))).body,
  );
  page.document.name = "Kalıcı demo düzenlemesi";
  store.conflicts = 1;
  const save = await fresh()(
    request(
      "/api/pages/demo-home",
      "PUT",
      { document: page.document, version: page.version },
      headers,
    ),
  );
  assert.equal(save.statusCode, 200, save.body);
  const reopened = JSON.parse(
    (await fresh()(request("/api/pages/demo-home", "GET", "", headers))).body,
  );
  assert.equal(reopened.document.name, page.document.name);
  assert.equal(reopened.version, page.version + 1);
  const png = await sharp({
    create: { width: 24, height: 24, channels: 3, background: "#b0d976" },
  })
    .png()
    .toBuffer();
  const boundary = "fukpages-test-boundary",
    uploadId = randomBytes(20).toString("hex");
  const multipart = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="type"\r\n\r\nimage\r\n--${boundary}\r\nContent-Disposition: form-data; name="uploadIds"\r\n\r\n["${uploadId}"]\r\n--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="demo.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    png,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const upload = {
    ...request(
      "/api/stores/demo/assets",
      "POST",
      multipart.toString("base64"),
      {
        ...headers,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
    ),
    isBase64Encoded: true,
  };
  store.loseResponse = true;
  assert.equal((await fresh()(structuredClone(upload))).statusCode, 503);
  const retried = await fresh()(structuredClone(upload));
  assert.equal(retried.statusCode, 201, retried.body);
  const asset = JSON.parse(retried.body).results[0].asset;
  const assets = JSON.parse(
    (await fresh()(request("/api/stores/demo/assets", "GET", "", headers)))
      .body,
  );
  assert.equal(assets.length, 1);
  const image = await fresh()(request(asset.url, "GET", "", headers));
  assert.equal(image.statusCode, 200);
  assert.equal(image.isBase64Encoded, true);
  assert.ok(Buffer.from(image.body, "base64").length > 0);
  const suspended = await fresh()(
    request(
      "/api/stores/demo/status",
      "PATCH",
      { status: "suspended" },
      headers,
    ),
  );
  assert.equal(suspended.statusCode, 200);
  assert.equal(
    (await fresh()(request("/api/public/stores/demo/pages/demo-store")))
      .statusCode,
    404,
  );
});
test("Netlify demo rejects unconfigured auth, persists failed attempts, rotates passwords and fails closed on storage errors", async () => {
  const store = memoryStore(),
    password = randomBytes(24).toString("hex");
  const unconfigured = createDemoHandler({ store });
  assert.equal(
    JSON.parse((await unconfigured(request("/api/auth/status"))).body)
      .configured,
    false,
  );
  assert.equal(
    (
      await unconfigured(
        request(
          "/api/auth/login",
          "POST",
          { login: "owner", password },
          { "content-type": "application/json" },
        ),
      )
    ).statusCode,
    503,
  );
  const fresh = () => createDemoHandler({ store, password });
  const headers = await session(fresh(), password);
  const rotated = createDemoHandler({
    store,
    password: randomBytes(24).toString("hex"),
  });
  assert.equal(
    (await rotated(request("/api/stores", "GET", "", headers))).statusCode,
    401,
  );
  const bad = request(
    "/api/auth/login",
    "POST",
    { login: "owner", password: "wrong" },
    { "content-type": "application/json" },
  );
  for (let i = 0; i < 5; i++)
    assert.equal((await fresh()(structuredClone(bad))).statusCode, 401);
  assert.equal((await fresh()(structuredClone(bad))).statusCode, 429);
  store.fail = true;
  const failed = await fresh()(
    request(
      "/api/auth/login",
      "POST",
      { login: "owner", password },
      {
        "content-type": "application/json",
        "x-nf-client-connection-ip": "127.0.0.2",
      },
    ),
  );
  assert.equal(failed.statusCode, 503);
  store.fail = false;
  assert.equal(
    (await fresh()(request("/api/stores", "GET", "", headers))).statusCode,
    401,
  );
});
test("Concurrent Netlify invocations preserve independent writes and enforce page versions", async () => {
  const store = memoryStore(),
    password = randomBytes(24).toString("hex");
  const fresh = () => createDemoHandler({ store, password });
  const headers = await session(fresh(), password);
  const results = await Promise.all(
    ["Birinci", "İkinci"].map((name) =>
      fresh()(
        request("/api/stores", "POST", { name, client: "Test" }, headers),
      ),
    ),
  );
  assert.deepEqual(
    results.map((r) => r.statusCode),
    [201, 201],
  );
  const stores = JSON.parse(
    (await fresh()(request("/api/stores", "GET", "", headers))).body,
  );
  assert.equal(stores.length, 3);
  const page = JSON.parse(
    (await fresh()(request("/api/pages/demo-home", "GET", "", headers))).body,
  );
  const edits = await Promise.all(
    ["A", "B"].map((name) =>
      fresh()(
        request(
          "/api/pages/demo-home",
          "PUT",
          { document: { ...page.document, name }, version: page.version },
          headers,
        ),
      ),
    ),
  );
  assert.deepEqual(edits.map((r) => r.statusCode).sort(), [200, 409]);
});
