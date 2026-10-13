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
  group.styles.desktop = {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    width: "100%",
  };
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
  let nodes = page.nodes;
  const ids: string[] = [];
  blocks.forEach((b) => {
    const copy = cloneBlock(b);
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
