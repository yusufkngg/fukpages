import { test } from "node:test";
import assert from "node:assert/strict";
import { createSectionPreset, sectionPresets } from "../src/sections";
import {
  compatibleLayouts,
  changeSectionLayout,
  repeatedGroups,
  changeCard,
} from "../src/sectionDesign";
import { cloneBlock, block, type Block } from "../src/model";
import { validateDocument } from "../server/index.mjs";
const all = (n: Block): Block[] => [n, ...n.children.flatMap(all)];

test("switching every compatible layout retains all user content, IDs, actions and device visibility", () => {
  for (const preset of sectionPresets) {
    const source = createSectionPreset(preset.id)!;
    for (const n of all(source)) {
      if (n.kind === "heading" || n.kind === "text")
        n.props.html = "Türkçe içerik İ ı Ş ş Ğ ğ Ç ç Ö ö Ü ü " + n.id;
      if (n.kind === "image") n.props.src = "/assets/headphones.svg";
      if (n.kind === "button") {
        n.props.text = "Kendi butonum";
        n.props.href = "/my-link";
      }
    }
    for (const target of compatibleLayouts(source)) {
      const changed = changeSectionLayout(source, target.id);
      const before = all(source),
        after = all(changed);
      assert.deepEqual(
        after.map((n) => n.id),
        before.map((n) => n.id),
      );
      assert.deepEqual(
        after.map((n) => ({
          ...n.props,
          presetId: undefined,
          view: undefined,
          moving: undefined,
        })),
        before.map((n) => ({
          ...n.props,
          presetId: undefined,
          view: undefined,
          moving: undefined,
        })),
      );
      assert.deepEqual(
        after.map((n) => n.hidden),
        before.map((n) => n.hidden),
      );
      assert.doesNotThrow(() =>
        validateDocument({
          schemaVersion: 1,
          type: "landing",
          name: "Switch",
          nodes: [changed],
        }),
      );
    }
  }
});

test("card editing supports duplication, ordering and removal without changing other cards or internal popup links", () => {
  const source = createSectionPreset("testimonials")!,
    group = repeatedGroups(source)[0];
  const copied = changeCard(source, group.id, 0, "copy");
  const cards = repeatedGroups(copied)[0].children;
  assert.equal(cards.length, 4);
  assert.notEqual(cards[0].id, cards[1].id);
  assert.deepEqual(cards[0].props, cards[1].props);
  assert.equal(
    repeatedGroups(changeCard(copied, group.id, 1, "up"))[0].children[0].id,
    cards[1].id,
  );
  assert.equal(
    repeatedGroups(changeCard(copied, group.id, 1, "remove"))[0].children
      .length,
    3,
  );
  const popup = block("popup", { popupId: "user-popup" }, {}, [block("text")]);
  const section = block("section", {}, {}, [
    block("button", { action: "popupOpen", actionTarget: popup.id }),
    popup,
  ]);
  const clone = cloneBlock(section);
  assert.equal(clone.children[0].props.actionTarget, clone.children[1].id);
  assert.notEqual(clone.children[1].props.popupId, popup.props.popupId);
});
