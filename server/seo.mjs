import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { documentUses } from "./studio.mjs";
export function registerSeo({ app, db, dist, studio, commerce }) {
  const published = (id) =>
    db
      .prepare(
        "SELECT u.document,p.store_id,p.id FROM publications u JOIN pages p ON p.id=u.page_id JOIN stores s ON s.id=p.store_id WHERE p.id=? AND u.active=1 AND s.status='active'",
      )
      .get(id);
  const bySlug = (store, slug) =>
    db
      .prepare(
        "SELECT u.document,p.store_id,p.id FROM publications u JOIN pages p ON p.id=u.page_id JOIN stores s ON s.id=p.store_id WHERE s.id=? AND json_extract(u.document,'$.seo.slug')=? AND u.active=1 AND s.status='active'",
      )
      .get(store, slug);
  app.get("/api/public/stores/:storeId/pages/:slug", (req, res) => {
    studio.runSchedules();
    const row = bySlug(req.params.storeId, req.params.slug);
    if (!row) return res.status(404).json({ error: "Bu adres yayında değil." });
    const document = JSON.parse(row.document),
      brand = studio.brand(row.store_id);
    res.json({
      document,
      formDestination: studio.destination(),
      brand,
      pageId: row.id,
      storeId: row.store_id,
      catalog: commerce.catalog(row.store_id),
      assets: studio
        .assets(row.store_id, true)
        .filter(
          (a) =>
            documentUses(document, a) ||
            (a.type === "font" &&
              JSON.stringify(brand.fonts).includes(a.family)),
        ),
    });
  });
  if (!dist) return;
  const escape = (v) =>
    String(v || "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  app.get(["/", "/p/:storeId/:slug"], (req, res, next) => {
    const preview =
      typeof req.query.preview === "string"
        ? db
            .prepare(
              "SELECT v.document,p.store_id,p.id FROM previews v JOIN pages p ON p.id=v.page_id JOIN stores s ON s.id=p.store_id WHERE v.token=? AND v.expires>? AND s.status='active'",
            )
            .get(req.query.preview, Date.now())
        : null;
    const row = req.params.slug
      ? bySlug(req.params.storeId, req.params.slug)
      : typeof req.query.published === "string"
        ? published(req.query.published)
        : preview;
    if (!row) return next();
    const document = JSON.parse(row.document),
      seo = document.seo || {},
      title = seo.title || document.name;
    let html = readFileSync(resolve(dist, "index.html"), "utf8");
    html = html.replace(
      /<title>[^<]*<\/title>/,
      `<title>${escape(title)}</title>`,
    );
    const tags = `<meta name="description" content="${escape(seo.description)}"><meta name="robots" content="${preview || seo.noindex ? "noindex,nofollow" : "index,follow"}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(seo.description)}"><meta property="og:type" content="website">${seo.image ? `<meta property="og:image" content="${escape(seo.image)}">` : ""}`;
    res
      .type("html")
      .set("Cache-Control", "no-store")
      .send(html.replace("</head>", tags + "</head>"));
  });
}
