import {
  cloneBlock,
  findBlock,
  locateBlock,
  insertBlock,
  removeBlock,
  createBlock,
  type Block,
  type PageDocument,
} from "./model";
import { isButtonContent, detachAtomicPart } from "./atomicContent.ts";
export function isLocked(
  nodes: Block[],
  id: string,
  inherited = false,
): boolean {
  for (const n of nodes) {
    const locked = inherited || !!n.props.locked;
    if (n.id === id) return locked;
    if (findBlock(n.children, id)) return isLocked(n.children, id, locked);
  }
  return false;
}
export function rootSelection(nodes: Block[], ids: string[]) {
  return ids.filter(
    (id) =>
      !ids.some(
        (other) =>
          other !== id &&
          !!findBlock(findBlock(nodes, other)?.children || [], id),
      ),
  );
}
export function groupSelection(page: PageDocument, ids: string[]) {
  const roots = rootSelection(page.nodes, ids);
  const places = roots.map((id) => locateBlock(page.nodes, id));
  if (
    roots.length < 2 ||
    places.some((p) => !p || p.parent !== places[0]?.parent) ||
    roots.some((id) => isLocked(page.nodes, id))
  )
    throw new Error(
      "Gruplamak için aynı seviyedeki en az iki kilitsiz öğeyi seç.",
    );
  const parent = places[0]!.parent,
    index = Math.min(...places.map((p) => p!.index));
  const siblings = parent
    ? findBlock(page.nodes, parent)!.children
    : page.nodes;
  const group = createBlock("box");
  group.props.group = true;
  group.name = "Grup";
  // The group takes over its parent's flow (direction, gap, alignment) on
  // every device, so the grouped elements keep their layout.
  const owner = parent ? findBlock(page.nodes, parent) : null;
  const flowKeys = [
    "display",
    "flexDirection",
    "flexWrap",
    "gap",
    "alignItems",
    "justifyContent",
  ];
  for (const device of ["desktop", "tablet", "mobile"] as const) {
    const source = owner?.styles[device] ?? {};
    const flow: Record<string, string | number> = {};
    for (const key of flowKeys)
      if (source[key] !== undefined) flow[key] = source[key];
    if (device === "desktop") {
      flow.display = flow.display ?? "flex";
      flow.flexDirection = flow.flexDirection ?? "column";
      flow.gap = flow.gap ?? "0px";
      if (!String(flow.display).includes("flex") && flow.display !== "grid")
        Object.assign(flow, { display: "flex", flexDirection: "column" });
    }
    const horizontal = String(
      flow.flexDirection ?? group.styles.desktop.flexDirection ?? "column",
    ).startsWith("row");
    if (device === "desktop") flow.width = horizontal ? "auto" : "100%";
    group.styles[device] = flow;
  }
  group.children = siblings.filter((n) => roots.includes(n.id));
  let nodes = page.nodes;
  roots.forEach((id) => (nodes = removeBlock(nodes, id)));
  return {
    page: { ...page, nodes: insertBlock(nodes, parent, index, group) },
    id: group.id,
  };
}
export function ungroupSelection(page: PageDocument, id: string) {
  const group = findBlock(page.nodes, id),
    where = locateBlock(page.nodes, id);
  if (!group?.props.group || !where || isLocked(page.nodes, id))
    throw new Error("Kilitsiz bir grup seç.");
  let nodes = removeBlock(page.nodes, id);
  group.children.forEach(
    (n, i) => (nodes = insertBlock(nodes, where.parent, where.index + i, n)),
  );
  return { ...page, nodes };
}
export function clipboardBlocks(page: PageDocument, ids: string[]) {
  return rootSelection(page.nodes, ids)
    .map((id) => findBlock(page.nodes, id))
    .filter(Boolean) as Block[];
}
export function pasteBlocks(
  page: PageDocument,
  blocks: Block[],
  parent: string | null,
) {
  if (parent && isLocked(page.nodes, parent)) throw new Error("Hedef kilitli.");
  const target = parent && findBlock(page.nodes, parent);
  if (
    target &&
    ["button", "badge"].includes(target.kind) &&
    !blocks.every(isButtonContent)
  )
    throw new Error("Use text, icons or images inside a button.");
  let nodes = page.nodes;
  const ids: string[] = [];
  const clipboardRoot = createBlock("section");
  clipboardRoot.children = blocks;
  cloneBlock(clipboardRoot)
    .children.map((copy) => (copy.props.slot ? detachAtomicPart(copy) : copy))
    .forEach((copy) => {
      ids.push(copy.id);
      nodes = insertBlock(
        nodes,
        parent,
        parent ? findBlock(nodes, parent)?.children.length || 0 : nodes.length,
        copy,
      );
    });
  return { page: { ...page, nodes }, ids };
}

/**
 * Locked elements (and everything inside them) must come out of an edit
 * unchanged and under the same parent. Returns the names of locked
 * elements an edit would change; empty when the edit is allowed.
 */
export function lockedChanges(before: Block[], after: Block[]): string[] {
  const guarded = new Map<
    string,
    { json: string; parent: string | null; name: string }
  >();
  const collect = (nodes: Block[], parent: string | null) =>
    nodes.forEach((n) => {
      if (n.props.locked)
        guarded.set(n.id, { json: JSON.stringify(n), parent, name: n.name });
      else collect(n.children, n.id);
    });
  collect(before, null);
  if (!guarded.size) return [];
  const found = new Map<string, { json: string; parent: string | null }>();
  const scan = (nodes: Block[], parent: string | null) =>
    nodes.forEach((n) => {
      if (guarded.has(n.id))
        found.set(n.id, { json: JSON.stringify(n), parent });
      scan(n.children, n.id);
    });
  scan(after, null);
  return [...guarded.entries()]
    .filter(([id, was]) => {
      const now = found.get(id);
      return !now || now.json !== was.json || now.parent !== was.parent;
    })
    .map(([, was]) => was.name);
}
