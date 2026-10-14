import { t } from "./i18n.ts";
import { useState, useEffect, type ReactNode } from "react";
import { Dialog, scrollBehavior } from "./Dialog";
import { trackEvent } from "./metrics";
import { CommerceBlock } from "./Commerce";
import DOMPurify from "dompurify";
import { PanelCarousel, PanelTabs } from "./Panels";
import { api, json } from "./api";
import type { Block } from "./model";
import { buttonLink, navigationActions } from "./links";
import { assetUrl, fontFamilyFor, useStudio } from "./studio";
const lines = (v: unknown) =>
  String(v || "")
    .split("\n")
    .filter(Boolean);
export async function performAction(
  node: Block,
  pageId: string,
  editable = false,
) {
  if (editable) return;
  const p = node.props,
    target = navigationActions.has(String(p.action || "navigate"))
      ? buttonLink(p)
      : String(p.actionTarget || p.href || ""),
    action = String(p.action || "navigate");
  trackEvent(pageId, "click");
  switch (action) {
    case "scroll":
      document
        .getElementById(target.replace(/^#/, ""))
        ?.scrollIntoView({ behavior: scrollBehavior() });
      break;
    case "popupOpen":
    case "popupClose":
      window.dispatchEvent(
        new CustomEvent("fukpages:popup", {
          detail: { id: target, open: action === "popupOpen" },
        }),
      );
      break;
    case "copyCoupon":
      await navigator.clipboard.writeText(target || String(p.couponCode || ""));
      break;
    case "formSubmit": {
      const form = document.getElementById(target) as HTMLFormElement | null;
      if (form instanceof HTMLFormElement) form.requestSubmit();
      break;
    }
    case "cartOpen":
      window.dispatchEvent(new CustomEvent("fukpages:cart"));
      break;
    case "addToCart":
      window.dispatchEvent(
        new CustomEvent("fukpages:add", { detail: { productId: p.productId } }),
      );
      break;
    case "phone":
    case "email":
    case "whatsapp": {
      const dest =
        action === "phone"
          ? `tel:${target.replace(/[^+\d]/g, "")}`
          : action === "email"
            ? `mailto:${target.replace(/[\r\n]/g, "")}`
            : `https://wa.me/${target.replace(/\D/g, "")}`;
      window.location.href = dest;
      break;
    }
    default:
      if (/^(https?:\/\/|\/(?!\/)|#|mailto:|tel:)/i.test(target)) {
        if (p.targetBlank) window.open(target, "_blank", "noopener,noreferrer");
        else window.location.href = target;
      }
  }
}
export function FormContent({
  node,
  children,
  editable,
}: {
  node: Block;
  children: ReactNode;
  editable: boolean;
}) {
  const { pageId, previewToken, formDestination } = useStudio();
  const [state, setState] = useState(""),
    [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  return (
    <form
      id={String(node.props.cssId || node.id)}
      className="builder-form"
      onChange={() => setRequestId(crypto.randomUUID())}
      onSubmit={async (e) => {
        e.preventDefault();
        if (editable || previewToken) {
          setState(t("Önizlemede gönderim kapalı. Formu yerel yayında dene."));
          return;
        }
        if (busy) return;
        setBusy(true);
        try {
          const data = new FormData(e.currentTarget),
            values = Object.fromEntries(
              [...data.entries()].filter(([k]) => k !== "companyWebsite"),
            );
          await api(`/public/pages/${pageId}/forms/${node.id}`, {
            method: "POST",
            body: json({
              values,
              companyWebsite: data.get("companyWebsite"),
              requestId,
            }),
          });
          setState(
            String(node.props.successMessage || t("Gönderimin alındı.")),
          );
          const target = String(node.props.redirect || "");
          if (/^(https?:\/\/|\/(?!\/))/.test(target))
            window.location.href = target;
        } catch (err) {
          setState((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <small className="form-destination">
        {t("Hedef:")}{" "}
        {node.props.destination === "webhook"
          ? formDestination
          : t("Uygulama içi gönderim kayıtları")}
      </small>
      {children}
      <label className="form-honeypot" aria-hidden="true">
        Website
        <input name="companyWebsite" tabIndex={-1} autoComplete="off" />
      </label>
      <button type="submit" disabled={busy}>
        {busy
          ? t("Gönderiliyor…")
          : String(node.props.submitLabel || t("Gönder"))}
      </button>
      <p role="status">{state}</p>
    </form>
  );
}
function Popup({
  node,
  children,
  editable,
}: {
  node: Block;
  children?: ReactNode;
  editable: boolean;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const f = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (
        d.id === node.id ||
        d.id === node.props.popupId ||
        d.id === node.props.cssId
      )
        setOpen(d.open);
    };
    window.addEventListener("fukpages:popup", f);
    return () => window.removeEventListener("fukpages:popup", f);
  }, [node.id, node.props.popupId, node.props.cssId]);
  return editable ? (
    <div className="popup-editor">
      <small>Popup · ID: {node.id}</small>
      {children}
    </div>
  ) : (
    <>
      {node.props.trigger === "button" && (
        <button onClick={() => setOpen(true)}>
          {String(node.props.text || t("Aç"))}
        </button>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        label={String(node.props.title || "Popup")}
      >
        {children}
      </Dialog>
    </>
  );
}
export function AdvancedContent({
  node,
  children,
  editable = false,
}: {
  node: Block;
  children?: ReactNode;
  editable?: boolean;
}) {
  const p = node.props,
    { previewToken, assets, brand } = useStudio();
  const [active, setActive] = useState(0),
    [copied, setCopied] = useState(false),
    [open, setOpen] = useState(false);
  const items = lines(p.items),
    images = lines(p.images).map((u) => assetUrl(u, previewToken));
  if (
    [
      "productField",
      "productGallery",
      "variantPicker",
      "quantity",
      "addToCart",
      "stickyCart",
      "collectionGrid",
      "bundle",
      "shipping",
    ].includes(node.kind)
  )
    return <CommerceBlock node={node} editable={editable} />;
  switch (node.kind) {
    case "form":
      return (
        <FormContent node={node} editable={editable}>
          {children}
        </FormContent>
      );
    case "popup":
      return (
        <Popup node={node} editable={editable}>
          {children}
        </Popup>
      );
    case "select":
    case "checkbox":
    case "radio":
      return (
        <label className="builder-field">
          {String(p.label)}
          {node.kind === "select" ? (
            <select
              name={String(p.fieldName || node.id)}
              required={!!p.required}
            >
              {lines(p.options).map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ) : node.kind === "checkbox" ? (
            <input
              type="checkbox"
              name={String(p.fieldName || node.id)}
              value="true"
              required={!!p.required}
            />
          ) : (
            <span>
              {lines(p.options).map((o) => (
                <label key={o}>
                  <input
                    name={String(p.fieldName || node.id)}
                    type="radio"
                    value={o}
                    required={!!p.required}
                  />
                  {o}
                </label>
              ))}
            </span>
          )}
          <small>{String(p.helpText || "")}</small>
        </label>
      );
    case "tabs":
      if (node.children.length)
        return (
          <PanelTabs node={node} editable={editable}>
            {children}
          </PanelTabs>
        );
      return (
        <div className="builder-tabs">
          <div role="tablist">
            {items.map((i, n) => (
              <button
                key={n}
                role="tab"
                aria-selected={active === n}
                id={`${node.id}-tab-${n}`}
                aria-controls={`${node.id}-panel`}
                tabIndex={active === n ? 0 : -1}
                onKeyDown={(event) => {
                  if (
                    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                      event.key,
                    )
                  )
                    return;
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? items.length - 1
                        : (n +
                            (event.key === "ArrowRight" ? 1 : -1) +
                            items.length) %
                          items.length;
                  setActive(next);
                  document.getElementById(`${node.id}-tab-${next}`)?.focus();
                }}
                onClick={() => setActive(n)}
              >
                {i.split("|")[0]}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id={`${node.id}-panel`}
            aria-labelledby={`${node.id}-tab-${active}`}
          >
            {items[active]?.split("|").slice(1).join("|") ||
              String(p.description || t("Sekme içeriği"))}
          </div>
        </div>
      );
    case "carousel":
      if (node.children.length)
        return (
          <PanelCarousel node={node} editable={editable}>
            {children}
          </PanelCarousel>
        );
      return (
        <div className="builder-carousel">
          {images[active % images.length] && (
            <img
              src={images[active % images.length]}
              alt={String(p.alt || t("Slayt {p0}", { p0: active + 1 }))}
              loading="lazy"
            />
          )}
          <p>{items[active % items.length]}</p>
          <button
            aria-label={t("Önceki slayt")}
            onClick={() =>
              setActive(
                (active + images.length - 1) % Math.max(1, images.length),
              )
            }
          >
            ←
          </button>
          <button
            aria-label={t("Sonraki slayt")}
            onClick={() => setActive((active + 1) % Math.max(1, images.length))}
          >
            →
          </button>
        </div>
      );
    case "gallery":
    case "logos":
      return (
        <div
          className={`builder-gallery ${node.kind === "logos" ? "logo-strip" : ""}`}
          data-moving={node.kind === "logos" && !!p.moving}
        >
          <div
            className={node.kind === "logos" ? "logos-track" : "gallery-track"}
          >
            {[
              ...images,
              ...(node.kind === "logos" && p.moving ? images : []),
            ].map((u, n) => (
              <button
                key={n}
                onClick={() => {
                  setActive(n);
                  setOpen(true);
                }}
              >
                <img
                  src={u}
                  alt={String(p.alt || t("Görsel {p0}", { p0: n + 1 }))}
                  loading="lazy"
                />
              </button>
            ))}
          </div>
          <Dialog
            open={open && !editable}
            onClose={() => setOpen(false)}
            label={t("Görseli büyüt")}
          >
            <img src={images[active]} alt={String(p.alt || "")} />
          </Dialog>
        </div>
      );
    case "rating":
      return (
        <div aria-label={`${p.rating} / 5`}>
          ★★★★★ <b>{String(p.rating)} / 5</b> · {String(p.count)}{" "}
          {String(p.text || t("değerlendirme"))}
        </div>
      );
    case "comparison":
    case "sizeTable":
      return (
        <table className="builder-table">
          <thead>
            <tr>
              {String(p.columns || "")
                .split("|")
                .map((c, n) => (
                  <th key={n}>{c}</th>
                ))}
            </tr>
          </thead>
          <tbody>
            {lines(p.rows).map((r, n) => (
              <tr key={n}>
                {r.split("|").map((c, i) => (
                  <td key={i}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "beforeAfter":
      return (
        <div className="before-after">
          <div>
            <img src={images[1]} alt={t("Sonra")} />
            <img
              src={images[0]}
              alt={t("Önce")}
              style={{ clipPath: `inset(0 ${100 - (active || 50)}% 0 0)` }}
            />
          </div>
          <label>
            {t("Önce / sonra")}
            <input
              type="range"
              min={1}
              max={99}
              value={active || 50}
              onChange={(e) => setActive(Number(e.target.value))}
            />
          </label>
        </div>
      );
    case "coupon":
      return (
        <button
          onClick={async () => {
            if (editable) return;
            try {
              await navigator.clipboard.writeText(String(p.couponCode || ""));
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied
            ? t("Kopyalandı ✓")
            : `${p.text || t("Kuponu kopyala")} ${p.couponCode || ""}`}
        </button>
      );
    case "shipping":
      return (
        <div>
          <b>{String(p.title || t("Teslimat ve iade"))}</b>
          <p>{String(p.description || t("Teslimat koşullarını düzenle."))}</p>
        </div>
      );
    case "videoPopup":
      return (
        <>
          <button onClick={() => setOpen(true)}>
            {String(p.text || t("Videoyu izle"))}
          </button>
          <Dialog
            open={open && !editable}
            onClose={() => setOpen(false)}
            label={t("Video")}
          >
            <video src={assetUrl(p.src, previewToken)} controls autoPlay />
          </Dialog>
        </>
      );
    case "backToTop":
      return (
        <button
          aria-label={t("Yukarı dön")}
          onClick={() =>
            !editable && window.scrollTo({ top: 0, behavior: scrollBehavior() })
          }
        >
          {String(p.text || t("↑ Yukarı dön"))}
        </button>
      );
    case "breadcrumb":
    case "mobileMenu":
      return (
        <nav
          aria-label={
            node.kind === "breadcrumb" ? "Breadcrumb" : t("Mobil menü")
          }
        >
          {node.kind === "mobileMenu" && (
            <button onClick={() => setOpen(!open)}>
              ☰ {String(p.title || t("Menü"))}
            </button>
          )}
          {(node.kind === "breadcrumb" || open || editable) &&
            items.map((i, n) => {
              const [title, href] = i.split("|");
              return (
                <a
                  key={n}
                  href={
                    /^(https?:\/\/|\/(?!\/)|#)/.test(href || "") ? href : "#"
                  }
                  onClick={editable ? (e) => e.preventDefault() : undefined}
                >
                  {title}
                  {node.kind === "breadcrumb" ? " / " : ""}
                </a>
              );
            })}
        </nav>
      );
    case "blogList":
      return (
        <div
          className={`builder-blog ${p.view === "editorial" ? "editorial" : ""}`}
        >
          {items.map((i, n) => {
            const [title, author, date, summary, href] = i.split("|");
            return (
              <article key={n}>
                <h3>{title}</h3>
                <small>
                  {author} · {date}
                </small>
                <p>{summary}</p>
                <a
                  href={
                    /^(https?:\/\/|\/(?!\/)|#)/.test(href || "") ? href : "#"
                  }
                >
                  {t("Devamını oku")}
                </a>
              </article>
            );
          })}
        </div>
      );
    case "customCode":
      return (
        <iframe
          title={String(p.title || t("Kontrollü HTML"))}
          sandbox="allow-same-origin"
          srcDoc={
            "<style>" +
            assets
              .filter((a) => a.type === "font")
              .map(
                (a) =>
                  `@font-face{font-family:"${a.family}";src:url("${assetUrl(a.url, previewToken)}") format("${a.format}");font-weight:${a.axes?.wght ? `${a.axes.wght.min} ${a.axes.wght.max}` : a.weight};font-style:${a.italic ? "italic" : "normal"};font-display:swap}`,
              )
              .join("") +
            `body{font-family:${fontFamilyFor(brand, "body")};color:${brand.colors.text}}h1,h2,h3,h4,h5,h6{font-family:${fontFamilyFor(brand, "heading")}}button,a{font-family:${fontFamilyFor(brand, "button")}}</style>` +
            DOMPurify.sanitize(
              String(p.code || t("<p>HTML içeriğini düzenle.</p>")),
            )
          }
        />
      );
    case "appEmbed":
      return (
        <div className="integration-placeholder">
          {String(p.title || t("Uygulama bileşeni"))}
          {" " + t("· Dış hizmet bağlantısı yapılandırılmadı.")}
        </div>
      );
    default:
      return null;
  }
}
