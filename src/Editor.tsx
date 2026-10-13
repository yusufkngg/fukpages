import { getUiLocale, getUiLanguage, t } from "./i18n.ts";
import { FloatingPanel } from "./FloatingPanel";
import { UiSettingsButton } from "./UiSettings";
import { ColumnHandles, resizeColumns } from "./ColumnHandles";
import { SectionDesign } from "./SectionDesign";
import { PageBar } from "./PageBar";
import { PanelSplitter, usePanelWidths } from "./PanelSplitter";
import { ElementHandles, useElementGesture } from "./ElementHandles";
import {
  cssNumber,
  freeHeight,
  placedStyle,
  setFreeLayout,
} from "./freePlacement";
import { normalizeLink, navigationActions } from "./links";
import { ConflictDialog, type DraftConflict } from "./ConflictDialog";
import {
  draftKey,
  readDraft,
  writeDraft,
  downloadDocument,
  type LocalDraft,
} from "./draftRecovery";
import { Dialog, scrollBehavior } from "./Dialog";
import { TeamPanel } from "./TeamPanel";
import { GrowthPanel } from "./GrowthPanel";
import { CatalogPanel, type Catalog } from "./Commerce";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  GripVertical,
  Layers,
  LayoutTemplate,
  Loader2,
  Store as StoreIcon,
  LockKeyhole,
  Monitor,
  MoreHorizontal,
  MousePointer2,
  Plus,
  Redo2,
  Search,
  ShieldCheck,
  Smartphone,
  Tablet,
  Trash2,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { ApiError, api, json, uploadFiles } from "./api";
