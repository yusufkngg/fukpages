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
  update: (f: (b: Block) => Block) => void;
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
  return (
    <details open>
      <summary>Ek içerik ve davranış</summary>
      <div className="settings-body">
        <label className="toggle-row">
          Öğeyi kilitle
          <input
            aria-label="Öğeyi kilitle"
            type="checkbox"
            checked={!!node.props.locked}
            onChange={(e) => prop("locked", e.target.checked)}
          />
        </label>
        <label className="toggle-row">
          Global stilden ayır
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
          Global stile geri dön
        </button>
        {node.kind === "text" && (
          <label className="control">
            Global metin stili
            <select
              value={String(node.props.globalStyle || "body")}
              onChange={(e) => prop("globalStyle", e.target.value)}
            >
              <option value="body">Gövde</option>
              <option value="small">Küçük metin</option>
              <option value="link">Bağlantı</option>
            </select>
          </label>
        )}
        {[
          "image",
          "productGallery",
          "gallery",
          "carousel",
          "logos",
          "beforeAfter",
          "product",
          "section",
          "box",
        ].includes(node.kind) && (
          <button onClick={openMedia}>Medya kütüphanesini aç</button>
        )}
        {node.kind === "image" && (
          <>
            {field("mobileSrc", "Mobil görsel URL")}
            {field("href", "Görsel bağlantısı")}
            {field("aspectRatio", "En-boy oranı (örn. 1 / 1)")}
            {field("rotation", "Döndürme (derece)")}
            {field("focusX", "Odak X (%)")}
            {field("focusY", "Odak Y (%)")}
            {(["flipX", "flipY", "lightbox"] as const).map((k) => (
              <label className="toggle-row" key={k}>
                {
                  {
                    flipX: "Yatay çevir",
                    flipY: "Dikey çevir",
                    lightbox: "Tıklayınca büyüt",
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
              <p>Kırpma alanı (%) · yeni dosya oluşturur</p>
              {(["x", "y", "width", "height"] as const).map((k) => (
                <label key={k}>
                  {k}
                  <input
                    aria-label={`Kırpma ${k}`}
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
                Görseli kırp
              </button>
              {error && <p role="alert">{error}</p>}
            </>
          )}
        {["section", "box"].includes(node.kind) && (
          <>
            {field("backgroundSrc", "Arka plan görseli URL")}
            {field("backgroundOverlay", "Renk katmanı (#00000080)")}
          </>
        )}
        {node.kind === "button" && (
          <>
            <label className="control">
              <span>Aksiyon</span>
              <select
                aria-label="Buton aksiyonu"
                value={String(node.props.action || "navigate")}
                onChange={(e) => prop("action", e.target.value)}
              >
                {Object.entries({
                  navigate: "Sayfaya git",
                  product: "Ürüne git",
                  collection: "Koleksiyona git",
                  scroll: "Bölüme kaydır",
                  popupOpen: "Popup aç",
                  popupClose: "Popup kapat",
                  addToCart: "Sepete ekle",
                  cartOpen: "Sepeti aç",
                  formSubmit: "Form gönder",
                  copyCoupon: "Kupon kopyala",
                  phone: "Telefon",
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
              field("actionTarget", "Aksiyon hedefi / bölüm veya popup ID")}
            {["addToCart", "product", "collection"].includes(
              String(node.props.action),
            ) && field("productId", "Ürün ID (yerel katalog)")}
            <label className="control">
              Global düğme stili
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
          "collectionGrid",
        ].includes(node.kind) && (
          <label className="control">
            <span>
              {node.kind === "collectionGrid"
                ? "Koleksiyon kaynağı"
                : "Ürün kaynağı"}
            </span>
            <select
              aria-label="Katalog veri kaynağı"
              value={String(
                node.props.resourceBinding ||
                  (node.props.productId || node.props.collectionId
                    ? "fixed"
                    : "page"),
              )}
              onChange={(e) => prop("resourceBinding", e.target.value)}
            >
              <option value="page">Bu sayfaya atanan hedef</option>
              <option value="fixed">Öğede seçilen ürün / koleksiyon</option>
            </select>
          </label>
        )}
        {["input", "textarea", "select", "checkbox", "radio"].includes(
          node.kind,
        ) && (
          <>
            {field("label", "Alan etiketi")}
            {field("fieldName", "Alan adı")}
            {field("helpText", "Alan açıklaması")}
            {field("errorMessage", "Hata mesajı")}
            {["select", "radio"].includes(node.kind) &&
              field("options", "Seçenekler (her satır bir seçenek)", true)}
            <label className="toggle-row">
              Zorunlu alan
              <input
                type="checkbox"
                checked={!!node.props.required}
                onChange={(e) => prop("required", e.target.checked)}
              />
            </label>
            {node.kind === "checkbox" && (
              <label className="toggle-row">
                Pazarlama izni alanı
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
              Form hedefi
              <select
                value={String(node.props.destination || "local")}
                onChange={(e) => prop("destination", e.target.value)}
              >
                <option value="local">Uygulama içi gönderim kayıtları</option>
                <option value="webhook">
                  Webhook + uygulama kayıtları (bağlantı gerekli)
                </option>
              </select>
            </label>
            <p>
              Hedef:{" "}
              {node.props.destination === "webhook"
                ? studio.formDestination
                : "Uygulama içi gönderim kayıtları"}
            </p>
            {field("submitLabel", "Gönderim düğmesi metni")}
            {field("successMessage", "Başarılı gönderim mesajı")}
            {field("redirect", "Başarılı gönderim yönlendirmesi")}
          </>
        )}
        {["gallery", "carousel", "logos", "beforeAfter"].includes(node.kind) &&
          field("images", "Görseller (her satır bir URL)", true)}
        {["tabs", "carousel", "breadcrumb", "mobileMenu", "blogList"].includes(
          node.kind,
        ) &&
          field("items", "İçerik satırları (başlık | içerik / bağlantı)", true)}
        {["comparison", "sizeTable"].includes(node.kind) && (
          <>
            {field("columns", "Kolonlar (| ile ayır)")}
            {field("rows", "Satırlar (| ile ayır)", true)}
          </>
        )}
        {node.kind === "shipping" && (
          <>
            {field("threshold", "Ücretsiz kargo eşiği (para birimi)")}
            {field("currency", "Para birimi (TRY, USD)")}
            {field("description", "Teslimat / iade açıklaması", true)}
          </>
        )}
        {node.kind === "variantPicker" && (
          <label>
            Varyant görünümü
            <select
              value={String(node.props.variantMode || "dropdown")}
              onChange={(e) => prop("variantMode", e.target.value)}
            >
              <option value="dropdown">Dropdown</option>
              <option value="buttons">Düğmeler</option>
            </select>
          </label>
        )}
        {node.kind === "bundle" && (
          <>
            {field("productIds", "Paket ürün ID listesi (virgülle)")}
            {field("discountPercent", "Paket indirimi (%)")}
          </>
        )}
        {["addToCart", "stickyCart"].includes(node.kind) &&
          field("quantityOffers", "Adet teklifleri (3:10,5:15)")}
        {node.kind === "coupon" && field("couponCode", "Kupon kodu")}
        {node.kind === "rating" && (
          <>
            {field("rating", "Puan")}
            {field("count", "Değerlendirme sayısı")}
          </>
        )}
        {["popup", "videoPopup"].includes(node.kind) && (
          <>
            {field("popupId", "Popup ID")}
            {field("text", "Açma düğmesi metni")}
            {field("trigger", "Tetikleyici (button)")}
            {node.kind === "videoPopup" && field("src", "Video URL")}
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
          "collectionGrid",
        ].includes(node.kind) && (
          <>
            <label className="control">
              Yerel ürün
              <select
                aria-label="Yerel ürün seç"
                value={String(node.props.productId || "")}
                onChange={(e) => prop("productId", e.target.value)}
              >
                <option value="">Ürün seç</option>
                {studio.catalog.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="control">
              Yerel koleksiyon
              <select
                aria-label="Yerel koleksiyon seç"
                value={String(node.props.collectionId || "")}
                onChange={(e) => prop("collectionId", e.target.value)}
              >
                <option value="">Koleksiyon seç</option>
                {studio.catalog.collections.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            {field(
              "field",
              "Dinamik alan (title, price, description, metafield)",
            )}
            {field("metafield", "Metafield anahtarı")}
            <p>
              Shopify bağlantısı bu aşamada kapalı; yerel katalog kullanılır.
            </p>
          </>
        )}
        {node.kind === "customCode" &&
          field("code", "HTML (script çalıştırılmaz)", true)}
        <label className="control">
          Özel font
          <select
            aria-label="Özel font seç"
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
            <option value="">Global font</option>
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
                Değişken font · {tag} ({axis.min}–{axis.max})
              </span>
              <input
                aria-label={`Font ekseni ${tag}`}
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
    </details>
  );
}
