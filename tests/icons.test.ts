import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parseIconNode, cleanIconNode, iconStroke } from "../src/iconNode.ts";
import { iconPresets } from "../src/iconPresets.ts";
import {
  glyphIcons,
  iconCategories,
  iconKeywords,
  presetIconNames,
} from "../src/iconCatalog.ts";
import { searchIcons, vectorIconProps } from "../src/vectorIcons.ts";
import {
  block,
  createBlock,
  starterDocument,
  type Block,
} from "../src/model.ts";
import { createItemList } from "../src/atomicContent.ts";
import { pageTemplates, buildTemplate } from "../src/pageTemplateLibrary.ts";
import { createSectionPreset, sectionPresets } from "../src/sections.ts";
import { validateDocument } from "../server/index.mjs";

const library: Record<string, unknown> = JSON.parse(
  readFileSync("public/icons/lucide.json", "utf8"),
).icons;
const walk = (nodes: Block[]): Block[] =>
  nodes.flatMap((node) => [node, ...walk(node.children)]);

test("the icon library ships every Lucide icon as safe geometry and the bundled presets match it", () => {
  const names = Object.keys(library);
  assert.ok(names.length > 1400, String(names.length));
  for (const name of names)
    assert.ok(parseIconNode(JSON.stringify(library[name])), name);
  for (const name of presetIconNames)
    assert.deepEqual(iconPresets[name], library[name], name);
  for (const category of iconCategories)
    for (const name of category.icons)
      assert.ok(library[name], `${category.id}: ${name}`);
  for (const [word, matches] of Object.entries(iconKeywords))
    for (const name of matches) assert.ok(library[name], `${word}: ${name}`);
  for (const [glyph, name] of Object.entries(glyphIcons))
    assert.ok(library[name], `${glyph}: ${name}`);
  // The committed files are what the generator produces today.
  execFileSync(process.execPath, ["scripts/build-icons.mjs", "--check"]);
});

test("icon geometry rejects markup, events, links, styles and oversized data", () => {
  const ok = JSON.stringify([["path", { d: "M12 2v20" }]]);
  assert.equal(cleanIconNode(ok), ok);
  for (const bad of [
    "<svg onload=alert(1)>",
    JSON.stringify([["script", { d: "M0 0" }]]),
    JSON.stringify([["path", { d: "M0 0", onclick: "alert(1)" }]]),
    JSON.stringify([["path", { d: "javascript:alert(1)" }]]),
    JSON.stringify([["path", { style: "fill:url(#x)" }]]),
    JSON.stringify([["path", { fill: "url(#x)" }]]),
    JSON.stringify([["a", { href: "https://example.com" }]]),
    JSON.stringify([["circle", { r: "10px" }]]),
    JSON.stringify([]),
    JSON.stringify([["path", { d: "M0 0" + " L1 1".repeat(4000) }]]),
  ])
    assert.equal(parseIconNode(bad), null, bad.slice(0, 60));
  assert.equal(iconStroke("9"), 4);
  assert.equal(iconStroke("0.1"), 0.5);
  assert.equal(iconStroke("x"), 2);
});

test("the server keeps vector icons, drops empty ones and refuses unsafe geometry", () => {
  const icon = block("icon", {
    ...vectorIconProps("truck")!,
    strokeWidth: "7",
    iconFill: true,
    href: "javascript:alert(1)",
  });
  const page = {
    ...starterDocument(),
    nodes: [block("section", {}, {}, [icon])],
  };
  const saved = validateDocument(structuredClone(page)).nodes[0].children[0];
  assert.equal(saved.props.icon, "lucide:truck");
  assert.deepEqual(JSON.parse(String(saved.props.iconNode)), iconPresets.truck);
  assert.equal(saved.props.strokeWidth, "4");
  assert.equal(saved.props.iconFill, true);
  assert.equal(saved.props.href, "");
  icon.props.icon = "lucide:<b>";
  icon.props.iconNode = "";
  const cleared = validateDocument(structuredClone(page)).nodes[0].children[0];
  assert.equal(cleared.props.icon, "");
  assert.equal(cleared.props.iconNode, undefined);
  icon.props.iconNode = JSON.stringify([["path", { d: "M0 0", onload: "x" }]]);
  assert.throws(() => validateDocument(structuredClone(page)), /ikon/);
});

test("new icons, item lists, starter pages, sections and templates use vector icons", () => {
  assert.equal(createBlock("icon").props.icon, "lucide:star");
  const item = createItemList("Free shipping");
  assert.equal(item.children[0].props.icon, "lucide:check");
  const sources = [
    ...starterDocument().nodes,
    ...pageTemplates.flatMap((template) => buildTemplate(template.id)),
    ...sectionPresets.map((preset) => createSectionPreset(preset.id)!),
  ];
  const icons = walk(sources).filter((node) => node.kind === "icon");
  assert.ok(icons.length > 20, String(icons.length));
  // Feature, trust and contact icons are vectors; only symbols that are part
  // of a caption or rating text (★ ✦ → ↗) stay text.
  const vectors = icons.filter((node) => node.props.iconNode);
  assert.ok(vectors.length >= 30, String(vectors.length));
  const leftovers = icons
    .filter((node) => !node.props.iconNode)
    .map((node) => String(node.props.text));
  assert.deepEqual(
    [...new Set(leftovers)].filter((glyph) => !"★✦→↗".includes(glyph)),
    [],
  );
  for (const node of vectors)
    assert.ok(parseIconNode(node.props.iconNode), String(node.props.icon));
  let stored = 0;
  for (const node of sources)
    stored += walk(
      validateDocument({ ...starterDocument(), nodes: [node] }).nodes,
    ).filter((n) => n.props.iconNode).length;
  assert.equal(stored, vectors.length, "the server keeps every vector icon");
});

test("icon search finds Turkish words, English names and partial names", () => {
  const names = Object.keys(library);
  assert.equal(searchIcons(names, "kargo")[0], "truck");
  assert.equal(searchIcons(names, "star")[0], "star");
  assert.equal(searchIcons(names, "kalp")[0], "heart");
  assert.ok(searchIcons(names, "arrow").includes("arrow-right"));
  assert.ok(searchIcons(names, "shield check").includes("shield-check"));
  assert.deepEqual(searchIcons(names, "zzzz-nothing"), []);
  assert.equal(searchIcons(names, "").length, names.length);
});
