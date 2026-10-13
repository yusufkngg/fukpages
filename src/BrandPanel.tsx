import { t } from "./i18n.ts";
import { useState, useRef } from "react";
import { api, json, uploadFiles } from "./api";
import type { Asset, Brand } from "./studio";
export function BrandPanel({
  storeId,
  brand,
  version,
  assets,
  refresh,
  update,
  notify,
}: {
  storeId: string;
  brand: Brand;
  version: number;
  assets: Asset[];
  refresh: () => Promise<void>;
  update: (b: Brand, v: number) => void;
  notify: (m: string, e?: boolean) => void;
}) {
  const [draft, setDraft] = useState(brand),
    [family, setFamily] = useState(""),
    [weight, setWeight] = useState("400"),
    [italic, setItalic] = useState(false),
    [sample, setSample] = useState(
      t("İ ı Ş ş Ğ ğ Ç ç Ö ö Ü ü · Markanı tasarla"),
    ),
    [search, setSearch] = useState(""),
    [progress, setProgress] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const typographyLabel = (key: string) => {
    const heading = /^h([1-6])(Weight)?$/.exec(key);
    if (heading)
      return `${t("Heading")} ${heading[1]}${heading[2] ? " · " + t("Weight") : ""}`;
    const labels: Record<string, string> = {
      body: t("Paragraph"),
      small: t("Small text"),
      link: t("Link"),
      bodyWeight: t("Paragraph weight"),
      smallWeight: t("Small text weight"),
      linkWeight: t("Link weight"),
      headingLineHeight: t("Heading line height"),
      bodyLineHeight: t("Paragraph line height"),
      mobileScale: t("Mobile scale"),
    };
    return labels[key] || key;
  };
  const fonts = assets.filter((a) => a.type === "font");
  const catalog = [
    "Arial, sans-serif",
    "Georgia, serif",
    "Verdana, sans-serif",
    "Tahoma, sans-serif",
    "Trebuchet MS, sans-serif",
    "Courier New, monospace",
    ...new Set(fonts.map((f) => `${f.family}, ${draft.fonts.fallback}`)),
  ].filter((f) => f.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="library-scroll feature-panel global-styles-panel">
      <style>
        {fonts
          .map(
            (f) =>
              `@font-face{font-family:"${f.family}";src:url("${f.url}") format("${f.format}");font-weight:${f.axes?.wght ? `${f.axes.wght.min} ${f.axes.wght.max}` : f.weight};font-style:${f.italic ? "italic" : "normal"};font-display:swap}`,
          )
          .join("")}
      </style>
      <h3>{t("Marka renkleri")}</h3>
      {[
        ["Buttons", ["primary", "secondary"]],
        ["Text", ["text"]],
        ["Background", ["background"]],
        ["Line", ["border"]],
        ["Accent", ["accent"]],
      ].map(([label, keys]) => (
        <div className="global-colour-row" key={String(label)}>
          <span>{t(String(label))}</span>
          <div>
            {(keys as string[]).map((key) => (
              <input
                key={key}
                type="color"
                title={t(
                  key === "primary"
                    ? "Primary"
                    : key === "secondary"
                      ? "Secondary"
                      : String(label),
                )}
                aria-label={`${t("Brand")} ${key}`}
                value={draft.colors[key].slice(0, 7)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    colors: { ...draft.colors, [key]: e.target.value },
                  })
                }
              />
            ))}
          </div>
        </div>
      ))}
      <h3>{t("Font manager")}</h3>
      {Object.entries(draft.fonts).map(([k, v]) => (
        <label key={k}>
          {
            (
              {
                heading: t("Başlık"),
                body: t("Gövde"),
                button: t("Düğme"),
                fallback: t("Yedek font"),
              } as Record<string, string>
            )[k]
          }
          <select
            aria-label={`Global font ${k}`}
            value={v}
            onChange={(e) =>
              setDraft({
                ...draft,
                fonts: { ...draft.fonts, [k]: e.target.value },
              })
            }
          >
            {[...new Set([v, ...catalog])].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
      ))}
      <details className="upload-fonts">
        <summary>{t("Upload fonts")}</summary>
        <h3>{t("Özel fontlar")}</h3>
        <label>
          {t("Aile adı (isteğe bağlı)")}
          <input
            aria-label={t("Font aile adı")}
            value={family}
            onChange={(e) => setFamily(e.target.value)}
          />
        </label>
        <label>
          {t("Kalınlık")}
          <select value={weight} onChange={(e) => setWeight(e.target.value)}>
            {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={italic}
            onChange={(e) => setItalic(e.target.checked)}
          />{" "}
          {t("İtalik")}
        </label>
        <button
          className="feature-primary"
          onClick={() => input.current?.click()}
        >
          {t("WOFF2 / WOFF / TTF / OTF yükle")}
        </button>
        <input
          hidden
          ref={input}
          type="file"
          multiple
          accept=".woff2,.woff,.ttf,.otf"
          onChange={async (e) => {
            setProgress(0);
            try {
              const r = await uploadFiles(
                `/stores/${storeId}/assets`,
                [...(e.target.files || [])],
                { type: "font", family, weight, italic: String(italic) },
                setProgress,
              );
              r.results
                .filter((i) => !i.ok)
                .forEach((i) =>
                  notify(i.error || t("Font yüklenemedi."), true),
                );
              await refresh();
            } catch (err) {
              notify((err as Error).message, true);
            } finally {
              setProgress(-1);
            }
          }}
        />
        {progress >= 0 && <progress max={100} value={progress} />}
        <label>
          {t("Canlı önizleme metni")}
          <input value={sample} onChange={(e) => setSample(e.target.value)} />
        </label>
        <input
          aria-label={t("Font ara")}
          placeholder={t("Font ara")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {catalog.map((f) => (
          <div className="feature-card" key={f}>
            <b>{f.split(",")[0]}</b>
            <p style={{ fontFamily: f }}>{sample}</p>
          </div>
        ))}
        {fonts.map((f) => (
          <small key={f.id}>
            {f.family} · {f.weight}
            {f.italic ? " italik" : ""}
            {" " + t("· Türkçe") + " "}
            {f.turkish ? "✓" : t("eksik glif")}
            {f.axes?.wght
              ? ` · ${f.axes.wght.min}–${f.axes.wght.max}`
              : ""} ·{" "}
            {f.usage?.map((u) => u.name).join(", ") || t("kullanılmıyor")}
          </small>
        ))}
      </details>
      <h3>{t("Tipografi ölçeği")}</h3>
      {["h1", "h2", "h3"].map((key, index) => (
        <label className="global-heading-row" key={key}>
          <span style={{ fontFamily: draft.fonts.heading }}>
            {t("Heading")} {index + 1}
          </span>
          <input
            type="number"
            min={1}
            max={200}
            aria-label={`${t("Heading")} ${index + 1} ${t("Size")}`}
            value={draft.typography[key]}
            onChange={(e) =>
              setDraft({
                ...draft,
                typography: {
                  ...draft.typography,
                  [key]: Number(e.target.value),
                },
              })
            }
          />
          <small>px</small>
        </label>
      ))}
      <details className="more-typography">
        <summary>{t("Show more")}</summary>
        {Object.entries(draft.typography)
          .filter(([key]) => !["h1", "h2", "h3"].includes(key))
          .map(([k, v]) => (
            <label key={k}>
              {typographyLabel(k)}
              <input
                type="number"
                step={k === "mobileScale" ? 0.05 : 1}
                min={0.1}
                max={k.endsWith("Weight") ? 900 : 200}
                value={v}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    typography: {
                      ...draft.typography,
                      [k]: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
          ))}
      </details>
      <h3>{t("Spacing")}</h3>
      {Object.entries(
        draft.spacing || { xxs: 2, xs: 4, sm: 8, md: 16, lg: 24, xl: 40 },
      ).map(([key, value]) => (
        <label className="spacing-token-row" key={key}>
          <span>
            {t("Spacing")} ({key.toUpperCase()})
          </span>
          <input
            aria-label={`${t("Spacing")} ${key}`}
            type="number"
            min={0}
            max={400}
            value={value}
            onChange={(e) =>
              setDraft({
                ...draft,
                spacing: {
                  ...(draft.spacing || {
                    xxs: 2,
                    xs: 4,
                    sm: 8,
                    md: 16,
                    lg: 24,
                    xl: 40,
                  }),
                  [key]: Number(e.target.value),
                },
              })
            }
          />
          <small>px</small>
        </label>
      ))}
      <h3>{t("Global yerleşim")}</h3>
      {(["container", "sectionSpace", "radius"] as const).map((k) => (
        <label key={k}>
          {
            {
              container: t("Container genişliği"),
              sectionSpace: t("Bölüm boşluğu"),
              radius: t("Köşe yuvarlama"),
            }[k]
          }
          <input
            type="number"
            value={draft.layout[k]}
            onChange={(e) =>
              setDraft({
                ...draft,
                layout: { ...draft.layout, [k]: Number(e.target.value) },
              })
            }
          />
        </label>
      ))}
      <label>
        {t("Gölge")}
        <input
          value={draft.layout.shadow}
          onChange={(e) =>
            setDraft({
              ...draft,
              layout: { ...draft.layout, shadow: e.target.value },
            })
          }
        />
      </label>
      <button
        className="feature-primary"
        data-global-style-save
        onClick={async () => {
          try {
            const r = await api<{
              brand: Brand;
              version: number;
            }>(`/stores/${storeId}/brand`, {
              method: "PUT",
              body: json({ brand: draft, version }),
            });
            update(r.brand, r.version);
            notify(
              t(
                "Marka kiti kaydedildi. Global stile bağlı öğeler güncellendi.",
              ),
            );
          } catch (e) {
            notify((e as Error).message, true);
          }
        }}
      >
        {t("Update all pages")}
      </button>
    </div>
  );
}
