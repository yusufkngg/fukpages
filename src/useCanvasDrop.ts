import { t } from "./i18n.ts";
import { useRef, useState, type RefObject } from "react";
import {
  closestCenter,
  pointerWithin,
  type Active,
  type CollisionDetection,
  type DragMoveEvent,
  type DragStartEvent,
  type Modifier,
} from "@dnd-kit/core";
import { isButtonContent } from "./atomicContent.ts";
import { isLocked } from "./editorCommands";
import {
  acceptsDrop,
  edgeIndicator,
  indicatorFor,
  insertionIndex,
  resolveDrop,
  type DropCandidate,
  type Indicator,
  type Point,
} from "./dropTargets";
import {
  findBlock,
  isContainer,
  locateBlock,
  type Block,
  type PageDocument,
} from "./model";

export interface DropPlan {
  parent: string | null;
  index: number;
  /** Section drags only reorder top-level page sections. */
  section: boolean;
}
/** `gap` is the spacing (CSS px) the receiving layout keeps between items. */
export type DropIndicator = Indicator & { label: string; gap?: number };

const surfaceSelector = ".editable-surface";

/** Keep the small drag chip just below-right of the cursor. */
export const chipFollowsCursor: Modifier = ({
  activatorEvent,
  activeNodeRect,
  transform,
}) => {
  const start = activatorEvent as PointerEvent | null;
  if (!start || typeof start.clientX !== "number" || !activeNodeRect)
    return transform;
  return {
    ...transform,
    x: transform.x + start.clientX - activeNodeRect.left + 14,
    y: transform.y + start.clientY - activeNodeRect.top + 14,
  };
};

function pointerOf(event: { activatorEvent: Event | null; delta: Point }) {
  const start = event.activatorEvent as PointerEvent | MouseEvent | null;
  if (!start || typeof start.clientX !== "number") return null;
  return { x: start.clientX + event.delta.x, y: start.clientY + event.delta.y };
}
function contains(rect: DOMRect | undefined, point: Point, margin = 0) {
  return (
    !!rect &&
    point.x >= rect.left - margin &&
    point.x <= rect.right + margin &&
    point.y >= rect.top - margin &&
    point.y <= rect.bottom + margin
  );
}
/** Blocks whose nearest block ancestor is `container` (skips wrappers). */
function childBlocks(container: Element) {
  return [...container.querySelectorAll<HTMLElement>("[data-node-id]")].filter(
    (element) => element.parentElement?.closest("[data-node-id]") === container,
  );
}
/** Spacing between items of a flex/grid frame along its flow, in CSS px. */
function frameGap(frame: Element | null | undefined) {
  if (!frame) return undefined;
  const style = getComputedStyle(frame);
  if (!/flex|grid/.test(style.display)) return undefined;
  const value = parseFloat(rowFlow(frame) ? style.columnGap : style.rowGap);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : undefined;
}
function rowFlow(frame: Element | null | undefined) {
  if (!frame) return false;
  const style = getComputedStyle(frame);
  if (style.display.includes("grid")) return true;
  return (
    style.display.includes("flex") && style.flexDirection.startsWith("row")
  );
}
const markTarget = (id: string | null) => {
  for (const element of document.querySelectorAll("[data-drop-target]"))
    if (element.getAttribute("data-node-id") !== id)
      element.removeAttribute("data-drop-target");
  if (id)
    document
      .querySelector(`${surfaceSelector} [data-node-id="${CSS.escape(id)}"]`)
      ?.setAttribute("data-drop-target", "");
};

/**
 * Drag-and-drop targeting for the canvas. Positions are resolved from the
 * block under the pointer (the same coordinates the user sees), so the
 * insertion line and the final drop always agree.
 */
