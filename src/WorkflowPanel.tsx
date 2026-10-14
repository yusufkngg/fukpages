import { t, formatDateTime } from "./i18n.ts";
import { useStudio } from "./studio";
import { useState, useEffect } from "react";
import { api, json } from "./api";
import type { PageDocument, Block, Device } from "./model";
import { findBlock, mapBlock } from "./model";
type Overflow = {
  id: string;
  path: string;
  device: Device;
  content: number;
  box: number;
  fixed: boolean;
};
const deviceLabel = (device: Device) =>
  device === "mobile"
    ? t("Mobil")
    : device === "tablet"
      ? t("Tablet")
      : t("Masaüstü");
export function nodePath(nodes: Block[], id: string): string {
  const walk = (list: Block[], trail: string[]): string[] | null => {
    for (const n of list) {
      const next = [...trail, n.name || n.kind];
      if (n.id === id) return next;
      const found = walk(n.children, next);
      if (found) return found;
    }
    return null;
  };
  return (walk(nodes, []) || [id]).join(" › ");
}
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
        delivery?: string | null;
        delivery_attempts?: number | null;
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
  // Page settings, quality, publishing, history and data are separate tasks.
  const [tab, setTab] = useState<
    "seo" | "quality" | "publish" | "history" | "data"
  >("seo");
  const [overflow, setOverflow] = useState<{
    device: Device;
    width: number;
    items: Overflow[];
  } | null>(null);
  const [schedule, setSchedule] = useState<{
    status: string;
    publish_at: number | null;
    unpublish_at: number | null;
    error?: string | null;
  } | null>(null);
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
    setSchedule(
      await api<typeof schedule>(`/pages/${pageId}/schedule`).catch(() => null),
    );
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
      <div
        className="panel-tabs"
        role="tablist"
        aria-label={t("Sayfa ayarları")}
      >
        {(
          [
            ["seo", t("SEO")],
            ["quality", t("Kalite")],
            ["publish", t("Yayın")],
            ["history", t("Geçmiş")],
            ["data", t("Formlar ve ölçüm")],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
            {id === "quality" && warnings.length > 0 && (
              <small className="tab-count">{warnings.length}</small>
            )}
          </button>
        ))}
      </div>
      {tab === "seo" && (
        <>
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
                  commit((p) => ({
                    ...p,
                    seo: { ...seo, [k]: e.target.value },
                  }))
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
        </>
      )}
      {tab === "quality" && (
        <>
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
                {w.nodeId && <small>{nodePath(page.nodes, w.nodeId)}</small>}
              </button>
            ))
          ) : (
            <p>{t("Belge kontrolleri geçti ✓")}</p>
          )}
          <button
            data-overflow-check
            onClick={() => {
              const surface =
                document.querySelector<HTMLElement>(".editable-surface");
              const width =
                document.querySelector(".canvas-sheet")?.getBoundingClientRect()
                  .width || 0;
              const zoom =
                width && surface ? width / (surface.offsetWidth || width) : 1;
              const device = (surface?.dataset.device || "desktop") as Device;
              const seen = new Set<string>();
              const found: Overflow[] = [];
              // Measure the page, not the editor's own handles and toolbars.
              surface?.classList.add("measuring");
              void surface?.offsetWidth;
              for (const el of document.querySelectorAll<HTMLElement>(
                ".editable-surface [data-node-id]",
              )) {
                const id = el.dataset.nodeId || "";
                if (seen.has(id) || el.scrollWidth <= el.clientWidth + 2)
                  continue;
                // Report the element whose own content is wider, not every
                // ancestor that inherits the overflow.
                const child = [
                  ...el.querySelectorAll<HTMLElement>("[data-node-id]"),
                ].find((c) => c.scrollWidth > c.clientWidth + 2);
                if (child) continue;
                // The element sticking out is the one to fix: pick the
                // descendant reaching furthest past the box, if any.
                const edge = el.getBoundingClientRect().right;
                let culprit = el;
                for (const c of el.querySelectorAll<HTMLElement>(
                  "[data-node-id]",
                ))
                  if (
                    c.getBoundingClientRect().right >
                    Math.max(edge, culprit.getBoundingClientRect().right) + 1
                  )
                    culprit = c;
                const target = culprit.dataset.nodeId || id;
                if (seen.has(target)) continue;
                seen.add(id);
                seen.add(target);
                found.push({
                  id: target,
                  path: nodePath(page.nodes, target),
                  device,
                  content: Math.round(
                    culprit === el ? el.scrollWidth : culprit.offsetWidth,
                  ),
                  box: Math.round(el.clientWidth),
                  fixed: (() => {
                    const own = findBlock(page.nodes, target)?.styles[device];
                    return !!(own?.width || own?.minWidth);
                  })(),
                });
              }
              surface?.classList.remove("measuring");
              setOverflow({
                device,
                width: Math.round(width / (zoom || 1)),
                items: found,
              });
            }}
          >
            {t("Görünümde taşmayı kontrol et")}
          </button>
          {overflow && (
            <div className="overflow-results" data-overflow-results>
              <p>
                {overflow.items.length
                  ? t("{p0} · {p1} px: {p2} öğe taşıyor.", {
                      p0: deviceLabel(overflow.device),
                      p1: overflow.width,
                      p2: overflow.items.length,
                    })
                  : t("{p0} · {p1} px: taşan öğe yok ✓", {
                      p0: deviceLabel(overflow.device),
                      p1: overflow.width,
                    })}
              </p>
              {overflow.items.map((item) => (
                <div className="overflow-item" key={item.id} data-overflow-item>
                  <button
                    className="feature-warning quality-issue"
                    onClick={() => selectNode?.(item.id)}
                    title={t("İlgili öğeyi düzenle")}
                  >
                    {item.path} ↗
                  </button>
                  <small>
                    {t("İçerik {p0} px, kutu {p1} px", {
                      p0: item.content,
                      p1: item.box,
                    })}
                  </small>
                  {item.fixed && (
                    <button
                      onClick={() => {
                        commit((current) => ({
                          ...current,
                          nodes: mapBlock(current.nodes, item.id, (n) => {
                            const styles = { ...n.styles[item.device] };
                            delete styles.width;
                            delete styles.minWidth;
                            return {
                              ...n,
                              styles: { ...n.styles, [item.device]: styles },
                            };
                          }),
                        }));
                        setOverflow({
                          ...overflow,
                          items: overflow.items.filter((i) => i.id !== item.id),
                        });
                      }}
                    >
                      {t("Bu cihazdaki sabit genişliği kaldır")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <p>
            {t("Görsel yükü:") + " "}
            {usedImages.length}
            {" " + t("dosya ·")}{" "}
            {(usedImages.reduce((sum, a) => sum + a.bytes, 0) / 1024).toFixed(
              0,
            )}
            {" " +
              t(
                "KB ana dosya. Cihaz boyutları ve geç yükleme kullanılır; bu bir hız testi puanı değildir.",
              )}
          </p>
          <p data-quality-status>
            {warnings.length || overflow?.items.length
              ? t("Tasarım: {p0} uyarı var", {
                  p0: warnings.length + (overflow?.items.length || 0),
                })
              : t("Tasarım: hazır")}
            {" · " +
              t("Veri: yerel katalog · Yayınlama: yerel · Shopify: ertelendi")}
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
                    name:
                      new URL(e.name).pathname.split("/").pop() || t("Görsel"),
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
        </>
      )}
      {tab === "publish" && (
        <>
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
          {schedule?.status === "conflict" && (
            <p
              className="panel-notice error"
              role="alert"
              data-schedule-conflict
            >
              {t("Planlanan yayın uygulanmadı:")} {t(schedule.error || "")}
            </p>
          )}
          {schedule?.status === "pending" && (
            <p className="panel-notice" data-schedule-pending>
              {schedule.publish_at
                ? t("Yayın planı: {p0}", {
                    p0: formatDateTime(schedule.publish_at),
                  })
                : ""}
              {schedule.unpublish_at
                ? " · " +
                  t("Kaldırma planı: {p0}", {
                    p0: formatDateTime(schedule.unpublish_at),
                  })
                : ""}
            </p>
          )}
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
                notify(
                  t("Yerel yayın planlandı. Sunucu çalışırken uygulanır."),
                );
                void load().catch(() => undefined);
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
              {formatDateTime(h.published)}
              {" " + t("· Yayına geri dön")}
            </button>
          ))}
        </>
      )}
      {tab === "history" && (
        <>
          <h3>{t("Kalıcı sürüm geçmişi")}</h3>
          <button
            onClick={() => void load().catch((e) => notify(e.message, true))}
          >
            {t("Listeyi yenile")}
          </button>
          {history.map((h) => (
            <div className="feature-card" key={h.id}>
              <b>
                v{h.version} · {h.reason}
              </b>
              <small>{formatDateTime(h.created)}</small>
              <button
                onClick={async () => {
                  try {
                    const r = await api<{
                      document: PageDocument;
                    }>(`/pages/${pageId}/history/${h.id}`);
                    commit(() => r.document);
                    notify(
                      t("Eski sürüm taslağa alındı. Kaydet veya geri al."),
                    );
                  } catch (e) {
                    notify((e as Error).message, true);
                  }
                }}
              >
                {t("Taslağa geri yükle")}
              </button>
            </div>
          ))}
        </>
      )}
      {tab === "data" && (
        <>
          <h3>{t("Form gönderimleri")}</h3>
          {submissions.map((s) => (
            <div className="feature-card" key={s.id}>
              <small>
                {formatDateTime(s.created)}
                {" · "}
                {s.delivery === "sent"
                  ? t("Webhook'a iletildi")
                  : s.delivery === "pending"
                    ? t("Webhook kuyruğunda ({p0}. deneme)", {
                        p0: String((s.delivery_attempts || 0) + 1),
                      })
                    : s.delivery === "failed"
                      ? t("Webhook'a iletilemedi")
                      : s.delivery === "cancelled"
                        ? t("Mağaza durdurulduğu için iletilmedi")
                        : t("Yalnızca uygulamada saklandı")}
              </small>
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
        </>
      )}
    </div>
  );
}
