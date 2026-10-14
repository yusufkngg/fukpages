import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { createApp } from "../server/index.mjs";
import { hashPassword } from "../server/auth.mjs";
import { pageTemplate } from "../src/pageTemplates.ts";
import {
  assignmentsTakenBy,
  canCreatePageType,
  canDuplicatePageType,
  primaryPage,
  showsAssignments,
} from "../src/pageRules.ts";

async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "fukpages-lifecycle-")),
    password = randomBytes(24).toString("hex"),
    service = createApp({ dataDir: dir, ownerHash: hashPassword(password) }),
    server = service.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const session = async (login, secret) => {
    const r = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password: secret }),
    });
    return {
      cookie: r.headers.get("set-cookie").split(";")[0],
      csrf: (await r.json()).csrf,
    };
  };
  const owner = await session("owner", password);
  const requestAs =
    (who) =>
    (path, method = "GET", body) =>
      fetch(base + (path.startsWith("/p/") ? "" : "/api") + path, {
        method,
        headers: {
          ...(who ? { Cookie: who.cookie, "X-CSRF-Token": who.csrf } : {}),
          "Content-Type": "application/json",
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
  const request = requestAs(owner);
  const api = async (path, method = "GET", body) => {
    const r = await request(path, method, body);
    assert.ok(r.ok, `${path}: ${r.status} ${await r.clone().text()}`);
    return r.json();
  };
  const create = (type, name) => {
    const document = pageTemplate(type);
    if (name) document.name = name;
    return api("/stores/demo/pages", "POST", { document });
  };
  t.after(async () => {
    await new Promise((r) => server.close(r));
    service.db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return {
    request,
    requestAs,
    api,
    create,
    session,
    service,
    overview: () => api("/stores/demo/page-overview"),
    publicHome: () => requestAs(null)("/public/stores/demo/home"),
  };
}
const product = (id) => ({
  id,
  title: "Ürün " + id,
  description: "",
  currency: "TRY",
  images: [],
  variants: [{ id: id + "-v", title: "Standart", price: 1000, stock: 5 }],
});

test("shared page rules: one homepage, copies for everything else", () => {
  const pages = [
    { id: "h", type: "home", name: "Ana", updated: 1, assignments: ["home"] },
    { id: "a", type: "product", name: "A", updated: 2, assignments: ["p1"] },
    { id: "b", type: "product", name: "B", updated: 3, assignments: [] },
  ];
  assert.equal(canCreatePageType("home", pages), false);
  assert.equal(canCreatePageType("home", pages.slice(1)), true);
  assert.equal(canCreatePageType("product", pages), true);
  assert.equal(canDuplicatePageType("home"), false);
  for (const type of ["product", "collection", "landing", "page"])
    assert.equal(canDuplicatePageType(type), true, type);
  assert.deepEqual(assignmentsTakenBy(pages[2], pages), { p1: "A" });
  assert.deepEqual(assignmentsTakenBy(pages[1], pages), {});
  assert.equal(showsAssignments("home", pages), false);
  assert.equal(showsAssignments("product", pages), true);
  const legacy = [
    ...pages,
    { id: "h2", type: "home", name: "Eski", updated: 9, published: true },
  ];
  assert.equal(showsAssignments("home", legacy), true);
  assert.equal(primaryPage(legacy, "home").id, "h", "assigned home wins");
  assert.equal(
    primaryPage(
      legacy.map((p) => ({ ...p, assignments: [] })),
      "home",
    ).id,
    "h2",
    "then the published one",
  );
});

test("a store keeps a single homepage: create, duplicate, type change and transfer are refused", async (t) => {
  const f = await fixture(t);
  const home = await f.create("home", "Ana sayfa");
  const listed = (await f.overview()).find((p) => p.id === home.id);
  assert.deepEqual(listed.assignments, ["home"], "the homepage routes home");
  await f.api(`/pages/${home.id}/publish`, "POST", {});
  assert.equal((await (await f.publicHome()).json()).pageId, home.id);

  const second = await f.request("/stores/demo/pages", "POST", {
    document: pageTemplate("home"),
  });
  assert.equal(second.status, 409);
  const body = await second.json();
  assert.equal(body.code, "single-home");
  assert.equal(body.pageId, home.id);
  assert.match(body.error, /zaten bir ana sayfası var/);

  assert.equal(
    (await f.request(`/pages/${home.id}/duplicate`, "POST", {})).status,
    409,
  );

  const landing = await f.create("landing", "Kampanya");
  const current = await f.api(`/pages/${landing.id}`);
  const change = await f.request(`/pages/${landing.id}`, "PUT", {
    document: { ...current.document, type: "home" },
    version: current.version,
  });
  assert.equal(change.status, 409);
  assert.equal(
    (await f.overview()).filter((p) => p.type === "home").length,
    1,
    "nothing was added",
  );

  const other = await f.api("/stores", "POST", { name: "İkinci" });
  const otherHome = await f.api(`/stores/${other.id}/pages`, "POST", {
    document: pageTemplate("home"),
  });
  const moved = await f.request(`/pages/${home.id}/transfer`, "POST", {
    targetStoreId: other.id,
  });
  assert.equal(moved.status, 409);
  assert.equal((await moved.json()).pageId, otherHome.id);
  assert.equal(
    (await f.api(`/stores/${other.id}/pages`)).length,
    1,
    "no page was added to the target store",
  );
});

test("product and collection pages can be copied and given other products; type changes free stale assignments", async (t) => {
  const f = await fixture(t);
  await f.api("/stores/demo/catalog", "PUT", {
    version: 0,
    products: [product("p1"), product("p2"), product("p3")],
    collections: [{ id: "c1", title: "K1", productIds: ["p1"] }],
  });
  const design = await f.create("product", "Ürün tasarımı");
  await f.api(`/pages/${design.id}/assignments`, "PUT", {
    version: 1,
    ids: ["p1"],
  });
  const copies = [];
  for (const ids of [["p2"], ["p3"]]) {
    const copy = await f.api(`/pages/${design.id}/duplicate`, "POST", {});
    assert.deepEqual((await f.api(`/pages/${copy.id}/assignments`)).ids, []);
    await f.api(`/pages/${copy.id}/assignments`, "PUT", { version: 1, ids });
    copies.push(copy);
  }
  const overview = await f.overview();
  assert.deepEqual(
    overview
      .filter((p) => p.type === "product")
      .map((p) => p.assignments)
      .sort(),
    [["p1"], ["p2"], ["p3"]],
  );
  for (const page of [design, ...copies])
    await f.api(`/pages/${page.id}/publish`, "POST", {});
  for (const [id, page] of [
    ["p2", copies[0]],
    ["p3", copies[1]],
  ])
    assert.equal(
      (
        await (
          await f.requestAs(null)(`/public/stores/demo/products/${id}`)
        ).json()
      ).pageId,
      page.id,
    );

  const collection = await f.create("collection", "Koleksiyon");
  const copy = await f.api(`/pages/${collection.id}/duplicate`, "POST", {});
  assert.equal(copy.document.type, "collection");
  assert.equal(copy.document.name, "Koleksiyon · Kopya");
  const named = await f.api(`/pages/${collection.id}/duplicate`, "POST", {
    name: "Collection · Copy",
  });
  assert.equal(named.document.name, "Collection · Copy");

  const current = await f.api(`/pages/${copies[1].id}`);
  await f.api(`/pages/${copies[1].id}`, "PUT", {
    document: { ...current.document, type: "landing" },
    version: current.version,
  });
  assert.deepEqual(
    (await f.overview()).find((p) => p.id === copies[1].id).assignments,
    [],
    "a landing page keeps no product assignment",
  );
  await f.api(`/pages/${design.id}/assignments`, "PUT", {
    version: (await f.api(`/pages/${design.id}`)).version,
    ids: ["p1", "p3"],
  });
});

test("trash takes pages out of every list and route; restore and permanent delete respect the homepage rule", async (t) => {
  const f = await fixture(t);
  await f.api("/stores/demo/catalog", "PUT", {
    version: 0,
    products: [product("p1")],
    collections: [],
  });
  const home = await f.create("home", "Ana sayfa");
  await f.api(`/pages/${home.id}/publish`, "POST", {});
  const page = await f.create("product", "Ürün");
  await f.api(`/pages/${page.id}/assignments`, "PUT", {
    version: 1,
    ids: ["p1"],
  });
  await f.api(`/pages/${page.id}/publish`, "POST", {});

  const before = (await f.api(`/pages/${page.id}`)).version;
  await f.api(`/pages/${page.id}/trash`, "POST", {});
  assert.equal((await f.request(`/pages/${page.id}`)).status, 404);
  assert.ok(!(await f.overview()).some((p) => p.id === page.id));
  assert.ok(!(await f.api("/stores/demo/pages")).some((p) => p.id === page.id));
  assert.equal(
    (await f.requestAs(null)("/public/stores/demo/products/p1")).status,
    404,
  );
  assert.equal(
    (await f.requestAs(null)(`/public/pages/${page.id}`)).status,
    404,
  );
  const [trashed] = await f.api("/stores/demo/trash");
  assert.equal(trashed.id, page.id);
  assert.equal(trashed.type, "product");
  assert.equal(trashed.wasPublished, true);

  // The product is free again for another page.
  const other = await f.create("product", "Yeni ürün");
  await f.api(`/pages/${other.id}/assignments`, "PUT", {
    version: 1,
    ids: ["p1"],
  });
  await f.api(`/stores/demo/trash/${page.id}/restore`, "POST", {});
  const restored = (await f.overview()).find((p) => p.id === page.id);
  assert.equal(restored.published, false, "restored pages come back as drafts");
  assert.deepEqual(restored.assignments, []);
  assert.equal(
    restored.version,
    before + 1,
    "open editors see a conflict, not a silent overwrite",
  );
  assert.deepEqual(await f.api("/stores/demo/trash"), []);

  // Trashing the homepage frees the role; the old one cannot come back next
  // to a new homepage.
  await f.api(`/pages/${home.id}/trash`, "POST", {});
  assert.equal((await f.publicHome()).status, 404);
  const replacement = await f.create("home", "Yeni ana sayfa");
  assert.deepEqual(
    (await f.overview()).find((p) => p.id === replacement.id).assignments,
    ["home"],
  );
  const blocked = await f.request(
    `/stores/demo/trash/${home.id}/restore`,
    "POST",
    {},
  );
  assert.equal(blocked.status, 409);
  assert.equal((await blocked.json()).code, "single-home");

  assert.ok(
    (await f.api(`/pages/${home.id}/history`)).length > 0,
    "history stays while the page is in the trash",
  );
  await f.api(`/stores/demo/trash/${home.id}`, "DELETE");
  assert.deepEqual(await f.api("/stores/demo/trash"), []);
  assert.equal(
    (await f.request(`/stores/demo/trash/${home.id}/restore`, "POST", {}))
      .status,
    404,
  );
  assert.deepEqual(await f.api(`/pages/${home.id}/history`), []);
});

test("older data with two homepages: trashing one routes the other home; viewers cannot use the trash", async (t) => {
  const f = await fixture(t);
  const first = await f.create("home", "İlk");
  const legacy = pageTemplate("home");
  legacy.name = "Eski kopya";
  f.service.db
    .prepare("INSERT INTO pages VALUES(?,?,?,1,?)")
    .run("legacy-home", "demo", JSON.stringify(legacy), Date.now());
  assert.equal(
    (await f.overview()).filter((p) => p.type === "home").length,
    2,
    "existing pages are never removed automatically",
  );
  await f.api(`/pages/${first.id}/trash`, "POST", {});
  assert.deepEqual(
    (await f.overview()).find((p) => p.id === "legacy-home").assignments,
    ["home"],
  );

  const password = randomBytes(24).toString("hex");
  await f.api("/team", "POST", {
    login: "viewer",
    password,
    role: "viewer",
    stores: ["demo"],
  });
  const viewer = f.requestAs(await f.session("viewer", password));
  assert.equal((await viewer("/stores/demo/trash")).status, 200);
  assert.equal(
    (await viewer("/pages/legacy-home/trash", "POST", {})).status,
    403,
  );
  assert.equal(
    (await viewer(`/stores/demo/trash/${first.id}/restore`, "POST", {})).status,
    403,
  );
  assert.equal(
    (await viewer(`/stores/demo/trash/${first.id}`, "DELETE")).status,
    403,
  );
  await f.api("/stores/demo/status", "PATCH", { status: "suspended" });
  assert.equal(
    (await f.request("/pages/legacy-home/trash", "POST", {})).status,
    403,
    "a disabled store is read-only",
  );
});
