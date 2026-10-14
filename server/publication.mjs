// One publication service for every path that makes a page visible to
// visitors: manual publish, restoring an earlier publication and scheduled
// publishing. Each runs in one transaction and goes through the same route
// rule, so a short address that another active publication of the store uses
// gives the same 409 answer on every path and nothing is written.
export const routeConflictMessage =
  "Bu kısa adres başka bir yayında kullanılıyor.";

export function createPublicationService({ db, id }) {
  const routeOwner = (storeId, pageId, slug) =>
    slug
      ? db
          .prepare(
            "SELECT p.id,p.document FROM publications u JOIN pages p ON p.id=u.page_id WHERE p.store_id=? AND p.id<>? AND u.active=1 AND json_extract(u.document,'$.seo.slug')=?",
          )
          .get(storeId, pageId, slug)
      : null;
  const conflictFor = (page, documentText) => {
    let slug;
    try {
      slug = JSON.parse(documentText).seo?.slug;
    } catch {
      slug = undefined;
    }
    const owner = routeOwner(page.store_id, page.id, slug);
    if (!owner) return null;
    let name = "";
    try {
      name = JSON.parse(owner.document).name || "";
    } catch {
      /* unreadable */
    }
    return {
      status: 409,
      error: routeConflictMessage,
      slug,
      pageId: owner.id,
      pageName: name,
    };
  };
  function publish(
    page,
    documentText,
    { at = Date.now(), history = true } = {},
  ) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const conflict = conflictFor(page, documentText);
      if (conflict) {
        db.exec("ROLLBACK");
        return { ok: false, ...conflict };
      }
      db.prepare(
        "INSERT INTO publications (page_id,document,active,published) VALUES (?,?,1,?) ON CONFLICT(page_id) DO UPDATE SET document=excluded.document, active=1, published=excluded.published",
      ).run(page.id, documentText, at);
      if (history)
        db.prepare(
          "INSERT INTO publication_history (id,page_id,document,published) VALUES (?,?,?,?)",
        ).run(id(), page.id, documentText, at);
      db.exec("COMMIT");
      const slug = JSON.parse(documentText).seo?.slug;
      return { ok: true, slug, published: at };
    } catch (error) {
      try {
        db.exec("ROLLBACK");
      } catch {
        /* already closed */
      }
      throw error;
    }
  }
  const unpublish = (pageId) =>
    db.prepare("UPDATE publications SET active=0 WHERE page_id=?").run(pageId);
  const reject = (res, result) =>
    res.status(result.status).json({
      error: result.error,
      code: "route-conflict",
      slug: result.slug,
      conflictPageId: result.pageId,
      conflictPageName: result.pageName,
    });
  return { publish, unpublish, conflictFor, reject };
}
