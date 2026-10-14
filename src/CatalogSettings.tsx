import { t } from "./i18n";
import type { Block } from "./model";
import { useStudio } from "./studio";

/**
 * Settings for the collection product list, grouped like a page builder's
 * "Product list": source, layout and what each card shows.
 */
export function CollectionGridSettings({
  node,
  update,
}: {
  node: Block;
  update: (f: (n: Block) => Block, key?: string) => void;
}) {
  const { catalog } = useStudio();
  const p = node.props;
  const set = (key: string, value: string | boolean) =>
    update(
      (n) => ({ ...n, props: { ...n.props, [key]: value } }),
      `collection:${node.id}:${key}`,
    );
  const fixed =
    p.resourceBinding === "fixed" ||
    (p.resourceBinding !== "page" && !!p.collectionId);
  const columns = Number(p.gridColumns || 4);
  const toggle = (key: string, label: string, fallback: boolean) => (
    <label className="toggle-row">
      <span>{label}</span>
      <input
        type="checkbox"
        aria-label={label}
        checked={p[key] === undefined ? fallback : p[key] === true}
        onChange={(e) => set(key, e.target.checked)}
      />
    </label>
  );
  return (
    <section className="catalog-settings" data-collection-settings>
      <h3>{t("Koleksiyon")}</h3>
      <div className="segmented" role="radiogroup" aria-label={t("Kaynak")}>
        <button
          role="radio"
          aria-checked={!fixed}
          onClick={() => set("resourceBinding", "page")}
        >
          {t("Sayfanın koleksiyonu")}
        </button>
        <button
          role="radio"
          aria-checked={fixed}
          onClick={() => {
            set("resourceBinding", "fixed");
            if (!p.collectionId && catalog.collections[0])
              set("collectionId", catalog.collections[0].id);
          }}
        >
          {t("Belirli koleksiyon")}
        </button>
      </div>
      <p className="setting-help">
        {fixed
          ? t("Bu öğe her sayfada aynı koleksiyonu gösterir.")
          : t(
              "Ziyaretçinin açtığı koleksiyon gösterilir. Hangi koleksiyonların bu tasarımı kullanacağını sayfanın Atamalar penceresinden seç.",
            )}
      </p>
      {fixed && (
        <label className="control">
          <span>{t("Koleksiyon")}</span>
          <select
            aria-label={t("Gösterilecek koleksiyon")}
            value={String(p.collectionId || "")}
            onChange={(e) => set("collectionId", e.target.value)}
          >
            {!catalog.collections.length && (
              <option value="">
                {t("Önce yerel kataloğa koleksiyon ekle.")}
              </option>
            )}
            {catalog.collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} · {t("{p0} ürün", { p0: c.productIds.length })}
              </option>
            ))}
          </select>
        </label>
      )}
      <h4>{t("Düzen")}</h4>
      <div className="segmented" role="radiogroup" aria-label={t("Görünüm")}>
        {[
          ["grid", t("Izgara")],
          ["carousel", t("Kaydırmalı")],
        ].map(([id, label]) => (
          <button
            key={id}
            role="radio"
            aria-checked={(p.view === "carousel" ? "carousel" : "grid") === id}
            onClick={() => set("view", id === "grid" ? "" : id)}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="control">
        <span>{t("Sütun (masaüstü)")}</span>
        <div className="segmented" role="radiogroup" aria-label={t("Sütun")}>
          {[2, 3, 4, 5].map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={columns === n}
              onClick={() => set("gridColumns", String(n))}
            >
              {n}
            </button>
          ))}
        </div>
      </label>
      <label className="control">
        <span>{t("Sayfa başına ürün")}</span>
        <input
          type="number"
          min={1}
          max={24}
          aria-label={t("Sayfa başına ürün")}
          value={Number(p.pageSize || 8)}
          onChange={(e) =>
            set(
              "pageSize",
              String(Math.max(1, Math.min(24, Number(e.target.value) || 1))),
            )
          }
        />
      </label>
      <h4>{t("Kartlarda göster")}</h4>
      {toggle("showHeader", t("Koleksiyon başlığı ve açıklaması"), true)}
      {toggle("showAddToCart", t("Sepete ekle düğmesi"), true)}
      {toggle("showDescription", t("Ürün açıklaması"), false)}
    </section>
  );
}
