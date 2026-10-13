import { t } from "./i18n.ts";
import { useEffect, useRef, useState } from "react";
import { PanelsTopLeft, Plus, Square } from "lucide-react";

/**
 * Hover affordance between two page sections: add a ready-made section
 * from the library or an empty one exactly at this position.
 */
export function SectionInsert({
  after,
  name,
  chooseSection,
  addBlank,
}: {
  after: string;
  name: string;
  chooseSection: () => void;
  addBlank: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: Event) => {
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        // Close only this menu; keep the canvas selection.
        event.stopPropagation();
      }
      if (
        event.type === "pointerdown" &&
        event.target instanceof Node &&
        root.current?.contains(event.target)
      )
        return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("keydown", dismiss, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("keydown", dismiss, true);
    };
  }, [open]);
  return (
    <div
      ref={root}
      className={`section-insert ${open ? "open" : ""}`}
      data-section-insert={after}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        className="section-insert-button"
        aria-label={t("{p0} sonrasına bölüm ekle", { p0: name })}
        aria-expanded={open}
        title={t("Buraya bölüm ekle")}
        onClick={() => setOpen(!open)}
      >
        <Plus size={14} />
        <span>{t("Bölüm ekle")}</span>
      </button>
      {open && (
        <div className="section-insert-menu" role="menu">
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              chooseSection();
            }}
          >
            <PanelsTopLeft size={15} />
            <span>
              <b>{t("Hazır bölüm seç")}</b>
              <small>{t("Kütüphaneden buraya ekle")}</small>
            </span>
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              addBlank();
            }}
          >
            <Square size={15} />
            <span>
              <b>{t("Boş bölüm")}</b>
              <small>{t("Öğeleri kendin yerleştir")}</small>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
