import { t } from "./i18n.ts";
import { useEffect, useState } from "react";
import { api } from "./api";
import { AssignmentDialog } from "./PageManager";
import {
  pageNames,
  type PageSummary,
  type Store,
  type PageType,
} from "./model";
import type { Catalog } from "./Commerce";
export function PageBar({
  pageId,
  store,
  catalog,
  busy,
  switchPage,
  manage,
  save,
  notify,
  type,
  resource,
  onResource,
}: {
  pageId: string;
  store: Store;
  catalog: Catalog;
  busy: boolean;
  switchPage: (id: string) => Promise<void>;
  manage: () => Promise<void>;
  save: () => Promise<boolean>;
  notify: (m: string, e?: boolean) => void;
  type: PageType;
  resource: string;
  onResource: (id: string) => void;
}) {
  const [pages, setPages] = useState<PageSummary[]>([]),
    [assign, setAssign] = useState<PageSummary | null>(null);
  useEffect(() => {
    let active = true;
    api<PageSummary[]>(`/stores/${store.id}/page-overview`)
      .then((p) => {
        if (active) setPages(p);
      })
      .catch((e) => notify(e.message, true));
    return () => {
      active = false;
    };
  }, [store.id, pageId, notify]);
  const current = pages.find((p) => p.id === pageId);
  return (
    <nav className="editor-page-bar" aria-label={t("Editör sayfa geçişi")}>
      <button disabled={busy} onClick={() => void manage()}>
        {t("Sayfa yönetimi")}
      </button>
      <select
        aria-label={t("Sayfalar arasında geçiş")}
        value={pageId}
        disabled={busy}
        onChange={(e) => void switchPage(e.target.value)}
      >
        {[
          "home",
          "product",
          "collection",
          "landing",
          "page",
          "blog",
          "article",
          "cart",
          "search",
        ].map((type) => (
          <optgroup
            key={type}
            label={pageNames[type as keyof typeof pageNames]}
          >
            {pages
              .filter((p) => p.type === type)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </optgroup>
        ))}
        {!current && <option value={pageId}>{t("Geçerli sayfa")}</option>}
      </select>
      <span>
        {current ? pageNames[current.type] : ""} ·{" "}
        {current?.assignments?.length || 0}
        {" " + t("atama")}
      </span>
      {current && ["home", "product", "collection"].includes(current.type) && (
        <button
          disabled={busy}
          onClick={async () => {
            if (await save()) setAssign(current);
          }}
        >
          {t("Ürün / koleksiyon atamaları")}
        </button>
      )}
      {["product", "collection"].includes(type) && (
        <select
          aria-label={
            type === "product" ? t("Önizleme ürünü") : t("Önizleme koleksiyonu")
          }
          value={
            resource ||
            (type === "product" ? catalog.products : catalog.collections)[0]
              ?.id ||
            ""
          }
          onChange={(e) => onResource(e.target.value)}
        >
          {(type === "product" ? catalog.products : catalog.collections).map(
            (item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ),
          )}
        </select>
      )}
      <button
        disabled={busy}
        onClick={async () => {
          if (!(await save())) return;
          try {
            const copy = await api<{
              id: string;
            }>(`/pages/${pageId}/duplicate`, { method: "POST", body: "{}" });
            await switchPage(copy.id);
          } catch (e) {
            notify((e as Error).message, true);
          }
        }}
      >
        {t("Sayfayı çoğalt")}
      </button>
      {assign && (
        <AssignmentDialog
          page={assign}
          store={store}
          catalog={catalog}
          close={() => setAssign(null)}
          saved={() => {
            notify(t("Atamalar kaydedildi; güncel sayfa yeniden açılıyor."));
            void switchPage(pageId);
          }}
        />
      )}
    </nav>
  );
}
