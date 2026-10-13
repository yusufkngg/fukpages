export function cleanCatalog(input) {
  if (
    !input ||
    !Array.isArray(input.products) ||
    !Array.isArray(input.collections) ||
    input.products.length > 500 ||
    input.collections.length > 100
  )
    throw new Error("Katalog: products ve collections dizileri gerekli.");
  const seen = new Set(),
    validId = (v) => typeof v === "string" && /^[\w-]{1,100}$/.test(v),
    str = (v, n = 5000) => String(v || "").slice(0, n),
    url = (v) =>
      /^(https?:\/\/|\/(?!\/))/.test(String(v || "")) ? str(v) : "";
  const products = input.products.map((p) => {
    if (!validId(p.id) || seen.has(p.id))
      throw new Error("Ürün kimlikleri benzersiz olmalı.");
    seen.add(p.id);
    if (
      !Array.isArray(p.variants) ||
      p.variants.length < 1 ||
      p.variants.length > 100
    )
      throw new Error("Her ürün en az bir varyant içermeli.");
    const variantIds = new Set();
    return {
      id: p.id,
      title: str(p.title, 200),
      description: str(p.description),
      currency: /^[A-Z]{3}$/.test(p.currency || "") ? p.currency : "TRY",
      images: (p.images || []).slice(0, 30).map(url).filter(Boolean),
      metafields: Object.fromEntries(
        Object.entries(p.metafields || {})
          .slice(0, 40)
          .map(([k, v]) => [str(k, 100), str(v)]),
      ),
      variants: p.variants.map((v) => {
        if (
          !validId(v.id) ||
          variantIds.has(v.id) ||
          !Number.isSafeInteger(v.price) ||
          v.price < 0 ||
          !Number.isSafeInteger(v.stock) ||
          v.stock < 0
        )
          throw new Error(
            "Varyant ID, kuruş cinsinden fiyat ve stok geçerli olmalı.",
          );
        variantIds.add(v.id);
        return {
          id: v.id,
          title: str(v.title, 100),
          price: v.price,
          comparePrice:
            Number.isSafeInteger(v.comparePrice) && v.comparePrice >= 0
              ? v.comparePrice
              : 0,
          stock: v.stock,
          image: url(v.image),
          options: Object.fromEntries(
            Object.entries(v.options || {})
              .slice(0, 10)
              .map(([k, val]) => [str(k, 50), str(val, 80)]),
          ),
        };
      }),
    };
  });
  const collectionIds = new Set();
  const collections = input.collections.map((c) => {
    if (
      !validId(c.id) ||
      collectionIds.has(c.id) ||
      !Array.isArray(c.productIds) ||
      c.productIds.some((id) => !seen.has(id))
    )
      throw new Error("Koleksiyon ürün eşleştirmesi geçersiz.");
    collectionIds.add(c.id);
    return {
      id: c.id,
      title: str(c.title, 200),
      description: str(c.description),
      image: url(c.image),
      productIds: [...new Set(c.productIds)],
    };
  });
  return { products, collections, source: "local" };
}
export function registerCatalog({ app, db, auth, csrf, activeStore }) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS catalogs(store_id TEXT PRIMARY KEY,data TEXT NOT NULL,version INTEGER NOT NULL);",
  );
  const catalog = (storeId) =>
    JSON.parse(
      db.prepare("SELECT data FROM catalogs WHERE store_id=?").get(storeId)
        ?.data || '{"products":[],"collections":[],"source":"local"}',
    );
  app.get("/api/stores/:id/catalog", auth, (req, res) => {
    if (!db.prepare("SELECT id FROM stores WHERE id=?").get(req.params.id))
      return res.status(404).json({ error: "Mağaza bulunamadı." });
    res.json({
      ...catalog(req.params.id),
      version:
        db
          .prepare("SELECT version FROM catalogs WHERE store_id=?")
          .get(req.params.id)?.version || 0,
    });
  });
  app.put("/api/stores/:id/catalog", auth, csrf, (req, res) => {
    if (!activeStore(req.params.id, res)) return;
    try {
      const version =
        db
          .prepare("SELECT version FROM catalogs WHERE store_id=?")
          .get(req.params.id)?.version || 0;
      if (version !== req.body.version)
        return res
          .status(409)
          .json({ error: "Katalog değişti. Yeniden yükle." });
      const data = cleanCatalog(req.body);
      db.prepare(
        "INSERT INTO catalogs VALUES(?,?,?) ON CONFLICT(store_id) DO UPDATE SET data=excluded.data,version=excluded.version",
      ).run(req.params.id, JSON.stringify(data), version + 1);
      res.json({ ...data, version: version + 1 });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  return { catalog };
}
