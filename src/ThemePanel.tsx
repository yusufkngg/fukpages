import { t, formatDateTime } from "./i18n.ts";
import { useEffect, useState } from "react";
import {
  ExternalLink,
  Layers,
  ShoppingBag,
  LockKeyhole,
  RefreshCw,
  Unplug,
} from "lucide-react";
import type { ThemeSection, ThemeSnapshot, ThemeStatus } from "./theme";
export function ThemePanel({
  status,
  busy,
  sync,
  saveDomain,
  selectedId,
  select,
  useShell,
  bind,
  clearBinding,
}: {
  status: ThemeStatus;
  busy: boolean;
  sync: () => void;
  saveDomain: (value: string) => Promise<void>;
  selectedId: string | null;
  select: (id: string) => void;
  useShell: boolean;
  bind: (snapshot: ThemeSnapshot, enabled: boolean) => void;
  clearBinding: () => void;
}) {
  const [domain, setDomain] = useState(status.domain);
  useEffect(() => setDomain(status.domain), [status.domain]);
  return (
    <div className="library-scroll theme-panel">
      <div className="theme-connect-card">
        <span>
          <span
            className={`theme-connected-dot ${status.snapshot ? "synced" : ""}`}
          />
          {status.snapshot ? t("Tema verisi alındı") : t("Tema bağlantısı")}
        </span>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void saveDomain(domain);
          }}
        >
          <label>
            {t("Shopify mağaza adresi")}
            <input
              aria-label={t("Shopify mağaza adresi")}
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              placeholder="magazam.myshopify.com"
            />
          </label>
          <button disabled={busy || !domain.trim()}>
            {t("Adresi kaydet")}
          </button>
        </form>
        {!status.configured && (
          <p>
            {t(
              "Mağaza için tema okuma erişimi gerekli. Kurulum tamamlandığında mevcut header/footer ve bölüm sırası burada görünür.",
            )}
          </p>
        )}
        <button
          className="theme-sync-button"
          disabled={!status.configured || busy}
          onClick={sync}
        >
          <RefreshCw size={13} className={busy ? "spin" : ""} />
          {busy ? t("Tema okunuyor…") : t("Temayı senkronize et")}
        </button>
      </div>
      {status.snapshot && (
        <>
          <div className="theme-snapshot-meta">
            <strong>{status.snapshot.themeName}</strong>
            <small>{status.snapshot.templateFilename}</small>
            <span>
              {t("Son okuma:")} {formatDateTime(status.snapshot.syncedAt)}
            </span>
          </div>
          <label className="toggle-row theme-shell-toggle">
            <span>{t("Tema düzenini kullan")}</span>
            <input
              type="checkbox"
              aria-label={t("Tema düzenini kullan")}
              checked={useShell}
              onChange={(event) => bind(status.snapshot!, event.target.checked)}
            />
          </label>
          <p className="theme-shell-help">
            {t(
              "Header/footer temadan gelir. Özel bölümler içerik alanında kalır. Tema bölümlerinin görsel önizlemesi henüz yok; konumları gösterilir.",
            )}
          </p>
          {(["header", "main", "footer"] as const).map((region) => (
            <div className="native-section-group" key={region}>
              <h3>
                {region === "header"
                  ? t("HEADER GRUBU")
                  : region === "footer"
                    ? t("FOOTER GRUBU")
                    : t("ŞABLON BÖLÜMLERİ")}
              </h3>
              {status
                .snapshot!.sections.filter(
                  (section) => section.region === region,
                )
                .map((section) => (
                  <button
                    key={section.id}
                    data-native-section={section.type}
                    className={`native-section-row ${selectedId === section.id ? "active" : ""} ${!section.enabled ? "disabled-section" : ""}`}
                    onClick={() => select(section.id)}
                  >
                    <Layers size={14} />
                    <span>
                      {section.name}
                      <small>
                        {section.type}
                        {!section.enabled && " · Gizli"}
                      </small>
                    </span>
                    <LockKeyhole size={11} />
                  </button>
                ))}
            </div>
          ))}
        </>
      )}
      {useShell && (
        <button className="theme-clear-binding" onClick={clearBinding}>
          <Unplug size={12} />
          {" " + t("Tema eşleşmesini kaldır")}
        </button>
      )}
    </div>
  );
}
export function NativeThemeSection({
  section,
  select,
}: {
  section: ThemeSection;
  select?: () => void;
}) {
  if (!section.enabled) return null;
  return (
    <div
      className={`native-theme-placeholder ${section.region}`}
      data-theme-section={section.type}
      onClick={(event) => {
        event.stopPropagation();
        select?.();
      }}
    >
      <div>
        <ShoppingBag size={20} className="shopify-section-icon" />
        <span>
          <b>{section.name}</b>
          <small>
            {t("Shopify tema bölümü ·") + " "}
            {section.type}
          </small>
        </span>
        <span className="native-shopify-tag">SHOPIFY</span>
      </div>
      <p>
        {t(
          "Tema bölümünün konumu gösteriliyor. Gerçek görünüm Shopify temasında korunur.",
        )}
      </p>
    </div>
  );
}
export function NativeThemeInspector({
  section,
  snapshot,
}: {
  section: ThemeSection;
  snapshot: ThemeSnapshot;
}) {
  const themeNumber = snapshot.themeId.split("/").pop();
  return (
    <aside className="inspector">
      <div className="inspector-heading">
        <span>
          <Layers size={16} /> {section.name}
        </span>
        <LockKeyhole size={13} />
      </div>
      <div className="device-notice">{t("Shopify teması · kaynak bölüm")}</div>
      <div className="inspector-scroll native-inspector">
        <div className="native-info-card">
          <span className="native-shopify-tag">SHOPIFY</span>
          <h3>{t("Temanızdaki bölüm.")}</h3>
          <p>
            {t("Bu bölüm") + " "}
            {snapshot.themeName}
            {" " +
              t(
                "temasından okundu. Düzenleme Shopify tema düzenleyicisinden yapılır.",
              )}
          </p>
          <a
            target="_blank"
            rel="noopener noreferrer"
            href={`https://${snapshot.shopDomain}/admin/themes/${themeNumber}/editor`}
          >
            <ExternalLink size={13} />
            {" " + t("Shopify’da düzenle")}
          </a>
        </div>
        <dl>
          <dt>{t("Bölüm türü")}</dt>
          <dd>{section.type}</dd>
          <dt>{t("Kaynak dosya")}</dt>
          <dd>{section.filename}</dd>
          <dt>{t("Görünürlük")}</dt>
          <dd>{section.enabled ? t("Açık") : t("Gizli")}</dd>
        </dl>
        <h3>{t("Okunan tema ayarları")}</h3>
        {Object.entries(section.settings).map(([id, value]) => (
          <div className="native-setting" key={id}>
            <label>{section.settingLabels[id] ?? id}</label>
            <span>
              {/token|secret|password|api_key/i.test(id)
                ? t("Gizli değer")
                : typeof value === "boolean"
                  ? value
                    ? t("Açık")
                    : t("Kapalı")
                  : typeof value === "object"
                    ? JSON.stringify(value).slice(0, 200)
                    : String(value || "—").slice(0, 200)}
            </span>
          </div>
        ))}
        {!Object.keys(section.settings).length && (
          <p className="setting-help">
            {t("Bu bölüm için ayar değeri bulunmuyor.")}
          </p>
        )}
      </div>
      <div className="inspector-footer">
        {t("Yerel düzenlemeler tema dosyasına yazılmaz")}
      </div>
    </aside>
  );
}
