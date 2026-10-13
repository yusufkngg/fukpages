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
}: {
  node: Block;
  update: (f: (n: Block) => Block) => void;
  fit: () => void;
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
              update((n) => ({ ...n, props: { ...n.props, text: symbol } }))
            }
          >
            {symbol}
          </button>
        ))}
      </div>
      <button className="fit-icon-button" onClick={fit}>
        {t("Fit to icon")}
      </button>
    </section>
  );
}
