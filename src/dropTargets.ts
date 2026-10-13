/**
 * Pure helpers that decide where a dragged element lands on the canvas.
 *
 * The canvas resolves drops from the block under the pointer outwards: a
 * leaf inserts before or after itself (by halves), a container accepts the
 * element inside at the pointer position unless the pointer sits on its edge
 * band, and blocks that cannot take the element hand over to their parent.
 */
export interface DropDescriptor {
  parent: string | null;
  index: number;
  depth?: number;
  target?: "slot" | "inside";
  /** Kind of the block that receives the dropped element. */
  parentKind?: string | null;
}
export interface RectLike {
  top: number;
  left: number;
  width: number;
  height: number;
}
export interface Point {
  x: number;
  y: number;
}

const atomicParents = new Set(["button", "badge"]);

/** Whether a candidate drop target can accept the dragged element. */
export function acceptsDrop(
  target: DropDescriptor | undefined,
  dragged: { kind?: string; buttonContent: boolean },
) {
  if (!target) return false;
  if (target.parentKind && atomicParents.has(target.parentKind))
    return dragged.buttonContent;
  return true;
}

/**
 * Index among the container's children where the pointer would insert.
 * Horizontal containers may wrap, so a later line always counts as "after".
 */
export function insertionIndex(
  children: RectLike[],
  pointer: Point,
  horizontal: boolean,
) {
  for (let i = 0; i < children.length; i++) {
    const r = children[i];
    if (horizontal) {
      if (pointer.y < r.top) return i;
      if (pointer.y <= r.top + r.height && pointer.x < r.left + r.width / 2)
        return i;
    } else if (pointer.y < r.top + r.height / 2) return i;
  }
  return children.length;
}

export interface Indicator {
  top: number;
  left: number;
  width: number;
  height: number;
  orientation: "horizontal" | "vertical" | "box";
}

/** Screen geometry of the insertion line for `index` inside `container`. */
export function indicatorFor(
  container: RectLike,
  children: RectLike[],
  index: number,
  horizontal: boolean,
): Indicator {
  const thickness = 4;
  if (!children.length) return { ...pick(container), orientation: "box" };
  if (horizontal) {
    const before = children[index - 1];
    const after = children[index];
    const anchor = after ?? before!;
    const x = after
      ? before && Math.abs(before.top - after.top) < after.height / 2
        ? (before.left + before.width + after.left) / 2
        : after.left
      : before!.left + before!.width;
    return {
      top: anchor.top,
      left: x - thickness / 2,
      width: thickness,
      height: anchor.height,
      orientation: "vertical",
    };
  }
  const before = children[index - 1];
  const after = children[index];
  const y = after
    ? before
      ? (before.top + before.height + after.top) / 2
      : after.top
    : before!.top + before!.height;
  const left = Math.min(...children.map((r) => r.left));
  const right = Math.max(...children.map((r) => r.left + r.width));
  return {
    top: y - thickness / 2,
    left,
    width: Math.max(24, right - left),
    height: thickness,
    orientation: "horizontal",
  };
}

/** Line on the leading or trailing edge of a single block. */
export function edgeIndicator(
  rect: RectLike,
  side: "before" | "after",
  horizontal: boolean,
): Indicator {
  const thickness = 4;
  if (horizontal)
    return {
      top: rect.top,
      left: (side === "before" ? rect.left : rect.left + rect.width) - 2,
      width: thickness,
      height: rect.height,
      orientation: "vertical",
    };
  return {
    top: (side === "before" ? rect.top : rect.top + rect.height) - 2,
    left: rect.left,
    width: rect.width,
    height: thickness,
    orientation: "horizontal",
  };
}

function pick(rect: RectLike) {
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

/** One block on the path from the pointer's deepest block to the page root. */
export interface DropCandidate {
  id: string;
  /** Parent block id; null for top-level sections. */
  parent: string | null;
  index: number;
  rect: RectLike;
  /** The dragged element may be placed inside this block. */
  acceptsChild: boolean;
  /** The dragged element may be placed next to this block. */
  parentAccepts: boolean;
  /** The parent lays its children out in a row. */
  parentHorizontal: boolean;
  /** This block lays its own children out in a row. */
  horizontal: boolean;
  children: RectLike[];
}
export interface ResolvedDrop {
  parent: string | null;
  index: number;
  mode: "before" | "after" | "inside";
  target: DropCandidate;
}

/** Decide the drop position for a pointer over `chain` (deepest first). */
export function resolveDrop(
  chain: DropCandidate[],
  pointer: Point,
  band = 10,
): ResolvedDrop | null {
  for (const candidate of chain) {
    const { rect } = candidate;
    const along = candidate.parentHorizontal
      ? pointer.x - rect.left
      : pointer.y - rect.top;
    const size = candidate.parentHorizontal ? rect.width : rect.height;
    const before = {
      parent: candidate.parent,
      index: candidate.index,
      mode: "before" as const,
      target: candidate,
    };
    const after = {
      parent: candidate.parent,
      index: candidate.index + 1,
      mode: "after" as const,
      target: candidate,
    };
    if (candidate.acceptsChild) {
      const edge = Math.min(band, size / 4);
      if (candidate.parentAccepts && along < edge) return before;
      if (candidate.parentAccepts && size - along < edge) return after;
      return {
        parent: candidate.id,
        index: insertionIndex(
          candidate.children,
          pointer,
          candidate.horizontal,
        ),
        mode: "inside",
        target: candidate,
      };
    }
    if (candidate.parentAccepts) return along < size / 2 ? before : after;
  }
  return null;
}
