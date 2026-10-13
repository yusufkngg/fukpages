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
      notify(`${result.results.filter((r) => r.ok).length} görsel yüklendi.`);
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
        .toLocaleLowerCase("tr")
        .includes(search.toLocaleLowerCase("tr")),
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
        Görsel yükle / dosya bırak
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
          <span>Yükleniyor %{progress}</span>
        </div>
      )}
      {!!failed.length && (
        <button onClick={() => void upload(failed)}>
          Başarısız dosyaları tekrar dene ({failed.length})
        </button>
      )}
      <label>
        HTTPS URL
        <input
          aria-label="İçe aktarılacak görsel URL"
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
            notify("Görsel kalıcı kütüphaneye alındı.");
          } catch (e) {
            notify((e as Error).message, true);
          }
        }}
      >
        URL’den içe aktar
      </button>
      <input
        aria-label="Medya ara"
        placeholder="Ad, etiket veya klasör ara"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <select
        aria-label="Medya klasörü"
        value={folder}
        onChange={(e) => setFolder(e.target.value)}
      >
        <option value="">Tüm klasörler</option>
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
        Favoriler
      </label>
      <select
        aria-label="Görsel kullanım şekli"
        value={mode}
        onChange={(e) => setMode(e.target.value)}
      >
        <option value="replace">Seçili görseli değiştir / ekle</option>
        <option value="add">Yeni görsel ekle</option>
        <option value="mobile">Seçili öğenin mobil görseli</option>
        <option value="background">Seçili kutunun arka planı</option>
      </select>
      <div className="media-grid">
        {filtered.map((a) => (
          <article key={a.id} data-asset-id={a.id}>
            <button
              onClick={() => select(a, mode)}
              title="Tuvale ekle / seçili görseli değiştir"
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
              aria-label={`${a.name} favori`}
              onClick={() => void patch(a, { favorite: !a.favorite })}
            >
              {a.favorite ? "★" : "☆"}
            </button>
            <button onClick={() => setDetail(a)}>Bilgiler</button>
          </article>
        ))}
      </div>
      {detail && (
        <div className="feature-card">
          <h3>{detail.name}</h3>
          <label>
            Ad
            <input
              defaultValue={detail.name}
              onBlur={(e) => void patch(detail, { name: e.target.value })}
            />
          </label>
          <label>
            Klasör
            <input
              defaultValue={detail.folder}
              onBlur={(e) => void patch(detail, { folder: e.target.value })}
            />
          </label>
          <label>
            Etiketler
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
          <p>Kullanıldığı yerler:</p>
          {detail.usage?.map((u) => (
            <p key={u.id}>
              {u.name} · {u.scope}
            </p>
          ))}
          {!detail.usage?.length && (
            <small>Güncel taslak veya yayında kullanılmıyor.</small>
          )}
          <button
            onClick={async () => {
              if (
                detail.usage?.length &&
                !confirm(
                  `${detail.usage.map((u) => u.name).join(", ")} içinde kullanılıyor. Kütüphaneden kaldırılacak; bu sayfalardaki dosya korunacak. Devam edilsin mi?`,
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
            Kütüphaneden kaldır
          </button>
          <button onClick={() => setDetail(null)}>Kapat</button>
        </div>
      )}
    </div>
  );
}
