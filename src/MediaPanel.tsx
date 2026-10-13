import { getUiLanguage, t } from "./i18n.ts";
import { useState, useRef } from "react";
import { api, json, uploadFiles } from "./api";
import { assetUrl, type Asset } from "./studio";
export function MediaPanel({
  storeId,
  assets,
  refresh,
  select,
  notify,
}: {
  storeId: string;
  assets: Asset[];
  refresh: () => Promise<void>;
  select: (a: Asset, mode?: string) => void;
  notify: (m: string, e?: boolean) => void;
}) {
  const [mode, setMode] = useState("replace");
  const [search, setSearch] = useState(""),
    [folder, setFolder] = useState(""),
    [favorites, setFavorites] = useState(false),
    [progress, setProgress] = useState(-1),
    [url, setUrl] = useState(""),
    [failed, setFailed] = useState<File[]>([]),
    [detail, setDetail] = useState<Asset | null>(null);
  const input = useRef<HTMLInputElement>(null);
  async function upload(files: File[]) {
    setProgress(0);
    setFailed([]);
    try {
      const result = await uploadFiles(
        `/stores/${storeId}/assets`,
        files,
        { type: "image" },
        setProgress,
      );
      const bad = result.results.filter((r) => !r.ok);
      setFailed(files.filter((f) => bad.some((b) => b.name === f.name)));
      bad.forEach((b) => notify(`${b.name}: ${b.error}`, true));
      await refresh();
      notify(
        t("{p0} görsel yüklendi.", {
          p0: result.results.filter((r) => r.ok).length,
        }),
      );
    } catch (e) {
      setFailed(files);
      notify((e as Error).message, true);
    } finally {
      setProgress(-1);
    }
  }
  const filtered = assets.filter(
    (a) =>
      a.type === "image" &&
      !a.archived &&
      (!favorites || a.favorite) &&
      (!folder || a.folder === folder) &&
      `${a.name} ${a.tags.join(" ")} ${a.folder}`
        .toLocaleLowerCase(getUiLanguage())
        .includes(search.toLocaleLowerCase(getUiLanguage())),
  );
  async function patch(a: Asset, data: Partial<Asset>) {
    try {
      await api(`/stores/${storeId}/assets/${a.id}`, {
        method: "PATCH",
        body: json(data),
      });
      setDetail({ ...a, ...data });
      await refresh();
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  return (
    <div
      className="library-scroll feature-panel"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void upload([...e.dataTransfer.files]);
      }}
    >
      <button
        className="feature-primary"
        onClick={() => input.current?.click()}
      >
        {t("Görsel yükle / dosya bırak")}
      </button>
      <input
        ref={input}
        hidden
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/avif,image/gif,image/svg+xml"
        onChange={(e) => {
          void upload([...(e.target.files || [])]);
          e.target.value = "";
        }}
      />
      {progress >= 0 && (
        <div role="status">
          <progress value={progress} max={100} />
          <span>
            {t("Yükleniyor %")}
            {progress}
          </span>
        </div>
      )}
      {!!failed.length && (
        <button onClick={() => void upload(failed)}>
          {t("Başarısız dosyaları tekrar dene (")}
          {failed.length})
        </button>
      )}
      <label>
        HTTPS URL
        <input
          aria-label={t("İçe aktarılacak görsel URL")}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </label>
      <button
        onClick={async () => {
          try {
            await api(`/stores/${storeId}/assets/import`, {
              method: "POST",
              body: json({ url }),
            });
            await refresh();
            setUrl("");
            notify(t("Görsel kalıcı kütüphaneye alındı."));
          } catch (e) {
            notify((e as Error).message, true);
          }
        }}
      >
        {t("URL’den içe aktar")}
      </button>
      <input
        aria-label={t("Medya ara")}
        placeholder={t("Ad, etiket veya klasör ara")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <select
        aria-label={t("Medya klasörü")}
        value={folder}
        onChange={(e) => setFolder(e.target.value)}
      >
        <option value="">{t("Tüm klasörler")}</option>
        {[...new Set(assets.map((a) => a.folder).filter(Boolean))].map((f) => (
          <option key={f}>{f}</option>
        ))}
      </select>
      <label>
        <input
          type="checkbox"
          checked={favorites}
          onChange={(e) => setFavorites(e.target.checked)}
        />{" "}
        {t("Favoriler")}
      </label>
      <select
        aria-label={t("Görsel kullanım şekli")}
        value={mode}
        onChange={(e) => setMode(e.target.value)}
      >
        <option value="replace">{t("Seçili görseli değiştir / ekle")}</option>
        <option value="add">{t("Yeni görsel ekle")}</option>
        <option value="mobile">{t("Seçili öğenin mobil görseli")}</option>
        <option value="background">{t("Seçili kutunun arka planı")}</option>
      </select>
      <div className="media-grid">
        {filtered.map((a) => (
          <article key={a.id} data-asset-id={a.id}>
            <button
              onClick={() => select(a, mode)}
              title={t("Tuvale ekle / seçili görseli değiştir")}
            >
              <img
                loading="lazy"
                src={assetUrl(a.variants?.[0]?.url || a.url)}
                alt={a.name}
              />
            </button>
            <b>{a.name}</b>
            <small>
              {a.width}×{a.height} · {(a.bytes / 1024).toFixed(0)} KB ·{" "}
              {a.format}
            </small>
            <button
              aria-label={t("{p0} favori", { p0: a.name })}
              onClick={() => void patch(a, { favorite: !a.favorite })}
            >
              {a.favorite ? "★" : "☆"}
            </button>
            <button onClick={() => setDetail(a)}>{t("Bilgiler")}</button>
          </article>
        ))}
      </div>
      {detail && (
        <div className="feature-card">
          <h3>{detail.name}</h3>
          <label>
            {t("Ad")}
            <input
              defaultValue={detail.name}
              onBlur={(e) => void patch(detail, { name: e.target.value })}
            />
          </label>
          <label>
            {t("Klasör")}
            <input
              defaultValue={detail.folder}
              onBlur={(e) => void patch(detail, { folder: e.target.value })}
            />
          </label>
          <label>
            {t("Etiketler")}
            <input
              defaultValue={detail.tags.join(",")}
              onBlur={(e) =>
                void patch(detail, {
                  tags: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <p>{t("Kullanıldığı yerler:")}</p>
          {detail.usage?.map((u) => (
            <p key={u.id}>
              {u.name} · {u.scope}
            </p>
          ))}
          {!detail.usage?.length && (
            <small>{t("Güncel taslak veya yayında kullanılmıyor.")}</small>
          )}
          <button
            onClick={async () => {
              if (
                detail.usage?.length &&
                !confirm(
                  t(
                    "{p0} içinde kullanılıyor. Kütüphaneden kaldırılacak; bu sayfalardaki dosya korunacak. Devam edilsin mi?",
                    { p0: detail.usage.map((u) => u.name).join(", ") },
                  ),
                )
              )
                return;
              try {
                await api(
                  `/stores/${storeId}/assets/${detail.id}?acknowledge=true`,
                  { method: "DELETE" },
                );
                setDetail(null);
                await refresh();
              } catch (e) {
                notify((e as Error).message, true);
              }
            }}
          >
            {t("Kütüphaneden kaldır")}
          </button>
          <button onClick={() => setDetail(null)}>{t("Kapat")}</button>
        </div>
      )}
    </div>
  );
}
