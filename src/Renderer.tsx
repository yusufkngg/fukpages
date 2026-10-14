import { t } from "./i18n.ts";
import { setCaption } from "./atomicContent.ts";
import { accordionItems } from "./AccordionItems";
import {
  createElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Dialog } from "./Dialog";
import { trackEvent } from "./metrics";
import DOMPurify from "dompurify";
import { CommerceBlock } from "./Commerce";
import { AdvancedContent, performAction } from "./AdvancedContent";
import { buttonLink, normalizeLink, navigationActions } from "./links";
import { freeHeight, placedStyle } from "./freePlacement";
import { assetUrl, brandStyle, useStudio } from "./studio";
import { iconStroke, parseIconNode, type IconNode } from "./iconNode";
import { Play, ShoppingBag, ArrowUpRight } from "lucide-react";
import {
  effectiveStyle,
  type Block,
  type Device,
  type PageDocument,
} from "./model";
const hexChannel = (value: string) =>
  Math.max(0, Math.min(255, Math.round(Number(value))))
    .toString(16)
    .padStart(2, "0");
/** Browsers report computed colours as rgb(); the stored format is hex. */
export function hexColor(value: string) {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(trimmed)) return trimmed.toLowerCase();
  const match =
    /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+)(%?))?\s*\)$/i.exec(
      trimmed,
    );
  if (!match) return "";
  const alpha =
    match[4] === undefined
      ? 1
      : Number(match[4]) / (match[5] === "%" ? 100 : 1);
  return (
    "#" +
    [match[1], match[2], match[3]].map(hexChannel).join("") +
    (alpha < 1 ? hexChannel(String(alpha * 255)) : "")
  );
}
const richTags = ["b", "strong", "i", "em", "u", "s", "br", "p", "span", "a"];
/**
 * Sanitises inline rich text and rewrites browser editing output into the
 * same canonical markup the server stores: <strike> becomes <s>, colours are
 * hex, only spans carry styles, and links are normalised and safe.
 */
