import { t } from "./i18n.ts";
import { useState } from "react";
import { Dialog } from "./Dialog";
import { PageRenderer } from "./Renderer";
import { StudioProvider, useStudio } from "./studio";
import {
  widths,
  deviceNames,
  type Block,
  type Device,
  type PageDocument,
} from "./model";
import { sectionDependencies } from "./sectionDesign";
export function SectionPreview({
  section,
  onClose,
  apply,
  actionLabel = t("Bölümü ekle"),
}: {
  section: Block;
  onClose: () => void;
  apply: (section: Block) => void;
  actionLabel?: string;
}) {
  const studio = useStudio();
  const [device, setDevice] = useState<Device>("desktop"),
    [productId, setProductId] = useState("");
  const prepared = structuredClone(section);
  const bind = (n: Block) => {
    if (productId && !n.props.productId) n.props.productId = productId;
    n.children.forEach(bind);
  };
  bind(prepared);
  const page: PageDocument = {
    schemaVersion: 1,
    name: t("Bölüm önizlemesi"),
    type: "landing",
    nodes: [prepared],
  };
  return (
    <Dialog
      open
      onClose={onClose}
      label={t("Bölüm önizlemesi")}
      className="section-preview-dialog"
    >
      <h2>{section.name}</h2>
      <div className="preview-device-controls">
        {(["desktop", "tablet", "mobile"] as Device[]).map((d) => (
          <button
            key={d}
            aria-label={t("Önizleme {p0}", { p0: deviceNames[d] })}
            aria-pressed={d === device}
            onClick={() => setDevice(d)}
          >
            {deviceNames[d]}
          </button>
        ))}
      </div>
      {!!studio.catalog.products.length && (
        <label>
          {t("Önizleme ürünü")}
          <select
            aria-label={t("Bölüm önizleme ürünü")}
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">{t("Ürün seç")}</option>
            {studio.catalog.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {sectionDependencies(section).map((m) => (
        <p className="feature-warning" key={m}>
          {m}
        </p>
      ))}
      <p>
        {t(
          "Mağazanın fontları, renkleri ve gerçek bölüm düzeniyle önizleme. Ürün seçimi yalnızca bu önizlemeyi etkiler.",
        )}
      </p>
      <div className="section-live-preview" data-section-live-preview>
        <div
          inert
          style={{
            width: widths[device],
            zoom: device === "desktop" ? 0.7 : device === "tablet" ? 0.85 : 1,
          }}
        >
          <StudioProvider
            page={page}
            value={{
              ...studio,
              editable: true,
              pageId: "",
              storeId: studio.storeId + "-preview",
            }}
          >
            <PageRenderer document={page} device={device} />
          </StudioProvider>
        </div>
      </div>
      <button className="primary-button" onClick={() => apply(prepared)}>
        {actionLabel}
      </button>
    </Dialog>
  );
}
