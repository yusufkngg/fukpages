import { t } from "./i18n.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, LayoutTemplate, Monitor, Smartphone, Tablet } from "lucide-react";
import { Dialog } from "./Dialog";
import { PageRenderer } from "./Renderer";
import {
  buildTemplate,
  pageTemplates,
  templateLabel,
  type PageTemplate,
  type TemplateContext,
} from "./pageTemplateLibrary";
import {
  deviceNames,
  pageNames,
  widths,
  type Block,
  type Device,
  type PageDocument,
  type PageType,
} from "./model";

export type TemplateFilter = "all" | PageType;
export const templateFilters: TemplateFilter[] = [
  "all",
  "home",
  "product",
  "collection",
  "landing",
  "page",
];
const filterLabel = (filter: TemplateFilter) =>
  filter === "all" ? t("Tümü") : pageNames[filter];

function previewDocument(template: PageTemplate, context: TemplateContext) {
  return {
    schemaVersion: 1,
    name: templateLabel(template).name,
    type: template.types[0],
    nodes: buildTemplate(template.id, context),
  } satisfies PageDocument;
}

/** Scaled live render of the top of a template, drawn once it is visible. */
export function TemplateThumbnail({
  template,
  context,
}: {
  template: PageTemplate;
  context: TemplateContext;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [scale, setScale] = useState(0.2);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const resize = new ResizeObserver((entries) =>
      setScale(entries[0].contentRect.width / widths.desktop),
    );
    resize.observe(element);
    const seen = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          seen.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    seen.observe(element);
    return () => {
      resize.disconnect();
      seen.disconnect();
    };
  }, []);
  const document = useMemo(
    () => (visible ? previewDocument(template, context) : null),
    [visible, template, context],
  );
  return (
    <div
      className="template-thumbnail-render"
      ref={ref}
      inert
      aria-hidden="true"
      data-template-thumbnail={template.id}
    >
      {document ? (
        <div
          style={{
            width: widths.desktop,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <PageRenderer document={document} device="desktop" />
        </div>
      ) : (
        <LayoutTemplate size={22} />
      )}
    </div>
  );
}

/** Full-page preview in desktop, tablet and mobile widths. */
export function TemplatePreview({
  template,
  context,
  onClose,
  use,
}: {
  template: PageTemplate;
  context: TemplateContext;
  onClose: () => void;
  use: () => void;
}) {
  const [device, setDevice] = useState<Device>("desktop");
  const document = useMemo(
    () => previewDocument(template, context),
    [template, context],
  );
  const label = templateLabel(template);
  return (
    <Dialog
      open
      onClose={onClose}
      label={t("Şablon önizlemesi")}
      className="template-preview-dialog"
    >
      <header className="template-preview-header">
        <div>
          <h2>{label.name}</h2>
          <p>{label.description}</p>
        </div>
        <div className="preview-device-controls">
          {(
            [
              ["desktop", Monitor],
              ["tablet", Tablet],
              ["mobile", Smartphone],
            ] as const
          ).map(([key, Icon]) => (
            <button
              key={key}
              aria-label={t("Önizleme {p0}", { p0: deviceNames[key] })}
              aria-pressed={device === key}
              onClick={() => setDevice(key)}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>
        <button className="template-use-button" onClick={use}>
          {t("Şablonu kullan")}
        </button>
      </header>
      <div className="template-live-preview" data-template-live-preview>
        <div inert style={{ width: widths[device], maxWidth: "100%" }}>
          <PageRenderer document={document} device={device} />
        </div>
      </div>
    </Dialog>
  );
}

/** Template gallery for the editor's left panel. */
export function TemplateLibrary({
  pageType,
  context,
  hasContent,
  apply,
}: {
  pageType: PageType;
  context: TemplateContext;
  hasContent: boolean;
  apply: (
    template: PageTemplate,
    sections: Block[],
    mode: "replace" | "append",
  ) => void;
}) {
  const recommended = pageTemplates.some((tpl) => tpl.types.includes(pageType));
  const [filter, setFilter] = useState<TemplateFilter>(
    recommended ? pageType : "all",
  );
  const [preview, setPreview] = useState<PageTemplate | null>(null);
  const [choice, setChoice] = useState<PageTemplate | null>(null);
  const shown = pageTemplates.filter(
    (tpl) => filter === "all" || tpl.types.includes(filter),
  );
  const sectionCounts = useMemo(
    () =>
      Object.fromEntries(
        pageTemplates.map((tpl) => [tpl.id, tpl.build(context).length]),
      ),
    [context],
  );
  const use = (template: PageTemplate) => {
    setPreview(null);
    if (hasContent) setChoice(template);
    else apply(template, buildTemplate(template.id, context), "replace");
  };
  return (
    <>
      <div
        className="template-filters"
        role="tablist"
        aria-label={t("Şablon türü")}
      >
        {templateFilters
          .filter(
            (f) =>
              f === "all" || pageTemplates.some((tpl) => tpl.types.includes(f)),
          )
          .map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
            >
              {filterLabel(f)}
            </button>
          ))}
      </div>
      <div className="library-scroll template-gallery">
        {shown.map((template) => {
          const label = templateLabel(template);
          const sections = sectionCounts[template.id];
          return (
            <article
              key={template.id}
              className="template-entry"
              data-template={template.id}
            >
              <button
                className="template-entry-visual"
                aria-label={t("{p0} önizle", { p0: label.name })}
                onClick={() => setPreview(template)}
              >
                <TemplateThumbnail template={template} context={context} />
                <span className="template-entry-hover">
                  <Eye size={14} />
                  {t("Önizle")}
                </span>
              </button>
              <div className="template-entry-body">
                <strong>{label.name}</strong>
                <small>
                  {template.types.map((type) => pageNames[type]).join(" · ")}
                  {" · "}
                  {t("{p0} bölüm", { p0: sections })}
                </small>
                <p>{label.description}</p>
                <button
                  className="template-use-button"
                  aria-label={t("{p0} şablonunu kullan", { p0: label.name })}
                  onClick={() => use(template)}
                >
                  {t("Şablonu kullan")}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {preview && (
        <TemplatePreview
          template={preview}
          context={context}
          onClose={() => setPreview(null)}
          use={() => use(preview)}
        />
      )}
      {choice && (
        <Dialog
          open
          onClose={() => setChoice(null)}
          label={t("Şablonu uygula")}
          className="template-apply-dialog"
        >
          <h2>
            {t("“{p0}” şablonu nasıl eklensin?", {
              p0: templateLabel(choice).name,
            })}
          </h2>
          <p>
            {t(
              "Mevcut tasarımın geri al ve sürüm geçmişinde kalır. Yayındaki sayfa, tekrar yayınlayana kadar değişmez.",
            )}
          </p>
          <div className="template-apply-actions">
            <button
              className="primary"
              onClick={() => {
                apply(choice, buildTemplate(choice.id, context), "replace");
                setChoice(null);
              }}
            >
              {t("Sayfayı şablonla değiştir")}
            </button>
            <button
              onClick={() => {
                apply(choice, buildTemplate(choice.id, context), "append");
                setChoice(null);
              }}
            >
              {t("Bölümleri sayfanın sonuna ekle")}
            </button>
            <button onClick={() => setChoice(null)}>{t("Vazgeç")}</button>
          </div>
        </Dialog>
      )}
    </>
  );
}

/** Dialog used by page management to start a new page from a template. */
export function TemplatePicker({
  context,
  onClose,
  create,
  blockedTypes = [],
}: {
  context: TemplateContext;
  onClose: () => void;
  create: (template: PageTemplate, type: PageType) => Promise<void>;
  /** Types the store cannot take another page of (its single homepage). */
  blockedTypes?: PageType[];
}) {
  const [filter, setFilter] = useState<TemplateFilter>("all");
  const [preview, setPreview] = useState<PageTemplate | null>(null);
  const [busy, setBusy] = useState("");
  const shown = pageTemplates.filter(
    (tpl) => filter === "all" || tpl.types.includes(filter),
  );
  /** Page type a template will be created as in this store. */
  const typeFor = (template: PageTemplate) => {
    const preferred =
      filter !== "all" && template.types.includes(filter)
        ? filter
        : template.types[0];
    if (!blockedTypes.includes(preferred)) return preferred;
    return template.types.find((type) => !blockedTypes.includes(type)) ?? null;
  };
  const start = async (template: PageTemplate) => {
    const type = typeFor(template);
    if (!type) return;
    setBusy(template.id);
    try {
      await create(template, type);
    } finally {
      setBusy("");
    }
  };
  return (
    <Dialog
      open
      onClose={onClose}
      label={t("Şablondan sayfa oluştur")}
      className="template-picker-dialog"
    >
      <h2>{t("Şablondan sayfa oluştur")}</h2>
      <p>
        {t(
          "Bir şablon seç; sayfa taslak olarak oluşturulur ve editörde açılır.",
        )}
      </p>
      <div className="template-filters" role="tablist">
        {templateFilters.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
          >
            {filterLabel(f)}
          </button>
        ))}
      </div>
      <div className="template-picker-grid">
        {shown.map((template) => {
          const label = templateLabel(template);
          return (
            <article
              key={template.id}
              className="template-entry"
              data-template={template.id}
            >
              <button
                className="template-entry-visual"
                aria-label={t("{p0} önizle", { p0: label.name })}
                onClick={() => setPreview(template)}
              >
                <TemplateThumbnail template={template} context={context} />
              </button>
              <div className="template-entry-body">
                <strong>{label.name}</strong>
                <small>
                  {template.types.map((type) => pageNames[type]).join(" · ")}
                </small>
                <p>{label.description}</p>
                {typeFor(template) !== template.types[0] &&
                  blockedTypes.includes(template.types[0]) && (
                    <small className="template-type-note">
                      {typeFor(template)
                        ? t(
                            "Mağazanın zaten bir ana sayfası var; {p0} olarak oluşturulur.",
                            { p0: pageNames[typeFor(template)!] },
                          )
                        : t("Mağazanın zaten bir ana sayfası var.")}
                    </small>
                  )}
                <button
                  className="template-use-button"
                  disabled={!!busy || !typeFor(template)}
                  aria-label={t("{p0} ile sayfa oluştur", { p0: label.name })}
                  onClick={() => void start(template)}
                >
                  {busy === template.id
                    ? t("Oluşturuluyor…")
                    : t("Bu şablonla oluştur")}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {preview && (
        <TemplatePreview
          template={preview}
          context={context}
          onClose={() => setPreview(null)}
          use={() => {
            const chosen = preview;
            setPreview(null);
            void start(chosen);
          }}
        />
      )}
    </Dialog>
  );
}
