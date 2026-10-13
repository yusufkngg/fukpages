import { t } from "./i18n";
export function LayoutChoices({
  count,
  change,
}: {
  count: number;
  change: (count: number) => void;
}) {
  return (
    <div
      className="layout-choices"
      role="group"
      aria-label={t("Column layout")}
    >
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <button
          key={n}
          aria-label={`${n} ${t("columns")}`}
          aria-pressed={count === n}
          onClick={() => change(n)}
        >
          <span aria-hidden="true">
            {Array.from({ length: n }, (_, i) => (
              <i key={i} />
            ))}
          </span>
        </button>
      ))}
    </div>
  );
}
