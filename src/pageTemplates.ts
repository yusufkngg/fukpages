import { t } from "./i18n.ts";
import {
  block,
  starterDocument,
  type PageType,
  type PageDocument,
  cloneBlock,
} from "./model.ts";
export function pageTemplate(type: PageType): PageDocument {
  const page = starterDocument(type);
  if (type === "home") page.name = t("Yeni ana sayfa");
  if (type === "product") {
    page.name = t("Yeni ürün sayfası");
    const gallery = block("column", {}, { width: "48%" }, [
      block("productGallery"),
    ]);
    gallery.styles.mobile.width = "100%";
    const title = block(
      "productField",
      { field: "title", tag: "h1" },
      { fontSize: "40px", fontWeight: "700" },
    );
    const info = block("column", {}, { width: "52%" }, [
      title,
      block(
        "productField",
        { field: "price" },
        { fontSize: "28px", fontWeight: "700" },
      ),
      block("productField", { field: "description" }),
      block("variantPicker"),
      block("quantity"),
      block("addToCart"),
    ]);
    info.styles.mobile.width = "100%";
    const section = block(
      "section",
      {},
      {
        paddingTop: "48px",
        paddingBottom: "48px",
        paddingLeft: "48px",
        paddingRight: "48px",
      },
      [
        block("row", {}, { gap: "32px", alignItems: "center" }, [
          gallery,
          info,
        ]),
      ],
    );
    section.styles.mobile = { paddingLeft: "24px", paddingRight: "24px" };
    page.nodes = [page.nodes[0], section];
  }
  if (type === "collection") {
    page.name = t("Yeni koleksiyon sayfası");
    const section = block(
      "section",
      {},
      {
        paddingTop: "48px",
        paddingBottom: "48px",
        paddingLeft: "48px",
        paddingRight: "48px",
      },
      [block("collectionGrid", { pageSize: "12", tag: "h1" })],
    );
    section.styles.mobile = { paddingLeft: "24px", paddingRight: "24px" };
    page.nodes = [page.nodes[0], section];
  }
  return page;
}
export function duplicateDocument(page: PageDocument): PageDocument {
  const root = block("box", {}, {}, page.nodes);
  return {
    ...structuredClone(page),
    name: page.name + " · Kopya",
    nodes: cloneBlock(root).children,
  };
}
