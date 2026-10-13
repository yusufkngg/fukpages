export const navigationActions = new Set(["navigate", "product", "collection"]);
export function normalizeLink(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw || /[\u0000-\u001f\u007f]/.test(raw)) return "";
  if (/^(\/(?!\/)|#|mailto:|tel:)/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      return url.hostname && !url.username && !url.password ? raw : "";
    } catch {
      return "";
    }
  }
  if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#]|$)/i.test(raw))
    return normalizeLink("https://" + raw);
  if (/^[\p{L}\p{N}_.-]+(?:[/?#][^\s]*)?$/u.test(raw)) return "/" + raw;
  return "";
}
export function buttonLink(props: Record<string, string | boolean>): string {
  return normalizeLink(
    props.action && props.action !== "navigate"
      ? props.actionTarget || props.href
      : props.href && props.href !== "#"
        ? props.href
        : props.actionTarget,
  );
}
