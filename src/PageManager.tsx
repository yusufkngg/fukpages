import { getUiLocale, getUiLanguage, t } from "./i18n.ts";
import { useCallback, useEffect, useState } from "react";
import { api, json } from "./api";
import { Dialog } from "./Dialog";
import { pageTemplate } from "./pageTemplates";
import {
  pageNames,
  type Store,
  type PageSummary,
  type PageType,
} from "./model";
import type { Catalog } from "./Commerce";
export function AssignmentDialog({
  page,
  store,
  catalog,
  close,
  saved,
}: {
  page: PageSummary;
  store: Store;
  catalog: Catalog;
  close: () => void;
  saved: () => void;
}) {
  const [ids, setIds] = useState<string[]>([]),
    [version, setVersion] = useState<number | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    api<{
      ids: string[];
      version: number;
    }>(`/pages/${page.id}/assignments`)
      .then((r) => {
        if (active) {
          setIds(r.ids);
          setVersion(r.version);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [page.id]);
  const options =
    page.type === "home"
      ? [{ id: "home", title: t("Mağazanın ana sayfası") }]
      : page.type === "product"
        ? catalog.products
        : catalog.collections;
  return (
    <Dialog
      open
      label={t("Sayfa atamaları")}
      onClose={close}
      className="page-assignment-dialog"
    >
      <h2>{page.name}</h2>
      <p>
        {page.type === "product"
          ? t("Bu tasarımı kullanacak ürünleri seç.")
          : page.type === "collection"
            ? t("Bu tasarımı kullanacak koleksiyonları seç.")
            : t("Bu sayfayı mağazanın ana sayfası olarak seç.")}
      </p>
      <small>{t("Yerel demo kataloğu · Shopify’a atama yapılmaz.")}</small>
      <div className="assignment-options">
        {options.map((item) => (
          <label key={item.id}>
            <input
              type="checkbox"
              aria-label={`Ata: ${item.title}`}
              checked={ids.includes(item.id)}
              disabled={version === null || busy}
              onChange={(e) =>
                setIds((old) =>
                  e.target.checked
                    ? [...old, item.id]
                    : old.filter((id) => id !== item.id),
                )
              }
            />
            {item.title}
          </label>
        ))}
        {!options.length && (
          <p>
            {t("Önce yerel kataloğa")}{" "}
            {page.type === "product" ? t("ürün") : "koleksiyon"}
            {" " + t("ekle.")}
          </p>
        )}
      </div>
      <button disabled={version === null || busy} onClick={() => setIds([])}>
        {t("Tüm atamaları kaldır")}
      </button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <footer>
        <button onClick={close}>{t("Vazgeç")}</button>
        <button
          className="primary-button"
          disabled={version === null || busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await api(`/pages/${page.id}/assignments`, {
                method: "PUT",
                body: json({ ids, version }),
              });
              saved();
              close();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? t("Kaydediliyor…") : t("Atamaları kaydet")}
        </button>
      </footer>
    </Dialog>
  );
}
export function PageManager({
  store,
  role,
  open,
  notify,
}: {
  store: Store;
  role: string;
  open: (id: string) => void;
  notify: (m: string, e?: boolean) => void;
}) {
  const [pages, setPages] = useState<PageSummary[]>([]),
    [catalog, setCatalog] = useState<Catalog>({
      source: "local",
      products: [],
      collections: [],
    }),
    [tab, setTab] = useState("all"),
    [search, setSearch] = useState(""),
    [assign, setAssign] = useState<PageSummary | null>(null),
    [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    const [list, c] = await Promise.all([
      api<PageSummary[]>(`/stores/${store.id}/page-overview`),
      api<Catalog>(`/stores/${store.id}/catalog`),
    ]);
    setPages(list);
    setCatalog(c);
  }, [store.id]);
  useEffect(() => {
    void reload().catch((e) => notify(e.message, true));
  }, [reload, notify]);
  const writable = role !== "viewer" && store.status === "active";
  const filtered = pages.filter(
    (p) =>
      (tab === "all" ||
        (tab === "other" &&
          !["home", "product", "collection"].includes(p.type)) ||
        p.type === tab) &&
      p.name
        .toLocaleLowerCase(getUiLanguage())
        .includes(search.toLocaleLowerCase(getUiLanguage())),
  );
  return (
    <section className="page-manager" aria-label={t("Sayfa yönetimi")}>
      <div
        className="page-type-tabs"
        role="tablist"
        aria-label={t("Sayfa türleri")}
      >
        {[
          ["all", t("Tümü")],
          ["home", t("Ana sayfa")],
          ["product", t("Ürün sayfaları")],
          ["collection", t("Koleksiyon sayfaları")],
          ["other", t("Diğer")],
        ].map(([id, name]) => (
          <button
            role="tab"
            aria-selected={tab === id}
            key={id}
            onClick={() => setTab(id)}
          >
            {name}
            <span>
              {
                pages.filter(
                  (p) =>
                    id === "all" ||
                    (id === "other" &&
                      !["home", "product", "collection"].includes(p.type)) ||
                    p.type === id,
                ).length
              }
            </span>
          </button>
        ))}
      </div>
      <div className="page-manager-controls">
        <input
          aria-label={t("Sayfa ara")}
          placeholder={t("Sayfa ara…")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {writable &&
          (
            [
              ["home", t("Yeni ana sayfa")],
              ["product", t("Yeni ürün sayfası")],
              ["collection", t("Yeni koleksiyon sayfası")],
            ] as [PageType, string][]
          ).map(([type, label]) => (
            <button
              key={type}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`/stores/${store.id}/pages`, {
                    method: "POST",
                    body: json({ document: pageTemplate(type) }),
                  });
                  setTab(type);
                  await reload();
                  notify(label + t(" oluşturuldu."));
                } catch (e) {
                  notify((e as Error).message, true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              + {label}
            </button>
          ))}
      </div>
      <div className="page-table">
        <div className="page-table-header">
          <span>{t("Sayfa adı")}</span>
          <span>{t("Tür / atamalar")}</span>
          <span>{t("Yayın durumu")}</span>
          <span>{t("İşlemler")}</span>
        </div>
        {filtered.map((p) => (
          <div className="page-table-row" key={p.id} data-page-id={p.id}>
            <span>
              <b>{p.name}</b>
              <small>
                {new Date(p.updated).toLocaleString(getUiLocale(), {
                  timeZone: "Europe/Istanbul",
                })}
              </small>
            </span>
            <span>
              {pageNames[p.type]}
              <small>
                {p.assignments?.length
                  ? p.assignments
                      .map((id) =>
                        p.type === "home"
                          ? t("Ana sayfa")
                          : (p.type === "product"
                              ? catalog.products
                              : catalog.collections
                            ).find((v) => v.id === id)?.title || id,
                      )
                      .join(", ")
                  : t("Atama yok")}
              </small>
            </span>
            <span className="page-publication-state">
              {p.published ? t("Yayında") : t("Taslak")}
              {p.published &&
                p.assignments?.map((id) => (
                  <a
                    key={id}
                    href={`/p/${store.id}/${p.type === "home" ? "home" : (p.type === "product" ? "products/" : "collections/") + encodeURIComponent(id)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("Mağazada aç ↗")}
                  </a>
                ))}
            </span>
            <div className="page-row-actions">
              <button
                disabled={store.status !== "active"}
                onClick={() => open(p.id)}
              >
                {role === "viewer" ? t("Görüntüle") : t("Düzenle")}
              </button>
              {writable && (
                <>
                  <button
                    aria-label={t("{p0} çoğalt", { p0: p.name })}
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await api(`/pages/${p.id}/duplicate`, {
                          method: "POST",
                          body: "{}",
                        });
                        await reload();
                        notify(
                          t(
                            "Sayfa çoğaltıldı. Kopya taslaktır ve atamaları boştur.",
                          ),
                        );
                      } catch (e) {
                        notify((e as Error).message, true);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {t("Çoğalt")}
                  </button>
                  {["home", "product", "collection"].includes(p.type) && (
                    <button onClick={() => setAssign(p)}>
                      {t("Atamalar")}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        {!filtered.length && (
          <div className="dashboard-empty">
            <p>{t("Bu türde eşleşen sayfa yok.")}</p>
          </div>
        )}
      </div>
      {assign && (
        <AssignmentDialog
          page={assign}
          store={store}
          catalog={catalog}
          close={() => setAssign(null)}
          saved={() => {
            void reload();
            notify(
              t(
                "Atamalar kaydedildi. Sayfanın yayınlanan sürümü yerel hedefte açılır.",
              ),
            );
          }}
        />
      )}
    </section>
  );
}
