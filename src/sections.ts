import {
  block,
  cloneBlock,
  findBlock,
  starterDocument,
  type Block,
  type PageDocument,
} from "./model";

export type SectionCategory =
  | "all"
  | "hero"
  | "commerce"
  | "content"
  | "conversion"
  | "layout";
export const sectionCategories: [SectionCategory, string][] = [
  ["all", "Tümü"],
  ["hero", "Hero"],
  ["commerce", "Satış"],
  ["content", "İçerik"],
  ["conversion", "Dönüşüm"],
  ["layout", "Düzen"],
];
export interface SectionPreset {
  id: string;
  name: string;
  category: SectionCategory;
  description: string;
  accent: string;
  create: () => Block;
}
export interface SavedSection {
  id: string;
  name: string;
  section: Block;
  created: number;
}
const section = (name: string, children: Block[], background = "#fbfcf7") => {
  const node = block(
    "section",
    {},
    {
      paddingTop: "56px",
      paddingBottom: "56px",
      paddingLeft: "60px",
      paddingRight: "60px",
      backgroundColor: background,
      gap: "22px",
    },
    children,
  );
  node.name = name;
  node.props.sectionRole = "content";
  node.styles.tablet = { paddingLeft: "32px", paddingRight: "32px" };
  node.styles.mobile = {
    paddingLeft: "24px",
    paddingRight: "24px",
    paddingTop: "32px",
    paddingBottom: "32px",
  };
  return node;
};
const title = (html: string, size = "36px") =>
  block(
    "heading",
    { html, tag: "h2" },
    { fontSize: size, letterSpacing: "-1px" },
  );
const text = (html: string) => block("text", { html });
const button = (label: string) =>
  block("button", { text: label, href: "#" }, { borderRadius: "26px" });
const card = (name: string, content: string, icon: string) =>
  block("box", {}, { width: "100%", gap: "15px", backgroundColor: "#eef2e5" }, [
    block("icon", { text: icon }),
    title(name, "22px"),
    text(content),
  ]);
