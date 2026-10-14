import { getUiLocale, getUiLanguage, t } from "./i18n.ts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, json } from "./api";
import { Dialog } from "./Dialog";
import { pageTemplate } from "./pageTemplates";
import { TemplatePicker } from "./TemplateLibrary";
import { templateDocument } from "./pageTemplateLibrary";
import { StudioProvider, assetUrl, defaultBrand, type Brand } from "./studio";
import { CircleAlert, LayoutTemplate, RotateCcw, Trash2 } from "lucide-react";
import {
  assignmentsTakenBy,
  canCreatePageType,
  canDuplicatePageType,
  copyName,
  primaryPage,
  showsAssignments,
} from "./pageRules";
import {
  pageNames,
  type PageDocument,
  type Store,
  type PageSummary,
  type PageType,
} from "./model";
import type { Catalog } from "./Commerce";
/** Label for an assignment target ("*" is the default for everything). */
export function assignmentLabel(
  id: string,
  type: string,
  catalog: Catalog,
): string {
  if (id === "*")
    return type === "collection"
      ? t("Tüm koleksiyonlar · varsayılan")
      : t("Tüm ürünler · varsayılan");
  return (
    (type === "product" ? catalog.products : catalog.collections).find(
      (v) => v.id === id,
    )?.title || id
  );
}
export function AssignmentDialog({
  page,
  store,
  catalog,
  close,
  saved,
  taken = {},
  intro,
}: {
  page: PageSummary;
  store: Store;
  catalog: Catalog;
  close: () => void;
  saved: () => void;
  /** Replaces the default explanation, e.g. right after copying a page. */
  intro?: string;
  /** Items already assigned to other pages, mapped to that page's name. */
  taken?: Record<string, string>;
}) {
  const [ids, setIds] = useState<string[]>([]),
    [version, setVersion] = useState<number | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [takeDefault, setTakeDefault] = useState(false);
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
  const isProduct = page.type === "product";
  const listed: { id: string; title: string; image?: string; note?: string }[] =
    page.type === "home"
      ? [{ id: "home", title: t("Mağazanın ana sayfası") }]
      : isProduct
        ? catalog.products.map((p) => ({
            id: p.id,
            title: p.title,
            image: p.images[0],
          }))
        : catalog.collections.map((c) => ({
            id: c.id,
            title: c.title,
            image: c.image,
            note: t("{p0} ürün", { p0: c.productIds.length }),
          }));
  const needle = query.trim().toLocaleLowerCase(getUiLanguage());
  const options = needle
    ? listed.filter((item) =>
        item.title.toLocaleLowerCase(getUiLanguage()).includes(needle),
      )
    : listed;
  const editable = version !== null && !busy;
  const free = options.filter((item) => !taken[item.id]);
  const toggle = (id: string, on: boolean) =>
    setIds((old) =>
      on ? [...new Set([...old, id])] : old.filter((v) => v !== id),
    );
  const isDefault = ids.includes("*");
  const defaultOwner = taken["*"];
  const specific = ids.filter((id) => id !== "*").length;
  return (
    <Dialog
      open
      label={t("Sayfa atamaları")}
      onClose={close}
      className="page-assignment-dialog"
    >
      <h2>{page.name}</h2>
      <p>
        {intro ??
          (isProduct
            ? t("Bu tasarımı kullanacak ürünleri seç.")
            : page.type === "collection"
              ? t("Bu tasarımı kullanacak koleksiyonları seç.")
              : t("Bu sayfayı mağazanın ana sayfası olarak seç."))}
      </p>
      {page.type !== "home" && (
        <div className={`assignment-default ${isDefault ? "on" : ""}`}>
          <label>
            <input
              type="checkbox"
              aria-label={assignmentLabel("*", page.type, catalog)}
              checked={isDefault}
              disabled={!editable || (!!defaultOwner && !takeDefault)}
              onChange={(e) => toggle("*", e.target.checked)}
            />
            <span>
              <b>{assignmentLabel("*", page.type, catalog)}</b>
              <small>
                {isProduct
                  ? t(
                      "Kendine ait sayfası olmayan her ürün bu tasarımla açılır. Aşağıda seçtiğin ürünler ise her zaman bu sayfayı kullanır.",
                    )
                  : t(
                      "Kendine ait sayfası olmayan her koleksiyon bu tasarımla açılır. Aşağıda seçtiğin koleksiyonlar ise her zaman bu sayfayı kullanır.",
                    )}
              </small>
            </span>
          </label>
          {defaultOwner && !takeDefault && (
            <p>
              {t("Şu an varsayılan: “{p0}”.", { p0: defaultOwner })}{" "}
              <button
                disabled={!editable}
                onClick={() => {
                  setTakeDefault(true);
                  toggle("*", true);
                }}
              >
                {t("Varsayılanı bu sayfaya taşı")}
              </button>
            </p>
          )}
        </div>
      )}
      {page.type !== "home" && listed.length > 0 && (
        <div className="assignment-tools">
          <input
            type="search"
            aria-label={isProduct ? t("Ürün ara") : t("Koleksiyon ara")}
            placeholder={isProduct ? t("Ürün ara…") : t("Koleksiyon ara…")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            disabled={!editable || !free.length}
            onClick={() =>
              setIds((old) => [...new Set([...old, ...free.map((f) => f.id)])])
            }
          >
            {t("Listedekileri seç")}
          </button>
          <span>
            {isProduct
              ? t("{p0} ürün seçili", { p0: specific })
              : t("{p0} koleksiyon seçili", { p0: specific })}
          </span>
        </div>
      )}
      <div className="assignment-options">
        {options.map((item) => {
          const usedBy = taken[item.id];
          return (
            <label key={item.id} className={usedBy ? "taken" : undefined}>
              <input
                type="checkbox"
                aria-label={t("Ata: {p0}", { p0: item.title })}
                checked={ids.includes(item.id)}
                disabled={!editable || !!usedBy}
                onChange={(e) => toggle(item.id, e.target.checked)}
              />
              {item.image !== undefined && (
                <span className="assignment-thumb">
                  {item.image && <img src={assetUrl(item.image)} alt="" />}
                </span>
              )}
              <span className="assignment-title">
                {item.title}
                {item.note && <small>{item.note}</small>}
              </span>
              {usedBy && (
                <small>
                  {t("“{p0}” sayfasında kullanılıyor", { p0: usedBy })}
                </small>
              )}
            </label>
          );
        })}
        {!listed.length && (
          <p>
            {isProduct
              ? t("Önce yerel kataloğa ürün ekle.")
              : t("Önce yerel kataloğa koleksiyon ekle.")}
          </p>
        )}
        {!!listed.length && !options.length && (
          <p>{t("Aramayla eşleşen sonuç yok.")}</p>
        )}
      </div>
      <small>{t("Yerel demo kataloğu · Shopify’a atama yapılmaz.")}</small>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <footer>
        <button disabled={!editable} onClick={() => setIds([])}>
          {t("Tüm atamaları kaldır")}
        </button>
        <span />
        <button onClick={close}>{t("Vazgeç")}</button>
        <button
          className="primary-button"
          disabled={!editable}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await api(`/pages/${page.id}/assignments`, {
                method: "PUT",
                body: json({ ids, version, takeDefault }),
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
interface TrashedPage {
  id: string;
  name: string;
  type: PageType;
  updated: number;
  trashed: number;
  wasPublished: boolean;
}
type ConfirmAction =
  | { kind: "trash"; pages: PageSummary[] }
  | { kind: "delete"; page: TrashedPage };

export function PageManager({
  store,
  role,
  open,
  notify,
  changed,
}: {
  store: Store;
  role: string;
  open: (id: string) => void;
  notify: (m: string, e?: boolean) => void;
  /** Called with the fresh page list after it was loaded or changed. */
  changed?: (pages: PageSummary[]) => void;
}) {
  const [pages, setPages] = useState<PageSummary[]>([]),
    [trash, setTrash] = useState<TrashedPage[]>([]),
    [catalog, setCatalog] = useState<Catalog>({
      source: "local",
      products: [],
      collections: [],
    }),
    [tab, setTab] = useState("all"),
    [search, setSearch] = useState(""),
    [assign, setAssign] = useState<PageSummary | null>(null),
    [busy, setBusy] = useState(false),
    [picker, setPicker] = useState(false),
    [brand, setBrand] = useState<Brand>(defaultBrand),
    [chosen, setChosen] = useState<string[]>([]),
    [confirm, setConfirm] = useState<ConfirmAction | null>(null),
    [freshCopy, setFreshCopy] = useState("");
  useEffect(() => {
    if (!picker) return;
    api<{ brand: Brand }>(`/stores/${store.id}/brand`)
      .then((r) => setBrand(r.brand))
      .catch(() => {
        /* previews fall back to the default brand */
      });
  }, [picker, store.id]);
  // The callback may change identity on every render; reload stays stable.
  const changedRef = useRef(changed);
  changedRef.current = changed;
  const templateContext = useMemo(
    () => ({
      collectionId: catalog.collections[0]?.id,
      productIds: catalog.products.slice(0, 2).map((p) => p.id),
    }),
    [catalog],
  );
  const reload = useCallback(async () => {
    const [list, c, trashed] = await Promise.all([
      api<PageSummary[]>(`/stores/${store.id}/page-overview`),
      api<Catalog>(`/stores/${store.id}/catalog`),
      api<TrashedPage[]>(`/stores/${store.id}/trash`),
    ]);
    setPages(list);
    setCatalog(c);
    setTrash(trashed);
    changedRef.current?.(list);
    setChosen((old) => old.filter((id) => list.some((p) => p.id === id)));
    return list;
  }, [store.id]);
  useEffect(() => {
    void reload().catch((e) => notify(e.message, true));
  }, [reload, notify]);
  const writable = role !== "viewer" && store.status === "active";
  const homes = pages.filter((p) => p.type === "home");
  const mainHome = primaryPage(pages, "home");
  const inTab = (p: { type: string }, id: string) =>
    id === "all" ||
    (id === "other" && !["home", "product", "collection"].includes(p.type)) ||
    p.type === id;
  const matches = (name: string) =>
    name
      .toLocaleLowerCase(getUiLanguage())
      .includes(search.toLocaleLowerCase(getUiLanguage()));
  const filtered = pages.filter((p) => inTab(p, tab) && matches(p.name));
  const filteredTrash = trash.filter((p) => matches(p.name));
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  const createBlank = (type: PageType, label: string) =>
    run(async () => {
      const document = pageTemplate(type);
      if (type === "home") document.name = t("Ana sayfa");
      await api(`/stores/${store.id}/pages`, {
        method: "POST",
        body: json({ document }),
      });
      setTab(type);
      await reload();
      notify(label + t(" oluşturuldu."));
    });
  const duplicate = (page: PageSummary) =>
    run(async () => {
      const copy = await api<{ id: string }>(`/pages/${page.id}/duplicate`, {
        method: "POST",
        body: json({ name: copyName(page.name) }),
      });
      const list = await reload();
      const created = list.find((p) => p.id === copy.id);
      if (created && ["product", "collection"].includes(created.type)) {
        // A copy of a product/collection design is meant for other items.
        setAssign(created);
        setFreshCopy(created.id);
      } else
        notify(t("Sayfa çoğaltıldı. Kopya taslaktır ve atamaları boştur."));
    });
  const convertToLanding = (page: PageSummary) =>
    run(async () => {
      const current = await api<{ document: PageDocument; version: number }>(
        `/pages/${page.id}`,
      );
      await api(`/pages/${page.id}`, {
        method: "PUT",
        body: json({
          document: { ...current.document, type: "landing" },
          version: current.version,
        }),
      });
      await reload();
      notify(
        t("“{p0}” artık bir açılış sayfası.", {
          p0: page.name,
        }),
      );
    });
  const moveToTrash = (list: PageSummary[]) =>
    run(async () => {
      for (const page of list)
        await api(`/pages/${page.id}/trash`, { method: "POST", body: "{}" });
      setChosen([]);
      await reload();
      notify(
        list.length === 1
          ? t("“{p0}” çöp kutusuna taşındı.", { p0: list[0].name })
          : t("{p0} sayfa çöp kutusuna taşındı.", { p0: list.length }),
      );
    });
  const restore = (page: TrashedPage) =>
    run(async () => {
      await api(`/stores/${store.id}/trash/${page.id}/restore`, {
        method: "POST",
        body: "{}",
      });
      await reload();
      notify(
        t("“{p0}” geri yüklendi. Taslak olarak duruyor.", { p0: page.name }),
      );
    });
  const deleteForever = (page: TrashedPage) =>
    run(async () => {
      await api(`/stores/${store.id}/trash/${page.id}`, { method: "DELETE" });
      await reload();
      notify(t("“{p0}” kalıcı olarak silindi.", { p0: page.name }));
    });
  const toggle = (id: string, on: boolean) =>
    setChosen((old) =>
      on ? [...new Set([...old, id])] : old.filter((v) => v !== id),
    );
  const tabs: [string, string, number][] = [
    ["all", t("Tümü"), pages.length],
    ["home", t("Ana sayfa"), homes.length],
    [
      "product",
      t("Ürün sayfaları"),
      pages.filter((p) => p.type === "product").length,
    ],
    [
      "collection",
      t("Koleksiyon sayfaları"),
      pages.filter((p) => p.type === "collection").length,
    ],
    ["other", t("Diğer"), pages.filter((p) => inTab(p, "other")).length],
    ["trash", t("Çöp kutusu"), trash.length],
  ];
  return (
    <section className="page-manager" aria-label={t("Sayfa yönetimi")}>
      <div
        className="page-type-tabs"
        role="tablist"
        aria-label={t("Sayfa türleri")}
      >
        {tabs.map(([id, name, count]) => (
          <button
            role="tab"
            aria-selected={tab === id}
            key={id}
            onClick={() => {
              setTab(id);
              setChosen([]);
            }}
          >
            {id === "trash" && <Trash2 size={13} />}
            {name}
            <span>{count}</span>
          </button>
        ))}
      </div>
      {homes.length > 1 && writable && (
        <div className="page-rule-banner" role="status">
          <CircleAlert size={16} />
          <p>
            <b>{t("Bu mağazada {p0} ana sayfa var.", { p0: homes.length })}</b>{" "}
            {t(
              "Bir mağazada tek ana sayfa olur. “{p0}” ana sayfa olarak kalır; diğerlerini açılış sayfasına dönüştür veya çöp kutusuna taşı.",
              { p0: mainHome?.name ?? "" },
            )}
          </p>
        </div>
      )}
      {writable &&
        (["product", "collection"] as const).map((kind) =>
          pages.some((p) => p.type === kind) &&
          !pages.some(
            (p) => p.type === kind && p.assignments?.includes("*"),
          ) ? (
            <div className="page-rule-banner" role="status" key={kind}>
              <CircleAlert size={16} />
              <p>
                {kind === "product"
                  ? t(
                      "Varsayılan ürün sayfası yok: kendi sayfası olmayan ürünler açılmaz. Bir ürün sayfasının Atamalar penceresinde “Tüm ürünler” seçeneğini işaretle.",
                    )
                  : t(
                      "Varsayılan koleksiyon sayfası yok: kendi sayfası olmayan koleksiyonlar açılmaz. Bir koleksiyon sayfasının Atamalar penceresinde “Tüm koleksiyonlar” seçeneğini işaretle.",
                    )}
              </p>
            </div>
          ) : null,
        )}
      <div className="page-manager-controls">
        <input
          aria-label={t("Sayfa ara")}
          placeholder={t("Sayfa ara…")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {writable &&
          tab !== "trash" &&
          (
            [
              ["home", t("Yeni ana sayfa")],
              ["product", t("Yeni ürün sayfası")],
              ["collection", t("Yeni koleksiyon sayfası")],
            ] as [PageType, string][]
          ).map(([type, label]) => {
            const blocked = !canCreatePageType(type, pages);
            return (
              <button
                key={type}
                disabled={busy || blocked}
                title={
                  blocked
                    ? t("Bu mağazanın zaten bir ana sayfası var.")
                    : undefined
                }
                onClick={() => void createBlank(type, label)}
              >
                + {label}
              </button>
            );
          })}
        {writable && tab !== "trash" && (
          <button
            className="template-start-button"
            disabled={busy}
            onClick={() => setPicker(true)}
          >
            <LayoutTemplate size={14} />
            {t("Şablondan sayfa oluştur")}
          </button>
        )}
      </div>
      {writable && chosen.length > 0 && tab !== "trash" && (
        <div
          className="page-bulk-bar"
          role="region"
          aria-label={t("Seçili sayfalar")}
        >
          <b>{t("{p0} sayfa seçili", { p0: chosen.length })}</b>
          <button
            disabled={busy}
            onClick={() =>
              setConfirm({
                kind: "trash",
                pages: pages.filter((p) => chosen.includes(p.id)),
              })
            }
          >
            <Trash2 size={13} />
            {t("Çöp kutusuna taşı")}
          </button>
          <button onClick={() => setChosen([])}>{t("Seçimi temizle")}</button>
        </div>
      )}
      {picker && (
        <StudioProvider
          page={{ schemaVersion: 1, name: "", type: "landing", nodes: [] }}
          value={{ brand, catalog }}
        >
          <TemplatePicker
            context={templateContext}
            blockedTypes={(["home"] as PageType[]).filter(
              (type) => !canCreatePageType(type, pages),
            )}
            onClose={() => setPicker(false)}
            create={async (template, type) => {
              const document = templateDocument(
                template.id,
                templateContext,
                type,
              );
              if (!document) return;
              try {
                const created = await api<{ id: string }>(
                  `/stores/${store.id}/pages`,
                  { method: "POST", body: json({ document }) },
                );
                setPicker(false);
                notify(t("{p0} oluşturuldu.", { p0: document.name }));
                open(created.id);
              } catch (e) {
                notify((e as Error).message, true);
              }
            }}
          />
        </StudioProvider>
      )}
      {tab === "trash" ? (
        <div className="page-table page-trash">
          <div className="page-table-header">
            <span>{t("Sayfa adı")}</span>
            <span>{t("Tür")}</span>
            <span>{t("Taşındığı tarih")}</span>
            <span>{t("İşlemler")}</span>
          </div>
          {filteredTrash.map((p) => (
            <div className="page-table-row" key={p.id} data-trash-id={p.id}>
              <span>
                <b>{p.name}</b>
                {p.wasPublished && (
                  <small>{t("Taşınmadan önce yayındaydı")}</small>
                )}
              </span>
              <span>{pageNames[p.type]}</span>
              <span>
                {new Date(p.trashed).toLocaleString(getUiLocale(), {
                  timeZone: "Europe/Istanbul",
                })}
              </span>
              <div className="page-row-actions">
                {writable && (
                  <>
                    <button
                      disabled={busy}
                      aria-label={t("{p0} geri yükle", { p0: p.name })}
                      onClick={() => void restore(p)}
                    >
                      <RotateCcw size={13} />
                      {t("Geri yükle")}
                    </button>
                    <button
                      disabled={busy}
                      className="danger"
                      aria-label={t("{p0} kalıcı olarak sil", { p0: p.name })}
                      onClick={() => setConfirm({ kind: "delete", page: p })}
                    >
                      {t("Kalıcı olarak sil")}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          {!filteredTrash.length && (
            <div className="dashboard-empty">
              <p>{t("Çöp kutusu boş.")}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="page-table">
          <div className="page-table-header">
            <span className="page-name-heading">
              {writable && (
                <input
                  type="checkbox"
                  aria-label={t("Listedeki tüm sayfaları seç")}
                  checked={
                    filtered.length > 0 &&
                    filtered.every((p) => chosen.includes(p.id))
                  }
                  onChange={(e) =>
                    filtered.forEach((p) => toggle(p.id, e.target.checked))
                  }
                />
              )}
              {t("Sayfa adı")}
            </span>
            <span>{t("Tür / atamalar")}</span>
            <span>{t("Yayın durumu")}</span>
            <span>{t("İşlemler")}</span>
          </div>
          {filtered.map((p) => {
            const extraHome = p.type === "home" && p.id !== mainHome?.id;
            return (
              <div
                className={`page-table-row ${chosen.includes(p.id) ? "chosen" : ""}`}
                key={p.id}
                data-page-id={p.id}
              >
                <span className="page-name-cell">
                  {writable && (
                    <input
                      type="checkbox"
                      aria-label={t("{p0} seç", { p0: p.name })}
                      checked={chosen.includes(p.id)}
                      onChange={(e) => toggle(p.id, e.target.checked)}
                    />
                  )}
                  <span>
                    <b>{p.name}</b>
                    <small>
                      {new Date(p.updated).toLocaleString(getUiLocale(), {
                        timeZone: "Europe/Istanbul",
                      })}
                    </small>
                  </span>
                </span>
                <span>
                  {pageNames[p.type]}
                  <small>
                    {p.type === "home"
                      ? extraHome
                        ? t("Fazladan ana sayfa")
                        : t("Mağazanın ana sayfası")
                      : p.assignments?.length
                        ? [...p.assignments]
                            .sort((a) => (a === "*" ? -1 : 0))
                            .map((id) => assignmentLabel(id, p.type, catalog))
                            .join(", ")
                        : t("Atama yok")}
                  </small>
                </span>
                <span className="page-publication-state">
                  {p.published ? t("Yayında") : t("Taslak")}
                  {p.published &&
                    p.assignments?.slice(0, 1).map((assigned) => {
                      // The default page opens on a product without its own page.
                      const own = new Set(
                        pages
                          .filter((o) => o.type === p.type)
                          .flatMap((o) => o.assignments ?? []),
                      );
                      const id =
                        assigned === "*"
                          ? ((p.type === "product"
                              ? catalog.products
                              : catalog.collections
                            ).find((v) => !own.has(v.id))?.id ?? "")
                          : assigned;
                      return id ? (
                        <a
                          key={id}
                          href={`/p/${store.id}/${p.type === "home" ? "home" : (p.type === "product" ? "products/" : "collections/") + encodeURIComponent(id)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t("Mağazada aç ↗")}
                        </a>
                      ) : null;
                    })}
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
                      {canDuplicatePageType(p.type) && (
                        <button
                          aria-label={t("{p0} çoğalt", { p0: p.name })}
                          disabled={busy}
                          onClick={() => void duplicate(p)}
                        >
                          {t("Çoğalt")}
                        </button>
                      )}
                      {showsAssignments(p.type, pages) && (
                        <button onClick={() => setAssign(p)}>
                          {t("Atamalar")}
                        </button>
                      )}
                      {extraHome && (
                        <button
                          disabled={busy}
                          onClick={() => void convertToLanding(p)}
                        >
                          {t("Açılış sayfasına dönüştür")}
                        </button>
                      )}
                      <button
                        className="icon-only"
                        disabled={busy}
                        aria-label={t("{p0} çöp kutusuna taşı", {
                          p0: p.name,
                        })}
                        title={t("Çöp kutusuna taşı")}
                        onClick={() =>
                          setConfirm({ kind: "trash", pages: [p] })
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {!filtered.length && (
            <div className="dashboard-empty">
              <p>{t("Bu türde eşleşen sayfa yok.")}</p>
            </div>
          )}
        </div>
      )}
      {confirm && (
        <Dialog
          open
          onClose={() => setConfirm(null)}
          label={
            confirm.kind === "trash"
              ? t("Çöp kutusuna taşı")
              : t("Kalıcı olarak sil")
          }
          className="page-confirm-dialog"
        >
          {confirm.kind === "trash" ? (
            <>
              <h2>
                {confirm.pages.length === 1
                  ? t("“{p0}” çöp kutusuna taşınsın mı?", {
                      p0: confirm.pages[0].name,
                    })
                  : t("{p0} sayfa çöp kutusuna taşınsın mı?", {
                      p0: confirm.pages.length,
                    })}
              </h2>
              <p>
                {t(
                  "Sayfalar listeden kalkar; çöp kutusundan geri yükleyebilirsin. Geçmişleri ve form kayıtları korunur.",
                )}
              </p>
              {confirm.pages.some((p) => p.published) && (
                <p className="form-error">
                  {t(
                    "{p0} sayfa yayında. Taşınınca yerel yayından kalkar ve ürün/koleksiyon atamaları boşalır.",
                    {
                      p0: confirm.pages.filter((p) => p.published).length,
                    },
                  )}
                </p>
              )}
              {confirm.pages.some((p) => p.type === "home") && (
                <p className="form-error">
                  {t("Mağazanın ana sayfası da taşınacak.")}
                </p>
              )}
              <footer>
                <button onClick={() => setConfirm(null)}>{t("Vazgeç")}</button>
                <button
                  className="primary-button"
                  disabled={busy}
                  onClick={() => {
                    const list = confirm.pages;
                    setConfirm(null);
                    void moveToTrash(list);
                  }}
                >
                  {t("Çöp kutusuna taşı")}
                </button>
              </footer>
            </>
          ) : (
            <>
              <h2>
                {t("“{p0}” kalıcı olarak silinsin mi?", {
                  p0: confirm.page.name,
                })}
              </h2>
              <p>
                {t(
                  "Tasarım, sürüm geçmişi ve yayın geçmişi silinir. Bu işlem geri alınamaz. Form kayıtları korunur.",
                )}
              </p>
              <footer>
                <button onClick={() => setConfirm(null)}>{t("Vazgeç")}</button>
                <button
                  className="primary-button danger"
                  disabled={busy}
                  onClick={() => {
                    const page = confirm.page;
                    setConfirm(null);
                    void deleteForever(page);
                  }}
                >
                  {t("Kalıcı olarak sil")}
                </button>
              </footer>
            </>
          )}
        </Dialog>
      )}
      {assign && (
        <AssignmentDialog
          page={assign}
          store={store}
          catalog={catalog}
          taken={assignmentsTakenBy(assign, pages)}
          intro={
            freshCopy === assign.id
              ? assign.type === "product"
                ? t("Kopya oluşturuldu. Bu tasarımı kullanacak ürünleri seç.")
                : t(
                    "Kopya oluşturuldu. Bu tasarımı kullanacak koleksiyonları seç.",
                  )
              : undefined
          }
          close={() => {
            setAssign(null);
            setFreshCopy("");
          }}
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
