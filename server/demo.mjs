import { starterDocument, createBlock } from "../src/model.ts";
import { cleanCatalog } from "./catalog.mjs";
import { validateDocument } from "./index.mjs";

// Synthetic data only. A schema marker prevents redeploys from recreating
// deleted demo pages or overwriting the owner's edits.
export function seedDemo(db) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS demo_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)",
  );
  if (db.prepare("SELECT value FROM demo_settings WHERE key='seed-v1'").get())
    return;
  const page = starterDocument("home");
  page.name = "Aura · Demo mağaza";
  page.seo = {
    slug: "demo-store",
    title: "Aura — FukPages Demo Mağaza",
    description:
      "Düzenlenebilir demo mağaza. Örnek katalog ve sepet; ödeme alınmaz.",
    image: "/assets/headphones.svg",
    noindex: true,
  };
  const walk = (nodes) =>
    nodes.forEach((n) => {
      if (n.kind === "button")
        Object.assign(n.props, {
          action: "scroll",
          actionTarget: "demo-product",
          text: "Ürünü keşfet",
        });
      walk(n.children);
    });
  walk(page.nodes);
  const product = createBlock("section");
  product.name = "Demo ürün · Varyant ve sepet";
  product.props.cssId = "demo-product";
  const heading = createBlock("heading");
  heading.props.html = "Aura One. Kendi ritmini bul.";
  const note = createBlock("text");
  note.props.html =
    "<b>Demo mağaza</b> — Ürünler örnektir. Sepete eklemeyi deneyebilirsin; ödeme ve gerçek sipariş oluşturulmaz.";
  const shop = [
    "productGallery",
    "productField",
    "variantPicker",
    "quantity",
    "addToCart",
  ].map((kind) => {
    const n = createBlock(kind);
    n.props.productId = "aura-one";
    return n;
  });
  shop[1].props.field = "price";
  Object.assign(shop[1].styles.desktop, {
    fontSize: "28px",
    fontWeight: "700",
  });
  const row = createBlock("row"),
    visual = createBlock("column"),
    details = createBlock("column");
  Object.assign(row.styles.desktop, { gap: "48px", alignItems: "center" });
  visual.styles.desktop.width = "48%";
  details.styles.desktop.width = "52%";
  visual.styles.mobile.width = details.styles.mobile.width = "100%";
  visual.children = [shop[0]];
  details.children = [heading, note, ...shop.slice(1)];
  row.children = [visual, details];
  product.children = [row];
  Object.assign(product.styles.desktop, {
    paddingTop: "64px",
    paddingBottom: "64px",
    paddingLeft: "60px",
    paddingRight: "60px",
    backgroundColor: "#f6f8ef",
  });
  product.styles.mobile = {
    paddingTop: "32px",
    paddingBottom: "32px",
    paddingLeft: "24px",
    paddingRight: "24px",
  };
  page.nodes.push(product);
  const faq = createBlock("section");
  faq.name = "Sık sorulan sorular";
  Object.assign(faq.styles.desktop, {
    paddingTop: "48px",
    paddingBottom: "48px",
    paddingLeft: "60px",
    paddingRight: "60px",
  });
  faq.styles.mobile = {
    paddingTop: "32px",
    paddingBottom: "32px",
    paddingLeft: "24px",
    paddingRight: "24px",
  };
  faq.children = [
    createBlock("heading"),
    ...[
      [
        "Bu gerçek bir mağaza mı?",
        "Hayır. Ürün ve sepet verileri yalnızca demodur.",
      ],
      [
        "Sayfayı değiştirebilir miyim?",
        "Şifreli panelden bu sayfayı düzenleyip yeniden yayınlayabilirsin.",
      ],
      ["Shopify bağlı mı?", "Bu aşamada Shopify bağlantısı kurulmaz."],
    ].map(([title, description]) => {
      const n = createBlock("accordion");
      Object.assign(n.props, { title, description });
      return n;
    }),
  ];
  faq.children[0].props.html = "Demo nasıl çalışır?";

  page.nodes.push(faq);
  const document = validateDocument(page);
  const catalog = cleanCatalog({
    products: [
      {
        id: "aura-one",
        title: "Aura One kablosuz kulaklık",
        description: "Gürültü engelleme, 40 saat pil ömrü. Örnek demo ürünü.",
        currency: "TRY",
        images: ["/assets/headphones.svg"],
        variants: [
          {
            id: "aura-green",
            title: "Yeşil",
            price: 499000,
            comparePrice: 599000,
            stock: 12,
            options: { Renk: "Yeşil" },
          },
          {
            id: "aura-black",
            title: "Siyah",
            price: 499000,
            stock: 8,
            options: { Renk: "Siyah" },
          },
        ],
      },
    ],
    collections: [
      {
        id: "demo-collection",
        title: "Aura koleksiyonu",
        productIds: ["aura-one"],
      },
    ],
  });
  db.exec("BEGIN");
  try {
    const now = Date.now();
    db.prepare(
      "INSERT INTO catalogs VALUES(?,?,1) ON CONFLICT(store_id) DO NOTHING",
    ).run("demo", JSON.stringify(catalog));
    db.prepare(
      "INSERT INTO pages VALUES(?,?,?,1,?) ON CONFLICT(id) DO NOTHING",
    ).run("demo-home", "demo", JSON.stringify(document), now);
    db.prepare(
      "INSERT INTO publications VALUES(?,?,1,?) ON CONFLICT(page_id) DO NOTHING",
    ).run("demo-home", JSON.stringify(document), now);
    db.prepare("INSERT INTO demo_settings VALUES('seed-v1','complete')").run();
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