export function useCanvasDrop(pageRef: RefObject<PageDocument | null>) {
  const [indicator, setIndicator] = useState<DropIndicator | null>(null);
  const plan = useRef<DropPlan | null>(null);
  const drag = useRef<{
    buttonContent: boolean;
    section: boolean;
    node?: Block;
  }>({ buttonContent: true, section: false });

  const describe = (active: Active) => {
    const data = active.data.current ?? {};
    const nodes = pageRef.current?.nodes ?? [];
    if (data.sectionPresetId)
      return { buttonContent: false, section: true } as const;
    if (data.kind)
      return {
        buttonContent: isButtonContent({
          kind: String(data.kind),
          children: [],
        } as unknown as Block),
        section: false,
      };
    const node = findBlock(nodes, String(data.nodeId ?? ""));
    return {
      buttonContent: node ? isButtonContent(node) : false,
      section:
        node?.kind === "section" &&
        locateBlock(nodes, node.id)?.parent === null,
      node,
    };
  };

  /** dnd-kit only resolves drops on the floating layer tree. */
  const collision: CollisionDetection = (args) => {
    if (!args.pointerCoordinates) return closestCenter(args);
    const layers = document
      .querySelector(".floating-layer-panel")
      ?.getBoundingClientRect();
    if (!contains(layers, args.pointerCoordinates)) return [];
    return pointerWithin(args)
      .filter((hit) => {
        const id = String(hit.id);
        return id.startsWith("layers:") || id.startsWith("layer-inside:");
      })
      .sort((a, b) => {
        const ar = args.droppableRects.get(a.id),
          br = args.droppableRects.get(b.id);
        return (
          (ar ? ar.width * ar.height : Infinity) -
          (br ? br.width * br.height : Infinity)
        );
      });
  };

  const onDragStart = (event: DragStartEvent) => {
    drag.current = describe(event.active);
    plan.current = null;
    setIndicator(null);
  };

  const nameOf = (id: string | null) =>
    (id && findBlock(pageRef.current?.nodes ?? [], id)?.name) || t("Sayfa");

  const clear = () => {
    plan.current = null;
    markTarget(null);
    setIndicator(null);
  };

  const onDragMove = (event: DragMoveEvent) => {
    const pointer = pointerOf(event);
    const surface = document.querySelector(surfaceSelector);
    if (!pointer || !surface) return clear();
    const layers = document
      .querySelector(".floating-layer-panel")
      ?.getBoundingClientRect();
    if (contains(layers, pointer)) return clear();
    const bounds = surface.getBoundingClientRect();
    if (drag.current.section) return planSection(surface, bounds, pointer);
    if (!contains(bounds, pointer)) return clear();
    const nodes = pageRef.current?.nodes ?? [];
    if (!nodes.length) {
      plan.current = { parent: null, index: 0, section: false };
      markTarget(null);
      const empty = surface.querySelector(".empty-page") ?? surface;
      return setIndicator({
        ...indicatorFor(empty.getBoundingClientRect(), [], 0, false),
        label: t("Sayfa"),
      });
    }
    const resolved = resolveDrop(chainAt(surface, pointer, nodes), pointer);
    if (!resolved) return planRoot(surface, pointer);
    plan.current = {
      parent: resolved.parent,
      index: resolved.index,
      section: false,
    };
    const target = resolved.target;
    if (resolved.mode === "inside") {
      markTarget(target.id);
      return setIndicator({
        ...indicatorFor(
          target.rect,
          target.children,
          resolved.index,
          target.horizontal,
        ),
        label: target.children.length ? "" : nameOf(target.id),
        gap: target.children.length ? target.gap : undefined,
      });
    }
    // Outline the receiving container (labelled) and draw the line.
    markTarget(resolved.parent);
    setIndicator({
      ...edgeIndicator(target.rect, resolved.mode, target.parentHorizontal),
      label: resolved.parent ? "" : t("Sayfa"),
      gap: target.parentGap,
    });
  };

  /** Path from the deepest block under the pointer up to its section. */
  const chainAt = (surface: Element, pointer: Point, nodes: Block[]) => {
    const dragged = drag.current;
    let element = document
      .elementsFromPoint(pointer.x, pointer.y)
      .find(
        (item): item is HTMLElement =>
          item instanceof HTMLElement &&
          item.hasAttribute("data-node-id") &&
          surface.contains(item),
      );
    // Never target the moved element's own subtree; use the element itself.
    const moving = dragged.node;
    if (element && moving) {
      const own = element.closest<HTMLElement>(
        `[data-node-id="${CSS.escape(moving.id)}"]`,
      );
      if (own) element = own;
    }
    const chain: DropCandidate[] = [];
    while (element && surface.contains(element)) {
      const id = element.dataset.nodeId!;
      const node = findBlock(nodes, id);
      const where = locateBlock(nodes, id);
      if (!node || !where) break;
      const parentNode = where.parent ? findBlock(nodes, where.parent) : null;
      const children = childBlocks(element);
      chain.push({
        id,
        parent: where.parent,
        index: where.index,
        rect: element.getBoundingClientRect(),
        acceptsChild:
          isContainer(node.kind) &&
          node.id !== moving?.id &&
          !isLocked(nodes, node.id) &&
          acceptsDrop({ parent: id, index: 0, parentKind: node.kind }, dragged),
        parentAccepts:
          !(where.parent && isLocked(nodes, where.parent)) &&
          acceptsDrop(
            {
              parent: where.parent,
              index: where.index,
              parentKind: parentNode?.kind ?? null,
            },
            dragged,
          ),
        parentHorizontal: rowFlow(element.parentElement),
        horizontal: rowFlow(children[0]?.parentElement),
        children: children.map((child) => child.getBoundingClientRect()),
        gap: frameGap(children[0]?.parentElement),
        parentGap: frameGap(element.parentElement),
      });
      element =
        element.parentElement?.closest<HTMLElement>("[data-node-id]") ??
        undefined;
    }
    return chain;
  };

  /** Pointer between top-level blocks: insert at the page root. */
  const planRoot = (surface: Element, pointer: Point) => {
    const nodes = pageRef.current?.nodes ?? [];
    const blocks = [
      ...surface.querySelectorAll<HTMLElement>(":scope > [data-node-id]"),
    ];
    const rects = blocks.map((block) => block.getBoundingClientRect());
    const position = insertionIndex(rects, pointer, false);
    const index =
      position < blocks.length
        ? nodes.findIndex((node) => node.id === blocks[position].dataset.nodeId)
        : nodes.length;
    plan.current = { parent: null, index: Math.max(0, index), section: false };
    markTarget(null);
    const bounds = surface.getBoundingClientRect();
    setIndicator({
      ...indicatorFor(bounds, rects, position, false),
      left: bounds.left,
      width: bounds.width,
      label: t("Sayfa"),
    });
  };

  /** Sections are placed between top-level sections only. */
  const planSection = (surface: Element, bounds: DOMRect, pointer: Point) => {
    if (
      pointer.x < bounds.left ||
      pointer.x > bounds.right ||
      pointer.y < bounds.top - 60 ||
      pointer.y > bounds.bottom + 60
    )
      return clear();
    const nodes = pageRef.current?.nodes ?? [];
    const sections = [
      ...surface.querySelectorAll<HTMLElement>(":scope > [data-node-id]"),
    ];
    const rects = sections.map((section) => section.getBoundingClientRect());
    const position = insertionIndex(rects, pointer, false);
    const index =
      position < sections.length
        ? nodes.findIndex(
            (node) => node.id === sections[position].dataset.nodeId,
          )
        : nodes.length;
    plan.current = { parent: null, index: Math.max(0, index), section: true };
    markTarget(null);
    setIndicator({
      ...indicatorFor(bounds, rects, position, false),
      left: bounds.left,
      width: bounds.width,
      label: t("Bölüm"),
    });
  };

  const reset = () => {
    clear();
    drag.current = { buttonContent: true, section: false };
  };

  return { indicator, plan, collision, onDragStart, onDragMove, reset };
}
