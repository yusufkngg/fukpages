import { randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "./auth.mjs";
export function createTeamService(db, ownerLogin) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS team_accounts(id TEXT PRIMARY KEY,login TEXT UNIQUE NOT NULL,hash TEXT NOT NULL,role TEXT NOT NULL,stores TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);CREATE TABLE IF NOT EXISTS team_sessions(token TEXT PRIMARY KEY,account_id TEXT NOT NULL);",
  );
  const publicAccount = (row) => ({
    id: row.id,
    login: row.login,
    role: row.role,
    stores: JSON.parse(row.stores),
    active: !!row.active,
  });
  const scopes = (values) => {
    if (
      !Array.isArray(values) ||
      values.length > 100 ||
      values.some(
        (id) =>
          typeof id !== "string" ||
          !db.prepare("SELECT id FROM stores WHERE id=?").get(id),
      )
    )
      throw new Error("Geçerli mağaza yetkileri seç.");
    return [...new Set(values)];
  };
  const revoke = (id) => {
    db.prepare(
      "DELETE FROM sessions WHERE token IN (SELECT token FROM team_sessions WHERE account_id=?)",
    ).run(id);
    db.prepare("DELETE FROM team_sessions WHERE account_id=?").run(id);
  };
  return {
    match(login, password) {
      const row = db
        .prepare("SELECT * FROM team_accounts WHERE login=? AND active=1")
        .get(String(login || ""));
      return row && verifyPassword(password, row.hash) ? row : null;
    },
    bind(token, account) {
      db.prepare("INSERT INTO team_sessions VALUES(?,?)").run(
        token,
        account.id,
      );
    },
    access(session) {
      const binding = db
        .prepare("SELECT account_id FROM team_sessions WHERE token=?")
        .get(session.token);
      if (!binding) return { role: "owner", stores: [] };
      const account = db
        .prepare("SELECT * FROM team_accounts WHERE id=? AND active=1")
        .get(binding.account_id);
      return account
        ? { role: account.role, stores: JSON.parse(account.stores) }
        : null;
    },
    guard(req, res, next) {
      const access = req.access;
      if (
        !access ||
        access.role === "owner" ||
        !req.path.startsWith("/api/") ||
        req.path.startsWith("/api/public/") ||
        req.path.startsWith("/api/auth/")
      )
        return next();
      const deny = () =>
        res.status(403).json({ error: "Bu işlem için yetkin yok." });
      if (
        req.path.startsWith("/api/team") ||
        (req.path === "/api/stores" && req.method !== "GET") ||
        /\/stores\/[^/]+\/(status|shopify|theme\/sync)/.test(req.path)
      )
        return deny();
      const storeMatch = /^\/api\/stores\/([^/]+)/.exec(req.path),
        pageMatch = /^\/api\/pages\/([^/]+)/.exec(req.path),
        assetMatch = /^\/api\/assets\/([^/]+)/.exec(req.path);
      const storeId =
        storeMatch?.[1] ||
        (pageMatch &&
          db.prepare("SELECT store_id FROM pages WHERE id=?").get(pageMatch[1])
            ?.store_id) ||
        (assetMatch &&
          db
            .prepare("SELECT store_id FROM assets WHERE id=?")
            .get(assetMatch[1])?.store_id);
      if (
        storeId &&
        (!access.stores.includes(storeId) ||
          db.prepare("SELECT status FROM stores WHERE id=?").get(storeId)
            ?.status !== "active")
      ) {
        if (assetMatch) {
          req.ownerSession = null;
          return next();
        }
        return deny();
      }
      if (
        req.body?.targetStoreId &&
        !access.stores.includes(req.body.targetStoreId)
      )
        return deny();
      if (
        access.role === "viewer" &&
        !["GET", "HEAD"].includes(req.method) &&
        req.path !== "/api/documents/validate"
      )
        return deny();
      if (
        !storeId &&
        req.path !== "/api/stores" &&
        req.path !== "/api/documents/validate" &&
        !assetMatch
      )
        return deny();
      next();
    },
    register({ app, auth, csrf }) {
      const owner = (req, res, next) =>
        req.access?.role === "owner"
          ? next()
          : res.status(403).json({
              error: "Yalnızca ana yönetici hesap yetkilerini değiştirebilir.",
            });
      app.get("/api/team", auth, owner, (req, res) =>
        res.json(
          db
            .prepare("SELECT * FROM team_accounts ORDER BY login")
            .all()
            .map(publicAccount),
        ),
      );
      app.post("/api/team", auth, owner, csrf, (req, res) => {
        try {
          const login = String(req.body.login || "").trim();
          if (
            !/^[\w.-]{3,80}$/.test(login) ||
            login === ownerLogin ||
            db.prepare("SELECT id FROM team_accounts WHERE login=?").get(login)
          )
            throw new Error("Benzersiz kullanıcı adı seç.");
          if (!["editor", "viewer"].includes(req.body.role))
            throw new Error("Düzenleyici veya izleyici rolü seç.");
          if (
            typeof req.body.password !== "string" ||
            req.body.password.length < 12 ||
            req.body.password.length > 1024
          )
            throw new Error("En az 12 karakterli şifre gerekli.");
          const stores = scopes(req.body.stores),
            id = randomBytes(16).toString("hex");
          db.prepare("INSERT INTO team_accounts VALUES(?,?,?,?,?,1)").run(
            id,
            login,
            hashPassword(req.body.password),
            req.body.role,
            JSON.stringify(stores),
          );
          res
            .status(201)
            .json(
              publicAccount(
                db.prepare("SELECT * FROM team_accounts WHERE id=?").get(id),
              ),
            );
        } catch (e) {
          res.status(400).json({ error: e.message });
        }
      });
      app.patch("/api/team/:id", auth, owner, csrf, (req, res) => {
        const row = db
          .prepare("SELECT * FROM team_accounts WHERE id=?")
          .get(req.params.id);
        if (!row) return res.status(404).json({ error: "Hesap bulunamadı." });
        try {
          const role = req.body.role || row.role;
          if (!["editor", "viewer"].includes(role))
            throw new Error("Geçersiz rol.");
          const stores = req.body.stores
            ? scopes(req.body.stores)
            : JSON.parse(row.stores);
          db.prepare(
            "UPDATE team_accounts SET role=?,stores=?,active=? WHERE id=?",
          ).run(
            role,
            JSON.stringify(stores),
            req.body.active === undefined
              ? row.active
              : req.body.active === true
                ? 1
                : 0,
            row.id,
          );
          revoke(row.id);
          res.json(
            publicAccount(
              db.prepare("SELECT * FROM team_accounts WHERE id=?").get(row.id),
            ),
          );
        } catch (e) {
          res.status(400).json({ error: e.message });
        }
      });
      app.delete("/api/team/:id", auth, owner, csrf, (req, res) => {
        revoke(req.params.id);
        db.prepare("DELETE FROM team_accounts WHERE id=?").run(req.params.id);
        res.json({ ok: true });
      });
    },
  };
}
