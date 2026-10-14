/**
 * Vector icons are stored on the block as plain geometry, never as markup:
 * a short list of SVG shape elements with whitelisted attributes. The editor,
 * the published page and the server all validate it with this module, so an
 * icon can never carry scripts, links or styles.
 */
export type IconShape =
  "path" | "circle" | "rect" | "line" | "polyline" | "polygon" | "ellipse";
export type IconNode = [IconShape, Record<string, string>][];

const shapes = new Set<string>([
  "path",
  "circle",
  "rect",
  "line",
  "polyline",
  "polygon",
  "ellipse",
]);
const numeric = new Set([
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "width",
  "height",
]);
const pathData = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\-\se]*$/;
const number = /^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/;
export const maxIconNodeLength = 16000;

/** Returns the validated shapes, or null when the value is not a safe icon. */
export function parseIconNode(value: unknown): IconNode | null {
  if (typeof value !== "string" || !value || value.length > maxIconNodeLength)
    return null;
  let data: unknown;
  try {
    data = JSON.parse(value);
  } catch {
    return null;
  }
  if (!Array.isArray(data) || !data.length || data.length > 60) return null;
  const result: IconNode = [];
  for (const entry of data) {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      typeof entry[0] !== "string" ||
      !shapes.has(entry[0]) ||
      !entry[1] ||
      typeof entry[1] !== "object" ||
      Array.isArray(entry[1])
    )
      return null;
    const attributes: Record<string, string> = {};
    for (const [key, raw] of Object.entries(entry[1] as object)) {
      const text = String(raw);
      if (key === "d" || key === "points") {
        if (text.length > 6000 || !pathData.test(text)) return null;
      } else if (numeric.has(key)) {
        if (!number.test(text)) return null;
      } else if (key === "fill") {
        if (text !== "none" && text !== "currentColor") return null;
      } else return null;
      attributes[key] = text;
    }
    result.push([entry[0] as IconShape, attributes]);
  }
  return result;
}

/** Canonical stored form of an icon, or "" when it is not valid. */
export function cleanIconNode(value: unknown) {
  const node = parseIconNode(value);
  return node ? JSON.stringify(node) : "";
}

export const iconName = (value: unknown) => {
  const text = String(value ?? "");
  return /^lucide:[a-z0-9-]{1,60}$/.test(text) ? text : "";
};

/** Stroke width for vector icons, kept within a sensible range. */
export const iconStroke = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? Math.max(0.5, Math.min(4, number))
    : 2;
};
