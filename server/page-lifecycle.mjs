import { assignmentKind, isSingletonType } from "../src/pageRules.ts";

/**
 * Store-level page rules on the server: a single homepage per store, the
 * homepage is always routed as the store's home, and assignments follow the
 * page type when it changes.
 */
export function createPageRules(db) {
  const pagesOfType = (storeId, type, exceptId = "") =>
    db
      .prepare(
        "SELECT id,document FROM pages WHERE store_id=? AND id<>? AND json_extract(document,'$.type')=? ORDER BY updated DESC",
      )
      .all(storeId, exceptId, type);
  /** Another page already holds this one-per-store type. */
  const singletonConflict = (storeId, type, exceptId = "") => {
    if (!isSingletonType(type)) return null;
    const row = pagesOfType(storeId, type, exceptId)[0];
    return row ? { id: row.id, name: JSON.parse(row.document).name } : null;
  };
  const rejectSingleton = (res, conflict) =>
    res.status(409).json({
      error: `Bu mağazanın zaten bir ana sayfası var: “${conflict.name}”. Bir mağazada tek ana sayfa olur; onu düzenle ya da yeni sayfayı açılış sayfası olarak oluştur.`,
      code: "single-home",
      pageId: conflict.id,
    });
  /** Drop assignments that no longer match the page's type. */
  const releaseMismatchedAssignments = (pageId, type) =>
    db
      .prepare("DELETE FROM page_assignments WHERE page_id=? AND kind<>?")
      .run(pageId, assignmentKind(type) ?? "");
  /** The only homepage of a store is always routed as its home. */
  const syncHomeAssignment = (storeId) => {
    const homes = pagesOfType(storeId, "home");
    if (homes.length !== 1) return;
    const taken = db
      .prepare(
        "SELECT page_id FROM page_assignments WHERE store_id=? AND kind='home' AND entity_id='home'",
      )
      .get(storeId);
    if (!taken)
      db.prepare(
        "INSERT INTO page_assignments VALUES(?, 'home', 'home', ?)",
      ).run(storeId, homes[0].id);
  };
  return {
    singletonConflict,
    rejectSingleton,
    releaseMismatchedAssignments,
    syncHomeAssignment,
  };
}

/**
 * Trash for pages. Moving a page to the trash takes it out of every list and
 * route, ends its local publication, frees its product/collection
 * assignments and cancels schedules; its history and form submissions stay.
 * Restoring brings the draft back unpublished and unassigned.
 */
export function registerPageTrash({
  app,
  db,
  auth,
  csrf,
  activeStore,
  audit,
  rules,
}) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS trashed_pages(id TEXT PRIMARY KEY,store_id TEXT NOT NULL,document TEXT NOT NULL,version INTEGER NOT NULL,updated INTEGER NOT NULL,trashed INTEGER NOT NULL,was_published INTEGER NOT NULL DEFAULT 0)",
  );
  const summary = (row) => {
    const document = JSON.parse(row.document);
    return {
      id: row.id,
      name: document.name,
      type: document.type,
      updated: row.updated,
      trashed: row.trashed,
      wasPublished: !!row.was_published,
    };
  };
  app.post("/api/pages/:id/trash", auth, csrf, (req, res) => {
    const page = db
      .prepare("SELECT * FROM pages WHERE id=?")
      .get(req.params.id);
    if (!page) return res.status(404).json({ error: "Sayfa bulunamadı." });
    if (!activeStore(page.store_id, res)) return;
    const published = db
      .prepare("SELECT active FROM publications WHERE page_id=?")
      .get(page.id);
    db.exec("BEGIN");
    try {
      db.prepare(
        "INSERT INTO trashed_pages VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document,version=excluded.version,updated=excluded.updated,trashed=excluded.trashed,was_published=excluded.was_published",
      ).run(
        page.id,
        page.store_id,
        page.document,
        page.version,
        page.updated,
        Date.now(),
        published?.active ? 1 : 0,
      );
      db.prepare("UPDATE publications SET active=0 WHERE page_id=?").run(
        page.id,
      );
      db.prepare("DELETE FROM page_assignments WHERE page_id=?").run(page.id);
      db.prepare("DELETE FROM schedules WHERE page_id=?").run(page.id);
      db.prepare("DELETE FROM previews WHERE page_id=?").run(page.id);
      db.prepare("DELETE FROM pages WHERE id=?").run(page.id);
      rules.syncHomeAssignment(page.store_id);
      audit(
        page.store_id,
        `Sayfa çöp kutusuna taşındı: ${JSON.parse(page.document).name}`,
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      return res.status(500).json({ error: "Sayfa taşınamadı." });
    }
    res.json({ ok: true });
  });
  app.get("/api/stores/:id/trash", auth, (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT * FROM trashed_pages WHERE store_id=? ORDER BY trashed DESC",
        )
        .all(req.params.id)
        .map(summary),
    ),
  );
  const trashed = (req, res) => {
    const row = db
      .prepare("SELECT * FROM trashed_pages WHERE id=? AND store_id=?")
      .get(req.params.pageId, req.params.id);
    if (!row) res.status(404).json({ error: "Sayfa çöp kutusunda yok." });
    return row;
  };
  app.post("/api/stores/:id/trash/:pageId/restore", auth, csrf, (req, res) => {
    if (!activeStore(req.params.id, res)) return;
    const row = trashed(req, res);
    if (!row) return;
    const type = JSON.parse(row.document).type;
    const conflict = rules.singletonConflict(row.store_id, type);
    if (conflict) return rules.rejectSingleton(res, conflict);
    db.exec("BEGIN");
    try {
      db.prepare("INSERT INTO pages VALUES(?,?,?,?,?)").run(
        row.id,
        row.store_id,
        row.document,
        row.version + 1,
        Date.now(),
      );
      db.prepare("DELETE FROM trashed_pages WHERE id=?").run(row.id);
      rules.syncHomeAssignment(row.store_id);
      audit(
        row.store_id,
        `Sayfa geri yüklendi: ${JSON.parse(row.document).name}`,
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      return res.status(500).json({ error: "Sayfa geri yüklenemedi." });
    }
    res.json({ id: row.id });
  });
  app.delete("/api/stores/:id/trash/:pageId", auth, csrf, (req, res) => {
    if (!activeStore(req.params.id, res)) return;
    const row = trashed(req, res);
    if (!row) return;
    db.exec("BEGIN");
    try {
      // Form submissions are customer records and stay available.
      for (const table of [
        "trashed_pages WHERE id=?",
        "publications WHERE page_id=?",
        "publication_history WHERE page_id=?",
        "revisions WHERE page_id=?",
        "metrics WHERE page_id=?",
      ])
        db.prepare("DELETE FROM " + table).run(row.id);
      audit(
        row.store_id,
        `Sayfa kalıcı olarak silindi: ${JSON.parse(row.document).name}`,
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      return res.status(500).json({ error: "Sayfa silinemedi." });
    }
    res.json({ ok: true });
  });
}
