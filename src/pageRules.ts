import { t } from "./i18n.ts";

/**
 * Store-level rules for page types, shared by the editor and the server.
 *
 * A store has exactly one homepage (Shopify has a single index template).
 * Product, collection, landing and other pages can have as many variants as
 * needed; product and collection variants are routed by their assignments.
 */
export const singletonPageTypes: readonly string[] = ["home"];

export const isSingletonType = (type: string) =>
  singletonPageTypes.includes(type);

/** A new page of `type` may be added next to `pages`. */
export const canCreatePageType = (type: string, pages: { type: string }[]) =>
  !isSingletonType(type) || !pages.some((page) => page.type === type);

/** Copies are offered for every type that may exist more than once. */
export const canDuplicatePageType = (type: string) => !isSingletonType(type);

/** Assignment kinds that make sense for a page type. */
export const assignmentKind = (type: string) =>
  type === "home" || type === "product" || type === "collection" ? type : null;

/** Name for a copy of a page, in the interface language. */
export const copyName = (name: string) => `${name} · ${t("Kopya")}`;

/** Items already assigned to other pages of the same type → that page's name. */
export const assignmentsTakenBy = (
  page: { id: string; type: string },
  pages: { id: string; type: string; name: string; assignments?: string[] }[],
): Record<string, string> =>
  Object.fromEntries(
    pages
      .filter((p) => p.id !== page.id && p.type === page.type)
      .flatMap((p) => (p.assignments ?? []).map((id) => [id, p.name])),
  );

/** Assignments are edited by hand for product/collection pages, and for a
 * homepage only while older data still holds more than one. */
export const showsAssignments = (type: string, pages: { type: string }[]) =>
  type === "product" ||
  type === "collection" ||
  (type === "home" && pages.filter((p) => p.type === "home").length > 1);

/**
 * When older data holds several homepages, the one that keeps the role:
 * the page already assigned as home, then a published one, then the most
 * recently edited.
 */
export function primaryPage<
  T extends {
    type: string;
    updated: number;
    published?: boolean;
    assignments?: string[];
  },
>(pages: T[], type: string): T | undefined {
  return pages
    .filter((page) => page.type === type)
    .sort(
      (a, b) =>
        Number(!!b.assignments?.length) - Number(!!a.assignments?.length) ||
        Number(!!b.published) - Number(!!a.published) ||
        b.updated - a.updated,
    )[0];
}
