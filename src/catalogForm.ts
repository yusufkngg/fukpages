// Pure helpers behind the visual catalogue editor: money parsing, ids and the
// same validation the server applies, reported per field so the form can point
// at the exact input that needs fixing.
import { t } from "./i18n.ts";
import type { Catalog, Product, Variant } from "./Commerce";

export type Collection = Catalog["collections"][number];
export interface CatalogIssue {
  /** "product:<index>", "product:<index>:variant:<index>" or "collection:<index>" */
  path: string;
  field: string;
  message: string;
}

export const currencies = ["TRY", "USD", "EUR", "GBP"] as const;

/** "1.299,90", "1299.9", "1 299" or "₺199" → minor units; null when invalid. */
export function parseMoney(input: string): number | null {
  let value = String(input ?? "")
    .replace(/[^\d.,-]/g, "")
    .trim();
  if (!value) return 0;
  if (value.startsWith("-")) return null;
  const lastComma = value.lastIndexOf(","),
    lastDot = value.lastIndexOf(".");
  const decimal = Math.max(lastComma, lastDot);
  let whole = value,
    fraction = "";
  // A separator followed by one or two digits is the decimal mark; three
  // digits after a single separator means thousands ("1.299").
  if (decimal >= 0 && value.length - decimal - 1 <= 2) {
    whole = value.slice(0, decimal);
    fraction = value.slice(decimal + 1);
  }
  // Thousands groups must have exactly three digits ("1.299.000").
  if (whole.split(/[.,]/).some((group, i) => i > 0 && group.length !== 3))
    return null;
  whole = whole.replace(/[.,]/g, "");
  if (!/^\d*$/.test(whole) || !/^\d{0,2}$/.test(fraction)) return null;
  const minor = Number(whole || "0") * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Minor units → an editable string in the interface's decimal style. */
export function moneyInput(minor: number, locale = "en-US") {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format((minor || 0) / 100);
}

const turkish: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
};
/** A readable, unique id ("aura-mini", "aura-mini-2") for a title. */
export function makeId(
  title: string,
  taken: Iterable<string>,
  fallback = "item",
) {
  const used = new Set(taken);
  const base =
    String(title || "")
      .toLocaleLowerCase("tr")
      .replace(/[çğıöşü]/g, (c) => turkish[c])
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || fallback;
  let id = base,
    n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  return id;
}

export function blankVariant(product: Product): Variant {
  return {
    id: makeId(
      `${product.id}-${t("varyant")}`,
      product.variants.map((v) => v.id),
      "variant",
    ),
    title: t("Standart"),
    price: product.variants[0]?.price ?? 0,
    comparePrice: 0,
    stock: 0,
    image: "",
    options: Object.fromEntries(optionNames(product).map((name) => [name, ""])),
  };
}

export function blankProduct(catalog: Catalog): Product {
  const id = makeId(
    t("Yeni ürün"),
    catalog.products.map((p) => p.id),
    "product",
  );
  return {
    id,
    title: t("Yeni ürün"),
    description: "",
    currency: catalog.products[0]?.currency || "TRY",
    images: [],
    metafields: {},
    variants: [
      {
        id: `${id}-default`,
        title: t("Standart"),
        price: 0,
        comparePrice: 0,
        stock: 0,
        image: "",
        options: {},
      },
    ],
  };
}

export function blankCollection(catalog: Catalog): Collection {
  return {
    id: makeId(
      t("Yeni koleksiyon"),
      catalog.collections.map((c) => c.id),
      "collection",
    ),
    title: t("Yeni koleksiyon"),
    description: "",
    image: "",
    productIds: [],
  };
}

/** Option names used by any variant, in first-seen order ("Color", "Size"). */
export function optionNames(product: Product) {
  const names: string[] = [];
  for (const v of product.variants)
    for (const name of Object.keys(v.options || {}))
      if (!names.includes(name)) names.push(name);
  return names;
}

export function duplicateProduct(catalog: Catalog, product: Product): Product {
  const taken = catalog.products.map((p) => p.id);
  const id = makeId(`${product.id}-${t("kopya")}`, taken, "product");
  return {
    ...structuredClone(product),
    id,
    title: t("{p0} kopya", { p0: product.title }),
    variants: product.variants.map((v, i) => ({
      ...structuredClone(v),
      id: `${id}-${i + 1}`,
    })),
  };
}

const validId = (v: string) => /^[\w-]{1,100}$/.test(v);
const validUrl = (v: string) => !v || /^(https?:\/\/|\/(?!\/))/.test(v);

