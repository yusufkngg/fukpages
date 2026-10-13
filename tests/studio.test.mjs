import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import * as fontkit from "fontkit";
import { createApp } from "../server/index.mjs";
import { hashPassword } from "../server/auth.mjs";
import { defaultBrand } from "../server/studio.mjs";
import { createDesignService } from "../server/design-service.mjs";
import { deflateSync } from "node:zlib";
const block = (kind, id, props = {}, children = []) => ({
  id,
  kind,
  name: id,
  props,
  styles: { desktop: {}, tablet: {}, mobile: {} },
  hidden: { desktop: false, tablet: false, mobile: false },
  children,
});
const doc = (nodes) => ({
  schemaVersion: 1,
  type: "landing",
  name: "Validation",
  nodes,
});
async function fixture(t, extra = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), "fukpages-studio-")),
    password = randomBytes(24).toString("base64url"),
    hash = hashPassword(password);
  let instance = createApp({
      dataDir,
      ownerHash: hash,
      ownerLogin: "owner",
      ...extra,
    }),
    server = instance.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  let cookie = "",
    csrf = "";
  const base = () => `http://127.0.0.1:${server.address().port}`;
  const request = (
    path,
    method = "GET",
    body,
    authorized = true,
    headers = {},
  ) =>
    fetch(base() + "/api" + path, {
      method,
      headers: {
        ...(body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(authorized && cookie ? { Cookie: cookie } : {}),
        ...(authorized ? { "X-CSRF-Token": csrf } : {}),
        ...headers,
      },
      ...(body !== undefined
        ? { body: body instanceof FormData ? body : JSON.stringify(body) }
        : {}),
    });
  const login = async () => {
    const r = await request("/auth/login", "POST", {
      login: "owner",
      password,
    });
    assert.equal(r.status, 200);
    cookie = r.headers.get("set-cookie").split(";")[0];
    csrf = (await r.json()).csrf;
  };
  await login();
  t.after(async () => {
    await new Promise((r) => server.close(r));
    instance.db.close();
    rmSync(dataDir, { recursive: true, force: true });
  });
  return {
    request,
    base,
    db: instance.db,
    studio: instance.studio,
    growth: instance.growth,
    async restart() {
      await new Promise((r) => server.close(r));
      instance.db.close();
      instance = createApp({
        dataDir,
        ownerHash: hash,
        ownerLogin: "owner",
        ...extra,
      });
      server = instance.app.listen(0, "127.0.0.1");
      await new Promise((r) => server.once("listening", r));
      await login();
    },
  };
}
async function upload(f, buffer, name, type = "image") {
  const data = new FormData();
  data.append("type", type);
  data.append("files", new Blob([buffer]), name);
  const r = await f.request("/stores/demo/assets", "POST", data);
  assert.equal(r.status, 201, JSON.stringify(await r.clone().json()));
  return (await r.json()).results[0].asset;
}
test("uploaded images survive restart, publish across sessions, isolate stores, and retain referenced deleted files", async (t) => {
  const f = await fixture(t),
    png = await sharp({
      create: { width: 80, height: 60, channels: 4, background: "#4488cc" },
    })
      .png()
      .toBuffer(),
    a = await upload(f, png, "photo.png");
  assert.equal(a.width, 80);
  assert.equal(a.variants.length, 4);
  assert.equal(
    (await f.request(a.url.replace("/api", ""), "GET", undefined, false))
      .status,
    404,
  );
  const created = await f
    .request("/stores/demo/pages", "POST", {
      document: doc([
        block("image", "photo", { src: a.url, alt: "Product photo" }),
      ]),
    })
    .then((r) => r.json());
  assert.equal(
    (await f.request("/pages/" + created.id + "/publish", "POST", {})).status,
    200,
  );
  await f.restart();
  const bytes = await f.request(
    a.url.replace("/api", ""),
    "GET",
    undefined,
    false,
  );
  assert.equal(bytes.status, 200);
  assert.equal(
    (await sharp(Buffer.from(await bytes.arrayBuffer())).metadata()).width,
    80,
  );
  const list = await f.request("/stores/demo/assets").then((r) => r.json());
  assert.equal(list[0].usage[0].id, created.id);
  assert.equal(
    (await f.request("/stores/demo/assets/" + a.id, "DELETE")).status,
    409,
  );
  assert.equal(
    (
      await f.request(
        "/stores/demo/assets/" + a.id + "?acknowledge=true",
        "DELETE",
      )
    ).status,
    200,
  );
  assert.equal(
    (await f.request(a.url.replace("/api", ""), "GET", undefined, false))
      .status,
    200,
  );
  const other = await f
    .request("/stores", "POST", { name: "Other" })
    .then((r) => r.json());
  assert.equal(
    (
      await f.request(`/stores/${other.id}/assets/${a.id}`, "PATCH", {
        name: "Wrong",
      })
    ).status,
    404,
  );
  await f.request("/stores/demo/status", "PATCH", { status: "suspended" });
  assert.equal(
    (await f.request(a.url.replace("/api", ""), "GET", undefined, false))
      .status,
    404,
  );
});
test("image edits produce a new persisted crop and SVG active content is rejected", async (t) => {
  const f = await fixture(t),
    a = await upload(
      f,
      await sharp({
        create: { width: 100, height: 80, channels: 4, background: "red" },
      })
        .png()
        .toBuffer(),
      "crop.png",
    );
  const edited = await f
    .request(`/stores/demo/assets/${a.id}/edit`, "POST", {
      crop: { x: 10, y: 25, width: 50, height: 50 },
    })
    .then((r) => r.json());
  assert.equal(edited.width, 50);
  assert.equal(edited.height, 40);
  assert.notEqual(edited.id, a.id);
  const bad = new FormData();
  bad.append(
    "files",
    new Blob([
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    ]),
    "bad.svg",
  );
  assert.equal(
    (await f.request("/stores/demo/assets", "POST", bad)).status,
    400,
  );
  assert.equal(
    (
      await f.request("/stores/demo/assets/import", "POST", {
        url: "https://127.0.0.1/a.png",
      })
    ).status,
    400,
  );
});
test("PNG JPEG WebP AVIF GIF and inert SVG uploads decode into persistent image assets", async (t) => {
  const f = await fixture(t);
  for (const format of ["png", "jpeg", "webp", "avif", "gif"]) {
    const bytes = await sharp({
      create: { width: 32, height: 24, channels: 4, background: "#aaccee" },
    })
      .toFormat(format)
      .toBuffer();
    const asset = await upload(f, bytes, "format." + format);
    assert.equal(asset.width, 32);
    assert.equal(asset.height, 24);
    assert.equal(asset.format, format === "gif" ? "gif" : "webp");
  }
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24"><rect width="32" height="24" fill="red"/></svg>',
  );
  const asset = await upload(f, svg, "safe.svg");
  assert.equal(asset.format, "webp");
  assert.equal(asset.width, 32);
});
test("custom TTF fonts are converted to valid WOFF2, report missing Turkish glyphs, and remain available on public pages", async (t) => {
  const f = await fixture(t),
    a = await upload(
      f,
      readFileSync(new URL("./fixtures/ABeeZee-Regular.ttf", import.meta.url)),
      "ABeeZee.ttf",
      "font",
    );
  assert.equal(a.type, "font");
  assert.equal(a.format, "woff2");
  assert.equal(a.family, "ABeeZee");
  assert.equal(a.turkish, false);
  const file = await f.request(a.url.replace("/api", ""));
  assert.equal(
    fontkit.create(Buffer.from(await file.arrayBuffer())).familyName,
    "ABeeZee",
  );
  const brand = structuredClone(defaultBrand);
  brand.fonts.heading = "ABeeZee, Arial, sans-serif";
  await f.request("/stores/demo/brand", "PUT", { brand, version: 0 });
  const p = await f
    .request("/stores/demo/pages", "POST", {
      document: doc([block("heading", "title", { html: "Türkçe", tag: "h1" })]),
    })
    .then((r) => r.json());
  await f.request(`/pages/${p.id}/publish`, "POST", {});
  assert.equal(
    (await f.request(a.url.replace("/api", ""), "GET", undefined, false))
      .status,
    200,
  );
  await f.request(`/stores/demo/assets/${a.id}?acknowledge=true`, "DELETE");
  const pub = await f
    .request("/public/pages/" + p.id, "GET", undefined, false)
    .then((r) => r.json());
  assert.equal(pub.assets[0].id, a.id);
  const used = (await f.request("/stores/demo/assets").then((r) => r.json()))[0]
    .usage;
  assert.ok(used.some((u) => u.id === p.id));
});
test("WOFF uploads preserve their family, OTF converts to WOFF2, and variable font axes and Turkish coverage survive conversion", async (t) => {
  const f = await fixture(t),
    ttf = readFileSync(
      new URL("./fixtures/ABeeZee-Regular.ttf", import.meta.url),
    ),
    count = ttf.readUInt16BE(4),
    header = Buffer.alloc(44 + 20 * count),
    chunks = [header];
  let offset = header.length,
    total = 12 + 16 * count;
  header.write("wOFF");
  ttf.copy(header, 4, 0, 4);
  header.writeUInt16BE(count, 12);
  for (let i = 0; i < count; i++) {
    const entry = 12 + 16 * i,
      length = ttf.readUInt32BE(entry + 12),
      position = ttf.readUInt32BE(entry + 8),
      raw = ttf.subarray(position, position + length),
      deflated = deflateSync(raw),
      data = deflated.length < raw.length ? deflated : raw,
      padded = Buffer.alloc(Math.ceil(data.length / 4) * 4);
    data.copy(padded);
    const out = 44 + 20 * i;
    ttf.copy(header, out, entry, entry + 4);
    header.writeUInt32BE(offset, out + 4);
    header.writeUInt32BE(data.length, out + 8);
    header.writeUInt32BE(length, out + 12);
    header.writeUInt32BE(ttf.readUInt32BE(entry + 4), out + 16);
    chunks.push(padded);
    offset += padded.length;
    total += Math.ceil(length / 4) * 4;
  }
  header.writeUInt32BE(offset, 8);
  header.writeUInt32BE(total, 16);
  const woff = Buffer.concat(chunks);
  assert.equal(fontkit.create(woff).familyName, "ABeeZee");
  const uploaded = await upload(f, woff, "ABeeZee.woff", "font");
  assert.equal(uploaded.format, "woff");
  const otf = await upload(
    f,
    readFileSync(
      new URL("./fixtures/SourceSans3-Regular.otf", import.meta.url),
    ),
    "SourceSans.otf",
    "font",
  );
  assert.equal(otf.format, "woff2");
  assert.equal(otf.family, "Source Sans 3");
  const variable = await upload(
    f,
    readFileSync(new URL("./fixtures/Roboto-variable.ttf", import.meta.url)),
    "Roboto-variable.ttf",
    "font",
  );
  assert.equal(variable.axes.wght.min, 100);
  assert.equal(variable.axes.wght.max, 900);
  assert.equal(variable.turkish, true);
  const data = Buffer.from(
    await f
      .request(variable.url.replace("/api", ""))
      .then((r) => r.arrayBuffer()),
  );
  assert.equal(fontkit.create(data).variationAxes.wght.max, 900);
});
test("brand updates reject stale versions and page history is persistent independently from undo", async (t) => {
  const f = await fixture(t);
  const brand = structuredClone(defaultBrand);
  brand.colors.primary = "#225588";
  assert.equal(
    (await f.request("/stores/demo/brand", "PUT", { brand, version: 0 }))
      .status,
    200,
  );
  assert.equal(
    (await f.request("/stores/demo/brand", "PUT", { brand, version: 0 }))
      .status,
    409,
  );
  const p = await f
    .request("/stores/demo/pages", "POST", {
      document: doc([block("text", "t", { html: "Old" })]),
    })
    .then((r) => r.json());
  await f.request(`/pages/${p.id}`, "PUT", {
    document: doc([block("text", "t", { html: "New" })]),
    version: 1,
  });
  await f.restart();
  const history = await f
    .request(`/pages/${p.id}/history`)
    .then((r) => r.json());
  assert.ok(history.length >= 2);
  const old = await f
    .request(`/pages/${p.id}/history/${history[0].id}`)
    .then((r) => r.json());
  assert.equal(old.document.nodes[0].props.html, "Old");
  const fetched = await f.request("/stores/demo/brand").then((r) => r.json());
  assert.equal(fetched.brand.colors.primary, "#225588");
});
test("synchronized sections update every linked draft atomically while published snapshots remain stable", async (t) => {
  const f = await fixture(t),
    section = block("section", "source", {}, [
      block("text", "body", { html: "Old" }),
    ]);
  const saved = await f
    .request("/stores/demo/sections", "POST", {
      name: "Synced",
      section,
      synchronized: true,
    })
    .then((r) => r.json());
  const a = await f
    .request("/stores/demo/pages", "POST", { document: doc([saved.section]) })
    .then((r) => r.json());
  const b = await f
    .request("/stores/demo/pages", "POST", {
      document: doc([{ ...saved.section, id: "copy" }]),
    })
    .then((r) => r.json());
  await f.request(`/pages/${a.id}/publish`, "POST", {});
  saved.section.children[0].props.html = "New";
  const r = await f.request(`/stores/demo/sections/${saved.id}/sync`, "PUT", {
    section: saved.section,
    version: 1,
  });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).affectedPages.length, 2);
  for (const page of [a, b]) {
    const got = await f.request("/pages/" + page.id).then((r) => r.json());
    assert.equal(got.document.nodes[0].children[0].props.html, "New");
    assert.equal(got.version, 2);
  }
  const live = await f
    .request("/public/pages/" + a.id, "GET", undefined, false)
    .then((r) => r.json());
  assert.equal(live.document.nodes[0].children[0].props.html, "Old");
  assert.equal(
    (
      await f.request(`/stores/demo/sections/${saved.id}/sync`, "PUT", {
        section: saved.section,
        version: 1,
      })
    ).status,
    409,
  );
});
test("local forms validate consent/email, deduplicate retries, persist submissions and stop after suspension", async (t) => {
  const f = await fixture(t),
    form = block("form", "form-1", {}, [
      block("input", "email", {
        fieldName: "email",
        inputType: "email",
        required: true,
      }),
      block("checkbox", "consent", {
        fieldName: "consent",
        required: true,
        consent: true,
      }),
    ]);
  const p = await f
    .request("/stores/demo/pages", "POST", { document: doc([form]) })
    .then((r) => r.json());
  await f.request(`/pages/${p.id}/publish`, "POST", {});
  const path = `/public/pages/${p.id}/forms/form-1`,
    body = {
      requestId: randomBytes(16).toString("hex"),
      values: { email: "test@example.com", consent: "true" },
    };
  assert.equal(
    (
      await f.request(
        path,
        "POST",
        { ...body, values: { email: "wrong" } },
        false,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await f.request(
        path,
        "POST",
        { ...body, values: { email: "test@example.com", consent: "false" } },
        false,
      )
    ).status,
    400,
  );
  assert.equal((await f.request(path, "POST", body, false)).status, 201);
  const repeat = await f
    .request(path, "POST", body, false)
    .then((r) => r.json());
  assert.equal(repeat.duplicate, true);
  await f.restart();
  assert.equal(
    (await f.request("/stores/demo/submissions").then((r) => r.json())).length,
    1,
  );
  await f.request("/stores/demo/status", "PATCH", { status: "suspended" });
  assert.equal((await f.request(path, "POST", body, false)).status, 404);
});
test("preview snapshots expire, publication rollback restores content, and schedules publish/unpublish without activating suspended stores", async (t) => {
  const f = await fixture(t),
    p = await f
      .request("/stores/demo/pages", "POST", {
        document: doc([block("text", "t", { html: "One" })]),
      })
      .then((r) => r.json());
  const preview = await f
    .request(`/pages/${p.id}/preview`, "POST", {})
    .then((r) => r.json());
  await f.request(`/pages/${p.id}/publish`, "POST", {});
  await f.request(`/pages/${p.id}`, "PUT", {
    document: doc([block("text", "t", { html: "Two" })]),
    version: 1,
  });
  await f.request(`/pages/${p.id}/publish`, "POST", {});
  const previews = await f
    .request("/public/previews/" + preview.token, "GET", undefined, false)
    .then((r) => r.json());
  assert.equal(previews.document.nodes[0].props.html, "One");
  const publications = await f
    .request(`/pages/${p.id}/publications`)
    .then((r) => r.json());
  await f.request(
    `/pages/${p.id}/publications/${publications.at(-1).id}/restore`,
    "POST",
    {},
  );
  assert.equal(
    (
      await f
        .request("/public/pages/" + p.id, "GET", undefined, false)
        .then((r) => r.json())
    ).document.nodes[0].props.html,
    "One",
  );
  const now = Date.now();
  await f.request(`/pages/${p.id}/schedule`, "PUT", {
    publishAt: now + 60000,
    unpublishAt: now + 120000,
  });
  f.studio.runSchedules(now + 65000);
  assert.equal(
    (
      await f
        .request("/public/pages/" + p.id, "GET", undefined, false)
        .then((r) => r.json())
    ).document.nodes[0].props.html,
    "Two",
  );
  f.studio.runSchedules(now + 125000);
  assert.equal(
    (await f.request("/public/pages/" + p.id, "GET", undefined, false)).status,
    404,
  );
  f.db.prepare("UPDATE previews SET expires=0").run();
  await f.request(`/pages/${p.id}/schedule`, "PUT", {
    publishAt: now + 240000,
  });
  await f.request("/stores/demo/status", "PATCH", { status: "suspended" });
  await f.request("/stores/demo/status", "PATCH", { status: "active" });
  f.studio.runSchedules(now + 300000);
  assert.equal(
    (await f.request("/public/pages/" + p.id, "GET", undefined, false)).status,
    404,
  );
  assert.equal(
    (
      await f.request(
        "/public/previews/" + preview.token,
        "GET",
        undefined,
        false,
      )
    ).status,
    404,
  );
});
test("local catalogue validates variants and store isolation and metrics only accept published pages", async (t) => {
  const f = await fixture(t),
    catalog = {
      products: [
        {
          id: "p",
          title: "Actual local product",
          currency: "TRY",
          images: [],
          variants: [{ id: "v", title: "Black", price: 19900, stock: 2 }],
        },
      ],
      collections: [{ id: "c", title: "Local collection", productIds: ["p"] }],
      version: 0,
    };
  assert.equal(
    (await f.request("/stores/demo/catalog", "PUT", catalog)).status,
    200,
  );
  assert.equal(
    (await f.request("/stores/demo/catalog", "PUT", catalog)).status,
    409,
  );
  const bad = structuredClone(catalog);
  bad.products[0].variants[0].price = -1;
  bad.version = 1;
  assert.equal(
    (await f.request("/stores/demo/catalog", "PUT", bad)).status,
    400,
  );
  assert.equal(
    (
      await f.request(
        "/public/pages/unknown/events",
        "POST",
        { event: "click" },
        false,
      )
    ).status,
    404,
  );
  const p = await f
    .request("/stores/demo/pages", "POST", {
      document: doc([
        block("productField", "p", { productId: "p", field: "title" }),
      ]),
    })
    .then((r) => r.json());
  await f.request(`/pages/${p.id}/publish`, "POST", {});
  assert.equal(
    (
      await f.request(
        `/public/pages/${p.id}/events`,
        "POST",
        { event: "click" },
        false,
      )
    ).status,
    204,
  );
  const metrics = await f
    .request(`/pages/${p.id}/metrics`)
    .then((r) => r.json());
  assert.equal(metrics[0].count, 1);
  const pub = await f
    .request(`/public/pages/${p.id}`, "GET", undefined, false)
    .then((r) => r.json());
  assert.equal(pub.catalog.products[0].title, "Actual local product");
});
test("A/B assignments persist in the visitor cookie, funnels require active pages and review links grant no owner access", async (t) => {
  const f = await fixture(t),
    pages = [];
  for (const value of ["A", "B"]) {
    const p = await f
      .request("/stores/demo/pages", "POST", {
        document: doc([block("text", value, { html: value })]),
      })
      .then((r) => r.json());
    await f.request(`/pages/${p.id}/publish`, "POST", {});
    pages.push(p.id);
  }
  const experiment = await f
    .request("/stores/demo/experiments", "POST", {
      a: pages[0],
      b: pages[1],
      split: 50,
    })
    .then((r) => r.json());
  let first = await f.request(
    "/public/experiments/" + experiment.id,
    "GET",
    undefined,
    false,
  );
  assert.equal(first.status, 200);
  const cookie = first.headers.get("set-cookie").split(";")[0],
    firstBody = await first.json();
  for (let i = 0; i < 3; i++) {
    const response = await f.request(
      "/public/experiments/" + experiment.id,
      "GET",
      undefined,
      false,
      { Cookie: cookie },
    );
    assert.equal((await response.json()).pageId, firstBody.pageId);
  }
  const funnel = await f
    .request("/stores/demo/funnels", "POST", { pages })
    .then((r) => r.json());
  const stage = await f
    .request(`/public/funnels/${funnel.id}/0`, "GET", undefined, false)
    .then((r) => r.json());
  assert.ok(stage.nextStage.endsWith("stage=1"));
  const link = await f
    .request("/pages/" + pages[0] + "/preview", "POST", {})
    .then((r) => r.json());
  assert.equal(
    (
      await f.request(
        `/public/previews/${link.token}/review`,
        "POST",
        { reviewer: "Reviewer", decision: "approve", note: "Approved" },
        false,
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await f.request("/pages/" + pages[0] + "/reviews").then((r) => r.json())
    )[0].reviewer,
    "Reviewer",
  );
  assert.equal(
    (
      await f.request("/stores", "GET", undefined, false, {
        Cookie: "preview=" + link.token,
      })
    ).status,
    401,
  );
  await f.request("/stores/demo/status", "PATCH", { status: "suspended" });
  assert.equal(
    (
      await f.request(
        "/public/experiments/" + experiment.id,
        "GET",
        undefined,
        false,
      )
    ).status,
    404,
  );
});
test("store transfer copies media and requires explicit product/collection mappings without cross-store publication leaks", async (t) => {
  const f = await fixture(t),
    asset = await upload(
      f,
      await sharp({
        create: { width: 40, height: 30, channels: 4, background: "blue" },
      })
        .png()
        .toBuffer(),
      "Transfer.png",
    ),
    target = await f
      .request("/stores", "POST", { name: "Target" })
      .then((r) => r.json());
  await f.request("/stores/demo/catalog", "PUT", {
    products: [
      {
        id: "p",
        title: "Source",
        variants: [{ id: "v", title: "One", price: 100, stock: 1 }],
      },
    ],
    collections: [],
    version: 0,
  });
  await f.request(`/stores/${target.id}/catalog`, "PUT", {
    products: [
      {
        id: "target-p",
        title: "Target",
        variants: [{ id: "target-v", title: "One", price: 200, stock: 1 }],
      },
    ],
    collections: [],
    version: 0,
  });
  const p = await f
    .request("/stores/demo/pages", "POST", {
      document: doc([
        block("image", "img", { src: asset.url }),
        block("productField", "p", { productId: "p", field: "title" }),
      ]),
    })
    .then((r) => r.json());
  assert.equal(
    (
      await f.request(`/stores/${target.id}/pages`, "POST", {
        document: doc([block("image", "bad", { src: asset.url })]),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.request(`/pages/${p.id}/transfer`, "POST", {
        targetStoreId: target.id,
      })
    ).status,
    400,
  );
  const transferred = await f.request(`/pages/${p.id}/transfer`, "POST", {
    targetStoreId: target.id,
    productMap: { p: "target-p" },
  });
  assert.equal(transferred.status, 201);
  const copy = await transferred.json();
  assert.notEqual(copy.document.nodes[0].props.src, asset.url);
  assert.equal(copy.document.nodes[1].props.productId, "target-p");
  await f.request(`/pages/${copy.id}/publish`, "POST", {});
  const media = await f.request(
    copy.document.nodes[0].props.src.replace("/api", ""),
    "GET",
    undefined,
    false,
  );
  assert.equal(media.status, 200);
  assert.equal(
    (await f.request(asset.url.replace("/api", ""), "GET", undefined, false))
      .status,
    404,
  );
});
test("SEO slug routes emit initial HTML metadata and translations are sanitized", async (t) => {
  const f = await fixture(t),
    document = doc([
      block("heading", "title", {
        tag: "h1",
        html: "Title",
        translations: JSON.stringify({
          en: {
            html: "<script>x</script><b>English</b>",
            href: "javascript:x",
          },
        }),
      }),
    ]);
  document.seo = {
    slug: "page-slug",
    title: "SEO <title>",
    description: "Description",
    image: "https://example.com/photo.jpg",
    noindex: true,
  };
  document.locales = ["tr", "en"];
  const p = await f
    .request("/stores/demo/pages", "POST", { document })
    .then((r) => r.json());
  await f.request(`/pages/${p.id}/publish`, "POST", {});
  const pub = await f
    .request("/public/stores/demo/pages/page-slug", "GET", undefined, false)
    .then((r) => r.json());
  assert.equal(pub.document.seo.title, "SEO <title>");
  assert.equal(
    JSON.parse(pub.document.nodes[0].props.translations).en.html,
    "<b>English</b>",
  );
  assert.equal(
    JSON.parse(pub.document.nodes[0].props.translations).en.href,
    undefined,
  );
  const html = await fetch(f.base() + "/p/demo/page-slug").then((r) =>
    r.text(),
  );
  assert.ok(html.includes("<title>SEO &lt;title&gt;</title>"));
  assert.ok(html.includes("og:image"));
  assert.ok(html.includes("noindex,nofollow"));
});
test("AI adapter uses configured transport, validates returned designs, and reports unavailable providers explicitly", async (t) => {
  let called = false;
  const service = createDesignService({
    apiKey: randomBytes(16).toString("hex"),
    fetchImpl: async (url, options) => {
      called = true;
      const body = JSON.parse(options.body);
      assert.equal(body.response_format.type, "json_object");
      assert.ok(body.messages[0].content.includes("editable"));
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify(
                doc([block("text", "ai", { html: "Generated" })]),
              ),
            },
          },
        ],
      });
    },
  });
  const f = await fixture(t, { ai: service });
  const result = await f.request("/stores/demo/ai", "POST", {
    prompt: "Create a page",
  });
  assert.equal(result.status, 200);
  assert.equal((await result.json()).document.nodes[0].props.html, "Generated");
  assert.equal(called, true);
  const missing = await fixture(t, { ai: createDesignService({ apiKey: "" }) });
  assert.equal(
    (await missing.request("/stores/demo/ai", "POST", { prompt: "Create" }))
      .status,
    503,
  );
  const invalid = await fixture(t, {
    ai: {
      configured: true,
      model: "test",
      generate: async () => ({ invalid: true }),
    },
  });
  assert.equal(
    (await invalid.request("/stores/demo/ai", "POST", {})).status,
    502,
  );
});
test("optional agency roles isolate stores, viewers cannot write, and disabling an account revokes every session", async (t) => {
  const f = await fixture(t),
    other = await f
      .request("/stores", "POST", { name: "Private other" })
      .then((r) => r.json());
  const otherPage = await f
    .request(`/stores/${other.id}/pages`, "POST", {
      document: doc([block("text", "private", { html: "Private" })]),
    })
    .then((r) => r.json());
  const password = randomBytes(24).toString("base64url");
  const account = await f
    .request("/team", "POST", {
      login: "scoped-editor",
      password,
      role: "editor",
      stores: ["demo"],
    })
    .then((r) => r.json());
  assert.equal(account.hash, undefined);
  const login = await f.request(
    "/auth/login",
    "POST",
    { login: "scoped-editor", password },
    false,
  );
  assert.equal(login.status, 200);
  const editorCookie = login.headers.get("set-cookie").split(";")[0],
    editorCsrf = (await login.json()).csrf;
  const editor = (path, method = "GET", body) =>
    f.request(path, method, body, false, {
      Cookie: editorCookie,
      "X-CSRF-Token": editorCsrf,
    });
  const stores = await editor("/stores").then((r) => r.json());
  assert.deepEqual(
    stores.map((s) => s.id),
    ["demo"],
  );
  assert.equal((await editor("/pages/" + otherPage.id)).status, 403);
  assert.equal(
    (
      await editor("/stores/demo/pages", "POST", {
        document: doc([block("text", "editable", { html: "Editor draft" })]),
      })
    ).status,
    201,
  );
  assert.equal(
    (await editor("/stores/demo/status", "PATCH", { status: "suspended" }))
      .status,
    403,
  );
  assert.equal((await editor("/team")).status, 403);
  assert.equal(
    (await f.request("/team/" + account.id, "PATCH", { role: "viewer" }))
      .status,
    200,
  );
  assert.equal((await editor("/stores")).status, 401);
  const readerLogin = await f.request(
    "/auth/login",
    "POST",
    { login: "scoped-editor", password },
    false,
  );
  const viewerCookie = readerLogin.headers.get("set-cookie").split(";")[0],
    viewerCsrf = (await readerLogin.json()).csrf;
  const viewer = (path, method = "GET", body) =>
    f.request(path, method, body, false, {
      Cookie: viewerCookie,
      "X-CSRF-Token": viewerCsrf,
    });
  assert.equal((await viewer("/stores/demo/pages")).status, 200);
  assert.equal(
    (await viewer("/stores/demo/pages", "POST", { document: doc([]) })).status,
    403,
  );
  assert.equal((await viewer("/stores")).status, 200);
  await f.request("/team/" + account.id, "PATCH", { active: false });
  assert.equal((await viewer("/stores")).status, 401);
  assert.equal(
    (
      await f.request(
        "/auth/login",
        "POST",
        { login: "scoped-editor", password },
        false,
      )
    ).status,
    401,
  );
});
test("webhook forms queue only opted-in submissions, retry with stable idempotency keys, and local forms remain private", async (t) => {
  const priorUrl = process.env.FORM_WEBHOOK_URL,
    priorSecret = process.env.FORM_WEBHOOK_SECRET;
  process.env.FORM_WEBHOOK_URL = "https://provider.example.test/forms";
  process.env.FORM_WEBHOOK_SECRET = randomBytes(16).toString("hex");
  t.after(() => {
    if (priorUrl === undefined) delete process.env.FORM_WEBHOOK_URL;
    else process.env.FORM_WEBHOOK_URL = priorUrl;
    if (priorSecret === undefined) delete process.env.FORM_WEBHOOK_SECRET;
    else process.env.FORM_WEBHOOK_SECRET = priorSecret;
  });
  const keys = [];
  const f = await fixture(t, {
    webhookFetch: async (url, options) => {
      assert.equal(url, "https://provider.example.test/forms");
      keys.push(options.headers["Idempotency-Key"]);
      return new Response("", { status: keys.length === 1 ? 503 : 200 });
    },
  });
  const create = async (destination) => {
    const p = await f
      .request("/stores/demo/pages", "POST", {
        document: doc([
          block("form", "form", { destination }, [
            block("input", "email", {
              fieldName: "email",
              inputType: "email",
              required: true,
            }),
          ]),
        ]),
      })
      .then((r) => r.json());
    await f.request(`/pages/${p.id}/publish`, "POST", {});
    const requestId = randomBytes(16).toString("hex");
    assert.equal(
      (
        await f.request(
          `/public/pages/${p.id}/forms/form`,
          "POST",
          { requestId, values: { email: "test@example.com" } },
          false,
        )
      ).status,
      201,
    );
    return requestId;
  };
  const local = await create("local"),
    remote = await create("webhook");
  assert.equal(f.db.prepare("SELECT COUNT(*) n FROM webhook_jobs").get().n, 1);
  assert.equal(
    f.db
      .prepare("SELECT COUNT(*) n FROM webhook_jobs WHERE submission_id=?")
      .get(local).n,
    0,
  );
  await f.growth.runWebhookJobs();
  assert.equal(
    f.db.prepare("SELECT state FROM webhook_jobs").get().state,
    "pending",
  );
  f.db.prepare("UPDATE webhook_jobs SET next_at=0").run();
  await f.growth.runWebhookJobs();
  assert.equal(
    f.db.prepare("SELECT state FROM webhook_jobs").get().state,
    "sent",
  );
  assert.deepEqual(keys, [remote, remote]);
});
