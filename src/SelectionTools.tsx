import type { Block } from "./model";
export function SelectionTools({
  node,
  count,
  command,
}: {
  node?: Block;
  count: number;
  command: (action: string) => void;
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
      ].map(([k, label]) => (
        <button key={k} aria-label={label} onClick={() => command(k)}>
          {label}
        </button>
      ))}
      {node.props.linkedSectionId && (
        <button onClick={() => command("sync")}>
          Senkron bölümü tüm taslaklarda güncelle
        </button>
      )}
      {node.kind === "row" && (
        <label>
          İlk kolon genişliği
          <input
            aria-label="Kolon genişliği tutamacı"
            type="range"
            min={10}
            max={90}
            defaultValue={50}
            onChange={(e) => command("columnWidth:" + e.target.value)}
          />
        </label>
      )}
    </div>
  );
}
