import { getUiLanguage } from "./i18n.ts";
import { createItemList } from "./atomicContent.ts";
import {
  block,
  type Block,
  type PageDocument,
  type PageType,
  type Styles,
} from "./model.ts";

/**
 * Full-page templates. Every section is built from ordinary blocks, linked to
 * the store's brand (colours, fonts, type scale, radius) and ready for
 * desktop, tablet and mobile. Content copy follows the interface language at
 * the moment the template is used; after that it is the customer's text.
 */
export interface TemplateContext {
  /** First local collection, used by product grids when available. */
  collectionId?: string;
  /** Local products offered together in bundle sections. */
  productIds?: string[];
}
export interface PageTemplate {
  id: string;
  name: string;
  description: string;
  /** Page types the template is designed for; the first one is the default. */
  types: PageType[];
  build: (context: TemplateContext) => Block[];
}

const c = (tr: string, en: string) => (getUiLanguage() === "tr" ? tr : en);
const art = {
  stillLife: "/assets/templates/still-life.svg",
  arches: "/assets/templates/arches.svg",
  texture: "/assets/templates/texture.svg",
  portrait: "/assets/templates/portrait.svg",
};
const tint = (percent: number) =>
  `color-mix(in srgb, var(--brand-secondary) ${percent}%, var(--brand-background))`;
const muted = "color-mix(in srgb, var(--brand-text) 70%, transparent)";

function linked<T extends Block>(node: T): T {
  node.props.globalStyle = "auto";
  return node;
}
function named<T extends Block>(node: T, name: string): T {
  node.name = name;
  return node;
}

interface SectionOptions {
  background?: string;
  center?: boolean;
  space?: string;
  gap?: string;
  role?: "header" | "footer" | "content";
  color?: string;
}
function section(
  name: string,
  children: Block[],
  options: SectionOptions = {},
) {
  const node = block(
    "section",
    { sectionRole: options.role ?? "content" },
    {
      paddingTop: options.space ?? "var(--brand-section-space)",
      paddingBottom: options.space ?? "var(--brand-section-space)",
      paddingLeft: "60px",
      paddingRight: "60px",
      backgroundColor: options.background ?? "var(--brand-background)",
      gap: options.gap ?? "28px",
      ...(options.center ? { alignItems: "center", textAlign: "center" } : {}),
      ...(options.color ? { color: options.color } : {}),
    },
    children,
  );
  node.styles.tablet = { paddingLeft: "32px", paddingRight: "32px" };
  node.styles.mobile = {
    paddingLeft: "20px",
    paddingRight: "20px",
    ...(options.space ? {} : { paddingTop: "48px", paddingBottom: "48px" }),
  };
  return linked(named(node, name));
}
function heading(
  html: string,
  tag: "h1" | "h2" | "h3" = "h2",
  styles: Styles = {},
) {
  return linked(
    named(
      block(
        "heading",
        { html, tag },
        {
          fontFamily: "var(--font-heading)",
          fontSize: `var(--type-${tag})`,
          fontWeight: `var(--type-${tag}Weight)`,
          lineHeight: "var(--heading-line-height)",
          letterSpacing: tag === "h3" ? "-0.3px" : "-1px",
          color: "var(--brand-text)",
          ...styles,
        },
      ),
      tag === "h1" ? c("Ana başlık", "Main heading") : c("Başlık", "Heading"),
    ),
  );
}
function text(html: string, styles: Styles = {}) {
  return linked(
    block(
      "text",
      { html },
      {
        fontFamily: "var(--font-body)",
        fontSize: "var(--type-body)",
        lineHeight: "var(--body-line-height)",
        color: muted,
        ...styles,
      },
    ),
  );
}
function eyebrow(label: string) {
  return linked(
    block(
      "badge",
      { text: label },
      {
        backgroundColor: tint(60),
        color: "var(--brand-text)",
        letterSpacing: "1.4px",
      },
    ),
  );
}
function button(label: string, variant: "primary" | "outline" = "primary") {
  return linked(
    block(
      "button",
      { text: label, href: "#", buttonVariant: variant },
      {
        fontFamily: "var(--font-button)",
        borderRadius: "var(--brand-radius)",
        paddingTop: "15px",
        paddingBottom: "15px",
        paddingLeft: "28px",
        paddingRight: "28px",
        ...(variant === "outline"
          ? {
              backgroundColor: "transparent",
              color: "var(--brand-text)",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "var(--brand-primary)",
            }
          : {
              backgroundColor: "var(--brand-primary)",
              color: "var(--brand-background)",
            }),
      },
    ),
  );
}
function image(src: string, alt: string, styles: Styles = {}) {
  const { aspectRatio = "4 / 3", ...rest } = styles;
  // The ratio is an image setting (it crops the picture with object-fit),
  // so every artwork keeps the same frame whatever its own proportions.
  return block(
    "image",
    { src, alt, aspectRatio: String(aspectRatio) },
    {
      width: "100%",
      height: "auto",
      objectFit: "cover",
      borderRadius: "var(--brand-radius)",
      ...rest,
    },
  );
}
function row(children: Block[], styles: Styles = {}) {
  const node = block(
    "row",
    {},
    { gap: "32px", alignItems: "stretch", width: "100%", ...styles },
    children,
  );
  node.styles.mobile.flexDirection = "column";
  return node;
}
function column(children: Block[], styles: Styles = {}) {
  const node = block(
    "column",
    {},
    { gap: "18px", width: "100%", ...styles },
    children,
  );
  node.styles.mobile.width = "100%";
  return node;
}
function card(children: Block[], styles: Styles = {}) {
  return linked(
    block(
      "box",
      {},
      {
        width: "100%",
        gap: "12px",
        paddingTop: "28px",
        paddingBottom: "28px",
        paddingLeft: "28px",
        paddingRight: "28px",
        backgroundColor: "var(--brand-background)",
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: "var(--brand-border)",
        borderRadius: "var(--brand-radius)",
        ...styles,
      },
      children,
    ),
  );
}
function icon(glyph: string) {
  return block(
    "icon",
    { text: glyph },
    { fontSize: "26px", color: "var(--brand-primary)" },
  );
}
function itemRow(items: [string, string][], center = true) {
  const node = row(
    items.map(([glyph, label]) => {
      const item = createItemList(label, glyph);
      item.styles.desktop.fontSize = "15px";
      item.children.forEach((child) => {
        if (child.kind === "text") {
          child.styles.desktop.color = "var(--brand-text)";
          child.styles.desktop.fontWeight = "600";
        }
        if (child.kind === "icon")
          child.styles.desktop.color = "var(--brand-primary)";
      });
      return item;
    }),
    {
      gap: "36px",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: center ? "center" : "flex-start",
    },
  );
  node.styles.mobile = {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "14px",
  };
  return node;
}

