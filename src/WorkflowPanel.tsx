import { getUiLocale, t } from "./i18n.ts";
import { useStudio } from "./studio";
import { useState, useEffect } from "react";
import { api, json } from "./api";
import type { PageDocument, Block } from "./model";
import { qualityIssues } from "./quality";
export const qualityWarnings = (page: PageDocument) =>
  qualityIssues(page).map((issue) => issue.message);
export function WorkflowPanel({
  pageId,
  storeId,
  page,
  commit,
  save,
  notify,
  selectNode,
}: {
  pageId: string;
  storeId: string;
  page: PageDocument;
  commit: (f: (p: PageDocument) => PageDocument) => void;
  save: () => Promise<boolean>;
  notify: (m: string, e?: boolean) => void;
  selectNode?: (id: string) => void;
}) {
  const { assets } = useStudio();
  const usedImages = assets.filter(
    (a) => a.type === "image" && JSON.stringify(page).includes(a.id),
  );
  const [history, setHistory] = useState<
      {
        id: string;
        version: number;
        created: number;
        reason: string;
      }[]
    >([]),
    [publications, setPublications] = useState<
      {
        id: string;
        published: number;
      }[]
    >([]),
    [submissions, setSubmissions] = useState<
      {
        id: string;
        data: Record<string, string>;
        created: number;
      }[]
    >([]),
    [preview, setPreview] = useState(""),
    [seoPublication, setSeoPublication] = useState<{
      path: string;
      seoTitle: string;
    } | null>(null),
    [seoBusy, setSeoBusy] = useState(false),
    [publishAt, setPublishAt] = useState(""),
    [unpublishAt, setUnpublishAt] = useState(""),
    [metrics, setMetrics] = useState<
      {
        event: string;
        count: number;
        day: string;
      }[]
    >([]);
  const [timings, setTimings] = useState<
    {
      name: string;
      duration: number;
      bytes: number;
      cached: boolean;
    }[]
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
  const warnings = qualityIssues(page);
  return (
    <div className="library-scroll feature-panel">
      <h3>{t("SEO ve URL")}</h3>
      {(["slug", "title", "description", "image"] as const).map((k) => (
        <label key={k}>
          {
            {
              slug: t("URL kısa adı"),
              title: t("SEO başlığı"),
              description: t("Meta açıklama"),
              image: t("Sosyal paylaşım görseli URL"),
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
        {t("Arama motorlarında indekslenmesin")}
      </label>
      <p>
        {t("Yerel URL:")}{" "}
        {seo.slug ? `/p/${storeId}/${seo.slug}` : t("Önce kısa adres gir.")}
      </p>
      <button
        disabled={seoBusy}
        onClick={async () => {
          setSeoBusy(true);
          try {
            if (!(await save())) return;
            const result = await api<{
              path: string;
              seoTitle: string;
            }>(`/pages/${pageId}/publish`, { method: "POST", body: "{}" });
            setSeoPublication(result);
            notify(t("SEO ayarları ve sayfa yayını güncellendi."));
          } catch (e) {
            notify((e as Error).message, true);
          } finally {
            setSeoBusy(false);
          }
        }}
      >
        {seoBusy
          ? t("Yayın güncelleniyor…")
          : t("SEO’yu kaydet ve yayını güncelle")}
      </button>
      <small>
        {t(
          "Kaydet taslağı günceller. Bu düğme ziyaretçinin gördüğü başlık ve URL’yi de yayımlar.",
        )}
      </small>
      {seoPublication && (
        <p data-seo-publication>
          <b>{seoPublication.seoTitle}</b>
          <br />
          <a href={seoPublication.path} target="_blank" rel="noreferrer">
            {t("Güncellenen sayfayı aç ↗")}
          </a>
        </p>
      )}
      <h3>{t("Kalite kontrolü")}</h3>
      {warnings.length ? (
        warnings.map((w, i) => (
          <button
            className="feature-warning quality-issue"
            key={i}
            onClick={() => selectNode?.(w.nodeId)}
            title={t("İlgili öğeyi düzenle")}
          >
            {w.message} ↗
          </button>
        ))
      ) : (
        <p>{t("Belge kontrolleri geçti ✓")}</p>
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
            t("{p0} px görünümde {p1} taşan öğe bulundu.{p2}", {
              p0: width.toFixed(0),
              p1: bad.length,
              p2: bad.length ? t(" Mobil genişlikte de kontrol et.") : "",
            }),
          );
        }}
      >
        {t("Görünümde taşmayı kontrol et")}
      </button>
      <p>
        {t("Görsel yükü:") + " "}
        {usedImages.length}
        {" " + t("dosya ·")}{" "}
        {(usedImages.reduce((sum, a) => sum + a.bytes, 0) / 1024).toFixed(0)}
        {" " +
          t(
            "KB ana dosya. Cihaz boyutları ve geç yükleme kullanılır; bu bir hız testi puanı değildir.",
          )}
      </p>
      <p>
        {t(
          "Tasarım: hazır · Veri: yerel katalog · Yayınlama: yerel · Shopify: ertelendi",
        )}
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
                name: new URL(e.name).pathname.split("/").pop() || t("Görsel"),
                duration: e.duration,
                bytes: e.encodedBodySize,
                cached: e.transferSize === 0,
              })),
          );
        }}
      >
        {t("Görsel yükleme sürelerini ölç")}
      </button>
      <div data-image-timings>
        {timings.map((timing, i) => (
          <p key={i}>
            {timing.name} · {timing.duration.toFixed(1)} ms ·{" "}
            {(timing.bytes / 1024).toFixed(1)} KB
            {timing.cached ? t(" · önbellek") : ""}
          </p>
        ))}
      </div>
      <h3>{t("Paylaşılabilir önizleme")}</h3>
      <button
        onClick={async () => {
          try {
            if (!(await save())) return;
            const r = await api<{
              path: string;
            }>(`/pages/${pageId}/preview`, {
              method: "POST",
              body: "{}",
            });
            setPreview(new URL(r.path, window.location.origin).href);
          } catch (e) {
            notify((e as Error).message, true);
          }
        }}
      >
        {t("7 günlük bağlantı oluştur")}
      </button>
      {preview && (
        <a href={preview} target="_blank" rel="noreferrer">
          {preview}
        </a>
      )}
      <h3>{t("Yerel yayın zamanlaması")}</h3>
      <label>
        {t("Yayınla")}
        <input
          aria-label={t("Planlanan yayın")}
          type="datetime-local"
          value={publishAt}
          onChange={(e) => setPublishAt(e.target.value)}
        />
      </label>
      <label>
        {t("Yayından kaldır")}
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
            notify(t("Yerel yayın planlandı. Sunucu çalışırken uygulanır."));
          } catch (e) {
            notify((e as Error).message, true);
          }
        }}
      >
        {t("Zamanlamayı kaydet")}
      </button>
      <button
        onClick={async () => {
          try {
            await api(`/pages/${pageId}/publish`, { method: "DELETE" });
            notify(t("Yerel yayın kaldırıldı."));
          } catch (e) {
            notify((e as Error).message, true);
          }
        }}
      >
        {t("Yerel yayını kaldır")}
      </button>
      <h3>{t("Kalıcı sürüm geçmişi")}</h3>
      <button onClick={() => void load().catch((e) => notify(e.message, true))}>
        {t("Listeyi yenile")}
      </button>
      {history.map((h) => (
        <div className="feature-card" key={h.id}>
          <b>
            v{h.version} · {h.reason}
          </b>
          <small>{new Date(h.created).toLocaleString(getUiLocale())}</small>
          <button
            onClick={async () => {
              try {
                const r = await api<{
                  document: PageDocument;
                }>(`/pages/${pageId}/history/${h.id}`);
                commit(() => r.document);
                notify(t("Eski sürüm taslağa alındı. Kaydet veya geri al."));
              } catch (e) {
                notify((e as Error).message, true);
              }
            }}
          >
            {t("Taslağa geri yükle")}
          </button>
        </div>
      ))}
      <h3>{t("Yerel yayın geçmişi")}</h3>
      {publications.map((h) => (
        <button
          key={h.id}
          onClick={async () => {
            try {
              await api(`/pages/${pageId}/publications/${h.id}/restore`, {
                method: "POST",
                body: "{}",
              });
              notify(t("Önceki yerel yayın geri yüklendi."));
            } catch (e) {
              notify((e as Error).message, true);
            }
          }}
        >
          {new Date(h.published).toLocaleString(getUiLocale())}
          {" " + t("· Yayına geri dön")}
        </button>
      ))}
      <h3>{t("Form gönderimleri")}</h3>
      {submissions.map((s) => (
        <div className="feature-card" key={s.id}>
          <small>{new Date(s.created).toLocaleString(getUiLocale())}</small>
          {Object.entries(s.data).map(([k, v]) => (
            <p key={k}>
              {k}: {String(v)}
            </p>
          ))}
        </div>
      ))}
      <h3>{t("Yerel ölçüm")}</h3>
      {metrics.map((m, i) => (
        <p key={i}>
          {m.day} · {m.event}: {m.count}
        </p>
      ))}
    </div>
  );
}
