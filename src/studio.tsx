import { CommerceProvider, type Catalog } from "./Commerce";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PageDocument, Block, Device } from "./model";
export interface Asset {
  archived?: boolean;
  id: string;
  storeId: string;
  type: "image" | "font";
  name: string;
  url: string;
  bytes: number;
  format: string;
  width?: number;
  height?: number;
  variants?: { width: number; url: string; bytes: number }[];
  folder: string;
  tags: string[];
  favorite: boolean;
  family?: string;
  weight?: number;
  italic?: boolean;
  axes?: Record<string, { min: number; max: number; default: number }>;
  turkish?: boolean;
  usage?: { id: string; name: string; scope: string }[];
}
export interface Brand {
  colors: Record<string, string>;
  fonts: Record<string, string>;
  typography: Record<string, number>;
  layout: {
    container: number;
    sectionSpace: number;
    radius: number;
    shadow: string;
  };
}
export const defaultBrand: Brand = {
  colors: {
    primary: "#17241c",
    secondary: "#d8e8b7",
    accent: "#b0d976",
    text: "#17241c",
    background: "#ffffff",
    border: "#dce2d7",
  },
  fonts: {
    heading: "Arial, sans-serif",
    body: "Arial, sans-serif",
    button: "Arial, sans-serif",
    fallback: "Arial, sans-serif",
  },
  typography: {
    h1: 56,
    h2: 40,
    h3: 32,
    h4: 26,
    h5: 22,
    h6: 18,
    body: 16,
    small: 12,
    link: 16,
    mobileScale: 0.7,
    h1Weight: 800,
    h2Weight: 700,
    h3Weight: 700,
    h4Weight: 600,
    h5Weight: 600,
    h6Weight: 600,
    bodyWeight: 400,
    smallWeight: 400,
    linkWeight: 500,
    headingLineHeight: 1.15,
    bodyLineHeight: 1.6,
  },
  layout: {
    container: 1200,
    sectionSpace: 48,
    radius: 12,
    shadow: "0 4px 20px #00000014",
  },
};
export const StudioContext = createContext({
  brand: defaultBrand,
  assets: [] as Asset[],
  storeId: "",
  pageId: "",
  previewToken: "",
  editable: false,
  formDestination: "Webhook yapılandırılmadı",
  language: "tr",
  setLanguage: (_l: string) => {},
  nextStage: null as string | null,
  catalog: { source: "local", products: [], collections: [] } as Catalog,
});
export const useStudio = () => useContext(StudioContext);
export const assetUrl = (url: unknown, preview = "") =>
  String(url || "").startsWith("/api/assets/") && preview
    ? `${url}?preview=${encodeURIComponent(preview)}`
    : String(url || "");
