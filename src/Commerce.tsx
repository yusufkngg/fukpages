import { getUiLocale, t } from "./i18n.ts";
import { Dialog } from "./Dialog";
import { trackEvent } from "./metrics";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Block } from "./model";
import { api, json } from "./api";
import { assetUrl, useStudio } from "./studio";
export interface Variant {
  id: string;
  title: string;
  price: number;
  comparePrice: number;
  stock: number;
  image: string;
  options: Record<string, string>;
}
export interface Product {
  id: string;
  title: string;
  description: string;
  currency: string;
  images: string[];
  metafields: Record<string, string>;
  variants: Variant[];
}
export interface Catalog {
  source: "local";
  products: Product[];
  collections: {
    id: string;
    title: string;
    description: string;
    image: string;
    productIds: string[];
  }[];
  version?: number;
}
const emptyCatalog: Catalog = {
  source: "local",
  products: [],
  collections: [],
};
export const CatalogContext = createContext<{
  catalog: Catalog;
  selected: Record<string, string>;
  quantity: Record<string, number>;
  choose: (id: string, v: string) => void;
  setQty: (id: string, n: number) => void;
  add: (id: string, offers?: string) => void;
  addBundle: (ids: string[], discount: number) => void;
  cart: {
    productId: string;
    variantId: string;
    quantity: number;
    discount?: number;
  }[];
  total: number;
  message: string;
}>({
  catalog: emptyCatalog,
  selected: {},
  quantity: {},
  choose: () => {},
  setQty: () => {},
  add: () => {},
  addBundle: () => {},
  cart: [],
  total: 0,
  message: "",
});
export function CommerceProvider({
  catalog = emptyCatalog,
  children,
}: {
  catalog?: Catalog;
  children: ReactNode;
}) {
  const { storeId, pageId } = useStudio();
  const [selected, setSelected] = useState<Record<string, string>>({}),
    [quantity, setQuantity] = useState<Record<string, number>>({}),
    [cart, setCart] = useState<
      {
        productId: string;
        variantId: string;
        quantity: number;
        discount?: number;
      }[]
    >([]),
    [open, setOpen] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    try {
      const raw = JSON.parse(
        localStorage.getItem("fp-cart-" + storeId) || "[]",
      );
      if (Array.isArray(raw))
        setCart(
          raw.filter(
            (i) =>
              catalog.products.some(
                (p) =>
                  p.id === i.productId &&
                  p.variants.some((v) => v.id === i.variantId),
              ) &&
              Number.isInteger(i.quantity) &&
              i.quantity > 0,
          ),
        );
    } catch {}
  }, [storeId, catalog]);
  const add = (productId: string, offers = "") => {
    const eventId = crypto.randomUUID();
    const product = catalog.products.find((p) => p.id === productId),
      v = product?.variants.find(
        (v) => v.id === (selected[productId] || product.variants[0]?.id),
      ),
      qty = quantity[productId] || 1;
    if (!product || !v) {
      setMessage(t("Önce ürün ve varyant seç."));
      return;
    }
    setCart((old) => {
      const prior = old.find(
          (i) => i.variantId === v.id && i.productId === productId,
        ),
        sum = qty + (prior?.quantity || 0);
      if (sum > v.stock) {
        setMessage(t("Bu varyant için yeterli stok yok."));
        return old;
      }
      const next = [
        ...old.filter((i) => i !== prior),
        {
          productId,
          variantId: v.id,
          quantity: sum,
          discount: Math.max(
            0,
            ...offers.split(",").map((t) => {
              const [n, d] = t.split(":").map(Number);
              return sum >= n && Number.isFinite(d) && d >= 0 && d <= 90
                ? d
                : 0;
            }),
          ),
        },
      ];
      localStorage.setItem("fp-cart-" + storeId, JSON.stringify(next));
      setMessage(t("Yerel sepete eklendi. Shopify ödeme bağlantısı kapalı."));
      trackEvent(pageId, "add_to_cart", eventId);
      return next;
    });
  };
  useEffect(() => {
    const show = () => setOpen(true),
      append = (e: Event) =>
        add(String((e as CustomEvent).detail?.productId || ""));
    window.addEventListener("fukpages:cart", show);
    window.addEventListener("fukpages:add", append);
    return () => {
      window.removeEventListener("fukpages:cart", show);
      window.removeEventListener("fukpages:add", append);
    };
  });
  const addBundle = (ids: string[], discount: number) => {
    const eventId = crypto.randomUUID();
    const unique = [...new Set(ids)];
    if (!unique.length) return;
    setCart((old) => {
      const added = unique.map((productId) => {
        const product = catalog.products.find((p) => p.id === productId),
          variant = product?.variants.find(
            (v) => v.id === (selected[productId] || product.variants[0]?.id),
          );
        return { productId, variant, quantity: quantity[productId] || 1 };
      });
      if (
        added.some(
          (i) =>
            !i.variant ||
            i.quantity +
              (old.find(
                (c) =>
                  c.productId === i.productId && c.variantId === i.variant?.id,
              )?.quantity || 0) >
              i.variant.stock,
        )
      ) {
        setMessage(t("Pakette eksik ürün veya yetersiz stok var."));
        return old;
      }
      let next = [...old];
      for (const item of added) {
        next = next.filter(
          (i) =>
            !(
              i.productId === item.productId && i.variantId === item.variant!.id
            ),
        );
        next.push({
          productId: item.productId,
          variantId: item.variant!.id,
          quantity:
            item.quantity +
            (old.find(
              (i) =>
                i.productId === item.productId &&
                i.variantId === item.variant!.id,
            )?.quantity || 0),
          discount: Math.max(0, Math.min(90, discount)),
        });
      }
      localStorage.setItem("fp-cart-" + storeId, JSON.stringify(next));
      setMessage(t("Paket yerel sepete eklendi. Ödeme bağlantısı kapalı."));
      trackEvent(pageId, "add_to_cart", eventId);
      return next;
    });
  };
  const total = cart.reduce(
    (sum, item) =>
      sum +
      (catalog.products
        .find((p) => p.id === item.productId)
        ?.variants.find((v) => v.id === item.variantId)?.price || 0) *
        item.quantity *
        (1 - (item.discount || 0) / 100),
    0,
  );
  return (
    <CatalogContext.Provider
      value={{
        catalog,
        selected,
        quantity,
        choose: (id, v) => setSelected((s) => ({ ...s, [id]: v })),
        setQty: (id, n) => setQuantity((q) => ({ ...q, [id]: n })),
        add,
        addBundle,
        cart,
        total,
        message,
      }}
    >
      {children}
      {message && (
        <div className="cart-status" role="alert">
          {message}
          <button onClick={() => setMessage("")}>{t("Kapat")}</button>
        </div>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        label={t("Yerel sepet")}
      >
        <h2>{t("Yerel sepet önizlemesi")}</h2>
        {cart.map((i) => (
          <p key={i.productId + i.variantId}>
            {catalog.products.find((p) => p.id === i.productId)?.title} ·{" "}
            {i.quantity}
            {" " + t("adet")}
            <button
              onClick={() => {
                const next = cart.filter((c) => c !== i);
                setCart(next);
                localStorage.setItem(
                  "fp-cart-" + storeId,
                  JSON.stringify(next),
                );
              }}
            >
              {t("Kaldır")}
            </button>
          </p>
        ))}
        <p>
          {t("Ödeme işlemi Shopify bağlantısıyla sonraki aşamada açılacak.")}
        </p>
      </Dialog>
    </CatalogContext.Provider>
  );
}
const money = (n: number, currency: string) =>
  new Intl.NumberFormat(getUiLocale(), {
    style: "currency",
    currency: /^[A-Z]{3}$/.test(currency) ? currency : "TRY",
  }).format(n / 100);
export function CommerceBlock({
  node,
  editable = false,
}: {
  node: Block;
  editable?: boolean;
}) {
  const c = useContext(CatalogContext),
    { previewToken, activeProductId, activeCollectionId } = useStudio(),
    p = node.props,
    product = c.catalog.products.find(
      (v) =>
        v.id ===
        (p.resourceBinding === "page" || !p.productId
          ? activeProductId
          : p.productId),
    ),
    variant = product?.variants.find(
      (v) => v.id === (c.selected[product.id] || product.variants[0]?.id),
    );
  const [active, setActive] = useState(0),
    [zoom, setZoom] = useState(false),
    [sort, setSort] = useState("default"),
    [page, setPage] = useState(0);
  useEffect(() => setActive(0), [variant?.id]);
  if (node.kind === "collectionGrid") {
    const collection = c.catalog.collections.find(
      (v) =>
        v.id ===
        (p.resourceBinding === "page" || !p.collectionId
          ? activeCollectionId
          : p.collectionId),
    );
    let products = collection
      ? collection.productIds
          .map((id) => c.catalog.products.find((p) => p.id === id)!)
          .filter(Boolean)
      : [];
    if (sort === "price")
      products = [...products].sort(
        (a, b) => a.variants[0].price - b.variants[0].price,
      );
    if (sort === "title")
      products = [...products].sort((a, b) => a.title.localeCompare(b.title));
    const size = Math.max(1, Math.min(24, Number(p.pageSize || 6)));
    const Heading = p.tag === "h1" ? "h1" : "h3";
    return (
      <div>
        <Heading>{collection?.title || t("Yerel koleksiyon seç")}</Heading>
        <p>{collection?.description}</p>
        {collection?.image && (
          <img
            src={assetUrl(collection.image, previewToken)}
            alt={collection.title}
          />
        )}
        <select
          aria-label={t("Ürün sıralaması")}
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(0);
          }}
        >
          <option value="default">{t("Varsayılan")}</option>
          <option value="price">{t("Fiyat")}</option>
          <option value="title">{t("Ürün adı")}</option>
        </select>
        <div
          className={`builder-product-grid ${p.view === "carousel" ? "carousel" : ""}`}
        >
          {products.slice(page * size, (page + 1) * size).map((pr) => (
            <article key={pr.id}>
              <img
                src={assetUrl(pr.images[0], previewToken)}
                alt={pr.title}
                loading="lazy"
              />
              <h4>{pr.title}</h4>
              <b>{money(pr.variants[0].price, pr.currency)}</b>
              <p>{pr.description}</p>
            </article>
          ))}
        </div>
        <button disabled={!page} onClick={() => setPage(page - 1)}>
          {t("Önceki")}
        </button>
        <button
          disabled={(page + 1) * size >= products.length}
          onClick={() => setPage(page + 1)}
        >
          {t("Sonraki")}
        </button>
      </div>
    );
  }
  if (node.kind === "shipping") {
    const left = Math.max(0, Number(p.threshold || 1000) * 100 - c.total);
    return (
      <div>
        <b>{String(p.title || t("Teslimat ve iade"))}</b>
        <p>{String(p.description || "")}</p>
        <p>
          {left
            ? t("Ücretsiz kargoya {p0} kaldı.", {
                p0: money(left, String(p.currency || "TRY")),
              })
            : t("Ücretsiz kargo eşiğine ulaşıldı.")}{" "}
          {t("· Yerel sepet")}
        </p>
      </div>
    );
  }
  if (node.kind === "bundle") {
    const ids = String(p.productIds || p.productId || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      selectedProducts = ids
        .map((id) => c.catalog.products.find((p) => p.id === id))
        .filter(Boolean) as Product[];
    return (
      <div>
        <h3>{String(p.title || t("Paket teklif"))}</h3>
        {selectedProducts.map((pr) => (
          <p key={pr.id}>
            {pr.title} · {money(pr.variants[0].price, pr.currency)}
          </p>
        ))}
        <p>
          {t("Paket indirimi %")}
          {Number(p.discountPercent || 0)}
        </p>
        <button
          disabled={selectedProducts.length !== ids.length || !ids.length}
          onClick={() => {
            if (!editable) c.addBundle(ids, Number(p.discountPercent || 0));
          }}
        >
          {t("Paketi yerel sepete ekle")}
        </button>
        <small role="status">{c.message}</small>
      </div>
    );
  }
  if (!product)
    return (
      <div className="integration-placeholder">
        {t("Yerel katalogdan ürün seç · Shopify bağlantısı kapalı")}
      </div>
    );
  switch (node.kind) {
    case "productField": {
      const Tag = p.field === "title" && p.tag === "h1" ? "h1" : "span";
      return (
        <Tag>
          {p.field === "price"
            ? money(variant?.price || 0, product.currency)
            : p.field === "comparePrice"
              ? money(variant?.comparePrice || 0, product.currency)
              : p.field === "metafield"
                ? product.metafields[String(p.metafield)] || ""
                : p.field === "description"
                  ? product.description
                  : product.title}
        </Tag>
      );
    }
    case "productGallery": {
      const images = variant?.image
        ? [variant.image, ...product.images]
        : product.images;
      return (
        <div className="builder-product-gallery">
          <img
            src={assetUrl(images[active % images.length], previewToken)}
            alt={product.title}
            onClick={() => setZoom(true)}
          />
          <div>
            {images.map((u, i) => (
              <button
                aria-label={t("Ürün görseli {p0}", { p0: i + 1 })}
                key={i}
                onClick={() => setActive(i)}
              >
                <img src={assetUrl(u, previewToken)} alt="" />
              </button>
            ))}
          </div>
          <Dialog
            open={zoom && !editable}
            onClose={() => setZoom(false)}
            label={t("Ürün yakınlaştırma")}
          >
            <img
              src={assetUrl(images[active % images.length], previewToken)}
              alt={product.title}
            />
          </Dialog>
        </div>
      );
    }
    case "variantPicker":
      return (
        <label className="builder-variant-picker">
          {t("Varyant")}
          {p.variantMode === "buttons" ? (
            <span>
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  disabled={!v.stock}
                  aria-pressed={variant?.id === v.id}
                  onClick={() => c.choose(product.id, v.id)}
                >
                  {v.title}
                </button>
              ))}
            </span>
          ) : (
            <select
              aria-label={t("Ürün varyantı")}
              value={variant?.id}
              onChange={(e) => {
                c.choose(product.id, e.target.value);
                setActive(0);
              }}
            >
              {product.variants.map((v) => (
                <option key={v.id} value={v.id} disabled={!v.stock}>
                  {v.title} · {money(v.price, product.currency)}
                  {!v.stock ? " · Stokta yok" : ""}
                </option>
              ))}
            </select>
          )}
          <small>
            {variant?.stock
              ? t("{p0} adet stokta", { p0: variant.stock })
              : t("Stokta yok")}
          </small>
        </label>
      );
    case "quantity":
      return (
        <label className="builder-quantity-picker">
          {t("Adet")}
          <input
            aria-label={t("Ürün adedi")}
            type="number"
            min={1}
            max={variant?.stock || 1}
            value={c.quantity[product.id] || 1}
            onChange={(e) =>
              c.setQty(
                product.id,
                Math.max(
                  1,
                  Math.min(variant?.stock || 1, Number(e.target.value)),
                ),
              )
            }
          />
        </label>
      );
    case "addToCart":
    case "stickyCart":
      return (
        <div
          className={`builder-purchase-controls ${node.kind === "stickyCart" ? "builder-sticky-cart" : ""}`}
        >
          <b>
            {product.title} · {money(variant?.price || 0, product.currency)}
          </b>
          <button
            disabled={!variant?.stock}
            onClick={() => {
              if (!editable) c.add(product.id, String(p.quantityOffers || ""));
            }}
          >
            {variant?.stock ? t("Yerel sepete ekle") : t("Stokta yok")}
          </button>
          <button
            onClick={() =>
              window.dispatchEvent(new CustomEvent("fukpages:cart"))
            }
          >
            {t("Sepeti aç")}
          </button>
          <small role="status">{c.message}</small>
        </div>
      );
    case "product":
      return (
        <article>
          <img
            src={assetUrl(product.images[0], previewToken)}
            alt={product.title}
          />
          <h3>{product.title}</h3>
          <b>{money(variant?.price || 0, product.currency)}</b>
          {!!variant?.comparePrice && (
            <s>{money(variant.comparePrice, product.currency)}</s>
          )}
          <p>{product.description}</p>
          <small>{t("Yerel katalog ürünü")}</small>
        </article>
      );
    default:
      return null;
  }
}
export function CatalogPanel({
  storeId,
  refresh,
  notify,
}: {
  storeId: string;
  refresh: () => Promise<void>;
  notify: (s: string, e?: boolean) => void;
}) {
  const [data, setData] = useState(""),
    [version, setVersion] = useState(0);
  useEffect(() => {
    api<Catalog>(`/stores/${storeId}/catalog`)
      .then((r) => {
        setData(
          JSON.stringify(
            { products: r.products, collections: r.collections },
            null,
            2,
          ),
        );
        setVersion(r.version || 0);
      })
      .catch((e) => notify(e.message, true));
  }, [storeId]);
  return (
    <div className="library-scroll feature-panel">
      <h3>{t("Yerel ürün kataloğu")}</h3>
      <p>
        {t(
          "Shopify bağlantısı olmadan kendi ürün/varyant verilerini ekle. Fiyatlar kuruş cinsindendir. Bu katalog ödeme oluşturmaz.",
        )}
      </p>
      <textarea
        aria-label={t("Yerel katalog JSON")}
        rows={24}
        value={data}
        onChange={(e) => setData(e.target.value)}
      />
      <button
        onClick={() =>
          setData(
            JSON.stringify(
              {
                products: [
                  {
                    id: "product-1",
                    title: t("Ürün adı"),
                    description: t("Ürün açıklaması"),
                    currency: "TRY",
                    images: ["/assets/headphones.svg"],
                    metafields: { "details.material": t("Malzeme") },
                    variants: [
                      {
                        id: "variant-1",
                        title: t("Standart"),
                        price: 19900,
                        comparePrice: 24900,
                        stock: 10,
                        options: { Renk: t("Siyah") },
                        image: "/assets/headphones.svg",
                      },
                    ],
                  },
                ],
                collections: [
                  {
                    id: "collection-1",
                    title: t("Koleksiyon"),
                    description: t("Koleksiyon açıklaması"),
                    productIds: ["product-1"],
                  },
                ],
              },
              null,
              2,
            ),
          )
        }
      >
        {t("Düzenlenebilir veri örneği")}
      </button>
      <button
        className="feature-primary"
        onClick={async () => {
          try {
            const r = await api<Catalog>(`/stores/${storeId}/catalog`, {
              method: "PUT",
              body: json({ ...JSON.parse(data), version }),
            });
            setVersion(r.version || 0);
            await refresh();
            notify(t("Yerel katalog kaydedildi."));
          } catch (e) {
            notify((e as Error).message, true);
          }
        }}
      >
        {t("Kataloğu kaydet")}
      </button>
    </div>
  );
}
