import { iconPresets } from "./iconPresets.ts";
import { iconKeywords } from "./iconCatalog.ts";
import { getUiLanguage } from "./i18n.ts";
import type { IconNode } from "./iconNode.ts";

/** Props for an icon block showing a library icon. */
export const vectorIconProps = (name: string, node?: IconNode) => {
  const shapes = node ?? iconPresets[name];
  return shapes
    ? { icon: `lucide:${name}`, iconNode: JSON.stringify(shapes), text: "" }
    : null;
};

/** Library name stored on a block ("lucide:star" → "star"). */
export const iconLibraryName = (value: unknown) =>
  String(value ?? "").replace(/^lucide:/, "");

export type IconLibrary = Record<string, IconNode>;
let library: Promise<IconLibrary> | null = null;
/** The full library, fetched once when the icon picker first opens. */
export function loadIconLibrary(): Promise<IconLibrary> {
  library ??= fetch("/icons/lucide.json")
    .then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    })
    .then((data: { icons: IconLibrary }) => data.icons)
    .catch((error) => {
      library = null;
      throw error;
    });
  return library;
}

/** Library names matching a search, best matches first. */
export function searchIcons(names: string[], query: string): string[] {
  const q = query.trim().toLocaleLowerCase(getUiLanguage());
  if (!q) return names;
  const plain = q.replace(/\s+/g, "-");
  const known = new Set(names);
  const scored = new Map<string, number>();
  const score = (name: string, value: number) => {
    if (known.has(name))
      scored.set(name, Math.max(scored.get(name) ?? 0, value));
  };
  for (const [word, matches] of Object.entries(iconKeywords))
    if (word === q || (q.length >= 2 && word.startsWith(q)))
      matches.forEach((name, index) =>
        score(name, (word === q ? 90 : 70) - index),
      );
  for (const name of names) {
    if (name === plain) score(name, 100);
    else if (name.startsWith(plain)) score(name, 60);
    else if (name.split("-").some((part) => part.startsWith(plain)))
      score(name, 40);
    else if (name.includes(plain)) score(name, 20);
  }
  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
}