export function richHtml(value: unknown) {
  const fragment = DOMPurify.sanitize(String(value ?? ""), {
    ALLOWED_TAGS: [...richTags, "strike"],
    ALLOWED_ATTR: ["style", "href", "target"],
    RETURN_DOM_FRAGMENT: true,
  });
  for (const strike of fragment.querySelectorAll("strike")) {
    const replacement = document.createElement("s");
    replacement.append(...strike.childNodes);
    strike.replaceWith(replacement);
  }
  for (const element of fragment.querySelectorAll<HTMLElement>("[style]")) {
    const style = element.style;
    const color = hexColor(style.color || "");
    const background = hexColor(style.backgroundColor || "");
    const weight = /^(bold|[1-9]00)$/.test(style.fontWeight)
      ? style.fontWeight
      : "";
    element.removeAttribute("style");
    // Written as text: the CSSOM would serialise colours back to rgb().
    const declarations = [
      color && `color: ${color}`,
      background && `background-color: ${background}`,
      element.tagName === "SPAN" && weight && `font-weight: ${weight}`,
    ]
      .filter(Boolean)
      .join("; ");
    if (!declarations) continue;
    if (element.tagName === "SPAN") element.setAttribute("style", declarations);
    else {
      // Browsers may colour a <b>/<i>; keep it by moving it to a span.
      const span = document.createElement("span");
      span.setAttribute("style", declarations);
      span.append(...element.childNodes);
      element.append(span);
    }
  }
  for (const link of fragment.querySelectorAll("a")) {
    const href = normalizeLink(link.getAttribute("href"));
    if (!href) {
      link.replaceWith(...link.childNodes);
      continue;
    }
    const blank = link.getAttribute("target") === "_blank";
    for (const name of [...link.getAttributeNames()])
      link.removeAttribute(name);
    link.setAttribute("href", href);
    if (blank) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    }
  }
  const holder = document.createElement("div");
  holder.append(fragment);
  return holder.innerHTML;
}
export function plain(value: unknown) {
  const element = document.createElement("div");
  element.innerHTML = richHtml(value);
  return element.textContent ?? "";
}
/** Plain text for a textarea: line breaks survive as newlines. */
export function editableText(value: unknown) {
  const element = document.createElement("div");
  element.innerHTML = richHtml(value);
  for (const br of element.querySelectorAll("br")) br.replaceWith("\n");
  for (const paragraph of element.querySelectorAll("p"))
    if (paragraph.nextSibling) paragraph.append("\n");
  return element.textContent ?? "";
}
const safeHref = (url: unknown) => normalizeLink(url) || "#";
/** Library icon drawn from validated geometry; size and colour follow text. */
export function VectorIcon({
  node,
  strokeWidth = 2,
  fill = false,
  label = "",
}: {
  node: IconNode;
  strokeWidth?: number;
  fill?: boolean;
  label?: string;
}) {
  return (
    <svg
      className="vector-icon"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill={fill ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {node.map(([shape, attributes], index) =>
        createElement(shape, { key: index, ...attributes }),
      )}
    </svg>
  );
}
function Countdown({ value }: { value: unknown }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const delta = Math.max(0, new Date(String(value)).getTime() - now) || 0;
  const values = [
    Math.floor(delta / 86400000),
    Math.floor(delta / 3600000) % 24,
    Math.floor(delta / 60000) % 60,
    Math.floor(delta / 1000) % 60,
  ];
  return (
    <div className="countdown-content">
      {values.map((number, index) => (
        <div key={index}>
          <b>{String(number).padStart(2, "0")}</b>
          <small>
            {[t("Gün"), t("Saat"), t("Dakika"), t("Saniye")][index]}
          </small>
        </div>
      ))}
    </div>
  );
}
const insideTextToolbar = (node: EventTarget | null) =>
  node instanceof Element && !!node.closest("[data-text-toolbar]");
function EditableText({
  tag: Tag,
  html,
  onHtml,
  onEdit,
}: {
  tag: "h1" | "h2" | "h3" | "h4" | "p" | "div";
  html: unknown;
  onHtml?: (value: string) => void;
  onEdit?: () => void;
}) {
  const elementRef = useRef<HTMLElement | null>(null);
  const [editing, setEditing] = useState(false);
  const value = richHtml(html);
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (
      element &&
      document.activeElement !== element &&
      element.innerHTML !== value
    )
      element.innerHTML = value;
  }, [value]);
  useEffect(() => {
    if (!editing) return;
    // Leave edit mode when the user works anywhere else; the floating text
    // toolbar keeps the text editable while its inputs have focus.
    const leave = (event: Event) => {
      const element = elementRef.current;
      if (
        !element ||
        (event.target instanceof Node && element.contains(event.target)) ||
        insideTextToolbar(event.target)
      )
        return;
      if (element.isConnected) onHtml?.(richHtml(element.innerHTML));
      setEditing(false);
    };
    document.addEventListener("focusin", leave);
    document.addEventListener("pointerdown", leave, true);
    return () => {
      document.removeEventListener("focusin", leave);
      document.removeEventListener("pointerdown", leave, true);
    };
  }, [editing, onHtml]);
  return (
    <Tag
      ref={(element) => {
        elementRef.current = element;
      }}
      className="rich-content"
      contentEditable={editing}
      suppressContentEditableWarning
      onDoubleClick={(event) => {
        event.stopPropagation();
        setEditing(true);
        requestAnimationFrame(() => elementRef.current?.focus());
        onEdit?.();
      }}
      onClick={(event) => {
        // Links inside text are edited, not followed, on the canvas.
        if ((event.target as Element).closest("a")) event.preventDefault();
      }}
      onInput={(event) => onHtml?.(richHtml(event.currentTarget.innerHTML))}
      onBlur={(event) => {
        onHtml?.(richHtml(event.currentTarget.innerHTML));
        if (!insideTextToolbar(event.relatedTarget)) setEditing(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setEditing(false);
          event.currentTarget.closest<HTMLElement>(".editor-block")?.focus();
        }
        if (event.key === "Enter" && !event.nativeEvent.isComposing) {
          // Keep one text element: Enter adds a line break instead of a
          // browser-generated <div> that would be stripped on save.
          event.preventDefault();
          document.execCommand("insertLineBreak");
        }
      }}
    />
  );
}
export function BlockContent({
  node,
  children,
  editable = false,
  device = "desktop",
  onHtml,
  onEdit,
  locked = false,
}: {
  node: Block;
  children?: ReactNode;
  editable?: boolean;
  /** Editor view of a locked element: never editable, never acts. */
  locked?: boolean;
  device?: Device;
  onHtml?: (html: string) => void;
  onEdit?: () => void;
}) {
  const studioContext = useStudio();
  let p = node.props;
  if (!editable && studioContext.language !== "tr")
    try {
      p = {
        ...p,
        ...JSON.parse(String(p.translations || "{}"))[studioContext.language],
      };
    } catch {}
  const { previewToken, pageId, assets } = useStudio();
  const [lightbox, setLightbox] = useState(false);
  const [actionError, setActionError] = useState("");
  const [failedSrc, setFailedSrc] = useState("");
  if (node.kind === "section") {
    const frozenWidth = Number(p.sectionContentWidth);
    const height = freeHeight(node, device);
    return (
      <div
        className={`section-content ${height ? "free-canvas" : ""}`}
        style={{
          ...(height ? { height } : {}),
          ...(p.globalDetached
            ? {
                maxWidth:
                  p.sectionContentWidth !== undefined &&
                  Number.isFinite(frozenWidth)
                    ? `${Math.max(0, Math.min(3000, frozenWidth))}px`
                    : (effectiveStyle(node, device).maxWidth ?? "none"),
              }
            : {}),
        }}
      >
        {children}
      </div>
    );
  }
  if (
    ["row", "column", "box", "itemList", "rating", "list"].includes(
      node.kind,
    ) &&
    freeHeight(node, device)
  )
    return (
      <div
        className="free-canvas"
        style={{ height: freeHeight(node, device)! }}
      >
        {children}
      </div>
    );
  if (
    ["row", "column", "box"].includes(node.kind) ||
    (["itemList", "rating", "list"].includes(node.kind) &&
      node.props.atomicContent)
  )
    return <>{children}</>;
  switch (node.kind) {
    case "heading":
    case "text": {
      const Tag = (node.kind === "heading" ? String(p.tag ?? "h2") : "div") as
        "h1" | "h2" | "h3" | "h4" | "p" | "div";
      return editable && !locked ? (
        <EditableText tag={Tag} html={p.html} onHtml={onHtml} onEdit={onEdit} />
      ) : (
        <Tag
          className="rich-content"
          dangerouslySetInnerHTML={{ __html: richHtml(p.html) }}
          onClick={
            editable
              ? (event) => {
                  // A locked text in the editor never follows its links.
                  if ((event.target as Element).closest("a"))
                    event.preventDefault();
                }
              : undefined
          }
        />
      );
    }
    case "image": {
      const src = assetUrl(
        device === "mobile" && p.mobileSrc ? p.mobileSrc : p.src,
        previewToken,
      );
      const image =
        !src || failedSrc === src ? (
          <div
            className="missing-media"
            role="img"
            aria-label={String(p.alt || t("Görsel"))}
          >
            {editable ? t("Görsel seç") : String(p.alt || t("Görsel"))}
          </div>
        ) : (
          <img
            className="block-image"
            src={src}
            srcSet={assets
              .find(
                (a) =>
                  String(
                    device === "mobile" && p.mobileSrc ? p.mobileSrc : p.src,
                  ).includes(a.id) && a.format !== "gif",
              )
              ?.variants?.map(
                (v) => `${assetUrl(v.url, previewToken)} ${v.width}w`,
              )
              .join(",")}
            sizes="(max-width:600px) 100vw, 50vw"
            alt={String(p.alt ?? "")}
            loading="lazy"
            style={{
              objectFit: "inherit",
              objectPosition: `${Number(p.focusX ?? 50)}% ${Number(p.focusY ?? 50)}%`,
              aspectRatio: String(p.aspectRatio || "auto"),
              transform: `rotate(${Number(p.rotation || 0)}deg) scale(${p.flipX ? -1 : 1},${p.flipY ? -1 : 1})`,
            }}
            draggable={false}
            role={!editable && p.lightbox ? "button" : undefined}
            tabIndex={!editable && p.lightbox ? 0 : undefined}
            onKeyDown={(event) => {
              if (
                !editable &&
                p.lightbox &&
                ["Enter", " "].includes(event.key)
              ) {
                event.preventDefault();
                setLightbox(true);
              }
            }}
            onClick={
              !editable && p.lightbox ? () => setLightbox(true) : undefined
            }
            onError={() => setFailedSrc(src)}
          />
        );
      return (
        <>
          {p.href && !editable ? <a href={safeHref(p.href)}>{image}</a> : image}
          <Dialog
            open={lightbox}
            onClose={() => setLightbox(false)}
            label={t("Görseli büyüt")}
          >
            <img src={src} alt={String(p.alt || "")} />
          </Dialog>
        </>
      );
    }
    case "button":
      if (editable && node.props.atomicContent)
        return <div className="block-button">{children}</div>;
      return (
        <>
          <a
            className="block-button"
            href={
              navigationActions.has(String(p.action || "navigate"))
                ? buttonLink(p) || "#"
                : "#"
            }
            target={p.targetBlank ? "_blank" : undefined}
            rel={p.targetBlank ? "noopener noreferrer" : undefined}
            onClick={(event) => {
              if (
                editable ||
                !navigationActions.has(String(p.action || "navigate"))
              ) {
                event.preventDefault();
                setActionError("");
                void performAction(node, pageId, editable).catch(() =>
                  setActionError(
                    t("Aksiyon tamamlanamadı. Tarayıcı izinlerini kontrol et."),
                  ),
                );
              } else if (pageId && !studioContext.previewToken)
                trackEvent(pageId, "click");
            }}
          >
            {node.props.atomicContent ? children : String(p.text)}
          </a>
          {actionError && <small role="alert">{actionError}</small>}
        </>
      );
    case "input":
      return (
        <label className="builder-field">
          {String(p.label || "")}
          <input
            className="block-input"
            aria-label={String(p.placeholder || t("Metin kutusu"))}
            type={
              ["email", "text", "tel", "number"].includes(String(p.inputType))
                ? String(p.inputType)
                : "text"
            }
            placeholder={String(p.placeholder)}
            name={String(p.fieldName || node.id)}
            onInvalid={(e) => {
              if (p.errorMessage)
                e.currentTarget.setCustomValidity(String(p.errorMessage));
            }}
            onInput={(e) => e.currentTarget.setCustomValidity("")}
            required={!!p.required}
          />
          <small>{String(p.helpText || "")}</small>
        </label>
      );
    case "textarea":
      return (
        <label className="builder-field">
          {String(p.label || "")}
          <textarea
            className="block-input"
            aria-label={String(p.placeholder || t("Metin alanı"))}
            placeholder={String(p.placeholder)}
            name={String(p.fieldName || node.id)}
            onInvalid={(e) => {
              if (p.errorMessage)
                e.currentTarget.setCustomValidity(String(p.errorMessage));
            }}
            onInput={(e) => e.currentTarget.setCustomValidity("")}
            required={!!p.required}
          />
          <small>{String(p.helpText || "")}</small>
        </label>
      );
    case "divider":
      return <div className="block-divider" />;
    case "spacer":
      return (
        <div className="block-spacer">
          {editable && <span>{t("Boşluk")}</span>}
        </div>
      );
    case "icon": {
      const vector = !p.src && parseIconNode(p.iconNode);
      if (vector) {
        const svg = (
          <VectorIcon
            node={vector}
            strokeWidth={iconStroke(p.strokeWidth)}
            fill={!!p.iconFill}
            label={String(p.alt || "")}
          />
        );
        return p.href && !editable ? (
          <a
            className="icon-link"
            href={safeHref(p.href)}
            target={p.targetBlank ? "_blank" : undefined}
            rel={p.targetBlank ? "noopener noreferrer" : undefined}
          >
            {svg}
          </a>
        ) : (
          svg
        );
      }
      if (p.src && p.iconTint)
        return (
          <span
            className="custom-icon icon-mask"
            role="img"
            aria-label={String(p.alt || p.text || "Icon")}
            style={{
              maskImage: `url(${JSON.stringify(assetUrl(p.src, previewToken))})`,
              WebkitMaskImage: `url(${JSON.stringify(assetUrl(p.src, previewToken))})`,
            }}
          />
        );
      if (!p.src && p.text === "↗")
        return (
          <>
            <ArrowUpRight size="1em" aria-hidden="true" />
            <span className="icon-symbol-label">↗</span>
          </>
        );
      return p.src ? (
        <img
          className="custom-icon"
          src={assetUrl(p.src, previewToken)}
          alt={String(p.alt || p.text || "")}
        />
      ) : (
        <span>{String(p.text)}</span>
      );
    }
    case "badge":
      return node.props.atomicContent ? (
        <div className="atomic-badge">{children}</div>
      ) : (
        <span>{String(p.text)}</span>
      );
    case "video":
      return p.src ? (
        <video className="block-video" src={String(p.src)} controls />
      ) : (
        <div className="video-placeholder">
          <Play size={32} />
          <span>{String(p.text)}</span>
        </div>
      );
    case "list":
      return (
        <ul className="block-list">
          {String(p.items)
            .split("\n")
            .filter(Boolean)
            .map((item, index) => (
              <li key={index}>{item}</li>
            ))}
        </ul>
      );
    case "product":
      if (p.atomicContent) return <>{children}</>;
      if (p.productId) return <CommerceBlock node={node} editable={editable} />;
      return (
        <div className="product-content">
          <img src={String(p.src)} alt={String(p.title)} />
          <h3>{String(p.title)}</h3>
          <p>
            <b>{String(p.price)}</b> <s>{String(p.comparePrice)}</s>
          </p>
          <small>{String(p.description)}</small>
          <span className="product-demo-label">
            <ShoppingBag size={12} />
            {" " + t("Örnek ürün · Shopify bağlı değil")}
          </span>
        </div>
      );
    case "countdown":
      return <Countdown value={p.endDate} />;
    case "accordion":
      if (p.accordionItems)
        return (
          <div
            className="accordion-items"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: Number(p.accordionGap ?? 12),
            }}
          >
            {accordionItems(node).map((item) => (
              <details
                key={item.id}
                style={{
                  border: `1px solid ${p.accordionBorderColor || "#dce3d3"}`,
                  borderRadius: Number(p.accordionRadius ?? 8),
                  overflow: "hidden",
                }}
              >
                <summary
                  style={{
                    padding: Number(p.accordionHeaderPadding ?? 16),
                    background: String(p.accordionHeaderBg || "#ffffff"),
                  }}
                >
                  {item.title}
                </summary>
                <div
                  style={{
                    padding: Number(p.accordionContentPadding ?? 16),
                    background: String(p.accordionContentBg || "#ffffff"),
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {item.content}
                </div>
              </details>
            ))}
          </div>
        );
      return (
        <details className="block-accordion">
          <summary>{String(p.title)}</summary>
          <p>{String(p.description)}</p>
        </details>
      );
    default:
      return (
        <AdvancedContent node={node} editable={editable}>
          {children}
        </AdvancedContent>
      );
  }
}
export function ReadOnlyBlock({
  node,
  device,
  parentFree = false,
}: {
  node: Block;
  device: Device;
  parentFree?: boolean;
}) {
  const studio = useStudio();
  if (node.hidden[device]) return null;
  let localized = node;
  try {
    localized = {
      ...node,
      props: {
        ...node.props,
        ...JSON.parse(String(node.props.translations || "{}"))[studio.language],
      },
    };
  } catch {}
  return (
    <div
      className={`content-block animation-${String(node.props.animation ?? "none")}`}
      id={
        node.kind === "form"
          ? undefined
          : String(node.props.cssId || "") || undefined
      }
      data-block={node.id}
      style={{
        ...brandStyle(node, device),
        ...placedStyle(node, device, parentFree),
        ...(node.props.backgroundSrc
          ? {
              backgroundImage: `linear-gradient(${String(node.props.backgroundOverlay || "#00000000")},${String(node.props.backgroundOverlay || "#00000000")}),url("${assetUrl(node.props.backgroundSrc, studio.previewToken)}")`,
              backgroundSize: "cover",
            }
          : {}),
      }}
    >
      <BlockContent node={localized} device={device}>
        {(node.kind === "button" && localized.props.text !== node.props.text
          ? setCaption(localized, String(localized.props.text)).children
          : node.children
        ).map((child) => (
          <ReadOnlyBlock
            key={child.id}
            node={child}
            device={device}
            parentFree={!!freeHeight(node, device)}
          />
        ))}
      </BlockContent>
    </div>
  );
}
export function PageRenderer({
  document: page,
  device,
}: {
  document: PageDocument;
  device: Device;
}) {
  const studio = useStudio();
  const viewId = useRef(crypto.randomUUID());
  useEffect(() => {
    if (!studio.editable && !studio.previewToken && studio.pageId)
      trackEvent(studio.pageId, "view", viewId.current);
  }, [studio.pageId, studio.editable, studio.previewToken]);
  return (
    <div className="page-surface" data-device={device}>
      {!!page.locales?.length && (
        <label className="page-language">
          {t("Dil")}{" "}
          <select
            aria-label={t("Sayfa dili")}
            value={studio.language}
            onChange={(e) => studio.setLanguage(e.target.value)}
          >
            {page.locales.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
      )}
      {page.nodes.map((node) => (
        <ReadOnlyBlock key={node.id} node={node} device={device} />
      ))}
      {studio.nextStage && (
        <a className="funnel-next" href={studio.nextStage}>
          {t("Sonraki adım →")}
        </a>
      )}
    </div>
  );
}
