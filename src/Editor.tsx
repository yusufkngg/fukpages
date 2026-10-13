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
import { api, json, uploadFiles } from "./api";
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
  version: number;
  themeSnapshot?: ThemeSnapshot | null;
}
interface EditorProps {
  pageId: string;
  role?: "owner" | "editor";
  store: Store;
  back: () => void;
  notify: (message: string, error?: boolean) => void;
}
function PaletteItem({ kind, onAdd }: { kind: Kind; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${kind}`,
    data: { kind },
  });
  const Icon = blockIcons[kind];
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`palette-card ${isDragging ? "dragging" : ""}`}
      onClick={onAdd}
      title={`${labels[kind]} ekle veya sürükle`}
      data-palette={kind}
    >
      <Icon size={24} strokeWidth={1.5} />
      <span>{labels[kind]}</span>
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
  resizeColumn?: (id: string, value: number) => void;
}) {
  const columnDrag = useRef<{ x: number; start: number; width: number } | null>(
    null,
  );
  const drag = useDraggable({
    id: `node:${node.id}`,
    data: { nodeId: node.id },
    disabled: !!node.props.locked,
  });
  const drop = useDroppable({
    id: `inside:${node.id}`,
    data: { parent: node.id, index: node.children.length },
    disabled: !isContainer(node.kind),
  });
  if (node.hidden[device]) return null;
  const style = {
    ...brandStyle(node, device),
    ...effectiveStyle(node, device),
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
        drag.setNodeRef(element);
        drop.setNodeRef(element);
      }}
      data-node-id={node.id}
      data-kind={node.kind}
      data-block={node.id}
      className={`content-block editor-block ${selected === node.id ? "selected" : ""} ${drag.isDragging ? "moving" : ""} ${drop.isOver ? "drop-inside" : ""}`}
      style={style}
      onClick={(event) => {
        event.stopPropagation();
        select(node.id, event.shiftKey || event.ctrlKey || event.metaKey);
      }}
    >
      {selected === node.id && (
        <div className="block-toolbar">
          <span>{node.name}</span>
          <button
            title="Öğeyi sürükle"
            {...drag.attributes}
            {...drag.listeners}
          >
            <GripVertical size={13} />
          </button>
          <button
            title="Öğeyi çoğalt"
            onClick={(event) => {
              event.stopPropagation();
              duplicate(node.id);
            }}
          >
            <Copy size={12} />
          </button>
          <button
            title="Öğeyi sil"
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
        !node.props.locked && (
          <div
            className="column-resize-handle"
            role="separator"
            aria-label="Kolonları boyutlandır"
            style={{
              left: `${((parseFloat(String(effectiveStyle(node.children[0], device).width)) || 50) / ((parseFloat(String(effectiveStyle(node.children[0], device).width)) || 50) + (parseFloat(String(effectiveStyle(node.children[1], device).width)) || 50))) * 100}%`,
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const row = e.currentTarget.parentElement!,
                rect = row.getBoundingClientRect(),
                first = row.querySelector(":scope > .content-block");
              columnDrag.current = {
                x: e.clientX,
                width: rect.width,
                start: first
                  ? (first.getBoundingClientRect().width / rect.width) * 100
                  : 50,
              };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (columnDrag.current) {
                e.stopPropagation();
                const d = columnDrag.current;
                resizeColumn?.(
                  node.id,
                  Math.max(
                    10,
                    Math.min(90, d.start + ((e.clientX - d.x) / d.width) * 100),
                  ),
                );
              }
            }}
            onPointerUp={() => {
              columnDrag.current = null;
            }}
            onPointerCancel={() => {
              columnDrag.current = null;
            }}
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
              />
            ))}
            {!node.children.length && (
              <div className="empty-container">
                <Plus size={16} />
                <span>Öğeyi buraya bırak</span>
              </div>
            )}
          </>
        )}
      </BlockContent>
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
}: {
  node: Block;
  parent?: string | null;
  index?: number;
  depth: number;
  selected: string | null;
  select: (id: string, multi?: boolean) => void;
  dragging: boolean;
}) {
  const [open, setOpen] = useState(depth > 0);
  const drag = useDraggable({
    id: `layer:${node.id}`,
    data: { nodeId: node.id },
    disabled: !!node.props.locked,
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
          aria-label="Katmanı aç veya kapat"
          onClick={() => setOpen(!open)}
        >
          {isContainer(node.kind) ? (
            open ? (
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
        <span className="layer-kind">
          {depth === 0 && node.kind === "section" && (
            <i className="fp-section-tag">FP</i>
          )}
          {node.hidden.mobile && "M̸"}
        </span>
      </div>
      {open &&
        node.children.map((child, index) => (
          <Layer
            key={child.id}
            node={child}
            parent={node.id}
            index={index}
            depth={depth + 1}
            selected={selected}
            select={select}
            dragging={dragging}
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
      <h2>İlk bölümünü ekle.</h2>
      <p>Kütüphaneden bir öğeyi buraya sürükle.</p>
      <button
        onClick={(event) => {
          event.stopPropagation();
          add();
        }}
      >
        Bölüm ekle
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
}: EditorProps) {
  const [catalog, setCatalog] = useState<Catalog>({
    source: "local",
    products: [],
    collections: [],
  });
  const refreshCatalog = useCallback(
    async () => setCatalog(await api<Catalog>(`/stores/${store.id}/catalog`)),
    [store.id],
  );
  useEffect(() => {
    void refreshCatalog().catch((e) => notify(e.message, true));
  }, [refreshCatalog, notify]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [formDestination, setFormDestination] = useState(
    "Webhook yapılandırılmadı",
  );
  useEffect(() => {
    api<{ forms: { webhookLabel: string } }>(`/stores/${store.id}/integrations`)
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
    api<{ brand: Brand; version: number }>(`/stores/${store.id}/brand`)
      .then((r) => {
        setBrand(r.brand);
        setBrandVersion(r.version);
      })
      .catch((e) => notify(e.message, true));
  }, [store.id, refreshAssets, notify]);
  const [page, setPage] = useState<PageDocument | null>(null);
  const pageRef = useRef<PageDocument | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
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
  const [library, setLibrary] = useState("sections");
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
    api<PageResponse>(`/pages/${pageId}`)
      .then((result) => {
        if (!current) return;
        pageRef.current = result.document;
        setPage(result.document);
        version.current = result.version;
        const value = JSON.stringify(result.document);
        savedRef.current = value;
        setSaved(value);
        setSelected(firstHeading(result.document.nodes));
        setBoundSnapshot(result.themeSnapshot ?? null);
      })
      .catch((error) => notify(error.message, true));
    return () => {
      current = false;
    };
  }, [pageId, notify]);
  const pageType = page?.type;
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
    if (selected) setNativeSelected(null);
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
      setSaveError("");
      setHistoryTick((value) => value + 1);
    },
    [],
  );
  const save = useCallback(async () => {
    const current = pageRef.current;
    if (!current) return false;
    if (savingRef.current) return false;
    const snapshot = JSON.stringify(current);
    if (snapshot === savedRef.current) return true;
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const result = await api<{ version: number; document: PageDocument }>(
        `/pages/${pageId}`,
        {
          method: "PUT",
          body: json({ document: current, version: version.current }),
        },
      );
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
      notify((error as Error).message, true);
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
      setTick((value) => value + 1);
    }
  }, [pageId, notify]);
  useEffect(() => {
    if (!page || JSON.stringify(page) === saved || saveError) return;
    const timer = setTimeout(() => {
      void save();
    }, 1300);
    return () => clearTimeout(timer);
  }, [page, saved, save, tick, saveError]);
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
        notify("Kilitli öğeyi önce aç.");
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
  const add = (kind: Kind) => {
    if (!pageRef.current) return;
    const node = createBlock(kind),
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
    commit((document) => ({
      ...document,
      nodes: insertBlock(document.nodes, parent, siblings.length, node),
    }));
    setSelected(node.id);
    notify(`${labels[kind]} eklendi`);
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
        void save();
        return;
      }
      if (typing) return;
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
        remove(selected);
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
  }, [selected, undo, redo, duplicate, remove, save]);
  const addAsset = useCallback(
    (asset: Asset, mode = "replace") => {
      if (asset.type !== "image") return;
      const current = pageRef.current;
      if (!current) return;
      const old = findBlock(current.nodes, selected);
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
        notify("Önce mobil görsel eklenecek öğeyi seç.", true);
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
        commit((d) => ({
          ...d,
          nodes: insertBlock(
            d.nodes,
            old && isContainer(old.kind) ? old.id : null,
            old && isContainer(old.kind) ? old.children.length : d.nodes.length,
            image,
          ),
        }));
        setSelected(image.id);
      }
    },
    [commit, selected],
  );
  async function dropFiles(files: File[]) {
    try {
      const r = await uploadFiles(
        `/stores/${store.id}/assets`,
        files,
        { type: "image" },
        () => {},
      );
      for (const result of r.results)
        if (result.ok && result.asset) addAsset(result.asset, "add");
        else notify(result.error || "Görsel yüklenemedi.", true);
      await refreshAssets();
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  useEffect(() => {
    const paste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.matches("input,textarea") || target.isContentEditable) return;
      const files = [...(e.clipboardData?.items || [])]
        .filter((i) => i.type.startsWith("image/"))
        .map((i) => i.getAsFile())
        .filter(Boolean) as File[];
      if (files.length) {
        e.preventDefault();
        void dropFiles(files);
      }
    };
    window.addEventListener("paste", paste);
    return () => window.removeEventListener("paste", paste);
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
      notify("Kilitli öğeler taşınamaz.");
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
      const node = createBlock(event.active.data.current.kind as Kind);
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
        "Header/footer temadan geliyor. Özel bir header/footer eklemek için Tema panelinden tema düzenini kapat.",
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
    setSelected(section.id);
    notify(`${section.name} eklendi; tüm alt öğeleri düzenleyebilirsin.`);
  };
  const addSaved = (saved: Block) => {
    const section = fromSavedSection(saved);
    if (!canInsertSection(section)) return;
    commit((document) => insertSection(document, section, selected));
    setNativeSelected(null);
    setSelected(section.id);
    notify("Kaydedilen bölüm eklendi. Bu kopya bağımsız düzenlenir.");
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
      notify("Bölüm kütüphanene kaydedildi.");
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
      const r = await api<{ affectedPages: string[] }>(
        `/stores/${store.id}/sections/${section.props.linkedSectionId}/sync`,
        {
          method: "PUT",
          body: json({
            section,
            version: Number(section.props.linkedVersion || 1),
          }),
        },
      );
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
        `${r.affectedPages.length} sayfanın taslağı güncellendi. Yayınlar değişmedi.`,
      );
    } catch (e) {
      notify((e as Error).message, true);
    }
  };
  const removeSaved = async (id: string) => {
    try {
      await api(`/stores/${store.id}/sections/${id}`, { method: "DELETE" });
      setSavedSections((current) => current.filter((item) => item.id !== id));
      notify("Kütüphane kaydı kaldırıldı; sayfalardaki kopyalar korunur.");
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
      notify("Shopify bölüm sırası okundu. Özel tasarımların korunuyor.");
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
          ? "Mağaza adresi kaydedildi. Temayı senkronize edebilirsin."
          : "Mağaza adresi kaydedildi. Tema okuma erişimi henüz yapılandırılmadı.",
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
    notify("Tasarım JSON olarak dışa aktarıldı");
  };
  async function importPage(file?: File) {
    if (!file) return;
    try {
      if (file.size > 1024 * 1024)
        throw new Error("Dosya 1 MB sınırını aşıyor.");
      const input = JSON.parse(await file.text());
      const result = await api<{ document: PageDocument }>(
        "/documents/validate",
        { method: "POST", body: json({ document: input }) },
      );
      commit(() => result.document);
      setSelected(firstHeading(result.document.nodes));
      notify("Tasarım içe aktarıldı");
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
        throw new Error("Yayınlamadan önce taslak kaydedilmeli.");
      await api(`/pages/${pageId}/publish`, { method: "POST", body: "{}" });
      setPublished(true);
      notify("Yerel önizleme yayınlandı. Shopify’a gönderilmedi.");
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      setPublishing(false);
    }
  }
  if (!page)
    return (
      <div className="loading-screen">
        <Loader2 className="spin" /> Editör hazırlanıyor…
      </div>
    );
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
      else if (action === "copyStyle")
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
        const width = Number(action.split(":")[1]);
        changeSelected((n) => ({
          ...n,
          children: n.children.map((c, i) =>
            i < 2
              ? {
                  ...c,
                  styles: {
                    ...c.styles,
                    [device]: {
                      ...c.styles[device],
                      width: `${i === 0 ? width : 100 - width}%`,
                      flexBasis: `${i === 0 ? width : 100 - width}%`,
                    },
                  },
                }
              : c,
          ),
        }));
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
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
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
              title="Mağazalara dön"
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
                aria-label="Sayfa adı"
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
                title="Geri al (Ctrl+Z)"
                aria-label="Geri al"
                disabled={!past.current.length}
                onClick={undo}
              >
                <Undo2 size={17} />
              </button>
              <button
                title="İleri al (Ctrl+Shift+Z)"
                aria-label="İleri al"
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
                aria-label="Önizleme genişliği"
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
                title="Cihaz genişliğine dön"
                onClick={() => setCustomWidth(null)}
              >
                ↺
              </button>
            </div>
            <div className="topbar-end">
              <span
                className={`save-indicator ${saveError ? "error" : ""}`}
                title={
                  saveError ||
                  (clean
                    ? "Tüm değişiklikler kaydedildi"
                    : "Kaydedilmemiş değişiklikler")
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
                  ? "Kaydedilemedi"
                  : saving
                    ? "Kaydediliyor"
                    : clean
                      ? "Kaydedildi"
                      : "Değiştirildi"}
              </span>
              <button
                className="top-action"
                onClick={() => void save()}
                disabled={saving}
              >
                Kaydet
              </button>
              <button className="top-action" onClick={() => setPreview(true)}>
                <Eye size={14} /> Önizle
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
                {published ? "Yerel yayın güncelle" : "Yerel yayın"}
                <ChevronDown size={12} />
              </button>
              <div className="more-menu">
                <button
                  className="icon-button"
                  aria-label="Tasarım işlemleri"
                  onClick={() => setMenu(!menu)}
                >
                  <MoreHorizontal size={18} />
                </button>
                {menu && (
                  <div className="dropdown-menu">
                    <button onClick={exportPage}>
                      <Download size={14} /> JSON dışa aktar
                    </button>
                    <button onClick={() => importRef.current?.click()}>
                      <Upload size={14} /> JSON içe aktar
                    </button>
                    <button
                      onClick={() => {
                        setLibrary("templates");
                        setMenu(false);
                      }}
                    >
                      <LayoutTemplate size={14} /> Başlangıç şablonları
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>
          <div className="studio-workspace">
            <nav className="tool-rail">
              <div>
                {[
                  ["blocks", Plus, "Öğeler"],
                  ["sections", LayoutTemplate, "Bölümler"],
                  ["layers", Layers, "Katmanlar"],
                  ["templates", LayoutTemplate, "Şablonlar"],
                  ["theme", StoreIcon, "Tema"],
                  ["media", Upload, "Medya"],
                  ["brand", LayoutTemplate, "Marka"],
                  ["workflow", MoreHorizontal, "Sayfa"],
                  ["catalog", StoreIcon, "Ürünler"],
                  ["growth", LayoutTemplate, "Akışlar"],
                  ...(role === "owner"
                    ? [["team", ShieldCheck, "Hesaplar"]]
                    : []),
                ].map(([id, Tool, title]) => {
                  const Icon = Tool as typeof Plus;
                  return (
                    <button
                      key={String(id)}
                      className={library === id ? "active" : ""}
                      title={String(title)}
                      onClick={() => setLibrary(String(id))}
                    >
                      <Icon size={20} />
                      <span>{String(title)}</span>
                    </button>
                  );
                })}
              </div>
              <button
                title="Mağaza yönetimi"
                onClick={async () => {
                  if (await save()) back();
                }}
              >
                <ShieldCheck size={20} />
                <span>Yönetim</span>
              </button>
            </nav>
            <aside className="library">
              <div className="library-heading">
                <div>
                  <h2>
                    {(
                      {
                        media: "Medya kütüphanesi",
                        brand: "Marka kiti",
                        workflow: "Sayfa ayarları",
                        catalog: "Yerel ürünler",
                        growth: "Diller ve akışlar",
                      } as Record<string, string>
                    )[library] ||
                      (library === "sections"
                        ? "Bölüm bölüm tasarla."
                        : library === "theme"
                          ? "Mağazanın teması."
                          : library === "blocks"
                            ? "Bir şeyler oluştur."
                            : library === "layers"
                              ? "Katmanlar"
                              : "İyi bir başlangıç.")}
                  </h2>
                  <p>
                    {library === "sections"
                      ? "Hazır bir bölüm ekle, her ayrıntıyı düzenle."
                      : library === "theme"
                        ? "Header, footer ve mevcut bölüm sırası."
                        : library === "blocks"
                          ? "Sürükle, bırak, kendine göre düzenle."
                          : library === "layers"
                            ? "Sayfanın yapısını yönet."
                            : "Bir şablon seç, kendi hikâyeni anlat."}
                  </p>
                </div>
              </div>
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
                />
              )}
              {library === "sections" && (
                <SectionLibrary
                  saved={savedSections}
                  addPreset={addPreset}
                  addSaved={addSaved}
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
                      aria-label="Öğe ara"
                      placeholder="Öğe ara…"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                    <span>⌘ K</span>
                  </label>
                  <div className="library-scroll">
                    {groups.map((group) => {
                      const filtered = group.kinds.filter((kind) =>
                        labels[kind]
                          .toLocaleLowerCase("tr")
                          .includes(search.toLocaleLowerCase("tr")),
                      );
                      return (
                        !!filtered.length && (
                          <section className="palette-group" key={group.name}>
                            <h3>
                              {group.name}
                              <ChevronDown size={12} />
                            </h3>
                            <div className="palette-grid">
                              {filtered.map((kind) => (
                                <PaletteItem
                                  key={kind}
                                  kind={kind}
                                  onAdd={() => add(kind)}
                                />
                              ))}
                            </div>
                          </section>
                        )
                      );
                    })}
                    {!groups.some((group) =>
                      group.kinds.some((kind) =>
                        labels[kind]
                          .toLocaleLowerCase("tr")
                          .includes(search.toLocaleLowerCase("tr")),
                      ),
                    ) && (
                      <p className="setting-help">Eşleşen öğe bulunamadı.</p>
                    )}
                  </div>
                  <div className="library-tip">
                    <MousePointer2 size={15} />
                    <p>
                      Öğeyi sürükle veya tıklayarak ekle.
                      <br />
                      <span>Metne çift tıkla ve yazmaya başla.</span>
                    </p>
                  </div>
                </>
              )}
              {library === "layers" && (
                <div className="library-scroll layer-tree">
                  <input
                    aria-label="Katman ara"
                    placeholder="Katman ara"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
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
                        !search ||
                        JSON.stringify(node)
                          .toLocaleLowerCase("tr")
                          .includes(search.toLocaleLowerCase("tr")),
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
                    <p className="setting-help">İlk öğeni kütüphaneden ekle.</p>
                  )}
                </div>
              )}
              {library === "templates" && (
                <div className="library-scroll template-list">
                  {[
                    ["Aura · Product launch", "aura", "Ürününü öne çıkar."],
                    [
                      "Minimal · Editorial",
                      "editorial",
                      "Sade tasarım, güçlü hikâye.",
                    ],
                    [
                      "Fresh · Summer sale",
                      "sale",
                      "Kampanyanı canlı renklerle anlat.",
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
                          "Şablon uygulandı. Geri al ile önceki tasarıma dönebilirsin.",
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
                        Şablonu kullan <ChevronRight size={12} />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </aside>
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
                  {deviceNames[device]} görünümü
                </span>
                <span>
                  {themeSnapshot
                    ? `${themeSnapshot.themeName} · tema verisi okundu`
                    : "Yerel taslak · Shopify bağlı değil"}
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
                          resizeColumn={(id, value) =>
                            commit(
                              (d) => ({
                                ...d,
                                nodes: mapBlock(d.nodes, id, (n) => ({
                                  ...n,
                                  children: n.children.map((c, i) =>
                                    i < 2
                                      ? {
                                          ...c,
                                          styles: {
                                            ...c.styles,
                                            [device]: {
                                              ...c.styles[device],
                                              width: `${i === 0 ? value : 100 - value}%`,
                                              flexBasis: `${i === 0 ? value : 100 - value}%`,
                                            },
                                          },
                                        }
                                      : c,
                                  ),
                                })),
                              }),
                              `resize:${id}:${device}`,
                            )
                          }
                          updateHtml={updateHtml}
                          duplicate={duplicate}
                          remove={remove}
                          dragging={!!dragging}
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
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      const node = createBlock("section");
                      commit((document) => insertSection(document, node, null));
                      setSelected(node.id);
                    }}
                  >
                    <Plus size={15} /> Yeni bölüm ekle
                  </button>
                </div>
              </div>
              <footer className="canvas-footer">
                <div>
                  <MousePointer2 size={12} />
                  <span>
                    {selectedNode?.name ?? "Bir öğe seç"}
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
                    title="Uzaklaştır"
                    onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                  >
                    <ZoomOut size={14} />
                  </button>
                  <button onClick={() => setZoom(1)} title="Ekrana sığdır">
                    {Math.round(scale * 100)}%
                  </button>
                  <button
                    title="Yakınlaştır"
                    onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}
                  >
                    <ZoomIn size={14} />
                  </button>
                </div>
              </footer>
            </main>
            <div className="inspector-container">
              <SelectionTools
                node={selectedNode}
                count={
                  selection.includes(selected || "") ? selection.length : 1
                }
                command={command}
              />
              {selectedThemeSection && selectedNativeSnapshot ? (
                <NativeThemeInspector
                  section={selectedThemeSection}
                  snapshot={selectedNativeSnapshot}
                />
              ) : (
                <Inspector
                  node={selectedNode}
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
                />
              )}
            </div>
          </div>
          {contextMenu && (
            <div
              className="editor-context-menu"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              {[
                ["copyStyle", "Stili kopyala"],
                ["pasteStyle", "Stili yapıştır"],
                ["copyBlocks", "Öğeleri kopyala"],
                ["pasteBlocks", "Öğeleri yapıştır"],
                ["parent", "Üst öğeyi seç"],
                ["lock", "Kilidi değiştir"],
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
              <button onClick={() => setContextMenu(null)}>Kapat</button>
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
              <span>Metin</span>
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
                        "Biçimlendirmek için tasarım alanındaki metni seç.",
                      );
                      return;
                    }
                    document.execCommand(command);
                  }}
                >
                  {label}
                </button>
              ))}
              <small>Metne çift tıkla</small>
            </div>
          )}
        </div>
        <DragOverlay>
          {dragging && (
            <div className="drag-chip">
              <GripVertical size={16} />
              {dragging.startsWith("palette:")
                ? labels[dragging.split(":")[1] as Kind]
                : "Öğeyi taşı"}
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
                <b>Önizleme</b>
              </button>
              <span className="preview-label">
                Yerel tasarım önizlemesi · Shopify bağlantısı yok
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
                aria-label="Önizlemeyi kapat"
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