import { MediaPanel } from "./MediaPanel";
import { BrandPanel } from "./BrandPanel";
import {
  StudioProvider,
  brandStyle,
  assetUrl,
  defaultBrand,
  type Asset,
  type Brand,
} from "./studio";
import {
  isLocked,
  rootSelection,
  groupSelection,
  ungroupSelection,
  clipboardBlocks,
  pasteBlocks,
} from "./editorCommands";
import { SelectionTools } from "./SelectionTools";
import { WorkflowPanel } from "./WorkflowPanel";
import { BlockContent, PageRenderer, richHtml } from "./Renderer";
import { Inspector } from "./Inspector";
import { SectionLibrary } from "./SectionLibrary";
import {
  createSectionPreset,
  enclosingSection,
  fromSavedSection,
  insertSection,
  type SavedSection,
} from "./sections";
import {
  ThemePanel,
  NativeThemeInspector,
  NativeThemeSection,
} from "./ThemePanel";
import { templateForPage, type ThemeSnapshot, type ThemeStatus } from "./theme";
import { blockIcons } from "./icons";
import {
  cloneBlock,
  createBlock,
  deviceNames,
  effectiveStyle,
  findBlock,
  firstHeading,
  groups,
  insertBlock,
  isContainer,
  labels,
  locateBlock,
  mapBlock,
  moveBlock,
  pageNames,
  removeBlock,
  starterDocument,
  widths,
  type Block,
  type Device,
  type Kind,
  type PageDocument,
  type Store,
} from "./model";
interface PageResponse {
  id: string;
  document: PageDocument;
  assignments?: string[];
  version: number;
  themeSnapshot?: ThemeSnapshot | null;
}
interface EditorProps {
  pageId: string;
  role?: "owner" | "editor";
  store: Store;
  back: () => void;
  notify: (message: string, error?: boolean) => void;
  openPage: (id: string) => void;
}
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
          <Icon size={32} strokeWidth={1.5} />
        )}
      </span>
      <span>
        {labels[kind]}
        {kind === "row" && columns !== undefined && (
          <small>{columns ? `${columns} ${t("columns")}` : t("Inline")}</small>
        )}
      </span>
      <Plus size={11} className="palette-add" />
    </button>
  );
}
function NodeSlot({
  nodeId,
  parent,
  index,
  side,
  context = "canvas",
  dragging,
  horizontal = false,
}: {
  nodeId: string;
  parent: string | null;
  index: number;
  side: "before" | "after";
  context?: string;
  dragging: boolean;
  horizontal?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${context}:${nodeId}:${side}`,
    data: { parent, index },
    disabled: !dragging,
  });
  return (
    <div
      ref={setNodeRef}
      className={`node-slot ${side} ${horizontal ? "horizontal" : ""} ${dragging ? "enabled" : ""} ${isOver ? "over" : ""}`}
      data-slot={`${parent ?? "root"}:${index}`}
    />
  );
}
function CanvasNode({
  node,
  parent = null,
  index = 0,
  horizontalParent = false,
  device,
  selected,
  select,
  updateHtml,
  duplicate,
  remove,
  dragging,
  resizeColumn,
  parentFree = false,
  geometry,
  inheritedLocked = false,
}: {
  node: Block;
  parent?: string | null;
  index?: number;
  horizontalParent?: boolean;
  device: Device;
  selected: string | null;
  select: (id: string, multi?: boolean) => void;
  updateHtml: (id: string, value: string) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  dragging: boolean;
  resizeColumn?: (id: string, value: number, index?: number) => void;
  parentFree?: boolean;
  geometry: (id: string, styles: Record<string, string>, free: boolean) => void;
  inheritedLocked?: boolean;
}) {
  const locked = inheritedLocked || !!node.props.locked;
  const elementRef = useRef<HTMLDivElement | null>(null);
  const gesture = useElementGesture(
    () => elementRef.current,
    parentFree,
    (box, mode) => {
      const styles: Record<string, string> = {};
      if (mode === "move")
        Object.assign(styles, { left: box.left + "%", top: box.top + "px" });
      else {
        if (mode.includes("e"))
          styles.width = box.width + (parentFree ? "%" : "px");
        if (mode.includes("s")) styles.height = box.height + "px";
      }
      geometry(node.id, styles, parentFree);
    },
  );
  const drag = useDraggable({
    id: `node:${node.id}`,
    data: { nodeId: node.id },
    disabled: locked || parentFree,
  });
  const drop = useDroppable({
    id: `inside:${node.id}`,
    data: { parent: node.id, index: node.children.length },
    disabled: locked || !isContainer(node.kind),
  });
  if (node.hidden[device]) return null;
  const style: CSSProperties = {
    ...brandStyle(node, device),
    ...placedStyle(node, device, parentFree),
    ...(node.props.backgroundSrc
      ? {
          backgroundImage: `linear-gradient(${String(node.props.backgroundOverlay || "#00000000")},${String(node.props.backgroundOverlay || "#00000000")}),url("${assetUrl(node.props.backgroundSrc)}")`,
          backgroundSize: "cover",
        }
      : {}),
  };
  const horizontal =
    style.display === "flex" &&
    String(style.flexDirection ?? "row").startsWith("row");
  return (
    <div
      ref={(element) => {
        elementRef.current = element;
        drag.setNodeRef(element);
        drop.setNodeRef(element);
      }}
      data-node-id={node.id}
      data-kind={node.kind}
      data-block={node.id}
      data-free-placed={parentFree || undefined}
      tabIndex={selected === node.id ? 0 : -1}
      aria-label={`${node.name} · ${labels[node.kind]}`}
      onFocus={(event) => {
        if (event.target === event.currentTarget) select(node.id);
      }}
      className={`content-block editor-block ${selected === node.id ? "selected" : ""} ${drag.isDragging ? "moving" : ""} ${drop.isOver ? "drop-inside" : ""}`}
      style={style}
      onPointerDown={(event) => {
        if (
          parentFree &&
          !locked &&
          !(event.target as HTMLElement).closest(
            'button,input,textarea,select,[contenteditable="true"]',
          )
        ) {
          select(node.id);
          gesture.start(event, "move");
        }
      }}
      onPointerMove={gesture.move}
      onPointerUp={gesture.stop}
      onPointerCancel={gesture.stop}
      onClick={(event) => {
        event.stopPropagation();
        if (
          !(event.target as HTMLElement).closest(
            'input,textarea,select,[contenteditable="true"]',
          )
        )
          event.currentTarget.focus({ preventScroll: true });
        select(node.id, event.shiftKey || event.ctrlKey || event.metaKey);
      }}
    >
      {selected === node.id && (
        <div className="block-toolbar">
          <span>{node.name}</span>
          <button
            title={t("Öğeyi sürükle")}
            disabled={locked}
            {...(!parentFree ? drag.attributes : {})}
            {...(!parentFree ? drag.listeners : {})}
            onPointerDown={(e) =>
              parentFree
                ? gesture.start(e, "move")
                : drag.listeners?.onPointerDown?.(e)
            }
            onPointerMove={parentFree ? gesture.move : undefined}
            onPointerUp={parentFree ? gesture.stop : undefined}
          >
            <GripVertical size={13} />
          </button>
          <button
            title={t("Öğeyi çoğalt")}
            onClick={(event) => {
              event.stopPropagation();
              duplicate(node.id);
            }}
          >
            <Copy size={12} />
          </button>
          <button
            title={t("Öğeyi sil")}
            onClick={(event) => {
              event.stopPropagation();
              remove(node.id);
            }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
      <NodeSlot
        nodeId={node.id}
        parent={parent}
        index={index}
        side="before"
        dragging={dragging}
        horizontal={horizontalParent}
      />
      <NodeSlot
        nodeId={node.id}
        parent={parent}
        index={index + 1}
        side="after"
        dragging={dragging}
        horizontal={horizontalParent}
      />
      {selected === node.id &&
        node.kind === "row" &&
        node.children.length >= 2 &&
        !locked &&
        !freeHeight(node, device) &&
        horizontal && (
          <ColumnHandles
            rowRef={elementRef}
            count={node.children.length}
            resize={(value, index) => resizeColumn?.(node.id, value, index)}
          />
        )}
      <BlockContent
        node={node}
        device={device}
        editable={!node.props.locked}
        onHtml={(html) => updateHtml(node.id, html)}
      >
        {isContainer(node.kind) && (
          <>
            {node.children.map((child, index) => (
              <CanvasNode
                key={child.id}
                node={child}
                parent={node.id}
                index={index}
                horizontalParent={horizontal}
                device={device}
                selected={selected}
                select={select}
                updateHtml={updateHtml}
                duplicate={duplicate}
                remove={remove}
                dragging={dragging}
                resizeColumn={resizeColumn}
                geometry={geometry}
                parentFree={!!freeHeight(node, device)}
                inheritedLocked={locked}
              />
            ))}
            {!node.children.length && (
              <div className="empty-container">
                <Plus size={16} />
                <span>{t("Öğeyi buraya bırak")}</span>
              </div>
            )}
          </>
        )}
      </BlockContent>
      {selected === node.id &&
        !locked &&
        !["section", "row"].includes(node.kind) && (
          <ElementHandles gesture={gesture} />
        )}
    </div>
  );
}
function Layer({
  node,
  parent = null,
  index = 0,
  depth,
  selected,
  select,
  dragging,
  search = "",
  visibility,
  device,
  inheritedLocked = false,
}: {
  node: Block;
  parent?: string | null;
  index?: number;
  depth: number;
  selected: string | null;
  select: (id: string, multi?: boolean) => void;
  dragging: boolean;
  search?: string;
  visibility: (id: string) => void;
  device: Device;
  inheritedLocked?: boolean;
}) {
  const locked = inheritedLocked || !!node.props.locked;
  const [open, setOpen] = useState(depth > 0);
  const expanded = open || Boolean(search.trim());
  const drag = useDraggable({
    id: `layer:${node.id}`,
    data: { nodeId: node.id },
    disabled: locked,
  });
  const drop = useDroppable({
    id: `layer-inside:${node.id}`,
    data: { parent: node.id, index: node.children.length },
    disabled: !isContainer(node.kind),
  });
  const Icon = blockIcons[node.kind];
  return (
    <>
      <div
        ref={drop.setNodeRef}
        data-layer-id={node.id}
        className={`layer-row ${selected === node.id ? "active" : ""} ${drop.isOver ? "drop-active" : ""}`}
        style={{ paddingLeft: depth * 14 + 10 }}
      >
        <NodeSlot
          context="layers"
          nodeId={node.id}
          parent={parent}
          index={index}
          side="before"
          dragging={dragging}
        />
        <NodeSlot
          context="layers"
          nodeId={node.id}
          parent={parent}
          index={index + 1}
          side="after"
          dragging={dragging}
        />
        <button
          className="layer-toggle"
          aria-label={t("Katmanı aç veya kapat")}
          aria-expanded={expanded}
          onClick={() => setOpen(!open)}
        >
          {isContainer(node.kind) ? (
            expanded ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )
          ) : (
            <span />
          )}
        </button>
        <button
          ref={drag.setNodeRef}
          {...drag.attributes}
          {...drag.listeners}
          className="layer-select"
          onClick={(e) => select(node.id, e.shiftKey || e.ctrlKey || e.metaKey)}
        >
          <Icon size={14} />
          <span>{node.name}</span>
        </button>
        <button
          className="layer-visibility"
          disabled={locked}
          aria-label={`${t("Visibility")}: ${node.name}`}
          aria-pressed={!node.hidden[device]}
          onClick={() => visibility(node.id)}
        >
          {node.hidden[device] ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        <span className="layer-kind">
          {depth === 0 && node.kind === "section" && (
            <i className="fp-section-tag">FP</i>
          )}
          {node.hidden.mobile && "M̸"}
        </span>
      </div>
      {expanded &&
        node.children
          .filter(
            (child) =>
              !search ||
              JSON.stringify(child)
                .toLocaleLowerCase(getUiLanguage())
                .includes(search.toLocaleLowerCase(getUiLanguage())),
          )
          .map((child) => (
            <Layer
              key={child.id}
              node={child}
              parent={node.id}
              index={node.children.indexOf(child)}
              depth={depth + 1}
              selected={selected}
              select={select}
              dragging={dragging}
              search={search}

              visibility={visibility}
              device={device}
              inheritedLocked={locked}
            />
          ))}
    </>
  );
}
function EmptyPage({ add }: { add: () => void }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "empty-root",
    data: { parent: null, index: 0 },
  });
  return (
    <div
      ref={setNodeRef}
      className={`empty-page ${isOver ? "drop-inside" : ""}`}
    >
      <Plus size={32} />
      <h2>{t("İlk bölümünü ekle.")}</h2>
      <p>{t("Kütüphaneden bir öğeyi buraya sürükle.")}</p>
      <button
        onClick={(event) => {
          event.stopPropagation();
          add();
        }}
      >
        {t("Bölüm ekle")}
      </button>
    </div>
  );
}
export function Editor({
  pageId,
  store,
  back,
  notify,
  role = "owner",
  openPage,
}: EditorProps) {
  const panels = usePanelWidths();
  const [catalog, setCatalog] = useState<Catalog>({
    source: "local",
    products: [],
    collections: [],
  });
  const [previewResource, setPreviewResource] = useState("");
  const refreshCatalog = useCallback(
    async () => setCatalog(await api<Catalog>(`/stores/${store.id}/catalog`)),
    [store.id],
  );
  useEffect(() => {
    void refreshCatalog().catch((e) => notify(e.message, true));
  }, [refreshCatalog, notify]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [formDestination, setFormDestination] = useState(
    t("Webhook yapılandırılmadı"),
  );
  useEffect(() => {
    api<{
      forms: {
        webhookLabel: string;
      };
    }>(`/stores/${store.id}/integrations`)
      .then((r) => setFormDestination(r.forms.webhookLabel))
      .catch((e) => notify(e.message, true));
  }, [store.id, notify]);
  const [brand, setBrand] = useState<Brand>(defaultBrand),
    [brandVersion, setBrandVersion] = useState(0);
  const [customWidth, setCustomWidth] = useState<number | null>(null);
  const refreshAssets = useCallback(
    async () => setAssets(await api<Asset[]>(`/stores/${store.id}/assets`)),
    [store.id],
  );
  useEffect(() => {
    void refreshAssets().catch((e) => notify(e.message, true));
    api<{
      brand: Brand;
      version: number;
    }>(`/stores/${store.id}/brand`)
      .then((r) => {
        setBrand(r.brand);
        setBrandVersion(r.version);
      })
      .catch((e) => notify(e.message, true));
  }, [store.id, refreshAssets, notify]);
  const [page, setPage] = useState<PageDocument | null>(null);
  const pageRef = useRef<PageDocument | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [contentIntent, setContentIntent] = useState(0);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  useEffect(() => {
    if (!contextMenu) return;
    const dismiss = (event: Event) => {
      if (event.type === "keydown" && (event as KeyboardEvent).key !== "Escape")
        return;
      if (
        event.type === "pointerdown" &&
        event.target instanceof Element &&
        event.target.closest(".editor-context-menu")
      )
        return;
      setContextMenu(null);
    };
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("keydown", dismiss, true);
    document.addEventListener("scroll", dismiss, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("keydown", dismiss, true);
      document.removeEventListener("scroll", dismiss, true);
    };
  }, [contextMenu]);
  const selectMany = useCallback((id: string, multi = false) => {
    setSelected(id);
    setSelection((old) =>
      multi
        ? old.includes(id)
          ? old.filter((v) => v !== id)
          : [...old, id]
        : [id],
    );
  }, []);
  const [device, setDevice] = useState<Device>("desktop");
  const showNewNode = useCallback((id: string) => {
    setSelected(id);
    setSelection([id]);
    requestAnimationFrame(() => {
      const element = document.querySelector<HTMLElement>(
        `[data-node-id="${id}"]`,
      );
      element?.scrollIntoView({ block: "nearest", behavior: "auto" });
      element?.focus({ preventScroll: true });
    });
  }, []);
  const [library, setLibrary] = useState("sections");
  const [layersOpen, setLayersOpen] = useState(false);
  const [layerSearch, setLayerSearch] = useState("");
  const [savedSections, setSavedSections] = useState<SavedSection[]>([]);
  const [themeStatus, setThemeStatus] = useState<ThemeStatus>({
    configured: false,
    domain: store.domain,
    snapshot: null,
  });
  const [boundSnapshot, setBoundSnapshot] = useState<ThemeSnapshot | null>(
    null,
  );
  const [themeBusy, setThemeBusy] = useState(false);
  const [nativeSelected, setNativeSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");
  const savedRef = useRef("");
  const version = useRef(1);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState("");
  const recoveryKey = useRef("");
  const [recovery, setRecovery] = useState<LocalDraft | null>(null);
  const [conflict, setConflict] = useState<DraftConflict | null>(null),
    [conflictOpen, setConflictOpen] = useState(false);
  const [recoveryWritable, setRecoveryWritable] = useState(true);
  const persistRecovery = useCallback((document: PageDocument) => {
    if (!recoveryKey.current || !savedRef.current) return true;
    return writeDraft(recoveryKey.current, {
      document,
      base: JSON.parse(savedRef.current),
      version: version.current,
      updated: Date.now(),
    });
  }, []);
  const [tick, setTick] = useState(0);
  const [preview, setPreview] = useState(false);
  const [published, setPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [available, setAvailable] = useState(800);
  const canvasRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const past = useRef<PageDocument[]>([]),
    future = useRef<PageDocument[]>([]);
  const lastChange = useRef({ key: "", at: 0 });
  const [historyTick, setHistoryTick] = useState(0);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  useEffect(() => {
    let current = true;
    Promise.all([
      api<PageResponse>(`/pages/${pageId}`),
      api<{
        draftScope: string;
      }>("/auth/status"),
    ])
      .then(([result, status]) => {
        if (!current) return;
        pageRef.current = result.document;
        setPage(result.document);
        setPreviewResource(result.assignments?.[0] || "");
        version.current = result.version;
        const value = JSON.stringify(result.document);
        savedRef.current = value;
        setSaved(value);
        try {
          recoveryKey.current = draftKey(status.draftScope, store.id, pageId);
          const local = readDraft(recoveryKey.current);
          if (local && JSON.stringify(local.document) !== value)
            setRecovery(local);
          else localStorage.removeItem(recoveryKey.current);
        } catch {
          setRecoveryWritable(false);
        }
        setSelected(
          firstHeading(result.document.nodes) ||
            result.document.nodes[0]?.id ||
            null,
        );
        setBoundSnapshot(result.themeSnapshot ?? null);
      })
      .catch((error) => notify(error.message, true));
    return () => {
      current = false;
    };
  }, [pageId, notify]);
  const pageType = page?.type;
  useEffect(() => {
    if (!page) return;
    document.title = page.seo?.title || `${page.name} — ${store.name}`;
    return () => {
      document.title = "FukPages — Design studio";
    };
  }, [page?.name, page?.seo?.title, store.name]);
  useEffect(() => {
    if (!pageType) return;
    let active = true;
    Promise.all([
      api<SavedSection[]>(`/stores/${store.id}/sections`),
      api<ThemeStatus>(
        `/stores/${store.id}/theme?template=${encodeURIComponent(templateForPage[pageType])}`,
      ),
    ])
      .then(([sections, status]) => {
        if (!active) return;
        setSavedSections(sections);
        setThemeStatus(status);
      })
      .catch((error) => notify(error.message, true));
    return () => {
      active = false;
    };
  }, [store.id, pageType, notify]);
  useEffect(() => {
    if (library === "media" || library === "brand")
      void refreshAssets().catch((e) => notify(e.message, true));
  }, [library, refreshAssets, notify]);
  useEffect(() => {
    if (selected) {
      setNativeSelected(null);
    }
  }, [selected]);
  useEffect(() => {
    if (!canvasRef.current) return;
    const observer = new ResizeObserver((entries) =>
      setAvailable(entries[0].contentRect.width - 72),
    );
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [page]);
  const commit = useCallback(
    (change: (document: PageDocument) => PageDocument, key = "") => {
      const current = pageRef.current;
      if (!current) return;
      const next = change(current);
      if (JSON.stringify(next) === JSON.stringify(current)) return;
      const now = Date.now();
      if (
        !key ||
        lastChange.current.key !== key ||
        now - lastChange.current.at > 700
      ) {
        past.current = [...past.current.slice(-79), structuredClone(current)];
      }
      future.current = [];
      lastChange.current = { key, at: now };
      pageRef.current = next;
      setPage(next);
      setRecoveryWritable(persistRecovery(next));
      setSaveError("");
      setHistoryTick((value) => value + 1);
    },
    [persistRecovery],
  );
  const save = useCallback(async () => {
    const current = pageRef.current;
    if (!current) return false;
    const invalidLink = (nodes: Block[]): Block | undefined => {
      for (const n of nodes) {
        const raw =
          n.props.href && n.props.href !== "#"
            ? n.props.href
            : n.props.actionTarget;
        if (
          n.kind === "button" &&
          navigationActions.has(String(n.props.action || "navigate")) &&
          raw &&
          !normalizeLink(raw)
        )
          return n;
        const child = invalidLink(n.children);
        if (child) return child;
      }
    };
    const invalid = invalidLink(current.nodes);
    if (invalid) {
      setSaveError(
        t("{p0}: geçerli bir bağlantı gir. Değerin taslakta korundu.", {
          p0: invalid.name,
        }),
      );
      return false;
    }
    if (recovery) {
      notify(t("Önce kurtarılabilir yerel kopyayı seç."), true);
      return false;
    }
    if (conflict) {
      setConflict({ ...conflict, local: structuredClone(current) });
      setConflictOpen(true);
      return false;
    }
    if (savingRef.current) return false;
    const snapshot = JSON.stringify(current);
    if (snapshot === savedRef.current) return true;
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const result = await api<{
        version: number;
        document: PageDocument;
      }>(`/pages/${pageId}`, {
        method: "PUT",
        body: json({ document: current, version: version.current }),
      });
      version.current = result.version;
      const canonical = JSON.stringify(result.document);
      savedRef.current = canonical;
      setSaved(canonical);
      if (JSON.stringify(pageRef.current) === snapshot) {
        pageRef.current = result.document;
        setPage(result.document);
      }
      return true;
    } catch (error) {
      setSaveError((error as Error).message);
      setRecoveryWritable(persistRecovery(pageRef.current || current));
      if (error instanceof ApiError && error.status === 409) {
        try {
          const remote = await api<PageResponse>(`/pages/${pageId}`);
          setConflict({
            base: JSON.parse(savedRef.current),
            local: structuredClone(pageRef.current || current),
            remote: remote.document,
            version: remote.version,
          });
          setConflictOpen(true);
        } catch {
          /* Preserve the local copy while offline. */
        }
      }
      notify((error as Error).message, true);
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
      setTick((value) => value + 1);
    }
  }, [pageId, notify, recovery, conflict, persistRecovery]);
  useEffect(() => {
    if (
      !page ||
      JSON.stringify(page) === saved ||
      saveError ||
      recovery ||
      conflict
    )
      return;
    const timer = setTimeout(() => {
      void save();
    }, 1300);
    return () => clearTimeout(timer);
  }, [page, saved, save, tick, saveError, recovery, conflict]);
  useEffect(() => {
    if (!page || recovery) return;
    if (JSON.stringify(page) !== saved)
      setRecoveryWritable(persistRecovery(page));
    else if (recoveryKey.current) {
      try {
        localStorage.removeItem(recoveryKey.current);
      } catch {
        /* disabled storage */
      }
    }
  }, [page, saved, recovery, persistRecovery]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      const current = pageRef.current;
      if (current && JSON.stringify(current) !== savedRef.current) {
        persistRecovery(current);
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [persistRecovery]);
  const undo = useCallback(() => {
    if (!past.current.length || !pageRef.current) return;
    future.current.unshift(structuredClone(pageRef.current));
    const previous = past.current.pop()!;
    pageRef.current = previous;
    setPage(previous);
    lastChange.current.key = "";
    setHistoryTick((value) => value + 1);
  }, []);
  const redo = useCallback(() => {
    if (!future.current.length || !pageRef.current) return;
    past.current.push(structuredClone(pageRef.current));
    const next = future.current.shift()!;
    pageRef.current = next;
    setPage(next);
    lastChange.current.key = "";
    setHistoryTick((value) => value + 1);
  }, []);
  const duplicate = useCallback(
    (id: string) => {
      const current = pageRef.current;
      if (!current) return;
      const node = findBlock(current.nodes, id),
        where = locateBlock(current.nodes, id);
      if (!node || !where || isLocked(current.nodes, id)) return;
      const copy = cloneBlock(node);
      commit((document) => ({
        ...document,
        nodes: insertBlock(document.nodes, where.parent, where.index + 1, copy),
      }));
      setSelected(copy.id);
    },
    [commit],
  );
  const remove = useCallback(
    (id: string) => {
      if (isLocked(pageRef.current?.nodes || [], id)) {
        notify(t("Kilitli öğeyi önce aç."));
        return;
      }
      commit((document) => ({
        ...document,
        nodes: removeBlock(document.nodes, id),
      }));
      setSelected(null);
    },
    [commit],
  );
  const createElement = (kind: Kind, columns = 2) => {
    const node = createBlock(kind);
    if (kind === "row")
      node.children = Array.from({ length: columns }, () =>
        createBlock("column"),
      ).map((child) => ({
        ...child,
        styles: {
          ...child.styles,
          desktop: { ...child.styles.desktop, width: 100 / columns + "%" },
          mobile: { ...child.styles.mobile, width: "100%" },
        },
      }));
    if (kind === "row" && columns === 0)
      Object.assign(node.styles.desktop, {
        alignItems: "center",
        gap: "8px",
        flexWrap: "wrap",
        minHeight: "48px",
      });
    return node;
  };
  const prepareForParent = (node: Block, parent: string | null) => {
    const frame = parent && findBlock(pageRef.current?.nodes || [], parent);
    if (frame && freeHeight(frame, device)) {
      node.props.freePlaced = true;
      node.props.freeFlowStyles = JSON.stringify({
        [device]: { ...node.styles[device] },
      });
      Object.assign(node.styles[device], {
        position: "absolute",
        left: "5%",
        top: "16px",
        width: "40%",
      });
    }
    return node;
  };
  const changeFreeLayout = (id: string, enabled: boolean) => {
    const current = pageRef.current;
    const parent = current && findBlock(current.nodes, id);
    if (!parent || isLocked(current!.nodes, id)) return;
    const element = document.querySelector<HTMLElement>(
      `[data-node-id="${id}"]`,
    );
    const geometry: Record<
      string,
      {
        left: number;
        top: number;
        width: number;
        height: number;
      }
    > = {};
    if (element && enabled) {
      const wrapper = element.querySelector<HTMLElement>(
        ":scope > .section-content, :scope > .free-canvas",
      );
      const frame = wrapper || element,
        rect = frame.getBoundingClientRect(),
        scale = rect.width / (frame.offsetWidth || rect.width) || 1;
      const style = getComputedStyle(frame),
        pl = wrapper ? 0 : parseFloat(style.paddingLeft) || 0,
        pr = wrapper ? 0 : parseFloat(style.paddingRight) || 0,
        pt = wrapper ? 0 : parseFloat(style.paddingTop) || 0;
      const width = frame.clientWidth - pl - pr;
      parent.children.forEach((child) => {
        const childEl = element.querySelector<HTMLElement>(
          `[data-node-id="${child.id}"]`,
        );
        if (!childEl || child.hidden[device]) return;
        const box = childEl.getBoundingClientRect();
        geometry[child.id] = {
          left: Math.max(
            0,
            (((box.left - rect.left) / scale - pl) / width) * 100,
          ),
          top: Math.max(0, (box.top - rect.top) / scale - pt),
          width: Math.min(100, (box.width / scale / width) * 100),
          height: box.height / scale,
        };
      });
    }
    commit((d) => ({
      ...d,
      nodes: mapBlock(d.nodes, id, (n) =>
        setFreeLayout(n, device, enabled, geometry),
      ),
    }));
  };
  const add = (kind: Kind, columns?: number) => {
    if (!pageRef.current) return;
    const node = createElement(kind, columns),
      selectedNode = findBlock(pageRef.current.nodes, selected);
    const parent =
      selectedNode && isContainer(selectedNode.kind)
        ? selectedNode.id
        : selected
          ? (locateBlock(pageRef.current.nodes, selected)?.parent ?? null)
          : null;
    const siblings = parent
      ? (findBlock(pageRef.current.nodes, parent)?.children ?? [])
      : pageRef.current.nodes;
    prepareForParent(node, parent);
    commit((document) => ({
      ...document,
      nodes: insertBlock(document.nodes, parent, siblings.length, node),
    }));
    showNewNode(node.id);
    notify(t("Added {p0}", { p0: labels[kind] }));
  };
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing =
        target.matches("input,textarea,select") || target.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setLibrary("blocks");
        requestAnimationFrame(() =>
          document
            .querySelector<HTMLInputElement>(".library-search input")
            ?.focus(),
        );
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (library === "brand" && !target.closest(".inspector-container"))
          document
            .querySelector<HTMLButtonElement>("[data-global-style-save]")
            ?.click();
        else void save();
        return;
      }
      if (typing) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        const ids = pageRef.current?.nodes.map((n) => n.id) || [];
        setSelection(ids);
        setSelected(ids[0] || null);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "g") {
        event.preventDefault();
        command(event.shiftKey ? "ungroup" : "group");
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "d" &&
        selected
      ) {
        event.preventDefault();
        duplicate(selected);
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selected) {
        event.preventDefault();
        const ids = rootSelection(
          pageRef.current?.nodes || [],
          selection.includes(selected) ? selection : [selected],
        );
        if (ids.length > 1) {
          const movable = ids.filter(
            (id) => !isLocked(pageRef.current?.nodes || [], id),
          );
          commit((d) => ({
            ...d,
            nodes: movable.reduce(
              (nodes, id) => removeBlock(nodes, id),
              d.nodes,
            ),
          }));
          setSelection([]);
          setSelected(null);
        } else remove(selected);
      }
      if (
        selected &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
      ) {
        const current = pageRef.current,
          where = current && locateBlock(current.nodes, selected);
        const parent =
          where?.parent && findBlock(current?.nodes || [], where.parent);
        if (
          current &&
          parent &&
          freeHeight(parent, device) &&
          !isLocked(current.nodes, selected)
        ) {
          event.preventDefault();
          const element = document.querySelector<HTMLElement>(
              `[data-node-id="${selected}"]`,
            ),
            frame = element?.parentElement;
          if (!element || !frame) return;
          const r = element.getBoundingClientRect(),
            f = frame.getBoundingClientRect(),
            scale = f.width / frame.clientWidth,
            step = event.shiftKey ? 10 : 1;
          const left = Math.max(
            0,
            Math.min(
              frame.clientWidth - r.width / scale,
              (r.left - f.left) / scale +
                (event.key === "ArrowRight"
                  ? step
                  : event.key === "ArrowLeft"
                    ? -step
                    : 0),
            ),
          );
          const top = Math.max(
            0,
            Math.min(
              frame.clientHeight - r.height / scale,
              (r.top - f.top) / scale +
                (event.key === "ArrowDown"
                  ? step
                  : event.key === "ArrowUp"
                    ? -step
                    : 0),
            ),
          );
          commit(
            (d) => ({
              ...d,
              nodes: mapBlock(d.nodes, selected, (n) => ({
                ...n,
                props: {
                  ...n.props,
                  freePlaced: true,
                  ...(!n.props.freePlaced
                    ? {
                        freeFlowStyles: JSON.stringify({
                          [device]: n.styles[device],
                        }),
                      }
                    : {}),
                },
                styles: {
                  ...n.styles,
                  [device]: {
                    ...n.styles[device],
                    position: "absolute",
                    left: cssNumber((left / frame.clientWidth) * 100) + "%",
                    top: cssNumber(top) + "px",
                  },
                },
              })),
            }),
            `nudge:${selected}:${device}`,
          );
          return;
        }
      }
      if (selected && ["ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        const current = pageRef.current,
          where = current && locateBlock(current.nodes, selected);
        if (current && where && !isLocked(current.nodes, selected)) {
          const direction = event.key === "ArrowDown" ? 2 : -1;
          commit((d) => ({
            ...d,
            nodes: moveBlock(
              d.nodes,
              selected,
              where.parent,
              Math.max(0, where.index + direction),
            ),
          }));
        }
      }
      if (event.key === "Escape") {
        setSelected(null);
        setPreview(false);
        setMenu(false);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [
    selected,
    selection,
    library,
    undo,
    redo,
    duplicate,
    remove,
    save,
    device,
    commit,
  ]);
  const addAsset = useCallback(
    (asset: Asset, mode = "replace", anchor = selected) => {
      if (asset.type !== "image") return;
      const current = pageRef.current;
      if (!current) return;
      const old = findBlock(current.nodes, anchor);
      if (old && isLocked(current.nodes, old.id)) {
        notify(t("Hedef öğe kilitli."), true);
        return;
      }
      if (mode === "background" && old) {
        commit((d) => ({
          ...d,
          nodes: mapBlock(d.nodes, old.id, (n) => ({
            ...n,
            props: { ...n.props, backgroundSrc: asset.url },
          })),
        }));
        return;
      }
      if (mode === "mobile" && old?.kind === "image") {
        commit((d) => ({
          ...d,
          nodes: mapBlock(d.nodes, old.id, (n) => ({
            ...n,
            props: { ...n.props, mobileSrc: asset.url },
          })),
        }));
        return;
      }
      if (mode === "mobile") {
        notify(t("Önce mobil görsel eklenecek öğeyi seç."), true);
        return;
      }
      if (mode !== "add" && old?.kind === "image" && !old.props.locked) {
        commit((d) => ({
          ...d,
          nodes: mapBlock(d.nodes, old.id, (n) => ({
            ...n,
            props: { ...n.props, src: asset.url, alt: asset.name },
          })),
        }));
      } else {
        const image = createBlock("image");
        image.props.src = asset.url;
        image.props.alt = asset.name;
        const where = old && locateBlock(current.nodes, old.id);
        const parent =
          old && isContainer(old.kind) ? old.id : where?.parent || null;
        const siblings = parent
          ? findBlock(current.nodes, parent)?.children || []
          : current.nodes;
        prepareForParent(image, parent);
        commit((d) => ({
          ...d,
          nodes: insertBlock(
            d.nodes,
            parent,
            old && !isContainer(old.kind) && where
              ? where.index + 1
              : siblings.length,
            image,
          ),
        }));
        showNewNode(image.id);
        return image.id;
      }
    },
    [commit, selected, device, notify],
  );
  async function dropFiles(files: File[]) {
    try {
      const r = await uploadFiles(
        `/stores/${store.id}/assets`,
        files,
        { type: "image" },
        () => {},
      );
      let anchor = selected;
      for (const result of r.results)
        if (result.ok && result.asset)
          anchor = addAsset(result.asset, "add", anchor) || anchor;
        else notify(result.error || t("Görsel yüklenemedi."), true);
      await refreshAssets();
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  useEffect(() => {
    const typing = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      !!target.closest('input,textarea,select,[contenteditable="true"]');
    const copy = (e: ClipboardEvent) => {
      if (typing(e.target) || !selected || window.getSelection()?.toString())
        return;
      const current = pageRef.current;
      if (!current) return;
      const ids = rootSelection(
        current.nodes,
        selection.includes(selected) ? selection : [selected],
      );
      if (e.type === "cut" && ids.some((id) => isLocked(current.nodes, id))) {
        e.preventDefault();
        notify(t("Kilitli öğeyi önce aç."), true);
        return;
      }
      const blocks = clipboardBlocks(current, ids);
      if (!blocks.length) return;
      e.preventDefault();
      const payload = JSON.stringify({
        format: "fukpages-blocks",
        version: 1,
        operation: e.type === "cut" ? "cut" : "copy",
        sourcePageId: pageId,
        blocks,
      });
      if (!e.clipboardData || payload.length > 1024 * 1024) {
        notify(t("Kopyalanan içerik çok büyük."), true);
        return;
      }
      e.clipboardData.setData("text/plain", payload);
      e.clipboardData?.setData("application/x-fukpages-blocks", payload);
      try {
        localStorage.setItem("fp-block-clipboard", JSON.stringify(blocks));
      } catch {}
      if (e.type === "cut") {
        const parent = locateBlock(current.nodes, selected)?.parent || null;
        commit((d) => ({
          ...d,
          nodes: ids.reduce((nodes, id) => removeBlock(nodes, id), d.nodes),
        }));
        setSelected(parent);
        setSelection(parent ? [parent] : []);
        notify(t("Element cut. Paste with Ctrl+V."));
      } else notify(t("Öğe kopyalandı. Ctrl+V ile yapıştırabilirsin."));
    };
    const paste = (e: ClipboardEvent) => {
      if (typing(e.target)) return;
      const text =
        e.clipboardData?.getData("application/x-fukpages-blocks") ||
        e.clipboardData?.getData("text/plain") ||
        "";
      if (text.includes('"fukpages-blocks"')) {
        e.preventDefault();
        void (async () => {
          try {
            if (text.length > 1024 * 1024)
              throw new Error(t("Kopyalanan içerik çok büyük."));
            const data = JSON.parse(text);
            if (
              data.format !== "fukpages-blocks" ||
              data.version !== 1 ||
              !Array.isArray(data.blocks)
            )
              throw new Error(t("Geçersiz pano içeriği."));
            const current = pageRef.current;
            if (!current) return;
            const valid = await api<{
              document: PageDocument;
            }>("/documents/validate", {
              method: "POST",
              body: json({ document: { ...current, nodes: data.blocks } }),
            });
            const latest = pageRef.current!;
            const anchor = findBlock(latest.nodes, selected),
              parent =
                anchor && isContainer(anchor.kind)
                  ? anchor.id
                  : locateBlock(latest.nodes, selected || "")?.parent || null;
            if (parent && isLocked(latest.nodes, parent))
              throw new Error(t("Hedef kilitli."));
            const allIds = (nodes: Block[]): string[] =>
              nodes.flatMap((n) => [n.id, ...allIds(n.children)]);
            const moved =
              data.operation === "cut" &&
              data.sourcePageId === pageId &&
              allIds(valid.document.nodes).every(
                (id) => !findBlock(latest.nodes, id),
              );
            const copied = moved
              ? {
                  page: {
                    ...latest,
                    nodes: valid.document.nodes.reduce(
                      (nodes, n) =>
                        insertBlock(
                          nodes,
                          parent,
                          (parent ? findBlock(nodes, parent)?.children : nodes)
                            ?.length || 0,
                          n,
                        ),
                      latest.nodes,
                    ),
                  },
                  ids: valid.document.nodes.map((n) => n.id),
                }
              : pasteBlocks(latest, valid.document.nodes, parent);
            commit(() => copied.page);
            setSelection(copied.ids);
            setSelected(copied.ids[0] || null);
            notify(t("Kopyalanan öğeler eklendi."));
          } catch (error) {
            notify((error as Error).message, true);
          }
        })();
        return;
      }
      const files = [...(e.clipboardData?.items || [])]
        .filter((i) => i.type.startsWith("image/"))
        .map((i) => i.getAsFile())
        .filter(Boolean) as File[];
      if (files.length) {
        e.preventDefault();
        void dropFiles(files);
        return;
      }
      const html = e.clipboardData?.getData("text/html") || "";
      const url = html
        ? new DOMParser()
            .parseFromString(html, "text/html")
            .querySelector("img")
            ?.getAttribute("src") || ""
        : /\.(png|jpe?g|webp|gif|avif|svg)([?#]|$)/i.test(text.trim())
          ? text.trim()
          : "";
      if (!url) return;
      e.preventDefault();
      void (async () => {
        try {
          if (/^data:image\/(png|jpeg|webp|gif|avif);base64,/i.test(url)) {
            if (url.length > 5 * 1024 * 1024)
              throw new Error(t("Panodaki görsel 4 MB sınırını aşıyor."));
            const [prefix, data] = url.split(","),
              bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
            await dropFiles([
              new File(
                [bytes],
                "pano-gorseli." + prefix.split("/")[1].split(";")[0],
                { type: prefix.slice(5).split(";")[0] },
              ),
            ]);
          } else {
            const localStatic = new URL(url, location.origin);
            const existing = assets.find(
              (a) =>
                a.type === "image" &&
                (a.url === url || new URL(a.url, location.origin).href === url),
            );
            if (existing) addAsset(existing, "add");
            else if (
              localStatic.origin === location.origin &&
              localStatic.pathname.startsWith("/assets/")
            ) {
              const current = pageRef.current!;
              const node = createBlock("image");
              node.props.src = localStatic.pathname;
              const where = selected && locateBlock(current.nodes, selected),
                parent = (where && where.parent) || null;
              commit((p) => ({
                ...p,
                nodes: insertBlock(
                  p.nodes,
                  parent,
                  where ? where.index + 1 : p.nodes.length,
                  prepareForParent(node, parent),
                ),
              }));
              setSelected(node.id);
            } else {
              const asset = await api<Asset>(
                `/stores/${store.id}/assets/import`,
                { method: "POST", body: json({ url }) },
              );
              addAsset(asset, "add");
              await refreshAssets();
            }
          }
        } catch (error) {
          notify((error as Error).message, true);
        }
      })();
    };
    window.addEventListener("copy", copy);
    window.addEventListener("cut", copy);
    window.addEventListener("paste", paste);
    return () => {
      window.removeEventListener("copy", copy);
      window.removeEventListener("cut", copy);
      window.removeEventListener("paste", paste);
    };
  });
  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    const target = event.over?.data.current;
    if (!target || !pageRef.current) return;
    if (
      (target.parent && isLocked(pageRef.current.nodes, target.parent)) ||
      (event.active.data.current?.nodeId &&
        isLocked(pageRef.current.nodes, event.active.data.current.nodeId))
    ) {
      notify(t("Kilitli öğeler taşınamaz."));
      return;
    }
    const { parent, index } = target as {
      parent: string | null;
      index: number;
    };
    if (event.active.data.current?.sectionPresetId) {
      const section = createSectionPreset(
        String(event.active.data.current.sectionPresetId),
      );
      if (!section) return;
      if (!canInsertSection(section)) return;
      commit((document) => {
        if (parent) return insertSection(document, section, parent);
        const nodes = [...document.nodes];
        nodes.splice(index, 0, section);
        return { ...document, nodes };
      });
      setSelected(section.id);
    } else if (event.active.data.current?.kind) {
      const node = prepareForParent(
        createElement(
          event.active.data.current.kind as Kind,
          event.active.data.current.columns,
        ),
        parent,
      );
      commit((document) => ({
        ...document,
        nodes: insertBlock(document.nodes, parent, index, node),
      }));
      setSelected(node.id);
    } else {
      const id = String(event.active.data.current?.nodeId ?? "");
      commit((document) => ({
        ...document,
        nodes: moveBlock(document.nodes, id, parent, index),
      }));
      setSelected(id);
    }
  };
  const canInsertSection = (section: Block) => {
    if (
      pageRef.current?.themeLayout?.useShell &&
      ["header", "footer"].includes(String(section.props.sectionRole))
    ) {
      notify(
        t(
          "Header/footer temadan geliyor. Özel bir header/footer eklemek için Tema panelinden tema düzenini kapat.",
        ),
      );
      return false;
    }
    return true;
  };
  const addPreset = (id: string) => {
    const section = createSectionPreset(id);
    if (!section) return;
    if (!canInsertSection(section)) return;
    commit((document) => insertSection(document, section, selected));
    setNativeSelected(null);
    showNewNode(section.id);
    notify(
      t("{p0} eklendi; tüm alt öğeleri düzenleyebilirsin.", {
        p0: section.name,
      }),
    );
  };
  const addSaved = (saved: Block) => {
    const section = fromSavedSection(saved);
    if (!canInsertSection(section)) return;
    commit((document) => insertSection(document, section, selected));
    setNativeSelected(null);
    showNewNode(section.id);
    notify(t("Kaydedilen bölüm eklendi. Bu kopya bağımsız düzenlenir."));
  };
  const saveSection = async (name: string, synchronized = false) => {
    const document = pageRef.current;
    if (!document) return false;
    const section = enclosingSection(document, selected);
    if (!section) return false;
    try {
      const result = await api<SavedSection>(`/stores/${store.id}/sections`, {
        method: "POST",
        body: json({ name, section, synchronized }),
      });
      setSavedSections((current) => [result, ...current]);
      if (synchronized)
        commit((d) => ({
          ...d,
          nodes: mapBlock(d.nodes, section.id, (n) => ({
            ...n,
            props: {
              ...n.props,
              linkedSectionId: result.id,
              linkedVersion: "1",
            },
          })),
        }));
      notify(t("Bölüm kütüphanene kaydedildi."));
      return true;
    } catch (error) {
      notify((error as Error).message, true);
      return false;
    }
  };
  const syncSelected = async () => {
    const current = pageRef.current;
    if (!current) return;
    const section = enclosingSection(current, selected);
    if (!section?.props.linkedSectionId) return;
    try {
      if (!(await save())) return;
      const r = await api<{
        affectedPages: string[];
      }>(`/stores/${store.id}/sections/${section.props.linkedSectionId}/sync`, {
        method: "PUT",
        body: json({
          section,
          version: Number(section.props.linkedVersion || 1),
        }),
      });
      const fetched = await api<PageResponse>(`/pages/${pageId}`);
      version.current = fetched.version;
      pageRef.current = fetched.document;
      setPage(fetched.document);
      savedRef.current = JSON.stringify(fetched.document);
      setSaved(savedRef.current);
      setSavedSections(
        await api<SavedSection[]>(`/stores/${store.id}/sections`),
      );
      notify(
        t("{p0} sayfanın taslağı güncellendi. Yayınlar değişmedi.", {
          p0: r.affectedPages.length,
        }),
      );
    } catch (e) {
      notify((e as Error).message, true);
    }
  };
  const removeSaved = async (id: string) => {
    try {
      await api(`/stores/${store.id}/sections/${id}`, { method: "DELETE" });
      setSavedSections((current) => current.filter((item) => item.id !== id));
      notify(t("Kütüphane kaydı kaldırıldı; sayfalardaki kopyalar korunur."));
    } catch (error) {
      notify((error as Error).message, true);
    }
  };
  const bindTheme = (snapshot: ThemeSnapshot, useShell: boolean) => {
    setBoundSnapshot(snapshot);
    const current = pageRef.current;
    if (
      current &&
      useShell &&
      ["header", "footer"].includes(
        String(enclosingSection(current, selected)?.props.sectionRole),
      )
    ) {
      setSelected(
        firstHeading(
          current.nodes.filter(
            (node) =>
              !["header", "footer"].includes(String(node.props.sectionRole)),
          ),
        ),
      );
    }
    commit((document) => ({
      ...document,
      themeLayout: { snapshotId: snapshot.id, useShell },
    }));
    setNativeSelected(null);
  };
  const syncTheme = async () => {
    const current = pageRef.current;
    if (!current) return;
    setThemeBusy(true);
    try {
      const status = await api<ThemeStatus>(`/stores/${store.id}/theme/sync`, {
        method: "POST",
        body: json({ template: templateForPage[current.type] }),
      });
      setThemeStatus(status);
      if (current.themeLayout?.useShell && status.snapshot)
        bindTheme(status.snapshot, true);
      notify(t("Shopify bölüm sırası okundu. Özel tasarımların korunuyor."));
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      setThemeBusy(false);
    }
  };
  const saveDomain = async (domain: string) => {
    setThemeBusy(true);
    try {
      await api(`/stores/${store.id}/shopify`, {
        method: "PATCH",
        body: json({ domain }),
      });
      const current = pageRef.current;
      const status = await api<ThemeStatus>(
        `/stores/${store.id}/theme?template=${encodeURIComponent(templateForPage[current?.type ?? "landing"])}`,
      );
      if (status.domain !== themeStatus.domain) {
        setBoundSnapshot(null);
        setNativeSelected(null);
        commit((document) => {
          const next = { ...document };
          delete next.themeLayout;
          return next;
        });
      }
      setThemeStatus(status);
      notify(
        status.configured
          ? t("Mağaza adresi kaydedildi. Temayı senkronize edebilirsin.")
          : t(
              "Mağaza adresi kaydedildi. Tema okuma erişimi henüz yapılandırılmadı.",
            ),
      );
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      setThemeBusy(false);
    }
  };
  const exportPage = () => {
    if (!page) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(page, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${page.name.replace(/[^\p{L}\p{N}-]/gu, "-").slice(0, 60)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMenu(false);
    notify(t("Tasarım JSON olarak dışa aktarıldı"));
  };
  async function importPage(file?: File) {
    if (!file) return;
    try {
      if (file.size > 1024 * 1024)
        throw new Error(t("Dosya 1 MB sınırını aşıyor."));
      const input = JSON.parse(await file.text());
      const result = await api<{
        document: PageDocument;
      }>("/documents/validate", {
        method: "POST",
        body: json({ document: input }),
      });
      commit(() => result.document);
      setSelected(
        firstHeading(result.document.nodes) ||
          result.document.nodes[0]?.id ||
          null,
      );
      notify(t("Tasarım içe aktarıldı"));
    } catch (error) {
      notify((error as Error).message, true);
    }
    if (importRef.current) importRef.current.value = "";
    setMenu(false);
  }
  async function publish() {
    setPublishing(true);
    try {
      if (!(await save()))
        throw new Error(t("Yayınlamadan önce taslak kaydedilmeli."));
      await api(`/pages/${pageId}/publish`, { method: "POST", body: "{}" });
      setPublished(true);
      notify(t("Yerel önizleme yayınlandı. Shopify’a gönderilmedi."));
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      setPublishing(false);
    }
  }
  if (!page)
    return (
      <div className="loading-screen">
        <Loader2 className="spin" />
        {" " + t("Editör hazırlanıyor…")}
      </div>
    );
  const restoreRecovery = async () => {
    if (!recovery) return;
    try {
      const validated = await api<{
        document: PageDocument;
      }>("/documents/validate", {
        method: "POST",
        body: json({ document: recovery.document }),
      });
      if (JSON.stringify(recovery.base) !== savedRef.current) {
        setConflict({
          base: recovery.base,
          local: validated.document,
          remote: JSON.parse(savedRef.current),
          version: version.current,
        });
        setConflictOpen(true);
      } else commit(() => validated.document);
      setRecovery(null);
    } catch (error) {
      notify((error as Error).message, true);
    }
  };
  const selectedNode = findBlock(page.nodes, selected);
  const themeSnapshot = page.themeLayout
    ? boundSnapshot?.id === page.themeLayout.snapshotId
      ? boundSnapshot
      : themeStatus.snapshot?.id === page.themeLayout.snapshotId
        ? themeStatus.snapshot
        : null
    : null;
  const useThemeShell = !!(page.themeLayout?.useShell && themeSnapshot);
  const visibleNodes = page.nodes.filter(
    (node) =>
      !useThemeShell ||
      !["header", "footer"].includes(String(node.props.sectionRole)),
  );
  const selectedThemeSection =
    themeSnapshot?.sections.find((section) => section.id === nativeSelected) ??
    themeStatus.snapshot?.sections.find(
      (section) => section.id === nativeSelected,
    );
  const selectedNativeSnapshot = themeSnapshot?.sections.some(
    (section) => section.id === nativeSelected,
  )
    ? themeSnapshot
    : themeStatus.snapshot;
  const selectNative = (id: string) => {
    setSelected(null);
    setNativeSelected(id);
  };
  const viewWidth = customWidth || widths[device];
  const scale = Math.max(0.15, Math.min(1, available / viewWidth) * zoom);
  const clean = JSON.stringify(page) === saved;
  const updateHtml = (id: string, html: string) =>
    !isLocked(pageRef.current?.nodes || [], id) &&
    commit(
      (document) => ({
        ...document,
        nodes: mapBlock(document.nodes, id, (current) => ({
          ...current,
          props: { ...current.props, html: richHtml(html) },
        })),
      }),
      `html:${id}`,
    );
  const changeSelected = (change: (node: Block) => Block, key?: string) => {
    if (!selected) return;
    commit((document) => {
      let nodes = document.nodes;
      for (const id of selection.includes(selected) ? selection : [selected])
        nodes = mapBlock(nodes, id, change);
      return { ...document, nodes };
    }, key);
  };
  const command = (action: string) => {
    try {
      const current = pageRef.current;
      if (!current || !selected) return;
      const node = findBlock(current.nodes, selected);
      if (!node) return;
      const ids = selection.includes(selected) ? selection : [selected];
      if (action === "sync") void syncSelected();
      else if (action === "freeMove") {
        const parent = locateBlock(current.nodes, node.id)?.parent;
        const target = isContainer(node.kind) ? node.id : parent;
        if (target) changeFreeLayout(target, true);
        else notify(t("Önce öğeyi bir bölüm veya kutu içine yerleştir."));
      } else if (action === "addColumn" && node.kind === "row") {
        changeSelected((n) => ({
          ...n,
          children: [...n.children, createBlock("column")].map((child) => ({
            ...child,
            styles: {
              ...child.styles,
              [device]: {
                ...child.styles[device],
                width: 100 / (n.children.length + 1) + "%",
                flexBasis: 100 / (n.children.length + 1) + "%",
              },
            },
          })),
        }));
      } else if (action === "copyStyle")
        localStorage.setItem(
          "fp-style-clipboard",
          JSON.stringify({
            styles: node.styles,
            hidden: node.hidden,
            hoverStyles: node.props.hoverStyles,
            focusStyles: node.props.focusStyles,
          }),
        );
      else if (action === "pasteStyle") {
        const data = JSON.parse(
          localStorage.getItem("fp-style-clipboard") || "null",
        );
        if (data)
          changeSelected((n) =>
            isLocked(current.nodes, n.id)
              ? n
              : {
                  ...n,
                  styles: structuredClone(data.styles),
                  hidden: structuredClone(data.hidden),
                  props: {
                    ...n.props,
                    hoverStyles: data.hoverStyles || "{}",
                    focusStyles: data.focusStyles || "{}",
                  },
                },
          );
      } else if (action === "copyBlocks")
        localStorage.setItem(
          "fp-block-clipboard",
          JSON.stringify(clipboardBlocks(current, ids)),
        );
      else if (action === "pasteBlocks") {
        const blocks = JSON.parse(
          localStorage.getItem("fp-block-clipboard") || "[]",
        );
        const result = pasteBlocks(
          current,
          blocks,
          isContainer(node.kind)
            ? node.id
            : locateBlock(current.nodes, node.id)?.parent || null,
        );
        commit(() => result.page);
        setSelection(result.ids);
        setSelected(result.ids[0] || null);
      } else if (action === "parent") {
        const parent = locateBlock(current.nodes, selected)?.parent;
        if (parent) selectMany(parent);
      } else if (action === "group") {
        const r = groupSelection(current, ids);
        commit(() => r.page);
        selectMany(r.id);
      } else if (action === "ungroup")
        commit((p) => ungroupSelection(p, selected));
      else if (action === "lock")
        changeSelected((n) => ({
          ...n,
          props: { ...n.props, locked: !node.props.locked },
        }));
      else if (action.startsWith("columnWidth:") && node.children.length >= 2) {
        changeSelected((n) =>
          resizeColumns(n, device, Number(action.split(":")[1])),
        );
      }
    } catch (e) {
      notify((e as Error).message, true);
    }
  };
  const moveSelected = (direction: -1 | 1) => {
    if (!selected || isLocked(page.nodes, selected)) return;
    const where = locateBlock(page.nodes, selected);
    if (!where) return;
    const siblings = where.parent
      ? (findBlock(page.nodes, where.parent)?.children ?? [])
      : page.nodes;
    if (
      where.index + direction < 0 ||
      where.index + direction >= siblings.length
    )
      return;
    commit((document) => ({
      ...document,
      nodes: moveBlock(
        document.nodes,
        selected,
        where.parent,
        where.index + (direction > 0 ? 2 : -1),
      ),
    }));
  };
  const selectLayer = (id: string) => {
    selectMany(id);
    document
      .querySelector(`[data-node-id="${id}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: scrollBehavior() });
  };
  const collision: typeof pointerWithin = (args) => {
    if (!args.pointerCoordinates) return closestCenter(args);
    const collisions = pointerWithin(args);
    return collisions.sort((a, b) => {
      const ar = args.droppableRects.get(a.id),
        br = args.droppableRects.get(b.id);
      return (
        (ar ? ar.width * ar.height : Infinity) -
        (br ? br.width * br.height : Infinity)
      );
    });
  };
  return (
    <StudioProvider
      page={page}
      value={{
        brand,
        assets,
        catalog,
        storeId: store.id,
        pageId,
        editable: true,
        formDestination,
        activeProductId:
          page.type === "product"
            ? previewResource || catalog.products[0]?.id || ""
            : "",
        activeCollectionId:
          page.type === "collection"
            ? previewResource || catalog.collections[0]?.id || ""
            : "",
      }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={(event) => setDragging(String(event.active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        <div className="studio">
          <header className="studio-topbar">
            <button
              className="brand"
              title={t("Mağazalara dön")}
              onClick={async () => {
                if (await save()) back();
              }}
            >
              <span className="brand-mark">
                <Layers size={18} />
              </span>
              <b>
                fuk<span>pages</span>
              </b>
            </button>
            <div className="topbar-divider" />
            <div className="document-info">
              <span>
                {store.name} <ChevronRight size={10} /> {pageNames[page.type]}
              </span>
              <input
                aria-label={t("Sayfa adı")}
                value={page.name}
                onChange={(event) =>
                  commit(
                    (document) => ({ ...document, name: event.target.value }),
                    "document-name",
                  )
                }
              />
            </div>
            <div className="history-controls">
              <button
                title={t("Geri al (Ctrl+Z)")}
                aria-label={t("Geri al")}
                disabled={!past.current.length}
                onClick={undo}
              >
                <Undo2 size={17} />
              </button>
              <button
                title={t("İleri al (Ctrl+Shift+Z)")}
                aria-label={t("İleri al")}
                disabled={!future.current.length}
                onClick={redo}
              >
                <Redo2 size={17} />
              </button>
            </div>
            <div className="device-switch">
              {(
                [
                  ["desktop", Monitor],
                  ["tablet", Tablet],
                  ["mobile", Smartphone],
                ] as const
              ).map(([key, Icon]) => (
                <button
                  key={key}
                  title={deviceNames[key]}
                  aria-label={deviceNames[key]}
                  className={device === key ? "active" : ""}
                  onClick={() => {
                    setDevice(key);
                    setCustomWidth(null);
                  }}
                >
                  <Icon size={17} />
                </button>
              ))}
              <input
                aria-label={t("Önizleme genişliği")}
                type="number"
                min={280}
                max={2560}
                value={viewWidth}
                style={{ width: 65 }}
                onChange={(e) =>
                  setCustomWidth(
                    Math.max(280, Math.min(2560, Number(e.target.value))),
                  )
                }
              />
              <button
                title={t("Cihaz genişliğine dön")}
                onClick={() => setCustomWidth(null)}
              >
                ↺
              </button>
            </div>
            <div className="topbar-end">
              <UiSettingsButton />
              <span
                className={`save-indicator ${saveError ? "error" : ""}`}
                title={
                  saveError ||
                  (clean
                    ? t("Tüm değişiklikler kaydedildi")
                    : t("Kaydedilmemiş değişiklikler"))
                }
              >
                {saving ? (
                  <Loader2 size={12} className="spin" />
                ) : clean ? (
                  <Check size={12} />
                ) : (
                  <span className="unsaved-dot" />
                )}
                {saveError
                  ? t("Kaydedilemedi")
                  : saving
                    ? t("Kaydediliyor")
                    : clean
                      ? t("Kaydedildi")
                      : t("Değiştirildi")}
              </span>
              <button
                className="top-action"
                onClick={() => void save()}
                disabled={saving}
              >
                {t("Kaydet")}
              </button>
              <button className="top-action" onClick={() => setPreview(true)}>
                <Eye size={14} />
                {" " + t("Önizle")}
              </button>
              <button
                className="publish-button"
                onClick={() => void publish()}
                disabled={publishing || saving}
              >
                {publishing ? (
                  <Loader2 size={14} className="spin" />
                ) : (
                  <span className="publish-dot" />
                )}
                {published ? t("Yerel yayın güncelle") : t("Yerel yayın")}
                <ChevronDown size={12} />
              </button>
              <div className="more-menu">
                <button
                  className="icon-button"
                  aria-label={t("Tasarım işlemleri")}
                  onClick={() => setMenu(!menu)}
                >
                  <MoreHorizontal size={18} />
                </button>
                {menu && (
                  <div className="dropdown-menu">
                    <button onClick={exportPage}>
                      <Download size={14} />
                      {" " + t("JSON dışa aktar")}
                    </button>
                    <button onClick={() => importRef.current?.click()}>
                      <Upload size={14} />
                      {" " + t("JSON içe aktar")}
                    </button>
                    <button
                      onClick={() => {
                        setLibrary("templates");
                        setMenu(false);
                      }}
                    >
                      <LayoutTemplate size={14} />
                      {" " + t("Başlangıç şablonları")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>
          <PageBar
            pageId={pageId}
            store={store}
            catalog={catalog}
            type={page.type}
            resource={previewResource}
            onResource={setPreviewResource}
            busy={saving || publishing}
            save={save}
            notify={notify}
            switchPage={async (id) => {
              if (await save()) openPage(id);
            }}
            manage={async () => {
              if (await save()) back();
            }}
          />
          {(recovery || conflict || saveError || !recoveryWritable) && (
            <div className="recovery-banner" role="status" data-recovery-banner>
              {!recoveryWritable && (
                <span>
                  {t(
                    "Tarayıcı kopyası kaydedilemiyor. Değişikliklerini JSON olarak indir.",
                  )}
                </span>
              )}
              {recovery && (
                <>
                  <span>
                    {new Date(recovery.updated).toLocaleString(getUiLocale())}
                    {" " + t("tarihli kaydedilmemiş taslak bulundu.")}
                  </span>
                  <button onClick={() => void restoreRecovery()}>
                    {t("Taslağı kurtar")}
                  </button>
                  <button
                    onClick={() =>
                      downloadDocument(recovery.document, "kurtarma")
                    }
                  >
                    {t("Kurtarma kopyasını indir")}
                  </button>
                  <button
                    onClick={() => {
                      try {
                        localStorage.removeItem(recoveryKey.current);
                      } catch {
                        /* unavailable */
                      }
                      setRecovery(null);
                    }}
                  >
                    {t("Sunucu sürümüyle devam et")}
                  </button>
                </>
              )}
              {conflict && (
                <button onClick={() => setConflictOpen(true)}>
                  {t("Kayıt çakışmasını çöz")}
                </button>
              )}
              {saveError && !conflict && (
                <>
                  <span>
                    {saveError} ·{" "}
                    {recoveryWritable
                      ? t("Yerel kopyan bu tarayıcıda korunuyor.")
                      : t("Tarayıcı kopyası kullanılamıyor.")}
                  </span>
                  <button onClick={() => void save()}>
                    {t("Kaydı tekrar dene")}
                  </button>
                </>
              )}
              {page && (
                <button onClick={() => downloadDocument(page, "yerel")}>
                  {t("Yerel kopyayı indir")}
                </button>
              )}
            </div>
          )}
          {recovery && (
            <Dialog
              open
              label={t("Kaydedilmemiş taslağı kurtar")}
              onClose={() => {}}
              dismissible={false}
            >
              <h2>{t("Kaydedilmemiş taslağın korunuyor")}</h2>
              <p>
                {t("Bu tarayıcıda")}{" "}
                {new Date(recovery.updated).toLocaleString(getUiLocale())}
                {" " +
                  t(
                    "tarihli bir kopya var. Düzenlemeye devam etmek için kullanacağın sürümü seç.",
                  )}
              </p>
              <button onClick={() => void restoreRecovery()}>
                {t("Taslağı kurtar")}
              </button>
              <button
                onClick={() => downloadDocument(recovery.document, "kurtarma")}
              >
                {t("Kurtarma kopyasını indir")}
              </button>
              <button
                onClick={() => {
                  try {
                    localStorage.removeItem(recoveryKey.current);
                  } catch {
                    /* unavailable */
                  }
                  setRecovery(null);
                }}
              >
                {t("Sunucu sürümüyle devam et")}
              </button>
            </Dialog>
          )}
          {conflict && (
            <ConflictDialog
              key={conflict.version}
              value={conflict}
              open={conflictOpen}
              onClose={() => setConflictOpen(false)}
              apply={async (candidate) => {
                try {
                  const validated = await api<{
                    document: PageDocument;
                  }>("/documents/validate", {
                    method: "POST",
                    body: json({ document: candidate }),
                  });
                  version.current = conflict.version;
                  savedRef.current = JSON.stringify(conflict.remote);
                  setSaved(savedRef.current);
                  commit(() => validated.document);
                  setConflict(null);
                  setConflictOpen(false);
                  setRecovery(null);
                  setSaveError("");
                  notify(
                    t("Seçimlerin birleştirildi. Güncel sürüme kaydediliyor."),
                  );
                } catch (error) {
                  notify((error as Error).message, true);
                }
              }}
            />
          )}
          <div
            className="studio-workspace"
            style={
              {
                "--library-width": panels.widths.library + "px",
                "--inspector-width": panels.widths.inspector + "px",
              } as CSSProperties
            }
          >
            <nav className="tool-rail">
              <div>
                {[
                  ["blocks", Plus, t("Öğeler")],
                  ["sections", LayoutTemplate, t("Bölümler")],
                  ["layers", Layers, t("Katmanlar")],
                  ["templates", LayoutTemplate, t("Şablonlar")],
                  ["theme", StoreIcon, t("Tema")],
                  ["media", Upload, t("Medya")],
                  ["brand", LayoutTemplate, t("Marka")],
                  ["workflow", MoreHorizontal, t("Sayfa")],
                  ["catalog", StoreIcon, t("Ürünler")],
                  ["growth", LayoutTemplate, t("Akışlar")],
                  ...(role === "owner"
                    ? [["team", ShieldCheck, t("Hesaplar")]]
                    : []),
                ].map(([id, Tool, title]) => {
                  const Icon = Tool as typeof Plus;
                  return (
                    <button
                      key={String(id)}
                      className={
                        library === id || (id === "layers" && layersOpen)
                          ? "active"
                          : ""
                      }
                      title={String(title)}
                      onClick={() => {
                        if (id === "layers") setLayersOpen((v) => !v);
                        else setLibrary(String(id));
                      }}
                    >
                      <Icon size={20} />
                      <span className="rail-caption">{String(title)}</span>
                    </button>
                  );
                })}
              </div>
              <button
                title={t("Mağaza yönetimi")}
                onClick={async () => {
                  if (await save()) back();
                }}
              >
                <ShieldCheck size={20} />
                <span>{t("Yönetim")}</span>
              </button>
            </nav>
            <aside className="library">
              <div className="library-heading">
                <div>
                  <h2>
                    {(
                      {
                        media: t("Medya kütüphanesi"),
                        brand: t("Marka kiti"),
                        workflow: t("SEO ve yayın"),
                        catalog: t("Yerel ürünler"),
                        growth: t("Diller ve akışlar"),
                      } as Record<string, string>
                    )[library] ||
                      (library === "sections"
                        ? t("Bölüm bölüm tasarla.")
                        : library === "theme"
                          ? t("Mağazanın teması.")
                          : library === "blocks"
                            ? t("Bir şeyler oluştur.")
                            : library === "layers"
                              ? t("Katmanlar")
                              : t("İyi bir başlangıç."))}
                  </h2>
                  <p>
                    {library === "workflow"
                      ? t("Başlık, adres ve yayın durumunu yönet.")
                      : library === "sections"
                        ? t("Hazır bir bölüm ekle, her ayrıntıyı düzenle.")
                        : library === "theme"
                          ? t("Header, footer ve mevcut bölüm sırası.")
                          : library === "blocks"
                            ? t("Sürükle, bırak, kendine göre düzenle.")
                            : library === "layers"
                              ? t("Sayfanın yapısını yönet.")
                              : t("Bir şablon seç, kendi hikâyeni anlat.")}
                  </p>
                </div>
              </div>
              {["blocks", "sections"].includes(library) && (
                <div
                  className="element-browser-tabs"
                  role="tablist"
                  aria-label={t("Library")}
                >
                  <button
                    role="tab"
                    aria-selected={library === "sections"}
                    onClick={() => setLibrary("sections")}
                  >
                    {t("Bölümler")}
                  </button>
                  <button
                    role="tab"
                    aria-selected={library === "blocks"}
                    onClick={() => setLibrary("blocks")}
                  >
                    {t("Öğeler")}
                  </button>
                </div>
              )}
              {library === "team" && role === "owner" && (
                <TeamPanel notify={notify} />
              )}
              {library === "growth" && (
                <GrowthPanel
                  pageId={pageId}
                  storeId={store.id}
                  page={page}
                  assets={assets}
                  commit={commit}
                  save={save}
                  notify={notify}
                />
              )}
              {library === "catalog" && (
                <CatalogPanel
                  storeId={store.id}
                  refresh={refreshCatalog}
                  notify={notify}
                />
              )}
              {library === "media" && (
                <MediaPanel
                  storeId={store.id}
                  assets={assets}
                  refresh={refreshAssets}
                  select={addAsset}
                  notify={notify}
                />
              )}
              {library === "brand" && (
                <BrandPanel
                  key={brandVersion}
                  storeId={store.id}
                  brand={brand}
                  version={brandVersion}
                  assets={assets}
                  refresh={refreshAssets}
                  update={(b, v) => {
                    setBrand(b);
                    setBrandVersion(v);
                  }}
                  notify={notify}
                />
              )}
              {library === "workflow" && (
                <WorkflowPanel
                  pageId={pageId}
                  storeId={store.id}
                  page={page}
                  commit={commit}
                  save={save}
                  notify={notify}
                  selectNode={(id) => {
                    selectLayer(id);
                    setContentIntent((n) => n + 1);
                  }}
                />
              )}
              {library === "sections" && (
                <SectionLibrary
                  saved={savedSections}
                  addPreset={addPreset}
                  addSaved={addSaved}
                  addPrepared={addSaved}
                  saveSelected={saveSection}
                  selectedSection={enclosingSection(page, selected)}
                  removeSaved={removeSaved}
                />
              )}
              {library === "theme" && (
                <ThemePanel
                  status={themeStatus}
                  busy={themeBusy}
                  sync={() => void syncTheme()}
                  saveDomain={saveDomain}
                  selectedId={nativeSelected}
                  select={selectNative}
                  useShell={!!page.themeLayout?.useShell}
                  bind={bindTheme}
                  clearBinding={() => {
                    commit((document) => {
                      const next = { ...document };
                      delete next.themeLayout;
                      return next;
                    });
                    setNativeSelected(null);
                  }}
                />
              )}
              {library === "blocks" && (
                <>
                  <label className="library-search">
                    <Search size={14} />
                    <input
                      aria-label={t("Öğe ara")}
                      placeholder={t("Öğe ara…")}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                    <span>⌘ K</span>
                  </label>
                  <div className="library-scroll">
                    {groups.map((group) => {
                      const filtered = group.kinds.filter((kind) =>
                        labels[kind]
                          .toLocaleLowerCase(getUiLanguage())
                          .includes(search.toLocaleLowerCase(getUiLanguage())),
                      );
                      return (
                        !!filtered.length && (
                          <details
                            open
                            className="palette-group"
                            key={group.name}
                          >
                            <summary>
                              {group.name}
                              <ChevronDown size={12} />
                            </summary>
                            <div className="palette-grid">
                              {filtered.includes("row") &&
                                [0, 1, 2, 3, 4].map((columns) => (
                                  <PaletteItem
                                    key={`row-${columns}`}
                                    kind="row"
                                    columns={columns}
                                    onAdd={() => add("row", columns)}
                                  />
                                ))}
                              {filtered
                                .filter((kind) => kind !== "row")
                                .map((kind) => (
                                  <PaletteItem
                                    key={kind}
                                    kind={kind}
                                    onAdd={() => add(kind)}
                                  />
                                ))}
                            </div>
                          </details>
                        )
                      );
                    })}
                    {!groups.some((group) =>
                      group.kinds.some((kind) =>
                        labels[kind]
                          .toLocaleLowerCase(getUiLanguage())
                          .includes(search.toLocaleLowerCase(getUiLanguage())),
                      ),
                    ) && (
                      <p className="setting-help">
                        {t("Eşleşen öğe bulunamadı.")}
                      </p>
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
              )}
              {library === "templates" && (
                <div className="library-scroll template-list">
                  {[
                    ["Aura · Product launch", "aura", t("Ürününü öne çıkar.")],
                    [
                      "Minimal · Editorial",
                      "editorial",
                      t("Sade tasarım, güçlü hikâye."),
                    ],
                    [
                      "Fresh · Summer sale",
                      "sale",
                      t("Kampanyanı canlı renklerle anlat."),
                    ],
                  ].map(([name, id, description]) => (
                    <button
                      key={id}
                      className="template-card"
                      onClick={() => {
                        const next = starterDocument(page.type);
                        next.themeLayout = page.themeLayout;
                        next.name = name;
                        if (id === "editorial") {
                          next.nodes = next.nodes.filter(
                            (_, index) => index !== 0,
                          );
                          const heading = findBlock(
                            next.nodes,
                            firstHeading(next.nodes),
                          );
                          if (heading)
                            heading.props.html = "LESS, BUT<br/>BETTER.";
                          next.nodes[0].styles.desktop.backgroundColor =
                            "#f5efe8";
                        }
                        if (id === "sale") {
                          const heading = findBlock(
                            next.nodes,
                            firstHeading(next.nodes),
                          );
                          if (heading)
                            heading.props.html = "GOOD VIBES.<br/>GREAT DEALS.";
                          next.nodes[1].styles.desktop.backgroundColor =
                            "#f8f5d6";
                        }
                        commit(() => next);
                        setSelected(firstHeading(next.nodes));
                        notify(
                          t(
                            "Şablon uygulandı. Geri al ile önceki tasarıma dönebilirsin.",
                          ),
                        );
                      }}
                    >
                      <div className={`template-thumbnail ${id}`}>
                        <span>
                          {id === "aura"
                            ? "aura✦"
                            : id === "sale"
                              ? "SUMMER / 26"
                              : "The Journal."}
                        </span>
                        <b>
                          {id === "aura"
                            ? "SOUND THAT MOVES YOU."
                            : id === "sale"
                              ? "GOOD VIBES."
                              : "LESS, BUT BETTER."}
                        </b>
                        <div />
                      </div>
                      <strong>{name}</strong>
                      <small>{description}</small>
                      <span className="template-use">
                        {t("Şablonu kullan") + " "}
                        <ChevronRight size={12} />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </aside>
            <PanelSplitter
              side="library"
              width={panels.widths.library}
              update={(width) => panels.update("library", width)}
            />
            <main
              className="canvas-area"
              ref={canvasRef}
              onContextMenu={(e) => {
                const el = (e.target as Element).closest("[data-node-id]");
                if (el) {
                  e.preventDefault();
                  selectMany(el.getAttribute("data-node-id")!);
                  setContextMenu({ x: e.clientX, y: e.clientY });
                }
              }}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes("Files")) e.preventDefault();
              }}
              onDrop={(e) => {
                if (e.dataTransfer.files.length) {
                  e.preventDefault();
                  void dropFiles([...e.dataTransfer.files]);
                }
              }}
            >
              <div className="canvas-topline">
                <span>
                  <span className="canvas-status-dot" />
                  {deviceNames[device]}
                  {" " + t("görünümü")}
                </span>
                <span>
                  {themeSnapshot
                    ? t("{p0} · tema verisi okundu", {
                        p0: themeSnapshot.themeName,
                      })
                    : t("Yerel taslak · Shopify bağlı değil")}
                </span>
              </div>
              <div className="canvas-scroll" onClick={() => setSelected(null)}>
                <div
                  className="canvas-sheet-holder"
                  style={{ width: viewWidth * scale, marginBottom: -30 }}
                >
                  <div
                    className="canvas-sheet"
                    style={{ width: viewWidth, zoom: scale } as CSSProperties}
                  >
                    <div className="canvas-browser">
                      <div>
                        <i />
                        <i />
                        <i />
                      </div>
                      <span>
                        {store.name.toLowerCase().replaceAll(" ", "-")}.preview
                        / {page.type}
                      </span>
                      <ShieldCheck size={11} />
                    </div>
                    <div
                      className="page-surface editable-surface"
                      data-device={device}
                    >
                      {useThemeShell &&
                        themeSnapshot?.sections
                          .filter((section) => section.region !== "footer")
                          .map((section) => (
                            <NativeThemeSection
                              key={section.id}
                              section={section}
                              select={() => selectNative(section.id)}
                            />
                          ))}
                      {visibleNodes.map((node) => (
                        <CanvasNode
                          key={node.id}
                          node={node}
                          index={page.nodes.findIndex(
                            (item) => item.id === node.id,
                          )}
                          device={device}
                          selected={selected}
                          select={selectMany}
                          resizeColumn={(id, value, index) =>
                            commit(
                              (d) => ({
                                ...d,
                                nodes: mapBlock(d.nodes, id, (n) =>
                                  resizeColumns(n, device, value, index),
                                ),
                              }),
                              `resize:${id}:${device}`,
                            )
                          }
                          updateHtml={updateHtml}
                          duplicate={duplicate}
                          remove={remove}
                          dragging={!!dragging}
                          geometry={(id, styles, free) =>
                            commit(
                              (d) => ({
                                ...d,
                                nodes: mapBlock(d.nodes, id, (n) => ({
                                  ...n,
                                  props: {
                                    ...n.props,
                                    ...(free
                                      ? {
                                          freePlaced: true,
                                          ...(!n.props.freePlaced
                                            ? {
                                                freeFlowStyles: JSON.stringify({
                                                  [device]: {
                                                    ...n.styles[device],
                                                  },
                                                }),
                                              }
                                            : {}),
                                        }
                                      : {}),
                                  },
                                  styles: {
                                    ...n.styles,
                                    [device]: {
                                      ...n.styles[device],
                                      ...(free ? { position: "absolute" } : {}),
                                      ...styles,
                                    },
                                  },
                                })),
                              }),
                              `geometry:${id}:${device}`,
                            )
                          }
                        />
                      ))}
                      {useThemeShell &&
                        themeSnapshot?.sections
                          .filter((section) => section.region === "footer")
                          .map((section) => (
                            <NativeThemeSection
                              key={section.id}
                              section={section}
                              select={() => selectNative(section.id)}
                            />
                          ))}
                      {!page.nodes.length && (
                        <EmptyPage add={() => add("section")} />
                      )}
                    </div>
                  </div>
                </div>
                <div className="canvas-bottom-add">
                  <button onClick={() => setLibrary("sections")}>
                    <LayoutTemplate size={20} />
                    <span>
                      <b>{t("Choose templates")}</b>
                      <small>{t("Start with a ready-made section")}</small>
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      const node = createBlock("section");
                      commit((d) => insertSection(d, node, null));
                      showNewNode(node.id);
                    }}
                  >
                    <Plus size={20} />
                    <span>
                      <b>{t("Add blank section")}</b>
                      <small>{t("Drag and drop elements")}</small>
                    </span>
                  </button>
                </div>
              </div>
              <footer className="canvas-footer">
                <div>
                  <MousePointer2 size={12} />
                  <span>
                    {selectedNode?.name ?? t("Bir öğe seç")}
                    {selectedNode && (
                      <>
                        <ChevronRight size={10} />
                        {labels[selectedNode.kind]}
                      </>
                    )}
                  </span>
                </div>
                <div>
                  <button
                    title={t("Uzaklaştır")}
                    onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                  >
                    <ZoomOut size={14} />
                  </button>
                  <button onClick={() => setZoom(1)} title={t("Ekrana sığdır")}>
                    {Math.round(scale * 100)}%
                  </button>
                  <button
                    title={t("Yakınlaştır")}
                    onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}
                  >
                    <ZoomIn size={14} />
                  </button>
                </div>
              </footer>
            </main>
            <PanelSplitter
              side="inspector"
              width={panels.widths.inspector}
              update={(width) => panels.update("inspector", width)}
            />
            <aside
              className="inspector-container"
              aria-label={t("Öğe ayarları")}
            >
              {enclosingSection(page, selected) &&
                selectedNode?.kind === "section" &&
                !selectedThemeSection && (
                  <SectionDesign
                    key={enclosingSection(page, selected)!.id}
                    section={enclosingSection(page, selected)!}
                    update={(section) =>
                      commit((d) => ({
                        ...d,
                        nodes: mapBlock(d.nodes, section.id, () => section),
                      }))
                    }
                  />
                )}
              <SelectionTools
                node={selectedNode}
                count={
                  selection.includes(selected || "") ? selection.length : 1
                }
                command={command}
                device={device}
              />
              {selectedThemeSection && selectedNativeSnapshot ? (
                <NativeThemeInspector
                  section={selectedThemeSection}
                  snapshot={selectedNativeSnapshot}
                />
              ) : (
                <Inspector
                  node={selectedNode}
                  back={() => setLibrary("blocks")}
                  openMedia={() => setLibrary("media")}
                  storeId={store.id}
                  assets={assets}
                  device={device}
                  update={(change, key) => {
                    changeSelected(change, key);
                  }}
                  duplicate={() => selected && duplicate(selected)}
                  remove={() => selected && remove(selected)}
                  move={moveSelected}
                  setLayout={changeFreeLayout}
                  contentIntent={contentIntent}
                  parentFree={
                    !!freeHeight(
                      findBlock(
                        page.nodes,
                        locateBlock(page.nodes, selectedNode?.id || "")
                          ?.parent || "",
                      ),
                      device,
                    )
                  }
                />
              )}
            </aside>
          </div>
          {layersOpen && (
            <FloatingPanel
              title={t("Katmanlar")}
              close={() => setLayersOpen(false)}
            >
              <div className="library-scroll layer-tree">
                <input
                  aria-label={t("Katman ara")}
                  placeholder={t("Katman ara")}
                  value={layerSearch}
                  onChange={(e) => setLayerSearch(e.target.value)}
                />
                {useThemeShell &&
                  themeSnapshot?.sections
                    .filter((section) => section.region !== "footer")
                    .map((section) => (
                      <button
                        key={section.id}
                        className="outline-theme-row"
                        onClick={() => selectNative(section.id)}
                      >
                        <Layers size={13} />
                        <span>{section.name}</span>
                        <LockKeyhole size={11} />
                      </button>
                    ))}
                {visibleNodes
                  .filter(
                    (node) =>
                      !layerSearch ||
                      JSON.stringify(node)
                        .toLocaleLowerCase(getUiLanguage())
                        .includes(
                          layerSearch.toLocaleLowerCase(getUiLanguage()),
                        ),
                  )
                  .map((node) => (
                    <Layer
                      key={node.id}
                      node={node}
                      index={page.nodes.findIndex(
                        (item) => item.id === node.id,
                      )}
                      depth={0}
                      selected={selected}
                      select={selectLayer}
                      dragging={!!dragging}
                      search={layerSearch}

                      visibility={(id) =>
                        commit((d) => ({
                          ...d,
                          nodes: mapBlock(d.nodes, id, (n) => ({
                            ...n,
                            hidden: {
                              ...n.hidden,
                              [device]: !n.hidden[device],
                            },
                          })),
                        }))
                      }
                      device={device}
                    />
                  ))}
                {useThemeShell &&
                  themeSnapshot?.sections
                    .filter((section) => section.region === "footer")
                    .map((section) => (
                      <button
                        key={section.id}
                        className="outline-theme-row"
                        onClick={() => selectNative(section.id)}
                      >
                        <Layers size={13} />
                        <span>{section.name}</span>
                        <LockKeyhole size={11} />
                      </button>
                    ))}
                {!page.nodes.length && (
                  <p className="setting-help">
                    {t("İlk öğeni kütüphaneden ekle.")}
                  </p>
                )}
              </div>
            </FloatingPanel>
          )}
          {contextMenu && (
            <div
              className="editor-context-menu"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              {[
                ["copyStyle", t("Stili kopyala")],
                ["pasteStyle", t("Stili yapıştır")],
                ["copyBlocks", t("Öğeleri kopyala")],
                ["pasteBlocks", t("Öğeleri yapıştır")],
                ["parent", t("Üst öğeyi seç")],
                ["lock", t("Kilidi değiştir")],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => {
                    command(id);
                    setContextMenu(null);
                  }}
                >
                  {label}
                </button>
              ))}
              <button onClick={() => setContextMenu(null)}>{t("Kapat")}</button>
            </div>
          )}
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => void importPage(event.target.files?.[0])}
          />
          {selectedNode && ["text", "heading"].includes(selectedNode.kind) && (
            <div className="rich-format-toolbar">
              <span>{t("Metin")}</span>
              {[
                ["bold", "B"],
                ["italic", "I"],
                ["underline", "U"],
                ["strikeThrough", "S"],
              ].map(([command, label]) => (
                <button
                  key={command}
                  title={command}
                  style={{
                    fontWeight: command === "bold" ? 800 : undefined,
                    fontStyle: command === "italic" ? "italic" : undefined,
                    textDecoration:
                      command === "underline"
                        ? "underline"
                        : command === "strikeThrough"
                          ? "line-through"
                          : undefined,
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    const selection = window.getSelection();
                    const anchor = selection?.anchorNode;
                    const element =
                      anchor instanceof Element
                        ? anchor
                        : anchor?.parentElement;
                    const editable = element?.closest(".rich-content");
                    if (
                      !editable ||
                      editable
                        .closest("[data-node-id]")
                        ?.getAttribute("data-node-id") !== selected
                    ) {
                      notify(
                        t("Biçimlendirmek için tasarım alanındaki metni seç."),
                      );
                      return;
                    }
                    document.execCommand(command);
                  }}
                >
                  {label}
                </button>
              ))}
              <small>{t("Metne çift tıkla")}</small>
            </div>
          )}
        </div>
        <DragOverlay>
          {dragging && (
            <div className="drag-chip">
              <GripVertical size={16} />
              {dragging.startsWith("palette:")
                ? labels[dragging.split(":")[1] as Kind]
                : t("Öğeyi taşı")}
              <Plus size={12} />
            </div>
          )}
        </DragOverlay>
        {preview && (
          <div className="preview-modal">
            <header>
              <button className="brand">
                <span className="brand-mark">
                  <Layers size={18} />
                </span>
                <b>{t("Önizleme")}</b>
              </button>
              <span className="preview-label">
                {t("Yerel tasarım önizlemesi · Shopify bağlantısı yok")}
              </span>
              <div className="device-switch">
                {(
                  [
                    ["desktop", Monitor],
                    ["tablet", Tablet],
                    ["mobile", Smartphone],
                  ] as const
                ).map(([key, Icon]) => (
                  <button
                    key={key}
                    title={deviceNames[key]}
                    className={device === key ? "active" : ""}
                    onClick={() => {
                      setDevice(key);
                      setCustomWidth(null);
                    }}
                  >
                    <Icon size={17} />
                  </button>
                ))}
              </div>
              <button
                className="icon-button"
                aria-label={t("Önizlemeyi kapat")}
                onClick={() => setPreview(false)}
              >
                <X size={20} />
              </button>
            </header>
            <div className="preview-scroll">
              <div
                style={{
                  width: widths[device],
                  maxWidth: "100%",
                  margin: "0 auto",
                }}
              >
                {useThemeShell &&
                  themeSnapshot?.sections
                    .filter((section) => section.region !== "footer")
                    .map((section) => (
                      <NativeThemeSection key={section.id} section={section} />
                    ))}
                <PageRenderer
                  document={{ ...page, nodes: visibleNodes }}
                  device={device}
                />
                {useThemeShell &&
                  themeSnapshot?.sections
                    .filter((section) => section.region === "footer")
                    .map((section) => (
                      <NativeThemeSection key={section.id} section={section} />
                    ))}
              </div>
            </div>
          </div>
        )}
      </DndContext>
    </StudioProvider>
  );
}
