import test from "node:test";
import assert from "node:assert/strict";
import { createBlock, acceptsChildren } from "../src/model.ts";
import { panelsFromItems } from "../src/atomicContent.ts";

test("new tabs and carousels are made of panel containers", () => {
  const tabs = createBlock("tabs");
  assert.ok(tabs.children.length >= 2);
  assert.ok(tabs.children.every((panel) => panel.kind === "box"));
  assert.ok(tabs.children.every((panel) => panel.children[0]?.kind === "text"));
  const carousel = createBlock("carousel");
  assert.ok(
    carousel.children.every((slide) => slide.children[0]?.kind === "image"),
  );
  // New elements never become panels by accident.
  assert.equal(acceptsChildren("tabs"), false);
  assert.equal(acceptsChildren("box"), true);
});

test("older text-line tabs keep titles and escaped content", () => {
  const tabs = createBlock("tabs");
  tabs.children = [];
  tabs.props.items = "Care|Wash <cold>\nSize|Fits true";
  const panels = panelsFromItems(tabs);
  assert.deepEqual(
    panels.map((p) => p.props.panelTitle),
    ["Care", "Size"],
  );
  assert.equal(panels[0].children[0].props.html, "Wash &lt;cold&gt;");
});