/* Shared sections */
function header() {
  const brandName = heading("aura✦", "h3", {
    fontSize: "26px",
    letterSpacing: "-0.5px",
  });
  brandName.name = c("Logo", "Logo");
  const menu = row(
    [
      c("Yeni gelenler", "New in"),
      c("Mağaza", "Shop"),
      c("Hikâyemiz", "Our story"),
      c("Destek", "Support"),
    ].map((label) =>
      text(label, {
        fontSize: "14px",
        color: "var(--brand-text)",
        width: "fit-content",
      }),
    ),
    { gap: "28px", alignItems: "center", width: "fit-content" },
  );
  menu.name = c("Menü", "Menu");
  menu.styles.mobile = { display: "none" };
  const cta = button(c("Alışverişe başla", "Shop now"));
  cta.styles.desktop.paddingTop = "11px";
  cta.styles.desktop.paddingBottom = "11px";
  const bar = row([brandName, menu, cta], {
    alignItems: "center",
    justifyContent: "space-between",
    gap: "24px",
  });
  bar.styles.mobile = { flexDirection: "row" };
  const node = section(c("Header", "Header"), [bar], {
    role: "header",
    space: "18px",
  });
  return node;
}
function announcement(message: string) {
  return section(
    c("Duyuru bandı", "Announcement bar"),
    [
      text(message, {
        fontSize: "13px",
        color: "var(--brand-background)",
        fontWeight: "600",
        letterSpacing: "0.4px",
      }),
    ],
    { background: "var(--brand-primary)", center: true, space: "10px" },
  );
}
function footer() {
  const columnOf = (title: string, links: string[]) =>
    column(
      [
        heading(title, "h3", {
          fontSize: "15px",
          letterSpacing: "0px",
          color: "var(--brand-background)",
        }),
        ...links.map((label) =>
          text(label, {
            fontSize: "14px",
            color:
              "color-mix(in srgb, var(--brand-background) 75%, transparent)",
          }),
        ),
      ],
      { gap: "12px" },
    );
  const about = column(
    [
      heading("aura✦", "h3", {
        fontSize: "28px",
        color: "var(--brand-background)",
      }),
      text(
        c(
          "İyi tasarlanmış ürünler, sade bir hikâye ve özenli hizmet.",
          "Well-made products, an honest story and thoughtful service.",
        ),
        {
          color: "color-mix(in srgb, var(--brand-background) 75%, transparent)",
          fontSize: "14px",
        },
      ),
    ],
    { gap: "14px", width: "140%" },
  );
  const links = row(
    [
      about,
      columnOf(c("Mağaza", "Shop"), [
        c("Yeni gelenler", "New in"),
        c("Çok satanlar", "Best sellers"),
        c("Hediye kartı", "Gift card"),
      ]),
      columnOf(c("Yardım", "Help"), [
        c("Kargo ve teslimat", "Shipping"),
        c("İade ve değişim", "Returns"),
        c("Sık sorulanlar", "FAQ"),
      ]),
      columnOf(c("Kurumsal", "Company"), [
        c("Hikâyemiz", "Our story"),
        c("İletişim", "Contact"),
        c("Gizlilik", "Privacy"),
      ]),
    ],
    { gap: "40px" },
  );
  const rule = block(
    "divider",
    {},
    {
      backgroundColor:
        "color-mix(in srgb, var(--brand-background) 20%, transparent)",
    },
  );
  const legal = text(
    c(
      "© 2026 Marka adı. Tüm hakları saklıdır.",
      "© 2026 Brand name. All rights reserved.",
    ),
    {
      fontSize: "12px",
      color: "color-mix(in srgb, var(--brand-background) 60%, transparent)",
    },
  );
  return section(c("Footer", "Footer"), [links, rule, legal], {
    role: "footer",
    background: "var(--brand-primary)",
    space: "64px",
  });
}
function trustBand(background = tint(35)) {
  return section(
    c("Güven bandı", "Trust band"),
    [
      itemRow([
        ["✓", c("Ücretsiz kargo", "Free shipping")],
        ["↺", c("30 gün kolay iade", "30-day returns")],
        ["★", c("2 yıl garanti", "2-year warranty")],
        ["◈", c("Güvenli ödeme", "Secure checkout")],
      ]),
    ],
    { background, space: "26px", center: true },
  );
}
function splitHero(options: {
  eyebrowText: string;
  title: string;
  body: string;
  primary: string;
  secondary?: string;
  src: string;
  reverse?: boolean;
  background?: string;
}) {
  const copy = column(
    [
      eyebrow(options.eyebrowText),
      heading(options.title, "h1"),
      text(options.body, { fontSize: "18px", maxWidth: "520px" }),
      row(
        [
          button(options.primary),
          ...(options.secondary ? [button(options.secondary, "outline")] : []),
        ],
        { gap: "12px", width: "fit-content", flexWrap: "wrap" },
      ),
    ],
    { gap: "22px", justifyContent: "center", width: "100%" },
  );
  const visual = column(
    [image(options.src, options.title, { aspectRatio: "1 / 1" })],
    {
      justifyContent: "center",
    },
  );
  const content = row(options.reverse ? [visual, copy] : [copy, visual], {
    gap: "56px",
    alignItems: "center",
  });
  content.styles.mobile = { flexDirection: "column", gap: "28px" };
  return section(c("Hero", "Hero"), [content], {
    background: options.background ?? tint(25),
  });
}
function centeredHero(
  title: string,
  body: string,
  actions: Block[],
  background = tint(30),
) {
  const node = section(
    c("Hero · Ortalanmış", "Hero · Centred"),
    [
      heading(title, "h1", { maxWidth: "820px" }),
      text(body, { fontSize: "18px", maxWidth: "600px" }),
      row(actions, {
        gap: "12px",
        width: "fit-content",
        justifyContent: "center",
        flexWrap: "wrap",
      }),
    ],
    { background, center: true, gap: "24px" },
  );
  node.styles.desktop.paddingTop = "120px";
  node.styles.desktop.paddingBottom = "120px";
  node.styles.mobile.paddingTop = "64px";
  node.styles.mobile.paddingBottom = "64px";
  return node;
}
function sectionIntro(title: string, body?: string, label?: string) {
  return column(
    [
      ...(label ? [eyebrow(label)] : []),
      heading(title),
      ...(body ? [text(body, { maxWidth: "620px" })] : []),
    ],
    { alignItems: "center", textAlign: "center", gap: "14px" },
  );
}
function featureCards(
  title: string,
  items: [string, string, string][],
  background?: string,
) {
  return section(
    c("Özellikler", "Features"),
    [
      sectionIntro(title),
      row(
        items.map(([glyph, name, body]) =>
          card([icon(glyph), heading(name, "h3"), text(body)]),
        ),
        { gap: "20px" },
      ),
    ],
    { background, gap: "40px" },
  );
}
function story(
  title: string,
  body: string,
  src: string,
  reverse = false,
  background?: string,
) {
  const copy = column(
    [
      eyebrow(c("HİKÂYEMİZ", "OUR STORY")),
      heading(title),
      text(body),
      button(c("Daha fazlasını oku", "Read more"), "outline"),
    ],
    { justifyContent: "center", gap: "20px" },
  );
  const visual = column([image(src, title)]);
  const content = row(reverse ? [visual, copy] : [copy, visual], {
    gap: "56px",
    alignItems: "center",
  });
  content.styles.mobile = { flexDirection: "column", gap: "28px" };
  return section(c("Görsel ve hikâye", "Image with text"), [content], {
    background,
  });
}
function categoryTiles() {
  const tile = (label: string, src: string) =>
    card(
      [
        image(src, label, {
          aspectRatio: "3 / 4",
          borderRadius: "calc(var(--brand-radius) * 0.75)",
        }),
        heading(label, "h3", { fontSize: "20px" }),
        text(c("Koleksiyonu gör →", "Shop the edit →"), {
          fontSize: "14px",
          color: "var(--brand-text)",
          fontWeight: "600",
        }),
      ],
      {
        paddingTop: "14px",
        paddingBottom: "18px",
        paddingLeft: "14px",
        paddingRight: "14px",
        gap: "10px",
      },
    );
  return section(
    c("Kategoriler", "Categories"),
    [
      sectionIntro(c("Kendine uygun olanı bul.", "Find what fits you.")),
      row(
        [
          tile(c("Yeni gelenler", "New in"), art.portrait),
          tile(c("Çok satanlar", "Best sellers"), art.stillLife),
          tile(c("Kampanyalar", "On sale"), art.texture),
        ],
        { gap: "20px" },
      ),
    ],
    { gap: "40px" },
  );
}
function productShowcase(
  context: TemplateContext,
  title: string,
  background?: string,
) {
  const grid = context.collectionId
    ? block("collectionGrid", {
        collectionId: context.collectionId,
        pageSize: "4",
        tag: "h3",
      })
    : row(
        [
          c("Aura One", "Aura One"),
          c("Aura Studio", "Aura Studio"),
          c("Aura Mini", "Aura Mini"),
        ].map((name) => block("product", { title: name })),
        { gap: "20px" },
      );
  return section(
    c("Ürün vitrini", "Product showcase"),
    [
      sectionIntro(title),
      grid,
      button(c("Tüm ürünleri gör", "View all products"), "outline"),
    ],
    { background, center: true, gap: "36px" },
  );
}
function testimonials(background = tint(25)) {
  const review = (quote: string, name: string) =>
    card(
      [
        text("★★★★★", {
          color: "var(--brand-primary)",
          fontSize: "16px",
          letterSpacing: "3px",
        }),
        text(quote, { fontSize: "17px", color: "var(--brand-text)" }),
        text(`<b>${name}</b> · ${c("Doğrulanmış alıcı", "Verified buyer")}`, {
          fontSize: "13px",
        }),
      ],
      { gap: "16px" },
    );
  return section(
    c("Yorumlar", "Testimonials"),
    [
      sectionIntro(
        c("Müşterilerimiz ne diyor?", "What our customers say"),
        c(
          "Örnek yorumları kendi müşteri yorumlarınla değiştir.",
          "Replace the sample reviews with your customers' words.",
        ),
      ),
      row(
        [
          review(
            c(
              "“Beklediğimden çok daha iyi. Her gün kullanıyorum.”",
              "“Better than I expected. I use it every day.”",
            ),
            "Deniz",
          ),
          review(
            c(
              "“Paketlemesi bile özenli. Kesinlikle tavsiye ederim.”",
              "“Even the packaging is thoughtful. Highly recommended.”",
            ),
            "Ece",
          ),
          review(
            c(
              "“Hızlı kargo ve ilgili destek ekibi.”",
              "“Fast shipping and a caring support team.”",
            ),
            "Mert",
          ),
        ],
        { gap: "20px" },
      ),
    ],
    { background, gap: "40px" },
  );
}
function faq(background?: string) {
  const items: [string, string][] = [
    [
      c("Kargo ne kadar sürer?", "How long does shipping take?"),
      c(
        "Siparişler 1–3 iş günü içinde kargoya verilir.",
        "Orders ship within 1–3 business days.",
      ),
    ],
    [
      c("İade nasıl yapılır?", "How do returns work?"),
      c(
        "Teslimattan sonra 30 gün içinde ücretsiz iade edebilirsin.",
        "Return free of charge within 30 days of delivery.",
      ),
    ],
    [
      c("Garanti süresi nedir?", "What is the warranty?"),
      c(
        "Tüm ürünler 2 yıl garantilidir.",
        "Every product has a 2-year warranty.",
      ),
    ],
    [
      c("Hangi ödeme yöntemleri var?", "Which payment methods do you accept?"),
      c(
        "Kredi kartı, banka kartı ve havale.",
        "Credit card, debit card and bank transfer.",
      ),
    ],
  ];
  const list = column(
    items.map(([title, description]) =>
      block("accordion", { title, description }, { width: "100%" }),
    ),
    { gap: "10px", maxWidth: "760px" },
  );
  return section(
    c("SSS", "FAQ"),
    [
      sectionIntro(c("Sık sorulan sorular", "Frequently asked questions")),
      list,
    ],
    { background, center: true, gap: "36px" },
  );
}
function newsletter(background = tint(45)) {
  const form = block(
    "form",
    {},
    {
      maxWidth: "520px",
      width: "100%",
      gap: "10px",
      textAlign: "left",
      backgroundColor: "transparent",
      paddingTop: "0px",
      paddingBottom: "0px",
      paddingLeft: "0px",
      paddingRight: "0px",
    },
    [
      block("input", {
        placeholder: c("E-posta adresin", "Your email address"),
        inputType: "email",
        fieldName: "email",
        required: true,
      }),
      block("checkbox", {
        label: c(
          "Kampanya e-postalarına izin veriyorum",
          "I agree to receive marketing emails",
        ),
        fieldName: "marketingConsent",
        consent: true,
        required: true,
      }),
    ],
  );
  return section(
    c("Bülten", "Newsletter"),
    [
      heading(c("İlk sen haberdar ol.", "Be the first to know.")),
      text(
        c(
          "Yeni ürünler ve sana özel kampanyalar için bültene katıl.",
          "Join the newsletter for new arrivals and members-only offers.",
        ),
        { maxWidth: "520px" },
      ),
      form,
    ],
    { background, center: true, gap: "18px" },
  );
}
function campaign(title: string, background = "var(--brand-primary)") {
  const onDark = "var(--brand-background)";
  const node = section(
    c("Kampanya", "Campaign"),
    [
      eyebrow(c("SINIRLI SÜRE", "LIMITED TIME")),
      heading(title, "h1", { color: onDark, maxWidth: "760px" }),
      text(
        c(
          "Kampanya bitmeden favorilerini seç.",
          "Pick your favourites before the offer ends.",
        ),
        {
          color: "color-mix(in srgb, var(--brand-background) 80%, transparent)",
          fontSize: "18px",
        },
      ),
      block("countdown", {}, { color: onDark }),
      button(c("Fırsatları keşfet", "Shop the sale")),
    ],
    { background, center: true, gap: "22px" },
  );
  const cta = node.children.at(-1)!;
  cta.styles.desktop.backgroundColor = "var(--brand-background)";
  cta.styles.desktop.color = "var(--brand-text)";
  return node;
}
function steps(background?: string) {
  const step = (n: number, title: string, body: string, src: string) =>
    column(
      [
        image(src, title, { aspectRatio: "4 / 3" }),
        text(`0${n}`, {
          fontSize: "13px",
          fontWeight: "700",
          color: "var(--brand-primary)",
          letterSpacing: "1px",
        }),
        heading(title, "h3"),
        text(body),
      ],
      { gap: "12px" },
    );
  return section(
    c("Nasıl kullanılır", "How it works"),
    [
      sectionIntro(c("Üç adımda hazır.", "Ready in three steps.")),
      row(
        [
          step(
            1,
            c("Kutudan çıkar", "Unbox"),
            c(
              "Her şey kullanıma hazır gelir.",
              "Everything arrives ready to use.",
            ),
            art.stillLife,
          ),
          step(
            2,
            c("Kişiselleştir", "Make it yours"),
            c(
              "Ayarlarını kendi ritmine göre yap.",
              "Adjust it to your own rhythm.",
            ),
            art.texture,
          ),
          step(
            3,
            c("Keyfini çıkar", "Enjoy"),
            c(
              "Her gün fark edeceğin bir değişim.",
              "A difference you notice every day.",
            ),
            art.arches,
          ),
        ],
        { gap: "28px" },
      ),
    ],
    { background, gap: "40px" },
  );
}
function purchase() {
  const gallery = column([block("productGallery")], { width: "52%" });
  const info = column(
    [
      eyebrow(c("ÇOK SATAN", "BEST SELLER")),
      block(
        "productField",
        { field: "title", tag: "h1" },
        {
          fontFamily: "var(--font-heading)",
          fontSize: "var(--type-h1)",
          fontWeight: "var(--type-h1Weight)",
          lineHeight: "var(--heading-line-height)",
          color: "var(--brand-text)",
        },
      ),
      row(
        [
          block(
            "productField",
            { field: "price" },
            { fontSize: "26px", fontWeight: "700", color: "var(--brand-text)" },
          ),
          block(
            "productField",
            { field: "comparePrice" },
            { fontSize: "18px", color: muted, textDecoration: "line-through" },
          ),
        ],
        { gap: "12px", alignItems: "baseline", flexWrap: "wrap" },
      ),
      text("★★★★★ &nbsp;4.9 · " + c("1.200+ değerlendirme", "1,200+ reviews"), {
        fontSize: "13px",
      }),
      block(
        "productField",
        { field: "description" },
        { color: muted, lineHeight: "1.7" },
      ),
      block("variantPicker"),
      row([block("quantity"), block("addToCart", {}, { width: "100%" })], {
        gap: "12px",
        alignItems: "center",
      }),
      itemRow(
        [
          ["✓", c("Ücretsiz kargo", "Free shipping")],
          ["↺", c("30 gün iade", "30-day returns")],
        ],
        false,
      ),
    ],
    { width: "48%", gap: "18px", justifyContent: "center" },
  );
  gallery.styles.mobile.width = "100%";
  info.styles.mobile.width = "100%";
  const content = row([gallery, info], {
    gap: "56px",
    alignItems: "flex-start",
  });
  content.styles.mobile = { flexDirection: "column", gap: "24px" };
  return section(c("Ürün satın alma", "Product purchase"), [content], {
    space: "48px",
  });
}
function productDetails(background?: string) {
  return section(
    c("Ürün ayrıntıları", "Product details"),
    [
      block(
        "tabs",
        {
          items: c(
            "Açıklama|Ürünün öne çıkan özelliklerini burada anlat.\nKullanım|Kullanım ve bakım önerilerini ekle.\nKargo ve iade|Teslimat süresi ve iade koşullarını yaz.",
            "Description|Describe what makes this product special.\nHow to use|Add usage and care tips.\nShipping & returns|Explain delivery times and return terms.",
          ),
        },
        { width: "100%", maxWidth: "860px" },
      ),
    ],
    { background, center: true },
  );
}
function specs(background = tint(25)) {
  return featureCards(
    c("Ayrıntılarda saklı.", "It's all in the details."),
    [
      [
        "✦",
        c("Malzeme", "Materials"),
        c(
          "Uzun ömürlü, özenle seçilmiş malzemeler.",
          "Durable, carefully chosen materials.",
        ),
      ],
      [
        "↔",
        c("Ölçüler", "Dimensions"),
        c("Ölçü ve ağırlık bilgilerini ekle.", "Add size and weight details."),
      ],
      [
        "✓",
        c("Garanti", "Warranty"),
        c("2 yıl üretici garantisi.", "2-year manufacturer warranty."),
      ],
    ],
    background,
  );
}
function compare(background?: string) {
  return section(
    c("Karşılaştırma", "Comparison"),
    [
      sectionIntro(c("Fark ortada.", "See the difference.")),
      block(
        "comparison",
        {
          columns: c("Özellik|Bizim ürün|Diğerleri", "Feature|Ours|Others"),
          rows: c(
            "Garanti|2 yıl|1 yıl\nÜcretsiz iade|30 gün|14 gün\nMalzeme|Premium|Standart",
            "Warranty|2 years|1 year\nFree returns|30 days|14 days\nMaterials|Premium|Standard",
          ),
        },
        { width: "100%", maxWidth: "860px" },
      ),
    ],
    { background, center: true, gap: "36px" },
  );
}
function beforeAfter(background?: string) {
  return section(
    c("Önce ve sonra", "Before and after"),
    [
      sectionIntro(
        c("Sonucu kendin gör.", "See the result for yourself."),
        c("Kaydırarak farkı karşılaştır.", "Drag to compare the difference."),
      ),
      block(
        "beforeAfter",
        {
          images: `${art.texture}\n${art.stillLife}`,
        },
        { width: "100%", maxWidth: "860px" },
      ),
    ],
    { background, center: true, gap: "36px" },
  );
}
function bundle(context: TemplateContext, background = tint(30)) {
  return section(
    c("Paket teklif", "Bundle offer"),
    [
      sectionIntro(
        c("Birlikte daha avantajlı.", "Better together."),
        c(
          "Tamamlayıcı ürünleri tek pakette al, %15 kazan.",
          "Get the complete set in one bundle and save 15%.",
        ),
        c("PAKET", "BUNDLE"),
      ),
      block(
        "bundle",
        {
          title: c("Tam set", "The complete set"),
          discountPercent: "15",
          ...(context.productIds?.length
            ? { productIds: context.productIds.slice(0, 2).join(",") }
            : {}),
        },
        { width: "100%", maxWidth: "760px" },
      ),
    ],
    { background, center: true, gap: "32px" },
  );
}
function contact(titleTag: "h1" | "h2" = "h2") {
  const form = block(
    "form",
    {},
    {
      width: "100%",
      gap: "12px",
      backgroundColor: "var(--brand-background)",
      borderRadius: "var(--brand-radius)",
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: "var(--brand-border)",
      paddingTop: "28px",
      paddingBottom: "28px",
      paddingLeft: "28px",
      paddingRight: "28px",
    },
    [
      block("input", {
        inputType: "text",
        label: c("Ad soyad", "Full name"),
        fieldName: "name",
        placeholder: c("Adın", "Your name"),
        required: true,
      }),
      block("input", {
        inputType: "email",
        label: c("E-posta", "Email"),
        fieldName: "email",
        placeholder: c("E-posta adresin", "Your email address"),
        required: true,
      }),
      block("textarea", {
        label: c("Mesaj", "Message"),
        fieldName: "message",
        placeholder: c("Nasıl yardımcı olabiliriz?", "How can we help?"),
        required: true,
      }),
      block("checkbox", {
        label: c(
          "İletişim için izin veriyorum",
          "You may contact me about this request",
        ),
        fieldName: "consent",
        consent: true,
        required: true,
      }),
    ],
  );
  const info = column(
    [
      heading(c("Bize ulaş", "Get in touch"), titleTag),
      text(
        c(
          "Sorularını yanıtlamaktan memnuniyet duyarız. Genellikle 1 iş günü içinde dönüş yapıyoruz.",
          "We're happy to help. We usually reply within one business day.",
        ),
      ),
      itemRow(
        [
          ["✉", "hello@brand.com"],
          ["☎", "+90 212 000 00 00"],
          ["⌖", c("İstanbul, Türkiye", "Istanbul, Türkiye")],
        ],
        false,
      ),
    ],
    { gap: "20px", justifyContent: "center" },
  );
  info.children.at(-1)!.styles.desktop.flexDirection = "column";
  info.children.at(-1)!.styles.desktop.alignItems = "flex-start";
  info.children.at(-1)!.styles.desktop.gap = "14px";
  const content = row([info, column([form])], {
    gap: "56px",
    alignItems: "center",
  });
  content.styles.mobile = { flexDirection: "column", gap: "28px" };
  return section(c("İletişim", "Contact"), [content]);
}
function logos(background?: string) {
  return section(
    c("Basında biz", "As seen in"),
    [
      text(c("BASINDA BİZ", "AS SEEN IN"), {
        fontSize: "12px",
        letterSpacing: "2px",
        fontWeight: "700",
      }),
      block(
        "logos",
        {
          images: [1, 2, 3, 4, 5]
            .map((n) => `/assets/templates/logo-${n}.svg`)
            .join("\n"),
          alt: c("Marka logosu", "Brand logo"),
        },
        { width: "100%" },
      ),
    ],
    { background, center: true, space: "40px", gap: "18px" },
  );
}
function collectionHeader() {
  return section(
    c("Koleksiyon başlığı", "Collection header"),
    [
      text(c("Ana sayfa / Koleksiyonlar", "Home / Collections"), {
        fontSize: "13px",
      }),
      heading(c("Koleksiyon adı", "Collection name"), "h1"),
      text(
        c(
          "Koleksiyonunu birkaç cümleyle tanıt. Bu metin sayfa başlığının altında görünür.",
          "Introduce the collection in a few sentences. This text sits under the page title.",
        ),
        { maxWidth: "620px" },
      ),
    ],
    { background: tint(30), center: true, gap: "14px", space: "72px" },
  );
}
function collectionGrid() {
  return section(
    c("Ürün listesi", "Product grid"),
    [
      block(
        "collectionGrid",
        {
          pageSize: "12",
          tag: "h2",
          // Collection pages show the assigned (or previewed) collection.
          resourceBinding: "page",
        },
        { width: "100%" },
      ),
    ],
    { space: "48px" },
  );
}

