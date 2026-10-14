import type { Block, PageDocument, Styles } from "./model.ts";
import { t } from "./i18n.ts";
import { vectorIconProps } from "./vectorIcons.ts";

const iconPattern = /[★☆♥♡✓✔✦✧∞⚡→←↑↓↗↘↙↖●○✚✕☀☁♣♦☕♫✈❝◷✂]\uFE0F?/gu;
const inlineTags = new Set(["b", "strong", "i", "em", "u", "s", "p", "span"]);
const inherited: Styles = {
  fontFamily: "inherit",
  fontSize: "inherit",
  fontWeight: "inherit",
  lineHeight: "inherit",
  color: "inherit",
  letterSpacing: "inherit",
  textAlign: "inherit",
  width: "auto",
  minWidth: "0px",
};
const horizontal: Styles = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "8px",
  width: "fit-content",
  maxWidth: "100%",
};
export const make = (
  kind: Block["kind"],
  props: Block["props"],
  styles: Styles = {},
  children: Block[] = [],
): Block => ({
  id: crypto.randomUUID(),
  kind,
  name: t(
    (
      {
        row: "Row",
        itemList: "Item List",
        icon: "Icon",
        text: "Text block",
        heading: "Heading",
      } as Record<string, string>
    )[kind] || kind,
  ),
  props: { ...props },
  // Each block gets its own style object: shared constants (panelStyles…)
  // must never be mutated through one block into another or into a page.
  styles: { desktop: { ...styles }, tablet: {}, mobile: {} },
  hidden: { desktop: false, tablet: false, mobile: false },
  children,
});
export const escapeMarkup = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const plainMarkup = (value: string) =>
  value
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
type Fragment = { kind: "text" | "icon"; value: string; styles: Styles };

/** Split only text nodes; markup attributes, links and authored formatting stay intact. */
export function contentFragments(html: string): Fragment[] {
  const fragments: Fragment[] = [],
    stack: { name: string; open: string; styles: Styles }[] = [];
  let buffer = "",
    started = false;
  const begin = () => {
    if (!started) {
      buffer = stack.map((s) => s.open).join("");
      started = true;
    }
  };
  const flush = () => {
    if (started) {
      const value =
        buffer +
        [...stack]
          .reverse()
          .map((s) => `</${s.name}>`)
          .join("");
      if (plainMarkup(value))
        fragments.push({ kind: "text", value, styles: {} });
    }
    buffer = "";
    started = false;
  };
  for (const token of html.match(/<[^>]*>|[^<]+/g) || []) {
    if (token.startsWith("<")) {
      const tag = /^<\/?([a-z][\w-]*)/i.exec(token)?.[1]?.toLowerCase();
      if (tag === "br") {
        begin();
        buffer += token;
        continue;
      }
      if (!tag || !inlineTags.has(tag)) {
        begin();
        buffer += token;
        continue;
      }
      if (token.startsWith("</")) {
        if (started) buffer += token;
        const at = stack.map((s) => s.name).lastIndexOf(tag);
        if (at >= 0) stack.splice(at);
      } else {
        if (started) buffer += token;
        const styles: Styles = {};
        if (["b", "strong"].includes(tag)) styles.fontWeight = "700";
        if (["i", "em"].includes(tag)) styles.fontStyle = "italic";
        if (tag === "u") styles.textDecoration = "underline";
        const css = /style\s*=\s*["']([^"']*)["']/i.exec(token)?.[1] || "";
        for (const [key, value] of css.split(";").map((v) => v.split(":"))) {
          if (
            key?.trim() === "color" &&
            /^#[a-f0-9]{3,8}$/i.test(value?.trim())
          )
            styles.color = value.trim();
          if (
            key?.trim() === "font-weight" &&
            /^(bold|[1-9]00)$/.test(value?.trim())
          )
            styles.fontWeight = value.trim();
        }
        stack.push({ name: tag, open: token, styles });
      }
      continue;
    }
    // Legacy menus used runs of non-breaking spaces as their only item boundaries.
    const text = token.replace(
      /&#(x[\da-f]+|\d+);/gi,
      (entity, code: string) => {
        const number = code.toLowerCase().startsWith("x")
          ? parseInt(code.slice(1), 16)
          : Number(code);
        if (number === 160) return "&nbsp;";
        if (!Number.isInteger(number) || number < 0 || number > 0x10ffff)
          return entity;
        const glyph = String.fromCodePoint(number);
        return new RegExp(`^${iconPattern.source}$`, "u").test(glyph)
          ? glyph
          : entity;
      },
    );
    const pattern = new RegExp(
      `${iconPattern.source}|(?:&nbsp;){2,}|\u00a0{2,}`,
      "gu",
    );
    let offset = 0;
    for (const match of text.matchAll(pattern)) {
      begin();
      buffer += text.slice(offset, match.index);
      flush();
      if (!match[0].startsWith("&nbsp;") && !match[0].startsWith("\u00a0"))
        fragments.push({
          kind: "icon",
          value: match[0],
          styles: Object.assign({}, ...stack.map((s) => s.styles)),
        });
      offset = match.index! + match[0].length;
    }
    begin();
    buffer += text.slice(offset);
  }
  flush();
  return fragments;
}
const textNode = (html: string, slot?: string) =>
  make("text", { html, ...(slot ? { slot } : {}) }, { ...inherited });
