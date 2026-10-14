import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { setUiLanguage } from "../src/i18n.ts";
import {
  appendTemplateSections,
  buildTemplate,
  pageTemplates,
  templateDocument,
  templateLabel,
  templatesFor,
} from "../src/pageTemplateLibrary.ts";
import { block, starterDocument, type Block } from "../src/model.ts";
import { validateDocument } from "../server/index.mjs";

const walk = (nodes: Block[]): Block[] =>
  nodes.flatMap((node) => [node, ...walk(node.children)]);
const context = { collectionId: "aura-collection", productIds: ["a", "b"] };

test("every page template is accepted by the server without losing blocks or settings", () => {
  for (const template of pageTemplates) {
    const document = templateDocument(template.id, context)!;
    const stored = validateDocument(structuredClone(document));
    const before = walk(document.nodes);
    const after = walk(stored.nodes);
    assert.equal(after.length, before.length, template.id);
    for (const [index, node] of before.entries()) {
      assert.equal(after[index].kind, node.kind, `${template.id} ${node.id}`);
      assert.deepEqual(
        Object.keys(after[index].styles.desktop).sort(),
        Object.keys(node.styles.desktop).sort(),
        `${template.id} ${node.kind} styles`,
      );
    }
  }
});

test("templates are complete pages: header first, footer last, one h1 and unique ids", () => {
  for (const template of pageTemplates) {
    const nodes = buildTemplate(template.id, context);
    assert.ok(nodes.length >= 4, template.id);
    assert.ok(
      nodes.every((node) => node.kind === "section"),
      template.id,
    );
    const roles = nodes.map((node) => String(node.props.sectionRole));
    assert.equal(roles.at(-1), "footer", template.id);
    assert.ok(roles.indexOf("header") <= 1, template.id);
    const all = walk(nodes);
    assert.equal(new Set(all.map((n) => n.id)).size, all.length, template.id);
    const h1 = all.filter((n) => n.props.tag === "h1");
    assert.equal(h1.length, 1, `${template.id} has ${h1.length} h1`);
    const again = new Set(
      walk(buildTemplate(template.id, context)).map((n) => n.id),
    );
    assert.ok(
      all.every((n) => !again.has(n.id)),
      "each use gets fresh ids",
    );
  }
});

test("template media ships with the app and copy follows the interface language", () => {
  for (const template of pageTemplates)
    for (const node of walk(buildTemplate(template.id, context)))
      for (const source of [
        node.props.src,
        ...String(node.props.images ?? "").split("\n"),
      ])
        if (typeof source === "string" && source.startsWith("/assets/"))
          assert.ok(existsSync("public" + source), source);
  setUiLanguage("tr");
  const turkish = JSON.stringify(buildTemplate("product-launch"));
  const turkishName = templateLabel(pageTemplates[0]).name;
  setUiLanguage("en");
  const english = JSON.stringify(buildTemplate("product-launch"));
  assert.match(turkish, /Neden bizi seçmelisin/);
  assert.match(english, /Why customers choose us/);
  assert.equal(turkishName, "Ürün lansmanı");
  assert.equal(templateLabel(pageTemplates[0]).name, "Product launch");
});

test("page types get matching templates and product/collection pages bind to real data", () => {
  for (const type of [
    "home",
    "product",
    "collection",
    "landing",
    "page",
  ] as const) {
    const list = templatesFor(type);
    assert.ok(
      list.length > 0 && list.every((t) => t.types.includes(type)),
      type,
    );
  }
  const product = walk(buildTemplate("classic-product", context));
  for (const kind of [
    "productGallery",
    "variantPicker",
    "quantity",
    "addToCart",
  ])
    assert.ok(
      product.some((n) => n.kind === kind),
      kind,
    );
  const collection = walk(buildTemplate("collection-grid", context));
  assert.equal(
    collection.find((n) => n.kind === "collectionGrid")?.props.resourceBinding,
    "page",
  );
  const sale = walk(buildTemplate("sale-campaign", context));
  assert.equal(sale.find((n) => n.kind === "bundle")?.props.productIds, "a,b");
  assert.equal(
    sale.find((n) => n.kind === "collectionGrid")?.props.collectionId,
    "aura-collection",
  );
});

test("adding a template keeps the page's own header and footer", () => {
  const header = block("section", { sectionRole: "header" });
  const body = block("section");
  const footer = block("section", { sectionRole: "footer" });
  const page = { ...starterDocument(), nodes: [header, body, footer] };
  const sections = buildTemplate("storefront-home", context);
  const next = appendTemplateSections(page, sections);
  assert.equal(next.nodes[0].id, header.id);
  assert.equal(next.nodes[1].id, body.id);
  assert.equal(next.nodes.at(-1)!.id, footer.id);
  assert.equal(
    next.nodes.length,
    3 +
      sections.filter(
        (s) => !["header", "footer"].includes(String(s.props.sectionRole)),
      ).length,
  );
  assert.equal(
    next.nodes.filter((n) => n.props.sectionRole === "header").length,
    1,
  );
  assert.equal(page.nodes.length, 3, "input page is not mutated");
});
