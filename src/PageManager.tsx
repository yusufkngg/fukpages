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
    api<{ ids: string[]; version: number }>(`/pages/${page.id}/assignments`)
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
      ? [{ id: "home", title: "Mağazanın ana sayfası" }]
      : page.type === "product"
        ? catalog.products
        : catalog.collections;
  return (
    <Dialog
      open
      label="Sayfa atamaları"
      onClose={close}
      className="page-assignment-dialog"
    >
      <h2>{page.name}</h2>
      <p>
        {page.type === "product"
          ? "Bu tasarımı kullanacak ürünleri seç."
          : page.type === "collection"
            ? "Bu tasarımı kullanacak koleksiyonları seç."
            : "Bu sayfayı mağazanın ana sayfası olarak seç."}
      </p>
      <small>Yerel demo kataloğu · Shopify’a atama yapılmaz.</small>
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
            Önce yerel kataloğa{" "}
            {page.type === "product" ? "ürün" : "koleksiyon"} ekle.
          </p>
        )}
      </div>
      <button disabled={version === null || busy} onClick={() => setIds([])}>
        Tüm atamaları kaldır
      </button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <footer>
        <button onClick={close}>Vazgeç</button>
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
          {busy ? "Kaydediliyor…" : "Atamaları kaydet"}
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
      p.name.toLocaleLowerCase("tr").includes(search.toLocaleLowerCase("tr")),
  );
  return (
    <section className="page-manager" aria-label="Sayfa yönetimi">
      <div className="page-type-tabs" role="tablist" aria-label="Sayfa türleri">
        {[
          ["all", "Tümü"],
          ["home", "Ana sayfa"],
          ["product", "Ürün sayfaları"],
          ["collection", "Koleksiyon sayfaları"],
          ["other", "Diğer"],
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
          aria-label="Sayfa ara"
          placeholder="Sayfa ara…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {writable &&
          (
            [
              ["home", "Yeni ana sayfa"],
              ["product", "Yeni ürün sayfası"],
              ["collection", "Yeni koleksiyon sayfası"],
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
                  notify(label + " oluşturuldu.");
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
          <span>Sayfa adı</span>
          <span>Tür / atamalar</span>
          <span>Yayın durumu</span>
          <span>İşlemler</span>
        </div>
        {filtered.map((p) => (
          <div className="page-table-row" key={p.id} data-page-id={p.id}>
            <span>
              <b>{p.name}</b>
              <small>
                {new Date(p.updated).toLocaleString("tr-TR", {
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
                          ? "Ana sayfa"
                          : (p.type === "product"
                              ? catalog.products
                              : catalog.collections
                            ).find((v) => v.id === id)?.title || id,
                      )
                      .join(", ")
                  : "Atama yok"}
              </small>
            </span>
            <span className="page-publication-state">
              {p.published ? "Yayında" : "Taslak"}
              {p.published &&
                p.assignments?.map((id) => (
                  <a
                    key={id}
                    href={`/p/${store.id}/${p.type === "home" ? "home" : (p.type === "product" ? "products/" : "collections/") + encodeURIComponent(id)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Mağazada aç ↗
                  </a>
                ))}
            </span>
            <div className="page-row-actions">
              <button
                disabled={store.status !== "active"}
                onClick={() => open(p.id)}
              >
                {role === "viewer" ? "Görüntüle" : "Düzenle"}
              </button>
              {writable && (
                <>
                  <button
                    aria-label={`${p.name} çoğalt`}
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
                          "Sayfa çoğaltıldı. Kopya taslaktır ve atamaları boştur.",
                        );
                      } catch (e) {
                        notify((e as Error).message, true);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Çoğalt
                  </button>
                  {["home", "product", "collection"].includes(p.type) && (
                    <button onClick={() => setAssign(p)}>Atamalar</button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        {!filtered.length && (
          <div className="dashboard-empty">
            <p>Bu türde eşleşen sayfa yok.</p>
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
              "Atamalar kaydedildi. Sayfanın yayınlanan sürümü yerel hedefte açılır.",
            );
          }}
        />
      )}
    </section>
  );
}
