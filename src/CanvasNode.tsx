import { t } from "./i18n.ts";
import { useRef, type CSSProperties } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Copy, CornerLeftUp, GripVertical, Plus, Trash2 } from "lucide-react";
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
}: CanvasNodeProps) {
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
  const isSelected = selected === node.id;
  const Icon = blockIcons[node.kind];
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
      {isSelected && (
        <div className="block-toolbar" data-block-toolbar>
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
              onClick={(event) => {
                event.stopPropagation();
                select(parent);
              }}
            >
              <CornerLeftUp size={12} />
            </button>
          )}
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
