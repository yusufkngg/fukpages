import { useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Copy,
  Link2,
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
import { plain } from "./Renderer";
import { blockIcons } from "./icons";
type Props = {
  node?: Block;
  device: Device;
  update: (change: (node: Block) => Block, key?: string) => void;
  duplicate: () => void;
  remove: () => void;
  move: (direction: -1 | 1) => void;
};
export function Inspector({
  node,
  device,
  update,
  duplicate,
  remove,
  move,
}: Props) {
  const [tab, setTab] = useState("style");
  const [linked, setLinked] = useState(true);
  if (!node)
    return (
      <aside className="inspector">
        <div className="inspector-heading">
          Öğe ayarları <Settings2 size={15} />
        </div>
        <div className="empty-inspector">
          <MouseGraphic />
          <h3>Her ayrıntı senin elinde.</h3>
          <p>Düzenlemek için tasarım alanından bir öğe seç.</p>
          <small>
            İpucu: Metne çift tıklayarak doğrudan düzenleyebilirsin.
          </small>
        </div>
      </aside>
    );
  const Icon = blockIcons[node.kind];
  const nodeId = node.id;
  const effective = effectiveStyle(node, device) as Styles;
  const own = node.styles[device];
  const style = (key: string, value: string | number) =>
    update(
      (current) => ({
        ...current,
        styles: {
          ...current.styles,
          [device]: { ...current.styles[device], [key]: value },
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
          <i className="override-dot" title="Bu cihazda özel değer" />
        )}{" "}
        {key in own && (
          <button
            className="field-reset"
            title="Değeri sıfırla"
            aria-label={`${label} sıfırla`}
            onClick={(event) => {
              event.preventDefault();
              reset(key);
            }}
          >
            <RotateCcw size={10} />
          </button>
        )}
      </span>
      <input
        aria-label={label}
        value={String(effective[key] ?? "")}
        placeholder={placeholder}
        onChange={(event) => style(key, event.target.value)}
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
          aria-label={`${label} seçici`}
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
          title="Rengi sıfırla"
          aria-label={`${label} sıfırla`}
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
              ? plain(node.props[key])
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
  function spacing(prefix: "padding" | "margin") {
    return (
      <div className="spacing-group">
        <div className="spacing-title">
          {prefix === "padding" ? "İç boşluk · padding" : "Dış boşluk · margin"}
          <button
            className={linked ? "active" : ""}
            title="Dört kenarı birlikte değiştir"
            onClick={() => setLinked(!linked)}
          >
            <Link2 size={13} />
          </button>
        </div>
        <div className="spacing-grid">
          {["Top", "Right", "Bottom", "Left"].map((side, index) => (
            <label key={side}>
              <input
                aria-label={`${prefix} ${side}`}
                value={String(effective[prefix + side] ?? "")}
                placeholder="0px"
                onChange={(event) =>
                  update((current) => {
                    const values = { ...current.styles[device] };
                    (linked
                      ? ["Top", "Right", "Bottom", "Left"]
                      : [side]
                    ).forEach((s) => (values[prefix + s] = event.target.value));
                    return {
                      ...current,
                      styles: { ...current.styles, [device]: values },
                    };
                  }, `spacing:${nodeId}:${device}:${prefix}`)
                }
              />
              <small>{["Üst", "Sağ", "Alt", "Sol"][index]}</small>
            </label>
          ))}
        </div>
      </div>
    );
  }
  return (
    <aside className="inspector">
      <div className="inspector-heading">
        <span>
          <Icon size={16} /> {labels[node.kind]}
        </span>
        <div className="icon-actions">
          <button title="Kopyala" onClick={duplicate}>
            <Copy size={14} />
          </button>
          <button title="Sil" onClick={remove}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="inspector-tabs">
        {[
          ["content", "İçerik"],
          ["style", "Tasarım"],
          ["advanced", "Gelişmiş"],
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
        {deviceNames[device]} ayarları
        {device !== "desktop" && (
          <button
            title="Bu cihazın tüm stil değişikliklerini sıfırla"
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
        {tab === "content" && (
          <>
            <details open>
              <summary>Öğe içeriği</summary>
              <div className="settings-body">
                <label className="control">
                  <span>Katman adı</span>
                  <input
                    aria-label="Katman adı"
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
                  textProp("html", "Metin içeriği", true)}
                {node.kind === "heading" && (
                  <label className="control">
                    <span>HTML etiketi</span>
                    <select
                      aria-label="HTML etiketi"
                      value={String(node.props.tag)}
                      onChange={(event) => prop("tag", event.target.value)}
                    >
                      {["h1", "h2", "h3", "h4", "p", "div"].map((tag) => (
                        <option key={tag}>{tag}</option>
                      ))}
                    </select>
                  </label>
                )}
                {["button", "badge", "icon"].includes(node.kind) &&
                  textProp(
                    "text",
                    node.kind === "icon" ? "İkon karakteri" : "Yazı",
                  )}
                {["image", "video", "product"].includes(node.kind) &&
                  textProp(
                    "src",
                    node.kind === "video" ? "Video URL" : "Görsel URL",
                  )}
                {node.kind === "image" && (
                  <>
                    {textProp("alt", "Alternatif metin")}
                    <p className="setting-help">
                      Görseller için HTTPS adresi veya yerel varlık yolu kullan.
                    </p>
                  </>
                )}
                {node.kind === "button" && (
                  <>
                    {textProp("href", "Bağlantı")}
                    <label className="toggle-row">
                      <span>Yeni sekmede aç</span>
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
                  textProp("placeholder", "Yer tutucu metin")}
                {node.kind === "input" && (
                  <label className="control">
                    <span>Alan türü</span>
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
                  textProp("items", "Liste öğeleri (her satır bir öğe)", true)}
                {["product", "accordion"].includes(node.kind) && (
                  <>
                    {textProp("title", "Başlık")}
                    {textProp("description", "Açıklama", true)}
                  </>
                )}
                {node.kind === "product" && (
                  <>
                    {textProp("price", "Fiyat")}
                    {textProp("comparePrice", "Eski fiyat")}
                    <p className="setting-help">
                      Bu kart örnek veridir. Gerçek ürün ve sepet işlemleri
                      Shopify bağlantısı gerektirir.
                    </p>
                  </>
                )}
                {node.kind === "countdown" && (
                  <label className="control">
                    <span>Bitiş zamanı</span>
                    <input
                      aria-label="Bitiş zamanı"
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
                    Bu öğenin ölçü ve görünümünü Tasarım sekmesinden düzenle.
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
                Yerleşim <SlidersHorizontal size={13} />
              </summary>
              <div className="settings-body">
                <div className="control-grid">
                  {input("width", "Genişlik", "100%")}
                  {input("height", "Yükseklik")}
                  {input("maxWidth", "Maks. genişlik")}
                  {input("minHeight", "Min. yükseklik")}
                </div>
                {["section", "row", "column", "box"].includes(node.kind) && (
                  <>
                    {select("display", "Düzen", [
                      ["flex", "Flex"],
                      ["grid", "Grid"],
                      ["block", "Block"],
                    ])}
                    {select("flexDirection", "Yön", [
                      ["row", "Yatay"],
                      ["column", "Dikey"],
                      ["row-reverse", "Yatay ters"],
                      ["column-reverse", "Dikey ters"],
                    ])}
                    {select("justifyContent", "Dağılım", [
                      ["flex-start", "Başlangıç"],
                      ["center", "Ortala"],
                      ["flex-end", "Bitiş"],
                      ["space-between", "Araya dağıt"],
                      ["space-around", "Çevreye dağıt"],
                    ])}
                    {select("alignItems", "Hizalama", [
                      ["stretch", "Esnet"],
                      ["flex-start", "Başlangıç"],
                      ["center", "Ortala"],
                      ["flex-end", "Bitiş"],
                    ])}
                    <div className="control-grid">
                      {input("gap", "Öğe aralığı", "16px")}
                      {select("flexWrap", "Sarma", [
                        ["nowrap", "Tek satır"],
                        ["wrap", "Alt satıra geç"],
                      ])}
                    </div>
                    {effective.display === "grid" &&
                      input("gridTemplateColumns", "Grid kolonları", "1fr 1fr")}
                  </>
                )}
                {node.kind === "image" &&
                  select("objectFit", "Görsel yerleşimi", [
                    ["contain", "Sığdır"],
                    ["cover", "Doldur"],
                    ["fill", "Esnet"],
                  ])}
              </div>
            </details>
            <details open>
              <summary>Boşluklar</summary>
              <div className="settings-body">
                {spacing("padding")}
                {spacing("margin")}
              </div>
            </details>
            <details open>
              <summary>Tipografi</summary>
              <div className="settings-body">
                {select("fontFamily", "Yazı tipi", [
                  ["Arial, sans-serif", "Arial"],
                  ["Georgia, serif", "Georgia"],
                  ["Verdana, sans-serif", "Verdana"],
                  ["Courier New, monospace", "Monospace"],
                ])}
                <div className="control-grid">
                  {input("fontSize", "Yazı boyutu", "16px")}
                  {select("fontWeight", "Kalınlık", [
                    ["400", "Regular"],
                    ["500", "Medium"],
                    ["600", "Semibold"],
                    ["700", "Bold"],
                    ["800", "Extra bold"],
                  ])}
                  {input("lineHeight", "Satır yüksekliği", "1.5")}
                  {input("letterSpacing", "Harf aralığı", "0px")}
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
                        title={`Metin hizası: ${value}`}
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
                {select("textTransform", "Harf biçimi", [
                  ["none", "Normal"],
                  ["uppercase", "BÜYÜK HARF"],
                  ["lowercase", "küçük harf"],
                  ["capitalize", "Baş Harfler"],
                ])}
                {color("color", "Metin rengi")}
              </div>
            </details>
            <details open>
              <summary>Arka plan ve kenarlık</summary>
              <div className="settings-body">
                {color("backgroundColor", "Arka plan")}
                <div className="control-grid">
                  {input("borderWidth", "Kenarlık kalınlığı", "0px")}
                  {input("borderRadius", "Köşe yuvarlaklığı", "0px")}
                </div>
                {select("borderStyle", "Kenarlık biçimi", [
                  ["solid", "Düz"],
                  ["dashed", "Kesik"],
                  ["dotted", "Noktalı"],
                  ["none", "Yok"],
                ])}
                {color("borderColor", "Kenarlık rengi")}
                {input("boxShadow", "Gölge", "0 8px 24px #00000015")}
              </div>
            </details>
          </>
        )}
        {tab === "advanced" && (
          <>
            <details open>
              <summary>Cihaz görünürlüğü</summary>
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
                      aria-label={`${deviceNames[key]} görünürlük`}
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
              <summary>Konum ve efektler</summary>
              <div className="settings-body">
                {select("position", "Konum", [
                  ["relative", "Normal"],
                  ["absolute", "Absolute"],
                  ["sticky", "Sticky"],
                ])}
                <div className="control-grid">
                  {input("top", "Üst konum")}
                  {input("left", "Sol konum")}
                  {input("zIndex", "Katman sırası", "auto")}
                  {input("opacity", "Opaklık", "1")}
                </div>
                {select("overflow", "Taşma", [
                  ["visible", "Görünür"],
                  ["hidden", "Gizle"],
                  ["auto", "Kaydır"],
                ])}
                <label className="control">
                  <span>Animasyon</span>
                  <select
                    aria-label="Animasyon"
                    value={String(node.props.animation ?? "none")}
                    onChange={(event) => prop("animation", event.target.value)}
                  >
                    {[
                      ["none", "Yok"],
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
                {textProp("cssId", "HTML kimliği (ID)")}
              </div>
            </details>
          </>
        )}
        <div className="layer-order">
          <button onClick={() => move(-1)}>
            <ArrowUp size={13} /> Yukarı
          </button>
          <button onClick={() => move(1)}>
            <ArrowDown size={13} /> Aşağı
          </button>
        </div>
      </div>
      <div className="inspector-footer">
        <span>●</span>{" "}
        {device === "desktop"
          ? "Temel stil · tüm cihazlara aktarılır"
          : "Özel değerler yalnızca bu cihazda geçerli"}
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
