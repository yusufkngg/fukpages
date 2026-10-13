const lengthKeys = new Set([
  "width",
  "minWidth",
  "maxWidth",
  "height",
  "minHeight",
  "maxHeight",
  "top",
  "right",
  "bottom",
  "left",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "borderWidth",
  "borderRadius",
  "fontSize",
  "letterSpacing",
  "gap",
  "rowGap",
  "columnGap",
  "flexBasis",
]);
// React adds px to numeric values, but CSS rejects numeric strings for lengths.
// Normalize both existing documents and new input without changing unitless CSS.
export function normalizeStyleValue(
  key: string,
  value: string | number,
): string | number {
  if (typeof value !== "string" || !lengthKeys.has(key)) return value;
  const trimmed = value.trim();
  return /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)
    ? `${Number(trimmed)}px`
    : trimmed;
}
export function normalizeStyles(styles: Record<string, string | number>) {
  return Object.fromEntries(
    Object.entries(styles).map(([key, value]) => [
      key,
      normalizeStyleValue(key, value),
    ]),
  );
}
