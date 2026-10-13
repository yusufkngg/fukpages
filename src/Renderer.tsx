import {
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
import { Play, ShoppingBag } from "lucide-react";
import {
  effectiveStyle,
  type Block,
  type Device,
  type PageDocument,
} from "./model";
export function richHtml(value: unknown) {
  return DOMPurify.sanitize(String(value ?? ""), {
    ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "s", "br", "p", "span"],
    ALLOWED_ATTR: ["style"],
  });
}
export function plain(value: unknown) {
  const element = document.createElement("div");
  element.innerHTML = richHtml(value);
  return element.textContent ?? "";
}
const safeHref = (url: unknown) => normalizeLink(url) || "#";
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
          <small>{["Gün", "Saat", "Dakika", "Saniye"][index]}</small>
        </div>
      ))}
    </div>
  );
}
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
  return (
    <Tag
      ref={(element) => {
        elementRef.current = element;
      }}
      className="rich-content"
      contentEditable
      suppressContentEditableWarning
      onDoubleClick={(event) => {
        event.stopPropagation();
        event.currentTarget.focus();
        onEdit?.();
      }}
      onInput={(event) => onHtml?.(richHtml(event.currentTarget.innerHTML))}
      onBlur={(event) => onHtml?.(richHtml(event.currentTarget.innerHTML))}
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
}: {
  node: Block;
  children?: ReactNode;
  editable?: boolean;
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
  if (["row", "column", "box"].includes(node.kind) && freeHeight(node, device))
    return (
      <div
        className="free-canvas"
        style={{ height: freeHeight(node, device)! }}
      >
        {children}
      </div>
    );
  if (["row", "column", "box"].includes(node.kind)) return <>{children}</>;
  switch (node.kind) {
    case "heading":
    case "text": {
      const Tag = (node.kind === "heading" ? String(p.tag ?? "h2") : "div") as
        "h1" | "h2" | "h3" | "h4" | "p" | "div";
      return editable ? (
        <EditableText tag={Tag} html={p.html} onHtml={onHtml} onEdit={onEdit} />
      ) : (
        <Tag
          className="rich-content"
          dangerouslySetInnerHTML={{ __html: richHtml(p.html) }}
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
            aria-label={String(p.alt || "Görsel")}
          >
            {editable ? "Görsel seç" : String(p.alt || "Görsel")}
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
            label="Görseli büyüt"
          >
            <img src={src} alt={String(p.alt || "")} />
          </Dialog>
        </>
      );
    }
    case "button":
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
                    "Aksiyon tamamlanamadı. Tarayıcı izinlerini kontrol et.",
                  ),
                );
              } else if (pageId && !studioContext.previewToken)
                trackEvent(pageId, "click");
            }}
          >
            {String(p.text)}
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
            aria-label={String(p.placeholder || "Metin kutusu")}
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
            aria-label={String(p.placeholder || "Metin alanı")}
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
        <div className="block-spacer">{editable && <span>Boşluk</span>}</div>
      );
    case "icon":
    case "badge":
      return <span>{String(p.text)}</span>;
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
            <ShoppingBag size={12} /> Örnek ürün · Shopify bağlı değil
          </span>
        </div>
      );
    case "countdown":
      return <Countdown value={p.endDate} />;
    case "accordion":
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
        {node.children.map((child) => (
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
          Dil{" "}
          <select
            aria-label="Sayfa dili"
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
          Sonraki adım →
        </a>
      )}
    </div>
  );
}
