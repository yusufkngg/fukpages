import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { documentUses } from "./studio.mjs";
import { createDesignService } from "./design-service.mjs";
export function registerGrowth({
  app,
  db,
  auth,
  csrf,
  activeStore,
  validateDocument,
  studio,
  commerce,
  dataDir,
  ai = createDesignService(),
  webhookFetch = fetch,
}) {
  const id = () => randomBytes(16).toString("hex");
  db.exec(`CREATE TABLE IF NOT EXISTS experiments(id TEXT PRIMARY KEY,store_id TEXT NOT NULL,name TEXT NOT NULL,a TEXT NOT NULL,b TEXT NOT NULL,split INTEGER NOT NULL,active INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY,token TEXT NOT NULL,page_id TEXT NOT NULL,reviewer TEXT NOT NULL,decision TEXT NOT NULL,note TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS funnels(id TEXT PRIMARY KEY,store_id TEXT NOT NULL,name TEXT NOT NULL,pages TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS webhook_jobs(id TEXT PRIMARY KEY,submission_id TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,next_at INTEGER NOT NULL,state TEXT NOT NULL DEFAULT 'pending');`);
  const publicPage = (pageId) =>
    db
      .prepare(
        "SELECT p.id,p.store_id,u.document FROM publications u JOIN pages p ON p.id=u.page_id JOIN stores s ON s.id=p.store_id WHERE p.id=? AND u.active=1 AND s.status='active'",
      )
      .get(pageId);
  const responseFor = (row) => ({
    document: JSON.parse(row.document),
    formDestination: studio.destination(),
    pageId: row.id,
    storeId: row.store_id,
    brand: studio.brand(row.store_id),
    assets: studio
      .assets(row.store_id, true)
      .filter(
        (a) =>
          documentUses(JSON.parse(row.document), a) ||
          (a.type === "font" &&
            JSON.stringify(studio.brand(row.store_id).fonts).includes(
              a.family,
            )),
      ),
    catalog: commerce.catalog(row.store_id),
  });
  app.get("/api/stores/:id/experiments", auth, (req, res) =>
    res.json(
      db
        .prepare("SELECT * FROM experiments WHERE store_id=?")
        .all(req.params.id)
        .map((e) => ({ ...e, results: studio.analytics.results(e.id) })),
    ),
  );
  app.post("/api/stores/:id/experiments", auth, csrf, (req, res) => {
    if (!activeStore(req.params.id, res)) return;
    const a = publicPage(req.body.a),
      b = publicPage(req.body.b),
      split = Number(req.body.split || 50);
    if (
      !a ||
      !b ||
      a.id === b.id ||
      a.store_id !== req.params.id ||
      b.store_id !== req.params.id ||
      !Number.isInteger(split) ||
      split < 1 ||
      split > 99
    )
      return res.status(400).json({
        error:
          "Aynı mağazadan iki farklı yerel yayındaki sayfa ve %1–99 trafik oranı seç.",
      });
    const key = id();
    db.prepare("INSERT INTO experiments VALUES(?,?,?,?,?,?,1)").run(
      key,
      req.params.id,
      String(req.body.name || "A/B").slice(0, 100),
      a.id,
      b.id,
      split,
    );
    res.status(201).json({ id: key, path: `/?experiment=${key}` });
  });
  app.patch(
    "/api/stores/:id/experiments/:experimentId",
    auth,
    csrf,
    (req, res) => {
      if (!activeStore(req.params.id, res)) return;
      const result = db
        .prepare("UPDATE experiments SET active=? WHERE id=? AND store_id=?")
        .run(
          req.body.active === true ? 1 : 0,
          req.params.experimentId,
          req.params.id,
        );
      if (!result.changes)
        return res.status(404).json({ error: "Test bulunamadı." });
      res.json({ ok: true });
    },
  );
  app.get("/api/public/experiments/:id", (req, res) => {
    const experiment = db
      .prepare(
        "SELECT e.* FROM experiments e JOIN stores s ON s.id=e.store_id WHERE e.id=? AND e.active=1 AND s.status='active'",
      )
      .get(req.params.id);
    if (!experiment)
      return res.status(404).json({ error: "A/B testi aktif değil." });
    const chosen = studio.analytics.assign(req, res, experiment);
    res.append(
      "Set-Cookie",
      `fp_ab_${experiment.id}=${chosen}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    );
    const row = publicPage(experiment[chosen]);
    if (!row)
      return res
        .status(404)
        .json({ error: "Testin seçilen sayfası yayında değil." });
    res.json({
      ...responseFor(row),
      experimentId: experiment.id,
      variant: chosen,
    });
  });
  app.get("/api/stores/:id/funnels", auth, (req, res) =>
    res.json(
      db
        .prepare("SELECT * FROM funnels WHERE store_id=?")
        .all(req.params.id)
        .map((f) => ({ ...f, pages: JSON.parse(f.pages) })),
    ),
  );
  app.post("/api/stores/:id/funnels", auth, csrf, (req, res) => {
    if (!activeStore(req.params.id, res)) return;
    const pages = req.body.pages;
    if (
      !Array.isArray(pages) ||
      pages.length < 2 ||
      pages.length > 10 ||
      pages.some((p) => publicPage(p)?.store_id !== req.params.id)
    )
      return res
        .status(400)
        .json({ error: "Aynı mağazadan 2–10 yayındaki sayfa seç." });
    const key = id();
    db.prepare("INSERT INTO funnels VALUES(?,?,?,?)").run(
      key,
      req.params.id,
      String(req.body.name || "Huni").slice(0, 100),
      JSON.stringify(pages),
    );
    res.status(201).json({ id: key, path: `/?funnel=${key}&stage=0` });
  });
  app.get("/api/public/funnels/:id/:stage", (req, res) => {
    const f = db.prepare("SELECT * FROM funnels WHERE id=?").get(req.params.id),
      n = Number(req.params.stage);
    const pages = f && JSON.parse(f.pages);
    if (!f || !Number.isInteger(n) || n < 0 || n >= pages.length)
      return res.status(404).json({ error: "Huni adımı bulunamadı." });
    const row = publicPage(pages[n]);
    if (!row)
      return res.status(404).json({ error: "Huni adımı yayında değil." });
    res.json({
      ...responseFor(row),
      nextStage:
        n + 1 < pages.length ? `/?funnel=${f.id}&stage=${n + 1}` : null,
    });
  });
  app.post("/api/public/previews/:token/review", (req, res) => {
    const preview = db
      .prepare(
        "SELECT v.*,s.status FROM previews v JOIN pages p ON p.id=v.page_id JOIN stores s ON s.id=p.store_id WHERE v.token=? AND v.expires>? AND s.status='active'",
      )
      .get(req.params.token, Date.now());
    if (!preview) return res.status(404).json({ error: "Önizleme geçersiz." });
    const reviewer = String(req.body.reviewer || "")
        .trim()
        .slice(0, 100),
      decision = req.body.decision,
      note = String(req.body.note || "").slice(0, 4000);
    if (!reviewer || !["approve", "changes"].includes(decision))
      return res.status(400).json({ error: "Ad ve onay durumu gerekli." });
    if (
      db
        .prepare("SELECT COUNT(*) n FROM reviews WHERE token=?")
        .get(req.params.token).n >= 20
    )
      return res
        .status(429)
        .json({ error: "Bu önizleme için yorum sınırına ulaşıldı." });
    db.prepare("INSERT INTO reviews VALUES(?,?,?,?,?,?,?)").run(
      id(),
      req.params.token,
      preview.page_id,
      reviewer,
      decision,
      note,
      Date.now(),
    );
    res.status(201).json({ ok: true });
  });
  app.get("/api/pages/:id/reviews", auth, (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT id,reviewer,decision,note,created FROM reviews WHERE page_id=? ORDER BY created DESC",
        )
        .all(req.params.id),
    ),
  );
  const generating = new Set();
  app.get("/api/stores/:id/integrations", auth, (req, res) =>
    res.json({
      ai: { configured: ai.configured, model: ai.model },
      forms: {
        webhookLabel: studio.destination(),
        configured: !!process.env.FORM_WEBHOOK_URL,
        destination: process.env.FORM_WEBHOOK_URL
          ? "Yapılandırılmış webhook + uygulama kayıtları"
          : "Uygulama kayıtları",
      },
      shopify: { mode: "deferred" },
      subscriptions: { configured: false },
      reviews: { configured: false },
    }),
  );
  app.post("/api/stores/:id/ai", auth, csrf, async (req, res) => {
    if (!activeStore(req.params.id, res)) return;
    if (generating.has(req.params.id))
      return res.status(409).json({ error: "Bu mağaza için üretim sürüyor." });
    generating.add(req.params.id);
    try {
      let image;
      if (req.body.assetId) {
        const asset = studio
          .assets(req.params.id, true)
          .find((a) => a.id === req.body.assetId && a.type === "image");
        if (!asset)
          throw Object.assign(new Error("Mağazaya ait görsel seç."), {
            status: 400,
          });
        const original = readFileSync(
          resolve(dataDir, "assets", asset.id, asset.url.split("/").pop()),
        );
        const bytes = await sharp(original)
          .resize({ width: 1600, withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
        image = "data:image/jpeg;base64," + bytes.toString("base64");
      }
      const result = await ai.generate({
        prompt: String(req.body.prompt || "").slice(0, 3000),
        image,
        brand: studio.brand(req.params.id),
      });
      const document = validateDocument(result);
      res.json({ document, provider: "OpenAI", published: false });
    } catch (e) {
      res.status(e.status || 502).json({
        error: e.status
          ? e.message
          : "AI tasarımı doğrulanamadı. Tekrar deneyin.",
      });
    } finally {
      generating.delete(req.params.id);
    }
  });
  let webhookBusy = false;
  return {
    // Runs due jobs from the durable queue (webhook_jobs). The long-running
    // server calls it every 15 s; the Netlify demo calls it at the end of
    // each request with a small budget, so queued jobs no longer wait for a
    // dispatcher that never runs there.
    async runWebhookJobs({ limit = 10, timeout = 10000 } = {}) {
      if (webhookBusy) return;
      const url = process.env.FORM_WEBHOOK_URL;
      if (!url) return;
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        return;
      }
      if (parsed.protocol !== "https:") return;
      webhookBusy = true;
      try {
        for (const job of db
          .prepare(
            "SELECT j.*,f.data,f.page_id,f.form_id,f.store_id FROM webhook_jobs j JOIN form_submissions f ON f.id=j.submission_id JOIN stores s ON s.id=f.store_id WHERE j.state='pending' AND j.next_at<=? AND s.status='active' ORDER BY j.next_at LIMIT ?",
          )
          .all(Date.now(), limit)) {
          try {
            if (
              !db
                .prepare(
                  "SELECT j.id FROM webhook_jobs j JOIN form_submissions f ON f.id=j.submission_id JOIN stores s ON s.id=f.store_id WHERE j.id=? AND j.state='pending' AND s.status='active'",
                )
                .get(job.id)
            )
              continue;
            const r = await webhookFetch(url, {
              method: "POST",
              redirect: "error",
              signal: AbortSignal.timeout(timeout),
              headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": job.submission_id,
                ...(process.env.FORM_WEBHOOK_SECRET
                  ? {
                      Authorization: `Bearer ${process.env.FORM_WEBHOOK_SECRET}`,
                    }
                  : {}),
              },
              body: JSON.stringify({
                id: job.submission_id,
                storeId: job.store_id,
                pageId: job.page_id,
                formId: job.form_id,
                values: JSON.parse(job.data),
              }),
            });
            if (!r.ok) throw new Error("Rejected");
            db.prepare(
              "UPDATE webhook_jobs SET state='sent',attempts=attempts+1 WHERE id=?",
            ).run(job.id);
          } catch {
            db.prepare(
              "UPDATE webhook_jobs SET state=?,attempts=attempts+1,next_at=? WHERE id=?",
            ).run(
              job.attempts >= 4 ? "failed" : "pending",
              Date.now() + Math.min(3600000, 60000 * 2 ** job.attempts),
              job.id,
            );
          }
        }
      } finally {
        webhookBusy = false;
      }
    },
  };
}
