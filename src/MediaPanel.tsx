import { getUiLanguage, t } from "./i18n.ts";
import { useState, useRef, useEffect } from "react";
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
  type Group = { count: number; bytes: number };
  const [storage, setStorage] = useState<{
    active: Group;
    archivedInUse: Group;
    archivedUnused: Group;
  } | null>(null);
  const [confirmCleanup, setConfirmCleanup] = useState(false);
  const loadStorage = () =>
    api<typeof storage>(`/stores/${storeId}/media/storage`)
      .then(setStorage)
      .catch(() => setStorage(null));
  useEffect(() => {
    void loadStorage();
  }, [storeId, assets]);
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
      {!filtered.length &&
        (search || folder || favorites ? (
          <div className="media-empty" data-media-empty>
            <p>{t("Aramana uyan görsel yok.")}</p>
            <button
              onClick={() => {
                setSearch("");
                setFolder("");
                setFavorites(false);
              }}
            >
              {t("Aramayı temizle")}
            </button>
          </div>
        ) : (
          <div className="media-empty" data-media-empty>
            <p>
              {t("Henüz görsel yok. Yükle veya bir bağlantıdan içe aktar.")}
            </p>
          </div>
        ))}
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
      {storage && (
        <section className="media-storage" data-media-storage>
          <h3>{t("Depolama")}</h3>
          <p>
            {t("Kullanımda: {p0} dosya · {p1}", {
              p0: storage.active.count,
              p1: formatBytes(storage.active.bytes),
            })}
          </p>
          <p>
            {t("Arşivde, eski sürüm veya yayında kullanılan: {p0} · {p1}", {
              p0: storage.archivedInUse.count,
              p1: formatBytes(storage.archivedInUse.bytes),
            })}
          </p>
          <p>
            {t("Arşivde, hiçbir yerde kullanılmayan: {p0} · {p1}", {
              p0: storage.archivedUnused.count,
              p1: formatBytes(storage.archivedUnused.bytes),
            })}
          </p>
          {storage.archivedUnused.count > 0 &&
            (confirmCleanup ? (
              <div className="media-storage-confirm">
                <small>
                  {t(
                    "Bu dosyalar kalıcı olarak silinecek. Taslak, sürüm geçmişi ve yayınlar etkilenmez.",
                  )}
                </small>
                <button
                  className="danger"
                  onClick={async () => {
                    try {
                      const result = await api<{
                        removed: number;
                        freed: number;
                      }>(`/stores/${storeId}/media/cleanup`, {
                        method: "POST",
                      });
                      notify(
                        t("{p0} dosya silindi, {p1} boşaldı.", {
                          p0: result.removed,
                          p1: formatBytes(result.freed),
                        }),
                      );
                      setConfirmCleanup(false);
                      await refresh();
                      await loadStorage();
                    } catch (e) {
                      notify((e as Error).message, true);
                    }
                  }}
                >
                  {t("Kalıcı olarak sil")}
                </button>
                <button onClick={() => setConfirmCleanup(false)}>
                  {t("Vazgeç")}
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmCleanup(true)}>
                {t("{p0} alanı boşalt", {
                  p0: formatBytes(storage.archivedUnused.bytes),
                })}
              </button>
            ))}
        </section>
      )}
    </div>
  );
}
function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
