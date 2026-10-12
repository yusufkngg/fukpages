import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { createApp } from "../server/index.mjs";
import { hashPassword } from "../server/auth.mjs";

const document = () => ({
  schemaVersion: 1,
  type: "landing",
  name: "Test page",
  nodes: [
    {
      id: "heading-1",
      kind: "heading",
      name: "Heading",
      props: { html: "<b>Sample</b>", tag: "h1" },
      styles: {
        desktop: { fontSize: "48px" },
        tablet: { fontSize: "36px" },
        mobile: { fontSize: "28px" },
      },
      hidden: { desktop: false, tablet: false, mobile: false },
      children: [],
    },
  ],
});
async function fixture(t, configured = true) {
  const dataDir = mkdtempSync(join(tmpdir(), "fukpages-test-"));
  const password = randomBytes(24).toString("base64url");
  const { app, db } = createApp({
    dataDir,
    ownerHash: configured ? hashPassword(password) : undefined,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    rmSync(dataDir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = "",
    csrf = "";
  async function request(
    path,
    method = "GET",
    body,
    authorized = true,
    csrfHeader = true,
  ) {
    return fetch(`${base}/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(authorized && cookie ? { Cookie: cookie } : {}),
        ...(csrfHeader && csrf ? { "X-CSRF-Token": csrf } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }
  async function login() {
    const result = await request("/auth/login", "POST", {
      login: "owner",
      password,
    });
    assert.equal(result.status, 200);
    cookie = result.headers.get("set-cookie").split(";")[0];
    csrf = (await result.json()).csrf;
    assert.ok(result.headers.get("set-cookie").includes("HttpOnly"));
  }
  return { request, login, db, dataDir };
}
test("owner authentication and CSRF protect management; logout invalidates the session", async (t) => {
  const { request, login } = await fixture(t);
  assert.equal((await request("/stores")).status, 401);
  assert.equal(
    (
      await request("/auth/login", "POST", {
        login: "owner",
        password: "wrong",
      })
    ).status,
    401,
  );
  await login();
  assert.equal((await request("/stores")).status, 200);
  assert.equal(
    (await request("/stores", "POST", { name: "Other store" }, true, false))
      .status,
    403,
  );
  assert.equal((await request("/auth/logout", "POST", {})).status, 200);
  assert.equal((await request("/stores")).status, 401);
});
test("unconfigured owner account cannot be claimed through the API", async (t) => {
  const { request } = await fixture(t, false);
  assert.equal(
    (await request("/auth/status").then((r) => r.json())).configured,
    false,
  );
  assert.equal(
    (
      await request("/auth/login", "POST", {
        login: "owner",
        password: "anything",
      })
    ).status,
    503,
  );
  assert.equal((await request("/stores", "POST", { name: "A" })).status, 401);
});
test("login failures are limited after five attempts", async (t) => {
  const { request } = await fixture(t);
  for (let i = 0; i < 5; i++)
    assert.equal(
      (
        await request("/auth/login", "POST", {
          login: "owner",
          password: "wrong",
        })
      ).status,
      401,
    );
  assert.equal(
    (
      await request("/auth/login", "POST", {
        login: "owner",
        password: "wrong",
      })
    ).status,
    429,
  );
});
test("saved responsive values persist and concurrent stale writes are rejected", async (t) => {
  const { request, login } = await fixture(t);
  await login();
  const created = await request("/stores/demo/pages", "POST", {
    document: document(),
  }).then((r) => r.json());
  const updated = document();
  updated.nodes[0].styles.mobile.fontSize = "22px";
  assert.equal(
    (
      await request(`/pages/${created.id}`, "PUT", {
        document: updated,
        version: 1,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/pages/${created.id}`, "PUT", {
        document: document(),
        version: 1,
      })
    ).status,
    409,
  );
  const stored = await request(`/pages/${created.id}`).then((r) => r.json());
  assert.equal(stored.document.nodes[0].styles.desktop.fontSize, "48px");
  assert.equal(stored.document.nodes[0].styles.tablet.fontSize, "36px");
  assert.equal(stored.document.nodes[0].styles.mobile.fontSize, "22px");
});
test("suspending one store removes its local publications and blocks edits without affecting another store", async (t) => {
  const { request, login } = await fixture(t);
  await login();
  const other = await request("/stores", "POST", {
    name: "Second",
    client: "Other customer",
  }).then((r) => r.json());
  const page = await request("/stores/demo/pages", "POST", {
    document: document(),
  }).then((r) => r.json());
  const otherPage = await request(`/stores/${other.id}/pages`, "POST", {
    document: document(),
  }).then((r) => r.json());
  for (const id of [page.id, otherPage.id])
    assert.equal(
      (await request(`/pages/${id}/publish`, "POST", {})).status,
      200,
    );
  assert.equal(
    (await request(`/public/pages/${page.id}`, "GET", undefined, false)).status,
    200,
  );
  assert.equal(
    (await request("/stores/demo/status", "PATCH", { status: "suspended" }))
      .status,
    200,
  );
  assert.equal(
    (await request(`/public/pages/${page.id}`, "GET", undefined, false)).status,
    404,
  );
  assert.equal(
    (await request(`/public/pages/${otherPage.id}`, "GET", undefined, false))
      .status,
    200,
  );
  assert.equal(
    (await request(`/pages/${page.id}/publish`, "POST", {})).status,
    403,
  );
  assert.equal(
    (
      await request(`/pages/${page.id}`, "PUT", {
        document: document(),
        version: 1,
      })
    ).status,
    403,
  );
  assert.equal(
    (await request("/stores/demo/pages", "POST", { document: document() }))
      .status,
    403,
  );
  await request("/stores/demo/status", "PATCH", { status: "active" });
  assert.equal(
    (await request(`/public/pages/${page.id}`, "GET", undefined, false)).status,
    404,
  );
  assert.equal(
    (await request(`/pages/${page.id}/publish`, "POST", {})).status,
    200,
  );
  assert.equal(
    (await request(`/public/pages/${page.id}`, "GET", undefined, false)).status,
    200,
  );
});
test("import/save reject invalid trees and unsafe CSS; rich text and links are sanitized", async (t) => {
  const { request, login } = await fixture(t);
  await login();
  const payload = document();
  payload.nodes[0].props.html =
    "<img src=x onerror=alert(1)><script>alert(1)</script><b>Safe</b>";
  payload.nodes[0].props.href = "javascript:alert(1)";
  const stored = await request("/stores/demo/pages", "POST", {
    document: payload,
  }).then((r) => r.json());
  assert.equal(stored.document.nodes[0].props.html, "<b>Safe</b>");
  assert.equal(stored.document.nodes[0].props.href, "");
  const unsafe = document();
  unsafe.nodes[0].styles.desktop.backgroundColor = "url(https://example.com)";
  assert.equal(
    (await request("/documents/validate", "POST", { document: unsafe })).status,
    400,
  );
  const duplicate = document();
  duplicate.nodes.push(structuredClone(duplicate.nodes[0]));
  assert.equal(
    (await request("/documents/validate", "POST", { document: duplicate }))
      .status,
    400,
  );
});
