import { t } from "./i18n.ts";
import { cloneBlock, mapBlock, type Block, type Device } from "./model";
import { createSectionPreset, sectionPresets } from "./sections";
const layoutKeys = new Set([
  "display",
  "flexDirection",
  "justifyContent",
  "alignItems",
  "flexWrap",
  "gap",
  "textAlign",
  "width",
  "maxWidth",
  "minHeight",
  "gridTemplateColumns",
  "paddingTop",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
]);
export const familyOf = (id: string) =>
  /^(product-hero|centered-hero)/.test(id)
    ? "hero"
    : id.replace(/-(alternate|compact)$/, "");
export function compatibleLayouts(section: Block) {
  return sectionPresets.filter(
    (p) => familyOf(p.id) === familyOf(String(section.props.presetId || "")),
  );
}
const flatten = (node: Block): Block[] => [
  node,
  ...node.children.flatMap(flatten),
];
/** Change geometry without replacing user content, IDs, actions or bindings. */
export function changeSectionLayout(source: Block, presetId: string): Block {
  const target = createSectionPreset(presetId);
  if (!target || !compatibleLayouts(source).some((p) => p.id === presetId))
    return source;
  const next = structuredClone(source),
    templates = flatten(target),
    used = new Set<string>();
  for (const node of flatten(next)) {
    const template = templates.find(
      (t) => t.kind === node.kind && !used.has(t.id),
    );
    if (!template) continue;
    used.add(template.id);
    for (const device of ["desktop", "tablet", "mobile"] as Device[]) {
      for (const [key, value] of Object.entries(template.styles[device]))
        if (layoutKeys.has(key)) node.styles[device][key] = value;
    }
    for (const prop of ["view", "moving"])
      if (template.props[prop] !== undefined)
        node.props[prop] = template.props[prop];
  }
  const mainRow = flatten(next).find(
    (n) => n.kind === "row" && n.children.length >= 2,
  );
  if (mainRow && familyOf(presetId) === "hero") {
    const centered = presetId.startsWith("centered-hero");
    mainRow.styles.desktop.flexDirection = centered
      ? "column"
      : presetId.endsWith("alternate")
        ? "row-reverse"
        : "row";
    mainRow.styles.desktop.alignItems = "center";
    mainRow.styles.desktop.textAlign = centered ? "center" : "left";
    mainRow.styles.tablet.flexDirection = centered
      ? "column"
      : mainRow.styles.desktop.flexDirection;
    mainRow.styles.mobile.flexDirection = "column";
    for (const child of mainRow.children) {
      child.styles.desktop.width = centered ? "100%" : "50%";
      delete child.styles.desktop.flexBasis;
      child.styles.tablet.width = centered ? "100%" : "50%";
      child.styles.mobile.width = "100%";
      child.styles.mobile.flexBasis = "auto";
    }
  }
  next.props.presetId = presetId;
  return next;
}
export function repeatedGroups(section: Block) {
  return flatten(section).filter(
    (n) =>
      n.kind === "row" &&
      n.children.length > 0 &&
      n.children.every((c) => c.kind === n.children[0].kind) &&
      ["box", "column", "product", "image", "video"].includes(
        n.children[0].kind,
      ),
  );
}
export function cardFields(card: Block) {
  return flatten(card).flatMap((n) => {
    const prop =
      n.kind === "heading" || n.kind === "text"
        ? "html"
        : n.kind === "image"
          ? "src"
          : n.kind === "button"
            ? "text"
            : n.kind === "product"
              ? "title"
              : null;
    return prop
      ? [{ id: n.id, prop, name: n.name, value: String(n.props[prop] || "") }]
      : [];
  });
}
export function changeCard(
  section: Block,
  groupId: string,
  index: number,
  action: "up" | "down" | "copy" | "remove",
) {
  return {
    ...section,
    children: mapBlock(section.children, groupId, (group) => {
      const children = [...group.children];
      if (action === "copy" && children[index])
        children.splice(index + 1, 0, cloneBlock(children[index]));
      if (action === "remove" && children.length > 1) children.splice(index, 1);
      const other = index + (action === "up" ? -1 : 1);
      if ((action === "up" || action === "down") && children[other])
        [children[index], children[other]] = [children[other], children[index]];
      return { ...group, children };
    }),
  };
}
export function sectionDependencies(section: Block) {
  const nodes = flatten(section),
    messages: string[] = [];
  if (
    nodes.some(
      (n) =>
        [
          "productField",
          "productGallery",
          "variantPicker",
          "quantity",
          "addToCart",
          "stickyCart",
          "bundle",
        ].includes(n.kind) &&
        !n.props.productId &&
        !n.props.productIds &&
        !section.props.productId,
    )
  )
    messages.push(t("Yerel katalogdan ürün seçilmeli."));
  if (nodes.some((n) => n.kind === "collectionGrid" && !n.props.collectionId))
    messages.push(t("Koleksiyon seçilmeli veya tüm ürünler kullanılmalı."));
  if (nodes.some((n) => n.kind === "appEmbed"))
    messages.push(t("Uygulama sağlayıcısı yapılandırılmalı."));
  if (nodes.some((n) => n.kind === "image" && !n.props.src))
    messages.push(t("Eksik görsel eklenmeli."));
  if (nodes.some((n) => n.kind === "video" || n.kind === "videoPopup"))
    messages.push(t("Video kaynağını kontrol et."));
  return messages;
}
