import { t, localized } from "./i18n.ts";
import {
  block,
  cloneBlock,
  findBlock,
  starterDocument,
  type Block,
  type PageDocument,
} from "./model";
export type SectionCategory =
  "all" | "hero" | "commerce" | "content" | "conversion" | "layout";
export const sectionCategories: [SectionCategory, string][] = localized(
  [
    ["all", "Tümü"],
    ["hero", "Hero"],
    ["commerce", "Satış"],
    ["content", "İçerik"],
    ["conversion", "Dönüşüm"],
    ["layout", "Düzen"],
  ],
  ["1"],
);
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
export const sectionPresets: SectionPreset[] = localized(
  [
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
          t("Hero · Ortalanmış"),
          [
            block("badge", { text: t("YENİ BİR BAŞLANGIÇ") }),
            title(t("Daha az karmaşa.<br/>Daha çok sen."), "54px"),
            text(t("Hikâyeni güçlü bir başlık ve net bir mesajla anlat.")),
            button(t("Koleksiyonu keşfet →")),
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
        section(t("Hikâye · Görsel ve metin"), [
          block("row", {}, { gap: "40px", alignItems: "center" }, [
            block("column", {}, { width: "100%" }, [block("image")]),
            block("column", {}, { width: "100%", gap: "20px" }, [
              block("badge", { text: t("BİZİM HİKÂYEMİZ") }),
              title(t("Her ayrıntıda<br/>biraz daha iyi.")),
              text(
                t(
                  "Neye inandığını, nasıl ürettiğini ve seni farklı kılan şeyi burada anlat.",
                ),
              ),
              button(t("Hikâyeyi keşfet →")),
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
        section(t("Vitrin · Üç ürün"), [
          title(t("Favorilerini keşfet.")),
          text(
            t(
              "Aşağıdaki kartlar örnek üründür; gerçek ürün bağlantısı gerekir.",
            ),
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
          t("Yorumlar · Sosyal kanıt"),
          [
            title(t("İnsanlar ne diyor?")),
            block(
              "row",
              {},
              { gap: "18px" },
              ["Deniz", "Ece", "Mert"].map((name) =>
                card(
                  "★★★★★",
                  t(
                    "“Yorum metnini kendi müşteri yorumunla değiştir.”<br/><br/><b>{p0}</b> · Örnek yorum",
                    { p0: name },
                  ),
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
          title(t("Aklındaki sorular.")),
          ...[
            t("Kargo ne kadar sürer?"),
            t("İade nasıl yapılır?"),
            t("Garanti süresi nedir?"),
          ].map((question) =>
            block("accordion", {
              title: question,
              description: t(
                "Bu sorunun cevabını kendi mağazana göre düzenle.",
              ),
            }),
          ),
        ]),
    },
    {
      id: "newsletter",
      name: "E-posta kayıt alanı",
      category: "conversion",
      description:
        "E-posta formu, pazarlama izni ve kalıcı gönderim kayıtları.",
      accent: "#dceabf",
      create: () =>
        section(
          t("Bülten · E-posta formu"),
          [
            title(t("Güzel şeylerden ilk sen haberdar ol.")),
            text(
              t(
                "E-posta kaydı uygulamada tutulur; dış hizmet bağlantısı isteğe bağlıdır.",
              ),
            ),
            block("form", {}, { maxWidth: "620px", gap: "10px" }, [
              block("input", {
                placeholder: t("E-posta adresin"),
                inputType: "email",
                fieldName: "email",
                required: true,
              }),
              block("checkbox", {
                label: t("Pazarlama e-postalarına izin veriyorum"),
                fieldName: "marketingConsent",
                consent: true,
                required: true,
              }),
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
          t("Kampanya · Geri sayım"),
          [
            block("badge", { text: t("SINIRLI SÜRE") }),
            title(t("Yeni favorilerine<br/>özel bir fırsat."), "44px"),
            block("countdown"),
            button(t("Fırsatı yakala →")),
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
                text(t("Markanın hikâyesi burada devam eder.")),
              ]),
              block("column", {}, { width: "100%" }, [
                title(t("Keşfet"), "18px"),
                text(t("Koleksiyonlar<br/>Hikâyemiz<br/>İletişim")),
              ]),
              block("column", {}, { width: "100%" }, [
                title(t("Bilgi"), "18px"),
                text(t("Kargo ve teslimat<br/>İade koşulları<br/>Gizlilik")),
              ]),
            ]),
            block("divider"),
            text(t("© 2026 Marka adı. Tüm hakları saklıdır.")),
          ],
          "#eaf0de",
        );
        node.props.sectionRole = "footer";
        return node;
      },
    },
  ],
  ["name", "description"],
);
const extendedFamilies: {
  id: string;
  name: string;
  category: SectionCategory;
  kind: Block["kind"];
}[] = [
  {
    id: "purchase",
    name: "Ürün satın alma",
    category: "commerce",
    kind: "productGallery",
  },
  { id: "steps", name: "Kullanım adımları", category: "content", kind: "list" },
  {
    id: "compare",
    name: "Ürün karşılaştırma",
    category: "commerce",
    kind: "comparison",
  },
  {
    id: "before-after",
    name: "Önce ve sonra",
    category: "content",
    kind: "beforeAfter",
  },
  { id: "ugc", name: "UGC / video", category: "content", kind: "videoPopup" },
  {
    id: "bundle-offer",
    name: "Paket teklif",
    category: "commerce",
    kind: "bundle",
  },
  {
    id: "specifications",
    name: "Teknik özellikler",
    category: "content",
    kind: "comparison",
  },
  {
    id: "size-guide",
    name: "Beden tablosu",
    category: "content",
    kind: "sizeTable",
  },
  {
    id: "delivery-returns",
    name: "Teslimat ve iade",
    category: "content",
    kind: "shipping",
  },
  {
    id: "brand-logos",
    name: "Marka logoları",
    category: "content",
    kind: "logos",
  },
  {
    id: "related-products",
    name: "İlgili ürünler",
    category: "commerce",
    kind: "collectionGrid",
  },
  {
    id: "email-popup",
    name: "E-posta popup",
    category: "conversion",
    kind: "popup",
  },
  {
    id: "sticky-purchase",
    name: "Sticky satın alma",
    category: "commerce",
    kind: "stickyCart",
  },
  {
    id: "blog-selection",
    name: "Blog seçkisi",
    category: "content",
    kind: "blogList",
  },
  {
    id: "faq-split",
    name: "İki kolonlu SSS",
    category: "content",
    kind: "accordion",
  },
  {
    id: "contact-form",
    name: "İletişim formu",
    category: "conversion",
    kind: "form",
  },
  {
    id: "trust-band",
    name: "Güven bandı",
    category: "conversion",
    kind: "list",
  },
  {
    id: "collection-heading",
    name: "Koleksiyon başlığı",
    category: "commerce",
    kind: "text",
  },
  {
    id: "product-details",
    name: "Ürün ayrıntı sekmeleri",
    category: "commerce",
    kind: "tabs",
  },
];
for (const family of extendedFamilies)
  sectionPresets.push({
    id: family.id,
    name: family.name,
    category: family.category,
    description: "Marka stillerine bağlı, mobil uyumlu ve düzenlenebilir.",
    accent: "#e2e9d5",
    create: () => {
      const component = block(family.kind);
      if (family.kind === "form") {
        component.children = [
          block("input", {
            inputType: "email",
            label: "E-posta",
            fieldName: "email",
            placeholder: t("E-posta adresin"),
            required: true,
          }),
          block("textarea", {
            label: t("Mesaj"),
            fieldName: "message",
            placeholder: t("Mesajın"),
            required: true,
          }),
          block("checkbox", {
            label: t("İletişim için izin veriyorum"),
            fieldName: "consent",
            consent: true,
            required: true,
          }),
        ];
      }
      if (family.kind === "popup") {
        component.props.trigger = "button";
        component.props.text = t("Bültene katıl");
        component.children = [
          block("heading", { html: t("Haberlerden ilk sen haberdar ol.") }),
          block("form", {}, {}, [
            block("input", {
              inputType: "email",
              fieldName: "email",
              placeholder: "E-posta",
              required: true,
            }),
            block("checkbox", {
              label: t("Pazarlama e-postalarına izin veriyorum"),
              fieldName: "marketingConsent",
              consent: true,
              required: true,
            }),
          ]),
        ];
      }
      if (family.id === "steps")
        component.props.items = t(
          "1. Ürünü hazırla\n2. Kullanımını kişiselleştir\n3. Sonucun keyfini çıkar",
        );
      if (family.kind === "tabs")
        component.props.items = t(
          "Özellikler|Ürün özelliklerini ekle.\nKullanım|Kullanım açıklamasını ekle.\nTeslimat|Teslimat bilgilerini ekle.",
        );
      if (family.id === "email-popup")
        component.children.unshift(block("image"));
      const content =
        family.id === "purchase"
          ? [
              block("row", {}, { alignItems: "center" }, [
                block("column", {}, {}, [component]),
                block("column", {}, {}, [
                  block("productField", { field: "title" }),
                  block("productField", { field: "price" }),
                  block("variantPicker"),
                  block("quantity"),
                  block("addToCart"),
                ]),
              ]),
            ]
          : [component];
      return section(family.name, [title(family.name), ...content]);
    },
  });
const basePresets = [...sectionPresets];
for (const base of basePresets)
  sectionPresets.push({
    ...base,
    id: base.id + "-alternate",
    name: base.name + " · Alternatif",
    description:
      "Alternatif yerleşim: kompakt, ters kolon veya ortalanmış içerik.",
    create: () => {
      const node = base.create();
      if (base.id === "ugc")
        node.children = [
          title("UGC / Video grid"),
          block("row", {}, {}, [
            block("video"),
            block("video"),
            block("video"),
          ]),
        ];
      if (base.id === "steps")
        node.children = [
          title(t("Görselli kullanım adımları")),
          block(
            "row",
            {},
            {},
            [1, 2, 3].map((n) =>
              block("column", {}, {}, [
                block("image"),
                title(t("{p0}. Adım", { p0: n }), "22px"),
                text(t("Adım açıklamasını düzenle.")),
              ]),
            ),
          ),
        ];
      if (base.id === "specifications")
        node.children = [
          title(t("Teknik özellikler")),
          block("row", {}, {}, [
            card(t("Malzeme"), t("Malzeme bilgisini düzenle."), "✦"),
            card(t("Boyut"), t("Ölçü bilgisini düzenle."), "↔"),
            card(t("Garanti"), t("Garanti bilgisini düzenle."), "✓"),
          ]),
        ];
      if (base.id === "size-guide")
        node.children = [
          title(t("Beden rehberi")),
          block(
            "popup",
            { trigger: "button", text: t("Beden tablosunu aç") },
            {},
            [block("sizeTable")],
          ),
        ];
      if (base.id === "delivery-returns")
        node.children = [
          block("row", {}, {}, [
            card(t("Teslimat"), t("Teslimat koşullarını ekle."), "→"),
            card(t("İade"), t("İade koşullarını ekle."), "↩"),
          ]),
        ];
      if (base.id === "email-popup") {
        const popup = node.children.find((n) => n.kind === "popup");
        if (popup)
          popup.children = popup.children.filter((n) => n.kind !== "image");
      }
      const variantContent = (nodes: Block[]) =>
        nodes.forEach((n) => {
          if (n.kind === "logos") n.props.moving = true;
          if (n.kind === "collectionGrid") n.props.view = "carousel";
          if (n.kind === "blogList") n.props.view = "editorial";
          variantContent(n.children);
        });
      variantContent(node.children);
      node.styles.desktop.paddingTop = "32px";
      node.styles.desktop.paddingBottom = "32px";
      node.styles.desktop.alignItems = "center";
      node.styles.desktop.textAlign = "center";
      const walk = (nodes: Block[]) =>
        nodes.forEach((n) => {
          if (n.kind === "row") n.styles.desktop.flexDirection = "row-reverse";
          if (n.kind === "gallery" || n.kind === "collectionGrid")
            n.styles.desktop.display = "grid";
          walk(n.children);
        });
      walk(node.children);
      node.name = base.name + " · Alternatif";
      return node;
    },
  });
const omitted = sectionPresets.findIndex(
  (p) => p.id === "collection-heading-alternate",
);
if (omitted >= 0) sectionPresets.splice(omitted, 1);
sectionPresets.push({
  id: "purchase-compact",
  name: "Ürün satın alma · Kompakt",
  category: "commerce",
  description: "Galeri, varyant ve satın alma alanı; kompakt düzen.",
  accent: "#e2e9d5",
  create: () => {
    const node = sectionPresets.find((p) => p.id === "purchase")!.create();
    node.styles.desktop.paddingTop = "24px";
    node.styles.desktop.paddingBottom = "24px";
    node.children.forEach((n) => {
      if (n.kind === "row") n.styles.desktop.flexDirection = "column";
    });
    node.name = t("Ürün satın alma · Kompakt");
    return node;
  },
});
function applyPresetBrand(node: Block) {
  node.props.globalStyle = "auto";
  if (node.kind === "section") {
    node.styles.desktop.paddingTop = "var(--brand-section-space)";
    node.styles.desktop.paddingBottom = "var(--brand-section-space)";
  }
  if (node.kind === "box") {
    node.styles.desktop.borderRadius = "var(--brand-radius)";
    node.styles.desktop.boxShadow = "var(--brand-shadow)";
  }
  for (const key of ["color", "backgroundColor", "borderColor"]) {
    if (node.styles.desktop[key])
      node.styles.desktop[key] =
        key === "color"
          ? "var(--brand-text)"
          : key === "borderColor"
            ? "var(--brand-border)"
            : "var(--brand-background)";
  }
  if (node.kind === "heading") {
    node.styles.desktop.fontFamily = "var(--font-heading)";
    node.styles.desktop.fontWeight = `var(--type-${node.props.tag || "h2"}Weight)`;
    node.styles.desktop.lineHeight = "var(--heading-line-height)";
    node.styles.desktop.fontSize = `var(--type-${node.props.tag || "h2"})`;
    node.styles.tablet.fontSize = `var(--type-${node.props.tag || "h2"})`;
    node.styles.mobile.fontSize = `var(--type-${node.props.tag || "h2"})`;
  }
  if (node.kind === "text") node.styles.desktop.fontFamily = "var(--font-body)";
  if (node.kind === "button") {
    node.styles.desktop.fontFamily = "var(--font-button)";
    node.styles.desktop.backgroundColor = "var(--brand-primary)";
    node.styles.desktop.color = "var(--brand-background)";
    node.styles.desktop.borderRadius = "var(--brand-radius)";
  }
  node.children.forEach(applyPresetBrand);
}
export function createSectionPreset(id: string): Block | undefined {
  const preset = sectionPresets.find((item) => item.id === id);
  if (!preset) return;
  const node = preset.create();
  node.props.presetId = preset.id;
  applyPresetBrand(node);
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
