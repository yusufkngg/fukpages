import { t } from "./i18n.ts";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  Copy,
  Files,
  FolderKanban,
  Link2,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { api } from "./api";
import { AssignmentDialog } from "./PageManager";
import {
  pageNames,
  type PageSummary,
  type Store,
  type PageType,
} from "./model";
import type { Catalog } from "./Commerce";

const pageOrder: PageType[] = [
  "home",
  "product",
  "collection",
  "landing",
  "page",
  "blog",
  "article",
  "cart",
  "search",
];

export function usePageOverview(
  storeId: string,
  pageId: string,
  notify: (m: string, e?: boolean) => void,
) {
  const [pages, setPages] = useState<PageSummary[]>([]);
  useEffect(() => {
    let active = true;
    api<PageSummary[]>(`/stores/${storeId}/page-overview`)
      .then((p) => {
        if (active) setPages(p);
      })
      .catch((e) => notify(e.message, true));
    return () => {
      active = false;
    };
  }, [storeId, pageId, notify]);
  return pages;
}

/** Compact page picker that lives in the editor top bar. */
export function PageSwitcher({
  pages,
  pageId,
  busy,
  switchPage,
}: {
  pages: PageSummary[];
  pageId: string;
  busy: boolean;
  switchPage: (id: string) => Promise<void>;
}) {
  const current = pages.find((p) => p.id === pageId);
  return (
    <label className="page-switcher" title={t("Sayfalar arasında geçiş")}>
      <Files size={14} />
      <span>
        {t("Sayfalar")}
        {pages.length > 0 && <small>{pages.length}</small>}
      </span>
      <ChevronDown size={13} />
      <select
        aria-label={t("Sayfalar arasında geçiş")}
        value={pageId}
        disabled={busy}
        onChange={(e) => void switchPage(e.target.value)}
      >
        {pageOrder.map((type) => (
          <optgroup key={type} label={pageNames[type]}>
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
    </label>
  );
}

/** Product or collection used to fill dynamic blocks while editing. */
export function PreviewResourcePicker({
  type,
  catalog,
  resource,
  onResource,
}: {
  type: PageType;
  catalog: Catalog;
  resource: string;
  onResource: (id: string) => void;
}) {
  if (!["product", "collection"].includes(type)) return null;
  const items = type === "product" ? catalog.products : catalog.collections;
  return (
    <label className="preview-resource">
      <span>
        {type === "product" ? t("Önizleme ürünü") : t("Önizleme koleksiyonu")}
      </span>
      <select
        aria-label={
          type === "product" ? t("Önizleme ürünü") : t("Önizleme koleksiyonu")
        }
        value={resource || items[0]?.id || ""}
        onChange={(e) => onResource(e.target.value)}
      >
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title}
          </option>
        ))}
      </select>
    </label>
  );
}

export interface MenuAction {
  id: string;
  icon: LucideIcon;
  label: string;
  run: () => void;
}

/** Page and design actions collected behind the top-bar overflow button. */
export function EditorMenu({
  pageId,
  pages,
  store,
  catalog,
  busy,
  switchPage,
  manage,
  save,
  notify,
  designActions,
  footer,
}: {
  pageId: string;
  pages: PageSummary[];
  store: Store;
  catalog: Catalog;
  busy: boolean;
  switchPage: (id: string) => Promise<void>;
  manage: () => Promise<void>;
  save: () => Promise<boolean>;
  notify: (m: string, e?: boolean) => void;
  designActions: MenuAction[];
  footer?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [assign, setAssign] = useState<PageSummary | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const current = pages.find((p) => p.id === pageId);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: Event) => {
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        // Close only this menu; keep the canvas selection.
        event.stopPropagation();
      }
      if (
        event.type === "pointerdown" &&
        event.target instanceof Node &&
        root.current?.contains(event.target)
      )
        return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("keydown", dismiss, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("keydown", dismiss, true);
    };
  }, [open]);
  const run = (action: () => unknown) => {
    setOpen(false);
    void action();
  };
  return (
    <div className="more-menu" ref={root}>
      <button
        className="icon-button"
        aria-label={t("Tasarım işlemleri")}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(!open)}
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="dropdown-menu editor-menu" role="menu">
          <p className="menu-heading">
            {current
              ? `${pageNames[current.type]} · ${current.name}`
              : t("Sayfa")}
          </p>
          <button role="menuitem" disabled={busy} onClick={() => run(manage)}>
            <FolderKanban size={14} />
            {t("Sayfa yönetimi")}
          </button>
          <button
            role="menuitem"
            disabled={busy}
            onClick={() =>
              run(async () => {
                if (!(await save())) return;
                try {
                  const copy = await api<{
                    id: string;
                  }>(`/pages/${pageId}/duplicate`, {
                    method: "POST",
                    body: "{}",
                  });
                  await switchPage(copy.id);
                } catch (e) {
                  notify((e as Error).message, true);
                }
              })
            }
          >
            <Copy size={14} />
            {t("Sayfayı çoğalt")}
          </button>
          {current &&
            ["home", "product", "collection"].includes(current.type) && (
              <button
                role="menuitem"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    if (await save()) setAssign(current);
                  })
                }
              >
                <Link2 size={14} />
                {t("Ürün / koleksiyon atamaları")}
                <small>{current.assignments?.length || 0}</small>
              </button>
            )}
          <hr />
          <p className="menu-heading">{t("Tasarım araçları")}</p>
          {designActions.map(({ id, icon: Icon, label, run: action }) => (
            <button role="menuitem" key={id} onClick={() => run(action)}>
              <Icon size={14} />
              {label}
            </button>
          ))}
          {footer}
        </div>
      )}
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
    </div>
  );
}
