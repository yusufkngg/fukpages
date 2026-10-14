// Visual editor for the local demo catalogue: products, variants, images,
// metafields and collections are edited with forms instead of raw JSON. The
// draft is saved in one request with the catalogue version, so a change made
// elsewhere is reported instead of overwritten.
import { getUiLocale, t } from "./i18n.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, json } from "./api";
import { Dialog } from "./Dialog";
import { assetUrl, type Asset } from "./studio";
import {
  money,
  withSampleProducts,
  type Catalog,
  type Product,
  type Variant,
} from "./Commerce";
import {
  blankCollection,
  blankProduct,
  blankVariant,
  currencies,
  duplicateProduct,
  makeId,
  moneyInput,
  optionNames,
  parseMoney,
  priceRange,
  removeProduct,
  renameProductId,
  validateCatalog,
  type CatalogIssue,
  type Collection,
} from "./catalogForm";

type Editing = { kind: "product" | "collection"; index: number } | null;
const emptyCatalog: Catalog = {
  source: "local",
  products: [],
  collections: [],
};
const plain = (c: Catalog) =>
  JSON.stringify({ products: c.products, collections: c.collections });

export function CatalogPanel({
  storeId,
  assets = [],
  refresh,
  notify,
}: {
  storeId: string;
  assets?: Asset[];
  refresh: () => Promise<void>;
  notify: (s: string, e?: boolean) => void;
}) {
  const [draft, setDraft] = useState<Catalog>(emptyCatalog),
    [saved, setSaved] = useState(plain(emptyCatalog)),
    [version, setVersion] = useState(0),
    [status, setStatus] = useState<"loading" | "ready" | "error">("loading"),
    [loadError, setLoadError] = useState(""),
    [tab, setTab] = useState<"products" | "collections">("products"),
    [query, setQuery] = useState(""),
    [editing, setEditing] = useState<Editing>(null),
    [busy, setBusy] = useState(false),
    [conflict, setConflict] = useState(false),
    [jsonText, setJsonText] = useState(""),
    [jsonError, setJsonError] = useState("");
  async function load() {
    setStatus("loading");
    try {
      const r = await api<Catalog>(`/stores/${storeId}/catalog`);
      const next = { ...emptyCatalog, ...r };
      setDraft(next);
      setSaved(plain(next));
      setVersion(r.version || 0);
      setConflict(false);
      setStatus("ready");
    } catch (e) {
      setLoadError((e as Error).message);
      setStatus("error");
    }
  }
  useEffect(() => {
    void load();
  }, [storeId]);
  const dirty = plain(draft) !== saved;
  const issues = useMemo(() => validateCatalog(draft), [draft]);
  const issuesFor = (path: string) =>
    issues.filter((i) => i.path === path || i.path.startsWith(`${path}:`));
  const needle = query.trim().toLocaleLowerCase(getUiLocale());
  const match = (text: string) =>
    !needle || text.toLocaleLowerCase(getUiLocale()).includes(needle);
  const update = (fn: (c: Catalog) => Catalog) => setDraft((c) => fn(c));
  async function save() {
    if (issues.length) {
      const first = issues[0];
      const [kind, index] = first.path.split(":");
      if (kind === "product" || kind === "collection") {
        setTab(kind === "product" ? "products" : "collections");
        setEditing({ kind, index: Number(index) });
      }
      notify(t("Kaydedilmedi: {p0}", { p0: first.message }), true);
      return;
    }
    setBusy(true);
    try {
      const r = await api<Catalog>(`/stores/${storeId}/catalog`, {
        method: "PUT",
        body: json({
          products: draft.products,
          collections: draft.collections,
          version,
        }),
      });
      const next = { ...emptyCatalog, ...r };
      setDraft(next);
      setSaved(plain(next));
      setVersion(r.version || 0);
      await refresh();
      notify(t("Yerel katalog kaydedildi."));
    } catch (e) {
      const message = (e as Error).message;
      if (/değişti|changed/i.test(message)) setConflict(true);
      notify(message, true);
    } finally {
      setBusy(false);
    }
  }
  if (status === "loading")
    return (
      <div className="library-scroll feature-panel catalog-panel" aria-busy>
        <h3>{t("Yerel ürün kataloğu")}</h3>
        <div className="skeleton-list" aria-label={t("Yükleniyor")}>
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  if (status === "error")
    return (
      <div className="library-scroll feature-panel catalog-panel">
        <h3>{t("Yerel ürün kataloğu")}</h3>
        <p className="panel-error" role="alert">
          {t("Katalog yüklenemedi: {p0}", { p0: loadError })}
        </p>
        <button onClick={() => void load()}>{t("Tekrar dene")}</button>
      </div>
    );
  const products = draft.products
    .map((product, index) => ({ product, index }))
    .filter(({ product }) => match(`${product.title} ${product.id}`));
  const collections = draft.collections
    .map((collection, index) => ({ collection, index }))
    .filter(({ collection }) => match(`${collection.title} ${collection.id}`));
  const editedProduct =
    editing?.kind === "product" ? draft.products[editing.index] : undefined;
  const editedCollection =
    editing?.kind === "collection"
      ? draft.collections[editing.index]
      : undefined;
  return (
    <div className="library-scroll feature-panel catalog-panel">
      <h3>{t("Yerel ürün kataloğu")}</h3>
      <p>
        {t(
          "Shopify bağlantısı olmadan ürün, varyant ve koleksiyon ekle. Bu katalog ödeme oluşturmaz.",
        )}
      </p>
      <div className="catalog-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "products"}
          onClick={() => setTab("products")}
        >
          {t("Ürünler ({p0})", { p0: draft.products.length })}
        </button>
        <button
          role="tab"
          aria-selected={tab === "collections"}
          onClick={() => setTab("collections")}
        >
          {t("Koleksiyonlar ({p0})", { p0: draft.collections.length })}
        </button>
      </div>
      <input
        type="search"
        aria-label={t("Katalogda ara")}
        placeholder={t("Ad veya kimlik ara")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {tab === "products" ? (
        <>
          <button
            className="catalog-add"
            onClick={() => {
              const product = blankProduct(draft);
              update((c) => ({ ...c, products: [...c.products, product] }));
              setEditing({ kind: "product", index: draft.products.length });
            }}
          >
            {t("+ Yeni ürün")}
          </button>
          <ul className="catalog-list" aria-label={t("Ürünler")}>
            {products.map(({ product, index }) => {
              const [low, high] = priceRange(product);
              const stock = product.variants.reduce((n, v) => n + v.stock, 0);
              const bad = issuesFor(`product:${index}`).length > 0;
              return (
                <li key={index} className={bad ? "invalid" : ""}>
                  <button
                    className="catalog-row"
                    aria-label={t("Ürünü düzenle: {p0}", { p0: product.title })}
                    onClick={() => setEditing({ kind: "product", index })}
                  >
                    {product.images[0] ? (
                      <img src={assetUrl(product.images[0])} alt="" />
                    ) : (
                      <span className="catalog-thumb" aria-hidden />
                    )}
                    <span>
                      <b>{product.title || t("Adsız ürün")}</b>
                      <small>
                        {low === high
                          ? money(low, product.currency)
                          : `${money(low, product.currency)} – ${money(high, product.currency)}`}
                        {" · "}
                        {t("{p0} varyant", { p0: product.variants.length })}
                        {" · "}
                        {stock ? t("{p0} stok", { p0: stock }) : t("Tükendi")}
                      </small>
                      {bad && (
                        <small className="catalog-issue">
                          {issuesFor(`product:${index}`)[0].message}
                        </small>
                      )}
                    </span>
                  </button>
                  <button
                    className="catalog-icon"
                    aria-label={t("Ürünü çoğalt: {p0}", { p0: product.title })}
                    title={t("Çoğalt")}
                    onClick={() =>
                      update((c) => ({
                        ...c,
                        products: [
                          ...c.products.slice(0, index + 1),
                          duplicateProduct(c, product),
                          ...c.products.slice(index + 1),
                        ],
                      }))
                    }
                  >
                    ⧉
                  </button>
                  <button
                    className="catalog-icon"
                    aria-label={t("Ürünü sil: {p0}", { p0: product.title })}
                    title={t("Sil")}
                    onClick={() => {
                      update((c) => removeProduct(c, product.id));
                      notify(
                        t(
                          "“{p0}” silindi. Geri almak için “Değişiklikleri at”a bas.",
                          { p0: product.title },
                        ),
                      );
                    }}
                  >
                    ×
                  </button>
                </li>
              );
            })}
            {!products.length && (
              <li className="catalog-empty">
                {draft.products.length
                  ? t("Aramaya uyan ürün yok.")
                  : t("Henüz ürün yok.")}
              </li>
            )}
          </ul>
        </>
      ) : (
        <>
          <button
            className="catalog-add"
            onClick={() => {
              const collection = blankCollection(draft);
              update((c) => ({
                ...c,
                collections: [...c.collections, collection],
              }));
              setEditing({
                kind: "collection",
                index: draft.collections.length,
              });
            }}
          >
            {t("+ Yeni koleksiyon")}
          </button>
          <ul className="catalog-list" aria-label={t("Koleksiyonlar")}>
            {collections.map(({ collection, index }) => {
              const bad = issuesFor(`collection:${index}`).length > 0;
              return (
                <li key={index} className={bad ? "invalid" : ""}>
                  <button
                    className="catalog-row"
                    aria-label={t("Koleksiyonu düzenle: {p0}", {
                      p0: collection.title,
                    })}
                    onClick={() => setEditing({ kind: "collection", index })}
                  >
                    {collection.image ? (
                      <img src={assetUrl(collection.image)} alt="" />
                    ) : (
                      <span className="catalog-thumb" aria-hidden />
                    )}
                    <span>
                      <b>{collection.title || t("Adsız koleksiyon")}</b>
                      <small>
                        {t("{p0} ürün", { p0: collection.productIds.length })}
                      </small>
                      {bad && (
                        <small className="catalog-issue">
                          {issuesFor(`collection:${index}`)[0].message}
                        </small>
                      )}
                    </span>
                  </button>
                  <button
                    className="catalog-icon"
                    aria-label={t("Koleksiyonu sil: {p0}", {
                      p0: collection.title,
                    })}
                    title={t("Sil")}
                    onClick={() =>
                      update((c) => ({
                        ...c,
                        collections: c.collections.filter(
                          (_, i) => i !== index,
                        ),
                      }))
                    }
                  >
                    ×
                  </button>
                </li>
              );
            })}
            {!collections.length && (
              <li className="catalog-empty">
                {draft.collections.length
                  ? t("Aramaya uyan koleksiyon yok.")
                  : t("Henüz koleksiyon yok.")}
              </li>
            )}
          </ul>
        </>
      )}
      <button
        onClick={() => {
          update((c) => ({ ...c, ...withSampleProducts(c) }));
          notify(
            t("Örnek ürünler eklendi. Kaydetmek için “Kataloğu kaydet”e bas."),
          );
        }}
      >
        {t("8 örnek ürün ve 2 koleksiyon ekle")}
      </button>
      <details
        className="catalog-json"
        onToggle={(e) => {
          if ((e.currentTarget as HTMLDetailsElement).open) {
            setJsonText(
              JSON.stringify(
                { products: draft.products, collections: draft.collections },
                null,
                2,
              ),
            );
            setJsonError("");
          }
        }}
      >
        <summary>{t("Gelişmiş: JSON olarak düzenle")}</summary>
        <textarea
          aria-label={t("Yerel katalog JSON")}
          rows={14}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
        />
        {jsonError && (
          <small className="field-error" role="alert">
            {jsonError}
          </small>
        )}
        <button
          onClick={() => {
            try {
              const value = JSON.parse(jsonText);
              if (
                !Array.isArray(value.products) ||
                !Array.isArray(value.collections)
              )
                throw new Error(t("products ve collections dizileri gerekli."));
              setDraft((c) => ({
                ...c,
                products: value.products,
                collections: value.collections,
              }));
              setJsonError("");
            } catch (e) {
              setJsonError((e as Error).message);
            }
          }}
        >
          {t("JSON’u forma uygula")}
        </button>
      </details>
      <footer className="catalog-footer">
        <small role="status">
          {conflict
            ? t("Katalog başka bir yerde değişti.")
            : issues.length
              ? t("{p0} sorun düzeltilmeli", { p0: issues.length })
              : dirty
                ? t("Kaydedilmemiş değişiklikler var")
                : t("Tüm değişiklikler kaydedildi")}
        </small>
        {conflict && (
          <button onClick={() => void load()}>{t("Yeniden yükle")}</button>
        )}
        <button
          disabled={!dirty || busy}
          onClick={() => {
            setDraft({ ...draft, ...JSON.parse(saved) });
            setEditing(null);
          }}
        >
          {t("Değişiklikleri at")}
        </button>
        <button
          className="feature-primary"
          disabled={!dirty || busy}
          onClick={() => void save()}
        >
          {busy ? t("Kaydediliyor…") : t("Kataloğu kaydet")}
        </button>
      </footer>
      {editedProduct && editing && (
        <ProductDialog
          product={editedProduct}
          catalog={draft}
          assets={assets}
          issues={issuesFor(`product:${editing.index}`)}
          path={`product:${editing.index}`}
          onChange={(next, collections) =>
            update((c) => ({
              ...c,
              collections:
                collections ??
                (next.id !== editedProduct.id
                  ? renameProductId(c, editedProduct.id, next.id)
                  : c.collections),
              products: c.products.map((p, i) =>
                i === editing.index ? next : p,
              ),
            }))
          }
          onClose={() => setEditing(null)}
        />
      )}
      {editedCollection && editing && (
        <CollectionDialog
          collection={editedCollection}
          catalog={draft}
          assets={assets}
          issues={issuesFor(`collection:${editing.index}`)}
          onChange={(next) =>
            update((c) => ({
              ...c,
              collections: c.collections.map((col, i) =>
                i === editing.index ? next : col,
              ),
            }))
          }
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function FieldError({
  issues,
  field,
}: {
  issues: CatalogIssue[];
  field: string;
}) {
  const issue = issues.find((i) => i.field === field);
  return issue ? (
    <small className="field-error" role="alert">
      {issue.message}
    </small>
  ) : null;
}

/** Keeps the typed text while it is being edited; commits minor units. */
function MoneyField({
  label,
  value,
  currency,
  onChange,
  invalid,
}: {
  label: string;
  value: number;
  currency: string;
  onChange: (n: number) => void;
  invalid?: boolean;
}) {
  const locale = getUiLocale();
  const [text, setText] = useState(moneyInput(value, locale));
  const [bad, setBad] = useState(false);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(moneyInput(value, locale));
  }, [value, locale]);
  const symbol =
    new Intl.NumberFormat(locale, { style: "currency", currency })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value || currency;
  return (
    <span className={`money-field${bad || invalid ? " invalid" : ""}`}>
      <span aria-hidden>{symbol}</span>
      <input
        inputMode="decimal"
        aria-label={label}
        aria-invalid={bad || invalid || undefined}
        value={text}
        onFocus={() => (focused.current = true)}
        onChange={(e) => {
          setText(e.target.value);
          const minor = parseMoney(e.target.value);
          setBad(minor === null);
          if (minor !== null) onChange(minor);
        }}
        onBlur={() => {
          focused.current = false;
          const minor = parseMoney(text);
          if (minor !== null) setText(moneyInput(minor, locale));
        }}
      />
    </span>
  );
}

function MediaChooser({
  assets,
  onPick,
  label,
}: {
  assets: Asset[];
  onPick: (url: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    [url, setUrl] = useState("");
  const images = assets.filter(
    (a) =>
      a.type === "image" &&
      !a.archived &&
      a.name
        .toLocaleLowerCase(getUiLocale())
        .includes(search.trim().toLocaleLowerCase(getUiLocale())),
  );
  return (
    <div className="media-chooser">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        {label}
      </button>
      {open && (
        <div className="media-chooser-body">
          <input
            type="search"
            aria-label={t("Medyada ara")}
            placeholder={t("Medyada ara")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="media-chooser-grid">
            {images.map((a) => (
              <button
                type="button"
                key={a.id}
                aria-label={t("Görseli seç: {p0}", { p0: a.name })}
                onClick={() => {
                  onPick(a.url);
                  setOpen(false);
                }}
              >
                <img src={assetUrl(a.url)} alt="" />
              </button>
            ))}
            {!images.length && (
              <small>
                {t("Medyada görsel yok. Medya panelinden yükleyebilirsin.")}
              </small>
            )}
          </div>
          <form
            className="media-chooser-url"
            onSubmit={(e) => {
              e.preventDefault();
              if (!/^(https?:\/\/|\/(?!\/))/.test(url.trim())) return;
              onPick(url.trim());
              setUrl("");
              setOpen(false);
            }}
          >
            <input
              aria-label={t("Görsel adresi")}
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button type="submit">{t("Ekle")}</button>
          </form>
        </div>
      )}
    </div>
  );
}

function ProductDialog({
  product,
  catalog,
  assets,
  issues,
  path,
  onChange,
  onClose,
}: {
  product: Product;
  catalog: Catalog;
  assets: Asset[];
  issues: CatalogIssue[];
  path: string;
  onChange: (p: Product, collections?: Collection[]) => void;
  onClose: () => void;
}) {
  const own = issues.filter((i) => i.path === path);
  const options = optionNames(product);
  const [newOption, setNewOption] = useState("");
  const set = (patch: Partial<Product>) => onChange({ ...product, ...patch });
  const setVariant = (index: number, patch: Partial<Variant>) =>
    set({
      variants: product.variants.map((v, i) =>
        i === index ? { ...v, ...patch } : v,
      ),
    });
  const renameOption = (from: string, to: string) =>
    set({
      variants: product.variants.map((v) => ({
        ...v,
        options: Object.fromEntries(
          Object.entries(v.options).map(([k, val]) => [
            k === from ? to : k,
            val,
          ]),
        ),
      })),
    });
  const metafields = Object.entries(product.metafields);
  return (
    <Dialog
      open
      onClose={onClose}
      label={t("Ürün düzenleyici")}
      className="catalog-dialog"
    >
      <h2>{product.title || t("Adsız ürün")}</h2>
      <div className="catalog-form">
        <section>
          <label>
            {t("Ürün adı")}
            <input
              aria-label={t("Ürün adı")}
              aria-invalid={own.some((i) => i.field === "title") || undefined}
              value={product.title}
              onChange={(e) => set({ title: e.target.value })}
            />
            <FieldError issues={own} field="title" />
          </label>
          <label>
            {t("Ürün kimliği")}
            <input
              aria-label={t("Ürün kimliği")}
              aria-invalid={own.some((i) => i.field === "id") || undefined}
              value={product.id}
              onChange={(e) => {
                const id = e.target.value;
                // Variant ids made from the product id follow it.
                onChange({
                  ...product,
                  id,
                  variants: product.variants.map((v) =>
                    v.id.startsWith(`${product.id}-`)
                      ? { ...v, id: id + v.id.slice(product.id.length) }
                      : v,
                  ),
                });
              }}
            />
            <small>
              {t("Adreste kullanılır: /products/{p0}", { p0: product.id })}
            </small>
            <FieldError issues={own} field="id" />
          </label>
          <label>
            {t("Açıklama")}
            <textarea
              aria-label={t("Açıklama")}
              rows={4}
              value={product.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </label>
          <label>
            {t("Para birimi")}
            <select
              aria-label={t("Para birimi")}
              value={product.currency}
              onChange={(e) => set({ currency: e.target.value })}
            >
              {[...new Set([...currencies, product.currency])].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="catalog-collections">
            <legend>{t("Koleksiyonlar")}</legend>
            {catalog.collections.map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={c.productIds.includes(product.id)}
                  onChange={(e) =>
                    onChange(
                      product,
                      catalog.collections.map((col) =>
                        col.id !== c.id
                          ? col
                          : {
                              ...col,
                              productIds: e.target.checked
                                ? [...col.productIds, product.id]
                                : col.productIds.filter(
                                    (id) => id !== product.id,
                                  ),
                            },
                      ),
                    )
                  }
                />
                {c.title}
              </label>
            ))}
            {!catalog.collections.length && (
              <small>{t("Henüz koleksiyon yok.")}</small>
            )}
          </fieldset>
        </section>
        <section>
          <h3>{t("Görseller")}</h3>
          <ul className="catalog-images" aria-label={t("Ürün görselleri")}>
            {product.images.map((src, i) => (
              <li key={`${src}-${i}`}>
                <img src={assetUrl(src)} alt="" />
                {i === 0 && <small>{t("Ana görsel")}</small>}
                <div>
                  {i > 0 && (
                    <button
                      type="button"
                      aria-label={t("Görseli ana görsel yap {p0}", {
                        p0: i + 1,
                      })}
                      title={t("Ana görsel yap")}
                      onClick={() =>
                        set({
                          images: [
                            src,
                            ...product.images.filter((_, j) => j !== i),
                          ],
                        })
                      }
                    >
                      ★
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={t("Görseli kaldır {p0}", { p0: i + 1 })}
                    title={t("Kaldır")}
                    onClick={() =>
                      set({ images: product.images.filter((_, j) => j !== i) })
                    }
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <MediaChooser
            assets={assets}
            label={t("+ Görsel ekle")}
            onPick={(url) => set({ images: [...product.images, url] })}
          />
          <FieldError issues={own} field="images" />
        </section>
      </div>
      <section className="catalog-variants">
        <header>
          <h3>{t("Varyantlar")}</h3>
          <form
            className="catalog-option-add"
            onSubmit={(e) => {
              e.preventDefault();
              const name = newOption.trim();
              if (!name || options.includes(name)) return;
              set({
                variants: product.variants.map((v) => ({
                  ...v,
                  options: { ...v.options, [name]: "" },
                })),
              });
              setNewOption("");
            }}
          >
            <input
              aria-label={t("Yeni seçenek adı")}
              placeholder={t("Seçenek: Renk, Beden…")}
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
            />
            <button type="submit">{t("Seçenek ekle")}</button>
          </form>
        </header>
        <FieldError issues={own} field="variants" />
        <div className="catalog-table-wrap">
          <table className="catalog-table">
            <thead>
              <tr>
                <th>{t("Varyant adı")}</th>
                {options.map((name) => (
                  <th key={name}>
                    <input
                      aria-label={t("Seçenek adı: {p0}", { p0: name })}
                      defaultValue={name}
                      onBlur={(e) => {
                        const to = e.target.value.trim();
                        if (to && to !== name && !options.includes(to))
                          renameOption(name, to);
                        else e.target.value = name;
                      }}
                    />
                    <button
                      type="button"
                      aria-label={t("Seçeneği kaldır: {p0}", { p0: name })}
                      onClick={() =>
                        set({
                          variants: product.variants.map((v) => {
                            const rest = { ...v.options };
                            delete rest[name];
                            return { ...v, options: rest };
                          }),
                        })
                      }
                    >
                      ×
                    </button>
                  </th>
                ))}
                <th>{t("Fiyat")}</th>
                <th>{t("Karşılaştırma fiyatı")}</th>
                <th>{t("Stok")}</th>
                <th>{t("Görsel")}</th>
                <th>{t("Kimlik")}</th>
                <th>
                  <span className="sr-only">{t("İşlemler")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {product.variants.map((variant, index) => {
                const vIssues = issues.filter(
                  (i) => i.path === `${path}:variant:${index}`,
                );
                const name = variant.title || `#${index + 1}`;
                return (
                  <tr key={index} className={vIssues.length ? "invalid" : ""}>
                    <td>
                      <input
                        aria-label={t("Varyant adı {p0}", { p0: index + 1 })}
                        value={variant.title}
                        onChange={(e) =>
                          setVariant(index, { title: e.target.value })
                        }
                      />
                    </td>
                    {options.map((option) => (
                      <td key={option}>
                        <input
                          aria-label={t("{p0} değeri: {p1}", {
                            p0: option,
                            p1: name,
                          })}
                          value={variant.options[option] ?? ""}
                          onChange={(e) =>
                            setVariant(index, {
                              options: {
                                ...variant.options,
                                [option]: e.target.value,
                              },
                            })
                          }
                        />
                      </td>
                    ))}
                    <td>
                      <MoneyField
                        label={t("Fiyat: {p0}", { p0: name })}
                        value={variant.price}
                        currency={product.currency}
                        invalid={vIssues.some((i) => i.field === "price")}
                        onChange={(price) => setVariant(index, { price })}
                      />
                    </td>
                    <td>
                      <MoneyField
                        label={t("Karşılaştırma fiyatı: {p0}", { p0: name })}
                        value={variant.comparePrice}
                        currency={product.currency}
                        invalid={vIssues.some(
                          (i) => i.field === "comparePrice",
                        )}
                        onChange={(comparePrice) =>
                          setVariant(index, { comparePrice })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        aria-label={t("Stok: {p0}", { p0: name })}
                        aria-invalid={
                          vIssues.some((i) => i.field === "stock") || undefined
                        }
                        value={variant.stock}
                        onChange={(e) =>
                          setVariant(index, {
                            stock:
                              e.target.value === ""
                                ? 0
                                : Number(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td>
                      <select
                        aria-label={t("Varyant görseli: {p0}", { p0: name })}
                        value={variant.image}
                        onChange={(e) =>
                          setVariant(index, { image: e.target.value })
                        }
                      >
                        <option value="">{t("Ürün görseli")}</option>
                        {[...new Set([...product.images, variant.image])]
                          .filter(Boolean)
                          .map((src, i) => (
                            <option key={src} value={src}>
                              {t("Görsel {p0}", {
                                p0: product.images.indexOf(src) + 1 || i + 1,
                              })}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td>
                      <input
                        aria-label={t("Varyant kimliği: {p0}", { p0: name })}
                        aria-invalid={
                          vIssues.some((i) => i.field === "id") || undefined
                        }
                        value={variant.id}
                        onChange={(e) =>
                          setVariant(index, { id: e.target.value })
                        }
                      />
                    </td>
                    <td className="catalog-row-actions">
                      <button
                        type="button"
                        aria-label={t("Varyantı çoğalt: {p0}", { p0: name })}
                        title={t("Çoğalt")}
                        onClick={() =>
                          set({
                            variants: [
                              ...product.variants.slice(0, index + 1),
                              {
                                ...structuredClone(variant),
                                id: makeId(
                                  variant.id,
                                  product.variants.map((v) => v.id),
                                ),
                              },
                              ...product.variants.slice(index + 1),
                            ],
                          })
                        }
                      >
                        ⧉
                      </button>
                      <button
                        type="button"
                        disabled={product.variants.length < 2}
                        aria-label={t("Varyantı sil: {p0}", { p0: name })}
                        title={t("Sil")}
                        onClick={() =>
                          set({
                            variants: product.variants.filter(
                              (_, i) => i !== index,
                            ),
                          })
                        }
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {product.variants.flatMap((_, index) =>
          issues
            .filter((i) => i.path === `${path}:variant:${index}`)
            .map((i) => (
              <small
                className="field-error"
                role="alert"
                key={`${index}${i.field}`}
              >
                {t("Varyant {p0}: {p1}", {
                  p0: product.variants[index].title || index + 1,
                  p1: i.message,
                })}
              </small>
            )),
        )}
        <button
          type="button"
          onClick={() =>
            set({ variants: [...product.variants, blankVariant(product)] })
          }
        >
          {t("+ Varyant ekle")}
        </button>
      </section>
      <section className="catalog-metafields">
        <h3>{t("Ek alanlar")}</h3>
        <small>
          {t(
            "Ürün sayfasındaki dinamik içerik alanları (ör. details.material).",
          )}
        </small>
        {metafields.map(([key, value], index) => (
          <div key={index} className="catalog-metafield">
            <input
              aria-label={t("Alan anahtarı {p0}", { p0: index + 1 })}
              defaultValue={key}
              onBlur={(e) => {
                const to = e.target.value.trim();
                if (!to || to === key || to in product.metafields) {
                  e.target.value = key;
                  return;
                }
                set({
                  metafields: Object.fromEntries(
                    metafields.map(([k, v]) => [k === key ? to : k, v]),
                  ),
                });
              }}
            />
            <input
              aria-label={t("Alan değeri {p0}", { p0: index + 1 })}
              value={value}
              onChange={(e) =>
                set({
                  metafields: { ...product.metafields, [key]: e.target.value },
                })
              }
            />
            <button
              type="button"
              aria-label={t("Alanı kaldır {p0}", { p0: index + 1 })}
              onClick={() =>
                set({
                  metafields: Object.fromEntries(
                    metafields.filter(([k]) => k !== key),
                  ),
                })
              }
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            set({
              metafields: {
                ...product.metafields,
                [makeId("field", Object.keys(product.metafields))]: "",
              },
            })
          }
        >
          {t("+ Alan ekle")}
        </button>
      </section>
      <footer className="catalog-dialog-footer">
        <small>{t("Değişiklikler “Kataloğu kaydet” ile kaydedilir.")}</small>
        <button className="feature-primary" onClick={onClose}>
          {t("Tamam")}
        </button>
      </footer>
    </Dialog>
  );
}

function CollectionDialog({
  collection,
  catalog,
  assets,
  issues,
  onChange,
  onClose,
}: {
  collection: Collection;
  catalog: Catalog;
  assets: Asset[];
  issues: CatalogIssue[];
  onChange: (c: Collection) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const set = (patch: Partial<Collection>) =>
    onChange({ ...collection, ...patch });
  const needle = search.trim().toLocaleLowerCase(getUiLocale());
  const listed = catalog.products.filter((p) =>
    `${p.title} ${p.id}`.toLocaleLowerCase(getUiLocale()).includes(needle),
  );
  const chosen = collection.productIds
    .map((id) => catalog.products.find((p) => p.id === id))
    .filter((p): p is Product => !!p);
  const move = (index: number, by: number) => {
    const ids = [...collection.productIds];
    const [id] = ids.splice(index, 1);
    ids.splice(index + by, 0, id);
    set({ productIds: ids });
  };
  return (
    <Dialog
      open
      onClose={onClose}
      label={t("Koleksiyon düzenleyici")}
      className="catalog-dialog"
    >
      <h2>{collection.title || t("Adsız koleksiyon")}</h2>
      <div className="catalog-form">
        <section>
          <label>
            {t("Koleksiyon adı")}
            <input
              aria-label={t("Koleksiyon adı")}
              aria-invalid={
                issues.some((i) => i.field === "title") || undefined
              }
              value={collection.title}
              onChange={(e) => set({ title: e.target.value })}
            />
            <FieldError issues={issues} field="title" />
          </label>
          <label>
            {t("Koleksiyon kimliği")}
            <input
              aria-label={t("Koleksiyon kimliği")}
              aria-invalid={issues.some((i) => i.field === "id") || undefined}
              value={collection.id}
              onChange={(e) => set({ id: e.target.value })}
            />
            <small>
              {t("Adreste kullanılır: /collections/{p0}", {
                p0: collection.id,
              })}
            </small>
            <FieldError issues={issues} field="id" />
          </label>
          <label>
            {t("Açıklama")}
            <textarea
              aria-label={t("Açıklama")}
              rows={3}
              value={collection.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </label>
          <div className="catalog-cover">
            <span>{t("Kapak görseli")}</span>
            {collection.image && (
              <span className="catalog-cover-preview">
                <img src={assetUrl(collection.image)} alt="" />
                <button
                  type="button"
                  aria-label={t("Kapak görselini kaldır")}
                  onClick={() => set({ image: "" })}
                >
                  ×
                </button>
              </span>
            )}
            <MediaChooser
              assets={assets}
              label={
                collection.image ? t("Görseli değiştir") : t("+ Görsel seç")
              }
              onPick={(image) => set({ image })}
            />
          </div>
          <h3>{t("Sıralama ({p0} ürün)", { p0: chosen.length })}</h3>
          <ol className="catalog-order">
            {chosen.map((p, i) => (
              <li key={p.id}>
                <span>{p.title}</span>
                <button
                  type="button"
                  disabled={i === 0}
                  aria-label={t("Yukarı taşı: {p0}", { p0: p.title })}
                  onClick={() => move(i, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={i === chosen.length - 1}
                  aria-label={t("Aşağı taşı: {p0}", { p0: p.title })}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </button>
              </li>
            ))}
          </ol>
        </section>
        <section>
          <h3>{t("Ürünler")}</h3>
          <input
            type="search"
            aria-label={t("Ürün ara")}
            placeholder={t("Ürün ara")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="catalog-bulk">
            <button
              type="button"
              onClick={() =>
                set({
                  productIds: [
                    ...new Set([
                      ...collection.productIds,
                      ...listed.map((p) => p.id),
                    ]),
                  ],
                })
              }
            >
              {t("Listelenenleri seç")}
            </button>
            <button
              type="button"
              onClick={() =>
                set({
                  productIds: collection.productIds.filter(
                    (id) => !listed.some((p) => p.id === id),
                  ),
                })
              }
            >
              {t("Listelenenleri kaldır")}
            </button>
          </div>
          <ul className="catalog-pick">
            {listed.map((p) => (
              <li key={p.id}>
                <label>
                  <input
                    type="checkbox"
                    aria-label={t("Koleksiyona ekle: {p0}", { p0: p.title })}
                    checked={collection.productIds.includes(p.id)}
                    onChange={(e) =>
                      set({
                        productIds: e.target.checked
                          ? [...collection.productIds, p.id]
                          : collection.productIds.filter((id) => id !== p.id),
                      })
                    }
                  />
                  {p.images[0] ? (
                    <img src={assetUrl(p.images[0])} alt="" />
                  ) : (
                    <span className="catalog-thumb" aria-hidden />
                  )}
                  <span>{p.title}</span>
                  <small>{money(p.variants[0]?.price || 0, p.currency)}</small>
                </label>
              </li>
            ))}
          </ul>
          <FieldError issues={issues} field="productIds" />
        </section>
      </div>
      <footer className="catalog-dialog-footer">
        <small>{t("Değişiklikler “Kataloğu kaydet” ile kaydedilir.")}</small>
        <button className="feature-primary" onClick={onClose}>
          {t("Tamam")}
        </button>
      </footer>
    </Dialog>
  );
}
