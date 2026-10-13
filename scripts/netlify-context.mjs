import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
// Build context is not assumed to be available in the function runtime.
// Embed only a public scope identifier; never embed environment secrets.
const scope =
  process.env.CONTEXT === "production"
    ? "production"
    : `preview-${process.env.DEPLOY_ID || "local"}`;
mkdirSync("netlify", { recursive: true });
writeFileSync(
  "netlify/.deployment-context.json",
  JSON.stringify({
    scope,
    version: JSON.parse(readFileSync("package.json", "utf8")).version,
    commit: /^[a-f0-9]{40}$/i.test(process.env.COMMIT_REF || "")
      ? process.env.COMMIT_REF
      : null,
  }) + "\n",
);
