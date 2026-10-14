import { t } from "./i18n.ts";
import { useState } from "react";
import { StateStyles } from "./StateStyles";
import { effectiveStyle, type Block, type Device } from "./model";
import { freezeGlobalStyle, useStudio, type Asset } from "./studio";
import { api, json } from "./api";
export function NodeExtras({
  node,
  update,
  openMedia,
  assets,
  storeId,
  device,
}: {
  node: Block;
  update: (f: (b: Block) => Block, key?: string) => void;
  openMedia: () => void;
  assets: Asset[];
  storeId: string;
  device: Device;
}) {
  const studio = useStudio();
  const effective = effectiveStyle(node, device),
    fontRole =
      node.kind === "heading"
        ? "heading"
        : node.kind === "button"
          ? "button"
          : "body",
    fontName = String(effective.fontFamily || studio.brand.fonts[fontRole]);
  const face = assets.find(
    (a) =>
      a.type === "font" &&
      a.axes &&
      Object.keys(a.axes).length &&
      (fontName.startsWith("var(")
        ? studio.brand.fonts[fontRole]
        : fontName
      ).includes(a.family || "NONE"),
  );
  const axisValues = Object.fromEntries(
    [
      ...String(effective.fontVariationSettings || "").matchAll(
        /"([\w]{4})"\s+([\d.-]+)/g,
      ),
    ].map((m) => [m[1], Number(m[2])]),
  );
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 100, height: 100 }),
    [error, setError] = useState("");
  const prop = (k: string, v: string | boolean) =>
    update((n) => {
      if (k === "productId" && n.kind === "section") {
        const bind = (child: Block): Block => ({
          ...child,
          props: {
            ...child.props,
            ...(([
              "product",
              "productField",
              "productGallery",
              "variantPicker",
              "quantity",
              "addToCart",
              "stickyCart",
              "bundle",
            ].includes(child.kind) ||
              (child.kind === "button" &&
                child.props.action === "addToCart")) &&
            (!child.props.productId ||
              child.props.productId === n.props.productId)
              ? { productId: v }
              : {}),
          },
          children: child.children.map(bind),
        });
        return {
          ...n,
          props: { ...n.props, productId: v },
          children: n.children.map(bind),
        };
      }
      if (k === "buttonVariant") {
        return {
          ...n,
          props: { ...n.props, buttonVariant: v, globalDetached: false },
          styles: {
            ...n.styles,
            desktop: {
              ...n.styles.desktop,
              backgroundColor:
                v === "outline"
                  ? "transparent"
                  : v === "secondary"
                    ? "var(--brand-secondary)"
                    : "var(--brand-primary)",
              color:
                v === "primary"
                  ? "var(--brand-background)"
                  : "var(--brand-text)",
              borderWidth: v === "outline" ? "1px" : "0px",
              borderStyle: "solid",
              borderColor: "var(--brand-primary)",
            },
          },
        };
      }
      return { ...n, props: { ...n.props, [k]: v } };
    });
  const field = (k: string, label: string, multi = false) => (
    <label className="control" key={k}>
      <span>{label}</span>
      {multi ? (
        <textarea
          value={String(node.props[k] || "")}
          onChange={(e) => prop(k, e.target.value)}
        />
      ) : (
        <input
          value={String(node.props[k] || "")}
          onChange={(e) => prop(k, e.target.value)}
        />
      )}
    </label>
  );
  // The inspector wraps this in its own collapsible section.
  return (
    <>
      <div className="settings-body">
        <label className="toggle-row">
          {t("Öğeyi kilitle")}
          <input
            aria-label={t("Öğeyi kilitle")}
            type="checkbox"
            checked={!!node.props.locked}
            onChange={(e) =>
              update(
                (current) => ({
                  ...current,
                  props: { ...current.props, locked: e.target.checked },
                }),
                `lock:${node.id}`,
              )
            }
          />
        </label>
        <label className="toggle-row">
          {t("Global stilden ayır")}
          <input
            type="checkbox"
            checked={!!node.props.globalDetached}
            onChange={(e) =>
              e.target.checked
                ? update((n) => freezeGlobalStyle(n, studio.brand))
                : prop("globalDetached", false)
            }
          />
        </label>
        <button
          onClick={() =>
            update((n) => ({
              ...n,
              props: { ...n.props, globalDetached: false },
              styles: { desktop: {}, tablet: {}, mobile: {} },
            }))
          }
        >
          {t("Global stile geri dön")}
        </button>
        {node.kind === "text" && (
          <label className="control">
            {t("Global metin stili")}
            <select
              value={String(node.props.globalStyle || "body")}
              onChange={(e) => prop("globalStyle", e.target.value)}
            >
              <option value="body">{t("Gövde")}</option>
              <option value="small">{t("Küçük metin")}</option>
              <option value="link">{t("Bağlantı")}</option>
            </select>
          </label>
        )}
        {[
          "image",
          "productGallery",
          "gallery",
          "logos",
          "beforeAfter",
          "product",
          "section",
          "box",
        ].includes(node.kind) && (
          <button onClick={openMedia}>{t("Medya kütüphanesini aç")}</button>
        )}
        {node.kind === "image" && (
          <>
            {field("mobileSrc", t("Mobil görsel URL"))}
            {field("href", t("Görsel bağlantısı"))}
            {field("aspectRatio", t("En-boy oranı (örn. 1 / 1)"))}
            {field("rotation", t("Döndürme (derece)"))}
            {field("focusX", t("Odak X (%)"))}
            {field("focusY", t("Odak Y (%)"))}
            {(["flipX", "flipY", "lightbox"] as const).map((k) => (
              <label className="toggle-row" key={k}>
                {
                  {
                    flipX: t("Yatay çevir"),
                    flipY: t("Dikey çevir"),
                    lightbox: t("Tıklayınca büyüt"),
                  }[k]
                }
                <input
                  type="checkbox"
                  checked={!!node.props[k]}
                  onChange={(e) => prop(k, e.target.checked)}
                />
              </label>
            ))}
          </>
        )}
        {node.kind === "image" &&
          String(node.props.src).startsWith("/api/assets/") && (
            <>
              <p>{t("Kırpma alanı (%) · yeni dosya oluşturur")}</p>
              {(["x", "y", "width", "height"] as const).map((k) => (
                <label key={k}>
                  {k}
                  <input
                    aria-label={t("Kırpma {p0}", { p0: k })}
                    type="number"
                    min={0}
                    max={100}
                    value={crop[k]}
                    onChange={(e) =>
                      setCrop({ ...crop, [k]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
              <button
                onClick={async () => {
                  try {
                    const assetId = String(node.props.src).split("/")[3];
                    const result = await api<Asset>(
                      `/stores/${storeId}/assets/${assetId}/edit`,
                      { method: "POST", body: json({ crop }) },
                    );
                    prop("src", result.url);
                    setError("");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                {t("Görseli kırp")}
              </button>
              {error && <p role="alert">{error}</p>}
            </>
          )}
        {["section", "box"].includes(node.kind) && (
          <>
            {field("backgroundSrc", t("Arka plan görseli URL"))}
            {field("backgroundOverlay", t("Renk katmanı (#00000080)"))}
          </>
        )}
        {node.kind === "button" && (
          <>
            <label className="control">
              <span>{t("Aksiyon")}</span>
              <select
                aria-label={t("Buton aksiyonu")}
                value={String(node.props.action || "navigate")}
                onChange={(e) => prop("action", e.target.value)}
              >
                {Object.entries({
                  navigate: t("Sayfaya git"),
                  product: t("Ürüne git"),
                  collection: t("Koleksiyona git"),
                  scroll: t("Bölüme kaydır"),
                  popupOpen: t("Popup aç"),
                  popupClose: t("Popup kapat"),
                  addToCart: t("Sepete ekle"),
                  cartOpen: t("Sepeti aç"),
                  formSubmit: t("Form gönder"),
                  copyCoupon: t("Kupon kopyala"),
                  phone: t("Telefon"),
                  email: "E-posta",
                  whatsapp: "WhatsApp",
                }).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            {String(node.props.action || "navigate") !== "navigate" &&
              field("actionTarget", t("Aksiyon hedefi / bölüm veya popup ID"))}
            {["addToCart", "product", "collection"].includes(
              String(node.props.action),
            ) && field("productId", t("Ürün ID (yerel katalog)"))}
            <label className="control">
              {t("Global düğme stili")}
              <select
                value={String(node.props.buttonVariant || "primary")}
                onChange={(e) => prop("buttonVariant", e.target.value)}
              >
                {["primary", "secondary", "outline"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </>
        )}
        {[
          "productGallery",
          "productField",
          "variantPicker",
          "quantity",
          "addToCart",
          "stickyCart",
        ].includes(node.kind) && (
          <label className="control">
            <span>
              {node.kind === "collectionGrid"
                ? t("Koleksiyon kaynağı")
                : t("Ürün kaynağı")}
            </span>
            <select
              aria-label={t("Katalog veri kaynağı")}
              value={String(
                node.props.resourceBinding ||
                  (node.props.productId || node.props.collectionId
                    ? "fixed"
                    : "page"),
              )}
              onChange={(e) => prop("resourceBinding", e.target.value)}
            >
              <option value="page">{t("Bu sayfaya atanan hedef")}</option>
              <option value="fixed">
                {t("Öğede seçilen ürün / koleksiyon")}
              </option>
            </select>
          </label>
        )}
        {["input", "textarea", "select", "checkbox", "radio"].includes(
          node.kind,
        ) && (
          <>
            {field("label", t("Alan etiketi"))}
            {field("fieldName", t("Alan adı"))}
            {field("helpText", t("Alan açıklaması"))}
            {field("errorMessage", t("Hata mesajı"))}
            {["select", "radio"].includes(node.kind) &&
              field("options", t("Seçenekler (her satır bir seçenek)"), true)}
            <label className="toggle-row">
              {t("Zorunlu alan")}
              <input
                type="checkbox"
                checked={!!node.props.required}
                onChange={(e) => prop("required", e.target.checked)}
              />
            </label>
            {node.kind === "checkbox" && (
              <label className="toggle-row">
                {t("Pazarlama izni alanı")}
                <input
                  type="checkbox"
                  checked={!!node.props.consent}
                  onChange={(e) => prop("consent", e.target.checked)}
                />
              </label>
            )}
          </>
        )}
        {node.kind === "form" && (
          <>
            <label className="control">
              {t("Form hedefi")}
              <select
                value={String(node.props.destination || "local")}
                onChange={(e) => prop("destination", e.target.value)}
              >
                <option value="local">
                  {t("Uygulama içi gönderim kayıtları")}
                </option>
                <option value="webhook">
                  {t("Webhook + uygulama kayıtları (bağlantı gerekli)")}
                </option>
              </select>
            </label>
            <p>
              {t("Hedef:")}{" "}
              {node.props.destination === "webhook"
                ? studio.formDestination
                : t("Uygulama içi gönderim kayıtları")}
            </p>
            {field("submitLabel", t("Gönderim düğmesi metni"))}
            {field("successMessage", t("Başarılı gönderim mesajı"))}
            {field("redirect", t("Başarılı gönderim yönlendirmesi"))}
          </>
        )}
        {["gallery", "logos", "beforeAfter"].includes(node.kind) &&
          field("images", t("Görseller (her satır bir URL)"), true)}
        {["breadcrumb", "mobileMenu", "blogList"].includes(node.kind) &&
          field(
            "items",
            t("İçerik satırları (başlık | içerik / bağlantı)"),
            true,
          )}
        {["comparison", "sizeTable"].includes(node.kind) && (
          <>
            {field("columns", t("Kolonlar (| ile ayır)"))}
            {field("rows", t("Satırlar (| ile ayır)"), true)}
          </>
        )}
        {node.kind === "shipping" && (
          <>
            {field("threshold", t("Ücretsiz kargo eşiği (para birimi)"))}
            {field("currency", t("Para birimi (TRY, USD)"))}
            {field("description", t("Teslimat / iade açıklaması"), true)}
          </>
        )}
        {node.kind === "variantPicker" && (
          <label>
            {t("Varyant görünümü")}
            <select
              value={String(node.props.variantMode || "dropdown")}
              onChange={(e) => prop("variantMode", e.target.value)}
            >
              <option value="dropdown">Dropdown</option>
              <option value="buttons">{t("Düğmeler")}</option>
            </select>
          </label>
        )}
        {node.kind === "bundle" && (
          <>
            {field("productIds", t("Paket ürün ID listesi (virgülle)"))}
            {field("discountPercent", t("Paket indirimi (%)"))}
          </>
        )}
        {["addToCart", "stickyCart"].includes(node.kind) &&
          field("quantityOffers", t("Adet teklifleri (3:10,5:15)"))}
        {node.kind === "coupon" && field("couponCode", t("Kupon kodu"))}
        {node.kind === "rating" && (
          <>
            {field("rating", t("Puan"))}
            {field("count", t("Değerlendirme sayısı"))}
          </>
        )}
        {["popup", "videoPopup"].includes(node.kind) && (
          <>
            {field("popupId", t("Popup ID"))}
            {field("text", t("Açma düğmesi metni"))}
            {field("trigger", t("Tetikleyici (button)"))}
            {node.kind === "videoPopup" && field("src", t("Video URL"))}
          </>
        )}
        {[
          "product",
          "section",
          "quantity",
          "productField",
          "productGallery",
          "variantPicker",
          "addToCart",
          "stickyCart",
          "bundle",
        ].includes(node.kind) && (
          <>
            <label className="control">
              {t("Yerel ürün")}
              <select
                aria-label={t("Yerel ürün seç")}
                value={String(node.props.productId || "")}
                onChange={(e) => prop("productId", e.target.value)}
              >
                <option value="">{t("Ürün seç")}</option>
                {studio.catalog.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="control">
              {t("Yerel koleksiyon")}
              <select
                aria-label={t("Yerel koleksiyon seç")}
                value={String(node.props.collectionId || "")}
                onChange={(e) => prop("collectionId", e.target.value)}
              >
                <option value="">{t("Koleksiyon seç")}</option>
                {studio.catalog.collections.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            {field(
              "field",
              t("Dinamik alan (title, price, description, metafield)"),
            )}
            {field("metafield", t("Metafield anahtarı"))}
            <p>
              {t(
                "Shopify bağlantısı bu aşamada kapalı; yerel katalog kullanılır.",
              )}
            </p>
          </>
        )}
        {node.kind === "customCode" &&
          field("code", t("HTML (script çalıştırılmaz)"), true)}
        <label className="control">
          {t("Özel font")}
          <select
            aria-label={t("Özel font seç")}
            value={String(node.styles[device].fontFamily || "")}
            onChange={(e) =>
              update((n) => ({
                ...n,
                styles: {
                  ...n.styles,
                  [device]: { ...n.styles[device], fontFamily: e.target.value },
                },
              }))
            }
          >
            <option value="">{t("Global font")}</option>
            {[
              ...new Set(
                assets.filter((a) => a.type === "font").map((a) => a.family),
              ),
            ].map((f) => (
              <option key={f} value={`${f}, Arial, sans-serif`}>
                {f}
              </option>
            ))}
          </select>
        </label>
        {Object.entries(face?.axes || {})
          .slice(0, 8)
          .map(([tag, axis]) => (
            <label className="control" key={tag}>
              <span>
                {t("Değişken font ·") + " "}
                {tag} ({axis.min}–{axis.max})
              </span>
              <input
                aria-label={t("Font ekseni {p0}", { p0: tag })}
                type="range"
                min={axis.min}
                max={axis.max}
                step={1}
                value={
                  axisValues[tag] ??
                  (tag === "wght"
                    ? Number(effective.fontWeight) ||
                      studio.brand.typography[
                        (node.kind === "heading"
                          ? String(node.props.tag || "h2")
                          : "body") + "Weight"
                      ] ||
                      axis.default
                    : axis.default)
                }
                onChange={(e) => {
                  const next = { ...axisValues, [tag]: Number(e.target.value) };
                  update((n) => ({
                    ...n,
                    styles: {
                      ...n.styles,
                      [device]: {
                        ...n.styles[device],
                        fontVariationSettings: Object.entries(next)
                          .map(([k, v]) => `"${k}" ${v}`)
                          .join(", "),
                        ...(tag === "wght"
                          ? { fontWeight: e.target.value }
                          : {}),
                      },
                    },
                  }));
                }}
              />
            </label>
          ))}
        <StateStyles node={node} update={update} />
      </div>
    </>
  );
}
