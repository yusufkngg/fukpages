import { useRef, useState } from "react";
export function usePanelWidths() {
  const [widths, setWidths] = useState<{ library: number; inspector: number }>(
    () => {
      try {
        const saved = JSON.parse(
          localStorage.getItem("fp-panel-widths") || "{}",
        );
        return {
          library: Math.max(220, Math.min(520, Number(saved.library) || 280)),
          inspector: Math.max(
            260,
            Math.min(560, Number(saved.inspector) || 330),
          ),
        };
      } catch {
        return { library: 280, inspector: 330 };
      }
    },
  );
  const update = (side: "library" | "inspector", width: number) =>
    setWidths((old) => {
      const min = side === "library" ? 220 : 260,
        max = Math.min(
          side === "library" ? 520 : 560,
          innerWidth - 420 - old[side === "library" ? "inspector" : "library"],
        );
      const next = {
        ...old,
        [side]: Math.max(min, Math.min(Math.max(min, max), Math.round(width))),
      };
      try {
        localStorage.setItem("fp-panel-widths", JSON.stringify(next));
      } catch {}
      return next;
    });
  return { widths, update };
}
export function PanelSplitter({
  side,
  width,
  update,
}: {
  side: "library" | "inspector";
  width: number;
  update: (width: number) => void;
}) {
  const drag = useRef<{ x: number; width: number } | null>(null);
  return (
    <div
      className="panel-splitter"
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={
        side === "library"
          ? "Kütüphane panelini boyutlandır"
          : "Ayar panelini boyutlandır"
      }
      aria-valuenow={width}
      aria-valuemin={side === "library" ? 220 : 260}
      aria-valuemax={side === "library" ? 520 : 560}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        drag.current = { x: e.clientX, width };
        e.currentTarget.setPointerCapture(e.pointerId);
        e.preventDefault();
      }}
      onPointerMove={(e) => {
        if (drag.current)
          update(
            drag.current.width +
              (e.clientX - drag.current.x) * (side === "library" ? 1 : -1),
          );
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onKeyDown={(e) => {
        if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
          e.preventDefault();
          update(
            width +
              (e.key === "ArrowRight" ? 16 : -16) *
                (side === "library" ? 1 : -1),
          );
        }
      }}
    />
  );
}
