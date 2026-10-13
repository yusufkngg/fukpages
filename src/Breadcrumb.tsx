import { t } from "./i18n.ts";
import { ChevronRight, MousePointer2 } from "lucide-react";
import { blockIcons } from "./icons";
import type { Block } from "./model";

/** Root-to-node chain of blocks, or an empty list when the id is unknown. */
export function blockPath(nodes: Block[], id: string | null): Block[] {
  if (!id) return [];
  for (const node of nodes) {
    if (node.id === id) return [node];
    const below = blockPath(node.children, id);
    if (below.length) return [node, ...below];
  }
  return [];
}

/** Clickable ancestor trail of the current selection (canvas footer). */
export function Breadcrumb({
  nodes,
  selected,
  select,
}: {
  nodes: Block[];
  selected: string | null;
  select: (id: string) => void;
}) {
  const path = blockPath(nodes, selected);
  if (!path.length)
    return (
      <div className="canvas-breadcrumb">
        <MousePointer2 size={12} />
        <span>{t("Bir öğe seç")}</span>
      </div>
    );
  return (
    <nav className="canvas-breadcrumb" aria-label={t("Seçim yolu")}>
      <MousePointer2 size={12} />
      {path.map((node, index) => {
        const Icon = blockIcons[node.kind];
        const last = index === path.length - 1;
        return (
          <span key={node.id} className="crumb">
            {index > 0 && <ChevronRight size={10} />}
            <button
              aria-current={last ? "true" : undefined}
              title={node.name}
              onClick={() => select(node.id)}
            >
              <Icon size={11} />
              <span>{node.name}</span>
            </button>
          </span>
        );
      })}
    </nav>
  );
}