/** Mirrors server/catalog.mjs so problems show before saving. */
export function validateCatalog(catalog: Catalog): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  const add = (path: string, field: string, message: string) =>
    issues.push({ path, field, message });
  if (catalog.products.length > 500)
    add("catalog", "products", t("En fazla 500 ürün eklenebilir."));
  if (catalog.collections.length > 100)
    add("catalog", "collections", t("En fazla 100 koleksiyon eklenebilir."));
  const productIds = new Set<string>();
  catalog.products.forEach((p, pi) => {
    const path = `product:${pi}`;
    if (!validId(p.id))
      add(path, "id", t("Kimlik yalnızca harf, rakam, - ve _ içerebilir."));
    else if (productIds.has(p.id))
      add(path, "id", t("Bu ürün kimliği başka bir üründe kullanılıyor."));
    productIds.add(p.id);
    if (!p.title.trim()) add(path, "title", t("Ürün adı gerekli."));
    if (p.title.length > 200)
      add(path, "title", t("Ürün adı en fazla 200 karakter olabilir."));
    if (!/^[A-Z]{3}$/.test(p.currency))
      add(path, "currency", t("Para birimi üç harfli kod olmalı (TRY)."));
    if (p.images.length > 30)
      add(path, "images", t("En fazla 30 görsel eklenebilir."));
    p.images.forEach((src) => {
      if (!validUrl(src))
        add(path, "images", t("Görsel adresi / veya https:// ile başlamalı."));
    });
    if (!p.variants.length)
      add(path, "variants", t("Her ürün en az bir varyant içermeli."));
    if (p.variants.length > 100)
      add(path, "variants", t("En fazla 100 varyant eklenebilir."));
    const variantIds = new Set<string>();
    p.variants.forEach((v, vi) => {
      const vpath = `${path}:variant:${vi}`;
      if (!validId(v.id))
        add(vpath, "id", t("Kimlik yalnızca harf, rakam, - ve _ içerebilir."));
      else if (variantIds.has(v.id))
        add(vpath, "id", t("Varyant kimlikleri benzersiz olmalı."));
      variantIds.add(v.id);
      if (!Number.isSafeInteger(v.price) || v.price < 0)
        add(vpath, "price", t("Geçerli bir fiyat gir."));
      if (v.comparePrice && v.comparePrice <= v.price)
        add(
          vpath,
          "comparePrice",
          t("Karşılaştırma fiyatı satış fiyatından yüksek olmalı."),
        );
      if (!Number.isSafeInteger(v.stock) || v.stock < 0)
        add(vpath, "stock", t("Stok sıfır veya pozitif tam sayı olmalı."));
      if (!validUrl(v.image))
        add(vpath, "image", t("Görsel adresi / veya https:// ile başlamalı."));
    });
  });
  const collectionIds = new Set<string>();
  catalog.collections.forEach((c, ci) => {
    const path = `collection:${ci}`;
    if (!validId(c.id))
      add(path, "id", t("Kimlik yalnızca harf, rakam, - ve _ içerebilir."));
    else if (collectionIds.has(c.id))
      add(
        path,
        "id",
        t("Bu koleksiyon kimliği başka bir koleksiyonda kullanılıyor."),
      );
    collectionIds.add(c.id);
    if (!c.title.trim()) add(path, "title", t("Koleksiyon adı gerekli."));
    if (!validUrl(c.image))
      add(path, "image", t("Görsel adresi / veya https:// ile başlamalı."));
    if (c.productIds.some((id) => !productIds.has(id)))
      add(path, "productIds", t("Koleksiyonda silinmiş bir ürün var."));
  });
  return issues;
}

/** Removing a product also removes it from every collection. */
export function removeProduct(catalog: Catalog, id: string): Catalog {
  return {
    ...catalog,
    products: catalog.products.filter((p) => p.id !== id),
    collections: catalog.collections.map((c) => ({
      ...c,
      productIds: c.productIds.filter((p) => p !== id),
    })),
  };
}

/** Renaming a product id keeps collection membership. */
export function renameProductId(catalog: Catalog, from: string, to: string) {
  return catalog.collections.map((c) => ({
    ...c,
    productIds: c.productIds.map((id) => (id === from ? to : id)),
  }));
}

export function priceRange(product: Product) {
  const prices = product.variants.map((v) => v.price);
  return [Math.min(...prices), Math.max(...prices)] as const;
}
