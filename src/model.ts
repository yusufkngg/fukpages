import type { CSSProperties } from "react";
import { normalizeStyles } from "./styleValues.ts";
export type Device = "desktop" | "tablet" | "mobile";
export const advancedLabels = {
  form: "Form",
  select: "Açılır seçim",
  checkbox: "Onay kutusu",
  radio: "Radyo seçimi",
  tabs: "Sekmeler",
  carousel: "Carousel",
  gallery: "Görsel galeri",
  logos: "Logo şeridi",
  rating: "Yıldız puanı",
  comparison: "Karşılaştırma tablosu",
  beforeAfter: "Önce / sonra",
  coupon: "Kupon kopyalama",
  shipping: "Teslimat / kargo",
  popup: "Popup",
  videoPopup: "Video popup",
  backToTop: "Yukarı dön",
  breadcrumb: "Breadcrumb",
  mobileMenu: "Mobil menü",
  blogList: "Yazı listesi",
  customCode: "Kontrollü HTML",
  appEmbed: "Uygulama alanı",
  productGallery: "Ürün galerisi",
  variantPicker: "Varyant seçimi",
  quantity: "Adet seçici",
  addToCart: "Sepete ekle",
  stickyCart: "Sticky satın alma",
  collectionGrid: "Koleksiyon vitrini",
  productField: "Dinamik ürün alanı",
  bundle: "Paket teklif",
  sizeTable: "Beden tablosu",
} as const;
export type Kind =
  | keyof typeof advancedLabels
  | "section"
  | "row"
  | "column"
  | "box"
  | "heading"
  | "text"
  | "image"
  | "button"
  | "input"
  | "textarea"
  | "divider"
  | "spacer"
  | "icon"
  | "video"
  | "list"
  | "badge"
  | "product"
  | "countdown"
  | "accordion";
export type PageType =
  | "landing"
  | "home"
  | "product"
  | "collection"
  | "page"
  | "blog"
  | "article"
  | "cart"
  | "search";
export type Styles = Record<string, string | number>;
export interface Block {
  id: string;
  kind: Kind;
  name: string;
  props: Record<string, string | boolean>;
  styles: Record<Device, Styles>;
  hidden: Record<Device, boolean>;
  children: Block[];
}
export interface PageDocument {
  schemaVersion: 1;
  name: string;
  type: PageType;
  nodes: Block[];
  locales?: string[];
  defaultLocale?: string;
  seo?: {
    slug: string;
    title: string;
    description: string;
    image: string;
    noindex: boolean;
  };
  themeLayout?: { snapshotId: string; useShell: boolean };
}
export interface Store {
  id: string;
  name: string;
  client: string;
  domain: string;
  status: "active" | "suspended";
  connection: "local" | "configured" | "synced";
  pageCount: number;
}
export interface PageSummary {
  id: string;
  name: string;
  type: PageType;
  version: number;
  updated: number;
  published?: boolean;
  assignments?: string[];
  slug?: string;
}
export const widths: Record<Device, number> = {
  desktop: 1120,
  tablet: 768,
  mobile: 390,
};
export const deviceNames: Record<Device, string> = {
  desktop: "Masaüstü",
  tablet: "Tablet",
  mobile: "Mobil",
};
export const pageNames: Record<PageType, string> = {
  landing: "Landing page",
  home: "Ana sayfa",
  product: "Ürün",
  collection: "Koleksiyon",
  page: "Standart sayfa",
  blog: "Blog",
  article: "Makale",
  cart: "Sepet",
  search: "Arama",
};
export const labels: Record<Kind, string> = {
  ...advancedLabels,
  section: "Bölüm",
  row: "Satır",
  column: "Kolon",
  box: "Kutu",
  heading: "Başlık",
  text: "Metin",
  image: "Görsel",
  button: "Düğme",
  input: "Metin kutusu",
  textarea: "Metin alanı",
  divider: "Ayırıcı",
  spacer: "Boşluk",
  icon: "İkon",
  video: "Video",
  list: "Liste",
  badge: "Etiket",
  product: "Ürün kartı",
  countdown: "Geri sayım",
  accordion: "Accordion",
};
export const groups: { name: string; kinds: Kind[] }[] = [
  { name: "DÜZEN", kinds: ["section", "row", "column", "box"] },
  {
    name: "TEMEL ÖĞELER",
    kinds: [
      "heading",
      "text",
      "image",
      "button",
      "icon",
      "badge",
      "divider",
      "spacer",
    ],
  },
  {
    name: "FORM & MEDYA",
    kinds: ["input", "textarea", "video", "list", "accordion"],
  },
  {
    name: "SATIŞ",
    kinds: [
      "product",
      "countdown",
      "productField",
      "productGallery",
      "variantPicker",
      "quantity",
      "addToCart",
      "stickyCart",
      "collectionGrid",
      "bundle",
      "shipping",
      "coupon",
    ],
  },
  {
    name: "ETKİLEŞİM",
    kinds: [
      "tabs",
      "carousel",
      "gallery",
      "logos",
      "rating",
      "comparison",
      "beforeAfter",
      "popup",
      "videoPopup",
      "backToTop",
      "breadcrumb",
      "mobileMenu",
      "blogList",
      "sizeTable",
      "customCode",
      "appEmbed",
    ],
  },
  { name: "FORM ALANLARI", kinds: ["form", "select", "checkbox", "radio"] },
];
export const isContainer = (kind: Kind) =>
  ["section", "row", "column", "box", "form", "popup"].includes(kind);
