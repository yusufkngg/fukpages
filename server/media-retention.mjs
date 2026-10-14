// Media retention (B5). Removing a file only archives it, because drafts,
// saved versions, publications and preview links may still show it. This
// module reports how many bytes are used, archived-but-still-referenced and
// archived-and-unreferenced, and permanently frees only the last group: a file
// is deleted only when no draft, trash entry, version, publication, earlier
// publication, open preview, saved section, brand kit or catalogue refers to it.
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";

const dirBytes = (dir) => {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const name of readdirSync(dir)) {
    const path = resolve(dir, name);
    const info = statSync(path);
    total += info.isDirectory() ? dirBytes(path) : info.size;
  }
  return total;
};

export function registerMediaRetention({
  app,
  db,
  auth,
  csrf,
  activeStore,
  assetRoot,
  catalog,
}) {
  const texts = (store) => {
    const all = (sql, ...args) =>
      db
        .prepare(sql)
        .all(...args)
        .map((row) => Object.values(row)[0]);
    const now = Date.now();
    return [
      ...all("SELECT document FROM pages WHERE store_id=?", store),
      ...all("SELECT document FROM trashed_pages WHERE store_id=?", store),
      ...all(
        "SELECT r.document FROM revisions r JOIN pages p ON p.id=r.page_id WHERE p.store_id=?",
        store,
      ),
      ...all(
        "SELECT r.document FROM revisions r JOIN trashed_pages p ON p.id=r.page_id WHERE p.store_id=?",
        store,
      ),
      ...all(
        "SELECT u.document FROM publications u JOIN pages p ON p.id=u.page_id WHERE p.store_id=?",
        store,
      ),
      ...all(
        "SELECT h.document FROM publication_history h JOIN pages p ON p.id=h.page_id WHERE p.store_id=?",
        store,
      ),
      ...all(
        "SELECT v.document FROM previews v JOIN pages p ON p.id=v.page_id WHERE p.store_id=? AND v.expires>?",
        store,
        now,
      ),
      ...all("SELECT section FROM saved_sections WHERE store_id=?", store),
      ...all("SELECT data FROM brands WHERE store_id=?", store),
      JSON.stringify(catalog(store)),
    ].join("\n");
  };
  const referenced = (haystack, asset) =>
    haystack.includes(`/api/assets/${asset.id}/`) ||
    (asset.type === "font" &&
      !!asset.family &&
      haystack.includes(asset.family));
  const report = (store) => {
    const haystack = texts(store);
    const groups = {
      active: { count: 0, bytes: 0 },
      archivedInUse: { count: 0, bytes: 0 },
      archivedUnused: { count: 0, bytes: 0 },
    };
    const unused = [];
    for (const row of db
      .prepare("SELECT id,data,deleted FROM assets WHERE store_id=?")
      .all(store)) {
      const asset = JSON.parse(row.data);
      const bytes = dirBytes(resolve(assetRoot, row.id));
      const group = !row.deleted
        ? groups.active
        : referenced(haystack, asset)
          ? groups.archivedInUse
          : groups.archivedUnused;
      group.count++;
      group.bytes += bytes;
      if (group === groups.archivedUnused)
        unused.push({ id: row.id, name: asset.name, type: asset.type, bytes });
    }
    return { ...groups, unused };
  };
  app.get("/api/stores/:id/media/storage", auth, (req, res) => {
    if (!db.prepare("SELECT id FROM stores WHERE id=?").get(req.params.id))
      return res.status(404).json({ error: "Mağaza bulunamadı." });
    res.json(report(req.params.id));
  });
  app.post("/api/stores/:id/media/cleanup", auth, csrf, (req, res) => {
    if (!activeStore(req.params.id, res)) return;
    // Recomputed at the moment of deletion, never trusted from the client.
    const { unused } = report(req.params.id);
    let freed = 0;
    for (const file of unused) {
      db.prepare("DELETE FROM upload_receipts WHERE asset_id=?").run(file.id);
      db.prepare("DELETE FROM assets WHERE id=? AND deleted=1").run(file.id);
      rmSync(resolve(assetRoot, file.id), { recursive: true, force: true });
      freed += file.bytes;
    }
    res.json({ removed: unused.length, freed, storage: report(req.params.id) });
  });
  return { report };
}
