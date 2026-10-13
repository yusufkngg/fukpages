import { t } from "./i18n.ts";
import type { Block, Device } from "./model";
import { columnWidths } from "./ColumnHandles";
import {
  Copy,
  ClipboardPaste,
  ArrowUp,
  Group,
  Ungroup,
  Lock,
  Move,
  MoreHorizontal,
} from "lucide-react";
export function SelectionTools({
  node,
  count,
  command,
  device,
}: {
  node?: Block;
  count: number;
  command: (action: string) => void;
  device: Device;
}) {
  if (!node) return null;
  return (
    <details className="selection-actions">
      <summary>
        <MoreHorizontal size={16} />
        {t("Element actions")}
        {count > 1 && <small>{count}</small>}
      </summary>
      <div className="selection-tools">
        <small>
          {count > 1 ? t("{p0} öğe seçili", { p0: count }) : node.name}
        </small>
        {[
          ["copyStyle", t("Stili kopyala")],
          ["pasteStyle", t("Stili yapıştır")],
          ["copyBlocks", t("Öğeleri kopyala")],
          ["pasteBlocks", t("Öğeleri yapıştır")],
          ["parent", t("Üst öğeyi seç")],
          ["group", t("Grupla")],
          ["ungroup", t("Grubu çöz")],
          ["lock", node.props.locked ? t("Kilidi aç") : t("Kilitle")],
          ["freeMove", t("Serbest yerleştir")],
          ...(["text", "heading"].includes(node.kind)
            ? [["splitContent", t("Split into elements")]]
            : []),
        ].map(([k, label]) => (
          <button
            key={k}
            aria-label={label}
            title={label}
            onClick={() => command(k)}
          >
            {k.startsWith("copy") ? (
              <Copy size={15} />
            ) : k.startsWith("paste") ? (
              <ClipboardPaste size={15} />
            ) : k === "parent" ? (
              <ArrowUp size={15} />
            ) : k === "group" ? (
              <Group size={15} />
            ) : k === "ungroup" ? (
              <Ungroup size={15} />
            ) : k === "lock" ? (
              <Lock size={15} />
            ) : (
              <Move size={15} />
            )}
            <span>
              {k.includes("Style")
                ? t("Stil")
                : k.includes("Blocks")
                  ? t("Öğe")
                  : k === "parent"
                    ? t("Üst öğe")
                    : k === "group"
                      ? t("Grupla")
                      : k === "ungroup"
                        ? t("Çöz")
                        : k === "lock"
                          ? t("Kilit")
                          : t("Serbest")}
            </span>
          </button>
        ))}
        {node.props.linkedSectionId && (
          <button onClick={() => command("sync")}>
            {t("Senkron bölümü tüm taslaklarda güncelle")}
          </button>
        )}
        {node.kind === "row" && (
          <>
            <button onClick={() => command("addColumn")}>
              {t("Kolon ekle")}
            </button>
            <label>
              {t("İlk kolon genişliği")}
              <input
                aria-label={t("Kolon genişliği tutamacı")}
                type="range"
                min={10}
                max={90}
                value={Math.round(columnWidths(node, device)[0] || 50)}
                onChange={(e) => command("columnWidth:" + e.target.value)}
              />
            </label>
          </>
        )}
      </div>
    </details>
  );
}
