import { randomBytes } from "node:crypto";
import { duplicateDocument } from "../src/pageTemplates.ts";
import { documentUses } from "./studio.mjs";
import { catalogDocumentUses } from "./catalog-media.mjs";
export function registerPageManagement({
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
}) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS page_assignments(store_id TEXT NOT NULL,kind TEXT NOT NULL,entity_id TEXT NOT NULL,page_id TEXT NOT NULL,PRIMARY KEY(store_id,kind,entity_id))",
  );
  const assignments = (id) =>
    db
      .prepare(
        "SELECT entity_id FROM page_assignments WHERE page_id=? ORDER BY entity_id",
      )
      .all(id)
      .map((r) => r.entity_id);
  const overview = (storeId) =>
    db
      .prepare(
        "SELECT p.id,p.document,p.version,p.updated,coalesce(u.active,0) published FROM pages p LEFT JOIN publications u ON u.page_id=p.id WHERE p.store_id=? ORDER BY p.updated DESC",
      )
      .all(storeId)
      .map((row) => {
        const doc = JSON.parse(row.document);
        return {
          id: row.id,
          name: doc.name,
          type: doc.type,
          version: row.version,
          updated: row.updated,
          published: !!row.published,
          assignments: assignments(row.id),
          slug: doc.seo?.slug || "",
        };
      });
  app.get("/api/stores/:id/page-overview", auth, (req, res) =>
    res.json(overview(req.params.id)),
  );
  app.get("/api/pages/:id/assignments", auth, (req, res) => {
    const row = db
      .prepare("SELECT document,version FROM pages WHERE id=?")
      .get(req.params.id);
    if (!row) return res.status(404).json({ error: "Sayfa bulunamadı." });
    res.json({
      ids: assignments(req.params.id),
      type: JSON.parse(row.document).type,
      version: row.version,
    });
  });
  app.put("/api/pages/:id/assignments", auth, csrf, (req, res) => {
    const row = db.prepare("SELECT * FROM pages WHERE id=?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Sayfa bulunamadı." });
    if (!activeStore(row.store_id, res)) return;
    if (req.body.version !== row.version)
      return res
        .status(409)
        .json({ error: "Sayfa değişti. Atama penceresini yeniden aç." });
    const type = JSON.parse(row.document).type,
      ids = req.body.ids;
    if (
      !["home", "product", "collection"].includes(type) ||
      !Array.isArray(ids) ||
      ids.length > 200 ||
      ids.some((id) => typeof id !== "string" || id.length > 100)
    )
      return res.status(400).json({ error: "Geçersiz sayfa ataması." });
    const unique = [...new Set(ids)],
      catalog = commerce.catalog(row.store_id);
    // "*" makes the page the default for every product/collection that has
    // no page of its own.
    const valid =
      type === "home"
        ? ["home"]
        : [
            "*",
            ...(type === "product"
              ? catalog.products
              : catalog.collections
            ).map((v) => v.id),
          ];
    if (unique.some((id) => !valid.includes(id)))
      return res.status(400).json({
        error: "Atanacak ürün/koleksiyon bu mağazanın kataloğunda bulunamadı.",
      });
    const takeDefault = req.body.takeDefault === true && unique.includes("*");
    const collision = unique
      .filter((id) => !(takeDefault && id === "*"))
      .map((id) =>
        db
          .prepare(
            "SELECT p.id,p.document FROM page_assignments a JOIN pages p ON p.id=a.page_id WHERE a.store_id=? AND a.kind=? AND a.entity_id=? AND a.page_id<>?",
          )
          .get(row.store_id, type, id, row.id),
      )
      .find(Boolean);
    if (collision)
      return res.status(409).json({
        error: `Bu atama “${JSON.parse(collision.document).name}” sayfasında kullanılıyor. Önce o sayfadan kaldır.`,
        pageId: collision.id,
      });
    db.exec("BEGIN");
    try {
      db.prepare("DELETE FROM page_assignments WHERE page_id=?").run(row.id);
      if (takeDefault)
        db.prepare(
          "DELETE FROM page_assignments WHERE store_id=? AND kind=? AND entity_id='*'",
        ).run(row.store_id, type);
      for (const id of unique)
        db.prepare("INSERT INTO page_assignments VALUES(?,?,?,?)").run(
          row.store_id,
          type,
          id,
          row.id,
        );
      db.prepare("UPDATE pages SET version=version+1,updated=? WHERE id=?").run(
        Date.now(),
        row.id,
      );
      audit(
        row.store_id,
        "Sayfa atamaları güncellendi: " + JSON.parse(row.document).name,
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      return res.status(400).json({ error: "Atamalar kaydedilemedi." });
    }
    res.json({ ids: unique, version: row.version + 1 });
  });
  app.post("/api/pages/:id/duplicate", auth, csrf, (req, res) => {
    const row = db.prepare("SELECT * FROM pages WHERE id=?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Sayfa bulunamadı." });
    if (!activeStore(row.store_id, res)) return;
    const original = JSON.parse(row.document);
    // A store has one homepage; product, collection and other pages can be
    // copied and assigned to different products/collections.
    const conflict = pageRules?.singletonConflict(row.store_id, original.type);
    if (conflict) return pageRules.rejectSingleton(res, conflict);
    const id = randomBytes(12).toString("hex"),
      copied = duplicateDocument(original);
    // The editor names copies in the owner's interface language.
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (name && name.length <= 160) copied.name = name;
    if (copied.seo)
      copied.seo.slug =
        (copied.seo.slug || "page").slice(0, 70) + "-copy-" + id.slice(0, 6);
    const document = validateDocument(copied);
    db.prepare("INSERT INTO pages VALUES(?,?,?,1,?)").run(
      id,
      row.store_id,
      JSON.stringify(document),
      Date.now(),
    );
    studio.recordRevision(
      { id, version: 1, document: JSON.stringify(document) },
      "Çoğaltıldı",
    );
    audit(row.store_id, "Sayfa çoğaltıldı: " + document.name);
    res.status(201).json({ id, document, version: 1 });
  });
  const assignedTo = (storeId, kind, id) =>
    db
      .prepare(
        "SELECT p.id,p.store_id,u.document FROM page_assignments a JOIN pages p ON p.id=a.page_id JOIN publications u ON u.page_id=p.id JOIN stores s ON s.id=p.store_id WHERE a.store_id=? AND a.kind=? AND a.entity_id=? AND u.active=1 AND s.status='active'",
      )
      .get(storeId, kind, id);
  /** A product's own page, else the store's default product page. */
  const assigned = (storeId, kind, id) =>
    (id !== "*" && assignedTo(storeId, kind, id)) ||
    (kind !== "home" && id !== "*" ? assignedTo(storeId, kind, "*") : null);
  const payload = (row, kind, id) => {
    const document = JSON.parse(row.document),
      brand = studio.brand(row.store_id),
      catalog = commerce.catalog(row.store_id);
    if (kind === "product" && !catalog.products.some((p) => p.id === id))
      return null;
    if (kind === "collection" && !catalog.collections.some((c) => c.id === id))
      return null;
    return {
      document,
      brand,
      catalog,
      storeId: row.store_id,
      pageId: row.id,
      activeProductId: kind === "product" ? id : "",
      activeCollectionId: kind === "collection" ? id : "",
      formDestination: studio.destination(),
      assets: studio
        .assets(row.store_id, true)
        .filter(
          (a) =>
            documentUses(document, a) ||
            catalogDocumentUses(document, a, catalog, [id]) ||
            (a.type === "font" &&
              JSON.stringify(brand.fonts).includes(a.family)),
        ),
    };
  };
  for (const [suffix, kind] of [
    ["home", "home"],
    ["products/:entityId", "product"],
    ["collections/:entityId", "collection"],
  ])
    app.get(`/api/public/stores/:storeId/${suffix}`, (req, res) => {
      studio.runSchedules();
      const id = req.params.entityId || "home",
        row = assigned(req.params.storeId, kind, id),
        result = row && payload(row, kind, id);
      if (!result)
        return res
          .status(404)
          .json({ error: "Bu hedefe atanmış yayında bir sayfa bulunamadı." });
      res.json(result);
    });
  const contextFor = (pageId, document, storeId) => {
    const ids = assignments(pageId).filter((id) => id !== "*"),
      catalog = commerce.catalog(storeId);
    return {
      activeProductId:
        document.type === "product"
          ? ids[0] || catalog.products[0]?.id || ""
          : "",
      activeCollectionId:
        document.type === "collection"
          ? ids[0] || catalog.collections[0]?.id || ""
          : "",
    };
  };
  return { overview, assignments, assigned, contextFor };
}
