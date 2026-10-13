import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acceptsDrop,
  edgeIndicator,
  indicatorFor,
  insertionIndex,
  resolveDrop,
  type DropCandidate,
  type ResolvedDrop,
} from "../src/dropTargets.ts";
import { placeSection } from "../src/sections.ts";
import { blockPath } from "../src/Breadcrumb.tsx";
import { blockIcons } from "../src/icons.tsx";
import {
  block,
  groups,
  labels,
  starterDocument,
  type Kind,
} from "../src/model.ts";
import { validateDocument } from "../server/index.mjs";

const rect = (top: number, left: number, width: number, height: number) => ({
  top,
  left,
  width,
  height,
});
const pick = (drop: ResolvedDrop | null) =>
  drop && { parent: drop.parent, index: drop.index, mode: drop.mode };

test("insertion index follows the pointer in stacked, inline and wrapped containers", () => {
  const stacked = [
    rect(0, 0, 300, 40),
    rect(50, 0, 300, 40),
    rect(100, 0, 300, 40),
  ];
  assert.equal(insertionIndex(stacked, { x: 10, y: 5 }, false), 0);
  assert.equal(insertionIndex(stacked, { x: 10, y: 35 }, false), 1);
  assert.equal(insertionIndex(stacked, { x: 10, y: 75 }, false), 2);
  assert.equal(insertionIndex(stacked, { x: 10, y: 300 }, false), 3);
  const inline = [
    rect(0, 0, 100, 40),
    rect(0, 110, 100, 40),
    rect(0, 220, 100, 40),
  ];
  assert.equal(insertionIndex(inline, { x: 40, y: 20 }, true), 0);
  assert.equal(insertionIndex(inline, { x: 170, y: 20 }, true), 2);
  assert.equal(insertionIndex(inline, { x: 999, y: 20 }, true), 3);
  // A wrapped second line counts as after every item on the first line.
  const wrapped = [
    rect(0, 0, 100, 40),
    rect(0, 110, 100, 40),
    rect(50, 0, 100, 40),
  ];
  assert.equal(insertionIndex(wrapped, { x: 200, y: 20 }, true), 2);
  assert.equal(insertionIndex(wrapped, { x: 20, y: 60 }, true), 2);
  assert.equal(insertionIndex(wrapped, { x: 90, y: 70 }, true), 3);
});

test("drops resolve from the block under the pointer outwards", () => {
  const leaf = (over: Partial<DropCandidate> = {}): DropCandidate => ({
    id: "text",
    parent: "column",
    index: 1,
    rect: rect(100, 0, 300, 40),
    acceptsChild: false,
    parentAccepts: true,
    parentHorizontal: false,
    horizontal: false,
    children: [],
    ...over,
  });
  const column: DropCandidate = {
    id: "column",
    parent: "row",
    index: 0,
    rect: rect(0, 0, 300, 400),
    acceptsChild: true,
    parentAccepts: true,
    parentHorizontal: true,
    horizontal: false,
    children: [
      rect(20, 0, 300, 40),
      rect(100, 0, 300, 40),
      rect(200, 0, 300, 40),
    ],
  };
  // Leaves split into halves.
  assert.deepEqual(pick(resolveDrop([leaf(), column], { x: 50, y: 110 })), {
    parent: "column",
    index: 1,
    mode: "before",
  });
  assert.deepEqual(pick(resolveDrop([leaf(), column], { x: 50, y: 135 })), {
    parent: "column",
    index: 2,
    mode: "after",
  });
  // A container takes the element inside at the pointer position...
  assert.deepEqual(pick(resolveDrop([column], { x: 150, y: 170 })), {
    parent: "column",
    index: 2,
    mode: "inside",
  });
  // ...unless the pointer is on its edge band, along the parent's flow.
  assert.deepEqual(pick(resolveDrop([column], { x: 3, y: 170 })), {
    parent: "row",
    index: 0,
    mode: "before",
  });
  assert.deepEqual(pick(resolveDrop([column], { x: 296, y: 170 })), {
    parent: "row",
    index: 1,
    mode: "after",
  });
  // Blocks that refuse the element (button captions, locks) defer upwards.
  assert.deepEqual(
    pick(
      resolveDrop(
        [
          leaf({
            id: "caption",
            parent: "button",
            index: 0,
            parentAccepts: false,
          }),
          leaf({ id: "button", rect: rect(100, 0, 120, 40) }),
          column,
        ],
        { x: 100, y: 132 },
      ),
    ),
    { parent: "column", index: 2, mode: "after" },
  );
  assert.equal(
    resolveDrop([leaf({ parentAccepts: false })], { x: 1, y: 101 }),
    null,
  );
  assert.equal(
    acceptsDrop(
      { parent: "b", index: 0, parentKind: "button" },
      { buttonContent: false },
    ),
    false,
  );
  assert.equal(
    acceptsDrop(
      { parent: "b", index: 0, parentKind: "badge" },
      { buttonContent: true },
    ),
    true,
  );
  assert.equal(
    acceptsDrop(
      { parent: "c", index: 0, parentKind: "column" },
      { buttonContent: false },
    ),
    true,
  );
  assert.equal(acceptsDrop(undefined, { buttonContent: true }), false);
});