export const pageTemplates: PageTemplate[] = [
  {
    id: "product-launch",
    name: "Ürün lansmanı",
    description:
      "Tek ürüne odaklı satış sayfası: hero, güven, özellikler, yorumlar ve SSS.",
    types: ["landing", "home", "page"],
    build: () => [
      announcement(
        c(
          "Lansmana özel ücretsiz kargo · 30 gün iade",
          "Launch offer: free shipping · 30-day returns",
        ),
      ),
      header(),
      splitHero({
        eyebrowText: c("YENİ ÜRÜN", "NEW RELEASE"),
        title: c("Her güne yakışan tasarım.", "Design that fits every day."),
        body: c(
          "Ürününü tek cümleyle anlat: kime, neden ve nasıl iyi geldiğini söyle.",
          "Describe your product in one sentence: who it's for and why it's better.",
        ),
        primary: c("Hemen satın al", "Buy now"),
        secondary: c("Daha fazla bilgi", "Learn more"),
        src: art.stillLife,
      }),
      trustBand(),
      featureCards(c("Neden bizi seçmelisin?", "Why customers choose us"), [
        [
          "✦",
          c("Özenli tasarım", "Thoughtful design"),
          c(
            "Her ayrıntı günlük kullanım için düşünüldü.",
            "Every detail is designed for daily use.",
          ),
        ],
        [
          "◎",
          c("Uzun ömür", "Built to last"),
          c(
            "Dayanıklı malzemeler, kolay bakım.",
            "Durable materials, easy care.",
          ),
        ],
        [
          "♡",
          c("Mutlu müşteriler", "Loved by customers"),
          c(
            "Binlerce müşteri tarafından önerildi.",
            "Recommended by thousands of customers.",
          ),
        ],
      ]),
      story(
        c("Küçük ayrıntılar, büyük fark.", "Small details, big difference."),
        c(
          "Markanın neden var olduğunu, nasıl ürettiğini ve seni neyin farklı kıldığını anlat.",
          "Tell why your brand exists, how you make things and what sets you apart.",
        ),
        art.arches,
        false,
        tint(20),
      ),
      testimonials("var(--brand-background)"),
      faq(tint(20)),
      newsletter(),
      footer(),
    ],
  },
  {
    id: "storefront-home",
    name: "Mağaza ana sayfası",
    description:
      "Kategoriler, ürün vitrini, marka hikâyesi ve bülten içeren ana sayfa.",
    types: ["home", "landing"],
    build: (context) => [
      header(),
      centeredHero(
        c("Yeni sezon burada.", "The new season is here."),
        c(
          "Zamansız parçalar, özenli işçilik ve sana özel kampanyalar.",
          "Timeless pieces, careful craft and offers made for you.",
        ),
        [
          button(c("Yeni gelenler", "Shop new in")),
          button(c("Çok satanlar", "Best sellers"), "outline"),
        ],
      ),
      categoryTiles(),
      productShowcase(
        context,
        c("Haftanın favorileri", "This week's favourites"),
        tint(20),
      ),
      story(
        c("Ustalıkla, sorumlulukla.", "Made with care."),
        c(
          "Üretim yaklaşımını, malzemelerini ve değerlerini birkaç cümlede anlat.",
          "Share your approach, materials and values in a few sentences.",
        ),
        art.portrait,
        true,
      ),
      logos(tint(15)),
      testimonials(),
      newsletter(),
      footer(),
    ],
  },
  {
    id: "classic-product",
    name: "Klasik ürün sayfası",
    description:
      "Galeri, varyant ve sepete ekle; ardından ayrıntılar, karşılaştırma, yorumlar ve SSS.",
    types: ["product"],
    build: (context) => [
      announcement(
        c("500 ₺ üzeri ücretsiz kargo", "Free shipping on orders over ₺500"),
      ),
      header(),
      purchase(),
      trustBand(),
      productDetails(),
      specs(),
      compare(),
      testimonials(),
      faq(tint(15)),
      productShowcase(
        context,
        c("Bunları da beğenebilirsin", "You may also like"),
      ),
      footer(),
    ],
  },
  {
    id: "story-product",
    name: "Hikâye anlatan ürün sayfası",
    description:
      "Satın alma alanının ardından önce/sonra, kullanım adımları ve paket teklif.",
    types: ["product", "landing"],
    build: (context) => [
      header(),
      purchase(),
      beforeAfter(tint(20)),
      steps(),
      bundle(context),
      testimonials("var(--brand-background)"),
      faq(tint(20)),
      footer(),
    ],
  },
  {
    id: "collection-grid",
    name: "Koleksiyon sayfası",
    description:
      "Koleksiyon başlığı, sıralanabilir ürün listesi, güven bandı ve bülten.",
    types: ["collection"],
    build: () => [
      header(),
      collectionHeader(),
      collectionGrid(),
      trustBand(),
      newsletter(),
      footer(),
    ],
  },
  {
    id: "sale-campaign",
    name: "Kampanya sayfası",
    description:
      "Geri sayımlı kampanya, ürün vitrini, paket teklif ve yorumlar.",
    types: ["landing", "home"],
    build: (context) => [
      announcement(
        c("Kampanya yalnızca bu hafta geçerli", "This offer ends this week"),
      ),
      header(),
      campaign(
        c(
          "Sezon sonu indirimi: %40'a varan fırsatlar.",
          "End of season: up to 40% off.",
        ),
      ),
      productShowcase(context, c("Kampanyadaki ürünler", "On sale now")),
      bundle(context),
      testimonials(),
      faq(),
      footer(),
    ],
  },
  {
    id: "about",
    name: "Hakkımızda",
    description: "Marka hikâyesi, değerler, basında biz ve iletişim formu.",
    types: ["page", "landing"],
    build: () => [
      header(),
      centeredHero(
        c(
          "Daha iyisini yapmak için buradayız.",
          "We're here to make it better.",
        ),
        c(
          "Markanın neden kurulduğunu tek paragrafta anlat.",
          "Tell in one paragraph why your brand exists.",
        ),
        [button(c("Ürünleri keşfet", "Explore products"))],
        tint(25),
      ),
      story(
        c("Nasıl başladık?", "How we started"),
        c(
          "Kuruluş hikâyeni, ilk ürününü ve bugüne nasıl geldiğini paylaş.",
          "Share your founding story, your first product and how you got here.",
        ),
        art.portrait,
      ),
      featureCards(
        c("Değerlerimiz", "What we stand for"),
        [
          [
            "◎",
            c("Şeffaflık", "Transparency"),
            c(
              "Ne yaptığımızı ve nasıl yaptığımızı açıkça anlatırız.",
              "We openly share what we make and how.",
            ),
          ],
          [
            "♲",
            c("Sorumluluk", "Responsibility"),
            c(
              "Malzeme ve üretimde uzun vadeli düşünürüz.",
              "We think long term about materials and production.",
            ),
          ],
          [
            "♡",
            c("Özen", "Care"),
            c(
              "Her siparişi kendi siparişimiz gibi hazırlarız.",
              "We pack every order as if it were our own.",
            ),
          ],
        ],
        tint(20),
      ),
      story(
        c("Ekibimizle tanış.", "Meet the team."),
        c(
          "Ürünlerin arkasındaki insanları tanıt.",
          "Introduce the people behind the products.",
        ),
        art.arches,
        true,
      ),
      logos(tint(15)),
      contact(),
      footer(),
    ],
  },
  {
    id: "contact",
    name: "İletişim",
    description: "İletişim bilgileri, form ve sık sorulan sorular.",
    types: ["page"],
    // The form section carries the page's main heading.
    build: () => [header(), contact("h1"), faq(tint(20)), footer()],
  },
];

