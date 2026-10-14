import { getUiLanguage, t } from "./i18n.ts";
import { useEffect, useRef, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { ChevronDown, ChevronRight, Eye, EyeOff } from "lucide-react";
import { NodeSlot } from "./CanvasNode";
import { modeFor, type SelectMode } from "./selection";
import { blockIcons } from "./icons";
import { findBlock, isContainer, type Block, type Device } from "./model";

export function Layer({
  node,
  parent = null,
  index = 0,
  depth,
  selected,
  selection = [],
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
  selection?: string[];
  select: (id: string, mode?: SelectMode | boolean) => void;
  dragging: boolean;
  search?: string;
  visibility: (id: string) => void;
  device: Device;
  inheritedLocked?: boolean;
}) {
  const locked = inheritedLocked || !!node.props.locked;
  const [open, setOpen] = useState(depth > 0);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const expanded = open || Boolean(search.trim());
  const containsSelection =
    !!selected && selected !== node.id && !!findBlock(node.children, selected);
  // Reveal the selected element: open its ancestors once, but let the user
  // collapse them again afterwards.
  useEffect(() => {
    if (containsSelection) setOpen(true);
  }, [containsSelection, selected]);
  useEffect(() => {
    if (selected === node.id)
      rowRef.current?.scrollIntoView({ block: "nearest" });
  }, [selected, node.id]);
  const drag = useDraggable({
    id: `layer:${node.id}`,
    data: { nodeId: node.id },
    disabled: locked,
  });
  const drop = useDroppable({
    id: `layer-inside:${node.id}`,
    data: {
      parent: node.id,
      index: node.children.length,
      depth,
      target: "inside",
      parentKind: node.kind,
    },
    disabled: !isContainer(node.kind),
  });
  const Icon = blockIcons[node.kind];
  return (
    <>
      <div
        ref={(element) => {
          rowRef.current = element;
          drop.setNodeRef(element);
        }}
        data-layer-id={node.id}
        className={`layer-row ${selected === node.id ? "active" : selection.includes(node.id) ? "multi-selected" : ""} ${drop.isOver ? "drop-active" : ""}`}
        style={{ paddingLeft: depth * 14 + 10 }}
      >
        <NodeSlot
          context="layers"
          nodeId={node.id}
          parent={parent}
          index={index}
          side="before"
          dragging={dragging}
          depth={depth}
        />
        <NodeSlot
          context="layers"
          nodeId={node.id}
          parent={parent}
          index={index + 1}
          side="after"
          dragging={dragging}
          depth={depth}
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
          onClick={(e) => select(node.id, modeFor(e))}
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
              selection={selection}
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