export const uid = () => crypto.randomUUID();
const boxStyle = {
  paddingTop: "24px",
  paddingRight: "24px",
  paddingBottom: "24px",
  paddingLeft: "24px",
};
export function createBlock(kind: Kind): Block {
  const props: Block["props"] =
    kind in advancedLabels
      ? {
          title: advancedLabels[kind as keyof typeof advancedLabels],
          text: advancedLabels[kind as keyof typeof advancedLabels],
          items: "Birinci seçenek\nİkinci seçenek\nÜçüncü seçenek",
          options: "Birinci seçenek\nİkinci seçenek",
          images: "/assets/headphones.svg\n/assets/headphones.svg",
          columns: "Özellik|Standart|Premium",
          rows: "Garanti|1 yıl|2 yıl\nTeslimat|3 gün|1 gün",
          rating: "4.8",
          count: "120",
          label: "Alan etiketi",
          fieldName: "",
          action: "navigate",
          destination: "local",
          successMessage: "Gönderimin alındı.",
          threshold: "1000",
          currency: "TRY",
          globalStyle: "auto",
        }
      : {};
  let desktop: Styles = {};
  const tablet: Styles = {},
    mobile: Styles = {};
  switch (kind) {
    case "form":
    case "popup":
    case "section":
      desktop = {
        ...boxStyle,
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        backgroundColor: "#ffffff",
        width: "100%",
      };
      break;
    case "row":
      desktop = {
        display: "flex",
        flexDirection: "row",
        gap: "24px",
        alignItems: "stretch",
        width: "100%",
      };
      mobile.flexDirection = "column";
      break;
    case "column":
      desktop = {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        width: "100%",
      };
      break;
    case "box":
      desktop = {
        ...boxStyle,
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        backgroundColor: "#f2f4ee",
        borderRadius: "16px",
        minHeight: "80px",
      };
      break;
    case "heading":
      props.html = "Büyük fikirler burada başlar.";
      props.tag = "h2";
      desktop = {
        fontSize: "42px",
        fontWeight: "700",
        lineHeight: "1.12",
        color: "#17241c",
        letterSpacing: "-1.5px",
        marginBottom: "0px",
      };
      tablet.fontSize = "34px";
      mobile.fontSize = "28px";
      break;
    case "text":
      props.html = "Hikâyeni anlat. Her ayrıntıyı kendi tarzına göre düzenle.";
      desktop = { fontSize: "16px", lineHeight: "1.7", color: "#616b63" };
      break;
    case "image":
      props.src = "/assets/headphones.svg";
      props.alt = "Kablosuz kulaklık";
      desktop = {
        width: "100%",
        height: "auto",
        objectFit: "contain",
        borderRadius: "16px",
      };
      break;
    case "button":
      props.text = "Keşfet →";
      props.href = "#";
      props.targetBlank = false;
      desktop = {
        backgroundColor: "#17241c",
        color: "#ffffff",
        paddingTop: "15px",
        paddingBottom: "15px",
        paddingLeft: "26px",
        paddingRight: "26px",
        borderRadius: "8px",
        fontSize: "15px",
        fontWeight: "600",
        textAlign: "center",
        width: "fit-content",
      };
      break;
    case "input":
      props.placeholder = "E-posta adresin";
      props.inputType = "email";
      desktop = {
        width: "100%",
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: "#d2d7cf",
        borderRadius: "8px",
        paddingTop: "14px",
        paddingBottom: "14px",
        paddingLeft: "16px",
        paddingRight: "16px",
        fontSize: "15px",
        backgroundColor: "#ffffff",
        color: "#17241c",
      };
      break;
    case "textarea":
      props.placeholder = "Mesajını yaz…";
      desktop = {
        width: "100%",
        minHeight: "120px",
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: "#d2d7cf",
        borderRadius: "8px",
        ...boxStyle,
        fontSize: "15px",
      };
      break;
    case "divider":
      desktop = {
        width: "100%",
        height: "1px",
        backgroundColor: "#dce2d7",
        marginTop: "12px",
        marginBottom: "12px",
      };
      break;
    case "spacer":
      desktop = { height: "48px", width: "100%" };
      break;
    case "icon":
      props.text = "✦";
      desktop = { fontSize: "32px", color: "#17241c" };
      break;
    case "badge":
      props.text = "YENİ KOLEKSİYON";
      desktop = {
        fontSize: "11px",
        fontWeight: "700",
        letterSpacing: "1.3px",
        backgroundColor: "#e4efd5",
        color: "#314328",
        paddingTop: "7px",
        paddingBottom: "7px",
        paddingLeft: "12px",
        paddingRight: "12px",
        borderRadius: "20px",
        width: "fit-content",
      };
      break;
    case "video":
      props.src = "";
      props.text = "Video URL’sini içerik panelinden ekle";
      desktop = {
        width: "100%",
        minHeight: "220px",
        borderRadius: "12px",
        backgroundColor: "#e9ece5",
      };
      break;
    case "list":
      props.items = "Ücretsiz kargo\n2 yıl garanti\n30 gün içinde iade";
      desktop = { fontSize: "15px", lineHeight: "2", color: "#354333" };
      break;
    case "product":
      props.title = "Aura One";
      props.price = "₺4.990";
      props.comparePrice = "₺5.990";
      props.src = "/assets/headphones.svg";
      props.description = "Ürün bağlantısı için Shopify kurulumu gerekli.";
      desktop = {
        ...boxStyle,
        backgroundColor: "#f5f6ef",
        borderRadius: "16px",
        width: "100%",
        fontSize: "18px",
        color: "#17241c",
      };
      break;
    case "countdown":
      props.endDate = new Date(Date.now() + 7 * 86400000)
        .toISOString()
        .slice(0, 16);
      desktop = {
        fontSize: "28px",
        color: "#17241c",
        textAlign: "center",
        paddingTop: "16px",
        paddingBottom: "16px",
      };
      break;
    case "accordion":
      props.title = "Ayrıntıları keşfet";
      props.description =
        "Daha fazla bilgi için aç. Bu içeriği sağ panelden düzenleyebilirsin.";
      desktop = {
        paddingTop: "18px",
        paddingBottom: "18px",
        paddingLeft: "18px",
        paddingRight: "18px",
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: "#dce2d7",
        borderRadius: "8px",
        fontSize: "16px",
        color: "#17241c",
      };
      break;
  }
  if (kind in advancedLabels && !Object.keys(desktop).length)
    desktop = { width: "100%", paddingTop: "12px", paddingBottom: "12px" };
  return {
    id: uid(),
    kind,
    name: labels[kind],
    props,
    styles: { desktop, tablet, mobile },
    hidden: { desktop: false, tablet: false, mobile: false },
    children: [],
  };
}
export function block(
  kind: Kind,
  props: Block["props"] = {},
  styles: Styles = {},
  children: Block[] = [],
) {
  const node = createBlock(kind);
  node.props = { ...node.props, ...props };
  node.styles.desktop = { ...node.styles.desktop, ...styles };
  node.children = children;
  return node;
}
export function starterDocument(type: PageType = "landing"): PageDocument {
  const title = block(
    "heading",
    { html: "SOUND THAT<br/>MOVES YOU.", tag: "h1" },
    {
      fontSize: "66px",
      fontWeight: "800",
      letterSpacing: "-3px",
      lineHeight: "1.04",
    },
  );
  title.styles.tablet = { fontSize: "48px" };
  title.styles.mobile = { fontSize: "40px", letterSpacing: "-1.6px" };
  const intro = block(
    "column",
    {},
    { width: "52%", gap: "22px", justifyContent: "center" },
    [
      block("badge", { text: "MADE FOR YOUR EVERYDAY" }),
      title,
      block(
        "text",
        {
          html: "Find your rhythm. Lose the noise.<br/>Meet Aura One — sound, without limits.",
        },
        { fontSize: "18px" },
      ),
      block("row", {}, { gap: "10px", alignItems: "center" }, [
        block(
          "text",
          { html: "<b>₺4.990</b>" },
          { fontSize: "24px", color: "#17241c" },
        ),
        block(
          "text",
          { html: "<s>₺5.990</s>" },
          { fontSize: "16px", color: "#899082" },
        ),
      ]),
      block(
        "button",
        { text: "Find your rhythm  ↗" },
        {
          borderRadius: "28px",
          paddingLeft: "28px",
          paddingRight: "28px",
          paddingTop: "17px",
          paddingBottom: "17px",
        },
      ),
      block(
        "text",
        { html: "★★★★★ &nbsp; 4.9/5 · Loved by 2,400+ listeners" },
        { fontSize: "12px", color: "#66715f" },
      ),
    ],
  );
  intro.styles.mobile.width = "100%";
  const visual = block(
    "column",
    {},
    { width: "48%", justifyContent: "center", alignItems: "center" },
    [
      block("image", {
        src: "/assets/headphones.svg",
        alt: "Aura One kablosuz kulaklık",
      }),
    ],
  );
  visual.styles.mobile.width = "100%";
  const hero = block(
    "section",
    {},
    {
      paddingTop: "56px",
      paddingBottom: "56px",
      paddingLeft: "60px",
      paddingRight: "60px",
      backgroundColor: "#fbfcf7",
    },
    [block("row", {}, { alignItems: "center", gap: "38px" }, [intro, visual])],
  );
  hero.styles.tablet = { paddingLeft: "32px", paddingRight: "32px" };
  hero.styles.mobile = {
    paddingLeft: "24px",
    paddingRight: "24px",
    paddingTop: "32px",
    paddingBottom: "32px",
  };
  const nav = block(
    "section",
    {},
    {
      paddingTop: "22px",
      paddingBottom: "22px",
      paddingLeft: "60px",
      paddingRight: "60px",
      backgroundColor: "#fbfcf7",
      borderWidth: "0px",
      borderColor: "#edf0e6",
    },
    [
      block(
        "row",
        {},
        { alignItems: "center", justifyContent: "space-between" },
        [
          block(
            "heading",
            { html: "aura<span>✦</span>", tag: "div" },
            { fontSize: "29px", letterSpacing: "-1px" },
          ),
          block(
            "text",
            {
              html: "Shop &nbsp;&nbsp;&nbsp; Our story &nbsp;&nbsp;&nbsp; Support",
            },
            { fontSize: "13px", color: "#354333" },
          ),
          block(
            "button",
            { text: "Shop now ↗" },
            {
              fontSize: "12px",
              borderRadius: "24px",
              paddingTop: "10px",
              paddingBottom: "10px",
            },
          ),
        ],
      ),
    ],
  );
  nav.styles.mobile = { paddingLeft: "24px", paddingRight: "24px" };
  nav.children[0].styles.mobile.flexDirection = "row";
  nav.children[0].children[1].hidden.mobile = true;
  const cards = [
    "40 hours of freedom",
    "Your world. Your sound.",
    "Comfort, all day.",
  ].map((text, i) =>
    block(
      "box",
      {},
      {
        backgroundColor: ["#edf2e5", "#f2eee5", "#eef0f3"][i],
        width: "100%",
        gap: "12px",
        borderRadius: "16px",
      },
      [
        block("icon", { text: ["◷", "✦", "∞"][i] }),
        block(
          "heading",
          { html: text },
          { fontSize: "20px", letterSpacing: "-0.4px" },
        ),
        block(
          "text",
          {
            html: [
              "A little charge. A lot of listening.",
              "Active noise cancelling. Pure focus.",
              "Designed to feel like nothing.",
            ][i],
          },
          { fontSize: "13px" },
        ),
      ],
    ),
  );
  const features = block(
    "section",
    {},
    {
      paddingTop: "0px",
      paddingLeft: "60px",
      paddingRight: "60px",
      paddingBottom: "48px",
      backgroundColor: "#fbfcf7",
    },
    [block("row", {}, { gap: "16px" }, cards)],
  );
  features.styles.mobile = { paddingLeft: "24px", paddingRight: "24px" };
  nav.name = "Header · FukPages";
  nav.props.sectionRole = "header";
  hero.name = "Hero · Ürün tanıtımı";
  features.name = "Özellikler · Üç kolon";
  return {
    schemaVersion: 1,
    name: "Aura · Product launch",
    type,
    nodes: [nav, hero, features],
  };
}
export function findBlock(
  nodes: Block[],
  id: string | null,
): Block | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findBlock(node.children, id);
    if (found) return found;
  }
}
export function mapBlock(
  nodes: Block[],
  id: string,
  change: (node: Block) => Block,
): Block[] {
  return nodes.map((node) =>
    node.id === id
      ? change(node)
      : { ...node, children: mapBlock(node.children, id, change) },
  );
}
export function removeBlock(nodes: Block[], id: string): Block[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => ({ ...node, children: removeBlock(node.children, id) }));
}
export function insertBlock(
  nodes: Block[],
  parent: string | null,
  index: number,
  block: Block,
): Block[] {
  if (!parent) {
    const copy = [...nodes];
    copy.splice(index, 0, block);
    return copy;
  }
  return mapBlock(nodes, parent, (node) => {
    if (!isContainer(node.kind)) return node;
    const children = [...node.children];
    children.splice(index, 0, block);
    return { ...node, children };
  });
}
export function locateBlock(
  nodes: Block[],
  id: string,
  parent: string | null = null,
): { parent: string | null; index: number } | undefined {
  for (let index = 0; index < nodes.length; index++) {
    if (nodes[index].id === id) return { parent, index };
    const found = locateBlock(nodes[index].children, id, nodes[index].id);
    if (found) return found;
  }
}
export function cloneBlock(node: Block): Block {
  const ids = new Map<string, string>();
  const copy = structuredClone(node);
  const assign = (n: Block) => {
    ids.set(n.id, uid());
    if (n.props.cssId) ids.set(String(n.props.cssId), uid());
    if (n.props.popupId) ids.set(String(n.props.popupId), uid());
    n.children.forEach(assign);
  };
  assign(copy);
  const remap = (n: Block) => {
    n.id = ids.get(n.id)!;
    for (const key of ["cssId", "popupId"])
      if (n.props[key]) n.props[key] = ids.get(String(n.props[key]))!;
    const target = String(n.props.actionTarget || ""),
      id = target.replace(/^#/, "");
    if (ids.has(id))
      n.props.actionTarget = (target.startsWith("#") ? "#" : "") + ids.get(id)!;
    const href = String(n.props.href || "");
    if (href.startsWith("#") && ids.has(href.slice(1)))
      n.props.href = "#" + ids.get(href.slice(1));
    n.children.forEach(remap);
  };
  remap(copy);
  return copy;
}
export function moveBlock(
  nodes: Block[],
  id: string,
  parent: string | null,
  index: number,
) {
  const node = findBlock(nodes, id),
    source = locateBlock(nodes, id);
  if (
    !node ||
    !source ||
    parent === id ||
    (parent && findBlock(node.children, parent))
  )
    return nodes;
  const target = parent && findBlock(nodes, parent);
  if (parent && (!target || !isContainer(target.kind))) return nodes;
  const adjusted =
    source.parent === parent && source.index < index ? index - 1 : index;
  return insertBlock(removeBlock(nodes, id), parent, adjusted, node);
}
export function effectiveStyle(node: Block, device: Device): CSSProperties {
  return normalizeStyles({
    ...node.styles.desktop,
    ...(device !== "desktop" ? node.styles.tablet : {}),
    ...(device === "mobile" ? node.styles.mobile : {}),
  }) as CSSProperties;
}
export function firstHeading(nodes: Block[]): string | null {
  for (const node of nodes) {
    if (node.kind === "heading" && node.props.tag === "h1") return node.id;
    const found = firstHeading(node.children);
    if (found) return found;
  }
  return null;
}