/** An icon block from a library name ("check") or an older text symbol. */
const iconNode = (glyph: string, styles: Styles = {}) =>
  make("icon", vectorIconProps(glyph) ?? { text: glyph }, {
    ...inherited,
    display: "inline-flex",
    width: "fit-content",
    lineHeight: "1",
    flexShrink: "0",
    ...styles,
  });
export function createItemList(
  text = t("Describe a benefit"),
  icon = "check",
): Block {
  return make(
    "itemList",
    { atomicContent: true },
    { ...horizontal, flexWrap: "nowrap", gap: "8px", fontSize: "16px" },
    [iconNode(icon), textNode(escapeMarkup(text), "itemText")],
  );
}

function expandMarkup(node: Block): Block {
  const html = String(node.props.html || ""),
    fragments = contentFragments(html);
  if (fragments.length <= 1 && !fragments.some((f) => f.kind === "icon"))
    return node;
  // Bound expansion; keep oversized or block-rich user content as it was.
  if (
    fragments.length > 80 ||
    /<(?!\/?(?:b|strong|i|em|u|s|p|span|br)\b)[a-z]/i.test(html)
  )
    return node;
  const childKind = node.kind;
  const children = fragments.map((fragment) =>
    fragment.kind === "icon"
      ? iconNode(fragment.value, fragment.styles)
      : make(
          childKind,
          {
            html: fragment.value,
            ...(node.kind === "heading" ? { tag: node.props.tag || "h2" } : {}),
            ...(node.props.globalDetached ? { globalDetached: true } : {}),
          },
          { ...inherited },
        ),
  );
  // Carry each translated label to its own text/icon element, without changing languages.
  try {
    const translations = JSON.parse(String(node.props.translations || "{}"));
    for (const [locale, fields] of Object.entries(translations) as [
      string,
      Record<string, unknown>,
    ][]) {
      if (typeof fields.html !== "string") continue;
      const translated = contentFragments(fields.html);
      const positions = { text: 0, icon: 0 };
      children.forEach((child, i) => {
        const kind = fragments[i].kind,
          next = translated.filter((f) => f.kind === kind)[positions[kind]++];
        const current = JSON.parse(String(child.props.translations || "{}"));
        delete current[locale];
        if (next)
          current[locale] = { [kind === "text" ? "html" : "text"]: next.value };
        child.props.translations = JSON.stringify(current);
      });
    }
  } catch {
    /* The server validator handles malformed translations. */
  }
  const props: Block["props"] = { ...node.props, atomicContent: true };
  delete props.html;
  delete props.tag;
  delete props.translations;
  const typography: Styles =
    node.kind === "heading"
      ? { fontFamily: "var(--font-heading)", fontWeight: "700" }
      : {};
  return {
    ...node,
    kind: "row",
    name: node.name || t("Row"),
    props,
    children,
    styles: {
      ...node.styles,
      desktop: {
        ...horizontal,
        ...typography,
        ...node.styles.desktop,
        display: node.styles.desktop.display === "none" ? "none" : "flex",
        flexDirection: "row",
        gap:
          node.styles.desktop.gap ??
          (fragments.some((f) => f.kind === "icon") ? "4px" : "20px"),
      },
      tablet: { ...node.styles.tablet },
      mobile: { ...node.styles.mobile, flexDirection: "row", flexWrap: "wrap" },
    },
  };
}

