import { t } from "./i18n.ts";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Baseline,
  Bold,
  Check,
  Italic,
  Link2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Unlink,
  X,
} from "lucide-react";
import { normalizeLink } from "./links";

const editableSelector =
  '.editable-surface .rich-content[contenteditable="true"]';
const formats = [
  ["bold", Bold, "Kalın"],
  ["italic", Italic, "İtalik"],
  ["underline", Underline, "Altı çizili"],
  ["strikeThrough", Strikethrough, "Üstü çizili"],
] as const;
const presetColors = [
  "#111111",
  "#ffffff",
  "#6b7280",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#2563eb",
  "#7c3aed",
  "#db2777",
];

/**
 * Formatting bar that floats next to the text being edited on the canvas.
 * It only exists while a rich text block is in edit mode (double-click).
 */
export function TextToolbar({ brandColors }: { brandColors: string[] }) {
  const toolbar = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLElement | null>(null);
  const range = useRef<Range | null>(null);
  const [editing, setEditing] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({
    top: -1000,
    left: -1000,
  });
  const [panel, setPanel] = useState<"" | "color" | "link">("");
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState(false);
  const [, refresh] = useState(0);

  const place = useCallback(() => {
    const element = target.current;
    const bar = toolbar.current;
    if (!element || !bar) return;
    const box = element.getBoundingClientRect();
    // Sit above the element's own toolbar so both stay usable.
    const blockBar = element
      .closest(".editor-block")
      ?.querySelector(":scope > [data-block-toolbar]")
      ?.getBoundingClientRect();
    const anchorTop = Math.min(box.top, blockBar?.top ?? box.top);
    const canvas = element.closest(".canvas-area")?.getBoundingClientRect() ?? {
      top: 0,
      left: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
    };
    const height = bar.offsetHeight || 40;
    const width = bar.offsetWidth || 320;
    let top = anchorTop - height - 8;
    if (top < canvas.top + 4) top = box.bottom + 10;
    if (top + height > canvas.bottom - 4)
      top = Math.max(canvas.top + 4, canvas.bottom - height - 4);
    const left = Math.max(
      canvas.left + 6,
      Math.min(box.left, canvas.right - width - 6),
    );
    setPosition({ top, left });
  }, []);

  useEffect(() => {
    const update = () => {
      const active = document.activeElement;
      // Typing in the toolbar's own fields must not re-render it mid-event:
      // that would reset the controlled input before React reads it.
      if (
        active instanceof HTMLInputElement &&
        toolbar.current?.contains(active)
      )
        return;
      let next: HTMLElement | null =
        active instanceof HTMLElement && active.matches(editableSelector)
          ? active
          : null;
      // Keep the current text while the user works inside the toolbar.
      if (
        !next &&
        active &&
        toolbar.current?.contains(active) &&
        target.current?.isConnected &&
        target.current.isContentEditable
      )
        next = target.current;
      if (next !== target.current) {
        setPanel("");
        setLinkError(false);
      }
      target.current = next;
      setEditing(next);
      const selection = window.getSelection();
      if (next && selection?.rangeCount && next.contains(selection.anchorNode))
        range.current = selection.getRangeAt(0).cloneRange();
      place();
      refresh((n) => n + 1);
    };
    const later = () => requestAnimationFrame(update);
    document.addEventListener("selectionchange", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", later);
    document.addEventListener("input", update, true);
    document.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      document.removeEventListener("selectionchange", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", later);
      document.removeEventListener("input", update, true);
      document.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [place]);

  useLayoutEffect(() => {
    if (editing) place();
  }, [editing, panel, place]);

  useEffect(() => {
    if (!editing) return;
    const shortcut = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k" &&
        document.activeElement === target.current
      ) {
        // Inside text, Ctrl/Cmd+K edits a link instead of opening search.
        event.preventDefault();
        event.stopPropagation();
        setLink(currentLink()?.getAttribute("href") || "");
        setLinkError(false);
        setPanel("link");
      }
    };
    document.addEventListener("keydown", shortcut, true);
    return () => document.removeEventListener("keydown", shortcut, true);
  }, [editing]);

  /** Put the caret/selection back into the text before running a command. */
  const restore = () => {
    const element = target.current;
    if (!element) return false;
    // Focusing fires focusin synchronously, which records a new caret; keep
    // the selection the user made before focus left the text.
    const saved = range.current;
    if (document.activeElement !== element) element.focus();
    if (saved && element.contains(saved.commonAncestorContainer)) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(saved);
    }
    return true;
  };
  const exec = (command: string, value?: string) => {
    if (!restore()) return;
    document.execCommand(command, false, value);
    const selection = window.getSelection();
    if (selection?.rangeCount)
      range.current = selection.getRangeAt(0).cloneRange();
    refresh((n) => n + 1);
  };
  const applyColor = (color: string) => {
    if (!restore()) return;
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("foreColor", false, color);
    document.execCommand("styleWithCSS", false, "false");
    setPanel("");
  };
  const currentLink = () => {
    const node = range.current?.commonAncestorContainer;
    const element = node instanceof Element ? node : node?.parentElement;
    return element?.closest("a") ?? null;
  };
  const applyLink = () => {
    const href = normalizeLink(link);
    if (!href) {
      setLinkError(true);
      return;
    }
    if (!restore()) return;
    const selection = window.getSelection();
    const existing = currentLink();
    if (existing && target.current?.contains(existing)) {
      existing.setAttribute("href", href);
      target.current.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (selection && !selection.isCollapsed)
      document.execCommand("createLink", false, href);
    else document.execCommand("insertHTML", false, linkMarkup(href));
    setPanel("");
    setLink("");
    setLinkError(false);
  };
  if (!editing) return null;
  const state = (command: string) => {
    try {
      return document.queryCommandState(command);
    } catch {
      return false;
    }
  };
  const colors = [...new Set([...brandColors, ...presetColors])].slice(0, 14);
  const linked = currentLink();
  return (
    <div
      ref={toolbar}
      className="text-toolbar"
      role="toolbar"
      aria-label={t("Metin biçimi")}
      data-text-toolbar
      style={{ top: position.top, left: position.left }}
      onMouseDown={(event) => {
        // Buttons must not steal the text selection.
        if (!(event.target as HTMLElement).closest("input"))
          event.preventDefault();
      }}
    >
      <div className="text-toolbar-row">
        {formats.map(([command, Icon, label]) => (
          <button
            key={command}
            aria-label={t(label)}
            title={t(label)}
            aria-pressed={state(command)}
            onClick={() => exec(command)}
          >
            <Icon size={15} />
          </button>
        ))}
        <span className="text-toolbar-divider" />
        <button
          aria-label={t("Seçili metnin rengi")}
          title={t("Seçili metnin rengi")}
          aria-expanded={panel === "color"}
          onClick={() => setPanel(panel === "color" ? "" : "color")}
        >
          <Baseline size={15} />
        </button>
        <button
          aria-label={linked ? t("Bağlantıyı düzenle") : t("Bağlantı ekle")}
          title={linked ? t("Bağlantıyı düzenle") : t("Bağlantı ekle")}
          aria-pressed={!!linked}
          aria-expanded={panel === "link"}
          onClick={() => {
            setLink(linked?.getAttribute("href") || "");
            setLinkError(false);
            setPanel(panel === "link" ? "" : "link");
          }}
        >
          <Link2 size={15} />
        </button>
        {linked && (
          <button
            aria-label={t("Bağlantıyı kaldır")}
            title={t("Bağlantıyı kaldır")}
            onClick={() => {
              if (!restore()) return;
              const selection = window.getSelection();
              if (selection) {
                const whole = document.createRange();
                whole.selectNodeContents(linked);
                selection.removeAllRanges();
                selection.addRange(whole);
              }
              document.execCommand("unlink");
            }}
          >
            <Unlink size={15} />
          </button>
        )}
        <button
          aria-label={t("Biçimi temizle")}
          title={t("Biçimi temizle")}
          onClick={() => {
            exec("removeFormat");
            exec("unlink");
          }}
        >
          <RemoveFormatting size={15} />
        </button>
      </div>
      {panel === "color" && (
        <div className="text-toolbar-panel colour-swatches">
          {colors.map((color) => (
            <button
              key={color}
              aria-label={t("Renk {p0}", { p0: color })}
              title={color}
              style={{ background: color }}
              onClick={() => applyColor(color)}
            />
          ))}
          <label className="custom-colour" title={t("Özel renk")}>
            <input
              type="color"
              aria-label={t("Özel renk")}
              ref={(input) => {
                // Apply once the picker closes; live "input" events would
                // move focus back to the text while the picker is open.
                if (input) input.onchange = () => applyColor(input.value);
              }}
            />
          </label>
        </div>
      )}
      {panel === "link" && (
        <form
          className="text-toolbar-panel link-editor"
          onSubmit={(event) => {
            event.preventDefault();
            applyLink();
          }}
        >
          <input
            autoFocus
            aria-label={t("Bağlantı adresi")}
            aria-invalid={linkError}
            placeholder="https:// · /pages/… · #section"
            value={link}
            onChange={(event) => {
              setLink(event.target.value);
              setLinkError(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setPanel("");
                restore();
              }
            }}
          />
          <button type="submit" aria-label={t("Bağlantıyı uygula")}>
            <Check size={14} />
          </button>
          <button
            type="button"
            aria-label={t("Vazgeç")}
            onClick={() => {
              setPanel("");
              restore();
            }}
          >
            <X size={14} />
          </button>
          {linkError && (
            <small role="alert">{t("Geçerli bir bağlantı gir.")}</small>
          )}
        </form>
      )}
    </div>
  );
}

function linkMarkup(href: string) {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.setAttribute("href", href);
  anchor.textContent = href;
  return anchor.outerHTML;
}
