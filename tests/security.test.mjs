import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { createApp } from "../server/index.mjs";
import { hashPassword } from "../server/auth.mjs";
import { pageTemplate } from "../src/pageTemplates.ts";

async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "fukpages-security-")),
    password = randomBytes(24).toString("hex"),
    service = createApp({ dataDir: dir, ownerHash: hashPassword(password) }),
    server = service.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = async (name, secret) => {
    const r = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: name, password: secret }),
    });
    assert.equal(r.status, 200, name);
    return {
      cookie: r.headers.get("set-cookie").split(";")[0],
      csrf: (await r.json()).csrf,
    };
  };
  const as =
    (who) =>
    (path, method = "GET", body) =>
      fetch(base + path, {
        method,
        headers: {
          Cookie: who.cookie,
          "X-CSRF-Token": who.csrf,
          "Content-Type": "application/json",
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
  const owner = as(await login("owner", password));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    service.db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { owner, as, login, base };
}

test("team roles are confined to their stores whatever the path spelling", async (t) => {
  const f = await fixture(t);
  const other = await (
    await f.owner("/api/stores", "POST", { name: "Başka" })
  ).json();
  const ownPage = await (
    await f.owner("/api/stores/demo/pages", "POST", {
      document: pageTemplate("landing"),
    })
  ).json();
  const otherPage = await (
    await f.owner(`/api/stores/${other.id}/pages`, "POST", {
      document: pageTemplate("landing"),
    })
  ).json();
  const people = {};
  for (const role of ["editor", "viewer"]) {
    const secret = randomBytes(24).toString("hex");
    assert.equal(
      (
        await f.owner("/api/team", "POST", {
          login: role,
          password: secret,
          role,
          stores: ["demo"],
        })
      ).status,
      201,
    );
    people[role] = f.as(await f.login(role, secret));
  }
  const variants = (path) => [
    path,
    path.replace("/api/", "/API/"),
    path.replace("/api/", "/Api/"),
    path.replace("/api/", "/api//"),
    path.replace("/api/", "//api/"),
    path.replace("/stores/", "/Stores/"),
    path.replace("/stores/", "/stores%2F").replace(/%2F([^/]+)\//, "%2F$1/"),
  ];
  for (const role of ["editor", "viewer"]) {
    const call = people[role];
    // Their own store works…
    assert.equal((await call("/api/stores/demo/pages")).status, 200, role);
    assert.equal((await call(`/api/pages/${ownPage.id}`)).status, 200, role);
    // …another store never does, however the path is written.
    for (const path of [
      `/api/stores/${other.id}/pages`,
      `/api/pages/${otherPage.id}`,
      `/api/stores/${other.id}/catalog`,
    ])
      for (const variant of variants(path)) {
        const r = await call(variant);
        assert.ok(
          [403, 404].includes(r.status),
          `${role} ${variant} → ${r.status}`,
        );
        const text = await r.text();
        assert.ok(!text.includes('"schemaVersion"'), variant);
      }
    for (const variant of variants(`/api/pages/${otherPage.id}`)) {
      const r = await call(variant, "PUT", { document: {}, version: 1 });
      assert.ok([403, 404].includes(r.status), `${role} PUT ${variant}`);
    }
    for (const path of ["/api/team", "/API/team", "/api/stores"])
      assert.ok(
        [403, 404].includes(
          (await call(path, "POST", { name: "x", login: "x" })).status,
        ),
        `${role} POST ${path}`,
      );
  }
  // Viewers never write, even in their own store.
  const viewer = people.viewer;
  for (const [path, method] of [
    [`/api/pages/${ownPage.id}/publish`, "POST"],
    [`/api/pages/${ownPage.id}/trash`, "POST"],
    ["/api/stores/demo/pages", "POST"],
    ["/API/stores/demo/pages", "POST"],
  ])
    assert.ok(
      [403, 404].includes((await viewer(path, method, {})).status),
      `viewer ${method} ${path}`,
    );
  const after = await (await f.owner(`/api/pages/${otherPage.id}`)).json();
  assert.equal(after.version, otherPage.version ?? 1, "no write reached it");
  // The owner keeps the exact routes only.
  assert.equal((await f.owner("/API/stores")).status, 404);
  assert.equal((await f.owner("/api/stores")).status, 200);
});

test("form and event rate limits persist across restarts and cap rotating visitors", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "fukpages-rate-")),
    password = randomBytes(24).toString("hex");
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const start = async () => {
    const service = createApp({
      dataDir: dir,
      ownerHash: hashPassword(password),
    });
    const server = service.app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    return {
      base: `http://127.0.0.1:${server.address().port}`,
      stop: () =>
        new Promise((r) => server.close(r)).then(() => service.db.close()),
    };
  };
  let app = await start();
  const login = await fetch(app.base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login: "owner", password }),
  });
  const cookie = login.headers.get("set-cookie").split(";")[0],
    csrf = (await login.json()).csrf;
  const owner = (path, method = "GET", body) =>
    fetch(app.base + path, {
      method,
      headers: {
        Cookie: cookie,
        "X-CSRF-Token": csrf,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const form = {
    id: "form",
    kind: "form",
    name: "form",
    props: {},
    styles: { desktop: {}, tablet: {}, mobile: {} },
    hidden: { desktop: false, tablet: false, mobile: false },
    children: [],
  };
  const page = await (
    await owner("/api/stores/demo/pages", "POST", {
      document: {
        schemaVersion: 1,
        type: "landing",
        name: "Form",
        nodes: [form],
      },
    })
  ).json();
  await owner(`/api/pages/${page.id}/publish`, "POST", {});
  const send = (ip) =>
    fetch(`${app.base}/api/public/pages/${page.id}/forms/form`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-nf-client-connection-ip": ip,
      },
      body: JSON.stringify({
        requestId: randomBytes(16).toString("hex"),
        values: {},
      }),
    }).then((r) => r.status);
  for (let i = 0; i < 5; i++) assert.notEqual(await send("10.0.0.1"), 429);
  assert.equal(await send("10.0.0.1"), 429);
  // A new instance (as on Netlify) keeps the count.
  await app.stop();
  app = await start();
  assert.equal(await send("10.0.0.1"), 429, "the limit survives a restart");
  assert.notEqual(await send("10.0.0.2"), 429);
  // Rotating addresses still meet the form-wide cap.
  let blocked = 0;
  for (let i = 0; i < 70; i++)
    if ((await send("10.1.0." + i)) === 429) blocked++;
  assert.ok(blocked >= 9, String(blocked));
  await app.stop();
});
