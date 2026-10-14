import { t } from "./i18n.ts";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  CornerLeftUp,
  GripVertical,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { ColumnHandles } from "./ColumnHandles";
import { ElementHandles, useElementGesture } from "./ElementHandles";
import { freeHeight, placedStyle } from "./freePlacement";
import { BlockContent } from "./Renderer";
import { assetUrl, brandStyle } from "./studio";
import { blockIcons } from "./icons";
import { isContainer, labels, type Block, type Device } from "./model";
import type { DropDescriptor } from "./dropTargets";

/** Invisible drop target on the leading or trailing edge of a block. */
export function NodeSlot({
  nodeId,
  parent,
  index,
  side,
  context = "canvas",
  dragging,
  horizontal = false,
  depth,
  parentKind = null,
  half = false,
}: {
  nodeId: string;
  parent: string | null;
  index: number;
  side: "before" | "after";
  context?: string;
  dragging: boolean;
  horizontal?: boolean;
  depth?: number;
  parentKind?: string | null;
  /** Leaves have no inside target, so their halves decide before/after. */
  half?: boolean;
}) {
  const data: DropDescriptor & {
    horizontal: boolean;
    owner: string;
    side: string;
  } = {
    parent,
    index,
    depth,
    target: "slot",
    parentKind,
    horizontal,
    owner: nodeId,
    side,
  };
  const { setNodeRef, isOver } = useDroppable({
    id: `${context}:${nodeId}:${side}`,
    data,
    disabled: !dragging,
  });
  return (
    <div
      ref={setNodeRef}
      className={`node-slot ${side} ${horizontal ? "horizontal" : ""} ${half ? "half" : ""} ${dragging ? "enabled" : ""} ${isOver ? "over" : ""}`}
      data-slot={`${parent ?? "root"}:${index}`}
    />
  );
}

/** Presses on these keep their own behaviour instead of moving the block. */
const pressExclusions = [
  '[contenteditable="true"]',
  "input",
  "textarea",
  "select",
  "[data-block-toolbar]",
  ".element-resize-handle",
  ".column-resize-handle",
  ".section-insert",
].join(",");

export interface CanvasNodeProps {
  node: Block;
  parent?: string | null;
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
  /** Double-click or Enter: edit text, choose an icon, replace an image. */
  activate?: (id: string) => void;
  move?: (id: string, direction: -1 | 1) => void;
  menu?: (id: string, x: number, y: number) => void;
}

