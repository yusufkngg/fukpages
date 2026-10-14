/**
 * Rate limits kept in the database, so they hold across server restarts and
 * across Netlify invocations (each one restores the same SQLite snapshot).
 * Fixed windows per key; old windows are pruned as they expire.
 */
export function createRateLimiter(db) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,window INTEGER NOT NULL,count INTEGER NOT NULL,expires INTEGER NOT NULL)",
  );
  let lastPrune = 0;
  /** Counts one hit; false when the key is over `limit` in this window. */
  const hit = (key, limit, windowMs, now = Date.now()) => {
    const window = Math.floor(now / windowMs);
    if (now - lastPrune > 60000) {
      lastPrune = now;
      db.prepare("DELETE FROM rate_limits WHERE expires < ?").run(now);
    }
    const row = db
      .prepare("SELECT window,count FROM rate_limits WHERE key=?")
      .get(key);
    const count = row && row.window === window ? row.count + 1 : 1;
    if (count > limit) return false;
    db.prepare(
      "INSERT INTO rate_limits VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET window=excluded.window,count=excluded.count,expires=excluded.expires",
    ).run(key, window, count, (window + 1) * windowMs);
    return true;
  };
  return { hit };
}

/** The visitor's address, including behind Netlify's edge. */
export const clientAddress = (req) =>
  String(
    req.get?.("x-nf-client-connection-ip") ||
      req.headers?.["x-nf-client-connection-ip"] ||
      req.ip ||
      req.socket?.remoteAddress ||
      "unknown",
  ).slice(0, 80);