/** Template names and descriptions follow the interface language. */
const englishCopy: Record<string, [string, string]> = {
  "product-launch": [
    "Product launch",
    "A single-product sales page: hero, trust band, features, reviews and FAQ.",
  ],
  "storefront-home": [
    "Storefront home",
    "Home page with categories, product showcase, brand story and newsletter.",
  ],
  "classic-product": [
    "Classic product page",
    "Gallery, variants and add to cart, followed by details, comparison, reviews and FAQ.",
  ],
  "story-product": [
    "Story-led product page",
    "Purchase area followed by before/after, how-to steps and a bundle offer.",
  ],
  "collection-grid": [
    "Collection page",
    "Collection header, sortable product grid, trust band and newsletter.",
  ],
  "sale-campaign": [
    "Sale campaign",
    "Countdown campaign, product showcase, bundle offer and reviews.",
  ],
  about: ["About us", "Brand story, values, press logos and a contact form."],
  contact: [
    "Contact",
    "Contact details, a form and frequently asked questions.",
  ],
};
export function templateLabel(template: PageTemplate) {
  const english = englishCopy[template.id];
  return getUiLanguage() === "tr" || !english
    ? { name: template.name, description: template.description }
    : { name: english[0], description: english[1] };
}

export function templatesFor(type: PageType | "all") {
  if (type === "all") return pageTemplates;
  const matching = pageTemplates.filter((t) => t.types.includes(type));
  return matching.length ? matching : pageTemplates;
}

