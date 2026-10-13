import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// AWS Lambda disables require(ESM) by default. sanitize-html 2.18 is CJS
// while its patched htmlparser2 dependency is ESM. Bundle the current patched
// dependency graph at build time so runtime never needs require(ESM).
const outfile = resolve("server/generated/sanitize-html.cjs");
if (process.argv.includes("--if-missing") && existsSync(outfile))
  process.exit(0);
const { build } = await import("esbuild");
mkdirSync("server/generated", { recursive: true });
await build({
  stdin: {
    contents: 'module.exports = require("sanitize-html");',
    resolveDir: process.cwd(),
    sourcefile: "sanitize-html-entry.cjs",
  },
  outfile,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  legalComments: "inline",
  logLevel: "warning",
});