export function CanvasNode({
  node,
  parent = null,
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
  activate,
  move,
  menu,
}: CanvasNodeProps) {
  const locked = inheritedLocked || !!node.props.locked;
  const elementRef = useRef<HTMLDivElement | null>(null);
  const isSelected = selected === node.id;
  // Like a page builder, the toolbar drops below a block that touches the
  // top of the page so it never covers the browser chrome or gets clipped.
  const [toolbarBelow, setToolbarBelow] = useState(false);
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!isSelected || !element) return;
    const surface = element.closest(".editable-surface");
    const top = element.getBoundingClientRect().top;
    setToolbarBelow(
      !!surface && top - surface.getBoundingClientRect().top < 28,
    );
  }, [isSelected]);
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
  const Icon = blockIcons[node.kind];
  const toolbarAction =
    (action: () => void) => (event: { stopPropagation: () => void }) => {
      event.stopPropagation();
      action();
    };
  return (
    <div
      ref={(element) => {
        elementRef.current = element;
        drag.setNodeRef(element);
      }}
      data-node-id={node.id}
      data-kind={node.kind}
      data-block={node.id}
      data-label={node.name}
      data-free-placed={parentFree || undefined}
      tabIndex={isSelected ? 0 : -1}
      aria-label={`${node.name} · ${labels[node.kind]}`}
      onFocus={(event) => {
        if (event.target === event.currentTarget) select(node.id);
      }}
      className={`content-block editor-block ${isSelected ? "selected" : ""} ${drag.isDragging ? "moving" : ""}`}
      style={style}
      onPointerDown={(event) => {
        // Only one block reacts to a press: the selected block when the
        // press lands inside it, otherwise the innermost block.
        const native = event.nativeEvent as PointerEvent & {
          fpBlock?: string;
        };
        if (native.fpBlock || event.button !== 0) return;
        const target = event.target as HTMLElement;
        if (
          !parentFree &&
          selected &&
          selected !== node.id &&
          event.currentTarget.parentElement?.closest(
            `[data-node-id="${CSS.escape(selected)}"]`,
          )
        )
          return;
        native.fpBlock = node.id;
        if (locked || target.closest(pressExclusions)) return;
        if (parentFree) {
          if (target.closest("button")) return;
          select(node.id);
          gesture.start(event, "move");
          return;
        }
        // Left-press and drag anywhere on the block to move it; a press
        // without movement stays a click (selection, double-click editing).
        drag.listeners?.onPointerDown?.(event);
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
      onDoubleClick={(event) => {
        // Text handles its own double-click (inline editing); everything
        // else opens its main setting, innermost block first.
        const target = event.target as HTMLElement;
        if (
          target.closest(
            '[contenteditable="true"],input,textarea,select,[data-block-toolbar]',
          )
        )
          return;
        event.stopPropagation();
        activate?.(node.id);
      }}
    >
      {isSelected && (
        <div
          className={`block-toolbar ${toolbarBelow ? "below" : ""}`}
          data-block-toolbar
          role="toolbar"
          aria-label={t("{p0} araçları", { p0: node.name })}
        >
          <span>
            <Icon size={11} />
            {node.name}
          </span>
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
          {parent && (
            <button
              title={t("Üst katmana çık")}
              aria-label={t("Üst katmana çık")}
              onClick={toolbarAction(() => select(parent))}
            >
              <CornerLeftUp size={12} />
            </button>
          )}
          {move && !locked && !parentFree && (
            <>
              <button
                title={t("Yukarı taşı")}
                aria-label={t("Yukarı taşı")}
                onClick={toolbarAction(() => move(node.id, -1))}
              >
                <ArrowUp size={12} />
              </button>
              <button
                title={t("Aşağı taşı")}
                aria-label={t("Aşağı taşı")}
                onClick={toolbarAction(() => move(node.id, 1))}
              >
                <ArrowDown size={12} />
              </button>
            </>
          )}
          <button
            title={t("Öğeyi çoğalt") + " (Ctrl+D)"}
            aria-label={t("Öğeyi çoğalt")}
            onClick={toolbarAction(() => duplicate(node.id))}
          >
            <Copy size={12} />
          </button>
          <button
            title={t("Öğeyi sil") + " (Delete)"}
            aria-label={t("Öğeyi sil")}
            onClick={toolbarAction(() => remove(node.id))}
          >
            <Trash2 size={12} />
          </button>
          {menu && (
            <button
              title={t("Diğer işlemler")}
              aria-label={t("Diğer işlemler")}
              aria-haspopup="menu"
              onClick={(event) => {
                event.stopPropagation();
                const box = event.currentTarget.getBoundingClientRect();
                menu(node.id, box.left, box.bottom + 4);
              }}
            >
              <MoreHorizontal size={13} />
            </button>
          )}
        </div>
      )}
      {isSelected &&
        node.kind === "row" &&
        node.children.length >= 2 &&
        node.children.every((child) => child.kind === "column") &&
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
            {node.children.map((child) => (
              <CanvasNode
                key={child.id}
                node={child}
                parent={node.id}
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
                activate={activate}
                move={move}
                menu={menu}
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
      {isSelected && !locked && !["section", "row"].includes(node.kind) && (
        <ElementHandles gesture={gesture} />
      )}
    </div>
  );
}

export function EmptyPage({ add }: { add: () => void }) {
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
