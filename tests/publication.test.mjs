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
  const dir = mkdtempSync(join(tmpdir(), "fukpages-publication-")),
    password = randomBytes(24).toString("hex"),
    service = createApp({ dataDir: dir, ownerHash: hashPassword(password) }),
    server = service.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login: "owner", password }),
  });
  const cookie = login.headers.get("set-cookie").split(";")[0],
    csrf = (await login.json()).csrf;
  const request = (path, method = "GET", body) =>
    fetch(base + "/api" + path, {
      method,
      headers: {
        Cookie: cookie,
        "X-CSRF-Token": csrf,
        "Content-Type": "application/json",
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  const api = async (path, method = "GET", body) => {
    const r = await request(path, method, body);
    assert.ok(r.ok, `${path}: ${r.status} ${await r.clone().text()}`);
    return r.json();
  };
  t.after(async () => {
    await new Promise((r) => server.close(r));
    service.db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return { request, api, base, service };
}

test("B3: publish, restore and schedule share one route rule and give the same 409 without writing", async (t) => {
  const { request, api, base, service } = await fixture(t);
  const page = async (name, slug) => {
    const document = pageTemplate("landing");
    document.name = name;
    document.seo = { ...(document.seo || {}), slug };
    return (await api("/stores/demo/pages", "POST", { document })).id;
  };
  const setSlug = async (id, slug) => {
    const current = await api("/pages/" + id);
    current.document.seo = { ...(current.document.seo || {}), slug };
    await api("/pages/" + id, "PUT", {
      document: current.document,
      version: current.version,
    });
  };
  const publications = () =>
    service.db.prepare("SELECT page_id,active FROM publications").all();
  const a = await page("Sale A", "sale");
  const b = await page("Sale B", "sale");
  await api(`/pages/${a}/publish`, "POST");
  // Manual publish of the second page with the same address.
  const manual = await request(`/pages/${b}/publish`, "POST");
  assert.equal(manual.status, 409);
  const manualBody = await manual.json();
  assert.equal(manualBody.code, "route-conflict");
  assert.equal(manualBody.conflictPageId, a);
  assert.ok(!publications().some((p) => p.page_id === b));
  // B gets the route while A is offline, then A takes it back.
  await api(`/pages/${a}/publish`, "DELETE");
  await api(`/pages/${b}/publish`, "POST");
  const [history] = await api(`/pages/${b}/publications`);
  await api(`/pages/${b}/publish`, "DELETE");
  await api(`/pages/${a}/publish`, "POST");
  // Restoring B's earlier publication meets the same rule.
  const before = JSON.stringify(publications());
  const restore = await request(
    `/pages/${b}/publications/${history.id}/restore`,
    "POST",
  );
  assert.equal(restore.status, 409);
  assert.equal((await restore.json()).code, "route-conflict");
  assert.equal(JSON.stringify(publications()), before);
  // Scheduling the conflicting draft is refused up front.
  const scheduled = await request(`/pages/${b}/schedule`, "PUT", {
    publishAt: Date.now() + 60_000,
  });
  assert.equal(scheduled.status, 409);
  assert.equal((await scheduled.json()).code, "route-conflict");
  // A schedule that becomes conflicting later is marked, not applied.
  await setSlug(b, "later");
  await api(`/pages/${b}/schedule`, "PUT", { publishAt: Date.now() + 400 });
  await setSlug(b, "sale");
  await new Promise((r) => setTimeout(r, 500));
  await fetch(base + `/api/public/pages/${a}`);
  const job = await api(`/pages/${b}/schedule`);
  assert.equal(job.status, "conflict");
  assert.match(job.error, /kısa adres/);
  assert.equal(JSON.stringify(publications()), before);
  // Without a conflict the schedule publishes through the same service.
  await setSlug(b, "spring");
  await api(`/pages/${b}/schedule`, "PUT", { publishAt: Date.now() + 300 });
  await new Promise((r) => setTimeout(r, 400));
  assert.equal((await fetch(base + `/api/public/pages/${b}`)).status, 200);
  assert.equal((await api(`/pages/${b}/publications`)).length, 2);
});
