import { english } from "./uiTranslations.ts";
export type UiLanguage = "en" | "tr";
export const uiLanguageKey = "fp-ui-language";
let language: UiLanguage = "en";
try {
  language = localStorage.getItem(uiLanguageKey) === "tr" ? "tr" : "en";
} catch {}
const listeners = new Set<() => void>();
export const getUiLanguage = () => language;
export const getUiLocale = () => (language === "tr" ? "tr-TR" : "en-US");
export const subscribeUiLanguage = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export function setUiLanguage(value: UiLanguage) {
  language = value;
  try {
    localStorage.setItem(uiLanguageKey, value);
  } catch {}
  if (typeof document !== "undefined") document.documentElement.lang = value;
  listeners.forEach((listener) => listener());
}
const aliases: Record<string, string> = {
  "Item List": "İkonlu öğe",
  "Describe a benefit": "Bir özelliği açıkla",
  "Upload / choose custom icon": "Özel ikon yükle / seç",
  "Custom icon URL": "Özel ikon URL",
  "Use icon colour": "İkon rengini kullan",
  "Review text": "Yorum metni",
  Reviewer: "Yorum sahibi",
  "Review label": "Yorum etiketi",
  "Sample review": "Örnek yorum",
  "Split into elements": "Ayrı öğelere dönüştür",
  "Text and icons are now separate elements.":
    "Metin ve ikonlar artık ayrı öğeler.",
  Title: "Başlık",
  Color: "Renk",
  "Update all pages": "Tüm sayfaları güncelle",
  Icons: "İkonlar",
  Library: "Kitaplık",
  "Show more": "Daha fazlası",
  Size: "Boyut",
  Brand: "Marka",
  Align: "Hizala",
  Inline: "Satır içi",
  "Content and behaviour": "İçerik ve davranış",
  "Item content": "Öğe içeriği",
  "Element actions": "Öğe işlemleri",
  "Delete item": "Öğeyi sil",
  Item: "Öğe",
  "Use text, icons or images inside a button.":
    "Buton içinde metin, ikon veya görsel kullan.",
};
const reverse = new Map(Object.entries(english).map(([tr, en]) => [en, tr]));
const patternEntries = Object.entries(english)
  .filter(([key]) => /\{p\d+\}/.test(key))
  .map(([tr, en]) => {
    const compile = (s: string) => {
      const names: string[] = [];
      const chunks = s.split(/(\{p\d+\})/);
      return {
        names,
        regex: new RegExp(
          "^" +
            chunks
              .map((chunk) => {
                if (/^\{p\d+\}$/.test(chunk)) {
                  names.push(chunk.slice(1, -1));
                  return "([\\s\\S]*?)";
                }
                return chunk.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              })
              .join("") +
            "$",
        ),
      };
    };
    return { tr, en, trPattern: compile(tr), enPattern: compile(en) };
  })
  // Most specific pattern first: "Sayfa çoğaltıldı: {p0}" must win over a
  // generic "{p0} · {p1}" that would match the same text.
  .sort(
    (a, b) =>
      b.tr.replace(/\{p\d+\}/g, "").length -
      a.tr.replace(/\{p\d+\}/g, "").length,
  );
export function t(
  value: string,
  params: Record<string, unknown> = {},
  locale = language,
): string {
  if (locale === "tr" && aliases[value]) return aliases[value];
  let result = value;
  if (Object.hasOwn(english, value))
    result = locale === "en" ? english[value] : value;
  else if (reverse.has(value))
    result = locale === "tr" ? reverse.get(value)! : value;
  else if (value.length > 10) {
    for (const entry of patternEntries) {
      let matched = entry.trPattern.regex.exec(value),
        source = entry.trPattern;
      if (!matched) {
        matched = entry.enPattern.regex.exec(value);
        source = entry.enPattern;
      }
      if (matched) {
        result = locale === "en" ? entry.en : entry.tr;
        result = result.replace(
          /\{(p\d+)\}/g,
          (_, key) => matched![source.names.indexOf(key) + 1] ?? "",
        );
        break;
      }
    }
  }
  return result.replace(/\{(p\d+)\}/g, (_, key) =>
    Object.hasOwn(params, key) ? String(params[key]) : `{${key}}`,
  );
}
const proxies = new WeakMap<object, Map<string, object>>();
// Label registries remain reactive while model documents stay ordinary objects.
export function localized<T extends object>(
  value: T,
  labelKeys?: readonly string[],
): T {
  const cacheKey = labelKeys?.join(",") || "*";
  const cached = proxies.get(value)?.get(cacheKey);
  if (cached) return cached as T;
  const proxy = new Proxy(value, {
    get(target, key, receiver) {
      const next = Reflect.get(target, key, receiver);
      if (typeof next === "string")
        return !labelKeys || labelKeys.includes(String(key)) ? t(next) : next;
      if (next && typeof next === "object") return localized(next, labelKeys);
      return next;
    },
  });
  if (!proxies.has(value)) proxies.set(value, new Map());
  proxies.get(value)!.set(cacheKey, proxy);
  return proxy;
}