/** Fresh sections (new ids) for a template; header/footer can be skipped. */
export function buildTemplate(
  id: string,
  context: TemplateContext = {},
  options: { withShell?: boolean } = {},
): Block[] {
  const template = pageTemplates.find((t) => t.id === id);
  if (!template) return [];
  const sections = template.build(context);
  return options.withShell === false
    ? sections.filter(
        (node) =>
          !["header", "footer"].includes(String(node.props.sectionRole)),
      )
    : sections;
}

/** A complete new page document built from a template. */
export function templateDocument(
  id: string,
  context: TemplateContext = {},
  type?: PageType,
): PageDocument | undefined {
  const template = pageTemplates.find((t) => t.id === id);
  if (!template) return;
  return {
    schemaVersion: 1,
    type: type ?? template.types[0],
    name: templateLabel(template).name,
    nodes: buildTemplate(id, context),
  };
}

/**
 * Add a template's content sections to an existing page: its own header and
 * footer are skipped and the new sections go before the page's footer.
 */
export function appendTemplateSections(
  page: PageDocument,
  sections: Block[],
): PageDocument {
  const content = sections.filter(
    (node) => !["header", "footer"].includes(String(node.props.sectionRole)),
  );
  const footer = page.nodes.findIndex(
    (node) => node.props.sectionRole === "footer",
  );
  const nodes = [...page.nodes];
  nodes.splice(footer >= 0 ? footer : nodes.length, 0, ...content);
  return { ...page, nodes };
}
