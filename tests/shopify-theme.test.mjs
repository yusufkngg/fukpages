import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildThemeSnapshot,
  createShopifyThemeService,
  normalizeShopDomain,
} from "../server/shopify-theme.mjs";
import {
  createFixtureService,
  fixtureDomain,
  fixtureFiles,
  fixtureTheme,
} from "./fixtures/shopify.mjs";

test("reads header groups, template order, footer groups, settings and hidden sections without theme writes", async () => {
  const calls = [];
  const snapshot = await createFixtureService({ calls }).sync(
    fixtureDomain,
    "templates/page.json",
  );
  assert.deepEqual(
    snapshot.sections.map((section) => section.sectionId),
    ["announcement", "header", "main", "featured", "footer", "newsletter"],
  );
  assert.deepEqual(
    snapshot.sections.map((section) => section.region),
    ["header", "header", "main", "main", "footer", "footer"],
  );
  assert.equal(
    snapshot.sections.find((section) => section.type === "header").settings
      .show_country_selector,
    true,
  );
  assert.equal(
    snapshot.sections.find((section) => section.type === "main-page").settings
      .url,
    "https://example.test/a//b",
  );
  assert.equal(snapshot.sections.at(-1).enabled, false);
  assert.ok(calls.length >= 4);
  assert.ok(
    calls.every(
      (call) =>
        call.query.startsWith("query ") &&
        call.url === `https://${fixtureDomain}/admin/api/2026-10/graphql.json`,
    ),
  );
  assert.ok(calls.every((call) => !call.query.includes("mutation")));
});
test("legacy static header/footer references keep settings instead of inventing section groups", () => {
  const files = new Map(fixtureFiles);
  files.set(
    "layout/theme.liquid",
    `{% section 'header' %}{{ content_for_layout }}{% section 'footer' %}`,
  );
  files.set(
    "config/settings_data.json",
    JSON.stringify({
      current: {
        sections: {
          header: { type: "header", settings: { menu: "secondary-menu" } },
        },
      },
    }),
  );
  const snapshot = buildThemeSnapshot({
    shopDomain: fixtureDomain,
    theme: fixtureTheme,
    templateFilename: "templates/page.json",
    files,
  });
  assert.equal(snapshot.sections[0].group, null);
  assert.equal(snapshot.sections[0].settings.menu, "secondary-menu");
  assert.equal(snapshot.sections.at(-1).type, "footer");
});
test("missing/invalid JSON templates and missing section references fail rather than reporting sync success", async () => {
  const missing = new Map(fixtureFiles);
  missing.delete("templates/page.json");
  await assert.rejects(
    createFixtureService({ files: missing }).sync(
      fixtureDomain,
      "templates/page.json",
    ),
    /JSON şablonu/,
  );
  const badOrder = new Map(fixtureFiles);
  badOrder.set(
    "templates/page.json",
    JSON.stringify({ sections: {}, order: ["missing"] }),
  );
  await assert.rejects(
    createFixtureService({ files: badOrder }).sync(
      fixtureDomain,
      "templates/page.json",
    ),
    /Geçersiz bölüm sırası/,
  );
});
test("connection validates the store domain, scope failure, and unsafe template paths", async () => {
  assert.throws(() => normalizeShopDomain("https://evil.test/"), /myshopify/);
  const service = createShopifyThemeService({
    domain: fixtureDomain,
    token: "test-only",
    fetchImpl: async () => new Response("{}", { status: 403 }),
  });
  await assert.rejects(
    service.sync(fixtureDomain, "templates/page.json"),
    /read_themes/,
  );
  await assert.rejects(
    service.sync("another-fixture.myshopify.com", "templates/page.json"),
    /yapılandırılmadı/,
  );
  await assert.rejects(
    service.sync(fixtureDomain, "../config/secrets.json"),
    /Geçersiz tema şablonu/,
  );
});
