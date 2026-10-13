import { getUiLanguage, t } from "./i18n.ts";
import { useDraggable } from "@dnd-kit/core";
import { ChevronDown, MousePointer2, Plus, Search } from "lucide-react";
import { blockIcons } from "./icons";
import { groups, labels, type Kind } from "./model";

function PaletteItem({
  kind,
  columns,
  onAdd,
}: {
  kind: Kind;
  columns?: number;
  onAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${kind}:${columns ?? "default"}`,
    data: { kind, columns },
  });
  const Icon = blockIcons[kind];
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`palette-card ${isDragging ? "dragging" : ""}`}
      onClick={onAdd}
      title={t("{p0} ekle veya sürükle", { p0: labels[kind] })}
      data-palette={
        kind !== "row" || columns === undefined || columns === 2
          ? kind
          : undefined
      }
      data-row-columns={columns}
    >
      <span className="palette-visual">
        {kind === "row" && columns !== undefined ? (
          <span className="row-visual">
            {columns ? (
              Array.from({ length: columns }, (_, i) => <i key={i} />)
            ) : (
              <>
                <i className="mini-icon" />
                <i className="mini-text" />
              </>
            )}
          </span>
        ) : (
          <Icon size={22} strokeWidth={1.5} />
        )}
      </span>
      <span>
        {labels[kind]}
        {kind === "row" && columns !== undefined && (
          <small>
            {columns === 1
              ? t("Tek kolon")
              : columns
                ? `${columns} ${t("columns")}`
                : t("Inline")}
          </small>
        )}
      </span>
      <Plus size={11} className="palette-add" />
    </button>
  );
}

/** Draggable element catalogue grouped like a commerce page builder. */
export function ElementLibrary({
  search,
  setSearch,
  add,
}: {
  search: string;
  setSearch: (value: string) => void;
  add: (kind: Kind, columns?: number) => void;
}) {
  const query = search.trim().toLocaleLowerCase(getUiLanguage());
  const matches = (kind: Kind) =>
    !query || labels[kind].toLocaleLowerCase(getUiLanguage()).includes(query);
  const visible = groups
    .map((group) => ({ ...group, kinds: group.kinds.filter(matches) }))
    .filter((group) => group.kinds.length);
  return (
    <>
      <label className="library-search">
        <Search size={14} />
        <input
          aria-label={t("Öğe ara")}
          placeholder={t("Öğe ara…")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setSearch("");
          }}
        />
        <span>⌘ K</span>
      </label>
      <div className="library-scroll element-library">
        {visible.map((group) => (
          <details open className="palette-group" key={group.name}>
            <summary>
              <span>
                {group.name}
                <small>{group.kinds.length}</small>
              </span>
              <ChevronDown size={12} />
            </summary>
            <div className="palette-grid">
              {group.kinds.includes("row") &&
                [0, 1, 2, 3, 4].map((columns) => (
                  <PaletteItem
                    key={`row-${columns}`}
                    kind="row"
                    columns={columns}
                    onAdd={() => add("row", columns)}
                  />
                ))}
              {group.kinds
                .filter((kind) => kind !== "row")
                .map((kind) => (
                  <PaletteItem key={kind} kind={kind} onAdd={() => add(kind)} />
                ))}
            </div>
          </details>
        ))}
        {!visible.length && (
          <p className="setting-help">{t("Eşleşen öğe bulunamadı.")}</p>
        )}
      </div>
      <div className="library-tip">
        <MousePointer2 size={15} />
        <p>
          {t("Öğeyi sürükle veya tıklayarak ekle.")}
          <br />
          <span>{t("Metne çift tıkla ve yazmaya başla.")}</span>
        </p>
      </div>
    </>
  );
}