export function setCaption(node: Block, caption: string): Block {
  const fragments = contentFragments(escapeMarkup(caption));
  const html = fragments
    .filter((f) => f.kind === "text")
    .map((f) => f.value)
    .join(" ")
    .trim();
  const oldLabels = node.children.filter((n) =>
    String(n.props.slot || "").startsWith("caption"),
  );
  const oldIcons = node.children.filter((n) => n.props.slot === "captionIcon");
  const glyphs = fragments.filter((f) => f.kind === "icon");
  let labelIndex = 0,
    iconIndex = 0;
  const children = fragments.map((fragment) => {
    if (fragment.kind === "icon") {
      const old = oldIcons[iconIndex++];
      return old
        ? {
            ...old,
            props: {
              ...old.props,
              text: fragment.value,
              src: "",
              icon: "",
              iconNode: "",
            },
          }
        : {
            ...iconNode(fragment.value),
            props: { text: fragment.value, slot: "captionIcon" },
          };
    }
    const old = oldLabels[labelIndex],
      slot = labelIndex++ ? "caption" + labelIndex : "caption";
    return old
      ? {
          ...old,
          kind: "text" as const,
          props: { ...old.props, html: fragment.value, slot },
          children: [],
        }
      : textNode(fragment.value, slot);
  });
  if (!glyphs.length) {
    if (node.children[0]?.kind === "icon") children.unshift(...oldIcons);
    else children.push(...oldIcons);
  }
  node.children.forEach((child, index) => {
    if (!String(child.props.slot || "").startsWith("caption"))
      children.splice(Math.min(index, children.length), 0, child);
  });
  return {
    ...node,
    props: { ...node.props, atomicContent: true, text: plainMarkup(html) },
    children,
  };
}
export const panelStyles: Styles = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  width: "100%",
  paddingTop: "20px",
  paddingRight: "4px",
  paddingBottom: "8px",
  paddingLeft: "4px",
};
/**
 * Tabs and carousels keep their panels as child blocks. Older blocks stored
 * them as "Title|content" lines and image lists; those become panels once.
 */
