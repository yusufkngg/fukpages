/** A stable event ID lets a retried request (or React replay) stay one event. */
export function trackEvent(
  pageId: string,
  event: "view" | "click" | "add_to_cart",
  eventId = crypto.randomUUID(),
) {
  const params = new URLSearchParams(window.location.search);
  if (!pageId || params.has("preview")) return;
  void fetch(`/api/public/pages/${encodeURIComponent(pageId)}/events`, {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event,
      eventId,
      experimentId: params.get("experiment") || undefined,
    }),
  }).catch(() => {
    /* Metrics must not interrupt a visitor action. */
  });
}
