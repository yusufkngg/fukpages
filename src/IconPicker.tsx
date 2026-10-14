import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Search, Upload, Loader2 } from "lucide-react";
import type { Block, Styles } from "./model";
import { t } from "./i18n";
import { Dialog } from "./Dialog";
import { StyleInput } from "./StyleInput";
import { VectorIcon } from "./Renderer";
import { assetUrl } from "./studio";
import { iconStroke, parseIconNode, type IconNode } from "./iconNode";
import { iconCategories, glyphIcons } from "./iconCatalog";
import { iconPresets } from "./iconPresets";
import {
  iconLibraryName,
  loadIconLibrary,
  searchIcons,
  vectorIconProps,
  type IconLibrary,
} from "./vectorIcons";

const pageSize = 240;
const readable = (name: string) =>
  name.charAt(0).toUpperCase() + name.slice(1).replaceAll("-", " ");

/** Searchable icon library in a dialog, like a page builder's icon picker. */
export function IconLibraryDialog({
  current,
  choose,
  close,
}: {
  current: string;
  choose: (name: string, node: IconNode) => void;
  close: () => void;
}) {
  const [library, setLibrary] = useState<IconLibrary | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("popular");
  const [limit, setLimit] = useState(pageSize);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    loadIconLibrary()
      .then((icons) => active && setLibrary(icons))
      .catch(() => active && setFailed(true));
    requestAnimationFrame(() => searchRef.current?.focus());
    return () => {
      active = false;
    };
  }, []);
  // Bundled icons keep the picker useful while (or if) the library loads.
  const icons: IconLibrary = library ?? iconPresets;
  const names = useMemo(() => Object.keys(icons).sort(), [icons]);
  const shown = useMemo(() => {
    if (query.trim()) return searchIcons(names, query);
    if (category === "all") return names;
    const group = iconCategories.find((c) => c.id === category);
    return (group?.icons ?? []).filter((name) => icons[name]);
  }, [names, icons, query, category]);
  useEffect(() => setLimit(pageSize), [query, category]);
  return (
    <Dialog
      open
      onClose={close}
      label={t("İkon kitaplığı")}
      className="icon-library-dialog"
    >
      <header className="icon-library-head">
        <h2>{t("İkon seç")}</h2>
        <label className="icon-search">
          <Search size={15} />
          <input
            ref={searchRef}
            type="search"
            aria-label={t("İkon ara")}
            placeholder={t("İkon ara (ör. kargo, kalp, star)…")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </header>
      {!query.trim() && (
        <div
          className="icon-categories"
          role="tablist"
          aria-label={t("İkon grupları")}
        >
          {[
            ...iconCategories.map((c) => [c.id, t(c.label)]),
            ["all", t("Tümü ({p0})", { p0: names.length })],
          ].map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={category === id}
              onClick={() => setCategory(id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {!library && !failed && (
        <p className="icon-library-status">
          <Loader2 className="spin" size={14} />
          {t("Tüm ikonlar yükleniyor…")}
        </p>
      )}
      {failed && (
        <p className="icon-library-status" role="alert">
          {t(
            "Tam ikon kitaplığı yüklenemedi; temel ikonlar gösteriliyor. Bağlantını kontrol edip pencereyi yeniden aç.",
          )}
        </p>
      )}
      <div className="icon-library-grid" role="list">
        {shown.slice(0, limit).map((name) => (
          <button
            key={name}
            role="listitem"
            title={readable(name)}
            aria-label={t("İkon: {p0}", { p0: name })}
            aria-pressed={current === name}
            onClick={() => choose(name, icons[name])}
          >
            <VectorIcon node={icons[name]} />
            <span>{readable(name)}</span>
          </button>
        ))}
      </div>
      {!shown.length && (
        <p className="icon-library-status">
          {t(
            "“{p0}” için ikon bulunamadı. İngilizce adıyla da arayabilirsin.",
            {
              p0: query,
            },
          )}
        </p>
      )}
      {shown.length > limit && (
        <button
          className="icon-library-more"
          onClick={() => setLimit(limit + pageSize)}
        >
          {t("Daha fazla göster ({p0})", { p0: shown.length - limit })}
        </button>
      )}
      <footer className="icon-library-foot">
        <small>{t("Lucide ikonları · ISC lisansı")}</small>
      </footer>
    </Dialog>
  );
}

/** Icon settings: library icon, upload, size, colour, stroke and link. */
export function IconPicker({
  node,
  update,
  style,
  styles,
  fit,
  openMedia,
  openRequest = 0,
}: {
  node: Block;
  update: (f: (n: Block) => Block, key?: string) => void;
  style: (key: string, value: string | number) => void;
  styles: Styles;
  fit: () => void;
  openMedia: () => void;
  /** Changes when the canvas asks to open the library (double-click). */
  openRequest?: number;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (openRequest) setOpen(true);
  }, [openRequest]);
  const p = node.props;
  const vector = !p.src ? parseIconNode(p.iconNode) : null;
  const name = iconLibraryName(p.icon);
  const glyph = !p.src && !vector ? String(p.text || "") : "";
  const size = parseFloat(String(styles.fontSize)) || 32;
  const color = String(styles.color || "#17241c");
  const setProps = (props: Record<string, string | boolean>, key?: string) =>
    update((n) => ({ ...n, props: { ...n.props, ...props } }), key);
  const choose = (chosen: string, shapes: IconNode, fill?: boolean) => {
    setProps({
      ...vectorIconProps(chosen, shapes),
      src: "",
      iconTint: false,
      ...(fill === undefined ? {} : { iconFill: fill }),
    });
    setOpen(false);
  };
  const convertGlyph = async () => {
    const target = glyphIcons[glyph];
    if (!target) return;
    const shapes =
      iconPresets[target] ??
      (await loadIconLibrary().catch(() => null))?.[target];
    // Solid symbols (★ ♥ ● ♦) stay solid as vector icons.
    if (shapes) choose(target, shapes, "★♥●♦".includes(glyph));
  };
  return (
    <section className="icon-picker" data-icon-settings>
      <h3>{t("İkon")}</h3>
      <div className="icon-current">
        <button
          className="icon-preview"
          aria-label={t("İkonu değiştir")}
          title={t("İkonu değiştir")}
          onClick={() => setOpen(true)}
        >
          {vector ? (
            <VectorIcon
              node={vector}
              strokeWidth={iconStroke(p.strokeWidth)}
              fill={!!p.iconFill}
            />
          ) : p.src ? (
            <img src={assetUrl(p.src)} alt="" />
          ) : (
            <span>{glyph || "?"}</span>
          )}
        </button>
        <div>
          <b>
            {vector
              ? readable(name || "icon")
              : p.src
                ? t("Özel ikon")
                : t("Metin sembolü")}
          </b>
          <div className="icon-current-actions">
            <button onClick={() => setOpen(true)}>{t("Değiştir")}</button>
            <button onClick={openMedia}>
              <Upload size={12} />
              {t("Yükle")}
            </button>
          </div>
        </div>
      </div>
      {glyph && glyphIcons[glyph] && (
        <p className="setting-help icon-glyph-note">
          {t("Bu ikon bir metin sembolü; yazı tipine göre farklı görünebilir.")}{" "}
          <button onClick={() => void convertGlyph()}>
            {t("Vektör ikona dönüştür")}
          </button>
        </p>
      )}
      <label className="icon-control">
        <span>{t("Boyut")}</span>
        <div className="font-size-stepper">
          <button
            aria-label={t("İkonu küçült")}
            onClick={() => style("fontSize", Math.max(8, size - 2) + "px")}
          >
            <Minus size={13} />
          </button>
          <StyleInput
            label={t("İkon boyutu")}
            value={styles.fontSize || "32px"}
            onChange={(v) => style("fontSize", v)}
          />
          <button
            aria-label={t("İkonu büyüt")}
            onClick={() => style("fontSize", Math.min(400, size + 2) + "px")}
          >
            <Plus size={13} />
          </button>
        </div>
      </label>
      <label className="icon-control">
        <span>{t("Renk")}</span>
        <div className="simple-colour">
          <input
            type="color"
            aria-label={t("İkon rengi seçici")}
            value={/^#[a-f0-9]{6}$/i.test(color) ? color : "#17241c"}
            onChange={(e) => style("color", e.target.value)}
          />
          <StyleInput
            label={t("İkon rengi")}
            value={color}
            onChange={(v) => style("color", v)}
          />
        </div>
      </label>
      {vector && (
        <>
          <label className="icon-control">
            <span>{t("Çizgi kalınlığı")}</span>
            <div className="icon-stroke">
              <input
                type="range"
                min={0.5}
                max={4}
                step={0.25}
                aria-label={t("Çizgi kalınlığı")}
                value={iconStroke(p.strokeWidth)}
                onChange={(e) =>
                  setProps({ strokeWidth: e.target.value }, `stroke:${node.id}`)
                }
              />
              <output>{iconStroke(p.strokeWidth)}</output>
            </div>
          </label>
          <label className="toggle-row">
            <span>{t("Dolgulu ikon")}</span>
            <input
              type="checkbox"
              aria-label={t("Dolgulu ikon")}
              checked={!!p.iconFill}
              onChange={(e) => setProps({ iconFill: e.target.checked })}
            />
          </label>
        </>
      )}
      <label className="icon-control">
        <span>{t("Bağlantı")}</span>
        <input
          aria-label={t("İkon bağlantısı")}
          placeholder="https://… / /sayfa"
          value={String(p.href || "")}
          onChange={(e) =>
            setProps({ href: e.target.value }, `href:${node.id}`)
          }
        />
      </label>
      {!!p.href && (
        <label className="toggle-row">
          <span>{t("Yeni sekmede aç")}</span>
          <input
            type="checkbox"
            aria-label={t("Yeni sekmede aç")}
            checked={!!p.targetBlank}
            onChange={(e) => setProps({ targetBlank: e.target.checked })}
          />
        </label>
      )}
      <label className="icon-control">
        <span>{t("Erişilebilir ad")}</span>
        <input
          aria-label={t("Erişilebilir ad")}
          placeholder={t("Boşsa dekoratif sayılır")}
          value={String(p.alt || "")}
          onChange={(e) => setProps({ alt: e.target.value }, `alt:${node.id}`)}
        />
      </label>
      <details className="icon-custom">
        <summary>{t("Özel ikon")}</summary>
        <label>
          {t("Custom icon URL")}
          <input
            aria-label={t("Custom icon URL")}
            value={String(p.src || "")}
            onChange={(e) =>
              setProps({ src: e.target.value }, `src:${node.id}`)
            }
          />
        </label>
        {!!p.src && (
          <label className="toggle-row">
            <span>{t("Use icon colour")}</span>
            <input
              type="checkbox"
              aria-label={t("Use icon colour")}
              checked={!!p.iconTint}
              onChange={(e) => setProps({ iconTint: e.target.checked })}
            />
          </label>
        )}
      </details>
      <button className="fit-icon-button" onClick={fit}>
        {t("Fit to icon")}
      </button>
      {open && (
        <IconLibraryDialog
          current={vector ? name : ""}
          choose={choose}
          close={() => setOpen(false)}
        />
      )}
    </section>
  );
}
