import { Plus, Trash2, ChevronUp, ChevronDown, Copy } from "lucide-react";
import { t } from "./i18n";
import type { Block } from "./model";
export type AccordionItem = { id: string; title: string; content: string };
export function accordionItems(node: Block): AccordionItem[] {
  try {
    const value = JSON.parse(String(node.props.accordionItems || ""));
    if (Array.isArray(value) && value.length) return value;
  } catch {}
  return [
    {
      id: node.id + "-item",
      title: String(node.props.title || ""),
      content: String(node.props.description || ""),
    },
  ];
}
export function AccordionItemsPanel({
  node,
  update,
}: {
  node: Block;
  update: (f: (n: Block) => Block) => void;
}) {
  const items = accordionItems(node);
  const save = (next: AccordionItem[]) =>
    update((n) => ({
      ...n,
      props: { ...n.props, accordionItems: JSON.stringify(next) },
    }));
  return (
    <section className="accordion-item-manager">
      <h3>
        {t("Item management")}{" "}
        <small>
          {items.length} {t("items")}
        </small>
      </h3>
      {items.map((item, index) => (
        <details key={item.id} className="accordion-item-editor">
          <summary>{item.title || t("Item")}</summary>
          <label>
            {t("Title")}
            <input
              aria-label={`${t("Item title")} ${index + 1}`}
              value={item.title}
              onChange={(e) =>
                save(
                  items.map((v, i) =>
                    i === index ? { ...v, title: e.target.value } : v,
                  ),
                )
              }
            />
          </label>
          <label>
            {t("Content")}
            <textarea
              aria-label={`${t("Item content")} ${index + 1}`}
              value={item.content}
              rows={3}
              onChange={(e) =>
                save(
                  items.map((v, i) =>
                    i === index ? { ...v, content: e.target.value } : v,
                  ),
                )
              }
            />
          </label>
          <div className="item-actions">
            <button
              disabled={!index}
              aria-label={`${t("Move up")} ${index + 1}`}
              onClick={() => {
                const next = [...items];
                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                save(next);
              }}
            >
              <ChevronUp size={14} />
            </button>
            <button
              disabled={index === items.length - 1}
              aria-label={`${t("Move down")} ${index + 1}`}
              onClick={() => {
                const next = [...items];
                [next[index + 1], next[index]] = [next[index], next[index + 1]];
                save(next);
              }}
            >
              <ChevronDown size={14} />
            </button>
            <button
              aria-label={`${t("Duplicate item")} ${index + 1}`}
              onClick={() =>
                save([
                  ...items.slice(0, index + 1),
                  { ...item, id: crypto.randomUUID() },
                  ...items.slice(index + 1),
                ])
              }
            >
              <Copy size={14} />
            </button>
            <button
              disabled={items.length === 1}
              aria-label={`${t("Delete item")} ${index + 1}`}
              onClick={() => save(items.filter((_, i) => i !== index))}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </details>
      ))}
      <button
        className="add-accordion-item"
        disabled={items.length >= 40}
        onClick={() =>
          save([
            ...items,
            {
              id: crypto.randomUUID(),
              title: t("New question"),
              content: t("Add your answer here."),
            },
          ])
        }
      >
        <Plus size={14} />
        {t("Add item")}
      </button>
      <details>
        <summary>{t("Item style")}</summary>
        {[
          ["accordionHeaderBg", "Header background"],
          ["accordionContentBg", "Content background"],
          ["accordionBorderColor", "Border color"],
        ].map(([key, label]) => (
          <label key={key}>
            {t(label)}
            <input
              type="color"
              aria-label={t(label)}
              value={String(
                node.props[key] ||
                  (key === "accordionBorderColor" ? "#dce3d3" : "#ffffff"),
              )}
              onChange={(e) =>
                update((n) => ({
                  ...n,
                  props: { ...n.props, [key]: e.target.value },
                }))
              }
            />
          </label>
        ))}
        {[
          ["accordionGap", "Gap", "12"],
          ["accordionRadius", "Corner radius", "8"],
          ["accordionHeaderPadding", "Header padding", "16"],
          ["accordionContentPadding", "Content padding", "16"],
        ].map(([key, label, fallback]) => (
          <label key={key}>
            {t(label)}
            <input
              type="number"
              min={0}
              max={200}
              aria-label={t(label)}
              value={Number(node.props[key] ?? fallback)}
              onChange={(e) =>
                update((n) => ({
                  ...n,
                  props: {
                    ...n.props,
                    [key]: String(
                      Math.max(0, Math.min(200, Number(e.target.value))),
                    ),
                  },
                }))
              }
            />
          </label>
        ))}
      </details>
    </section>
  );
}
