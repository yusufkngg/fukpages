import type { Block } from "./model";
import { t } from "./i18n";
const symbols = [
  "★",
  "☆",
  "♥",
  "♡",
  "✓",
  "✔",
  "✦",
  "∞",
  "⚡",
  "→",
  "←",
  "↑",
  "↓",
  "●",
  "○",
  "✚",
  "✕",
  "☀",
  "☁",
  "♣",
  "♦",
  "☕",
  "♫",
  "✈",
];
export function IconPicker({
  node,
  update,
  fit,
  openMedia,
}: {
  node: Block;
  update: (f: (n: Block) => Block) => void;
  fit: () => void;
  openMedia: () => void;
}) {
  return (
    <section className="icon-picker">
      <h3>{t("Icons")}</h3>
      <div className="icon-picker-grid">
        {symbols.map((symbol) => (
          <button
            key={symbol}
            aria-label={`${t("Icon")} ${symbol}`}
            aria-pressed={node.props.text === symbol}
            onClick={() =>
              update((n) => ({
                ...n,
                props: { ...n.props, text: symbol, src: "" },
              }))
            }
          >
            {symbol}
          </button>
        ))}
      </div>
      <button className="fit-icon-button" onClick={openMedia}>
        {t("Upload / choose custom icon")}
      </button>
      <label>
        {t("Custom icon URL")}
        <input
          aria-label={t("Custom icon URL")}
          value={String(node.props.src || "")}
          onChange={(e) =>
            update((n) => ({
              ...n,
              props: { ...n.props, src: e.target.value },
            }))
          }
        />
      </label>
      {node.props.src && (
        <label className="toggle-row">
          <span>{t("Use icon colour")}</span>
          <input
            type="checkbox"
            aria-label={t("Use icon colour")}
            checked={!!node.props.iconTint}
            onChange={(e) =>
              update((n) => ({
                ...n,
                props: { ...n.props, iconTint: e.target.checked },
              }))
            }
          />
        </label>
      )}
      <button className="fit-icon-button" onClick={fit}>
        {t("Fit to icon")}
      </button>
    </section>
  );
}
