import { Link2, Unlink } from "lucide-react";
import { StyleInput } from "./StyleInput";
import { t } from "./i18n";
import type { Styles } from "./model";
export function SpacingDiagram({
  styles,
  linked,
  toggle,
  change,
  identity,
}: {
  styles: Styles;
  linked: boolean;
  toggle: () => void;
  change: (prefix: "padding" | "margin", side: string, value: string) => void;
  identity: string;
}) {
  return (
    <div className="spacing-diagram">
      <span className="margin-caption">{t("Margin")}</span>
      <span className="padding-caption">{t("Padding")}</span>
      <div className="padding-frame" />
      {(["margin", "padding"] as const).flatMap((prefix) =>
        ["Top", "Right", "Bottom", "Left"].map((side) => (
          <div
            key={prefix + side}
            className={`diagram-value ${prefix}-${side.toLowerCase()}`}
          >
            <StyleInput
              key={identity + prefix + side}
              label={`${prefix} ${side}`}
              value={styles[prefix + side] ?? "0px"}
              placeholder="0px"
              onChange={(value) => change(prefix, side, value)}
            />
          </div>
        )),
      )}
      <button
        className="diagram-link"
        title={t("Dört kenarı birlikte değiştir")}
        aria-pressed={linked}
        onClick={toggle}
      >
        {linked ? <Link2 size={15} /> : <Unlink size={15} />}
      </button>
    </div>
  );
}
