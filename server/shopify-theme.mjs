import { randomUUID } from "node:crypto";
import { parse } from "jsonc-parser";

export class ThemeSyncError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}
export function normalizeShopDomain(value) {
  const domain = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain))
    throw new ThemeSyncError(
      "Geçerli bir .myshopify.com mağaza adresi gerekli.",
      400,
    );
  return domain;
}
const allowedTemplate = (value) =>
  /^templates\/(index|product|collection|page|blog|article|cart|search)(\.[a-zA-Z0-9_-]+)?\.json$/.test(
    value,
  );
export function readThemeJson(source, name) {
  const errors = [];
  const value = parse(source, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  if (
    errors.length ||
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  )
    throw new ThemeSyncError(`Tema dosyası okunamadı: ${name}`);
  return value;
}
function readSchema(source) {
  const match =
    /{%[-]?\s*schema\s*[-]?%}([\s\S]*?){%[-]?\s*endschema\s*[-]?%}/.exec(
      source ?? "",
    );
  return match ? readThemeJson(match[1], "section schema") : {};
}
const sectionNames = {
  header: "Header",
  footer: "Footer",
  "announcement-bar": "Duyuru bandı",
  "image-banner": "Görsel banner",
  "rich-text": "Zengin metin",
  "featured-collection": "Öne çıkan koleksiyon",
  "main-product": "Ürün ayrıntıları",
  "main-collection-product-grid": "Koleksiyon ürünleri",
  "main-page": "Sayfa içeriği",
  "main-blog": "Blog",
  "main-article": "Makale",
  "main-cart-items": "Sepet",
  "main-search": "Arama",
  newsletter: "E-posta bülteni",
  multicolumn: "Çoklu kolon",
  collapsible_content: "Açılır içerik",
};
function labelFor(type, schema) {
  if (typeof schema.name === "string" && !schema.name.startsWith("t:"))
    return schema.name.slice(0, 120);
  return sectionNames[type] ?? type.replaceAll("-", " ");
}
function orderedSections(json, filename) {
  if (
    !json.sections ||
    typeof json.sections !== "object" ||
    Array.isArray(json.sections) ||
    !Array.isArray(json.order)
  )
    throw new ThemeSyncError(`Bölüm sırası okunamadı: ${filename}`);
  const seen = new Set();
  return json.order.map((id) => {
    if (
      typeof id !== "string" ||
      seen.has(id) ||
      !Object.hasOwn(json.sections, id)
    )
      throw new ThemeSyncError(`Geçersiz bölüm sırası: ${filename}`);
    seen.add(id);
    const entry = json.sections[id];
    if (
      !entry ||
      typeof entry.type !== "string" ||
      !/^[\w-]+$/.test(entry.type)
    )
      throw new ThemeSyncError(`Geçersiz tema bölümü: ${filename}`);
    return { sectionId: id, ...entry };
  });
}
export function buildThemeSnapshot({
  shopDomain,
  theme,
  templateFilename,
  files,
}) {
  const layout = files.get("layout/theme.liquid");
  const template = files.get(templateFilename);
  if (typeof layout !== "string")
    throw new ThemeSyncError("Tema layout dosyasına erişilemedi.");
  if (typeof template !== "string")
    throw new ThemeSyncError(
      "Bu sayfa için Online Store 2.0 JSON şablonu bulunamadı.",
    );
  const contentAt = /{{-?\s*content_for_layout\s*-?}}/.exec(layout)?.index;
  if (contentAt === undefined)
    throw new ThemeSyncError(
      "Tema layout içinde sayfa içerik alanı bulunamadı.",
    );
  const references = [
    ...layout.matchAll(
      /{%[-]?\s*(section|sections)\s+['"]([\w-]+)['"]\s*[-]?%}/g,
    ),
  ];
  const result = [];
  const staticSettings = files.has("config/settings_data.json")
    ? (readThemeJson(
        files.get("config/settings_data.json"),
        "config/settings_data.json",
      ).current?.sections ?? {})
    : {};
  function describe(entry, filename, region, group) {
    const schema = readSchema(files.get(`sections/${entry.type}.liquid`));
    const fields = Array.isArray(schema.settings) ? schema.settings : [];
    const defaults = Object.fromEntries(
      fields
        .filter((field) => field?.id && Object.hasOwn(field, "default"))
        .map((field) => [field.id, field.default]),
    );
    return {
      id: `${filename}:${entry.sectionId}`,
      sectionId: entry.sectionId,
      type: entry.type,
      name: labelFor(entry.type, schema),
      region,
      group,
      filename,
      enabled: entry.disabled !== true,
      blockCount: Object.keys(entry.blocks ?? {}).length,
      settings: { ...defaults, ...(entry.settings ?? {}) },
      settingLabels: Object.fromEntries(
        fields
          .filter((field) => typeof field?.id === "string")
          .map((field) => [
            field.id,
            typeof field.label === "string" && !field.label.startsWith("t:")
              ? field.label
              : field.id.replaceAll("_", " "),
          ]),
      ),
    };
  }
  for (const match of references) {
    const region = match.index < contentAt ? "header" : "footer";
    if (match[1] === "sections") {
      const filename = `sections/${match[2]}.json`;
      if (!files.has(filename))
        throw new ThemeSyncError(`Tema bölüm grubu okunamadı: ${filename}`);
      const group = readThemeJson(files.get(filename), filename);
      for (const entry of orderedSections(group, filename))
        result.push(describe(entry, filename, region, match[2]));
    } else {
      const entry = staticSettings[match[2]] ?? {
        type: match[2],
        settings: {},
      };
      result.push(
        describe(
          { ...entry, sectionId: match[2] },
          "layout/theme.liquid",
          region,
          null,
        ),
      );
    }
  }
  const main = orderedSections(
    readThemeJson(template, templateFilename),
    templateFilename,
  ).map((entry) => describe(entry, templateFilename, "main", null));
  const sections = [
    ...result.filter((item) => item.region === "header"),
    ...main,
    ...result.filter((item) => item.region === "footer"),
  ];
  return {
    id: randomUUID(),
    shopDomain,
    themeId: theme.id,
    themeName: theme.name,
    templateFilename,
    syncedAt: Date.now(),
    sections,
  };
}

// Query shapes follow Shopify CLI's get_themes/get_theme_file_bodies queries.
const THEMES = `query FukPagesThemes($after: String) { themes(first: 50, after: $after) { nodes { id name role processing } pageInfo { hasNextPage endCursor } } }`;
const FILES = `query FukPagesThemeFiles($id: ID!, $after: String, $filenames: [String!]) { theme(id: $id) { files(first: 250, after: $after, filenames: $filenames) { nodes { filename body { __typename ... on OnlineStoreThemeFileBodyText { content } ... on OnlineStoreThemeFileBodyBase64 { contentBase64 } ... on OnlineStoreThemeFileBodyUrl { url } } } userErrors { filename code } pageInfo { hasNextPage endCursor } } } }`;
export function createShopifyThemeService({
  domain = process.env.SHOPIFY_SHOP_DOMAIN,
  token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
  fetchImpl = fetch,
} = {}) {
  const configuredDomain =
    domain && /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(domain)
      ? domain.toLowerCase()
      : "";
  const configured = (shop) => !!token && shop === configuredDomain;
  async function request(shop, query, variables) {
    let response;
    try {
      response = await fetchImpl(
        `https://${shop}/admin/api/2026-10/graphql.json`,
        {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(20000),
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": token,
          },
          body: JSON.stringify({ query, variables }),
        },
      );
    } catch {
      throw new ThemeSyncError(
        "Shopify bağlantısı kurulamadı. Ağ erişimini ve mağaza adresini kontrol edin.",
      );
    }
    if ([401, 403].includes(response.status))
      throw new ThemeSyncError(
        "Shopify tema okuma yetkisi doğrulanamadı. read_themes erişimi gerekli.",
        403,
      );
    if (response.status === 429)
      throw new ThemeSyncError(
        "Shopify istek sınırına ulaşıldı. Bir süre sonra tekrar senkronize edin.",
        429,
      );
    if (!response.ok)
      throw new ThemeSyncError("Shopify tema isteğini tamamlayamadı.");
    let body;
    try {
      body = await response.json();
    } catch {
      throw new ThemeSyncError("Shopify geçerli bir tema yanıtı döndürmedi.");
    }
    if (body.errors?.length || !body.data)
      throw new ThemeSyncError(
        "Tema dosyaları okunamadı. read_themes yetkisini ve API erişimini kontrol edin.",
      );
    return body.data;
  }
  async function getFiles(shop, themeId, filenames) {
    const result = new Map();
    let after = null;
    for (let page = 0; page < 12; page++) {
      const data = await request(shop, FILES, {
        id: themeId,
        filenames: [...new Set(filenames)],
        after,
      });
      const connection = data.theme?.files;
      if (!connection?.nodes || !connection.pageInfo)
        throw new ThemeSyncError(
          "Tema dosyaları için geçerli yanıt alınamadı.",
        );
      for (const file of connection.nodes) {
        if (!filenames.includes(file.filename)) continue;
        const body = file.body;
        let content;
        if (body?.__typename === "OnlineStoreThemeFileBodyText")
          content = body.content;
        else if (body?.__typename === "OnlineStoreThemeFileBodyBase64")
          content = Buffer.from(body.contentBase64, "base64").toString("utf8");
        else if (body?.__typename === "OnlineStoreThemeFileBodyUrl") {
          const url = new URL(body.url);
          if (
            url.protocol !== "https:" ||
            url.hostname !== "cdn.shopify.com" ||
            url.username ||
            url.password
          )
            throw new ThemeSyncError(
              "Tema dosyasının indirme adresi desteklenmiyor.",
            );
          const asset = await fetchImpl(url.href, {
            redirect: "error",
            signal: AbortSignal.timeout(15000),
          });
          if (!asset.ok)
            throw new ThemeSyncError(
              "Tema dosyası Shopify CDN üzerinden indirilemedi.",
            );
          content = await asset.text();
        }
        if (typeof content !== "string" || content.length > 2_000_000)
          throw new ThemeSyncError(
            "Tema dosyası metin olarak okunamadı veya boyut sınırını aşıyor.",
          );
        result.set(file.filename, content);
      }
      if (!connection.pageInfo.hasNextPage) return result;
      const next = connection.pageInfo.endCursor;
      if (!next || next === after)
        throw new ThemeSyncError("Tema dosyalarının devam sayfası okunamadı.");
      after = next;
    }
    throw new ThemeSyncError("Tema dosyaları sayfalama sınırını aşıyor.");
  }
  return {
    configured,
    async sync(value, templateFilename = "templates/index.json") {
      const shopDomain = normalizeShopDomain(value);
      if (!configured(shopDomain))
        throw new ThemeSyncError(
          "Bu mağazanın Shopify bağlantısı henüz yapılandırılmadı.",
          503,
        );
      if (!allowedTemplate(templateFilename))
        throw new ThemeSyncError("Geçersiz tema şablonu.", 400);
      const themes = [];
      let after = null;
      for (let page = 0; page < 8; page++) {
        const data = await request(shopDomain, THEMES, { after });
        if (!data.themes?.nodes || !data.themes.pageInfo)
          throw new ThemeSyncError("Mağaza temaları okunamadı.");
        themes.push(...data.themes.nodes);
        if (!data.themes.pageInfo.hasNextPage) break;
        const next = data.themes.pageInfo.endCursor;
        if (!next || next === after || page === 7)
          throw new ThemeSyncError("Tema listesinin devam sayfası okunamadı.");
        after = next;
      }
      const theme = themes.find((item) => item.role === "MAIN");
      if (!theme || theme.processing)
        throw new ThemeSyncError(
          "Yayındaki tema bulunamadı veya tema hâlâ hazırlanıyor.",
        );
      const files = await getFiles(shopDomain, theme.id, [
        "layout/theme.liquid",
        templateFilename,
      ]);
      const layout = files.get("layout/theme.liquid") ?? "";
      const references = [
        ...layout.matchAll(
          /{%[-]?\s*(section|sections)\s+['"]([\w-]+)['"]\s*[-]?%}/g,
        ),
      ];
      const groupFiles = references
        .filter((match) => match[1] === "sections")
        .map((match) => `sections/${match[2]}.json`);
      if (references.some((match) => match[1] === "section"))
        groupFiles.push("config/settings_data.json");
      if (groupFiles.length)
        for (const [name, content] of await getFiles(
          shopDomain,
          theme.id,
          groupFiles,
        ))
          files.set(name, content);
      const types = new Set(
        references
          .filter((match) => match[1] === "section")
          .map((match) => match[2]),
      );
      for (const name of [
        ...groupFiles.filter(
          (name) =>
            name.endsWith(".json") && name !== "config/settings_data.json",
        ),
        templateFilename,
      ]) {
        if (!files.has(name)) continue;
        for (const entry of orderedSections(
          readThemeJson(files.get(name), name),
          name,
        ))
          types.add(entry.type);
      }
      const schemaFiles = [...types].map((type) => `sections/${type}.liquid`);
      if (schemaFiles.length)
        for (const [name, content] of await getFiles(
          shopDomain,
          theme.id,
          schemaFiles,
        ))
          files.set(name, content);
      return buildThemeSnapshot({ shopDomain, theme, templateFilename, files });
    },
  };
}
