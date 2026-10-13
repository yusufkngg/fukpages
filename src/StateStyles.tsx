import { t } from "./i18n.ts";
import { useState } from "react";
import type { Block } from "./model";
export function StateStyles({
  node,
  update,
}: {
  node: Block;
  update: (f: (b: Block) => Block) => void;
}) {
  const [state, setState] = useState("hover");
  let styles: Record<string, string> = {};
  try {
    styles = JSON.parse(String(node.props[state + "Styles"] || "{}"));
  } catch {
    /* empty */
  }
  const change = (key: string, value: string) =>
    update((current) => {
      let values: Record<string, string> = {};
      try {
        values = JSON.parse(String(current.props[state + "Styles"] || "{}"));
      } catch {
        /* empty */
      }
      if (value) values[key] = value;
      else delete values[key];
      return {
        ...current,
        props: { ...current.props, [state + "Styles"]: JSON.stringify(values) },
      };
    });
  return (
    <div className="state-style-controls">
      <label className="control">
        {t("Durum")}
        <select value={state} onChange={(e) => setState(e.target.value)}>
          <option value="hover">Hover</option>
          <option value="focus">Focus</option>
        </select>
      </label>
      {[
        ["backgroundColor", t("Arka plan")],
        ["color", t("Metin")],
        ["borderColor", t("Kenarlık")],
        ["boxShadow", t("Gölge")],
        ["transform", t("Dönüşüm")],
        ["transition", t("Geçiş")],
      ].map(([key, label]) => (
        <label className="control" key={key}>
          {label}
          <input
            aria-label={t("Durum {p0}", { p0: label })}
            value={styles[key] || ""}
            placeholder={t("Normal görünümden al")}
            onChange={(e) => change(key, e.target.value)}
          />
        </label>
      ))}
      <small>
        {t("Hover için öğenin üzerine gel; Focus için Tab ile düğmeye ulaş.")}
      </small>
      <button
        onClick={() =>
          update((n) => ({
            ...n,
            props: { ...n.props, [state + "Styles"]: "{}" },
          }))
        }
      >
        {t("Durum stilini sıfırla")}
      </button>
    </div>
  );
}
