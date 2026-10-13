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
        Durum
        <select value={state} onChange={(e) => setState(e.target.value)}>
          <option value="hover">Hover</option>
          <option value="focus">Focus</option>
        </select>
      </label>
      {[
        ["backgroundColor", "Arka plan"],
        ["color", "Metin"],
        ["borderColor", "Kenarlık"],
        ["boxShadow", "Gölge"],
        ["transform", "Dönüşüm"],
        ["transition", "Geçiş"],
      ].map(([key, label]) => (
        <label className="control" key={key}>
          {label}
          <input
            aria-label={`Durum ${label}`}
            value={styles[key] || ""}
            placeholder="Normal görünümden al"
            onChange={(e) => change(key, e.target.value)}
          />
        </label>
      ))}
      <small>
        Hover için öğenin üzerine gel; Focus için Tab ile düğmeye ulaş.
      </small>
      <button
        onClick={() =>
          update((n) => ({
            ...n,
            props: { ...n.props, [state + "Styles"]: "{}" },
          }))
        }
      >
        Durum stilini sıfırla
      </button>
    </div>
  );
}
