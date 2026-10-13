import { test } from "node:test";
import assert from "node:assert/strict";
import { setUiLanguage, getUiLanguage, t, localized } from "../src/i18n.ts";
import { block, starterDocument, groups, labels } from "../src/model.ts";
import { sectionCategories, sectionPresets } from "../src/sections.ts";
import { setColumnCount } from "../src/columnLayouts.ts";
import { pasteBlocks } from "../src/editorCommands.ts";
import { validateDocument } from "../server/index.mjs";
import { cleanBrand } from "../server/studio.mjs";
import { freezeBrandDocument } from "../server/transfer-brand.mjs";

test("English is the default and language switching updates labels while preserving page content", () => {
  assert.equal(getUiLanguage(), "en");
  const liveLabels = localized({ save: "Kaydet" });
  const page = starterDocument();
  const content = JSON.stringify(page);
  assert.equal(liveLabels.save, "Save");
  setUiLanguage("tr");
  assert.equal(liveLabels.save, "Kaydet");
  assert.equal(t("Update all pages"), "Tüm sayfaları güncelle");
  assert.equal(JSON.stringify(page), content);
  for (const group of groups)
    for (const kind of group.kinds) assert.ok(labels[kind], kind);
  assert.deepEqual(
    sectionCategories.map(([id]) => id),
    ["all", "hero", "commerce", "content", "conversion", "layout"],
  );
  assert.equal(sectionPresets[0].id, "product-hero");
  setUiLanguage("en");
  assert.equal(liveLabels.save, "Save");
  assert.equal(t("Ayarlar"), "Settings");
});

test("changing column count retains content and IDs, merges removed columns and preserves other device overrides", () => {
  const a = block("text", { html: "A" });
  const b = block("icon", { icon: "∞" });
  const row = block("row", {}, {}, [a, b]);
  row.styles.mobile = { flexDirection: "column", gap: "7px" };
  const original = JSON.stringify(row);
  const four = setColumnCount(row, 4, "desktop");
  assert.equal(four.children.length, 4);
  assert.deepEqual(
    four.children[0].children.map((n) => n.id),
    [a.id, b.id],
  );
  const c = block("text", { html: "C" });
  four.children[3].children = [c];
  const two = setColumnCount(four, 2, "desktop");
  assert.equal(two.children.length, 2);
  assert.equal(two.children[1].children[0].id, c.id);
  assert.equal(two.children[1].children[0].props.html, "C");
  assert.deepEqual(two.styles.mobile, row.styles.mobile);
  assert.equal(two.children[0].styles.desktop.width, "50%");
  assert.equal(JSON.stringify(row), original);
});

test("pasting several siblings rewrites cross-sibling action targets together", () => {
  const target = block("text", { html: "Target" });
  const trigger = block("button", {
    text: "Scroll",
    action: "scroll",
    actionTarget: target.id,
  });
  const page = { ...starterDocument(), nodes: [trigger, target] };
  const result = pasteBlocks(page, [trigger, target], null);
  const [newTrigger, newTarget] = result.page.nodes.slice(2);
  assert.notEqual(newTrigger.id, trigger.id);
  assert.notEqual(newTarget.id, target.id);
  assert.equal(newTrigger.props.actionTarget, newTarget.id);
  assert.equal(trigger.props.actionTarget, target.id);
});

test("global spacing accepts zero, rejects invalid values and freezes correctly during cross-store transfer", () => {
  const brand = cleanBrand({ spacing: { xxs: 0, md: 28 } });
  for (const value of [-1, 401, "wrong", Infinity])
    assert.throws(() => cleanBrand({ spacing: { md: value } }));
  const text = block(
    "text",
    { html: "Content" },
    { padding: "var(--space-md)", margin: "var(--space-xxs)" },
  );
  const frozen = freezeBrandDocument(
    { ...starterDocument(), nodes: [text] },
    brand,
  );
  assert.equal(frozen.nodes[0].styles.desktop.padding, "28px");
  assert.equal(frozen.nodes[0].styles.desktop.margin, "0px");
  assert.equal(text.styles.desktop.padding, "var(--space-md)");
});

test("accordion items survive validation while invalid structure, duplicate IDs, colours and spacing fail", () => {
  const accordion = block("accordion", {
    accordionItems: JSON.stringify([
      { id: "one", title: "Question 1", content: "Answer 1" },
      { id: "two", title: "Question 2", content: "Answer 2" },
    ]),
    accordionHeaderBg: "#ffffff",
    accordionGap: "0",
  });
  const document = { ...starterDocument(), nodes: [accordion] };
  const valid = validateDocument(document);
  assert.deepEqual(
    JSON.parse(String(valid.nodes[0].props.accordionItems)),
    JSON.parse(String(accordion.props.accordionItems)),
  );
  for (const bad of [
    "not json",
    "[]",
    JSON.stringify([
      { id: "same", title: "A", content: "A" },
      { id: "same", title: "B", content: "B" },
    ]),
    JSON.stringify([{ id: "a", title: 2, content: "B" }]),
  ]) {
    assert.throws(() =>
      validateDocument({
        ...document,
        nodes: [
          { ...accordion, props: { ...accordion.props, accordionItems: bad } },
        ],
      }),
    );
  }
  for (const props of [
    { accordionHeaderBg: "invalid" },
    { accordionGap: "-1" },
    { accordionGap: "201" },
  ])
    assert.throws(() =>
      validateDocument({
        ...document,
        nodes: [{ ...accordion, props: { ...accordion.props, ...props } }],
      }),
    );
});
