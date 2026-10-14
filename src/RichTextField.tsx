// Inspector field for rich text: edits the same formatted content as the
// canvas (bold, italic, underline, links and colours survive), unlike a plain
// textarea that would flatten the markup on the first keystroke.
import { t } from "./i18n.ts";
import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Link2, RemoveFormatting, Underline } from "lucide-react";
import { richHtml } from "./Renderer";
import { normalizeLink } from "./links";

const commands = [
  ["bold", Bold, "Seçimi kalın yap"],
  ["italic", Italic, "Seçimi italik yap"],
  ["underline", Underline, "Seçimin altını çiz"],
] as const;

export function RichTextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (html: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const emitted = useRef<string | null>(null);
  const latest = useRef(value);
  latest.current = value;
  const range = useRef<Range | null>(null);
  const [linking, setLinking] = useState(false),
    [link, setLink] = useState(""),
    [linkError, setLinkError] = useState(false),
    [, refresh] = useState(0);
  // Outside changes (canvas edits, undo) replace the content; our own
  // keystrokes do not, so the caret stays where it is.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const clean = richHtml(value);
    if (emitted.current === clean && document.activeElement === el) return;
    if (el.innerHTML !== clean) el.innerHTML = clean;
    emitted.current = clean;
  }, [value]);
  const emit = () => {
    const el = box.current;
    if (!el) return;
    const clean = richHtml(el.innerHTML);
    emitted.current = clean;
    onChange(clean);
    refresh((n) => n + 1);
  };
  const keepSelection = () => {
    const selection = getSelection();
    if (
      selection?.rangeCount &&
      box.current?.contains(selection.getRangeAt(0).commonAncestorContainer)
    )
      range.current = selection.getRangeAt(0).cloneRange();
  };
  const restore = () => {
    box.current?.focus({ preventScroll: true });
    if (!range.current) return;
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range.current);
  };
  const run = (command: string, arg?: string) => {
    restore();
    document.execCommand(command, false, arg);
    emit();
  };
  const active = (command: string) => {
    try {
      return (
        document.activeElement === box.current &&
        document.queryCommandState(command)
      );
    } catch {
      return false;
    }
  };
  return (
    <div className="rich-field">
      <div
        className="rich-field-tools"
        role="toolbar"
        aria-label={t("Metin içeriği biçimlendirme")}
      >
        {commands.map(([command, Icon, name]) => (
          <button
            key={command}
            type="button"
            aria-label={t(name)}
            title={t(name)}
            aria-pressed={active(command)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(command)}
          >
            <Icon size={13} />
          </button>
        ))}
        <button
          type="button"
          aria-label={t("Bağlantı ekle")}
          title={t("Bağlantı ekle")}
          aria-expanded={linking}
          onMouseDown={(e) => {
            e.preventDefault();
            keepSelection();
          }}
          onClick={() => {
            setLinking(!linking);
            setLinkError(false);
          }}
        >
          <Link2 size={13} />
        </button>
        <button
          type="button"
          aria-label={t("Biçimi temizle")}
          title={t("Biçimi temizle")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            run("removeFormat");
            run("unlink");
          }}
        >
          <RemoveFormatting size={13} />
        </button>
      </div>
      {linking && (
        <form
          className="rich-field-link"
          onSubmit={(e) => {
            e.preventDefault();
            const href = normalizeLink(link);
            if (!href) {
              setLinkError(true);
              return;
            }
            run("createLink", href);
            setLink("");
            setLinking(false);
          }}
        >
          <input
            aria-label={t("Bağlantı adresi")}
            aria-invalid={linkError || undefined}
            placeholder="https://… / /sayfa"
            value={link}
            autoFocus
            onChange={(e) => {
              setLink(e.target.value);
              setLinkError(false);
            }}
          />
          <button type="submit">{t("Uygula")}</button>
        </form>
      )}
      <div
        ref={box}
        className="rich-field-box"
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onKeyUp={keepSelection}
        onMouseUp={() => {
          keepSelection();
          refresh((n) => n + 1);
        }}
        onBlur={() => {
          keepSelection();
          // A refused change (a locked element) must not linger on screen.
          const el = box.current,
            clean = richHtml(latest.current);
          if (el && el.innerHTML !== clean) el.innerHTML = clean;
          emitted.current = clean;
        }}
        onKeyDown={(e) => {
          const key = e.key.toLowerCase();
          if ((e.metaKey || e.ctrlKey) && ["b", "i", "u"].includes(key)) {
            e.preventDefault();
            run(key === "b" ? "bold" : key === "i" ? "italic" : "underline");
          }
        }}
        onPaste={(e) => {
          // Pasted pages bring foreign styles; keep the words only.
          e.preventDefault();
          document.execCommand(
            "insertText",
            false,
            e.clipboardData.getData("text/plain"),
          );
        }}
      />
    </div>
  );
}
