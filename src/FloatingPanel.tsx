import { useRef, useState, type ReactNode } from "react";
import { GripVertical, X } from "lucide-react";
import { t } from "./i18n";
export function FloatingPanel({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const [position, setPosition] = useState(() => {
    try {
      const p = JSON.parse(localStorage.getItem("fp-layer-position") || "{}");
      return {
        x: Math.max(12, Math.min(innerWidth - 320, Number(p.x) || 365)),
        y: Math.max(70, Math.min(innerHeight - 200, Number(p.y) || 150)),
      };
    } catch {
      return { x: 365, y: 150 };
    }
  });
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  return (
    <aside
      className="floating-layer-panel"
      role="dialog"
      aria-label={title}
      style={{ left: position.x, top: position.y }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close();
        }
      }}
    >
      <header
        onPointerDown={(e) => {
          if (e.button || (e.target as HTMLElement).closest("button")) return;
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            left: position.x,
            top: position.y,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
          e.preventDefault();
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d)
            setPosition({
              x: Math.max(
                0,
                Math.min(innerWidth - 280, d.left + e.clientX - d.x),
              ),
              y: Math.max(
                60,
                Math.min(innerHeight - 100, d.top + e.clientY - d.y),
              ),
            });
        }}
        onPointerUp={() => {
          drag.current = null;
          try {
            localStorage.setItem("fp-layer-position", JSON.stringify(position));
          } catch {}
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
      >
        <GripVertical size={14} />
        <b>{title}</b>
        <button aria-label={t("Kapat")} onClick={close}>
          <X size={16} />
        </button>
      </header>
      <div className="floating-layer-body">{children}</div>
    </aside>
  );
}
