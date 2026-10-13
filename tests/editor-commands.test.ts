import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createBlock,
  block,
  starterDocument,
  findBlock,
  type Kind,
} from "../src/model";
import { sectionPresets, createSectionPreset } from "../src/sections";
import {
  isLocked,
  groupSelection,
  ungroupSelection,
  pasteBlocks,
} from "../src/editorCommands";
import { validateDocument } from "../server/index.mjs";
test("all 50 element kinds and 60 presets serialize through the server validator with brand tokens and mobile overrides", () => {
  assert.equal(sectionPresets.length, 60);
  for (const preset of sectionPresets) {
    const section = createSectionPreset(preset.id)!;
    const validated = validateDocument({
      ...starterDocument(),
      nodes: [section],
    });
    assert.equal(validated.nodes[0].props.presetId, preset.id);
    assert.ok(JSON.stringify(section).includes("var(--brand-"));
    assert.ok(Object.keys(section.styles.mobile).length > 0);
  }
  const kinds = [
    "itemList",
    "form",
    "select",
    "checkbox",
    "radio",
    "tabs",
    "carousel",
    "gallery",
    "logos",
    "rating",
    "comparison",
    "beforeAfter",
    "coupon",
    "shipping",
    "popup",
    "videoPopup",
    "backToTop",
    "breadcrumb",
    "mobileMenu",
    "blogList",
    "customCode",
    "appEmbed",
    "productGallery",
    "variantPicker",
    "quantity",
    "addToCart",
    "stickyCart",
    "collectionGrid",
    "productField",
    "bundle",
    "sizeTable",
  ] as Kind[];
  for (const kind of kinds)
    assert.equal(
      validateDocument({ ...starterDocument(), nodes: [createBlock(kind)] })
        .nodes[0].kind,
      kind,
    );
});
test("multi-selection groups in sibling order, ungroup is lossless, nested locks prevent edits and pastes use unique IDs", () => {
  const a = block("text", { html: "A" }),
    b = block("text", { html: "B" }),
    c = block("text", { html: "C" }),
    page = { ...starterDocument(), nodes: [a, b, c] };
  const grouped = groupSelection(page, [b.id, a.id]);
  assert.equal(grouped.page.nodes.length, 2);
  assert.deepEqual(
    findBlock(grouped.page.nodes, grouped.id)!.children.map((n) => n.id),
    [a.id, b.id],
  );
  const ungrouped = ungroupSelection(grouped.page, grouped.id);
  assert.deepEqual(ungrouped.nodes, page.nodes);
  const locked = grouped.page;
  locked.nodes[0].props.locked = true;
  assert.equal(isLocked(locked.nodes, a.id), true);
  assert.throws(() => ungroupSelection(locked, grouped.id));
  const pasted = pasteBlocks(page, [a, b], null);
  assert.equal(pasted.page.nodes.length, 5);
  assert.notEqual(pasted.page.nodes[3].id, a.id);
  assert.equal(new Set(pasted.page.nodes.map((n) => n.id)).size, 5);
});
