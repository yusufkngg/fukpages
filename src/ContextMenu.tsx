import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  run: () => void;
}

/**
 * Right-click menu for canvas elements: grouped actions with icons and
 * shortcuts, kept inside the window and usable with the arrow keys.
 */
export function ContextMenu({
  x,
  y,
  title,
  groups,
  close,
}: {
  x: number;
  y: number;
  title: string;
  groups: ContextMenuItem[][];
  close: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const { width, height } = menu.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - height - 8)),
    });
    menu
      .querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
      ?.focus({ preventScroll: true });
  }, [x, y]);
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const items = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ),
    ];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
            items.length;
    items[next]?.focus();
  };
  return (
    <div
      ref={ref}
      className="editor-context-menu"
      role="menu"
      aria-label={title}
      style={position}
      onKeyDown={keys}
      onContextMenu={(event) => event.preventDefault()}
    >
      <p className="context-menu-title">{title}</p>
      {groups
        .filter((group) => group.length)
        .map((group, index) => (
          <div className="context-menu-group" role="group" key={index}>
            {group.map(
              ({ id, label, icon: Icon, shortcut, disabled, danger, run }) => (
                <button
                  key={id}
                  role="menuitem"
                  data-action={id}
                  className={danger ? "danger" : undefined}
                  disabled={disabled}
                  onClick={() => {
                    close();
                    run();
                  }}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                  {shortcut && <kbd>{shortcut}</kbd>}
                </button>
              ),
            )}
          </div>
        ))}
    </div>
  );
}
