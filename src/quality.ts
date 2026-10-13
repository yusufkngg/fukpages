import { t } from "./i18n.ts";
import type { Block, PageDocument } from "./model";
import { buttonLink, navigationActions } from "./links";
export function qualityIssues(page: PageDocument): {
  nodeId: string;
  message: string;
}[] {
  const issues: {
      nodeId: string;
      message: string;
    }[] = [],
    headings: Block[] = [];
  const warn = (n: Block, message: string) =>
    issues.push({ nodeId: n.id, message: n.name + ": " + message });
  const walk = (nodes: Block[]) =>
    nodes.forEach((n) => {
      if (n.kind === "image") {
        if (!n.props.src) warn(n, t("görsel eksik"));
        if (!n.props.alt) warn(n, t("alternatif metin eksik"));
      }
      if (
        n.kind === "button" &&
        navigationActions.has(String(n.props.action || "navigate")) &&
        !buttonLink(n.props)
      )
        warn(n, t("bağlantı boş veya geçersiz"));
      if (
        [
          "productField",
          "addToCart",
          "productGallery",
          "variantPicker",
        ].includes(n.kind) &&
        !n.props.productId &&
        page.type !== "product"
      )
        warn(n, t("ürün bağlantısı eksik"));
      if (
        n.kind === "heading" ||
        (n.kind === "productField" && n.props.field === "title") ||
        n.kind === "collectionGrid"
      )
        headings.push(n);
      walk(n.children);
    });
  walk(page.nodes);
  const h1 = headings.filter((n) => n.props.tag === "h1");
  if (h1.length !== 1)
    issues.push({
      nodeId: h1[1]?.id || headings[0]?.id || page.nodes[0]?.id || "",
      message: t("H1 sayısı {p0}; tek ana başlık önerilir.", { p0: h1.length }),
    });
  const semantic = headings.filter((n) => /^h[1-6]$/.test(String(n.props.tag)));
  for (let i = 1; i < semantic.length; i++)
    if (
      Number(String(semantic[i].props.tag).slice(1)) >
      Number(String(semantic[i - 1].props.tag).slice(1)) + 1
    )
      warn(semantic[i], t("başlık düzeyi atlanmış"));
  return issues;
}
