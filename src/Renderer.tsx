import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import DOMPurify from "dompurify";
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
const safeHref = (url: unknown) =>
  /^(https?:\/\/|\/(?!\/)|#|mailto:|tel:)/i.test(String(url))
    ? String(url)
    : "#";
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
  onHtml,
  onEdit,
}: {
  node: Block;
  children?: ReactNode;
  editable?: boolean;
  onHtml?: (html: string) => void;
  onEdit?: () => void;
}) {
  const p = node.props;
  if (["section", "row", "column", "box"].includes(node.kind))
    return <>{children}</>;
  switch (node.kind) {
    case "heading":
    case "text": {
      const Tag = (node.kind === "heading" ? String(p.tag ?? "h2") : "div") as
        | "h1"
        | "h2"
        | "h3"
        | "h4"
        | "p"
        | "div";
      return editable ? (
        <EditableText tag={Tag} html={p.html} onHtml={onHtml} onEdit={onEdit} />
      ) : (
        <Tag
          className="rich-content"
          dangerouslySetInnerHTML={{ __html: richHtml(p.html) }}
        />
      );
    }
    case "image":
      return (
        <img
          className="block-image"
          src={String(p.src)}
          alt={String(p.alt ?? "")}
          draggable={false}
          onError={(event) => {
            event.currentTarget.style.opacity = "0.35";
          }}
        />
      );
    case "button":
      return (
        <a
          className="block-button"
          href={safeHref(p.href)}
          target={p.targetBlank ? "_blank" : undefined}
          rel={p.targetBlank ? "noopener noreferrer" : undefined}
          onClick={editable ? (event) => event.preventDefault() : undefined}
        >
          {String(p.text)}
        </a>
      );
    case "input":
      return (
        <input
          className="block-input"
          aria-label={String(p.placeholder || "Metin kutusu")}
          type={
            ["email", "text", "tel", "number"].includes(String(p.inputType))
              ? String(p.inputType)
              : "text"
          }
          placeholder={String(p.placeholder)}
        />
      );
    case "textarea":
      return (
        <textarea
          className="block-input"
          aria-label={String(p.placeholder || "Metin alanı")}
          placeholder={String(p.placeholder)}
        />
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
  }
}
export function ReadOnlyBlock({
  node,
  device,
}: {
  node: Block;
  device: Device;
}) {
  if (node.hidden[device]) return null;
  return (
    <div
      className={`content-block animation-${String(node.props.animation ?? "none")}`}
      id={String(node.props.cssId || "") || undefined}
      style={effectiveStyle(node, device)}
    >
      <BlockContent node={node}>
        {node.children.map((child) => (
          <ReadOnlyBlock key={child.id} node={child} device={device} />
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
  return (
    <div className="page-surface">
      {page.nodes.map((node) => (
        <ReadOnlyBlock key={node.id} node={node} device={device} />
      ))}
    </div>
  );
}
