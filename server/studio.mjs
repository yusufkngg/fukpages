import { freezeBrandDocument } from "./transfer-brand.mjs";
import { catalogDocumentUses } from "./catalog-media.mjs";
import { createAnalytics } from "./metrics.mjs";
import multer from "multer";
import sharp from "sharp";
import * as fontkit from "fontkit";
import wawoff2 from "wawoff2";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const defaultBrand = {
  spacing: { xxs: 2, xs: 4, sm: 8, md: 16, lg: 24, xl: 40 },
  colors: {
    primary: "#17241c",
    secondary: "#d8e8b7",
    accent: "#b0d976",
    text: "#17241c",
    background: "#ffffff",
    border: "#dce2d7",
  },
  fonts: {
    heading: "Arial, sans-serif",
    body: "Arial, sans-serif",
    button: "Arial, sans-serif",
    fallback: "Arial, sans-serif",
  },
  typography: {
    h1: 56,
    h2: 40,
    h3: 32,
    h4: 26,
    h5: 22,
    h6: 18,
    body: 16,
    small: 12,
    link: 16,
    mobileScale: 0.7,
    h1Weight: 800,
    h2Weight: 700,
    h3Weight: 700,
    h4Weight: 600,
    h5Weight: 600,
    h6Weight: 600,
    bodyWeight: 400,
    smallWeight: 400,
    linkWeight: 500,
    headingLineHeight: 1.15,
    bodyLineHeight: 1.6,
  },
  layout: {
    container: 1200,
    sectionSpace: 48,
    radius: 12,
    shadow: "0 4px 20px #00000014",
  },
};
const id = () => randomBytes(16).toString("hex");
const text = (v, n = 200) =>
  String(v ?? "")
    .trim()
    .slice(0, n);
