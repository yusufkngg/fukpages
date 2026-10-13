import { zipFunctions } from "@netlify/zip-it-and-ship-it";
import {
  readFileSync,
  mkdirSync,
  writeFileSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { parse } from "smol-toml";
import { unzipSync } from "fflate";
import { BlobsServer } from "@netlify/blobs/server";
import { setEnvironmentContext } from "@netlify/blobs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import sharp from "sharp";

const config = parse(readFileSync("netlify.toml", "utf8"));
mkdirSync(".netlify/function-check", { recursive: true });
const results = await zipFunctions(
  config.build.functions,
  ".netlify/function-check",
  {
    basePath: process.cwd(),
    config: {
      "*": {
        nodeBundler: config.functions.node_bundler,
        nodeVersion: "24.x",
        externalNodeModules: config.functions.external_node_modules,
        includedFiles: config.functions.included_files,
        includedFilesBasePath: process.cwd(),
      },
    },
    manifest: resolve(".netlify/function-check/manifest.json"),
  },
);
if (results.length !== 1 || results[0].name !== "api")
  throw new Error("Netlify API bundle missing");
const temp = mkdtempSync(resolve(tmpdir(), "fukpages-netlify-bundle-"));
const root = process.cwd();
const credentialNames = [
  "FUKPAGES_DEMO_PASSWORD",
  "OWNER_PASSWORD_HASH",
  "OWNER_LOGIN",
  "SHOPIFY_SHOP_DOMAIN",
  "SHOPIFY_ADMIN_ACCESS_TOKEN",
  "FUKPAGES_AI_API_KEY",
  "FORM_WEBHOOK_URL",
  "FORM_WEBHOOK_SECRET",
];
const previousEnvironment = Object.fromEntries(
  credentialNames.map((name) => [name, process.env[name]]),
);
for (const name of credentialNames) delete process.env[name];
const blobServer = new BlobsServer({
  directory: resolve(temp, "blobs"),
  token: "fixture-only",
  logger: () => {},
});
try {
  const archive = unzipSync(readFileSync(results[0].path));
  for (const [name, bytes] of Object.entries(archive)) {
    assert.ok(!name.split("/").includes(".."));
    assert.ok(
      !/(^|\/)\.local\/|(^|\/)\.env($|\.)|\.(sqlite(?:-wal|-shm)?|hash)$/.test(
        name,
      ),
      "Runtime/private file included: " + name,
    );
    const target = resolve(temp, "function", name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
  const { port } = await blobServer.start();
  setEnvironmentContext({
    siteID: "fixture-site",
    token: "fixture-only",
    apiURL: `http://127.0.0.1:${port}`,
  });
  process.env.FUKPAGES_DEMO_PASSWORD = randomBytes(24).toString("hex");
  process.chdir(resolve(temp, "function"));
  const { default: handler } = await import(
    pathToFileURL(resolve("netlify/functions/api.mjs")).href
  );
  const call = (path, options = {}) =>
    handler(new Request("https://demo.example" + path, options), {
      ip: "127.0.0.1",
    });
  assert.equal((await call("/api/stores")).status, 401);
  assert.equal(
    (await call("/api/public/stores/demo/pages/demo-store")).status,
    200,
  );
  const html = await call("/p/demo/demo-store");
  assert.match(await html.text(), /Aura — FukPages Demo/);
  const login = await call("/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://demo.example",
    },
    body: JSON.stringify({
      login: "owner",
      password: process.env.FUKPAGES_DEMO_PASSWORD,
    }),
  });
  assert.equal(login.status, 200, await login.clone().text());
  const cookie = login.headers.get("set-cookie").split(";")[0],
    csrf = (await login.json()).csrf;
  const headers = {
    cookie,
    "x-csrf-token": csrf,
    "content-type": "application/json",
  };
  const page = await (await call("/api/pages/demo-home", { headers })).json();
  page.document.name = "Paket testi kaydı";
  const saved = await call("/api/pages/demo-home", {
    method: "PUT",
    headers,
    body: JSON.stringify({ document: page.document, version: page.version }),
  });
  assert.equal(saved.status, 200, await saved.clone().text());
  assert.equal(
    (await (await call("/api/pages/demo-home", { headers })).json()).document
      .name,
    "Paket testi kaydı",
  );
  const multipart = new FormData();
  const png = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#b0d976" },
  })
    .png()
    .toBuffer();
  multipart.append("type", "image");
  multipart.append("files", new Blob([png], { type: "image/png" }), "demo.png");
  const uploaded = await call("/api/stores/demo/assets", {
    method: "POST",
    headers: { cookie, "x-csrf-token": csrf },
    body: multipart,
  });
  assert.equal(uploaded.status, 201, await uploaded.clone().text());
  const asset = (await uploaded.json()).results[0].asset;
  const image = await call(asset.url, { headers: { cookie } });
  assert.equal(image.status, 200);
  assert.match(image.headers.get("content-type"), /^image\//);
  assert.ok((await image.arrayBuffer()).byteLength > 0);
  const fontUpload = new FormData();
  fontUpload.append("type", "font");
  fontUpload.append("family", "Bundle Review Font");
  fontUpload.append(
    "files",
    new Blob([
      readFileSync(resolve(root, "tests/fixtures/ABeeZee-Regular.ttf")),
    ]),
    "regular.ttf",
  );
  const fontResult = await call("/api/stores/demo/assets", {
    method: "POST",
    headers: { cookie, "x-csrf-token": csrf },
    body: fontUpload,
  });
  assert.equal(fontResult.status, 201, await fontResult.clone().text());
  const font = (await fontResult.json()).results[0].asset;
  assert.equal(font.format, "woff2");
  assert.equal((await call(font.url, { headers: { cookie } })).status, 200);
  console.log(
    "Netlify Node 24 bundle: private files excluded; official local Blobs server, login, durable edit, native image upload, TTF-to-WOFF2 conversion and file delivery passed. Live Netlify deployment still requires an account.",
  );
} finally {
  process.chdir(root);
  for (const [name, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  await blobServer.stop();
  rmSync(temp, { recursive: true, force: true });
}
