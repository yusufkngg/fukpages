import express from "express";
import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sanitizeHtml from "sanitize-html";
import { verifyPassword } from "./auth.mjs";

const kinds = new Set([
  "section",
  "row",
  "column",
  "box",
  "heading",
  "text",
  "image",
  "button",
  "input",
  "textarea",
  "divider",
  "spacer",
  "icon",
  "video",
  "list",
  "badge",
  "product",
  "countdown",
  "accordion",
]);
const containers = new Set(["section", "row", "column", "box"]);
const pageTypes = new Set([
  "landing",
  "home",
  "product",
  "collection",
  "page",
  "blog",
  "article",
  "cart",
  "search",
]);
const styleKeys = new Set([
  "display",
  "flexDirection",
  "justifyContent",
  "alignItems",
  "flexWrap",
  "gap",
  "width",
  "maxWidth",
  "minHeight",
  "height",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "textTransform",
  "color",
  "backgroundColor",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "borderWidth",
  "borderStyle",
  "borderColor",
  "borderRadius",
  "boxShadow",
  "opacity",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "zIndex",
  "overflow",
  "objectFit",
  "gridTemplateColumns",
]);
const cleanText = (value) => String(value ?? "").slice(0, 10000);
const cleanRich = (value) =>
  sanitizeHtml(cleanText(value), {
    allowedTags: ["b", "strong", "i", "em", "u", "s", "br", "p", "span"],
    allowedAttributes: { span: ["style"] },
    allowedStyles: {
      span: {
        color: [/^#[0-9a-f]{3,8}$/i],
        "background-color": [/^#[0-9a-f]{3,8}$/i],
        "font-weight": [/^(bold|[1-9]00)$/],
      },
    },
  });
const safeUrl = (value) => {
  const url = cleanText(value).trim();
  return /^(https?:\/\/|\/(?!\/)|#|mailto:|tel:)/i.test(url) ? url : "";
};
export function validateDocument(input) {
  if (
    !input ||
    input.schemaVersion !== 1 ||
    !pageTypes.has(input.type) ||
    !Array.isArray(input.nodes)
  )
    throw new Error("Geçersiz sayfa belgesi.");
  const seen = new Set();
  let count = 0;
  function walk(node, depth) {
    if (
      depth > 16 ||
      ++count > 600 ||
      !node ||
      !kinds.has(node.kind) ||
      typeof node.id !== "string" ||
      !/^[\w-]{1,80}$/.test(node.id) ||
      seen.has(node.id)
    )
      throw new Error("Geçersiz blok ağacı.");
    seen.add(node.id);
    const styles = {};
    for (const device of ["desktop", "tablet", "mobile"]) {
      styles[device] = {};
      for (const [key, value] of Object.entries(node.styles?.[device] ?? {})) {
        if (
          !styleKeys.has(key) ||
          !["string", "number"].includes(typeof value) ||
          String(value).length > 240 ||
          /[;{}]|url\s*\(|expression|@import/i.test(String(value))
        )
          throw new Error("Geçersiz stil değeri.");
        styles[device][key] = value;
      }
    }
    const props = {};
    for (const [key, value] of Object.entries(node.props ?? {})) {
      if (
        ![
          "html",
          "text",
          "src",
          "alt",
          "href",
          "tag",
          "placeholder",
          "inputType",
          "items",
          "title",
          "description",
          "price",
          "comparePrice",
          "endDate",
          "animation",
          "cssId",
          "targetBlank",
        ].includes(key)
      )
        continue;
      props[key] = ["src", "href"].includes(key)
        ? safeUrl(value)
        : key === "html"
          ? cleanRich(value)
          : typeof value === "boolean"
            ? value
            : cleanText(value);
    }
    if (props.tag && !["h1", "h2", "h3", "h4", "p", "div"].includes(props.tag))
      props.tag = "h2";
    return {
      id: node.id,
      kind: node.kind,
      name: cleanText(node.name).slice(0, 100),
      props,
      styles,
      hidden: Object.fromEntries(
        ["desktop", "tablet", "mobile"].map((device) => [
          device,
          node.hidden?.[device] === true,
        ]),
      ),
      children:
        containers.has(node.kind) && Array.isArray(node.children)
          ? node.children.map((child) => walk(child, depth + 1))
          : [],
    };
  }
  return {
    schemaVersion: 1,
    name: cleanText(input.name).slice(0, 120),
    type: input.type,
    nodes: input.nodes.map((node) => walk(node, 0)),
  };
}

export function createApp({
  dataDir = process.env.DATA_DIR ?? ".local",
  ownerHash = process.env.OWNER_PASSWORD_HASH,
  ownerLogin = process.env.OWNER_LOGIN ?? "owner",
} = {}) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  if (!ownerHash && existsSync(resolve(dataDir, "owner.hash")))
    ownerHash = readFileSync(resolve(dataDir, "owner.hash"), "utf8").trim();
  const db = new DatabaseSync(resolve(dataDir, "fukpages.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS stores (id TEXT PRIMARY KEY, name TEXT NOT NULL, client TEXT NOT NULL, domain TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS pages (id TEXT PRIMARY KEY, store_id TEXT NOT NULL, document TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS publications (page_id TEXT PRIMARY KEY, document TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, published INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, store_id TEXT, action TEXT NOT NULL, created INTEGER NOT NULL);`);
  if (!db.prepare("SELECT id FROM stores LIMIT 1").get()) {
    db.prepare(
      "INSERT INTO stores (id,name,client,domain,created) VALUES (?,?,?,?,?)",
    ).run("demo", "Aura Studio", "Demo çalışma alanı", "", Date.now());
  }
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    if (req.path.startsWith("/api/"))
      res.setHeader("Cache-Control", "no-store");
    const token = req.headers.cookie
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("fp_session="))
      ?.slice(11);
    if (token) {
      const digest = createHash("sha256").update(token).digest("hex");
      const session = db
        .prepare("SELECT * FROM sessions WHERE token=? AND expires>?")
        .get(digest, Date.now());
      if (session) req.ownerSession = session;
    }
    next();
  });
  const attempts = new Map();
  const auth = (req, res, next) =>
    req.ownerSession
      ? next()
      : res.status(401).json({ error: "Giriş yapmanız gerekiyor." });
  const csrf = (req, res, next) => {
    const supplied = req.get("X-CSRF-Token") ?? "";
    const expected = req.ownerSession?.csrf ?? "";
    if (
      !expected ||
      Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
    )
      return res
        .status(403)
        .json({ error: "Oturum doğrulanamadı. Sayfayı yenileyin." });
    next();
  };
  const cookie = (token, age) =>
    `fp_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
  const audit = (id, action) =>
    db
      .prepare("INSERT INTO audit (store_id,action,created) VALUES (?,?,?)")
      .run(id, action, Date.now());
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/auth/status", (req, res) =>
    res.json({
      configured: !!ownerHash,
      authenticated: !!req.ownerSession,
      csrf: req.ownerSession?.csrf,
    }),
  );
  app.post("/api/auth/login", (req, res) => {
    const origin = req.get("Origin");
    if (origin) {
      try {
        if (new URL(origin).host !== req.get("host"))
          return res
            .status(403)
            .json({ error: "Giriş isteğinin kaynağı doğrulanamadı." });
      } catch {
        return res
          .status(403)
          .json({ error: "Giriş isteğinin kaynağı doğrulanamadı." });
      }
    }
    if (!ownerHash)
      return res
        .status(503)
        .json({ error: "Yönetici hesabı henüz yapılandırılmadı." });
    const key = req.socket.remoteAddress;
    const current = attempts.get(key);
    const entry =
      current && current.until > Date.now()
        ? current
        : { count: 0, until: Date.now() + 15 * 60_000 };
    if (entry.count >= 5)
      return res
        .status(429)
        .json({ error: "Çok fazla deneme. 15 dakika sonra tekrar deneyin." });
    const password = req.body?.password;
    if (
      typeof password !== "string" ||
      password.length > 1024 ||
      req.body?.login !== ownerLogin ||
      !verifyPassword(password, ownerHash)
    ) {
      entry.count++;
      attempts.set(key, entry);
      return res
        .status(401)
        .json({ error: "Kullanıcı adı veya şifre hatalı." });
    }
    attempts.delete(key);
    const token = randomBytes(32).toString("hex");
    const csrfToken = randomBytes(24).toString("hex");
    const digest = createHash("sha256").update(token).digest("hex");
    db.prepare("DELETE FROM sessions WHERE expires<=?").run(Date.now());
    db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(
      digest,
      csrfToken,
      Date.now() + 8 * 3600_000,
    );
    res.setHeader("Set-Cookie", cookie(token, 8 * 3600));
    res.json({ authenticated: true, csrf: csrfToken });
  });
  app.post("/api/auth/logout", auth, csrf, (req, res) => {
    db.prepare("DELETE FROM sessions WHERE token=?").run(
      req.ownerSession.token,
    );
    res.setHeader("Set-Cookie", cookie("", 0));
    res.json({ ok: true });
  });
  app.get("/api/stores", auth, (_req, res) =>
    res.json(
      db
        .prepare("SELECT * FROM stores ORDER BY created")
        .all()
        .map((store) => ({
          ...store,
          connection: "local",
          pageCount: db
            .prepare("SELECT COUNT(*) AS count FROM pages WHERE store_id=?")
            .get(store.id).count,
        })),
    ),
  );
  app.post("/api/stores", auth, csrf, (req, res) => {
    const name = cleanText(req.body.name).trim().slice(0, 80);
    if (!name) return res.status(400).json({ error: "Mağaza adı gerekli." });
    const id = randomBytes(12).toString("hex");
    db.prepare(
      "INSERT INTO stores (id,name,client,domain,created) VALUES (?,?,?,?,?)",
    ).run(id, name, cleanText(req.body.client).slice(0, 100), "", Date.now());
    audit(id, "Yerel çalışma alanı oluşturuldu");
    res.status(201).json({ id });
  });
  app.patch("/api/stores/:id/status", auth, csrf, (req, res) => {
    if (!["active", "suspended"].includes(req.body.status))
      return res.status(400).json({ error: "Geçersiz durum." });
    if (!db.prepare("SELECT id FROM stores WHERE id=?").get(req.params.id))
      return res.status(404).json({ error: "Mağaza bulunamadı." });
    db.exec("BEGIN");
    try {
      db.prepare("UPDATE stores SET status=? WHERE id=?").run(
        req.body.status,
        req.params.id,
      );
      if (req.body.status === "suspended")
        db.prepare(
          "UPDATE publications SET active=0 WHERE page_id IN (SELECT id FROM pages WHERE store_id=?)",
        ).run(req.params.id);
      audit(
        req.params.id,
        req.body.status === "suspended"
          ? "Yerel yayınlar kaldırıldı, çalışma alanı durduruldu"
          : "Çalışma alanı etkinleştirildi",
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    res.json({ status: req.body.status, connection: "local" });
  });
  app.get("/api/stores/:id/audit", auth, (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT * FROM audit WHERE store_id=? ORDER BY id DESC LIMIT 30",
        )
        .all(req.params.id),
    ),
  );
  app.get("/api/stores/:id/pages", auth, (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT id, document, version, updated FROM pages WHERE store_id=? ORDER BY updated DESC",
        )
        .all(req.params.id)
        .map((page) => ({
          id: page.id,
          version: page.version,
          updated: page.updated,
          name: JSON.parse(page.document).name,
          type: JSON.parse(page.document).type,
        })),
    ),
  );
  app.post("/api/documents/validate", auth, csrf, (req, res) => {
    try {
      res.json({ document: validateDocument(req.body.document) });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  const activeStore = (id, res) => {
    const store = db.prepare("SELECT * FROM stores WHERE id=?").get(id);
    if (!store) {
      res.status(404).json({ error: "Mağaza bulunamadı." });
      return false;
    }
    if (store.status !== "active") {
      res
        .status(403)
        .json({ error: "Bu çalışma alanı devre dışı. Önce etkinleştirin." });
      return false;
    }
    return store;
  };
  app.post("/api/stores/:id/pages", auth, csrf, (req, res) => {
    if (!activeStore(req.params.id, res)) return;
    let document;
    try {
      document = validateDocument(req.body.document);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    const id = randomBytes(12).toString("hex");
    db.prepare(
      "INSERT INTO pages (id,store_id,document,updated) VALUES (?,?,?,?)",
    ).run(id, req.params.id, JSON.stringify(document), Date.now());
    audit(req.params.id, `Taslak oluşturuldu: ${document.name}`);
    res.status(201).json({ id, document, version: 1 });
  });
  app.get("/api/pages/:id", auth, (req, res) => {
    const page = db
      .prepare("SELECT * FROM pages WHERE id=?")
      .get(req.params.id);
    if (!page) return res.status(404).json({ error: "Sayfa bulunamadı." });
    res.json({ ...page, document: JSON.parse(page.document) });
  });
  app.put("/api/pages/:id", auth, csrf, (req, res) => {
    const page = db
      .prepare("SELECT * FROM pages WHERE id=?")
      .get(req.params.id);
    if (!page) return res.status(404).json({ error: "Sayfa bulunamadı." });
    if (!activeStore(page.store_id, res)) return;
    if (req.body.version !== page.version)
      return res
        .status(409)
        .json({
          error:
            "Sayfa başka bir sekmede değişti. Kaydınızı dışa aktarıp güncel sürümü yeniden açın.",
        });
    let document;
    try {
      document = validateDocument(req.body.document);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    db.prepare(
      "UPDATE pages SET document=?,version=version+1,updated=? WHERE id=? AND version=?",
    ).run(JSON.stringify(document), Date.now(), page.id, page.version);
    res.json({ version: page.version + 1, document });
  });
  app.post("/api/pages/:id/publish", auth, csrf, (req, res) => {
    const page = db
      .prepare("SELECT * FROM pages WHERE id=?")
      .get(req.params.id);
    if (!page) return res.status(404).json({ error: "Sayfa bulunamadı." });
    if (!activeStore(page.store_id, res)) return;
    db.prepare(
      "INSERT INTO publications (page_id,document,published) VALUES (?,?,?) ON CONFLICT(page_id) DO UPDATE SET document=excluded.document, active=1, published=excluded.published",
    ).run(page.id, page.document, Date.now());
    audit(page.store_id, "Yerel önizlemeye yayınlandı");
    res.json({ published: true, mode: "local" });
  });
  app.get("/api/public/pages/:id", (req, res) => {
    const page = db
      .prepare(
        "SELECT publications.document FROM publications JOIN pages ON pages.id=publications.page_id JOIN stores ON stores.id=pages.store_id WHERE publications.page_id=? AND publications.active=1 AND stores.status='active'",
      )
      .get(req.params.id);
    if (!page)
      return res.status(404).json({ error: "Bu sayfa yayında değil." });
    res.json({ document: JSON.parse(page.document) });
  });
  const dist = resolve("dist");
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get("/{*splat}", (req, res) =>
      req.path.startsWith("/api/")
        ? res.status(404).json({ error: "İşlem bulunamadı." })
        : res.sendFile(resolve(dist, "index.html")),
    );
  }
  app.use((error, _req, res, _next) => {
    res
      .status(error.status === 413 ? 413 : error.status === 400 ? 400 : 500)
      .json({
        error:
          error.status === 413 ? "Sayfa çok büyük." : "İşlem tamamlanamadı.",
      });
  });
  return { app, db };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const { app } = createApp();
  app.listen(Number(process.env.PORT ?? 3001), "0.0.0.0", () =>
    console.log(
      "FukPages sunucusu hazır. Shopify bağlantısı: henüz yapılandırılmadı.",
    ),
  );
}
