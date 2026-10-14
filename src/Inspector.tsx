import { t } from "./i18n.ts";
import { SpacingDiagram } from "./SpacingDiagram";
import { IconPicker } from "./IconPicker";
import { CollectionGridSettings } from "./CatalogSettings";
import { AccordionItemsPanel } from "./AccordionItems";
import { TextStyleControls } from "./TextStyleControls";
import { LayoutChoices } from "./LayoutChoices";
import { setColumnCount } from "./columnLayouts";
import { useState, useEffect } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Copy,
  RotateCcw,
  Settings2,
  Trash2,
  Eye,
  EyeOff,
  SlidersHorizontal,
} from "lucide-react";
import {
  deviceNames,
  effectiveStyle,
  labels,
  type Block,
  type Device,
  type Styles,
} from "./model";
import { editableText } from "./Renderer";
import { NodeExtras } from "./NodeExtras";
import {
  resolveBrandStyles,
  fontFamilyFor,
  useStudio,
  type Asset,
} from "./studio";
import { blockIcons } from "./icons";
import { normalizeLink } from "./links";
import { freeHeight, placedStyle } from "./freePlacement";
import { StyleInput } from "./StyleInput";
import { normalizeStyleValue } from "./styleValues";
type Props = {
  node?: Block;
  back: () => void;
  openMedia: () => void;
  storeId: string;
  assets: Asset[];
  device: Device;
  update: (change: (node: Block) => Block, key?: string) => void;
  duplicate: () => void;
  remove: () => void;
  move: (direction: -1 | 1) => void;
  setLayout: (id: string, enabled: boolean) => void;
  contentIntent?: number;
  /** Changes when the canvas asks to open the icon library. */
  iconRequest?: number;
  parentFree?: boolean;
};
export function Inspector({
  node,
  back,
  openMedia,
  storeId,
  assets,
  device,
  update,
  duplicate,
  remove,
  move,
  setLayout,
  contentIntent = 0,
  iconRequest = 0,
  parentFree = false,
}: Props) {
  const [tab, setTab] = useState("style");
  useEffect(() => {
    if (contentIntent || iconRequest) setTab("style");
  }, [contentIntent, iconRequest]);
  const [linked, setLinked] = useState(true);
  const { brand } = useStudio();
  if (!node)
    return (
      <aside className="inspector">
        <div className="inspector-heading">
          {t("Öğe ayarları") + " "}
          <Settings2 size={15} />
        </div>
        <div className="empty-inspector">
          <MouseGraphic />
          <h3>{t("Her ayrıntı senin elinde.")}</h3>
          <p>{t("Düzenlemek için tasarım alanından bir öğe seç.")}</p>
          <small>
            {t("İpucu: Metne çift tıklayarak doğrudan düzenleyebilirsin.")}
          </small>
        </div>
      </aside>
    );
  const Icon = blockIcons[node.kind];
  const nodeId = node.id;
  const effective = resolveBrandStyles(
    placedStyle(node, device, parentFree),
    brand,
    device,
  ) as Styles;
  const element = document.querySelector<HTMLElement>(
    `[data-node-id="${node.id}"]`,
  );
  if (element)
    for (const key of Object.keys(effective)) {
      if (effective[key] === "inherit")
        effective[key] = getComputedStyle(element)[
          key as keyof CSSStyleDeclaration
        ] as string;
      const rgb = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(
        String(effective.color),
      );
      if (rgb)
        effective.color =
          "#" +
          rgb
            .slice(1)
            .map((v) => Number(v).toString(16).padStart(2, "0"))
            .join("");
    }
  const own = node.styles[device];
  const style = (key: string, value: string | number) =>
    update(
      (current) => ({
        ...current,
        styles: {
          ...current.styles,
          [device]: {
            ...current.styles[device],
            [key]: normalizeStyleValue(key, value),
          },
        },
      }),
      `style:${node.id}:${device}:${key}`,
    );
  const prop = (key: string, value: string | boolean) =>
    update(
      (current) => ({ ...current, props: { ...current.props, [key]: value } }),
      `prop:${node.id}:${key}`,
    );
  const reset = (key: string) =>
    update((current) => {
      const next = { ...current.styles[device] };
      delete next[key];
      return { ...current, styles: { ...current.styles, [device]: next } };
    });
  const input = (key: string, label: string, placeholder = "auto") => (
    <div className="control" key={key}>
      <span>
        {label}
        {device !== "desktop" && key in own && (
          <i className="override-dot" title={t("Bu cihazda özel değer")} />
        )}{" "}
        {key in own && (
          <button
            className="field-reset"
            title={t("Değeri sıfırla")}
            aria-label={t("{p0} sıfırla", { p0: label })}
            onClick={(event) => {
              event.preventDefault();
              reset(key);
            }}
          >
            <RotateCcw size={10} />
          </button>
        )}
      </span>
      <StyleInput
        key={`${nodeId}:${device}:${key}`}
        label={label}
        value={effective[key]}
        placeholder={placeholder}
        onChange={(value) => style(key, value)}
      />
    </div>
  );
  const select = (key: string, label: string, choices: [string, string][]) => (
    <label className="control">
      <span>{label}</span>
      <select
        aria-label={label}
        value={String(effective[key] ?? choices[0][0])}
        onChange={(event) => style(key, event.target.value)}
      >
        {choices.map(([value, name]) => (
          <option key={value} value={value}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
  const color = (key: string, label: string) => (
    <div className="control color-control">
      <span>{label}</span>
      <div className="color-field">
        <input
          type="color"
          aria-label={t("{p0} seçici", { p0: label })}
          value={
            /^#[a-f0-9]{6}$/i.test(String(effective[key]))
              ? String(effective[key])
              : "#ffffff"
          }
          onChange={(event) => style(key, event.target.value)}
        />
        <input
          aria-label={label}
          value={String(effective[key] ?? "")}
          placeholder="#ffffff"
          onChange={(event) => style(key, event.target.value)}
        />
        <button
          title={t("Rengi sıfırla")}
          aria-label={t("{p0} sıfırla", { p0: label })}
          onClick={(event) => {
            event.preventDefault();
            reset(key);
          }}
        >
          <RotateCcw size={12} />
        </button>
      </div>
    </div>
  );
  const textProp = (key: string, label: string, multiline = false) => (
    <label className="control">
      <span>{label}</span>
      {multiline ? (
        <textarea
          aria-label={label}
          rows={4}
          value={
            key === "html"
              ? editableText(node.props[key])
              : String(node.props[key] ?? "")
          }
          onChange={(event) =>
            prop(
              key,
              key === "html"
                ? event.target.value
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/\n/g, "<br/>")
                : event.target.value,
            )
          }
        />
      ) : (
        <input
          aria-label={label}
          value={String(node.props[key] ?? "")}
          onChange={(event) => prop(key, event.target.value)}
        />
      )}
    </label>
  );
  return (
    <aside className="inspector">
      <div className="inspector-heading">
        <button
          aria-label={t("Back to elements")}
          title={t("Back to elements")}
          onClick={back}
        >
          <ArrowLeft size={16} />
        </button>
        <span>
          <Icon size={16} /> {labels[node.kind]}
        </span>
        <div className="icon-actions">
          <button title={t("Kopyala")} onClick={duplicate}>
            <Copy size={14} />
          </button>
          <button title={t("Sil")} onClick={remove}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="inspector-tabs">
        {[
          ["style", t("Ayarlar")],
          ["advanced", t("Gelişmiş")],
        ].map(([id, name]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="device-notice">
        <span className={`device-dot ${device}`} />
        {deviceNames[device]}
        {" " + t("ayarları")}
        {device !== "desktop" && (
          <button
            title={t("Bu cihazın tüm stil değişikliklerini sıfırla")}
            onClick={() =>
              update((current) => ({
                ...current,
                styles: { ...current.styles, [device]: {} },
              }))
            }
          >
            <RotateCcw size={12} />
          </button>
        )}
      </div>
      <div className="inspector-scroll">
        {tab === "style" && node.kind === "icon" && (
          <IconPicker
            node={node}
            openMedia={openMedia}
            update={update}
            style={style}
            styles={effective}
            openRequest={iconRequest}
            fit={() =>
              update((n) => ({
                ...n,
                styles: {
                  ...n.styles,
                  [device]: {
                    ...n.styles[device],
                    width: "fit-content",
                    height: "auto",
                    lineHeight: 1,
                    display: "inline-flex",
                  },
                },
              }))
            }
          />
        )}
        {tab === "style" && node.kind === "collectionGrid" && (
          <CollectionGridSettings node={node} update={update} />
        )}
        {tab === "style" && node.kind === "accordion" && (
          <AccordionItemsPanel node={node} update={update} />
        )}
        {tab === "style" &&
          ["heading", "text", "button", "badge"].includes(node.kind) && (
            <TextStyleControls
              styles={effective}
              fonts={[
                fontFamilyFor(
                  brand,
                  node.kind === "heading"
                    ? "heading"
                    : node.kind === "button"
                      ? "button"
                      : "body",
                ),
                "Arial, sans-serif",
                "Georgia, serif",
                "Verdana, sans-serif",
                ...assets
                  .filter((a) => a.type === "font")
                  .map((a) => `${a.family}, ${brand.fonts.fallback}`),
              ]}
              change={style}
            />
          )}
        {tab === "style" && ["section", "row"].includes(node.kind) && (
          <section className="simple-column-layout">
            <h3>{t("Layout")}</h3>
            <LayoutChoices
              count={
                (node.kind === "row"
                  ? node
                  : node.children.find((n) => n.kind === "row")
                )?.children.filter((n) => n.kind === "column").length || 0
              }
              change={(count) =>
                update((current) => setColumnCount(current, count, device))
              }
            />
          </section>
        )}
        {tab === "style" && (
          <>
            <details open>
              <summary>{t("Öğe içeriği")}</summary>
              <div className="settings-body">
                <label className="control">
                  <span>{t("Katman adı")}</span>
                  <input
                    aria-label={t("Katman adı")}
                    value={node.name}
                    onChange={(event) =>
                      update(
                        (current) => ({ ...current, name: event.target.value }),
                        `name:${node.id}`,
                      )
                    }
                  />
                </label>
                {["heading", "text"].includes(node.kind) &&
                  textProp("html", t("Metin içeriği"), true)}
                {node.kind === "heading" && (
                  <label className="control">
                    <span>{t("HTML etiketi")}</span>
                    <select
                      aria-label={t("HTML etiketi")}
                      value={String(node.props.tag)}
                      onChange={(event) => prop("tag", event.target.value)}
                    >
                      {["h1", "h2", "h3", "h4", "h5", "h6", "p", "div"].map(
                        (tag) => (
                          <option key={tag}>{tag}</option>
                        ),
                      )}
                    </select>
                  </label>
                )}
                {["button", "badge"].includes(node.kind) &&
                  textProp("text", t("Yazı"))}
                {(["image", "video"].includes(node.kind) ||
                  (node.kind === "product" && !node.props.atomicContent)) &&
                  textProp(
                    "src",
                    node.kind === "video" ? t("Video URL") : t("Görsel URL"),
                  )}
                {node.kind === "image" && (
                  <>
                    {textProp("alt", t("Alternatif metin"))}
                    <p className="setting-help">
                      {t(
                        "Görseller için HTTPS adresi veya yerel varlık yolu kullan.",
                      )}
                    </p>
                  </>
                )}
                {node.kind === "button" && (
                  <>
                    <label className="control">
                      <span>{t("Bağlantı")}</span>
                      <input
                        aria-label={t("Bağlantı")}
                        placeholder="https://… veya /sayfa"
                        value={String(
                          node.props.action === "navigate" || !node.props.action
                            ? node.props.href && node.props.href !== "#"
                              ? node.props.href
                              : node.props.actionTarget || ""
                            : node.props.href || "",
                        )}
                        onChange={(event) =>
                          update(
                            (current) => ({
                              ...current,
                              props: {
                                ...current.props,
                                action: "navigate",
                                actionTarget: "",
                                href: event.target.value,
                              },
                            }),
                            `link:${node.id}`,
                          )
                        }
                        onBlur={() => {
                          const href = normalizeLink(node.props.href);
                          if (href && href !== node.props.href)
                            prop("href", href);
                        }}
                      />
                      <small>
                        {t("Adres girildiğinde düğme bu bağlantıya gider.")}
                      </small>
                    </label>
                    <label className="toggle-row">
                      <span>{t("Yeni sekmede aç")}</span>
                      <input
                        type="checkbox"
                        checked={!!node.props.targetBlank}
                        onChange={(event) =>
                          prop("targetBlank", event.target.checked)
                        }
                      />
                    </label>
                  </>
                )}
                {["input", "textarea"].includes(node.kind) &&
                  textProp("placeholder", t("Yer tutucu metin"))}
                {node.kind === "input" && (
                  <label className="control">
                    <span>{t("Alan türü")}</span>
                    <select
                      value={String(node.props.inputType)}
                      onChange={(event) =>
                        prop("inputType", event.target.value)
                      }
                    >
                      {["text", "email", "tel", "number"].map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                  </label>
                )}
                {node.kind === "list" &&
                  textProp(
                    "items",
                    t("Liste öğeleri (her satır bir öğe)"),
                    true,
                  )}
                {(node.kind === "accordion" ||
                  (node.kind === "product" && !node.props.atomicContent)) && (
                  <>
                    {textProp("title", t("Başlık"))}
                    {textProp("description", t("Açıklama"), true)}
                  </>
                )}
                {node.kind === "product" && !node.props.atomicContent && (
                  <>
                    {textProp("price", t("Fiyat"))}
                    {textProp("comparePrice", t("Eski fiyat"))}
                    <p className="setting-help">
                      {t(
                        "Bu kart örnek veridir. Gerçek ürün ve sepet işlemleri Shopify bağlantısı gerektirir.",
                      )}
                    </p>
                  </>
                )}
                {node.kind === "countdown" && (
                  <label className="control">
                    <span>{t("Bitiş zamanı")}</span>
                    <input
                      aria-label={t("Bitiş zamanı")}
                      type="datetime-local"
                      value={String(node.props.endDate)}
                      onChange={(event) => prop("endDate", event.target.value)}
                    />
                  </label>
                )}
                {[
                  "section",
                  "row",
                  "column",
                  "box",
                  "divider",
                  "spacer",
                ].includes(node.kind) && (
                  <p className="setting-help">
                    {t(
                      "Bu öğenin ölçü ve görünümünü Ayarlar sekmesinden düzenle.",
                    )}
                  </p>
                )}
              </div>
            </details>
          </>
        )}
        {tab === "style" && (
          <>
            <details open>
              <summary>
                {t("Yerleşim") + " "}
                <SlidersHorizontal size={13} />
              </summary>
              <div className="settings-body">
                <div className="control-grid">
                  {input("width", t("Genişlik"), "100%")}
                  {input("height", t("Yükseklik"))}
                  {input("maxWidth", t("Maks. genişlik"))}
                  {input("minHeight", t("Min. yükseklik"))}
                  {input("order", t("Bu cihazda sıralama"), "0")}
                  {input("flexBasis", t("Kolon genişliği"), "50%")}
                </div>
                {[
                  "section",
                  "row",
                  "column",
                  "box",
                  "itemList",
                  "list",
                  "rating",
                  "product",
                ].includes(node.kind) && (
                  <>
                    <label className="control">
                      <span>
                        {t("Yerleşim modu ·") + " "}
                        {deviceNames[device]}
                      </span>
                      <select
                        aria-label={t("Yerleşim modu")}
                        value={freeHeight(node, device) ? "free" : "flow"}
                        onChange={(e) =>
                          setLayout(node.id, e.target.value === "free")
                        }
                      >
                        <option value="flow">{t("Otomatik akış")}</option>
                        <option value="free">{t("Serbest yerleştirme")}</option>
                      </select>
                    </label>
                    {freeHeight(node, device) && (
                      <label className="control">
                        <span>{t("Serbest alan yüksekliği")}</span>
                        <input
                          aria-label={t("Serbest alan yüksekliği")}
                          type="number"
                          min={100}
                          max={5000}
                          value={freeHeight(node, device)!}
                          onChange={(e) => {
                            const value = Math.max(
                              100,
                              Math.min(5000, Number(e.target.value)),
                            );
                            update((n) => ({
                              ...n,
                              props: {
                                ...n.props,
                                freeLayout: JSON.stringify({
                                  ...JSON.parse(
                                    String(n.props.freeLayout || "{}"),
                                  ),
                                  [device]: value,
                                }),
                              },
                            }));
                          }}
                        />
                      </label>
                    )}
                    <small className="setting-help">
                      {t(
                        "Serbest modda öğeleri tutup taşı; kenar tutamaçlarıyla boyutlandır. Her cihazın yerleşimi ayrıdır.",
                      )}
                    </small>
                  </>
                )}
                {[
                  "section",
                  "row",
                  "column",
                  "box",
                  "itemList",
                  "list",
                  "rating",
                  "product",
                ].includes(node.kind) && (
                  <>
                    {select("display", t("Düzen"), [
                      ["flex", "Flex"],
                      ["grid", "Grid"],
                      ["block", "Block"],
                    ])}
                    {select("flexDirection", t("Yön"), [
                      ["row", t("Yatay")],
                      ["column", t("Dikey")],
                      ["row-reverse", t("Yatay ters")],
                      ["column-reverse", t("Dikey ters")],
                    ])}
                    {select("justifyContent", t("Dağılım"), [
                      ["flex-start", t("Başlangıç")],
                      ["center", t("Ortala")],
                      ["flex-end", t("Bitiş")],
                      ["space-between", t("Araya dağıt")],
                      ["space-around", t("Çevreye dağıt")],
                    ])}
                    {select("alignItems", t("Hizalama"), [
                      ["stretch", t("Esnet")],
                      ["flex-start", t("Başlangıç")],
                      ["center", t("Ortala")],
                      ["flex-end", t("Bitiş")],
                    ])}
                    <div className="control-grid">
                      {input("gap", t("Öğe aralığı"), "16px")}
                      {select("flexWrap", t("Sarma"), [
                        ["nowrap", t("Tek satır")],
                        ["wrap", t("Alt satıra geç")],
                      ])}
                    </div>
                    {effective.display === "grid" &&
                      input(
                        "gridTemplateColumns",
                        t("Grid kolonları"),
                        "1fr 1fr",
                      )}
                  </>
                )}
                {node.kind === "image" &&
                  select("objectFit", t("Görsel yerleşimi"), [
                    ["contain", t("Sığdır")],
                    ["cover", t("Doldur")],
                    ["fill", t("Esnet")],
                  ])}
              </div>
            </details>
            <details open>
              <summary>{t("Boşluklar")}</summary>
              <div className="settings-body">
                <SpacingDiagram
                  identity={`${nodeId}:${device}`}
                  styles={effective}
                  linked={linked}
                  toggle={() => setLinked(!linked)}
                  change={(prefix, side, value) =>
                    update((current) => {
                      const values = { ...current.styles[device] };
                      (linked
                        ? ["Top", "Right", "Bottom", "Left"]
                        : [side]
                      ).forEach(
                        (s) =>
                          (values[prefix + s] = normalizeStyleValue(
                            prefix + s,
                            value,
                          )),
                      );
                      return {
                        ...current,
                        styles: { ...current.styles, [device]: values },
                      };
                    }, `spacing:${nodeId}:${device}:${prefix}`)
                  }
                />
              </div>
            </details>
            {!["heading", "text", "button", "badge", "icon"].includes(
              node.kind,
            ) && (
              <>
                <details>
                  <summary>{t("Tipografi")}</summary>
                  <div className="settings-body">
                    {select("fontFamily", t("Yazı tipi"), [
                      ...[
                        ...new Set(
                          assets
                            .filter((a) => a.type === "font")
                            .map((a) => a.family),
                        ),
                      ].map(
                        (f) =>
                          [`${f}, ${brand.fonts.fallback}`, String(f)] as [
                            string,
                            string,
                          ],
                      ),
                      ["var(--font-heading)", t("Marka başlık fontu")],
                      ["var(--font-body)", t("Marka gövde fontu")],
                      ["var(--font-button)", t("Marka düğme fontu")],
                      ["Arial, sans-serif", "Arial"],
                      ["Georgia, serif", "Georgia"],
                      ["Verdana, sans-serif", "Verdana"],
                      ["Courier New, monospace", "Monospace"],
                    ])}
                    <div className="control-grid">
                      {input("fontSize", t("Yazı boyutu"), "16px")}
                      {select("fontWeight", t("Kalınlık"), [
                        ["400", "Regular"],
                        ["500", "Medium"],
                        ["600", "Semibold"],
                        ["700", "Bold"],
                        ["800", "Extra bold"],
                      ])}
                      {input("lineHeight", t("Satır yüksekliği"), "1.5")}
                      {input("letterSpacing", t("Harf aralığı"), "0px")}
                    </div>
                    <div className="alignment-buttons">
                      {[
                        ["left", AlignLeft],
                        ["center", AlignCenter],
                        ["right", AlignRight],
                      ].map(([value, Alignment]) => {
                        const Icon = Alignment as typeof AlignLeft;
                        return (
                          <button
                            key={String(value)}
                            title={t("Metin hizası: {p0}", { p0: value })}
                            className={
                              effective.textAlign === value ? "active" : ""
                            }
                            onClick={() => style("textAlign", String(value))}
                          >
                            <Icon size={15} />
                          </button>
                        );
                      })}
                    </div>
                    {select("textTransform", t("Harf biçimi"), [
                      ["none", t("Normal")],
                      ["uppercase", t("BÜYÜK HARF")],
                      ["lowercase", t("küçük harf")],
                      ["capitalize", t("Baş Harfler")],
                    ])}
                    {color("color", t("Metin rengi"))}
                  </div>
                </details>
              </>
            )}
            <details open>
              <summary>{t("Arka plan ve kenarlık")}</summary>
              <div className="settings-body">
                {color("backgroundColor", t("Arka plan"))}
                <div className="control-grid">
                  {input("borderWidth", t("Kenarlık kalınlığı"), "0px")}
                  {input("borderRadius", t("Köşe yuvarlaklığı"), "0px")}
                </div>
                {select("borderStyle", t("Kenarlık biçimi"), [
                  ["solid", t("Düz")],
                  ["dashed", t("Kesik")],
                  ["dotted", t("Noktalı")],
                  ["none", t("Yok")],
                ])}
                {color("borderColor", t("Kenarlık rengi"))}
                {input("boxShadow", t("Gölge"), "0 8px 24px #00000015")}
              </div>
            </details>
          </>
        )}
        {tab === "style" && node && (
          <details className="content-behaviour">
            <summary>{t("Content and behaviour")}</summary>
            <NodeExtras
              node={node}
              update={update}
              openMedia={openMedia}
              assets={assets}
              storeId={storeId}
              device={device}
            />
          </details>
        )}
        {tab === "advanced" && (
          <>
            <details open>
              <summary>{t("Cihaz görünürlüğü")}</summary>
              <div className="settings-body">
                {(["desktop", "tablet", "mobile"] as Device[]).map((key) => (
                  <label className="toggle-row" key={key}>
                    <span>
                      {node.hidden[key] ? (
                        <EyeOff size={14} />
                      ) : (
                        <Eye size={14} />
                      )}{" "}
                      {deviceNames[key]}
                    </span>
                    <input
                      type="checkbox"
                      aria-label={t("{p0} görünürlük", {
                        p0: deviceNames[key],
                      })}
                      checked={!node.hidden[key]}
                      onChange={(event) =>
                        update((current) => ({
                          ...current,
                          hidden: {
                            ...current.hidden,
                            [key]: !event.target.checked,
                          },
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            </details>
            <details open>
              <summary>{t("Konum ve efektler")}</summary>
              <div className="settings-body">
                {select("position", t("Konum"), [
                  ["relative", t("Normal")],
                  ["absolute", "Absolute"],
                  ["sticky", "Sticky"],
                ])}
                <div className="control-grid">
                  {input("top", t("Üst konum"))}
                  {input("left", t("Sol konum"))}
                  {input("zIndex", t("Katman sırası"), "auto")}
                  {input("opacity", t("Opaklık"), "1")}
                </div>
                {select("overflow", t("Taşma"), [
                  ["visible", t("Görünür")],
                  ["hidden", t("Gizle")],
                  ["auto", t("Kaydır")],
                ])}
                <label className="control">
                  <span>{t("Animasyon")}</span>
                  <select
                    aria-label={t("Animasyon")}
                    value={String(node.props.animation ?? "none")}
                    onChange={(event) => prop("animation", event.target.value)}
                  >
                    {[
                      ["none", t("Yok")],
                      ["fade", "Fade in"],
                      ["slide", "Slide up"],
                      ["zoom", "Zoom in"],
                    ].map(([key, label]) => (
                      <option value={key} key={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {textProp("cssId", t("HTML kimliği (ID)"))}
              </div>
            </details>
          </>
        )}
        <div className="layer-order">
          <button onClick={() => move(-1)}>
            <ArrowUp size={13} />
            {" " + t("Yukarı")}
          </button>
          <button onClick={() => move(1)}>
            <ArrowDown size={13} />
            {" " + t("Aşağı")}
          </button>
        </div>
      </div>
      <div className="inspector-footer">
        <span>●</span>{" "}
        {device === "desktop"
          ? t("Temel stil · tüm cihazlara aktarılır")
          : t("Özel değerler yalnızca bu cihazda geçerli")}
      </div>
    </aside>
  );
}
function MouseGraphic() {
  return (
    <div className="mouse-graphic">
      <Settings2 size={28} />
    </div>
  );
}
