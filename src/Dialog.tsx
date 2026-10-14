import { t } from "./i18n.ts";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { deviceForWidth } from "./model";

/** Native modal: inert background, keyboard focus containment and Escape. */
export function Dialog({
  open,
  onClose,
  label,
  children,
  className = "",
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  className?: string;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open || !ref.current) return;
    const active = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    const overflow = document.body.style.overflow;
    const surface = active?.closest<HTMLElement>(".page-surface");
    const content = dialog.querySelector<HTMLElement>(".dialog-content");
    if (content)
      content.dataset.device =
        surface?.dataset.device || deviceForWidth(window.innerWidth);
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (active?.isConnected) active.focus({ preventScroll: true });
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <dialog
      ref={ref}
      className={`builder-modal accessible-dialog ${className}`}
      aria-label={label}
      onKeyDown={(event) => {
        if (
          event.key !== "Tab" ||
          (event.target as Element).closest("dialog") !== event.currentTarget
        )
          return;
        const controls = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
          ),
        ].filter((el) => el.tabIndex >= 0 && el.getClientRects().length);
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog-content page-surface">
        {dismissible && (
          <button
            className="modal-close"
            aria-label={t("{p0} kapat", { p0: label })}
            onClick={onClose}
          >
            ×
          </button>
        )}
        {children}
      </div>
    </dialog>,
    document.body,
  );
}

export const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