test("insertion lines sit between neighbours and span the container content", () => {
  const children = [rect(10, 20, 200, 30), rect(60, 20, 260, 30)];
  const between = indicatorFor(rect(0, 0, 400, 120), children, 1, false);
  assert.equal(between.orientation, "horizontal");
  assert.equal(between.top + between.height / 2, 50);
  assert.equal(between.left, 20);
  assert.equal(between.width, 260);
  const end = indicatorFor(rect(0, 0, 400, 120), children, 2, false);
  assert.equal(end.top + end.height / 2, 90);
  const empty = indicatorFor(rect(5, 6, 70, 80), [], 0, false);
  assert.deepEqual(
    { ...empty },
    { top: 5, left: 6, width: 70, height: 80, orientation: "box" },
  );
  const side = indicatorFor(
    rect(0, 0, 400, 50),
    [rect(0, 0, 100, 50), rect(0, 120, 100, 50)],
    1,
    true,
  );
  assert.equal(side.orientation, "vertical");
  assert.equal(side.left + side.width / 2, 110);
  const edge = edgeIndicator(rect(100, 10, 50, 20), "after", false);
  assert.equal(edge.top + edge.height / 2, 120);
  const inlineEdge = edgeIndicator(rect(100, 10, 50, 20), "before", true);
  assert.equal(inlineEdge.left + inlineEdge.width / 2, 10);
});

test("sections dropped on the canvas keep headers first and footers last", () => {
  const header = block("section", { sectionRole: "header" });
  const hero = block("section");
  const footer = block("section", { sectionRole: "footer" });
  const page = { ...starterDocument(), nodes: [header, hero, footer] };
  const middle = block("section");
  assert.deepEqual(
    placeSection(page, middle, 1).nodes.map((n) => n.id),
    [header.id, middle.id, hero.id, footer.id],
  );
  assert.deepEqual(
    placeSection(page, middle, 0).nodes.map((n) => n.id),
    [header.id, middle.id, hero.id, footer.id],
  );
  assert.deepEqual(
    placeSection(page, middle, 99).nodes.map((n) => n.id),
    [header.id, hero.id, middle.id, footer.id],
  );
  const newHeader = block("section", { sectionRole: "header" });
  assert.equal(placeSection(page, newHeader, 2).nodes[0].id, newHeader.id);
  assert.equal(page.nodes.length, 3, "input page is not mutated");
});

test("breadcrumb path lists every ancestor of the selection", () => {
  const heading = block("heading", { html: "Hi" });
  const column = block("column", {}, {}, [heading]);
  const row = block("row", {}, {}, [column]);
  const section = block("section", {}, {}, [row]);
  assert.deepEqual(
    blockPath([block("section"), section], heading.id).map((n) => n.kind),
    ["section", "row", "column", "heading"],
  );
  assert.deepEqual(blockPath([section], "missing"), []);
  assert.deepEqual(blockPath([section], null), []);
});

test("every element kind is in exactly one library group and has its own icon", () => {
  const seen = new Map<Kind, string>();
  for (const group of groups)
    for (const kind of group.kinds) {
      assert.ok(!seen.has(kind), `${kind} is listed twice`);
      seen.set(kind, group.name);
    }
  assert.deepEqual(
    [...seen.keys()].sort(),
    (Object.keys(labels) as Kind[]).sort(),
  );
  const icons = new Set(Object.values(blockIcons));
  // Row/column/box are distinct layout glyphs; every kind gets a dedicated one.
  assert.equal(icons.size, Object.keys(blockIcons).length);
});

test("rich text keeps safe inline links and canonical markup on save", () => {
  const text = (html: string) =>
    validateDocument({
      schemaVersion: 1,
      type: "landing",
      name: "Links",
      nodes: [block("text", { html })],
    }).nodes[0].props.html;
  assert.equal(
    text('Go <a href="https://example.com/shop" onclick="x()">shop</a>'),
    'Go <a href="https://example.com/shop">shop</a>',
  );
  assert.equal(
    text('<a href="https://example.com" target="_blank">new tab</a>'),
    '<a href="https://example.com" target="_blank" rel="noopener noreferrer">new tab</a>',
  );
  assert.equal(
    text('<a href="/pages/about">about</a>'),
    '<a href="/pages/about">about</a>',
  );
  assert.equal(
    text('<a href="javascript:alert(1)">bad</a>'),
    "<span>bad</span>",
  );
  assert.equal(text("<strike>old</strike>"), "<s>old</s>");
  assert.equal(
    text('<span style="color:#dc2626">red</span>'),
    '<span style="color:#dc2626">red</span>',
  );
});
