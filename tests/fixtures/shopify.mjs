import { randomBytes } from "node:crypto";
import { createShopifyThemeService } from "../../server/shopify-theme.mjs";
export const fixtureDomain = "fukpages-fixture.myshopify.com";
export const fixtureTheme = {
  id: "gid://shopify/OnlineStoreTheme/123456789",
  name: "Dawn · Test tema verisi",
  role: "MAIN",
  processing: false,
};
const schema = (name, settings = []) =>
  `{% schema %}${JSON.stringify({ name, settings })}{% endschema %}`;
export const fixtureFiles = new Map([
  [
    "layout/theme.liquid",
    `<header>{% sections 'header-group' %}</header><main>{{ content_for_layout }}</main><footer>{% sections 'footer-group' %}</footer>`,
  ],
  [
    "sections/header-group.json",
    JSON.stringify({
      type: "header",
      sections: {
        announcement: {
          type: "announcement-bar",
          settings: { text: "Ücretsiz kargo" },
        },
        header: {
          type: "header",
          settings: {
            menu: "main-menu",
            sticky_header_type: "on-scroll",
            show_country_selector: true,
          },
        },
      },
      order: ["announcement", "header"],
    }),
  ],
  [
    "sections/footer-group.json",
    JSON.stringify({
      type: "footer",
      sections: {
        footer: { type: "footer", settings: { copyright: "Örnek mağaza" } },
        newsletter: { type: "newsletter", disabled: true, settings: {} },
      },
      order: ["footer", "newsletter"],
    }),
  ],
  [
    "templates/page.json",
    `/* Shopify-generated theme template */\n${JSON.stringify({ sections: { main: { type: "main-page", settings: { title: "Sayfa içeriği", url: "https://example.test/a//b" } }, featured: { type: "featured-collection", settings: { products_to_show: 4 } } }, order: ["main", "featured"] })}`,
  ],
  [
    "templates/index.json",
    JSON.stringify({
      sections: {
        hero: { type: "image-banner", settings: { title: "Ana sayfa" } },
      },
      order: ["hero"],
    }),
  ],
  [
    "sections/header.liquid",
    schema("Header", [
      { id: "menu", type: "link_list", label: "Menü" },
      {
        id: "show_country_selector",
        type: "checkbox",
        label: "Ülke seçiciyi göster",
        default: false,
      },
    ]),
  ],
  ["sections/footer.liquid", schema("Footer")],
  ["sections/announcement-bar.liquid", schema("Duyuru bandı")],
  ["sections/main-page.liquid", schema("Sayfa içeriği")],
  ["sections/featured-collection.liquid", schema("Öne çıkan koleksiyon")],
  ["sections/newsletter.liquid", schema("E-posta bülteni")],
  ["sections/image-banner.liquid", schema("Görsel banner")],
]);
export function createFixtureService({
  files = fixtureFiles,
  calls = [],
} = {}) {
  const token = randomBytes(20).toString("hex");
  const fetchImpl = async (url, options) => {
    const payload = JSON.parse(options.body);
    calls.push({ url, query: payload.query, variables: payload.variables });
    if (options.headers["X-Shopify-Access-Token"] !== token)
      throw new Error("Test credential was not passed to the adapter");
    if (payload.query.includes("FukPagesThemes"))
      return new Response(
        JSON.stringify({
          data: {
            themes: {
              nodes: [fixtureTheme],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        }),
        { status: 200 },
      );
    if (payload.query.includes("FukPagesThemeFiles")) {
      const nodes = payload.variables.filenames
        .filter((name) => files.has(name))
        .map((filename) => ({
          filename,
          body: {
            __typename: "OnlineStoreThemeFileBodyText",
            content: files.get(filename),
          },
        }));
      return new Response(
        JSON.stringify({
          data: {
            theme: {
              files: {
                nodes,
                userErrors: [],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        }),
        { status: 200 },
      );
    }
    throw new Error("Unexpected GraphQL operation in test fixture");
  };
  return createShopifyThemeService({ domain: fixtureDomain, token, fetchImpl });
}
