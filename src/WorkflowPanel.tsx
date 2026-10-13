import { useStudio } from "./studio";
import { useState, useEffect } from "react";
import { api, json } from "./api";
import type { PageDocument, Block } from "./model";
export function qualityWarnings(page: PageDocument) {
  const warnings: string[] = [],
    headings: Block[] = [];
  const walk = (nodes: Block[]) =>
    nodes.forEach((n) => {
      if (n.kind === "image") {
        if (!n.props.src) warnings.push(`${n.name}: görsel eksik`);
        if (!n.props.alt) warnings.push(`${n.name}: alternatif metin eksik`);
      }
      if (
        n.kind === "button" &&
        (!n.props.action || n.props.action === "navigate") &&
        (!n.props.href || n.props.href === "#")
      )
        warnings.push(`${n.name}: bağlantı boş`);
      if (
        [
          "productField",
          "addToCart",
          "productGallery",
          "variantPicker",
        ].includes(n.kind) &&
        !n.props.productId
      )
        warnings.push(`${n.name}: ürün bağlantısı eksik`);
      if (n.kind === "heading") headings.push(n);
      walk(n.children);
    });
  walk(page.nodes);
  const h1 = headings.filter((n) => n.props.tag === "h1").length;
  if (h1 !== 1) warnings.push(`H1 sayısı ${h1}; tek ana başlık önerilir.`);
  for (let i = 1; i < headings.length; i++) {
    const prev = Number(String(headings[i - 1].props.tag).slice(1)),
      next = Number(String(headings[i].props.tag).slice(1));
    if (next > prev + 1)
      warnings.push(`${headings[i].name}: başlık düzeyi atlanmış`);
  }
  return warnings;
}
export function WorkflowPanel({
  pageId,
  storeId,
  page,
  commit,
  save,
  notify,
}: {
  pageId: string;
  storeId: string;
  page: PageDocument;
  commit: (f: (p: PageDocument) => PageDocument) => void;
  save: () => Promise<boolean>;
  notify: (m: string, e?: boolean) => void;
}) {
  const { assets } = useStudio();
  const usedImages = assets.filter(
    (a) => a.type === "image" && JSON.stringify(page).includes(a.id),
  );
  const [history, setHistory] = useState<
      { id: string; version: number; created: number; reason: string }[]
    >([]),
    [publications, setPublications] = useState<
      { id: string; published: number }[]
    >([]),
    [submissions, setSubmissions] = useState<
      { id: string; data: Record<string, string>; created: number }[]
    >([]),
    [preview, setPreview] = useState(""),
    [publishAt, setPublishAt] = useState(""),
    [unpublishAt, setUnpublishAt] = useState(""),
    [metrics, setMetrics] = useState<
      { event: string; count: number; day: string }[]
    >([]);
  const [timings, setTimings] = useState<
    { name: string; duration: number; bytes: number; cached: boolean }[]
  >([]);
  const load = async () => {
    const [a, b, c, d] = await Promise.all([
      api<typeof history>(`/pages/${pageId}/history`),
      api<typeof publications>(`/pages/${pageId}/publications`),
      api<typeof submissions>(`/stores/${storeId}/submissions`),
      api<typeof metrics>(`/pages/${pageId}/metrics`),
    ]);
    setHistory(a);
    setPublications(b);
    setSubmissions(c);
    setMetrics(d);
  };
  useEffect(() => {
    void load().catch((e) => notify(e.message, true));
  }, [pageId, storeId]);
  const seo = page.seo || {
    slug: "",
    title: "",
    description: "",
    image: "",
    noindex: false,
  };
  const warnings = qualityWarnings(page);
  return (
    <div className="library-scroll feature-panel">
      <h3>SEO ve URL</h3>
      {(["slug", "title", "description", "image"] as const).map((k) => (
        <label key={k}>
          {
            {
              slug: "URL kısa adı",
              title: "SEO başlığı",
              description: "Meta açıklama",
              image: "Sosyal paylaşım görseli URL",
            }[k]
          }
          <input
            aria-label={`SEO ${k}`}
            value={seo[k]}
            onChange={(e) =>
              commit((p) => ({ ...p, seo: { ...seo, [k]: e.target.value } }))
            }
          />
        </label>
      ))}
      <label>
        <input
          type="checkbox"
          checked={seo.noindex}
          onChange={(e) =>
            commit((p) => ({
              ...p,
              seo: { ...seo, noindex: e.target.checked },
            }))
          }
        />{" "}
        Arama motorlarında indekslenmesin
      </label>
      <p>
        Yerel URL:{" "}
        {seo.slug ? `/p/${storeId}/${seo.slug}` : "Önce kısa adres gir."}
      </p>
      <h3>Kalite kontrolü</h3>
      {warnings.length ? (
        warnings.map((w, i) => (
          <p className="feature-warning" key={i}>
            {w}
          </p>
        ))
      ) : (
        <p>Belge kontrolleri geçti ✓</p>
      )}
      <button
        onClick={() => {
          const width =
            document.querySelector(".canvas-sheet")?.getBoundingClientRect()
              .width || 0;
          const bad = [
            ...document.querySelectorAll(".editable-surface .content-block"),
          ].filter((el) => el.scrollWidth > el.clientWidth + 2);
          notify(
            `${width.toFixed(0)} px görünümde ${bad.length} taşan öğe bulundu.${bad.length ? " Mobil genişlikte de kontrol et." : ""}`,
          );
        }}
      >
        Görünümde taşmayı kontrol et
      </button>
      <p>
        Görsel yükü: {usedImages.length} dosya ·{" "}
        {(usedImages.reduce((sum, a) => sum + a.bytes, 0) / 1024).toFixed(0)} KB
        ana dosya. Cihaz boyutları ve geç yükleme kullanılır; bu bir hız testi
        puanı değildir.
      </p>
      <p>
        Tasarım: hazır · Veri: yerel katalog · Yayınlama: yerel · Shopify:
        ertelendi
      </p>
      <button
        onClick={() => {
          const urls = new Set(
            [
              ...document.querySelectorAll<HTMLImageElement>(
                ".editable-surface img",
              ),
            ].map((img) => img.currentSrc || img.src),
          );
          const entries = performance.getEntriesByType(
            "resource",
          ) as PerformanceResourceTiming[];
          setTimings(
            entries
              .filter((e) => urls.has(e.name))
              .map((e) => ({
                name: new URL(e.name).pathname.split("/").pop() || "Görsel",
                duration: e.duration,
                bytes: e.encodedBodySize,
                cached: e.transferSize === 0,
              })),
          );
        }}
      >
        Görsel yükleme sürelerini ölç
      </button>
      <div data-image-timings>
        {timings.map((t, i) => (
          <p key={i}>
            {t.name} · {t.duration.toFixed(1)} ms ·{" "}
            {(t.bytes / 1024).toFixed(1)} KB{t.cached ? " · önbellek" : ""}
          </p>
        ))}
      </div>
      <h3>Paylaşılabilir önizleme</h3>
      <button
        onClick={async () => {
          try {
            if (!(await save())) return;
            const r = await api<{ path: string }>(`/pages/${pageId}/preview`, {
              method: "POST",
              body: "{}",
            });
            setPreview(new URL(r.path, window.location.origin).href);
          } catch (e) {
            notify((e as Error).message, true);
          }
        }}
      >
        7 günlük bağlantı oluştur
      </button>
      {preview && (
        <a href={preview} target="_blank" rel="noreferrer">
          {preview}
        </a>
      )}
      <h3>Yerel yayın zamanlaması</h3>
      <label>
        Yayınla
        <input
          aria-label="Planlanan yayın"
          type="datetime-local"
          value={publishAt}
          onChange={(e) => setPublishAt(e.target.value)}
        />
      </label>
      <label>
        Yayından kaldır
        <input
          type="datetime-local"
          value={unpublishAt}
          onChange={(e) => setUnpublishAt(e.target.value)}
        />
      </label>
      <button
        onClick={async () => {
          try {
            if (!(await save())) return;
            await api(`/pages/${pageId}/schedule`, {
              method: "PUT",
              body: json({
                publishAt: publishAt ? new Date(publishAt).getTime() : null,
                unpublishAt: unpublishAt
                  ? new Date(unpublishAt).getTime()
                  : null,
              }),
            });
            notify("Yerel yayın planlandı. Sunucu çalışırken uygulanır.");
          } catch (e) {
            notify((e as Error).message, true);
          }
        }}
      >
        Zamanlamayı kaydet
      </button>
      <button
        onClick={async () => {
          try {
            await api(`/pages/${pageId}/publish`, { method: "DELETE" });
            notify("Yerel yayın kaldırıldı.");
          } catch (e) {
            notify((e as Error).message, true);
          }
        }}
      >
        Yerel yayını kaldır
      </button>
      <h3>Kalıcı sürüm geçmişi</h3>
      <button onClick={() => void load().catch((e) => notify(e.message, true))}>
        Listeyi yenile
      </button>
      {history.map((h) => (
        <div className="feature-card" key={h.id}>
          <b>
            v{h.version} · {h.reason}
          </b>
          <small>{new Date(h.created).toLocaleString("tr-TR")}</small>
          <button
            onClick={async () => {
              try {
                const r = await api<{ document: PageDocument }>(
                  `/pages/${pageId}/history/${h.id}`,
                );
                commit(() => r.document);
                notify("Eski sürüm taslağa alındı. Kaydet veya geri al.");
              } catch (e) {
                notify((e as Error).message, true);
              }
            }}
          >
            Taslağa geri yükle
          </button>
        </div>
      ))}
      <h3>Yerel yayın geçmişi</h3>
      {publications.map((h) => (
        <button
          key={h.id}
          onClick={async () => {
            try {
              await api(`/pages/${pageId}/publications/${h.id}/restore`, {
                method: "POST",
                body: "{}",
              });
              notify("Önceki yerel yayın geri yüklendi.");
            } catch (e) {
              notify((e as Error).message, true);
            }
          }}
        >
          {new Date(h.published).toLocaleString("tr-TR")} · Yayına geri dön
        </button>
      ))}
      <h3>Form gönderimleri</h3>
      {submissions.map((s) => (
        <div className="feature-card" key={s.id}>
          <small>{new Date(s.created).toLocaleString("tr-TR")}</small>
          {Object.entries(s.data).map(([k, v]) => (
            <p key={k}>
              {k}: {String(v)}
            </p>
          ))}
        </div>
      ))}
      <h3>Yerel ölçüm</h3>
      {metrics.map((m, i) => (
        <p key={i}>
          {m.day} · {m.event}: {m.count}
        </p>
      ))}
    </div>
  );
}
