import { test } from "node:test";
import assert from "node:assert/strict";
import { applySelection, modeFor } from "../src/selection.ts";
import {
  groupSelection,
  lockedChanges,
  ungroupSelection,
} from "../src/editorCommands.ts";
import { insideDrop, type DropCandidate } from "../src/dropTargets.ts";
import { block, findBlock, starterDocument } from "../src/model.ts";

test("one selection model: click replaces, Shift adds, Ctrl/Cmd toggles", () => {
  let state = applySelection({ primary: null, ids: [] }, "a");
  assert.deepEqual(state, { primary: "a", ids: ["a"] });
  state = applySelection(state, "b", modeFor({ shiftKey: true }));
  assert.deepEqual(state, { primary: "b", ids: ["a", "b"] });
  state = applySelection(state, "b", modeFor({ shiftKey: true }));
  assert.deepEqual(state.ids, ["a", "b"], "Shift never removes");
  state = applySelection(state, "c", modeFor({ ctrlKey: true }));
  assert.deepEqual(state, { primary: "c", ids: ["a", "b", "c"] });
  state = applySelection(state, "c", modeFor({ metaKey: true }));
  assert.deepEqual(state, { primary: "b", ids: ["a", "b"] });
  // A primary chosen elsewhere (keyboard, breadcrumb) joins the set.
  state = applySelection({ primary: "x", ids: [] }, "y", "add");
  assert.deepEqual(state.ids, ["x", "y"]);
  assert.deepEqual(applySelection(state, "z"), { primary: "z", ids: ["z"] });
});

test("locked elements and everything inside them stay unchanged", () => {
  const child = block("text", { html: "Inside" });
  const locked = block("box", { locked: true }, {}, [child]);
  const free = block("text", { html: "Free" });
  const section = block("section", {}, {}, [locked, free]);
  const nodes = [section];
  const clone = () => structuredClone(nodes);
  const edit = (change: (n: typeof nodes) => void) => {
    const next = clone();
    change(next);
    return lockedChanges(nodes, next);
  };
  assert.deepEqual(
    edit((n) => (n[0].children[1].props.html = "Edited")),
    [],
  );
  assert.deepEqual(
    edit((n) => n[0].children.unshift(block("text"))),
    [],
    "siblings may move around a locked block",
  );
  assert.ok(
    edit((n) => (n[0].children[0].children[0].props.html = "x")).length,
  );
  assert.ok(edit((n) => n[0].children[0].children.push(block("text"))).length);
  assert.ok(
    edit((n) => (n[0].children[0].styles.desktop.width = "1px")).length,
  );
  assert.ok(edit((n) => n[0].children.splice(0, 1)).length, "no delete");
  assert.ok(
    edit((n) => {
      const [moved] = n[0].children.splice(0, 1);
      n.push(block("section", {}, {}, [moved]));
    }).length,
    "no move to another parent",
  );
});

test("drops land next to the right sibling despite hidden children and reversed rows", () => {
  const rect = (left: number) => ({ top: 0, left, width: 100, height: 40 });
  const base: DropCandidate = {
    id: "row",
    parent: null,
    index: 0,
    rect: { top: 0, left: 0, width: 400, height: 40 },
    acceptsChild: true,
    parentAccepts: false,
    parentHorizontal: false,
    horizontal: true,
    children: [],
  };
  // Model: a, hidden, b, c — only a, b, c are rendered.
  const model = ["a", "hidden", "b", "c"];
  const shown = insideDrop(
    {
      ...base,
      children: [rect(0), rect(100), rect(200)],
      childIds: ["a", "b", "c"],
      modelChildren: model,
    },
    { x: 140, y: 20 },
  );
  assert.equal(
    shown.index,
    model.indexOf("b"),
    "before b, after the hidden child",
  );
  // row-reverse: DOM order a, b, c but painted c, b, a.
  const reversed = insideDrop(
    {
      ...base,
      children: [rect(200), rect(100), rect(0)],
      childIds: ["a", "b", "c"],
      modelChildren: ["a", "b", "c"],
    },
    { x: 30, y: 20 },
  );
  assert.equal(reversed.index, 2, "left of c (painted first) is before c");
  assert.equal(reversed.visual.index, 0);
  const end = insideDrop(
    {
      ...base,
      children: [rect(0)],
      childIds: ["a"],
      modelChildren: ["a", "z"],
    },
    { x: 390, y: 20 },
  );
  assert.equal(end.index, 1, "after the last shown child");
});

test("grouping keeps the parent's flow on every device and ungroup restores it", () => {
  const a = block("button"),
    b = block("button");
  const row = block(
    "row",
    {},
    {
      display: "flex",
      flexDirection: "row",
      gap: "24px",
      alignItems: "center",
    },
    [a, b, block("text")],
  );
  row.styles.mobile = { flexDirection: "column", gap: "8px" };
  const page = {
    ...starterDocument(),
    nodes: [block("section", {}, {}, [row])],
  };
  const grouped = groupSelection(page, [a.id, b.id]);
  const group = findBlock(grouped.page.nodes, grouped.id)!;
  assert.equal(group.styles.desktop.flexDirection, "row");
  assert.equal(group.styles.desktop.gap, "24px");
  assert.equal(group.styles.desktop.alignItems, "center");
  assert.equal(group.styles.desktop.width, "auto");
  assert.equal(group.styles.mobile.flexDirection, "column");
  assert.equal(group.styles.mobile.gap, "8px");
  assert.deepEqual(
    ungroupSelection(grouped.page, grouped.id).nodes,
    page.nodes,
  );
});
