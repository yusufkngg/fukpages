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
    [sample, setSample] = useState("İ ı Ş ş Ğ ğ Ç ç Ö ö Ü ü · Markanı tasarla"),
    [search, setSearch] = useState(""),
    [progress, setProgress] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
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
    <div className="library-scroll feature-panel">
      <style>
        {fonts
          .map(
            (f) =>
              `@font-face{font-family:"${f.family}";src:url("${f.url}") format("${f.format}");font-weight:${f.axes?.wght ? `${f.axes.wght.min} ${f.axes.wght.max}` : f.weight};font-style:${f.italic ? "italic" : "normal"};font-display:swap}`,
          )
          .join("")}
      </style>
      <h3>Özel fontlar</h3>
      <label>
        Aile adı (isteğe bağlı)
        <input
          aria-label="Font aile adı"
          value={family}
          onChange={(e) => setFamily(e.target.value)}
        />
      </label>
      <label>
        Kalınlık
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
        İtalik
      </label>
      <button
        className="feature-primary"
        onClick={() => input.current?.click()}
      >
        WOFF2 / WOFF / TTF / OTF yükle
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
              .forEach((i) => notify(i.error || "Font yüklenemedi.", true));
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
        Canlı önizleme metni
        <input value={sample} onChange={(e) => setSample(e.target.value)} />
      </label>
      <input
        aria-label="Font ara"
        placeholder="Font ara"
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
          {f.italic ? " italik" : ""} · Türkçe {f.turkish ? "✓" : "eksik glif"}
          {f.axes?.wght
            ? ` · ${f.axes.wght.min}–${f.axes.wght.max}`
            : ""} · {f.usage?.map((u) => u.name).join(", ") || "kullanılmıyor"}
        </small>
      ))}
      <h3>Marka renkleri</h3>
      {Object.entries(draft.colors).map(([k, v]) => (
        <label key={k}>
          {
            (
              {
                primary: "Ana renk",
                secondary: "İkinci renk",
                accent: "Vurgu",
                text: "Metin",
                background: "Arka plan",
                border: "Kenarlık",
              } as Record<string, string>
            )[k]
          }
          <input
            aria-label={`Marka ${k}`}
            type="color"
            value={v.slice(0, 7)}
            onChange={(e) =>
              setDraft({
                ...draft,
                colors: { ...draft.colors, [k]: e.target.value },
              })
            }
          />
        </label>
      ))}
      <h3>Global fontlar</h3>
      {Object.entries(draft.fonts).map(([k, v]) => (
        <label key={k}>
          {
            (
              {
                heading: "Başlık",
                body: "Gövde",
                button: "Düğme",
                fallback: "Yedek font",
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
      <h3>Tipografi ölçeği</h3>
      {Object.entries(draft.typography).map(([k, v]) => (
        <label key={k}>
          {k === "mobileScale" ? "Mobil çarpan" : k}
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
      <h3>Global yerleşim</h3>
      {(["container", "sectionSpace", "radius"] as const).map((k) => (
        <label key={k}>
          {
            {
              container: "Container genişliği",
              sectionSpace: "Bölüm boşluğu",
              radius: "Köşe yuvarlama",
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
        Gölge
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
        onClick={async () => {
          try {
            const r = await api<{ brand: Brand; version: number }>(
              `/stores/${storeId}/brand`,
              { method: "PUT", body: json({ brand: draft, version }) },
            );
            update(r.brand, r.version);
            notify(
              "Marka kiti kaydedildi. Global stile bağlı öğeler güncellendi.",
            );
          } catch (e) {
            notify((e as Error).message, true);
          }
        }}
      >
        Marka kitini kaydet
      </button>
    </div>
  );
}
