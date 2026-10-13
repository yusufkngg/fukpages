import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { createApp, validateDocument } from "../server/index.mjs";
import { hashPassword } from "../server/auth.mjs";
import { pageTemplate, duplicateDocument } from "../src/pageTemplates.ts";
import { block, effectiveStyle } from "../src/model.ts";
import { normalizeStyles } from "../src/styleValues.ts";
import { qualityIssues } from "../src/quality.ts";
import { setFreeLayout, placedStyle } from "../src/freePlacement.ts";

async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "fukpages-pages-")),
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
  const request = (path, method = "GET", body, authorized = true) =>
    fetch(base + (path.startsWith("/p/") ? "" : "/api") + path, {
      method,
      headers: {
        ...(authorized ? { Cookie: cookie, "X-CSRF-Token": csrf } : {}),
        ...(body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
      },
      ...(body !== undefined
        ? { body: body instanceof FormData ? body : JSON.stringify(body) }
        : {}),
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
test("unitless length input works in legacy rendering and saved styles without changing CSS unitless properties or explicit units", () => {
  const styles = {
    paddingTop: "10",
    marginLeft: "-12.5",
    width: "320",
    gap: "8",
    fontSize: "18",
    borderRadius: "6",
    lineHeight: "1.6",
    opacity: "0.5",
    fontWeight: "700",
    zIndex: "3",
    order: "2",
    flexGrow: "1",
    paddingRight: "2rem",
    paddingBottom: "5%",
    paddingLeft: "var(--space)",
    maxWidth: "calc(100% - 2rem)",
  };
  const node = block("row", {}, styles, [block("text")]);
  const legacy = effectiveStyle(node, "desktop");
  assert.equal(legacy.paddingTop, "10px");
  assert.equal(legacy.marginLeft, "-12.5px");
  assert.equal(legacy.gap, "8px");
  const doc = validateDocument({
    schemaVersion: 1,
    name: "Spacing",
    type: "home",
    nodes: [node],
  });
  assert.deepEqual(
    doc.nodes[0].styles.desktop,
    normalizeStyles(node.styles.desktop),
  );
  for (const key of [
    "lineHeight",
    "opacity",
    "fontWeight",
    "zIndex",
    "order",
    "flexGrow",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "maxWidth",
  ])
    assert.equal(doc.nodes[0].styles.desktop[key], styles[key]);
  assert.throws(
    () =>
      validateDocument({
        ...doc,
        nodes: [
          {
            ...node,
            styles: {
              ...node.styles,
              desktop: { paddingTop: "10;position:fixed" },
            },
          },
        ],
      }),
    /stil/,
  );
});
const product = (id, images = []) => ({
  id,
  title: id === "p1" ? "Birinci ürün" : "İkinci ürün",
  description: "Ürün açıklaması",
  currency: "TRY",
  images,
  variants: [
    { id: id + "-variant", title: "Standart", price: 10000, stock: 10 },
  ],
});

test("page assignments route several local products, enforce catalogue/store conflicts and survive cloning without carrying assignments", async (t) => {
  const f = await fixture(t);
  await f.api("/stores/demo/catalog", "PUT", {
    version: 0,
    products: [product("p1"), product("p2")],
    collections: [{ id: "c1", title: "Koleksiyon", productIds: ["p1", "p2"] }],
  });
  const doc = pageTemplate("product");
  doc.seo = {
    slug: "product-template",
    title: "Özel ürün SEO",
    description: "Meta",
    image: "",
    noindex: true,
  };
  const page = await f.api("/stores/demo/pages", "POST", { document: doc });
  assert.equal(
    (
      await f.request(`/pages/${page.id}/assignments`, "PUT", {
        version: 1,
        ids: ["foreign"],
      })
    ).status,
    400,
  );
  await f.api(`/pages/${page.id}/assignments`, "PUT", {
    version: 1,
    ids: ["p1", "p2"],
  });
  await f.api(`/pages/${page.id}/publish`, "POST", {});
  const publicPage = await f
    .request("/public/stores/demo/products/p2", "GET", undefined, false)
    .then((r) => r.json());
  assert.equal(publicPage.activeProductId, "p2");
  assert.equal(publicPage.document.seo.title, "Özel ürün SEO");
  assert.match(
    await f
      .request("/p/demo/products/p2", "GET", undefined, false)
      .then((r) => r.text()),
    /<title>Özel ürün SEO<\/title>/,
  );
  assert.equal(
    (
      await f.request(`/pages/${page.id}/assignments`, "PUT", {
        version: 1,
        ids: [],
      })
    ).status,
    409,
  );
  const copy = await f.api(`/pages/${page.id}/duplicate`, "POST", {});
  assert.deepEqual((await f.api(`/pages/${copy.id}/assignments`)).ids, []);
  assert.notEqual(copy.document.nodes[0].id, page.document.nodes[0].id);
  assert.notEqual(copy.document.seo.slug, page.document.seo.slug);
  assert.equal(
    (
      await f.request(`/pages/${copy.id}/assignments`, "PUT", {
        version: 1,
        ids: ["p1"],
      })
    ).status,
    409,
  );
  const overview = await f.api("/stores/demo/page-overview");
  assert.equal(overview.find((p) => p.id === page.id).published, true);
  assert.equal(overview.find((p) => p.id === copy.id).published, false);
  assert.deepEqual(overview.find((p) => p.id === page.id).assignments, [
    "p1",
    "p2",
  ]);
  await f.api("/stores/demo/status", "PATCH", { status: "suspended" });
  assert.equal(
    (
      await f.request(
        "/public/stores/demo/products/p2",
        "GET",
        undefined,
        false,
      )
    ).status,
    404,
  );
  assert.equal(
    (await f.request(`/pages/${copy.id}/duplicate`, "POST", {})).status,
    403,
  );
});
test("homepage and collection assignments use published templates and viewer/editor scopes protect their management", async (t) => {
  const f = await fixture(t);
  await f.api("/stores/demo/catalog", "PUT", {
    version: 0,
    products: [product("p1")],
    collections: [{ id: "c1", title: "İlk koleksiyon", productIds: ["p1"] }],
  });
  for (const [type, ids, path] of [
    ["home", ["home"], "home"],
    ["collection", ["c1"], "collections/c1"],
  ]) {
    const page = await f.api("/stores/demo/pages", "POST", {
      document: pageTemplate(type),
    });
    assert.equal(
      (await f.request("/public/stores/demo/" + path, "GET", undefined, false))
        .status,
      404,
    );
    await f.api(`/pages/${page.id}/assignments`, "PUT", { version: 1, ids });
    await f.api(`/pages/${page.id}/publish`, "POST", {});
    const published = await f
      .request("/public/stores/demo/" + path, "GET", undefined, false)
      .then((r) => r.json());
    assert.equal(published.pageId, page.id);
    if (type === "collection") assert.equal(published.activeCollectionId, "c1");
  }
  const page = (await f.api("/stores/demo/page-overview"))[0];
  const password = randomBytes(24).toString("hex");
  await f.api("/team", "POST", {
    login: "readonly",
    password,
    role: "viewer",
    stores: ["demo"],
  });
  const login = await fetch(f.base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login: "readonly", password }),
  });
  const cookie = login.headers.get("set-cookie").split(";")[0],
    csrf = (await login.json()).csrf;
  for (const action of ["duplicate", "assignments"])
    assert.equal(
      (
        await fetch(f.base + `/api/pages/${page.id}/${action}`, {
          method: action === "duplicate" ? "POST" : "PUT",
          headers: {
            Cookie: cookie,
            "X-CSRF-Token": csrf,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ version: page.version, ids: [] }),
        })
      ).status,
      403,
    );
  const other = await f.api("/stores", "POST", { name: "Other" });
  assert.equal(
    (
      await fetch(f.base + `/api/stores/${other.id}/page-overview`, {
        headers: { Cookie: cookie },
      })
    ).status,
    403,
  );
});
test("dynamic template catalogue images are public only when used by an active publication", async (t) => {
  const f = await fixture(t),
    data = new FormData();
  data.append("type", "image");
  data.append(
    "files",
    new Blob([
      await sharp({
        create: { width: 20, height: 20, channels: 3, background: "green" },
      })
        .png()
        .toBuffer(),
    ]),
    "catalog.png",
  );
  const asset = (await f.api("/stores/demo/assets", "POST", data)).results[0]
    .asset;
  await f.api("/stores/demo/catalog", "PUT", {
    version: 0,
    products: [product("p1", [asset.url]), product("p2")],
    collections: [],
  });
  const page = await f.api("/stores/demo/pages", "POST", {
    document: pageTemplate("product"),
  });
  await f.api(`/pages/${page.id}/assignments`, "PUT", {
    version: 1,
    ids: ["p2"],
  });
  await f.api(`/pages/${page.id}/publish`, "POST", {});
  assert.equal(
    (await f.request(asset.url.replace(/^\/api/, ""), "GET", undefined, false))
      .status,
    404,
  );
  await f.api(`/pages/${page.id}/assignments`, "PUT", {
    version: 2,
    ids: ["p1"],
  });
  assert.equal(
    (await f.request(asset.url.replace(/^\/api/, ""), "GET", undefined, false))
      .status,
    200,
  );
  await f.request(`/pages/${page.id}/publish`, "DELETE");
  assert.equal(
    (await f.request(asset.url.replace(/^\/api/, ""), "GET", undefined, false))
      .status,
    404,
  );
});
test("button URLs normalize without losing legacy targets and unsafe links still sanitize; free placement preserves independent flow and cross-root links clone together", () => {
  const button = block("button", {
    href: "www.example.com/products/one",
    text: "Go",
  });
  const doc = pageTemplate("home");
  doc.nodes = [button];
  assert.equal(
    validateDocument(doc).nodes[0].props.href,
    "https://www.example.com/products/one",
  );
  button.props.href = "javascript:alert(1)";
  assert.equal(validateDocument(doc).nodes[0].props.href, "");
  button.props.href = "#";
  button.props.actionTarget = "https://example.com";
  assert.equal(
    qualityIssues(doc).filter((w) => w.message.includes("bağlantı")).length,
    0,
  );
  const section = block("section", {}, {}, [button]),
    original = structuredClone(button.styles.desktop);
  const free = setFreeLayout(section, "desktop", true, {
    [button.id]: { left: 20, top: 50, width: 30, height: 70 },
  });
  assert.equal(
    placedStyle(free.children[0], "desktop", true).position,
    "absolute",
  );
  assert.equal(placedStyle(free.children[0], "mobile").width, original.width);
  assert.deepEqual(
    setFreeLayout(free, "desktop", false).children[0].styles.desktop,
    original,
  );
  free.children[0].props.freeFlowStyles =
    '{"desktop":{"backgroundImage":"url(https://example.com)"}}';
  assert.throws(
    () => validateDocument({ ...doc, nodes: [free] }),
    /akış stili/,
  );
  const target = block("heading", { html: "Target" });
  button.props.action = "scroll";
  button.props.actionTarget = target.id;
  const copy = duplicateDocument({ ...doc, nodes: [button, target] });
  assert.equal(copy.nodes[0].props.actionTarget, copy.nodes[1].id);
});
