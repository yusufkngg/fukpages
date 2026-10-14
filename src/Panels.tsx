// Tabs and carousels whose panels are real child blocks: every heading, image
// or button inside a tab or slide is an ordinary element that can be
// selected, styled and moved. Only the active panel is shown.
import { t } from "./i18n.ts";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Block } from "./model";

export const panelEvent = "fukpages:show-panel";
/** Asks a tabs/carousel block on the canvas to show one of its panels. */
export function showPanel(id: string, index: number) {
  window.dispatchEvent(new CustomEvent(panelEvent, { detail: { id, index } }));
}
export const panelTitle = (panel: Block, index: number, kind: string) =>
  String(
    panel.props.panelTitle ||
      (kind === "tabs"
        ? t("Sekme {p0}", { p0: index + 1 })
        : t("Slayt {p0}", { p0: index + 1 })),
  );

function usePanels(node: Block, editable: boolean) {
  const [active, setActive] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const lastSelection = useRef("");
  const count = node.children.length;
  const current = count ? Math.min(active, count - 1) : 0;
  useEffect(() => {
    const listener = (event: Event) => {
      const { id, index } = (event as CustomEvent).detail || {};
      if (id === node.id) setActive(Number(index) || 0);
    };
    window.addEventListener(panelEvent, listener);
    return () => window.removeEventListener(panelEvent, listener);
  }, [node.id]);
  useLayoutEffect(() => {
    const element = track.current;
    if (!element) return;
    // Panels are matched by block id: hidden blocks render nothing, so DOM
    // order alone would not line up with the tab titles.
    const panels = ([...element.children] as HTMLElement[]).map((el) => ({
      el,
      index: node.children.findIndex(
        (child) => child.id === (el.dataset.nodeId || el.dataset.block),
      ),
    }));
    // In the editor, selecting something inside a hidden panel reveals it.
    // Only a new selection does this, so tab clicks still switch freely.
    if (editable) {
      const holder = panels.find(
        ({ el }) => el.matches(".selected") || !!el.querySelector(".selected"),
      );
      const selected = holder
        ? ((holder.el.matches(".selected")
            ? holder.el
            : holder.el.querySelector(".selected")
          )?.getAttribute("data-node-id") ?? "")
        : "";
      const changed = selected !== lastSelection.current;
      lastSelection.current = selected;
      if (changed && holder && holder.index >= 0 && holder.index !== current) {
        setActive(holder.index);
        return;
      }
    }
    panels.forEach(({ el, index }) => {
      if (index === current) el.removeAttribute("data-panel-hidden");
      else el.setAttribute("data-panel-hidden", "");
    });
  });
  return { active: current, setActive, track, count };
}

export function PanelTabs({
  node,
  editable,
  children,
}: {
  node: Block;
  editable: boolean;
  children: ReactNode;
}) {
  const { active, setActive, track, count } = usePanels(node, editable);
  const focus = (index: number) =>
    document.getElementById(`${node.id}-tab-${index}`)?.focus();
  return (
    <div className="builder-tabs panel-tabs">
      <div role="tablist" aria-label={String(node.props.title || "")}>
        {node.children.map((panel, index) => (
          <button
            key={panel.id}
            type="button"
            role="tab"
            id={`${node.id}-tab-${index}`}
            aria-selected={active === index}
            aria-controls={`${node.id}-panel`}
            tabIndex={active === index ? 0 : -1}
            onClick={() => setActive(index)}
            onKeyDown={(event) => {
              const keys: Record<string, number> = {
                ArrowRight: (index + 1) % count,
                ArrowLeft: (index - 1 + count) % count,
                Home: 0,
                End: count - 1,
              };
              if (!(event.key in keys)) return;
              event.preventDefault();
              event.stopPropagation();
              setActive(keys[event.key]);
              focus(keys[event.key]);
            }}
          >
            {panelTitle(panel, index, "tabs")}
          </button>
        ))}
      </div>
      <div
        ref={track}
        className="panel-track"
        role="tabpanel"
        id={`${node.id}-panel`}
        aria-labelledby={`${node.id}-tab-${active}`}
      >
        {children}
      </div>
    </div>
  );
}

export function PanelCarousel({
  node,
  editable,
  children,
}: {
  node: Block;
  editable: boolean;
  children: ReactNode;
}) {
  const { active, setActive, track, count } = usePanels(node, editable);
  const go = (index: number) => setActive((index + count) % Math.max(1, count));
  const auto = Number(node.props.autoplay || 0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (editable || !auto || paused || count < 2) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(
      () => setActive((n) => (n + 1) % count),
      Math.max(2, auto) * 1000,
    );
    return () => clearInterval(timer);
  }, [editable, auto, paused, count]);
  return (
    <div
      className="builder-carousel panel-carousel"
      role="region"
      aria-roledescription={t("carousel")}
      aria-label={String(node.props.title || t("Carousel"))}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        ref={track}
        className="panel-track"
        aria-live={auto && !paused ? "off" : "polite"}
      >
        {children}
      </div>
      {count > 1 && (
        <>
          <button
            type="button"
            className="panel-prev"
            aria-label={t("Önceki slayt")}
            onClick={() => go(active - 1)}
          >
            ←
          </button>
          <button
            type="button"
            className="panel-next"
            aria-label={t("Sonraki slayt")}
            onClick={() => go(active + 1)}
          >
            →
          </button>
          <div className="panel-dots">
            {node.children.map((panel, index) => (
              <button
                key={panel.id}
                type="button"
                aria-label={t("Slayt {p0}", { p0: index + 1 })}
                aria-current={active === index ? "true" : undefined}
                onClick={() => setActive(index)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
