import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createBlock,
  starterDocument,
  block,
  cloneBlock,
  type Block,
} from "../src/model.ts";
import {
  normalizeAtomicDocument,
  normalizeAtomicBlock,
  setCaption,
  contentFragments,
} from "../src/atomicContent.ts";
import { validateDocument } from "../server/index.mjs";
import { createSectionPreset, sectionPresets } from "../src/sections.ts";

test("legacy star proof becomes five individual icons plus text without losing IDs, anchors, geometry or formatting", () => {
  const old = createBlock("text");
  old.id = "proof";
  old.props = {
    html: '<span style="color:#ffcc00">★★★★★</span> <b>4.9 / 5</b> · Reviews',
    cssId: "reviews",
  };
  old.styles.desktop = {
    fontSize: "12px",
    color: "#66715f",
    paddingLeft: "10px",
    position: "absolute",
    left: "20px",
    top: "30px",
  };
  old.styles.mobile = { fontSize: "10px", width: "90%" };
  const page = { ...starterDocument(), nodes: [old] },
    before = JSON.stringify(page);
  const converted = normalizeAtomicDocument(page),
    row = converted.nodes[0];
  assert.equal(row.id, "proof");
  assert.equal(row.kind, "row");
  assert.equal(row.props.cssId, "reviews");
  assert.deepEqual(
    row.children.map((n) => n.kind),
    ["icon", "icon", "icon", "icon", "icon", "text"],
  );
  assert.equal(new Set(row.children.map((n) => n.id)).size, 6);
  assert.equal(row.children[0].styles.desktop.color, "#ffcc00");
  assert.match(String(row.children[5].props.html), /<b>4.9 \/ 5<\/b>/);
  assert.ok(row.children.every((n) => !n.props.cssId));
  assert.equal(row.styles.desktop.left, "20px");
  assert.equal(row.styles.mobile.width, "90%");
  assert.deepEqual(normalizeAtomicDocument(converted), converted);
  assert.deepEqual(normalizeAtomicDocument(page), converted);
  assert.equal(JSON.stringify(page), before);
  assert.equal(validateDocument(converted).nodes[0].children.length, 6);
});

test("legacy menu labels retain individual translations and normal multi-line paragraphs stay text", () => {
  const old = createBlock("text");
  old.props = {
    html: "Shop &nbsp;&nbsp;&nbsp; Our story &nbsp;&nbsp;&nbsp; Support",
    translations: JSON.stringify({
      tr: {
        html: "Mağaza &nbsp;&nbsp;&nbsp; Hikâyemiz &nbsp;&nbsp;&nbsp; Destek",
      },
    }),
  };
  const menu = normalizeAtomicDocument({ ...starterDocument(), nodes: [old] })
    .nodes[0];
  assert.equal(menu.kind, "row");
  assert.equal(menu.children.length, 3);
  assert.equal(menu.styles.desktop.gap, "20px");
  assert.deepEqual(
    menu.children.map((n) => String(n.props.html).trim()),
    ["Shop", "Our story", "Support"],
  );
  assert.deepEqual(
    menu.children.map((n) =>
      JSON.parse(String(n.props.translations)).tr.html.trim(),
    ),
    ["Mağaza", "Hikâyemiz", "Destek"],
  );
  assert.equal(
    normalizeAtomicBlock(block("text", { html: "First line<br/>Second line" }))
      .kind,
    "text",
  );
  assert.equal(
    contentFragments('<span style="color:#ffcc00">★★</span> Text').filter(
      (f) => f.kind === "icon",
    ).length,
    2,
  );
});

