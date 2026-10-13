import { createHash, randomBytes } from "node:crypto";

export function createAnalytics(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS metric_events(page_id TEXT NOT NULL,event_id TEXT NOT NULL,event TEXT NOT NULL,visitor TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(page_id,event_id));
    CREATE TABLE IF NOT EXISTS experiment_assignments(experiment_id TEXT NOT NULL,visitor TEXT NOT NULL,variant TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(experiment_id,visitor));
    CREATE TABLE IF NOT EXISTS experiment_conversions(experiment_id TEXT NOT NULL,visitor TEXT NOT NULL,event TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(experiment_id,visitor,event));`);
  const visitor = (req, res) => {
    const prior = req.headers.cookie
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("fp_visitor="))
      ?.slice(11);
    const token = /^[a-f\d]{64}$/.test(prior || "")
      ? prior
      : randomBytes(32).toString("hex");
    if (token !== prior)
      res.append(
        "Set-Cookie",
        `fp_visitor=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
      );
    return createHash("sha256").update(token).digest("hex");
  };
  const assign = (req, res, experiment) => {
    const who = visitor(req, res);
    const prior = db
      .prepare(
        "SELECT variant FROM experiment_assignments WHERE experiment_id=? AND visitor=?",
      )
      .get(experiment.id, who);
    const chosen =
      prior?.variant ||
      ((randomBytes(4).readUInt32BE() / 0x100000000) * 100 < experiment.split
        ? "a"
        : "b");
    db.prepare(
      "INSERT OR IGNORE INTO experiment_assignments VALUES(?,?,?,?)",
    ).run(experiment.id, who, chosen, Date.now());
    return chosen;
  };
  const record = (req, res, pageId) => {
    const { event, experimentId } = req.body;
    const eventId = req.body.eventId || randomBytes(16).toString("hex");
    if (!/^[\w-]{16,100}$/.test(eventId))
      return res.status(400).json({ error: "Geçerli olay kimliği gerekli." });
    const who = visitor(req, res);
    let experiment;
    if (experimentId) {
      experiment = db
        .prepare(
          "SELECT e.*,a.variant FROM experiments e JOIN experiment_assignments a ON a.experiment_id=e.id WHERE e.id=? AND a.visitor=? AND e.active=1",
        )
        .get(experimentId, who);
      if (!experiment || experiment[experiment.variant] !== pageId)
        return res
          .status(400)
          .json({ error: "Olay bu ziyaretçinin test sayfasıyla eşleşmiyor." });
    }
    const prior = db
      .prepare(
        "SELECT event,visitor FROM metric_events WHERE page_id=? AND event_id=?",
      )
      .get(pageId, eventId);
    if (prior)
      return prior.event === event
        ? res.status(204).end()
        : res
            .status(409)
            .json({ error: "Olay kimliği başka bir işlem için kullanılmış." });
    db.exec("BEGIN");
    try {
      db.prepare("INSERT INTO metric_events VALUES(?,?,?,?,?)").run(
        pageId,
        eventId,
        event,
        who,
        Date.now(),
      );
      db.prepare(
        "INSERT INTO metrics VALUES(?,?,?,1) ON CONFLICT(page_id,event,day) DO UPDATE SET count=count+1",
      ).run(pageId, event, new Date().toISOString().slice(0, 10));
      if (experiment && event !== "view")
        db.prepare(
          "INSERT OR IGNORE INTO experiment_conversions VALUES(?,?,?,?)",
        ).run(experiment.id, who, event, Date.now());
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    res.status(204).end();
  };
  const interval = (success, total) => {
    if (!total) return [0, 0];
    const z = 1.96,
      rate = success / total,
      scale = 1 + (z * z) / total;
    const center = (rate + (z * z) / (2 * total)) / scale;
    const margin =
      (z *
        Math.sqrt(
          (rate * (1 - rate)) / total + (z * z) / (4 * total * total),
        )) /
      scale;
    return [Math.max(0, center - margin), Math.min(1, center + margin)];
  };
  const results = (experimentId) => {
    const variants = ["a", "b"].map((variant) => {
      const visitors = db
        .prepare(
          "SELECT COUNT(*) n FROM experiment_assignments WHERE experiment_id=? AND variant=?",
        )
        .get(experimentId, variant).n;
      const counts = db
        .prepare(
          "SELECT c.event,COUNT(*) n FROM experiment_conversions c JOIN experiment_assignments a ON a.experiment_id=c.experiment_id AND a.visitor=c.visitor WHERE c.experiment_id=? AND a.variant=? GROUP BY c.event",
        )
        .all(experimentId, variant);
      const clicks = counts.find((v) => v.event === "click")?.n || 0;
      const carts = counts.find((v) => v.event === "add_to_cart")?.n || 0;
      return {
        variant,
        visitors,
        clicks,
        carts,
        cartRate: visitors ? carts / visitors : 0,
        interval: interval(carts, visitors),
      };
    });
    return {
      variants,
      observedLift: variants[0].cartRate
        ? variants[1].cartRate / variants[0].cartRate - 1
        : null,
      goal: "Yerel sepete ekleyen benzersiz ziyaretçi",
      note: "Çerezlere dayalı ziyaretçi ölçümü. Oran aralıkları %95 Wilson aralığıdır; satın alma ölçümü veya otomatik kazanan kararı değildir.",
    };
  };
  return { visitor, assign, record, results };
}