export function panelsFromItems(node: Block): Block[] {
  const lines = (value: unknown) =>
    String(value ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  if (node.kind === "tabs") {
    const items = lines(node.props.items);
    return (items.length ? items : [t("Sekme")]).map((item) => {
      const [title, ...rest] = item.split("|");
      const content =
        rest.join("|").trim() ||
        String(node.props.description || t("Sekme içeriği"));
      return {
        ...make("box", { panelTitle: title.trim() }, panelStyles, [
          make("text", { html: escapeMarkup(content) }, { fontSize: "16px" }),
        ]),
        name: title.trim() || t("Sekme"),
      };
    });
  }
  const images = lines(node.props.images),
    captions = lines(node.props.items);
  return Array.from({ length: Math.max(1, images.length) }, (_, index) => {
    const caption = captions[index] ?? "";
    const slide = make(
      "box",
      { panelTitle: t("Slayt {p0}", { p0: index + 1 }) },
      { ...panelStyles, alignItems: "center", textAlign: "center" },
      [
        make(
          "image",
          {
            src: images[index] || "/assets/headphones.svg",
            alt: String(node.props.alt || caption || ""),
          },
          { width: "100%", maxWidth: "720px", objectFit: "contain" },
        ),
        ...(caption ? [make("text", { html: escapeMarkup(caption) }, {})] : []),
      ],
    );
    return { ...slide, name: String(slide.props.panelTitle) };
  });
}
export function normalizeAtomicBlock(input: Block, previous?: Block): Block {
  let node = input;
  if (
    (node.kind === "tabs" || node.kind === "carousel") &&
    !node.children.length
  )
    node = { ...node, children: panelsFromItems(node) };
  if (node.kind === "product") {
    const bound = String(node.props.productId || "");
    const rebinding = !!(
      previous?.props.productId &&
      bound &&
      node.props.atomicContent
    );
    if (rebinding && previous?.props.productId !== bound) {
      const updateSource = (child: Block): Block => ({
        ...child,
        props:
          child.props.slot &&
          child.props.productId === previous?.props.productId
            ? { ...child.props, productId: bound }
            : child.props,
        children: child.children.map(updateSource),
      });
      node = { ...node, children: node.children.map(updateSource) };
    }
    if (
      (!node.children.length && !node.props.atomicContent) ||
      (!rebinding &&
        previous &&
        previous.props.productId !== node.props.productId)
    ) {
      const oldParts = new Map<string, Block>();
      const collect = (nodes: Block[]) =>
        nodes.forEach((child) => {
          if (child.props.slot) oldParts.set(String(child.props.slot), child);
          collect(child.children);
        });
      collect(node.children);
      const part = (
        kind: Block["kind"],
        props: Block["props"],
        styles: Styles,
        slot: string,
        children: Block[] = [],
      ) => {
        const fresh = make(kind, { ...props, slot }, styles, children),
          old = oldParts.get(slot);
        if (!old) return fresh;
        const saved = { ...old.props };
        for (const key of [
          "html",
          "src",
          "mobileSrc",
          "alt",
          "field",
          "productId",
        ])
          delete saved[key];
        return {
          ...fresh,
          id: old.id,
          name: old.name,
          hidden: { ...old.hidden },
          props: { ...saved, ...fresh.props },
          styles: {
            desktop: { ...fresh.styles.desktop, ...old.styles.desktop },
            tablet: { ...old.styles.tablet },
            mobile: { ...old.styles.mobile },
          },
        };
      };
      node = {
        ...node,
        props: { ...node.props, atomicContent: true },
        styles: {
          ...node.styles,
          desktop: {
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            ...node.styles.desktop,
          },
        },
        children: bound
          ? [
              part(
                "productGallery",
                { productId: bound },
                { width: "100%" },
                "productImage",
              ),
              part(
                "productField",
                { productId: bound, field: "title", tag: "h3" },
                { fontSize: "22px", fontWeight: "700" },
                "productTitle",
              ),
              part("row", {}, { ...horizontal, gap: "10px" }, "productPrices", [
                part(
                  "productField",
                  { productId: bound, field: "price" },
                  { fontSize: "18px", fontWeight: "700" },
                  "productPrice",
                ),
                part(
                  "productField",
                  { productId: bound, field: "comparePrice" },
                  { fontSize: "14px", textDecoration: "line-through" },
                  "productCompare",
                ),
              ]),
              part(
                "productField",
                { productId: bound, field: "description" },
                { fontSize: "14px" },
                "productDescription",
              ),
            ]
          : [
              part(
                "image",
                { src: node.props.src || "", alt: node.props.title || "" },
                {
                  width: "100%",
                  height: "170px",
                  objectFit: "contain",
                  borderRadius: "12px",
                },
                "productImage",
              ),
              part(
                "heading",
                {
                  html: escapeMarkup(String(node.props.title || "")),
                  tag: "h3",
                },
                {
                  fontSize: "22px",
                  fontWeight: "700",
                  marginTop: "0px",
                  marginBottom: "0px",
                },
                "productTitle",
              ),
              part("row", {}, { ...horizontal, gap: "10px" }, "productPrices", [
                part(
                  "text",
                  { html: escapeMarkup(String(node.props.price || "")) },
                  { ...inherited, fontSize: "18px", fontWeight: "700" },
                  "productPrice",
                ),
                part(
                  "text",
                  { html: escapeMarkup(String(node.props.comparePrice || "")) },
                  {
                    ...inherited,
                    fontSize: "14px",
                    textDecoration: "line-through",
                  },
                  "productCompare",
                ),
              ]),
              part(
                "text",
                { html: escapeMarkup(String(node.props.description || "")) },
                { ...inherited, fontSize: "14px" },
                "productDescription",
              ),
            ],
      };
      input.children.forEach((child, index) => {
        if (
          ![
            "productImage",
            "productTitle",
            "productPrices",
            "productDescription",
          ].includes(String(child.props.slot))
        )
          node.children.splice(Math.min(index, node.children.length), 0, child);
      });
    }
    if (!bound && previous) {
      const fields: Record<string, string> = {
        productImage: "src",
        productTitle: "title",
        productPrice: "price",
        productCompare: "comparePrice",
        productDescription: "description",
      };
      const update = (child: Block): Block => {
        const field = fields[String(child.props.slot)];
        const props =
          field && previous.props[field] !== node.props[field]
            ? {
                ...child.props,
                [field === "src" ? "src" : "html"]:
                  field === "src"
                    ? node.props[field]
                    : escapeMarkup(String(node.props[field] || "")),
              }
            : child.props;
        return { ...child, props, children: child.children.map(update) };
      };
      node = { ...node, children: node.children.map(update) };
    }
  } else if (["button", "badge"].includes(node.kind)) {
    if (
      (!node.children.length && !node.props.atomicContent) ||
      (previous && previous.props.text !== node.props.text)
    )
      node = setCaption(node, String(node.props.text || ""));
    const labels = node.children.filter((n) =>
      String(n.props.slot || "").startsWith("caption"),
    );
    const labelText = (n: Block): string =>
      n.props.html
        ? plainMarkup(String(n.props.html))
        : n.children.map(labelText).filter(Boolean).join(" ");
    if (node.props.atomicContent)
      node = {
        ...node,
        props: { ...node.props, text: labels.map(labelText).join(" ") },
      };
  } else if (
    node.kind === "itemList" &&
    !node.children.length &&
    !node.props.atomicContent
  ) {
    node = {
      ...node,
      props: { ...node.props, atomicContent: true },
      styles: {
        ...node.styles,
        desktop: { ...horizontal, flexWrap: "nowrap", ...node.styles.desktop },
      },
      children: createItemList().children,
    };
  } else if (
    node.kind === "rating" &&
    !node.children.length &&
    !node.props.atomicContent
  ) {
    node = {
      ...node,
      props: { ...node.props, atomicContent: true },
      styles: {
        ...node.styles,
        desktop: { ...horizontal, ...node.styles.desktop },
      },
      children: [
        ...Array.from({ length: 5 }, () => iconNode("★")),
        textNode(
          escapeMarkup(`${node.props.rating || "4.8"} / 5`),
          "ratingScore",
        ),
        textNode(
          escapeMarkup(String(node.props.count || "120")),
          "ratingCount",
        ),
        textNode(
          escapeMarkup(String(node.props.text || t("reviews"))),
          "ratingLabel",
        ),
      ],
    };
  } else if (
    node.kind === "list" &&
    ((!node.children.length && !node.props.atomicContent) ||
      (previous && previous.props.items !== node.props.items))
  ) {
    node = {
      ...node,
      props: { ...node.props, atomicContent: true },
      styles: {
        ...node.styles,
        desktop: {
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          ...node.styles.desktop,
        },
      },
      children: String(node.props.items || "")
        .split("\n")
        .filter(Boolean)
        .map((label, i) => {
          const old = node.children[i];
          if (!old) return createItemList(label);
          return {
            ...old,
            children: old.children.map((child) =>
              child.props.slot === "itemText"
                ? {
                    ...child,
                    props: { ...child.props, html: escapeMarkup(label) },
                  }
                : child,
            ),
          };
        }),
    };
  } else if (["text", "heading"].includes(node.kind)) {
    node = expandMarkup(node);
  }
  if (node.kind === "rating" && previous) {
    const fields: Record<string, string> = {
      ratingScore: "rating",
      ratingCount: "count",
      ratingLabel: "text",
    };
    node = {
      ...node,
      children: node.children.map((child) => {
        const field = fields[String(child.props.slot)];
        if (!field || previous.props[field] === node.props[field]) return child;
        return {
          ...child,
          props: {
            ...child.props,
            html: escapeMarkup(
              String(node.props[field]) + (field === "rating" ? " / 5" : ""),
            ),
          },
        };
      }),
    };
  }
  return node;
}

/** Idempotent conversion of existing drafts. Root IDs, actions and geometry are preserved. */
export function normalizeAtomicDocument(page: PageDocument): PageDocument {
  const original = new Set<string>();
  const collect = (nodes: Block[]) =>
    nodes.forEach((n) => {
      original.add(n.id);
      collect(n.children);
    });
  collect(page.nodes);
  const assigned = new Set(original);
  const stable = (key: string) => {
    let a = 2166136261,
      b = 2246822519;
    for (const character of key) {
      a = Math.imul(a ^ character.charCodeAt(0), 16777619);
      b = Math.imul(b ^ character.charCodeAt(0), 3266489917);
    }
    return (
      "atom_" +
      (a >>> 0).toString(16).padStart(8, "0") +
      (b >>> 0).toString(16).padStart(8, "0")
    );
  };
  const identify = (node: Block, source: string, path: string): Block => {
    let id = node.id;
    if (!original.has(id) && !assigned.has(id)) {
      const base = stable(source + ":" + path);
      id = base;
      let collision = 0;
      while (assigned.has(id)) id = base + "_" + ++collision;
      assigned.add(id);
    }
    return {
      ...node,
      id,
      children: node.children.map((child, i) =>
        identify(child, source, path + "." + i),
      ),
    };
  };
  const visit = (node: Block, depth: number): Block => {
    if (depth >= 15 || node.props.locked) return node;
    const next = identify(normalizeAtomicBlock(node), node.id, "0");
    return {
      ...next,
      children: next.children.map((child) => visit(child, depth + 1)),
    };
  };
  const result = { ...page, nodes: page.nodes.map((node) => visit(node, 0)) };
  const size = (nodes: Block[]): number =>
    nodes.reduce((n, node) => n + 1 + size(node.children), 0);
  return size(result.nodes) <= 600 ? result : page;
}
export function isButtonContent(node: Block): boolean {
  return (
    [
      "text",
      "icon",
      "image",
      "row",
      "column",
      "box",
      "itemList",
      "badge",
      "divider",
      "spacer",
    ].includes(node.kind) && node.children.every(isButtonContent)
  );
}

export function detachAtomicPart(node: Block): Block {
  const props = { ...node.props };
  delete props.slot;
  return { ...node, props, children: node.children.map(detachAtomicPart) };
}
