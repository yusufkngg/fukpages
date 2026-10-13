import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, extname } from "node:path";
import { BlobsServer } from "@netlify/blobs/server";
import { setEnvironmentContext } from "@netlify/blobs";
import handler from "../netlify/functions/api.mjs";
if (process.env.NODE_ENV !== "test") throw new Error("Test-only server");
const temp = mkdtempSync(resolve(tmpdir(), "fukpages-netlify-browser-"));
const blobs = new BlobsServer({
  directory: temp,
  token: "fixture-only",
  logger: () => {},
});
const { port } = await blobs.start();
setEnvironmentContext({
  siteID: "browser-fixture",
  token: "fixture-only",
  apiURL: `http://127.0.0.1:${port}`,
});
const server = createServer(async (req, res) => {
  // Test-only stalled response; the browser must cancel it at its deadline.
  if (
    req.url === "/api/auth/status" &&
    req.headers["x-fukpages-test-stall"] === "1"
  )
    return;
  try {
    if (req.url.startsWith("/api/") || req.url.startsWith("/p/")) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const request = new Request(`http://${req.headers.host}${req.url}`, {
        method: req.method,
        headers: req.headers,
        ...(req.method !== "GET" && req.method !== "HEAD"
          ? { body: Buffer.concat(chunks) }
          : {}),
      });
      const response = await handler(request, { ip: req.socket.remoteAddress });
      const headers = Object.fromEntries(response.headers);
      if (response.headers.getSetCookie().length)
        headers["set-cookie"] = response.headers.getSetCookie();
      res.writeHead(response.status, headers);
      res.end(Buffer.from(await response.arrayBuffer()));
    } else {
      const path = resolve(
        "dist",
        "." + new URL(req.url, "http://localhost").pathname,
      );
      const file =
        path.startsWith(resolve("dist") + "/") && existsSync(path)
          ? path
          : resolve("dist/index.html");
      const types = {
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".html": "text/html",
      };
      res.writeHead(200, {
        "content-type": types[extname(file)] || "application/octet-stream",
      });
      res.end(readFileSync(file));
    }
  } catch {
    res.writeHead(500);
    res.end("Temporary test server failed");
  }
});
server.listen(Number(process.env.PORT), "127.0.0.1");
process.on("SIGTERM", async () => {
  server.close();
  await blobs.stop();
  rmSync(temp, { recursive: true, force: true });
  process.exit(0);
});
