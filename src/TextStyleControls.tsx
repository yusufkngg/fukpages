import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  Underline,
  Minus,
  Plus,
} from "lucide-react";
import { t } from "./i18n";
import { StyleInput } from "./StyleInput";
import type { Styles } from "./model";
export function TextStyleControls({
  styles,
  fonts,
  change,
}: {
  styles: Styles;
  fonts: string[];
  change: (key: string, value: string | number) => void;
}) {
  const size = parseFloat(String(styles.fontSize)) || 16;
  const weight = Number(styles.fontWeight) || 400;
  return (
    <section className="simple-text-controls">
      <h3>{t("Text style")}</h3>
      <label>
        <span>{t("Font")}</span>
        <select
          aria-label={t("Yazı tipi")}
          value={String(styles.fontFamily || fonts[0])}
          onChange={(e) => change("fontFamily", e.target.value)}
        >
          {[...new Set([String(styles.fontFamily || fonts[0]), ...fonts])].map(
            (f) => (
              <option key={f} value={f}>
                {f.split(",")[0]}
              </option>
            ),
          )}
        </select>
      </label>
      <label>
        <span>{t("Size")}</span>
        <div className="font-size-stepper">
          <button
            aria-label={t("Decrease font size")}
            onClick={() => change("fontSize", Math.max(1, size - 1) + "px")}
          >
            <Minus size={13} />
          </button>
          <StyleInput
            label={t("Yazı boyutu")}
            value={styles.fontSize || "16px"}
            onChange={(v) => change("fontSize", v)}
          />
          <button
            aria-label={t("Increase font size")}
            onClick={() => change("fontSize", Math.min(400, size + 1) + "px")}
          >
            <Plus size={13} />
          </button>
        </div>
      </label>
      <div className="text-format-buttons">
        {[
          [Bold, "fontWeight", weight >= 600, "700", "400", "Bold"],
          [
            Italic,
            "fontStyle",
            styles.fontStyle === "italic",
            "italic",
            "normal",
            "Italic",
          ],
          [
            Underline,
            "textDecoration",
            String(styles.textDecoration || "").includes("underline"),
            "underline",
            "none",
            "Underline",
          ],
        ].map(([Icon, key, active, on, off, label]) => {
          const C = Icon as typeof Bold;
          return (
            <button
              key={String(key)}
              aria-label={t(String(label))}
              aria-pressed={!!active}
              onClick={() => change(String(key), String(active ? off : on))}
            >
              <C size={17} />
            </button>
          );
        })}
      </div>
      <label>
        <span>{t("Color")}</span>
        <div className="simple-colour">
          <input
            type="color"
            aria-label={t("Metin rengi seçici")}
            value={
              /^#[a-f0-9]{6}$/i.test(String(styles.color))
                ? String(styles.color)
                : "#17241c"
            }
            onChange={(e) => change("color", e.target.value)}
          />
          <StyleInput
            label={t("Metin rengi")}
            value={styles.color || "#17241c"}
            onChange={(v) => change("color", v)}
          />
        </div>
      </label>
      <label>
        <span>{t("Align")}</span>
        <div className="text-align-buttons">
          {[
            [AlignLeft, "left"],
            [AlignCenter, "center"],
            [AlignRight, "right"],
            [AlignJustify, "justify"],
          ].map(([Icon, value]) => {
            const C = Icon as typeof AlignLeft;
            return (
              <button
                key={String(value)}
                aria-label={t("Metin hizası: {p0}", { p0: value })}
                aria-pressed={String(styles.textAlign || "left") === value}
                onClick={() => change("textAlign", String(value))}
              >
                <C size={16} />
              </button>
            );
          })}
        </div>
      </label>
      <details>
        <summary>{t("Show more")}</summary>
        <label>
          {t("Weight")}
          <StyleInput
            label={t("Kalınlık")}
            value={styles.fontWeight || 400}
            onChange={(v) => change("fontWeight", v)}
          />
        </label>
        <label>
          {t("Line height")}
          <StyleInput
            label={t("Satır yüksekliği")}
            value={styles.lineHeight || 1.6}
            onChange={(v) => change("lineHeight", v)}
          />
        </label>
        <label>
          {t("Letter spacing")}
          <StyleInput
            label={t("Harf aralığı")}
            value={styles.letterSpacing || "0px"}
            onChange={(v) => change("letterSpacing", v)}
          />
        </label>
      </details>
    </section>
  );
}