test("item lists, ratings and button captions are real saved child blocks; caption edits retain custom children and deleted icons stay deleted", () => {
  const item = createBlock("itemList"),
    rating = createBlock("rating");
  assert.deepEqual(
    item.children.map((n) => n.kind),
    ["icon", "text"],
  );
  assert.equal(rating.children.filter((n) => n.kind === "icon").length, 5);
  const button = block("button", {
    text: "Shop →",
    href: "https://example.com",
  });
  const custom = createBlock("icon");
  custom.props.src = "/assets/headphones.svg";
  button.children.push(custom);
  const edited = setCaption(button, "Buy now");
  assert.equal(
    edited.children.find((n) => n.id === custom.id)?.props.src,
    custom.props.src,
  );
  assert.equal(edited.props.href, button.props.href);
  edited.children = edited.children.filter(
    (n) => n.props.slot !== "captionIcon",
  );
  assert.ok(
    normalizeAtomicBlock(edited).children.every(
      (n) => n.props.slot !== "captionIcon",
    ),
  );
  const saved = validateDocument({
    ...starterDocument(),
    nodes: [item, rating, edited],
  });
  assert.equal(saved.nodes[0].children.length, 2);
  assert.equal(
    saved.nodes[1].children.filter((n) => n.kind === "icon").length,
    5,
  );
  assert.throws(() =>
    validateDocument({
      ...starterDocument(),
      nodes: [{ ...button, children: [createBlock("button")] }],
    }),
  );
});

test("all 60 ready-made sections use independent icon blocks instead of embedding decorative glyphs or spaced menus in text", () => {
  const visit = (nodes: Block[]) =>
    nodes.flatMap((n) => [n, ...visit(n.children)]);
  for (const preset of sectionPresets) {
    const section = createSectionPreset(preset.id)!;
    const saved = validateDocument({ ...starterDocument(), nodes: [section] })
      .nodes[0];
    for (const n of visit([saved]))
      if (["text", "heading"].includes(n.kind)) {
        assert.ok(
          !/[★☆✓✔✦∞→↗]/.test(String(n.props.html)),
          preset.id + ":" + n.name,
        );
        assert.ok(
          !/(?:&nbsp;){2,}/.test(String(n.props.html)),
          preset.id + ":" + n.name,
        );
      }
  }
});

test("product card parts edit independently and catalogue rebindings retain component IDs, styles and custom content", () => {
  const card = block("product", {
    title: "Custom title",
    price: "$29",
    description: "Details",
  });
  const title = card.children.find((n) => n.props.slot === "productTitle")!;
  assert.equal(title.props.html, "Custom title");
  title.styles.desktop.fontSize = "42px";
  const note = block("text", { html: "User's own note" });
  card.children.push(note);
  const bound = normalizeAtomicBlock(
    { ...card, props: { ...card.props, productId: "p1" } },
    card,
  );
  assert.equal(
    bound.children.find((n) => n.props.slot === "productTitle")?.id,
    title.id,
  );
  assert.equal(
    bound.children.find((n) => n.props.slot === "productTitle")?.styles.desktop
      .fontSize,
    "42px",
  );
  const next = normalizeAtomicBlock(
    { ...bound, props: { ...bound.props, productId: "p2" } },
    bound,
  );
  assert.deepEqual(
    next.children.map((n) => n.id),
    bound.children.map((n) => n.id),
  );
  assert.equal(
    next.children.find((n) => n.id === note.id)?.props.html,
    note.props.html,
  );
  assert.equal(
    next.children.find((n) => n.props.slot === "productTitle")?.props.productId,
    "p2",
  );
  const copy = cloneBlock(title);
  assert.equal(copy.props.slot, undefined);
  assert.equal(copy.props.html, title.props.html);
  assert.equal(
    validateDocument({ ...starterDocument(), nodes: [next] }).nodes[0].children
      .length,
    next.children.length,
  );
});

test("F0: building a section preset never changes blocks of an already open page", async () => {
  const { createSectionPreset, sectionPresets } =
    await import("../src/sections");
  // Tabs and carousels build their panels from shared style constants.
  const open = [createBlock("tabs"), createBlock("carousel")];
  const before = JSON.stringify(open);
  for (const preset of sectionPresets) createSectionPreset(preset.id);
  assert.equal(JSON.stringify(open), before);
  // …and earlier presets never leaked brand styles into new blocks.
  for (const preset of sectionPresets) createSectionPreset(preset.id);
  assert.ok(!JSON.stringify(createBlock("tabs")).includes("brand-shadow"));
});
