import type { PageType } from "./model";
export interface ThemeSection {
  id: string;
  sectionId: string;
  name: string;
  type: string;
  region: "header" | "main" | "footer";
  enabled: boolean;
  group: string | null;
  filename: string;
  settings: Record<string, unknown>;
  settingLabels: Record<string, string>;
}
export interface ThemeSnapshot {
  id: string;
  shopDomain: string;
  themeId: string;
  themeName: string;
  templateFilename: string;
  syncedAt: number;
  sections: ThemeSection[];
}
export interface ThemeStatus {
  configured: boolean;
  domain: string;
  snapshot: ThemeSnapshot | null;
}
export const templateForPage: Record<PageType, string> = {
  landing: "templates/page.json",
  page: "templates/page.json",
  home: "templates/index.json",
  product: "templates/product.json",
  collection: "templates/collection.json",
  blog: "templates/blog.json",
  article: "templates/article.json",
  cart: "templates/cart.json",
  search: "templates/search.json",
};
