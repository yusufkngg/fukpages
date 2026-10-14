import express from "express";
import { isButtonContent } from "../src/atomicContent.ts";
import { normalizeLink } from "../src/links.ts";
import { normalizeStyleValue } from "../src/styleValues.ts";
import { cleanIconNode, iconName, iconStroke } from "../src/iconNode.ts";
import { registerPageManagement } from "./page-management.mjs";
import { createPageRules, registerPageTrash } from "./page-lifecycle.mjs";
import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import sanitizeHtml from "./generated/sanitize-html.cjs";
import { createTeamService } from "./team.mjs";
import { verifyPassword } from "./auth.mjs";
import { registerSeo } from "./seo.mjs";
import { registerGrowth } from "./growth.mjs";
import { registerCatalog } from "./catalog.mjs";
import { documentUses, registerStudio } from "./studio.mjs";
import {
  createShopifyThemeService,
  normalizeShopDomain,
} from "./shopify-theme.mjs";

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
  "itemList",
  "badge",
  "product",
  "countdown",
  "accordion",
  "form",
  "select",
  "checkbox",
  "radio",
  "tabs",
  "carousel",
  "gallery",
  "logos",
  "rating",
  "comparison",
  "beforeAfter",
  "coupon",
  "shipping",
  "popup",
  "videoPopup",
  "backToTop",
  "breadcrumb",
  "mobileMenu",
  "blogList",
  "customCode",
  "appEmbed",
  "productGallery",
  "variantPicker",
  "quantity",
  "addToCart",
  "stickyCart",
  "collectionGrid",
  "productField",
  "bundle",
  "sizeTable",
]);
const containers = new Set([
  "section",
  "row",
  "column",
  "box",
  "form",
  "popup",
  "itemList",
  "rating",
  "list",
  "button",
  "badge",
  "product",
]);
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
  "order",
  "flexBasis",
  "flexGrow",
  "flexShrink",
  "minWidth",
  "aspectRatio",
  "objectPosition",
  "fontStyle",
  "fontVariationSettings",
  "textDecoration",
  "transform",
  "transition",
  "cursor",
]);
const cleanText = (value) => String(value ?? "").slice(0, 10000);
const cleanRich = (value) =>
  sanitizeHtml(cleanText(value), {
    allowedTags: ["b", "strong", "i", "em", "u", "s", "br", "p", "span", "a"],
    allowedAttributes: { span: ["style"], a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    transformTags: {
      strike: "s",
      a: (tagName, attribs) => {
        const href = safeUrl(attribs.href);
        if (!href) return { tagName: "span", attribs: {} };
        return {
          tagName,
          attribs:
            attribs.target === "_blank"
              ? { href, target: "_blank", rel: "noopener noreferrer" }
              : { href },
        };
      },
    },
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
        styles[device][key] = normalizeStyleValue(key, value);
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
          "sectionRole",
          "presetId",
          "mobileSrc",
          "backgroundSrc",
          "backgroundOverlay",
          "rotation",
          "flipX",
          "flipY",
          "focusX",
          "focusY",
          "aspectRatio",
          "lightbox",
          "crop",
          "action",
          "actionTarget",
          "productId",
          "collectionId",
          "field",
          "metafield",
          "label",
          "fieldName",
          "required",
          "helpText",
          "errorMessage",
          "options",
          "successMessage",
          "redirect",
          "destination",
          "consent",
          "code",
          "caption",
          "images",
          "slides",
          "columns",
          "rows",
          "rating",
          "count",
          "threshold",
          "currency",
          "popupId",
          "trigger",
          "couponCode",
          "locked",
          "group",
          "globalStyle",
          "globalDetached",
          "sectionContentWidth",
          "freeLayout",
          "accordionItems",
          "accordionHeaderBg",
          "accordionContentBg",
          "accordionBorderColor",
          "accordionGap",
          "accordionRadius",
          "accordionHeaderPadding",
          "accordionContentPadding",
          "freePlaced",
          "freeFlowStyles",
          "resourceBinding",
          "linkedSectionId",
          "slot",
          "atomicContent",
          "iconTint",
          "buttonVariant",
          "hoverStyles",
          "focusStyles",
          "linkedVersion",
          "language",
          "author",
          "date",
          "summary",
          "sort",
          "pageSize",
          "showStock",
          "quantity",
          "fallbackFont",
          "integration",
          "translations",
          "productIds",
          "discountPercent",
          "quantityOffers",
          "variantMode",
          "submitLabel",
          "view",
          "moving",
          "icon",
          "iconNode",
          "strokeWidth",
          "iconFill",
          "gridColumns",
          "showHeader",
          "showDescription",
          "showAddToCart",
        ].includes(key)
      )
        continue;
      if (key === "iconNode") {
        if (value === "" || value === undefined || value === null) continue;
        // Vector icons are geometry only; anything else is rejected.
        const node = cleanIconNode(value);
        if (!node) throw new Error("Geçersiz ikon.");
        props.iconNode = node;
        continue;
      }
      if (key === "icon") {
        props.icon = iconName(value);
        continue;
      }
      if (key === "strokeWidth") {
        props.strokeWidth = String(iconStroke(value));
        continue;
      }
      props[key] = [
        "src",
        "href",
        "mobileSrc",
        "backgroundSrc",
        "redirect",
      ].includes(key)
        ? key === "href"
          ? normalizeLink(value)
          : safeUrl(value)
        : key === "html"
          ? cleanRich(value)
          : key === "accordionItems"
            ? String(value)
            : typeof value === "boolean"
              ? value
              : cleanText(value);
    }
    if (props.accordionItems) {
      if (props.accordionItems.length > 100000)
        throw new Error("Accordion content is too large.");
      let items;
      try {
        items = JSON.parse(props.accordionItems);
      } catch {
        throw new Error("Invalid accordion items.");
      }
      if (
        !Array.isArray(items) ||
        !items.length ||
        items.length > 40 ||
        items.some(
          (item) =>
            !item ||
            typeof item.id !== "string" ||
            !item.id ||
            item.id.length > 100 ||
            typeof item.title !== "string" ||
            typeof item.content !== "string",
        ) ||
        new Set(items.map((item) => item.id)).size !== items.length
      )
        throw new Error("Invalid accordion items.");
      props.accordionItems = JSON.stringify(
        items.map((item) => ({
          id: item.id,
          title: cleanText(item.title),
          content: cleanText(item.content),
        })),
      );
    }
    for (const key of [
      "accordionHeaderBg",
      "accordionContentBg",
      "accordionBorderColor",
    ])
      if (props[key] && !/^#[a-f0-9]{6}([a-f0-9]{2})?$/i.test(props[key]))
        throw new Error("Invalid accordion colour.");
    for (const key of [
      "accordionGap",
      "accordionRadius",
      "accordionHeaderPadding",
      "accordionContentPadding",
    ])
      if (
        props[key] !== undefined &&
        (!Number.isFinite(Number(props[key])) ||
          Number(props[key]) < 0 ||
          Number(props[key]) > 200)
      )
        throw new Error("Invalid accordion spacing.");
    if (props.freeFlowStyles) {
      const original = JSON.parse(props.freeFlowStyles);
      if (!original || Array.isArray(original) || typeof original !== "object")
        throw new Error("Geçersiz akış stili.");
      for (const [device, styles] of Object.entries(original)) {
        if (
          !["desktop", "tablet", "mobile"].includes(device) ||
          !styles ||
          Array.isArray(styles) ||
          typeof styles !== "object"
        )
          throw new Error("Geçersiz akış stili.");
        for (const [key, value] of Object.entries(styles))
          if (
            !styleKeys.has(key) ||
            !["string", "number"].includes(typeof value) ||
            String(value).length > 240 ||
            /[;{}]|url\s*\(|expression|@import/i.test(String(value))
          )
            throw new Error("Geçersiz akış stili.");
      }
    }
    if (props.freeLayout) {
      const free = JSON.parse(props.freeLayout);
      if (
        !free ||
        Array.isArray(free) ||
        typeof free !== "object" ||
        Object.entries(free).some(
          ([key, value]) =>
            !["desktop", "tablet", "mobile"].includes(key) ||
            typeof value !== "number" ||
            !Number.isFinite(value) ||
            value < 100 ||
            value > 5000,
        )
      )
        throw new Error("Geçersiz serbest yerleşim ayarı.");
    }
    if (props.translations) {
      let translated;
      try {
        translated = JSON.parse(props.translations);
      } catch {
        throw new Error("Geçersiz çeviri JSON’u.");
      }
      if (
        !translated ||
        Array.isArray(translated) ||
        typeof translated !== "object" ||
        Object.keys(translated).length > 12
      )
        throw new Error("Geçersiz çeviri listesi.");
      const sanitized = {};
      for (const [locale, fields] of Object.entries(translated)) {
        if (
          !/^[a-z]{2}(-[A-Z]{2})?$/.test(locale) ||
          !fields ||
          typeof fields !== "object" ||
          Array.isArray(fields)
        )
          throw new Error("Geçersiz çeviri dili.");
        sanitized[locale] = {};
        for (const [key, value] of Object.entries(fields))
          if (
            [
              "html",
              "text",
              "title",
              "description",
              "alt",
              "placeholder",
              "label",
              "helpText",
              "items",
              "options",
              "columns",
              "rows",
              "successMessage",
              "errorMessage",
              "submitLabel",
            ].includes(key)
          )
            sanitized[locale][key] =
              key === "html" ? cleanRich(value) : cleanText(value);
      }
      props.translations = JSON.stringify(sanitized);
    }
    for (const key of ["hoverStyles", "focusStyles"])
      if (props[key]) {
        let state;
        try {
          state = JSON.parse(props[key]);
        } catch {
          throw new Error("Geçersiz durum stili.");
        }
        for (const [k, v] of Object.entries(state))
          if (
            !styleKeys.has(k) ||
            typeof v !== "string" ||
            v.length > 240 ||
            /[;{}]|url\s*\(|expression|@import/i.test(v)
          )
            throw new Error("Geçersiz durum stili.");
        props[key] = JSON.stringify(state);
      }
    if (
      props.tag &&
      !["h1", "h2", "h3", "h4", "h5", "h6", "p", "div"].includes(props.tag)
    )
      props.tag = "h2";
    const result = {
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
    if (
      ["button", "badge"].includes(node.kind) &&
      !result.children.every(isButtonContent)
    )
      throw new Error("Use text, icons or images inside a button.");
    return result;
  }
  const result = {
    schemaVersion: 1,
    name: cleanText(input.name).slice(0, 120),
    type: input.type,
    nodes: input.nodes.map((node) => walk(node, 0)),
  };
  if (input.themeLayout !== undefined) {
    if (
      !input.themeLayout ||
      typeof input.themeLayout.snapshotId !== "string" ||
      !/^[a-f0-9-]{36}$/.test(input.themeLayout.snapshotId) ||
      typeof input.themeLayout.useShell !== "boolean"
    )
      throw new Error("Geçersiz tema bağlantısı.");
    result.themeLayout = {
      snapshotId: input.themeLayout.snapshotId,
      useShell: input.themeLayout.useShell,
    };
  }
  if (input.locales) {
    if (
      !Array.isArray(input.locales) ||
      input.locales.length > 12 ||
      input.locales.some((l) => !/^[a-z]{2}(-[A-Z]{2})?$/.test(l))
    )
      throw new Error("Geçersiz dil listesi.");
    result.locales = [...new Set(input.locales)];
    result.defaultLocale = result.locales.includes(input.defaultLocale)
      ? input.defaultLocale
      : result.locales[0];
  }
  if (input.seo)
    result.seo = {
      slug: cleanText(input.seo.slug)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 100),
      title: cleanText(input.seo.title).slice(0, 160),
      description: cleanText(input.seo.description).slice(0, 320),
      image: safeUrl(input.seo.image),
      noindex: input.seo.noindex === true,
    };
  return result;
}

export function createApp({
  dataDir = process.env.DATA_DIR ?? ".local",
  ownerHash = process.env.OWNER_PASSWORD_HASH,
  ownerLogin = process.env.OWNER_LOGIN ?? "owner",
  shopify = createShopifyThemeService(),
  ai,
  webhookFetch,
  demoMode = false,
  secureCookies = process.env.NODE_ENV === "production",
  authSetupError = "",
} = {}) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const fontCacheRoot = resolve(tmpdir(), "fukpages-font-cache");
  mkdirSync(resolve(fontCacheRoot, "fontconfig"), {
    recursive: true,
    mode: 0o700,
  });
  process.env.XDG_CACHE_HOME ??= fontCacheRoot;
  if (!ownerHash && existsSync(resolve(dataDir, "owner.hash")))
    ownerHash = readFileSync(resolve(dataDir, "owner.hash"), "utf8").trim();
  const db = new DatabaseSync(resolve(dataDir, "fukpages.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS stores (id TEXT PRIMARY KEY, name TEXT NOT NULL, client TEXT NOT NULL, domain TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS pages (id TEXT PRIMARY KEY, store_id TEXT NOT NULL, document TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS publications (page_id TEXT PRIMARY KEY, document TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, published INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, store_id TEXT, action TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS saved_sections (id TEXT PRIMARY KEY, store_id TEXT NOT NULL, name TEXT NOT NULL, section TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS theme_snapshots (id TEXT PRIMARY KEY, store_id TEXT NOT NULL, domain TEXT NOT NULL, template TEXT NOT NULL, snapshot TEXT NOT NULL, created INTEGER NOT NULL);`);
  if (!db.prepare("SELECT id FROM stores LIMIT 1").get()) {
    db.prepare(
      "INSERT INTO stores (id,name,client,domain,created) VALUES (?,?,?,?,?)",
    ).run("demo", "Aura Studio", "Demo çalışma alanı", "", Date.now());
  }
  const team = createTeamService(db, ownerLogin);
  const pageRules = createPageRules(db);
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
      if (session) {
        req.access = team.access(session);
        if (req.access) req.ownerSession = session;
      }
    }
    next();
  });
  app.use((req, res, next) => team.guard(req, res, next));
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
    `fp_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secureCookies ? "; Secure" : ""}`;
  const audit = (id, action) =>
    db
      .prepare("INSERT INTO audit (store_id,action,created) VALUES (?,?,?)")
      .run(id, action, Date.now());
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/auth/status", (req, res) =>
    res.json({
      configured: !!ownerHash,
      setupError: authSetupError || undefined,
      demo: demoMode,
      authenticated: !!req.ownerSession,
      csrf: req.ownerSession?.csrf,
      role: req.access?.role,
      draftScope: req.access
        ? createHash("sha256")
            .update(req.access.identity)
            .digest("hex")
            .slice(0, 24)
        : undefined,
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
    const key = createHash("sha256")
      .update(req.socket.remoteAddress || "unknown")
      .digest("hex");
    db.prepare("DELETE FROM login_attempts WHERE until<=?").run(Date.now());
    const current = db
      .prepare("SELECT count,until FROM login_attempts WHERE key=?")
      .get(key);
    const entry =
      current && current.until > Date.now()
        ? current
        : { count: 0, until: Date.now() + 15 * 60_000 };
    if (entry.count >= 5)
      return res
        .status(429)
        .json({ error: "Çok fazla deneme. 15 dakika sonra tekrar deneyin." });
    const password = req.body?.password;
    const member =
      typeof password === "string" && password.length <= 1024
        ? team.match(req.body?.login, password)
        : null;
    if (
      typeof password !== "string" ||
      password.length > 1024 ||
      (!member &&
        (req.body?.login !== ownerLogin ||
          !verifyPassword(password, ownerHash)))
    ) {
      entry.count++;
      db.prepare(
        "INSERT INTO login_attempts VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,until=excluded.until",
      ).run(key, entry.count, entry.until);
      return res
        .status(401)
        .json({ error: "Kullanıcı adı veya şifre hatalı." });
    }
    db.prepare("DELETE FROM login_attempts WHERE key=?").run(key);
    const token = randomBytes(32).toString("hex");
    const csrfToken = randomBytes(24).toString("hex");
    const digest = createHash("sha256").update(token).digest("hex");
    db.prepare("DELETE FROM sessions WHERE expires<=?").run(Date.now());
    db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(
      digest,
      csrfToken,
      Date.now() + 8 * 3600_000,
    );
    if (member) team.bind(digest, member);
    res.setHeader("Set-Cookie", cookie(token, 8 * 3600));
    res.json({
      authenticated: true,
      csrf: csrfToken,
      role: member?.role || "owner",
    });
  });
  app.post("/api/auth/logout", auth, csrf, (req, res) => {
    db.prepare("DELETE FROM sessions WHERE token=?").run(
      req.ownerSession.token,
    );
    res.setHeader("Set-Cookie", cookie("", 0));
    res.json({ ok: true });
  });
  team.register({ app, auth, csrf });
  app.get("/api/stores", auth, (req, res) =>
    res.json(
      db
        .prepare("SELECT * FROM stores ORDER BY created")
        .all()
        .filter(
          (s) =>
            req.access?.role === "owner" ||
            (req.access?.stores.includes(s.id) && s.status === "active"),
        )
        .map((store) => ({
          ...store,
          connection: db
            .prepare(
              "SELECT id FROM theme_snapshots WHERE store_id=? AND domain=? LIMIT 1",
            )
            .get(store.id, store.domain)
            ? "synced"
            : shopify.configured(store.domain)
              ? "configured"
              : "local",
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
    let domain = "";
    try {
      if (req.body.domain) domain = normalizeShopDomain(req.body.domain);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    db.prepare(
      "INSERT INTO stores (id,name,client,domain,created) VALUES (?,?,?,?,?)",
    ).run(
      id,
      name,
      cleanText(req.body.client).slice(0, 100),
      domain,
      Date.now(),
    );
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
      if (req.body.status === "suspended") {
        db.prepare(
          "UPDATE publications SET active=0 WHERE page_id IN (SELECT id FROM pages WHERE store_id=?)",
        ).run(req.params.id);
        db.prepare(
          "UPDATE schedules SET status='cancelled' WHERE page_id IN (SELECT id FROM pages WHERE store_id=?)",
        ).run(req.params.id);
        db.prepare(
          "UPDATE webhook_jobs SET state='cancelled' WHERE submission_id IN (SELECT id FROM form_submissions WHERE store_id=?) AND state='pending'",
        ).run(req.params.id);
      }
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
  const validThemeBinding = (document, storeId) => {
    if (!document.themeLayout) return true;
    const row = db
      .prepare(
        "SELECT theme_snapshots.domain,theme_snapshots.template,stores.domain AS current_domain FROM theme_snapshots JOIN stores ON stores.id=theme_snapshots.store_id WHERE theme_snapshots.id=? AND theme_snapshots.store_id=?",
      )
      .get(document.themeLayout.snapshotId, storeId);
    const base = {
      landing: "page",
      home: "index",
      product: "product",
      collection: "collection",
      page: "page",
      blog: "blog",
      article: "article",
      cart: "cart",
      search: "search",
    }[document.type];
    return (
      !!row &&
      row.domain === row.current_domain &&
      new RegExp(`^templates/${base}(\\.[a-zA-Z0-9_-]+)?\\.json$`).test(
        row.template,
      )
    );
  };
  const commerce = registerCatalog({ app, db, auth, csrf, activeStore });
  const studio = registerStudio({
    app,
    db,
    auth,
    csrf,
    activeStore,
    dataDir,
    validateDocument,
    catalog: commerce.catalog,
    pageRules,
  });
  const validAssetBinding = (document, storeId) => {
    const refs = [
      ...JSON.stringify(document).matchAll(/\/api\/assets\/([a-f0-9]{32})\//g),
    ].map((m) => m[1]);
    return refs.every((id) =>
      db
        .prepare("SELECT id FROM assets WHERE id=? AND store_id=?")
        .get(id, storeId),
    );
  };
  app.patch("/api/stores/:id/shopify", auth, csrf, (req, res) => {
    if (!activeStore(req.params.id, res)) return;
    let domain;
    try {
      domain = normalizeShopDomain(req.body.domain);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    db.prepare("UPDATE stores SET domain=? WHERE id=?").run(
      domain,
      req.params.id,
    );
    audit(req.params.id, "Shopify mağaza adresi kaydedildi");
    res.json({ domain, configured: shopify.configured(domain) });
  });
  app.get("/api/stores/:id/theme", auth, (req, res) => {
    const store = db
      .prepare("SELECT * FROM stores WHERE id=?")
      .get(req.params.id);
    if (!store) return res.status(404).json({ error: "Mağaza bulunamadı." });
    const template =
      typeof req.query.template === "string"
        ? req.query.template
        : "templates/index.json";
    const cached = db
      .prepare(
        "SELECT snapshot FROM theme_snapshots WHERE store_id=? AND domain=? AND template=? ORDER BY created DESC,rowid DESC LIMIT 1",
      )
      .get(store.id, store.domain, template);
    res.json({
      domain: store.domain,
      configured: shopify.configured(store.domain),
      snapshot: cached ? JSON.parse(cached.snapshot) : null,
    });
  });
  const syncing = new Set();
  app.post("/api/stores/:id/theme/sync", auth, csrf, async (req, res) => {
    const store = activeStore(req.params.id, res);
    if (!store) return;
    const key = `${store.id}:${req.body.template ?? "templates/index.json"}`;
    if (syncing.has(key))
      return res
        .status(409)
        .json({ error: "Tema senkronizasyonu zaten devam ediyor." });
    syncing.add(key);
    try {
      const snapshot = await shopify.sync(store.domain, req.body.template);
      const current = activeStore(store.id, res);
      if (!current) return;
      if (current.domain !== store.domain)
        return res.status(409).json({
          error:
            "Mağaza adresi değişti. Senkronizasyonu yeni adresle tekrar başlatın.",
        });
      db.prepare(
        "INSERT INTO theme_snapshots (id,store_id,domain,template,snapshot,created) VALUES (?,?,?,?,?,?)",
      ).run(
        snapshot.id,
        store.id,
        store.domain,
        snapshot.templateFilename,
        JSON.stringify(snapshot),
        snapshot.syncedAt,
      );
      audit(store.id, "Shopify tema bölüm sırası okundu");
      res.json({ domain: store.domain, configured: true, snapshot });
    } catch (error) {
      res.status(error.status ?? 502).json({ error: error.message });
    } finally {
      syncing.delete(key);
    }
  });
  app.get("/api/stores/:id/sections", auth, (req, res) => {
    if (!db.prepare("SELECT id FROM stores WHERE id=?").get(req.params.id))
      return res.status(404).json({ error: "Mağaza bulunamadı." });
    res.json(
      db
        .prepare(
          "SELECT id,name,section,created FROM saved_sections WHERE store_id=? ORDER BY created DESC",
        )
        .all(req.params.id)
        .map((row) => ({
          ...row,
          section: JSON.parse(row.section),
          linkedVersion:
            db
              .prepare("SELECT version FROM synced_sections WHERE id=?")
              .get(row.id)?.version || 0,
        })),
    );
  });
  app.post("/api/stores/:id/sections", auth, csrf, (req, res) => {
    if (!activeStore(req.params.id, res)) return;
    try {
      const name = cleanText(req.body.name).trim().slice(0, 100);
      if (!name) return res.status(400).json({ error: "Bölüm adı gerekli." });
      const document = validateDocument({
        schemaVersion: 1,
        name,
        type: "landing",
        nodes: [req.body.section],
      });
      const section = document.nodes[0];
      if (section.kind !== "section")
        return res
          .status(400)
          .json({ error: "Yalnızca bir bütün bölüm kaydedilebilir." });
      section.name = name;
      const id = randomBytes(12).toString("hex");
      const created = Date.now();
      if (req.body.synchronized === true) {
        section.props.linkedSectionId = id;
        section.props.linkedVersion = "1";
        db.prepare("INSERT INTO synced_sections VALUES(?,?,1)").run(
          id,
          req.params.id,
        );
      }
      db.prepare("INSERT INTO saved_sections VALUES (?,?,?,?,?)").run(
        id,
        req.params.id,
        name,
        JSON.stringify(section),
        created,
      );
      audit(req.params.id, `Bölüm kütüphaneye kaydedildi: ${name}`);
      res.status(201).json({ id, name, section, created });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.delete("/api/stores/:id/sections/:sectionId", auth, csrf, (req, res) => {
    if (!activeStore(req.params.id, res)) return;
    const result = db
      .prepare("DELETE FROM saved_sections WHERE id=? AND store_id=?")
      .run(req.params.sectionId, req.params.id);
    if (!result.changes)
      return res.status(404).json({ error: "Kaydedilen bölüm bulunamadı." });
    res.json({ ok: true });
  });
  app.post("/api/stores/:id/pages", auth, csrf, (req, res) => {
    if (!activeStore(req.params.id, res)) return;
    let document;
    try {
      document = validateDocument(req.body.document);
      if (!validAssetBinding(document, req.params.id))
        throw new Error(
          "Medya bu mağazaya ait değil. Mağazalar arası aktarımda medyayı eşleştir.",
        );
      if (!validThemeBinding(document, req.params.id))
        throw new Error(
          "Tema bağlantısı bu mağazaya ait değil veya güncel değil.",
        );
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    const conflict = pageRules.singletonConflict(req.params.id, document.type);
    if (conflict) return pageRules.rejectSingleton(res, conflict);
    const id = randomBytes(12).toString("hex");
    db.prepare(
      "INSERT INTO pages (id,store_id,document,updated) VALUES (?,?,?,?)",
    ).run(id, req.params.id, JSON.stringify(document), Date.now());
    pageRules.syncHomeAssignment(req.params.id);
    audit(req.params.id, `Taslak oluşturuldu: ${document.name}`);
    studio.recordRevision(
      { id, version: 1, document: JSON.stringify(document) },
      "Oluşturuldu",
    );
    res.status(201).json({ id, document, version: 1 });
  });
  app.get("/api/pages/:id", auth, (req, res) => {
    const page = db
      .prepare("SELECT * FROM pages WHERE id=?")
      .get(req.params.id);
    if (!page) return res.status(404).json({ error: "Sayfa bulunamadı." });
    const document = JSON.parse(page.document);
    const theme =
      document.themeLayout && validThemeBinding(document, page.store_id)
        ? db
            .prepare(
              "SELECT snapshot FROM theme_snapshots WHERE id=? AND store_id=?",
            )
            .get(document.themeLayout.snapshotId, page.store_id)
        : null;
    res.json({
      ...page,
      document,
      assignments: db
        .prepare(
          "SELECT entity_id FROM page_assignments WHERE page_id=? ORDER BY entity_id",
        )
        .all(page.id)
        .map((r) => r.entity_id),
      themeSnapshot: theme ? JSON.parse(theme.snapshot) : null,
    });
  });
  app.put("/api/pages/:id", auth, csrf, (req, res) => {
    const page = db
      .prepare("SELECT * FROM pages WHERE id=?")
      .get(req.params.id);
    if (!page) return res.status(404).json({ error: "Sayfa bulunamadı." });
    if (!activeStore(page.store_id, res)) return;
    if (req.body.version !== page.version)
      return res.status(409).json({
        error:
          "Sayfa başka bir sekmede değişti. Kaydınızı dışa aktarıp güncel sürümü yeniden açın.",
      });
    let document;
    try {
      document = validateDocument(req.body.document);
      if (!validAssetBinding(document, page.store_id))
        throw new Error(
          "Medya bu mağazaya ait değil. Mağazalar arası aktarımda medyayı eşleştir.",
        );
      if (!validThemeBinding(document, page.store_id))
        throw new Error(
          "Tema bağlantısı bu mağazaya ait değil veya güncel değil.",
        );
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    const previousType = JSON.parse(page.document).type;
    if (document.type !== previousType) {
      const conflict = pageRules.singletonConflict(
        page.store_id,
        document.type,
        page.id,
      );
      if (conflict) return pageRules.rejectSingleton(res, conflict);
    }
    studio.recordRevision(page);
    db.prepare(
      "UPDATE pages SET document=?,version=version+1,updated=? WHERE id=? AND version=?",
    ).run(JSON.stringify(document), Date.now(), page.id, page.version);
    if (document.type !== previousType) {
      pageRules.releaseMismatchedAssignments(page.id, document.type);
      pageRules.syncHomeAssignment(page.store_id);
    }
    res.json({ version: page.version + 1, document });
  });
  app.post("/api/pages/:id/publish", auth, csrf, (req, res) => {
    const page = db
      .prepare("SELECT * FROM pages WHERE id=?")
      .get(req.params.id);
    if (!page) return res.status(404).json({ error: "Sayfa bulunamadı." });
    if (!activeStore(page.store_id, res)) return;
    const publishingDoc = JSON.parse(page.document),
      slug = publishingDoc.seo?.slug;
    if (
      slug &&
      db
        .prepare(
          "SELECT p.id FROM publications u JOIN pages p ON p.id=u.page_id WHERE p.store_id=? AND p.id<>? AND u.active=1 AND json_extract(u.document,'$.seo.slug')=?",
        )
        .get(page.store_id, page.id, slug)
    )
      return res
        .status(409)
        .json({ error: "Bu kısa adres başka bir yayında kullanılıyor." });
    db.prepare(
      "INSERT INTO publications (page_id,document,published) VALUES (?,?,?) ON CONFLICT(page_id) DO UPDATE SET document=excluded.document, active=1, published=excluded.published",
    ).run(page.id, page.document, Date.now());
    audit(page.store_id, "Yerel önizlemeye yayınlandı");
    studio.recordPublication(page);
    res.json({
      published: true,
      mode: "local",
      path: slug ? `/p/${page.store_id}/${slug}` : `/?published=${page.id}`,
      seoTitle: publishingDoc.seo?.title || publishingDoc.name,
    });
  });
  app.get("/api/public/pages/:id", (req, res) => {
    studio.runSchedules();
    const page = db
      .prepare(
        "SELECT publications.document,pages.store_id FROM publications JOIN pages ON pages.id=publications.page_id JOIN stores ON stores.id=pages.store_id WHERE publications.page_id=? AND publications.active=1 AND stores.status='active'",
      )
      .get(req.params.id);
    if (!page)
      return res.status(404).json({ error: "Bu sayfa yayında değil." });
    const document = JSON.parse(page.document);
    res.json({
      document,
      ...pageManagement.contextFor(req.params.id, document, page.store_id),
      catalog: commerce.catalog(page.store_id),
      formDestination: studio.destination(),
      storeId: page.store_id,
      pageId: req.params.id,
      brand: studio.brand(page.store_id),
      assets: studio
        .assets(page.store_id, true)
        .filter(
          (a) =>
            documentUses(document, a) ||
            (a.type === "font" &&
              JSON.stringify(studio.brand(page.store_id).fonts).includes(
                a.family,
              )),
        ),
    });
  });
  const growth = registerGrowth({
    app,
    db,
    auth,
    csrf,
    activeStore,
    validateDocument,
    studio,
    commerce,
    dataDir,
    ai,
    webhookFetch,
  });
  const dist = resolve("dist");
  const pageManagement = registerPageManagement({
    app,
    db,
    auth,
    csrf,
    activeStore,
    studio,
    commerce,
    validateDocument,
    audit,
    pageRules,
  });
  registerPageTrash({
    app,
    db,
    auth,
    csrf,
    activeStore,
    audit,
    rules: pageRules,
  });
  registerSeo({
    pageManagement,
    app,
    db,
    studio,
    commerce,
    dist: existsSync(dist) ? dist : null,
  });
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
      .status(
        error.code?.startsWith("LIMIT_")
          ? 400
          : error.status === 413
            ? 413
            : error.status === 400
              ? 400
              : 500,
      )
      .json({
        error:
          error.code === "LIMIT_FILE_SIZE"
            ? "Dosya 20 MB sınırını aşıyor."
            : error.code === "LIMIT_FILE_COUNT" ||
                error.code === "LIMIT_UNEXPECTED_FILE"
              ? "Tek yüklemede en fazla 20 dosya seç."
              : error.status === 413
                ? "Sayfa çok büyük."
                : "İşlem tamamlanamadı.",
      });
  });
  return { app, db, studio, growth };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const { app, studio, growth } = createApp();
  setInterval(() => {
    studio.runSchedules();
    void growth.runWebhookJobs();
  }, 15000).unref();
  app.listen(Number(process.env.PORT ?? 3001), "0.0.0.0", () =>
    console.log(
      "FukPages sunucusu hazır. Tema senkronizasyonu mağaza erişimiyle etkinleşir.",
    ),
  );
}
