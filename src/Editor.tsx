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
import { api, json } from "./api";
import { BlockContent, PageRenderer, richHtml } from "./Renderer";
import { Inspector } from "./Inspector";
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
}
interface EditorProps {
  pageId: string;
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
}: {
  node: Block;
  parent?: string | null;
  index?: number;
  horizontalParent?: boolean;
  device: Device;
  selected: string | null;
  select: (id: string) => void;
  updateHtml: (id: string, value: string) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  dragging: boolean;
}) {
  const drag = useDraggable({
    id: `node:${node.id}`,
    data: { nodeId: node.id },
  });
  const drop = useDroppable({
    id: `inside:${node.id}`,
    data: { parent: node.id, index: node.children.length },
    disabled: !isContainer(node.kind),
  });
  if (node.hidden[device]) return null;
  const style = effectiveStyle(node, device);
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
      className={`content-block editor-block ${selected === node.id ? "selected" : ""} ${drag.isDragging ? "moving" : ""} ${drop.isOver ? "drop-inside" : ""}`}
      style={style}
      onClick={(event) => {
        event.stopPropagation();
        select(node.id);
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
      <BlockContent
        node={node}
        editable
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
  select: (id: string) => void;
  dragging: boolean;
}) {
  const [open, setOpen] = useState(true);
  const drag = useDraggable({
    id: `layer:${node.id}`,
    data: { nodeId: node.id },
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
          onClick={() => select(node.id)}
        >
          <Icon size={14} />
          <span>{node.name}</span>
        </button>
        <span className="layer-kind">{node.hidden.mobile && "M̸"}</span>
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
export function Editor({ pageId, store, back, notify }: EditorProps) {
  const [page, setPage] = useState<PageDocument | null>(null);
  const pageRef = useRef<PageDocument | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [library, setLibrary] = useState("blocks");
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
      })
      .catch((error) => notify(error.message, true));
    return () => {
      current = false;
    };
  }, [pageId, notify]);
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
      if (!node || !where) return;
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
      if (event.key === "Escape") {
        setSelected(null);
        setPreview(false);
        setMenu(false);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [selected, undo, redo, duplicate, remove, save]);
  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    const target = event.over?.data.current;
    if (!target || !pageRef.current) return;
    const { parent, index } = target as {
      parent: string | null;
      index: number;
    };
    if (event.active.data.current?.kind) {
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
  const scale = Math.max(0.15, Math.min(1, available / widths[device]) * zoom);
  const clean = JSON.stringify(page) === saved;
  const updateHtml = (id: string, html: string) =>
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
  const changeSelected = (change: (node: Block) => Block, key?: string) =>
    selected &&
    commit(
      (document) => ({
        ...document,
        nodes: mapBlock(document.nodes, selected, change),
      }),
      key,
    );
  const moveSelected = (direction: -1 | 1) => {
    if (!selected) return;
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
    setSelected(id);
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
                onClick={() => setDevice(key)}
              >
                <Icon size={17} />
              </button>
            ))}
            <span>{widths[device]}px</span>
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
                ["layers", Layers, "Katmanlar"],
                ["templates", LayoutTemplate, "Şablonlar"],
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
                  {library === "blocks"
                    ? "Bir şeyler oluştur."
                    : library === "layers"
                      ? "Katmanlar"
                      : "İyi bir başlangıç."}
                </h2>
                <p>
                  {library === "blocks"
                    ? "Sürükle, bırak, kendine göre düzenle."
                    : library === "layers"
                      ? "Sayfanın yapısını yönet."
                      : "Bir şablon seç, kendi hikâyeni anlat."}
                </p>
              </div>
            </div>
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
                  ) && <p className="setting-help">Eşleşen öğe bulunamadı.</p>}
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
                {page.nodes.map((node, index) => (
                  <Layer
                    key={node.id}
                    node={node}
                    index={index}
                    depth={0}
                    selected={selected}
                    select={selectLayer}
                    dragging={!!dragging}
                  />
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
          <main className="canvas-area" ref={canvasRef}>
            <div className="canvas-topline">
              <span>
                <span className="canvas-status-dot" />
                {deviceNames[device]} görünümü
              </span>
              <span>Yerel taslak · Shopify bağlı değil</span>
            </div>
            <div className="canvas-scroll" onClick={() => setSelected(null)}>
              <div
                className="canvas-sheet-holder"
                style={{ width: widths[device] * scale, marginBottom: -30 }}
              >
                <div
                  className="canvas-sheet"
                  style={
                    { width: widths[device], zoom: scale } as CSSProperties
                  }
                >
                  <div className="canvas-browser">
                    <div>
                      <i />
                      <i />
                      <i />
                    </div>
                    <span>
                      {store.name.toLowerCase().replaceAll(" ", "-")}.preview /{" "}
                      {page.type}
                    </span>
                    <ShieldCheck size={11} />
                  </div>
                  <div className="page-surface editable-surface">
                    {page.nodes.map((node, index) => (
                      <CanvasNode
                        key={node.id}
                        node={node}
                        index={index}
                        device={device}
                        selected={selected}
                        select={setSelected}
                        updateHtml={updateHtml}
                        duplicate={duplicate}
                        remove={remove}
                        dragging={!!dragging}
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
                    commit((document) => ({
                      ...document,
                      nodes: [...document.nodes, node],
                    }));
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
          <Inspector
            node={selectedNode}
            device={device}
            update={(change, key) => {
              changeSelected(change, key);
            }}
            duplicate={() => selected && duplicate(selected)}
            remove={() => selected && remove(selected)}
            move={moveSelected}
          />
        </div>
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
                    anchor instanceof Element ? anchor : anchor?.parentElement;
                  const editable = element?.closest(".rich-content");
                  if (
                    !editable ||
                    editable
                      .closest("[data-node-id]")
                      ?.getAttribute("data-node-id") !== selected
                  ) {
                    notify("Biçimlendirmek için tasarım alanındaki metni seç.");
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
                  onClick={() => setDevice(key)}
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
              <PageRenderer document={page} device={device} />
            </div>
          </div>
        </div>
      )}
    </DndContext>
  );
}