export const sectionPresets: SectionPreset[] = [
  {
    id: "product-hero",
    name: "Ürün odaklı hero",
    category: "hero",
    description: "Başlık, ürün görseli, fiyat ve CTA.",
    accent: "#d8e8b7",
    create: () => starterDocument().nodes[1],
  },
  {
    id: "centered-hero",
    name: "Ortalanmış hero",
    category: "hero",
    description: "Güçlü mesaj, sade düzen ve tek bir eylem.",
    accent: "#e5ded2",
    create: () => {
      const node = section(
        "Hero · Ortalanmış",
        [
          block("badge", { text: "YENİ BİR BAŞLANGIÇ" }),
          title("Daha az karmaşa.<br/>Daha çok sen.", "54px"),
          text("Hikâyeni güçlü bir başlık ve net bir mesajla anlat."),
          button("Koleksiyonu keşfet →"),
        ],
        "#f5efe7",
      );
      node.styles.desktop.alignItems = "center";
      node.styles.desktop.textAlign = "center";
      return node;
    },
  },
  {
    id: "benefits",
    name: "Üç özellik kartı",
    category: "content",
    description: "Markanın güçlü yanlarını üç kartta anlat.",
    accent: "#dfe8d5",
    create: () => {
      const node = starterDocument().nodes[2];
      node.styles.desktop.paddingTop = "48px";
      return node;
    },
  },
  {
    id: "image-story",
    name: "Görsel ve hikâye",
    category: "content",
    description: "Görselin yanında düzenlenebilir metin.",
    accent: "#dfdfd6",
    create: () =>
      section("Hikâye · Görsel ve metin", [
        block("row", {}, { gap: "40px", alignItems: "center" }, [
          block("column", {}, { width: "100%" }, [block("image")]),
          block("column", {}, { width: "100%", gap: "20px" }, [
            block("badge", { text: "BİZİM HİKÂYEMİZ" }),
            title("Her ayrıntıda<br/>biraz daha iyi."),
            text(
              "Neye inandığını, nasıl ürettiğini ve seni farklı kılan şeyi burada anlat.",
            ),
            button("Hikâyeyi keşfet →"),
          ]),
        ]),
      ]),
  },
  {
    id: "product-grid",
    name: "Ürün vitrini",
    category: "commerce",
    description: "Üç ürün kartı; Shopify bağlantısı sonraki adım.",
    accent: "#e1e9c5",
    create: () =>
      section("Vitrin · Üç ürün", [
        title("Favorilerini keşfet."),
        text(
          "Aşağıdaki kartlar örnek üründür; gerçek ürün bağlantısı gerekir.",
        ),
        block(
          "row",
          {},
          { gap: "20px" },
          ["Aura One", "Aura Studio", "Aura Mini"].map((name) =>
            block("product", { title: name }),
          ),
        ),
      ]),
  },
  {
    id: "testimonials",
    name: "Müşteri yorumları",
    category: "content",
    description: "Düzenlenebilir yorumlar ve puanlar.",
    accent: "#e8ddcf",
    create: () =>
      section(
        "Yorumlar · Sosyal kanıt",
        [
          title("İnsanlar ne diyor?"),
          block(
            "row",
            {},
            { gap: "18px" },
            ["Deniz", "Ece", "Mert"].map((name) =>
              card(
                "★★★★★",
                `“Yorum metnini kendi müşteri yorumunla değiştir.”<br/><br/><b>${name}</b> · Örnek yorum`,
                "❝",
              ),
            ),
          ),
        ],
        "#f8f4eb",
      ),
  },
  {
    id: "faq",
    name: "Sık sorulan sorular",
    category: "content",
    description: "Tıklayarak açılan soru-cevap bölümü.",
    accent: "#d7e3da",
    create: () =>
      section("SSS · Sorular ve cevaplar", [
        title("Aklındaki sorular."),
        ...[
          "Kargo ne kadar sürer?",
          "İade nasıl yapılır?",
          "Garanti süresi nedir?",
        ].map((question) =>
          block("accordion", {
            title: question,
            description: "Bu sorunun cevabını kendi mağazana göre düzenle.",
          }),
        ),
      ]),
  },
  {
    id: "newsletter",
    name: "E-posta kayıt alanı",
    category: "conversion",
    description: "Başlık, form alanı ve düğme. Form servisi ayrıca bağlanır.",
    accent: "#dceabf",
    create: () =>
      section(
        "Bülten · E-posta formu",
        [
          title("Güzel şeylerden ilk sen haberdar ol."),
          text(
            "Form görünümü hazır; gönderim için e-posta hizmeti bağlantısı gerekir.",
          ),
          block("row", {}, { maxWidth: "620px", gap: "10px" }, [
            block("input", {
              placeholder: "E-posta adresin",
              inputType: "email",
            }),
            button("Haberdar ol →"),
          ]),
        ],
        "#eaf0da",
      ),
  },
  {
    id: "sale-banner",
    name: "Kampanya bandı",
    category: "conversion",
    description: "Teklif, geri sayım ve çağrı düğmesi.",
    accent: "#f1e5ab",
    create: () => {
      const node = section(
        "Kampanya · Geri sayım",
        [
          block("badge", { text: "SINIRLI SÜRE" }),
          title("Yeni favorilerine<br/>özel bir fırsat.", "44px"),
          block("countdown"),
          button("Fırsatı yakala →"),
        ],
        "#f7f2ce",
      );
      node.styles.desktop.alignItems = "center";
      node.styles.desktop.textAlign = "center";
      return node;
    },
  },
  {
    id: "header",
    name: "Sade header",
    category: "layout",
    description: "Logo, menü ve düğmeden oluşan özel üst bölüm.",
    accent: "#e0e6d3",
    create: () => starterDocument().nodes[0],
  },
  {
    id: "footer",
    name: "Marka footer’ı",
    category: "layout",
    description: "Marka açıklaması ve düzenlenebilir bağlantılar.",
    accent: "#35452f",
    create: () => {
      const node = section(
        "Footer · FukPages",
        [
          block("row", {}, { gap: "40px" }, [
            block("column", {}, { width: "100%" }, [
              title("aura✦", "28px"),
              text("Markanın hikâyesi burada devam eder."),
            ]),
            block("column", {}, { width: "100%" }, [
              title("Keşfet", "18px"),
              text("Koleksiyonlar<br/>Hikâyemiz<br/>İletişim"),
            ]),
            block("column", {}, { width: "100%" }, [
              title("Bilgi", "18px"),
              text("Kargo ve teslimat<br/>İade koşulları<br/>Gizlilik"),
            ]),
          ]),
          block("divider"),
          text("© 2026 Marka adı. Tüm hakları saklıdır."),
        ],
        "#eaf0de",
      );
      node.props.sectionRole = "footer";
      return node;
    },
  },
];
export function createSectionPreset(id: string): Block | undefined {
  const preset = sectionPresets.find((item) => item.id === id);
  if (!preset) return;
  const node = preset.create();
  node.props.presetId = preset.id;
  return node;
}
export function enclosingSection(page: PageDocument, id: string | null) {
  return page.nodes.find(
    (node) =>
      node.kind === "section" &&
      (node.id === id || !!findBlock(node.children, id)),
  );
}
export function insertSection(
  page: PageDocument,
  section: Block,
  selected: string | null,
): PageDocument {
  const root = enclosingSection(page, selected);
  let index = root
    ? page.nodes.findIndex((node) => node.id === root.id) + 1
    : page.nodes.length;
  const footerIndex = page.nodes.findIndex(
    (node) => node.props.sectionRole === "footer",
  );
  if (!root && footerIndex >= 0 && section.props.sectionRole !== "footer")
    index = footerIndex;
  if (section.props.sectionRole === "header") index = 0;
  if (section.props.sectionRole === "footer") index = page.nodes.length;
  const nodes = [...page.nodes];
  nodes.splice(index, 0, section);
  return { ...page, nodes };
}
export function fromSavedSection(section: Block) {
  return cloneBlock(section);
}