export function cleanBrand(input) {
  const out = structuredClone(defaultBrand);
  for (const key of Object.keys(out.spacing))
    if (input.spacing?.[key] !== undefined) {
      const value = Number(input.spacing[key]);
      if (!Number.isFinite(value) || value < 0 || value > 400)
        throw new Error("Invalid spacing token.");
      out.spacing[key] = value;
    }
  for (const key of Object.keys(out.colors)) {
    const v = input.colors?.[key];
    if (v !== undefined) {
      if (!/^#[a-f\d]{6}([a-f\d]{2})?$/i.test(v))
        throw new Error("Geçersiz marka rengi.");
      out.colors[key] = v;
    }
  }
  for (const key of Object.keys(out.fonts))
    if (input.fonts?.[key] !== undefined) {
      const v = text(input.fonts[key]);
      if (!/^[\p{L}\p{N} ,.'_-]+$/u.test(v))
        throw new Error("Geçersiz font ailesi.");
      out.fonts[key] = v;
    }
  for (const key of Object.keys(out.typography))
    if (input.typography?.[key] !== undefined) {
      const v = Number(input.typography[key]);
      if (
        !Number.isFinite(v) ||
        v <= 0 ||
        v > (key.endsWith("Weight") ? 900 : 200)
      )
        throw new Error("Geçersiz tipografi.");
      out.typography[key] = v;
    }
  for (const key of ["container", "sectionSpace", "radius"])
    if (input.layout?.[key] !== undefined) {
      const v = Number(input.layout[key]);
      if (!Number.isFinite(v) || v < 0 || v > 3000)
        throw new Error("Geçersiz yerleşim.");
      out.layout[key] = v;
    }
  if (input.layout?.shadow !== undefined) {
    const v = text(input.layout.shadow);
    if (!/^[\da-f# px.,-]+$/i.test(v) && v !== "none")
      throw new Error("Geçersiz gölge.");
    out.layout.shadow = v;
  }
  return out;
}
export function documentUses(document, asset) {
  const value = JSON.stringify(document);
  return (
    value.includes(`/api/assets/${asset.id}/`) ||
    (asset.type === "font" && value.includes(asset.family))
  );
}
export async function safeRemoteImage(url) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    (parsed.port && parsed.port !== "443")
  )
    throw new Error("Yalnızca genel HTTPS görsel adresleri desteklenir.");
  const hosts = [
    "images.unsplash.com",
    "cdn.shopify.com",
    "images.pexels.com",
    "raw.githubusercontent.com",
    ...(process.env.MEDIA_IMPORT_HOSTS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ];
  if (!hosts.includes(parsed.hostname))
    throw new Error(
      "Bu görsel sunucusu izin verilen kaynaklarda değil. MEDIA_IMPORT_HOSTS ayarına tam hostname ekleyin.",
    );
  if (isIP(parsed.hostname.replace(/^\[|\]$/g, "")))
    throw new Error("IP adresinden görsel alınamaz.");
  const usesProxy =
    (process.execArgv.includes("--use-env-proxy") ||
      process.env.NODE_USE_ENV_PROXY === "1") &&
    !!(
      process.env.HTTPS_PROXY ||
      process.env.https_proxy ||
      process.env.HTTP_PROXY ||
      process.env.http_proxy
    );
  // The configured HTTPS proxy resolves the allowlisted hostname itself.
  const addresses = usesProxy
    ? []
    : await lookup(parsed.hostname, { all: true });
  const privateAddress = (ip) =>
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|198\.(18|19)\.|22[4-9]\.|23\d\.|24\d\.|25[0-5]\.)/.test(
      ip,
    ) ||
    (isIP(ip) === 6 && (/^(::|fc|fd|fe[89ab])/i.test(ip) || ip.includes(".")));
  if (
    (!usesProxy && !addresses.length) ||
    addresses.some((a) => privateAddress(a.address))
  )
    throw new Error("Özel ağ adresinden görsel alınamaz.");
  const response = await fetch(parsed, {
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Görsel indirilemedi.");
  if (Number(response.headers.get("content-length")) > 20 * 1024 * 1024)
    throw new Error("Görsel 20 MB sınırını aşıyor.");
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 20 * 1024 * 1024)
      throw new Error("Görsel 20 MB sınırını aşıyor.");
    chunks.push(chunk);
  }
  return {
    buffer: Buffer.concat(chunks),
    originalname: decodeURIComponent(
      parsed.pathname.split("/").pop() || "Görsel",
    ),
  };
}
export function registerStudio({
  app,
  db,
  auth,
  csrf,
  activeStore,
  dataDir,
  validateDocument,
  catalog = () => ({ products: [], collections: [], source: "local" }),
}) {
  const destination = () =>
    /^https:\/\//.test(process.env.FORM_WEBHOOK_URL || "")
      ? "Uygulama kayıtları + " +
        text(process.env.FORM_WEBHOOK_LABEL || "Yapılandırılmış webhook", 150)
      : "Webhook yapılandırılmadı";
  const assetRoot = resolve(dataDir, "assets");
  mkdirSync(assetRoot, { recursive: true, mode: 0o700 });
  db.exec(`CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY,store_id TEXT NOT NULL,type TEXT NOT NULL,data TEXT NOT NULL,deleted INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS brands (store_id TEXT PRIMARY KEY,data TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS revisions (id TEXT PRIMARY KEY,page_id TEXT NOT NULL,version INTEGER NOT NULL,document TEXT NOT NULL,reason TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS previews (token TEXT PRIMARY KEY,page_id TEXT NOT NULL,document TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS form_submissions (id TEXT PRIMARY KEY,store_id TEXT NOT NULL,page_id TEXT NOT NULL,form_id TEXT NOT NULL,data TEXT NOT NULL,created INTEGER NOT NULL, UNIQUE(page_id,form_id,id));
    CREATE TABLE IF NOT EXISTS publication_history (id TEXT PRIMARY KEY,page_id TEXT NOT NULL,document TEXT NOT NULL,published INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS schedules (page_id TEXT PRIMARY KEY,publish_at INTEGER,unpublish_at INTEGER,status TEXT NOT NULL DEFAULT 'pending');
    CREATE TABLE IF NOT EXISTS metrics (page_id TEXT NOT NULL,event TEXT NOT NULL,day TEXT NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(page_id,event,day));`);
  db.exec(
    "CREATE TABLE IF NOT EXISTS synced_sections(id TEXT PRIMARY KEY,store_id TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1);",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS upload_receipts(store_id TEXT NOT NULL,upload_id TEXT NOT NULL,asset_id TEXT NOT NULL,digest TEXT NOT NULL,PRIMARY KEY(store_id,upload_id));",
  );
  const pendingUploads = new Map();
  const analytics = createAnalytics(db);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024, files: 20 },
  });
  const storeExists = (store, res) => {
    if (!db.prepare("SELECT id FROM stores WHERE id=?").get(store)) {
      res.status(404).json({ error: "Mağaza bulunamadı." });
      return false;
    }
    return true;
  };
  const brand = (store) =>
    JSON.parse(
      db.prepare("SELECT data FROM brands WHERE store_id=?").get(store)?.data ||
        JSON.stringify(defaultBrand),
    );
  const assets = (store, archived = false) =>
    db
      .prepare(
        `SELECT data,deleted FROM assets WHERE store_id=? ${archived ? "" : "AND deleted=0"} ORDER BY created DESC`,
      )
      .all(store)
      .map((r) => ({ ...JSON.parse(r.data), archived: !!r.deleted }));
  const usage = (asset) => {
    const found = new Map();
    const fontInDocument = (document) => {
      if (asset.type !== "font") return false;
      const fonts = brand(asset.storeId).fonts;
      let matched = false;
      const walk = (nodes) =>
        nodes.forEach((n) => {
          const role =
            n.kind === "heading"
              ? "heading"
              : n.kind === "button"
                ? "button"
                : "body";
          const explicit = n.styles?.desktop?.fontFamily;
          if (
            !n.props.globalDetached &&
            (!explicit || String(explicit).includes("var(--font-")) &&
            String(fonts[role] || "").includes(asset.family)
          )
            matched = true;
          walk(n.children || []);
        });
      walk(document.nodes || []);
      return matched;
    };
    for (const r of db
      .prepare("SELECT id,document FROM pages WHERE store_id=?")
      .all(asset.storeId))
      if (
        documentUses(JSON.parse(r.document), asset) ||
        fontInDocument(JSON.parse(r.document))
      )
        found.set(r.id, {
          id: r.id,
          name: JSON.parse(r.document).name,
          scope: "taslak",
        });
    for (const r of db
      .prepare(
        "SELECT p.id,u.document FROM pages p JOIN publications u ON u.page_id=p.id WHERE p.store_id=? AND u.active=1",
      )
      .all(asset.storeId))
      if (
        documentUses(JSON.parse(r.document), asset) ||
        fontInDocument(JSON.parse(r.document))
      )
        found.set(r.id, {
          id: r.id,
          name: JSON.parse(r.document).name,
          scope: "yayın",
        });
    for (const r of db
      .prepare(
        "SELECT s.id,s.name,s.section FROM saved_sections s WHERE s.store_id=?",
      )
      .all(asset.storeId))
      if (documentUses(JSON.parse(r.section), asset))
        found.set("section:" + r.id, {
          id: r.id,
          name: r.name,
          scope: "kayıtlı bölüm",
        });
    if (
      asset.type === "font" &&
      JSON.stringify(brand(asset.storeId).fonts).includes(asset.family)
    )
      found.set("brand", { id: "brand", name: "Marka kiti", scope: "global" });
    return [...found.values()];
  };
  async function saveAsset(store, file, kind, options = {}) {
    if (!options.uploadId) return persistAsset(store, file, kind, options);
    if (!/^[\w-]{16,100}$/.test(options.uploadId))
      throw new Error("Geçersiz yükleme kimliği.");
    const digest = createHash("sha256")
      .update(file.buffer)
      .update(
        JSON.stringify([
          kind,
          file.originalname,
          options.family,
          options.weight,
          options.italic,
        ]),
      )
      .digest("hex");
    const receipt = db
      .prepare(
        "SELECT r.digest,a.data FROM upload_receipts r JOIN assets a ON a.id=r.asset_id WHERE r.store_id=? AND r.upload_id=?",
      )
      .get(store, options.uploadId);
    if (receipt) {
      if (receipt.digest !== digest)
        throw new Error("Yükleme kimliği farklı bir dosya için kullanılmış.");
      return JSON.parse(receipt.data);
    }
    const key = store + ":" + options.uploadId;
    const pending = pendingUploads.get(key);
    if (pending) {
      if (pending.digest !== digest)
        throw new Error("Yükleme kimliği farklı bir dosya için kullanılmış.");
      return pending.promise;
    }
    const promise = persistAsset(store, file, kind, { ...options, digest });
    pendingUploads.set(key, { digest, promise });
    try {
      return await promise;
    } finally {
      pendingUploads.delete(key);
    }
  }
  async function persistAsset(store, file, kind, options = {}) {
    const assetId = id(),
      dir = resolve(assetRoot, assetId);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const base = {
      id: assetId,
      storeId: store,
      type: kind,
      name: text(options.name || file.originalname, 150),
      folder: "",
      tags: [],
      favorite: false,
      created: Date.now(),
      bytes: file.buffer.length,
    };
    let result;
    if (kind === "image") {
      const content = file.buffer.toString("utf8");
      if (
        /<svg[\s>]/i.test(content) &&
        /<!DOCTYPE|<!ENTITY|<script|<foreignObject|\bon\w+\s*=|@import/i.test(
          content,
        )
      )
        throw new Error("SVG etkin içerik veya dış kaynak içeriyor.");
      if (/<svg[\s>]/i.test(content)) {
        for (const match of content.matchAll(/\bhref\s*=\s*["']([^"']*)["']/gi))
          if (!/^#[\w:-]+$/.test(match[1].trim()))
            throw new Error("SVG dış kaynağa başvuruyor.");
        for (const match of content.matchAll(/url\(\s*([^)]*)\)/gi))
          if (!/^["']?#[\w:-]+["']?$/.test(match[1].trim()))
            throw new Error("SVG dış kaynağa başvuruyor.");
      }
      const meta = await sharp(file.buffer, {
        limitInputPixels: 40_000_000,
      }).metadata();
      if (
        !["png", "jpeg", "webp", "avif", "heif", "gif", "svg"].includes(
          meta.format,
        )
      )
        throw new Error("Desteklenmeyen görsel biçimi.");
      const format = meta.format === "gif" ? "gif" : "webp";
      const normalized = await sharp(file.buffer, {
        animated: format === "gif",
        limitInputPixels: 40_000_000,
      })
        .rotate()
        .resize({
          width: 2400,
          height: 2400,
          fit: "inside",
          withoutEnlargement: true,
        })
        .toFormat(format, { quality: 82 })
        .toBuffer();
      writeFileSync(resolve(dir, "original." + format), normalized, {
        mode: 0o600,
      });
      const variants = [];
      for (const width of [320, 640, 1280, 1920]) {
        const data = await sharp(file.buffer, { limitInputPixels: 40_000_000 })
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();
        writeFileSync(resolve(dir, width + ".webp"), data, { mode: 0o600 });
        variants.push({
          width,
          url: `/api/assets/${assetId}/${width}.webp`,
          bytes: data.length,
        });
      }
      const normalizedMeta = await sharp(normalized).metadata();
      result = {
        ...base,
        format,
        width: normalizedMeta.width,
        height: normalizedMeta.height,
        bytes: normalized.length,
        originalBytes: file.buffer.length,
        url: `/api/assets/${assetId}/original.${format}`,
        variants,
      };
    } else {
      const magic = file.buffer.subarray(0, 4).toString("ascii");
      if (
        !["wOF2", "wOFF", "OTTO", "true"].includes(magic) &&
        !file.buffer.subarray(0, 4).equals(Buffer.from([0, 1, 0, 0]))
      )
        throw new Error("Geçersiz font dosyası.");
      const font = fontkit.create(file.buffer);
      if (!font.familyName || !font.numGlyphs)
        throw new Error("Font okunamadı.");
      let data = file.buffer,
        format = magic === "wOFF" ? "woff" : "woff2";
      if (!["wOF2", "wOFF"].includes(magic))
        data = Buffer.from(await wawoff2.compress(file.buffer));
      const family = text(options.family || font.familyName, 100).replace(
        /[^\p{L}\p{N} _-]/gu,
        "",
      );
      const weight = Math.min(
        900,
        Math.max(
          100,
          Number(options.weight || font["OS/2"]?.usWeightClass || 400),
        ),
      );
      const axes = font.variationAxes || {};
      writeFileSync(resolve(dir, "font." + format), data, { mode: 0o600 });
      result = {
        ...base,
        format,
        family,
        weight,
        italic: options.italic === "true" || !!font.italicAngle,
        axes,
        url: `/api/assets/${assetId}/font.${format}`,
        bytes: data.length,
        turkish: "İıŞşĞğÇçÖöÜü"
          .split("")
          .every((c) => font.hasGlyphForCodePoint(c.codePointAt(0))),
      };
    }
    if (
      db.prepare("SELECT status FROM stores WHERE id=?").get(store)?.status !==
      "active"
    )
      throw new Error("Mağaza devre dışı bırakıldı. Dosya kaydedilmedi.");
    db.exec("BEGIN");
    try {
      db.prepare(
        "INSERT INTO assets(id,store_id,type,data,created) VALUES(?,?,?,?,?)",
      ).run(assetId, store, kind, JSON.stringify(result), Date.now());
      if (options.uploadId)
        db.prepare("INSERT INTO upload_receipts VALUES(?,?,?,?)").run(
          store,
          options.uploadId,
          assetId,
          options.digest,
        );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return result;
  }
  app.get("/api/stores/:id/assets", auth, (req, res) => {
    if (storeExists(req.params.id, res))
      res.json(
        assets(req.params.id, true).map((a) => ({ ...a, usage: usage(a) })),
      );
  });
  app.post(
    "/api/stores/:id/assets",
    auth,
    csrf,
    (req, res, next) => {
      if (activeStore(req.params.id, res))
        upload.array("files", 20)(req, res, next);
    },
    async (req, res) => {
      const results = [];
      let uploadIds;
      try {
        uploadIds = req.body.uploadIds ? JSON.parse(req.body.uploadIds) : [];
      } catch {
        return res.status(400).json({ error: "Yükleme kimlikleri okunamadı." });
      }
      if (
        !Array.isArray(uploadIds) ||
        (uploadIds.length && uploadIds.length !== (req.files || []).length)
      )
        return res
          .status(400)
          .json({ error: "Dosyalar ve yükleme kimlikleri eşleşmiyor." });
      for (const [index, file] of (req.files || []).entries()) {
        try {
          results.push({
            ok: true,
            asset: await saveAsset(
              req.params.id,
              file,
              req.body.type === "font" ? "font" : "image",
              { ...req.body, uploadId: uploadIds[index] },
            ),
          });
        } catch (error) {
          results.push({
            ok: false,
            name: file.originalname,
            error: error.message,
          });
        }
      }
      res.status(results.some((r) => r.ok) ? 201 : 400).json({
        results,
        error: results.length ? "Dosyalar yüklenemedi." : "Dosya seçilmedi.",
      });
    },
  );
  app.post("/api/stores/:id/assets/import", auth, csrf, async (req, res) => {
    if (!activeStore(req.params.id, res)) return;
    try {
      res
        .status(201)
        .json(
          await saveAsset(
            req.params.id,
            await safeRemoteImage(req.body.url),
            "image",
          ),
        );
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.post(
    "/api/stores/:id/assets/:assetId/edit",
    auth,
    csrf,
    async (req, res) => {
      if (!activeStore(req.params.id, res)) return;
      const row = db
        .prepare("SELECT data FROM assets WHERE id=? AND store_id=?")
        .get(req.params.assetId, req.params.id);
      if (!row) return res.status(404).json({ error: "Görsel bulunamadı." });
      try {
        const a = JSON.parse(row.data);
        if (a.type !== "image") throw new Error("Bir görsel seç.");
        let image = sharp(
          readFileSync(resolve(assetRoot, a.id, a.url.split("/").pop())),
          { limitInputPixels: 40_000_000 },
        );
        const c = req.body.crop;
        if (c) {
          for (const k of ["x", "y", "width", "height"])
            if (!Number.isFinite(Number(c[k])))
              throw new Error("Geçersiz kırpma alanı.");
          const left = Math.round((Number(c.x) * a.width) / 100),
            top = Math.round((Number(c.y) * a.height) / 100),
            width = Math.round((Number(c.width) * a.width) / 100),
            height = Math.round((Number(c.height) * a.height) / 100);
          if (
            left < 0 ||
            top < 0 ||
            width < 1 ||
            height < 1 ||
            left + width > a.width ||
            top + height > a.height
          )
            throw new Error("Kırpma alanı görselin dışında.");
          image = image.extract({ left, top, width, height });
        }
        if (req.body.rotate) image = image.rotate(Number(req.body.rotate));
        if (req.body.flipX) image = image.flop();
        if (req.body.flipY) image = image.flip();
        const data = await image.webp({ quality: 85 }).toBuffer();
        res
          .status(201)
          .json(
            await saveAsset(
              req.params.id,
              { buffer: data, originalname: a.name + " · Düzenlendi" },
              "image",
            ),
          );
      } catch (e) {
        res.status(400).json({ error: e.message });
      }
    },
  );
  app.patch("/api/stores/:id/assets/:assetId", auth, csrf, (req, res) => {
    if (!activeStore(req.params.id, res)) return;
    const row = db
      .prepare("SELECT * FROM assets WHERE id=? AND store_id=? AND deleted=0")
      .get(req.params.assetId, req.params.id);
    if (!row) return res.status(404).json({ error: "Dosya bulunamadı." });
    const a = JSON.parse(row.data);
    a.name = text(req.body.name ?? a.name, 150);
    a.folder = text(req.body.folder ?? a.folder, 100);
    a.tags = Array.isArray(req.body.tags)
      ? req.body.tags.slice(0, 20).map((t) => text(t, 40))
      : a.tags;
    a.favorite = req.body.favorite ?? a.favorite;
    db.prepare("UPDATE assets SET data=? WHERE id=?").run(
      JSON.stringify(a),
      a.id,
    );
    res.json(a);
  });
  app.delete("/api/stores/:id/assets/:assetId", auth, csrf, (req, res) => {
    if (!activeStore(req.params.id, res)) return;
    const row = db
      .prepare(
        "SELECT data FROM assets WHERE id=? AND store_id=? AND deleted=0",
      )
      .get(req.params.assetId, req.params.id);
    if (!row) return res.status(404).json({ error: "Dosya bulunamadı." });
    const used = usage(JSON.parse(row.data));
    if (used.length && req.query.acknowledge !== "true")
      return res.status(409).json({
        error:
          "Dosya kullanımda. Kaldırmadan önce etkilenen sayfaları kontrol et.",
        usage: used,
      });
    db.prepare("UPDATE assets SET deleted=1 WHERE id=?").run(
      req.params.assetId,
    );
    res.json({ ok: true, retained: true, usage: used });
  });
  const activePublicDocuments = (store) =>
    db
      .prepare(
        "SELECT p.id,u.document FROM publications u JOIN pages p ON p.id=u.page_id JOIN stores s ON s.id=p.store_id WHERE s.id=? AND s.status='active' AND u.active=1",
      )
      .all(store)
      .map((r) => ({ ...JSON.parse(r.document), __pageId: r.id }));
  app.get("/api/assets/:assetId/:file", (req, res) => {
    const row = db
      .prepare("SELECT * FROM assets WHERE id=?")
      .get(req.params.assetId);
    if (!row) return res.status(404).end();
    const asset = JSON.parse(row.data);
    const preview =
      req.query.preview &&
      db
        .prepare(
          "SELECT p.id,v.document FROM previews v JOIN pages p ON p.id=v.page_id JOIN stores s ON s.id=p.store_id WHERE v.token=? AND v.expires>? AND p.store_id=? AND s.status='active'",
        )
        .get(req.query.preview, Date.now(), row.store_id);
    const docs = preview
      ? [{ ...JSON.parse(preview.document), __pageId: preview.id }]
      : activePublicDocuments(row.store_id);
    if (
      !req.ownerSession &&
      !docs.some(
        (d) =>
          documentUses(d, asset) ||
          catalogDocumentUses(
            d,
            asset,
            catalog(row.store_id),
            db
              .prepare("SELECT entity_id FROM page_assignments WHERE page_id=?")
              .all(d.__pageId)
              .map((r) => r.entity_id),
          ),
      ) &&
      !(
        asset.type === "font" &&
        docs.length &&
        JSON.stringify(brand(row.store_id).fonts).includes(asset.family)
      )
    )
      return res.status(404).end();
    const permitted = [
      asset.url,
      ...(asset.variants || []).map((v) => v.url),
    ].some((u) => u.split("/").pop() === req.params.file);
    if (!permitted) return res.status(404).end();
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.sendFile(resolve(assetRoot, asset.id, req.params.file));
  });
  app.get("/api/stores/:id/brand", auth, (req, res) => {
    if (storeExists(req.params.id, res))
      res.json({
        brand: brand(req.params.id),
        version:
          db
            .prepare("SELECT version FROM brands WHERE store_id=?")
            .get(req.params.id)?.version || 0,
      });
  });
  app.put("/api/stores/:id/brand", auth, csrf, (req, res) => {
    if (!activeStore(req.params.id, res)) return;
    try {
      const current =
        db
          .prepare("SELECT version FROM brands WHERE store_id=?")
          .get(req.params.id)?.version || 0;
      if (req.body.version !== current)
        return res
          .status(409)
          .json({ error: "Marka kiti başka sekmede değişti. Yeniden aç." });
      const data = cleanBrand(req.body.brand);
      db.prepare(
        "INSERT INTO brands VALUES(?,?,?) ON CONFLICT(store_id) DO UPDATE SET data=excluded.data,version=excluded.version",
      ).run(req.params.id, JSON.stringify(data), current + 1);
      res.json({ brand: data, version: current + 1 });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  app.get("/api/pages/:id/history", auth, (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT id,version,reason,created FROM revisions WHERE page_id=? ORDER BY created DESC,rowid DESC LIMIT 200",
        )
        .all(req.params.id),
    ),
  );
  app.post("/api/pages/:id/transfer", auth, csrf, async (req, res) => {
    const source = db
      .prepare("SELECT * FROM pages WHERE id=?")
      .get(req.params.id);
    if (!source)
      return res.status(404).json({ error: "Kaynak sayfa bulunamadı." });
    const target = activeStore(req.body.targetStoreId, res);
    if (!target) return;
    if (source.store_id === target.id)
      return res.status(400).json({ error: "Farklı bir hedef mağaza seç." });
    const document =
        req.body.preserveBrand === false
          ? JSON.parse(source.document)
          : freezeBrandDocument(
              JSON.parse(source.document),
              brand(source.store_id),
            ),
      products = catalog(target.id).products,
      collections = catalog(target.id).collections;
    const productMap = req.body.productMap || {},
      collectionMap = req.body.collectionMap || {};
    const missing = [];
    const inspect = (nodes) =>
      nodes.forEach((n) => {
        if (
          n.props.productId &&
          !products.some((p) => p.id === productMap[n.props.productId])
        )
          missing.push("Ürün " + n.props.productId);
        if (
          n.props.collectionId &&
          !collections.some((p) => p.id === collectionMap[n.props.collectionId])
        )
          missing.push("Koleksiyon " + n.props.collectionId);
        for (const productId of String(n.props.productIds || "")
          .split(",")
          .filter(Boolean))
          if (!products.some((p) => p.id === productMap[productId.trim()]))
            missing.push("Ürün " + productId.trim());
        inspect(n.children);
      });
    inspect(document.nodes);
    if (missing.length)
      return res.status(400).json({
        error: "Hedef katalogla eşleştirme gerekli.",
        missing: [...new Set(missing)],
      });
    try {
      const mediaMap = {},
        fontMap = {};
      for (const asset of assets(source.store_id, true).filter(
        (a) =>
          documentUses(document, a) ||
          (a.type === "font" && JSON.stringify(document).includes(a.family)),
      )) {
        const bytes = readFileSync(
          resolve(assetRoot, asset.id, asset.url.split("/").pop()),
        );
        const family =
          asset.type === "font"
            ? fontMap[asset.family] ||
              (assets(target.id, true).some((a) => a.family === asset.family)
                ? `${asset.family} Transfer ${id().slice(0, 8)}`
                : asset.family)
            : undefined;
        if (asset.type === "font") fontMap[asset.family] = family;
        const copy = await saveAsset(
          target.id,
          { buffer: bytes, originalname: asset.name },
          asset.type,
          {
            family,
            weight: asset.weight,
            italic: String(asset.italic),
          },
        );
        mediaMap[asset.id] = copy.id;
      }
      let serialized = JSON.stringify(document);
      for (const [from, to] of Object.entries(mediaMap))
        serialized = serialized.replaceAll(
          "/api/assets/" + from + "/",
          "/api/assets/" + to + "/",
        );
      const copied = JSON.parse(serialized);
      delete copied.themeLayout;
      const nodeIds = {};
      const collectIds = (nodes) =>
        nodes.forEach((n) => {
          nodeIds[n.id] = id();
          collectIds(n.children);
        });
      collectIds(copied.nodes);
      const transform = (nodes) =>
        nodes.forEach((n) => {
          n.id = nodeIds[n.id];
          const actionId = String(n.props.actionTarget || "").replace(/^#/, "");
          if (nodeIds[actionId])
            n.props.actionTarget =
              (String(n.props.actionTarget).startsWith("#") ? "#" : "") +
              nodeIds[actionId];
          const mapFont = (value) =>
            String(value)
              .split(",")
              .map(
                (name) =>
                  fontMap[name.trim().replace(/^["']|["']$/g, "")] ||
                  name.trim(),
              )
              .join(", ");
          for (const styles of Object.values(n.styles))
            if (typeof styles.fontFamily === "string")
              styles.fontFamily = mapFont(styles.fontFamily);
          for (const key of ["hoverStyles", "focusStyles"])
            if (n.props[key]) {
              const state = JSON.parse(n.props[key]);
              if (state.fontFamily)
                state.fontFamily = mapFont(state.fontFamily);
              n.props[key] = JSON.stringify(state);
            }
          delete n.props.linkedSectionId;
          delete n.props.linkedVersion;
          if (n.props.productId)
            n.props.productId = productMap[n.props.productId];
          if (n.props.collectionId)
            n.props.collectionId = collectionMap[n.props.collectionId];
          if (n.props.productIds)
            n.props.productIds = String(n.props.productIds)
              .split(",")
              .map((id) => productMap[id.trim()])
              .join(",");
          transform(n.children);
        });
      transform(copied.nodes);
      copied.name += " · Aktarılan kopya";
      const validated = validateDocument(copied);
      if (!activeStore(target.id, res)) return;
      const pageId = id();
      db.prepare(
        "INSERT INTO pages(id,store_id,document,updated) VALUES(?,?,?,?)",
      ).run(pageId, target.id, JSON.stringify(validated), Date.now());
      db.prepare("INSERT INTO revisions VALUES(?,?,?,?,?,?)").run(
        id(),
        pageId,
        1,
        JSON.stringify(validated),
        "Mağazalar arası aktarım",
        Date.now(),
      );
      res
        .status(201)
        .json({ id: pageId, document: validated, mediaMap, published: false });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.put(
    "/api/stores/:id/sections/:sectionId/sync",
    auth,
    csrf,
    (req, res) => {
      if (!activeStore(req.params.id, res)) return;
      const source = db
        .prepare(
          "SELECT s.*,l.version FROM saved_sections s JOIN synced_sections l ON l.id=s.id WHERE s.id=? AND s.store_id=?",
        )
        .get(req.params.sectionId, req.params.id);
      if (!source)
        return res.status(404).json({ error: "Senkron bölüm bulunamadı." });
      if (req.body.version !== source.version)
        return res
          .status(409)
          .json({ error: "Senkron bölüm değişti. Kütüphaneyi yeniden aç." });
      try {
        const section = validateDocument({
          schemaVersion: 1,
          type: "landing",
          name: source.name,
          nodes: [req.body.section],
        }).nodes[0];
        if (section.kind !== "section") throw new Error("Bir bölüm seç.");
        section.props.linkedSectionId = source.id;
        section.props.linkedVersion = String(source.version + 1);
        const fresh = (n, rootId) => ({
          ...n,
          id: rootId || id(),
          children: n.children.map((c) => fresh(c)),
        });
        const changes = [];
        for (const row of db
          .prepare("SELECT * FROM pages WHERE store_id=?")
          .all(req.params.id)) {
          let changed = false;
          const doc = JSON.parse(row.document);
          doc.nodes = doc.nodes.map((n) => {
            if (n.props.linkedSectionId !== source.id) return n;
            changed = true;
            return fresh(section, n.id);
          });
          if (changed) changes.push({ row, doc });
        }
        db.exec("BEGIN");
        try {
          db.prepare("UPDATE saved_sections SET section=? WHERE id=?").run(
            JSON.stringify(section),
            source.id,
          );
          db.prepare(
            "UPDATE synced_sections SET version=version+1 WHERE id=?",
          ).run(source.id);
          for (const { row, doc } of changes) {
            db.prepare("INSERT INTO revisions VALUES(?,?,?,?,?,?)").run(
              id(),
              row.id,
              row.version,
              row.document,
              "Senkron bölüm güncellendi",
              Date.now(),
            );
            db.prepare(
              "UPDATE pages SET document=?,version=version+1,updated=? WHERE id=?",
            ).run(JSON.stringify(doc), Date.now(), row.id);
          }
          db.exec("COMMIT");
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
        res.json({
          id: source.id,
          version: source.version + 1,
          affectedPages: changes.map((c) => c.row.id),
          section,
          publishedChanged: false,
        });
      } catch (e) {
        res.status(400).json({ error: e.message });
      }
    },
  );
  app.get("/api/pages/:id/history/:revisionId", auth, (req, res) => {
    const row = db
      .prepare("SELECT * FROM revisions WHERE page_id=? AND id=?")
      .get(req.params.id, req.params.revisionId);
    if (!row) return res.status(404).json({ error: "Sürüm bulunamadı." });
    res.json({ ...row, document: JSON.parse(row.document) });
  });
  app.post("/api/pages/:id/preview", auth, csrf, (req, res) => {
    const row = db.prepare("SELECT * FROM pages WHERE id=?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Sayfa bulunamadı." });
    if (!activeStore(row.store_id, res)) return;
    const token = id();
    db.prepare("INSERT INTO previews VALUES(?,?,?,?)").run(
      token,
      row.id,
      row.document,
      Date.now() + 7 * 86400000,
    );
    res.json({
      token,
      path: `/?preview=${token}`,
      expires: Date.now() + 7 * 86400000,
    });
  });
  app.get("/api/public/previews/:token", (req, res) => {
    const row = db
      .prepare(
        "SELECT v.document,p.store_id,v.page_id FROM previews v JOIN pages p ON p.id=v.page_id JOIN stores s ON s.id=p.store_id WHERE v.token=? AND v.expires>? AND s.status='active'",
      )
      .get(req.params.token, Date.now());
    if (!row)
      return res
        .status(404)
        .json({ error: "Önizleme bağlantısı geçersiz veya süresi dolmuş." });
    res.json({
      formDestination: destination(),
      catalog: catalog(row.store_id),
      document: JSON.parse(row.document),
      storeId: row.store_id,
      brand: brand(row.store_id),
      assets: assets(row.store_id, true).filter(
        (a) =>
          documentUses(JSON.parse(row.document), a) ||
          (a.type === "font" &&
            JSON.stringify(brand(row.store_id).fonts).includes(a.family)),
      ),
      pageId: row.page_id,
      previewToken: req.params.token,
    });
  });
  app.get("/api/pages/:id/publications", auth, (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT id,published FROM publication_history WHERE page_id=? ORDER BY published DESC",
        )
        .all(req.params.id),
    ),
  );
  app.post(
    "/api/pages/:id/publications/:publicationId/restore",
    auth,
    csrf,
    (req, res) => {
      const page = db
        .prepare("SELECT * FROM pages WHERE id=?")
        .get(req.params.id);
      const row = db
        .prepare("SELECT * FROM publication_history WHERE page_id=? AND id=?")
        .get(req.params.id, req.params.publicationId);
      if (!page || !row)
        return res.status(404).json({ error: "Yayın bulunamadı." });
      if (!activeStore(page.store_id, res)) return;
      db.prepare(
        "INSERT INTO publications VALUES(?,?,1,?) ON CONFLICT(page_id) DO UPDATE SET document=excluded.document,active=1,published=excluded.published",
      ).run(page.id, row.document, Date.now());
      res.json({ ok: true, mode: "local" });
    },
  );
  app.delete("/api/pages/:id/publish", auth, csrf, (req, res) => {
    const page = db
      .prepare("SELECT store_id FROM pages WHERE id=?")
      .get(req.params.id);
    if (!page) return res.status(404).json({ error: "Sayfa bulunamadı." });
    if (!activeStore(page.store_id, res)) return;
    db.prepare("UPDATE publications SET active=0 WHERE page_id=?").run(
      req.params.id,
    );
    res.json({ ok: true, mode: "local" });
  });
  app.get("/api/pages/:id/schedule", auth, (req, res) =>
    res.json(
      db
        .prepare("SELECT * FROM schedules WHERE page_id=?")
        .get(req.params.id) || {
        publish_at: null,
        unpublish_at: null,
        status: "none",
      },
    ),
  );
  app.put("/api/pages/:id/schedule", auth, csrf, (req, res) => {
    const page = db
      .prepare("SELECT store_id FROM pages WHERE id=?")
      .get(req.params.id);
    if (!page) return res.status(404).json({ error: "Sayfa bulunamadı." });
    if (!activeStore(page.store_id, res)) return;
    const a = req.body.publishAt ? Number(req.body.publishAt) : null,
      b = req.body.unpublishAt ? Number(req.body.unpublishAt) : null;
    if (
      (a && (!Number.isFinite(a) || a <= Date.now())) ||
      (b && (!Number.isFinite(b) || b <= Date.now())) ||
      (a && b && b <= a)
    )
      return res
        .status(400)
        .json({ error: "Geçerli gelecek yayın saatleri seç." });
    db.prepare(
      "INSERT INTO schedules VALUES(?,?,?,'pending') ON CONFLICT(page_id) DO UPDATE SET publish_at=excluded.publish_at,unpublish_at=excluded.unpublish_at,status='pending'",
    ).run(req.params.id, a, b);
    res.json({ ok: true, mode: "local" });
  });
  const submissionsLimit = new Map();
  app.post("/api/public/pages/:id/forms/:formId", async (req, res) => {
    const row = db
      .prepare(
        "SELECT u.document,p.store_id FROM publications u JOIN pages p ON p.id=u.page_id JOIN stores s ON s.id=p.store_id WHERE u.page_id=? AND u.active=1 AND s.status='active'",
      )
      .get(req.params.id);
    if (!row) return res.status(404).json({ error: "Form yayında değil." });
    let form;
    const fields = [];
    const walk = (nodes) =>
      nodes.forEach((n) => {
        if (n.id === req.params.formId && n.kind === "form") form = n;
        walk(n.children || []);
      });
    walk(JSON.parse(row.document).nodes);
    if (!form) return res.status(404).json({ error: "Form bulunamadı." });
    if (
      form.props.destination === "webhook" &&
      !/^https:\/\//.test(process.env.FORM_WEBHOOK_URL || "")
    )
      return res.status(503).json({
        error: "Form hedefi yapılandırılmadı. Ana yöneticiyle iletişime geç.",
      });
    if (req.body.companyWebsite)
      return res.status(400).json({ error: "Form gönderilemedi." });
    const key = req.ip + ":" + req.params.id;
    const attempts = submissionsLimit.get(key) || [];
    const recent = attempts.filter((t) => t > Date.now() - 60000);
    if (recent.length >= 5)
      return res
        .status(429)
        .json({ error: "Çok fazla gönderim. Bir dakika sonra tekrar dene." });
    recent.push(Date.now());
    submissionsLimit.set(key, recent);
    const collect = (nodes) =>
      nodes.forEach((n) => {
        if (
          ["input", "textarea", "select", "checkbox", "radio"].includes(n.kind)
        )
          fields.push(n);
        collect(n.children || []);
      });
    collect(form.children);
    const data = {};
    for (const field of fields) {
      const key = field.props.fieldName || field.id;
      const value = req.body.values?.[key];
      if (
        field.props.required &&
        (!value ||
          value === false ||
          (typeof value === "string" && !value.trim()) ||
          (field.kind === "checkbox" && ![true, "true", "on"].includes(value)))
      )
        return res
          .status(400)
          .json({ error: `${field.props.label || key} gerekli.` });
      if (
        field.props.inputType === "email" &&
        value &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      )
        return res.status(400).json({ error: "Geçerli e-posta gir." });
      if (
        field.props.inputType === "tel" &&
        value &&
        !/^[+\d\s()-]{6,25}$/.test(value)
      )
        return res.status(400).json({ error: "Geçerli telefon numarası gir." });
      if (
        field.kind === "radio" &&
        value &&
        !String(field.props.options || "")
          .split("\n")
          .includes(value)
      )
        return res.status(400).json({ error: "Geçersiz seçenek." });
      if (
        field.kind === "select" &&
        value &&
        !String(field.props.options || "")
          .split("\n")
          .includes(value)
      )
        return res.status(400).json({ error: "Geçersiz seçenek." });
      data[key] = typeof value === "boolean" ? value : text(value, 5000);
    }
    const requestId = text(req.body.requestId, 80);
    if (!/^[\w-]{16,80}$/.test(requestId))
      return res.status(400).json({ error: "Gönderim kimliği gerekli." });
    const prior = db
      .prepare(
        "SELECT id FROM form_submissions WHERE id=? AND page_id=? AND form_id=?",
      )
      .get(requestId, req.params.id, req.params.formId);
    if (prior) return res.json({ ok: true, duplicate: true });
    db.prepare("INSERT INTO form_submissions VALUES(?,?,?,?,?,?)").run(
      requestId,
      row.store_id,
      req.params.id,
      req.params.formId,
      JSON.stringify(data),
      Date.now(),
    );
    if (
      form.props.destination === "webhook" &&
      process.env.FORM_WEBHOOK_URL &&
      /^https:\/\//.test(process.env.FORM_WEBHOOK_URL)
    )
      db.prepare(
        "INSERT INTO webhook_jobs(id,submission_id,next_at) VALUES(?,?,?)",
      ).run(id(), requestId, Date.now());
    res.status(201).json({
      ok: true,
      destination:
        form.props.destination === "webhook"
          ? destination()
          : "Uygulama içi gönderim kayıtları",
    });
  });
  app.get("/api/stores/:id/submissions", auth, (req, res) => {
    if (storeExists(req.params.id, res))
      res.json(
        db
          .prepare(
            "SELECT * FROM form_submissions WHERE store_id=? ORDER BY created DESC LIMIT 500",
          )
          .all(req.params.id)
          .map((r) => ({ ...r, data: JSON.parse(r.data) })),
      );
  });
  app.post("/api/public/pages/:id/events", (req, res) => {
    if (!["click", "add_to_cart", "view"].includes(req.body.event))
      return res.status(400).end();
    const row = db
      .prepare(
        "SELECT u.page_id FROM publications u JOIN pages p ON p.id=u.page_id JOIN stores s ON s.id=p.store_id WHERE u.page_id=? AND u.active=1 AND s.status='active'",
      )
      .get(req.params.id);
    if (!row) return res.status(404).end();
    analytics.record(req, res, req.params.id);
  });
  app.get("/api/pages/:id/metrics", auth, (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT event,day,count FROM metrics WHERE page_id=? ORDER BY day DESC LIMIT 90",
        )
        .all(req.params.id),
    ),
  );
  return {
    analytics,
    brand,
    assets,
    destination,
    recordRevision(page, reason = "Kaydet") {
      db.prepare("INSERT INTO revisions VALUES(?,?,?,?,?,?)").run(
        id(),
        page.id,
        page.version,
        page.document,
        reason,
        Date.now(),
      );
    },
    recordPublication(page) {
      db.prepare("INSERT INTO publication_history VALUES(?,?,?,?)").run(
        id(),
        page.id,
        page.document,
        Date.now(),
      );
    },
    runSchedules(now = Date.now()) {
      for (const job of db
        .prepare(
          "SELECT j.*,p.document,p.store_id FROM schedules j JOIN pages p ON p.id=j.page_id JOIN stores s ON s.id=p.store_id WHERE j.status='pending' AND s.status='active'",
        )
        .all()) {
        if (job.publish_at && job.publish_at <= now) {
          db.prepare(
            "INSERT INTO publications VALUES(?,?,1,?) ON CONFLICT(page_id) DO UPDATE SET document=excluded.document,active=1,published=excluded.published",
          ).run(job.page_id, job.document, now);
          db.prepare("INSERT INTO publication_history VALUES(?,?,?,?)").run(
            id(),
            job.page_id,
            job.document,
            now,
          );
          db.prepare(
            "UPDATE schedules SET publish_at=NULL WHERE page_id=?",
          ).run(job.page_id);
        }
        if (job.unpublish_at && job.unpublish_at <= now) {
          db.prepare("UPDATE publications SET active=0 WHERE page_id=?").run(
            job.page_id,
          );
          db.prepare("UPDATE schedules SET status='done' WHERE page_id=?").run(
            job.page_id,
          );
        } else if (!job.unpublish_at && job.publish_at && job.publish_at <= now)
          db.prepare("UPDATE schedules SET status='done' WHERE page_id=?").run(
            job.page_id,
          );
      }
    },
  };
}