export function fontFamilyFor(brand: Brand, role: string) {
  const value = brand.fonts[role] || brand.fonts.body;
  return role === "fallback"
    ? value
    : `${value.split(",")[0]}, ${brand.fonts.fallback}`;
}
export function resolveBrandStyles(
  styles: Record<string, string | number>,
  brand: Brand,
  device: Device = "desktop",
) {
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(brand.colors)) values["--brand-" + k] = v;
  for (const k of Object.keys(brand.fonts))
    values["--font-" + k] = fontFamilyFor(brand, k);
  for (const [k, v] of Object.entries(brand.typography))
    values["--type-" + k] =
      String(
        device === "mobile" && /^(h[1-6]|body|small|link)$/.test(k)
          ? Math.round(v * brand.typography.mobileScale)
          : v,
      ) + (/Weight$|LineHeight$/.test(k) ? "" : "px");
  Object.assign(values, {
    "--brand-radius": brand.layout.radius + "px",
    "--brand-shadow": brand.layout.shadow,
    "--brand-container": brand.layout.container + "px",
    "--brand-section-space": brand.layout.sectionSpace + "px",
    "--heading-line-height": String(brand.typography.headingLineHeight || 1.15),
    "--body-line-height": String(brand.typography.bodyLineHeight || 1.6),
  });
  return Object.fromEntries(
    Object.entries(styles).map(([k, v]) => [
      k,
      typeof v === "string"
        ? v.replace(/var\((--[\w-]+)\)/g, (match, key) => values[key] || match)
        : v,
    ]),
  );
}
export function StudioProvider({
  value,
  page,
  children,
}: {
  value: Partial<ReturnType<typeof useStudio>>;
  page: PageDocument;
  children: ReactNode;
}) {
  const [language, setLanguage] = useState(page.defaultLocale || "tr");
  const context = {
    ...useContext(StudioContext),
    ...value,
    language,
    setLanguage,
  };
  const css = useMemo(() => {
    const b = context.brand,
      serialized = JSON.stringify(page),
      used = (context.assets || []).filter(
        (a) =>
          a.type === "font" &&
          (serialized.includes(a.family || "NONE") ||
            Object.values(b.fonts).some((f) => f.includes(a.family || "NONE"))),
      );
    let css = used
      .map(
        (f) =>
          `@font-face{font-family:"${f.family}";src:url("${assetUrl(f.url, context.previewToken)}") format("${f.format}");font-weight:${f.axes?.wght ? `${f.axes.wght.min} ${f.axes.wght.max}` : f.weight};font-style:${f.italic ? "italic" : "normal"};font-display:swap;}`,
      )
      .join("");
    const vars = [
      ...Object.entries(b.colors).map(([k, v]) => `--brand-${k}:${v}`),
      ...Object.keys(b.fonts).map((k) => `--font-${k}:${fontFamilyFor(b, k)}`),
      ...Object.entries(b.typography)
        .filter(([k]) => k !== "mobileScale")
        .map(
          ([k, v]) =>
            `--type-${k}:${v}${/Weight$|LineHeight$/.test(k) ? "" : "px"}`,
        ),
      `--brand-mobile-scale:${b.typography.mobileScale}`,
      `--heading-line-height:${b.typography.headingLineHeight || 1.15}`,
      `--body-line-height:${b.typography.bodyLineHeight || 1.6}`,
      `--brand-radius:${b.layout.radius}px`,
      `--brand-shadow:${b.layout.shadow}`,
      `--brand-container:${b.layout.container}px`,
      `--brand-section-space:${b.layout.sectionSpace}px`,
    ];
    css += `.page-surface{${vars.join(";")};font-family:var(--font-body);color:var(--brand-text)}.page-surface[data-device="mobile"]{${Object.entries(
      b.typography,
    )
      .filter(([k]) => /^(h[1-6]|body|small|link)$/.test(k))
      .map(
        ([k, v]) => `--type-${k}:${Math.round(v * b.typography.mobileScale)}px`,
      )
      .join(";")}}`;
    const walk = (nodes: Block[]) =>
      nodes.forEach((n) => {
        for (const state of ["hover", "focus"])
          try {
            const vals = JSON.parse(String(n.props[state + "Styles"] || "{}"));
            const toCss = (k: string) =>
              k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
            const selector =
              `.page-surface [data-block="${n.id}"]` +
              (state === "focus" ? ":focus-within" : ":hover");
            css += `${selector}{${Object.entries(vals)
              .map(([k, v]) => `${toCss(k)}:${v} !important`)
              .join(";")}}`;
          } catch {
            /* invalid states rejected by server */
          }
        walk(n.children);
      });
    walk(page.nodes);
    return css;
  }, [context.brand, context.assets, context.previewToken, page]);
  return (
    <StudioContext.Provider value={context}>
      <style>{css}</style>
      <CommerceProvider catalog={context.catalog}>{children}</CommerceProvider>
    </StudioContext.Provider>
  );
}
export function brandStyle(
  node: Block,
  device: Device,
): Record<string, string | number> {
  if (node.props.globalDetached) return {};
  const variant = String(node.props.buttonVariant || "primary");
  if (node.kind === "heading")
    return {
      fontFamily: "var(--font-heading)",
      fontWeight: `var(--type-${node.props.tag || "h2"}Weight)`,
      lineHeight: "var(--heading-line-height)",
      fontSize: `var(--type-${node.props.tag || "h2"})`,
      color: "var(--brand-text)",
    };
  if (node.kind === "text")
    return {
      fontFamily: "var(--font-body)",
      fontWeight: `var(--type-${["small", "link"].includes(String(node.props.globalStyle)) ? node.props.globalStyle : "body"}Weight)`,
      lineHeight: "var(--body-line-height)",
      color: "var(--brand-text)",
      fontSize: `var(--type-${["small", "link"].includes(String(node.props.globalStyle)) ? node.props.globalStyle : "body"})`,
    };
  if (node.kind === "button")
    return {
      fontFamily: "var(--font-button)",
      backgroundColor:
        variant === "outline"
          ? "transparent"
          : `var(--brand-${variant === "secondary" ? "secondary" : "primary"})`,
      color:
        variant === "primary" ? "var(--brand-background)" : "var(--brand-text)",
      borderRadius: "var(--brand-radius)",
      ...(variant === "outline"
        ? {
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "var(--brand-primary)",
          }
        : {}),
    };
  if (node.kind === "section")
    return {
      maxWidth: "var(--brand-container)",
      backgroundColor: "var(--brand-background)",
    };
  void device;
  return {};
}
export function freezeGlobalStyle(node: Block, brand: Brand): Block {
  const desktop = { ...brandStyle(node, "desktop"), ...node.styles.desktop };
  return {
    ...node,
    props: { ...node.props, globalDetached: true },
    styles: {
      desktop: resolveBrandStyles(desktop, brand),
      tablet: resolveBrandStyles(
        { ...desktop, ...node.styles.tablet },
        brand,
        "tablet",
      ),
      mobile: resolveBrandStyles(
        { ...desktop, ...node.styles.tablet, ...node.styles.mobile },
        brand,
        "mobile",
      ),
    },
  };
}
