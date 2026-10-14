// ID-aware cloning for blocks copied on the server (synced sections). Every
// copied element gets a new id, and buttons, links and actions inside the copy
// that pointed at an element of the copy are pointed at the new ids, so
// "open popup", "scroll to" and "#id" links keep working in every page that
// receives the section. Anchor and popup names (cssId, popupId) are kept,
// because visitors and other parts of the page refer to them; only a name the
// receiving page already uses outside the copy is renamed, together with the
// references inside the copy.
const walk = (node, visit) => {
  visit(node);
  for (const child of node.children || []) walk(child, visit);
};
export function cloneWithFreshIds(
  node,
  makeId,
  { rootId, takenAnchors = new Set() } = {},
) {
  const copy = structuredClone(node);
  const ids = new Map();
  walk(copy, (n) => {
    ids.set(n.id, n === copy && rootId ? rootId : makeId());
    for (const key of ["cssId", "popupId"])
      if (n.props?.[key] && takenAnchors.has(String(n.props[key])))
        ids.set(String(n.props[key]), makeId());
  });
  walk(copy, (n) => {
    n.id = ids.get(n.id);
    const props = n.props || (n.props = {});
    for (const key of ["cssId", "popupId"])
      if (props[key] && ids.has(String(props[key])))
        props[key] = ids.get(String(props[key]));
    const target = String(props.actionTarget || "");
    const bare = target.replace(/^#/, "");
    if (ids.has(bare))
      props.actionTarget = (target.startsWith("#") ? "#" : "") + ids.get(bare);
    const href = String(props.href || "");
    if (href.startsWith("#") && ids.has(href.slice(1)))
      props.href = "#" + ids.get(href.slice(1));
  });
  return copy;
}
export function anchorsOutside(nodes, skip) {
  const taken = new Set();
  const visit = (list) => {
    for (const n of list) {
      if (skip(n)) continue;
      if (n.props?.cssId) taken.add(String(n.props.cssId));
      if (n.props?.popupId) taken.add(String(n.props.popupId));
      visit(n.children || []);
    }
  };
  visit(nodes);
  return taken;
}
