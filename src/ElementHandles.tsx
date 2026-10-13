import { useRef, type PointerEvent } from "react";
import { cssNumber } from "./freePlacement";
type Geometry = { left: number; top: number; width: number; height: number };
export function useElementGesture(
  element: () => HTMLElement | null,
  free: boolean,
  change: (box: Geometry, mode: string) => void,
) {
  const gesture = useRef<{
    x: number;
    y: number;
    scale: number;
    frameWidth: number;
    frameHeight: number;
    box: Geometry;
    mode: string;
  } | null>(null);
  const start = (event: PointerEvent<HTMLElement>, mode: string) => {
    if (event.button !== 0) return;
    const el = element(),
      frame = el?.parentElement;
    if (!el || !frame) return;
    const r = el.getBoundingClientRect(),
      f = frame.getBoundingClientRect();
    const scale = r.width / (el.offsetWidth || r.width) || 1;
    gesture.current = {
      x: event.clientX,
      y: event.clientY,
      scale,
      frameWidth: frame.clientWidth,
      frameHeight: frame.clientHeight,
      box: {
        left: (r.left - f.left) / scale,
        top: (r.top - f.top) / scale,
        width: r.width / scale,
        height: r.height / scale,
      },
      mode,
    };
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g) return;
    event.stopPropagation();
    const dx = (event.clientX - g.x) / g.scale,
      dy = (event.clientY - g.y) / g.scale;
    const next = { ...g.box };
    if (g.mode === "move") {
      next.left = Math.max(
        0,
        Math.min(g.frameWidth - next.width, g.box.left + dx),
      );
      next.top = Math.max(
        0,
        Math.min(g.frameHeight - next.height, g.box.top + dy),
      );
      if (!event.shiftKey) {
        next.left = Math.max(
          0,
          Math.min(g.frameWidth - next.width, Math.round(next.left / 8) * 8),
        );
        next.top = Math.max(
          0,
          Math.min(g.frameHeight - next.height, Math.round(next.top / 8) * 8),
        );
      }
    } else {
      if (g.mode.includes("e"))
        next.width = Math.max(
          32,
          Math.min(g.frameWidth - (free ? next.left : 0), g.box.width + dx),
        );
      if (g.mode.includes("s"))
        next.height = Math.max(
          24,
          Math.min(free ? g.frameHeight - next.top : 5000, g.box.height + dy),
        );
    }
    change(
      {
        ...next,
        left: cssNumber((next.left / g.frameWidth) * 100),
        top: cssNumber(next.top),
        width: cssNumber(free ? (next.width / g.frameWidth) * 100 : next.width),
        height: cssNumber(next.height),
      },
      g.mode,
    );
  };
  const stop = () => {
    gesture.current = null;
  };
  return { start, move, stop };
}
export function ElementHandles({
  gesture,
}: {
  gesture: ReturnType<typeof useElementGesture>;
}) {
  return (
    <>
      {(
        [
          ["e", "Genişliği boyutlandır"],
          ["s", "Yüksekliği boyutlandır"],
          ["se", "Öğeyi boyutlandır"],
        ] as const
      ).map(([mode, label]) => (
        <button
          key={mode}
          className={"element-resize-handle resize-" + mode}
          aria-label={label}
          data-resize={mode}
          onPointerDown={(e) => gesture.start(e, mode)}
          onPointerMove={gesture.move}
          onPointerUp={gesture.stop}
          onPointerCancel={gesture.stop}
          onClick={(e) => e.stopPropagation()}
        />
      ))}
    </>
  );
}
