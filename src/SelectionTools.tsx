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
    <div className="selection-tools">
      <small>{count > 1 ? `${count} öğe seçili` : node.name}</small>
      {[
        ["copyStyle", "Stili kopyala"],
        ["pasteStyle", "Stili yapıştır"],
        ["copyBlocks", "Öğeleri kopyala"],
        ["pasteBlocks", "Öğeleri yapıştır"],
        ["parent", "Üst öğeyi seç"],
        ["group", "Grupla"],
        ["ungroup", "Grubu çöz"],
        ["lock", node.props.locked ? "Kilidi aç" : "Kilitle"],
        ["freeMove", "Serbest yerleştir"],
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
              ? "Stil"
              : k.includes("Blocks")
                ? "Öğe"
                : k === "parent"
                  ? "Üst öğe"
                  : k === "group"
                    ? "Grupla"
                    : k === "ungroup"
                      ? "Çöz"
                      : k === "lock"
                        ? "Kilit"
                        : "Serbest"}
          </span>
        </button>
      ))}
      {node.props.linkedSectionId && (
        <button onClick={() => command("sync")}>
          Senkron bölümü tüm taslaklarda güncelle
        </button>
      )}
      {node.kind === "row" && (
        <>
          <button onClick={() => command("addColumn")}>Kolon ekle</button>
          <label>
            İlk kolon genişliği
            <input
              aria-label="Kolon genişliği tutamacı"
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
  );
}
