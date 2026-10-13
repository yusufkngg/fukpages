import { useEffect, useRef, useState, type RefObject } from "react";
import { effectiveStyle, type Block, type Device } from "./model";
export function columnWidths(node: Block, device: Device) {
  const values = node.children.map((n) =>
      Math.max(0, parseFloat(String(effectiveStyle(n, device).width)) || 1),
    ),
    sum = values.reduce((s, v) => s + v, 0);
  return values.map((v) => (v / sum) * 100);
}
export function resizeColumns(
  node: Block,
  device: Device,
  value: number,
  pairIndex?: number,
): Block {
  const widths = columnWidths(node, device);
  if (pairIndex !== undefined) {
    const total = (widths[pairIndex] || 0) + (widths[pairIndex + 1] || 0);
    widths[pairIndex] = (total * value) / 100;
    widths[pairIndex + 1] = (total * (100 - value)) / 100;
  } else {
    const remainder = widths.slice(1).reduce((s, v) => s + v, 0);
    widths.forEach((_, i) => {
      if (i) widths[i] = (widths[i] / remainder) * (100 - value);
    });
    widths[0] = value;
  }
  return {
    ...node,
    children: node.children.map((child, i) => ({
      ...child,
      styles: {
        ...child.styles,
        [device]: {
          ...child.styles[device],
          width: widths[i] + "%",
          flexBasis: widths[i] + "%",
        },
      },
    })),
  };
}
export function ColumnHandles({
  rowRef,
  count,
  resize,
}: {
  rowRef: RefObject<HTMLDivElement | null>;
  count: number;
  resize: (value: number, index: number) => void;
}) {
  const [positions, setPositions] = useState<number[]>([]),
    drag = useRef<{
      x: number;
      pair: number;
      ratio: number;
      index: number;
    } | null>(null);
  const children = () =>
    [
      ...(rowRef.current?.querySelectorAll<HTMLElement>(
        ":scope > .editor-block",
      ) || []),
    ].filter((el) => el.getBoundingClientRect().width > 0);
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = () => {
      const r = row.getBoundingClientRect(),
        kids = children();
      setPositions(
        kids
          .slice(0, -1)
          .map(
            (child, i) =>
              (((child.getBoundingClientRect().right +
                kids[i + 1].getBoundingClientRect().left) /
                2 -
                r.left) /
                r.width) *
              100,
          ),
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    children().forEach((child) => observer.observe(child));
    measure();
    return () => observer.disconnect();
  }, [rowRef, count]);
  return (
    <>
      {positions.map((left, index) => (
        <div
          key={index}
          className="column-resize-handle"
          role="separator"
          tabIndex={0}
          aria-label={
            index === 0
              ? "Kolonları boyutlandır"
              : `${index + 1}. ve ${index + 2}. kolonları boyutlandır`
          }
          style={{ left: left + "%" }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            const kids = children(),
              a = kids[index]?.getBoundingClientRect(),
              b = kids[index + 1]?.getBoundingClientRect();
            if (!a || !b) return;
            drag.current = {
              x: e.clientX,
              pair: a.width + b.width,
              ratio: (a.width / (a.width + b.width)) * 100,
              index,
            };
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const g = drag.current;
            if (g) {
              e.stopPropagation();
              resize(
                Math.max(
                  10,
                  Math.min(90, g.ratio + ((e.clientX - g.x) / g.pair) * 100),
                ),
                g.index,
              );
            }
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onKeyDown={(e) => {
            if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
            e.preventDefault();
            const kids = children(),
              a = kids[index].getBoundingClientRect(),
              b = kids[index + 1].getBoundingClientRect();
            resize(
              Math.max(
                10,
                Math.min(
                  90,
                  (a.width / (a.width + b.width)) * 100 +
                    (e.key === "ArrowRight" ? 5 : -5),
                ),
              ),
              index,
            );
          }}
        />
      ))}
    </>
  );
}
