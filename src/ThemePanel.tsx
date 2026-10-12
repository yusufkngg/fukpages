import { useEffect, useState } from "react";
import {
  ExternalLink,
  Layers,
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
          {status.snapshot ? "Tema verisi alındı" : "Tema bağlantısı"}
        </span>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void saveDomain(domain);
          }}
        >
          <label>
            Shopify mağaza adresi
            <input
              aria-label="Shopify mağaza adresi"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              placeholder="magazam.myshopify.com"
            />
          </label>
          <button disabled={busy || !domain.trim()}>Adresi kaydet</button>
        </form>
        {!status.configured && (
          <p>
            Mağaza için tema okuma erişimi gerekli. Kurulum tamamlandığında
            mevcut header/footer ve bölüm sırası burada görünür.
          </p>
        )}
        <button
          className="theme-sync-button"
          disabled={!status.configured || busy}
          onClick={sync}
        >
          <RefreshCw size={13} className={busy ? "spin" : ""} />
          {busy ? "Tema okunuyor…" : "Temayı senkronize et"}
        </button>
      </div>
      {status.snapshot && (
        <>
          <div className="theme-snapshot-meta">
            <strong>{status.snapshot.themeName}</strong>
            <small>{status.snapshot.templateFilename}</small>
            <span>
              Son okuma:{" "}
              {new Date(status.snapshot.syncedAt).toLocaleString("tr-TR", {
                timeZone: "Europe/Istanbul",
              })}
            </span>
          </div>
          <label className="toggle-row theme-shell-toggle">
            <span>Tema düzenini kullan</span>
            <input
              type="checkbox"
              aria-label="Tema düzenini kullan"
              checked={useShell}
              onChange={(event) => bind(status.snapshot!, event.target.checked)}
            />
          </label>
          <p className="theme-shell-help">
            Header/footer temadan gelir. Özel bölümler içerik alanında kalır.
            Tema bölümlerinin görsel önizlemesi henüz yok; konumları gösterilir.
          </p>
          {(["header", "main", "footer"] as const).map((region) => (
            <div className="native-section-group" key={region}>
              <h3>
                {region === "header"
                  ? "HEADER GRUBU"
                  : region === "footer"
                    ? "FOOTER GRUBU"
                    : "ŞABLON BÖLÜMLERİ"}
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
          <Unplug size={12} /> Tema eşleşmesini kaldır
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
        <Layers size={17} />
        <span>
          <b>{section.name}</b>
          <small>Shopify tema bölümü · {section.type}</small>
        </span>
        <span className="native-shopify-tag">SHOPIFY</span>
      </div>
      <p>
        Tema bölümünün konumu gösteriliyor. Gerçek görünüm Shopify temasında
        korunur.
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
      <div className="device-notice">Shopify teması · kaynak bölüm</div>
      <div className="inspector-scroll native-inspector">
        <div className="native-info-card">
          <span className="native-shopify-tag">SHOPIFY</span>
          <h3>Temanızdaki bölüm.</h3>
          <p>
            Bu bölüm {snapshot.themeName} temasından okundu. Düzenleme Shopify
            tema düzenleyicisinden yapılır.
          </p>
          <a
            target="_blank"
            rel="noopener noreferrer"
            href={`https://${snapshot.shopDomain}/admin/themes/${themeNumber}/editor`}
          >
            <ExternalLink size={13} /> Shopify’da düzenle
          </a>
        </div>
        <dl>
          <dt>Bölüm türü</dt>
          <dd>{section.type}</dd>
          <dt>Kaynak dosya</dt>
          <dd>{section.filename}</dd>
          <dt>Görünürlük</dt>
          <dd>{section.enabled ? "Açık" : "Gizli"}</dd>
        </dl>
        <h3>Okunan tema ayarları</h3>
        {Object.entries(section.settings).map(([id, value]) => (
          <div className="native-setting" key={id}>
            <label>{section.settingLabels[id] ?? id}</label>
            <span>
              {/token|secret|password|api_key/i.test(id)
                ? "Gizli değer"
                : typeof value === "boolean"
                  ? value
                    ? "Açık"
                    : "Kapalı"
                  : typeof value === "object"
                    ? JSON.stringify(value).slice(0, 200)
                    : String(value || "—").slice(0, 200)}
            </span>
          </div>
        ))}
        {!Object.keys(section.settings).length && (
          <p className="setting-help">Bu bölüm için ayar değeri bulunmuyor.</p>
        )}
      </div>
      <div className="inspector-footer">
        Yerel düzenlemeler tema dosyasına yazılmaz
      </div>
    </aside>
  );
}
