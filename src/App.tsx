import { getUiLocale, getUiLanguage, subscribeUiLanguage, t } from "./i18n.ts";
import { BrandMark } from "./BrandMark";
import { UiSettingsButton } from "./UiSettings";
import { PageManager } from "./PageManager";
import { pageTemplate } from "./pageTemplates";
import { Viewer } from "./Viewer";
import { PreviewReview } from "./GrowthPanel";
import { StudioProvider, type Asset, type Brand } from "./studio";
import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleAlert,
  FileText,
  Loader2,
  LockKeyhole,
  LogOut,
  MoreHorizontal,
  Plus,
  Power,
  Search,
  ShieldCheck,
  Store as StoreIcon,
  X,
} from "lucide-react";
import { api, json, setCsrf } from "./api";
import { Editor } from "./Editor";
import { PageRenderer } from "./Renderer";
import {
  pageNames,
  starterDocument,
  type Device,
  type PageDocument,
  type PageSummary,
  type PageType,
  type Store,
} from "./model";
function Login({
  configured,
  onLogin,
  demo = false,
  setupError,
}: {
  configured: boolean;
  onLogin: (csrf: string) => void;
  demo?: boolean;
  setupError?: string;
}) {
  const [login, setLogin] = useState("owner"),
    [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{
        csrf: string;
      }>("/auth/login", {
        method: "POST",
        body: json({ login, password }),
      });
      setPassword("");
      onLogin(result.csrf);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setPassword("");
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-settings">
        <UiSettingsButton />
      </div>
      <div className="login-visual">
        <div className="login-brand">
          <BrandMark size={36} />
          fukpages<span>STUDIO</span>
        </div>
        <div className="login-statement">
          <div className="eyebrow">YOUR IDEAS. YOUR STORES.</div>
          <h1>
            {t("Güzel fikirler.")}
            <br />
            {t("Güçlü sayfalar.")}
          </h1>
          <p>
            {t("Her mağaza için bir tasarım alanı.")}
            <br />
            {t("Her ayrıntı üzerinde tam kontrol.")}
          </p>
          <div className="login-art">
            <div className="art-bar">
              <i />
              <i />
              <i />
              <span>aura / launch</span>
            </div>
            <div className="art-content">
              <small>DESIGNED TO FEEL DIFFERENT</small>
              <h2>
                MAKE
                <br />
                SOME
                <br />
                <em>NOISE.</em>
              </h2>
              <img
                src="/assets/headphones.svg"
                alt={t("Örnek kulaklık tasarımı")}
              />
              <span className="art-button">Find your rhythm ↗</span>
            </div>
            <span className="art-selection">
              Heading <MouseMark />
            </span>
          </div>
        </div>
        <footer>FukPages / Independent design studio</footer>
      </div>
      <main className="login-panel">
        <div className="login-card">
          <span className="login-lock">
            <LockKeyhole size={22} />
          </span>
          <span className="eyebrow">{t("SAHİP ERİŞİMİ")}</span>
          <h2>{t("Stüdyona hoş geldin.")}</h2>
          <p>{t("Mağazalarını ve tasarımlarını yönetmek için giriş yap.")}</p>
          {demo && (
            <p>
              <a href="/p/demo/home" target="_blank" rel="noreferrer">
                {t("Demo mağazayı aç ↗")}
              </a>
            </p>
          )}
          <form onSubmit={(event) => void submit(event)}>
            <label>
              {t("Kullanıcı adı")}
              <input
                autoComplete="username"
                aria-label={t("Kullanıcı adı")}
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                required
              />
            </label>
            <label>
              {t("Şifre")}
              <input
                autoComplete="current-password"
                aria-label={t("Şifre")}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            {!configured && (
              <div className="form-error">
                <CircleAlert size={16} />
                {setupError ||
                  t(
                    "Yönetici hesabı henüz yapılandırılmadı. Kurulum tamamlandıktan sonra giriş yapabilirsin.",
                  )}
              </div>
            )}
            {error && (
              <div className="form-error" role="alert">
                <CircleAlert size={16} />
                {error}
              </div>
            )}
            <button
              className="primary-button"
              type="submit"
              disabled={busy || !configured}
            >
              {busy ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <>
                  {t("Stüdyoya gir") + " "}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
          <small>
            <ShieldCheck size={13} />
            {" " + t("Yalnızca uygulama sahibine açık.")}
          </small>
        </div>
      </main>
    </div>
  );
}
function MouseMark() {
  return <span>↗</span>;
}
function StartupFailure({
  title,
  message,
  retry,
}: {
  title: string;
  message: string;
  retry: () => void;
}) {
  return (
    <div className="loading-screen">
      <main className="startup-error" role="alert">
        <CircleAlert size={28} />
        <h1>{title}</h1>
        <p>{message}</p>
        <button className="primary-button" onClick={retry}>
          {t("Tekrar dene")}
        </button>
      </main>
    </div>
  );
}
function Dashboard({
  role = "owner",
  demo = false,
  initialStoreId,
  openPage,
  logout,
  notify,
}: {
  role?: "owner" | "editor" | "viewer";
  demo?: boolean;
  initialStoreId?: string;
  openPage: (id: string, store: Store) => void;
  logout: () => void;
  notify: (message: string, error?: boolean) => void;
}) {
  const [stores, setStores] = useState<Store[]>([]),
    [selected, setSelected] = useState<Store | null>(null);
  const [pages, setPages] = useState<PageSummary[]>([]),
    [search, setSearch] = useState("");
  const [newStore, setNewStore] = useState(false),
    [name, setName] = useState(""),
    [client, setClient] = useState(""),
    [domain, setDomain] = useState("");
  const [type, setType] = useState<PageType>("landing"),
    [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Store | null>(null);
  const [audit, setAudit] = useState<
    {
      action: string;
      created: number;
    }[]
  >([]);
  const reload = useCallback(async () => {
    const result = await api<Store[]>("/stores");
    setStores(result);
    return result;
  }, []);
  useEffect(() => {
    void reload()
      .then((result) => {
        if (initialStoreId)
          setSelected(result.find((s) => s.id === initialStoreId) || null);
      })
      .catch((error) => notify(error.message, true));
  }, [reload, notify, initialStoreId]);
  useEffect(() => {
    if (!selected) return;
    let valid = true;
    Promise.all([
      api<PageSummary[]>(`/stores/${selected.id}/pages`),
      api<
        {
          action: string;
          created: number;
        }[]
      >(`/stores/${selected.id}/audit`),
    ])
      .then(([list, events]) => {
        if (valid) {
          setPages(list);
          setAudit(events);
        }
      })
      .catch((error) => notify(error.message, true));
    return () => {
      valid = false;
    };
  }, [selected, notify]);
  async function createPage(store: Store) {
    setBusy(true);
    try {
      if (role === "viewer") {
        const list = await api<PageSummary[]>(`/stores/${store.id}/pages`);
        if (!list.length) {
          notify(t("Bu mağazada izlenecek taslak yok."));
          return;
        }
        openPage(list[0].id, store);
        return;
      }
      const result = await api<{
        id: string;
      }>(`/stores/${store.id}/pages`, {
        method: "POST",
        body: json({ document: pageTemplate(type) }),
      });
      openPage(result.id, store);
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function createStore(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/stores", {
        method: "POST",
        body: json({ name, client, domain }),
      });
      setNewStore(false);
      setName("");
      setClient("");
      setDomain("");
      await reload();
      notify(
        t("Yerel çalışma alanı oluşturuldu. Shopify bağlantısı henüz yok."),
      );
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function changeStatus(store: Store) {
    setBusy(true);
    try {
      const status = store.status === "active" ? "suspended" : "active";
      await api(`/stores/${store.id}/status`, {
        method: "PATCH",
        body: json({ status }),
      });
      const result = await reload();
      if (selected?.id === store.id)
        setSelected(result.find((item) => item.id === store.id) ?? null);
      setConfirm(null);
      notify(
        status === "suspended"
          ? t("Çalışma alanı durduruldu ve yerel yayınlar kaldırıldı.")
          : t(
              "Çalışma alanı etkinleştirildi. Sayfalar yeniden yayınlanabilir.",
            ),
      );
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  const filtered = stores.filter((store) =>
    `${store.name} ${store.client}`
      .toLocaleLowerCase(getUiLanguage())
      .includes(search.toLocaleLowerCase(getUiLanguage())),
  );
  return (
    <div className="dashboard">
      <aside className="dashboard-nav">
        <div className="brand">
          <BrandMark />
          <b>
            fuk<span>pages</span>
          </b>
        </div>
        <span className="workspace-label">
          {role === "owner"
            ? "OWNER WORKSPACE"
            : role === "editor"
              ? t("DÜZENLEYİCİ")
              : t("İZLEYİCİ")}
        </span>
        <button className="active" onClick={() => setSelected(null)}>
          <StoreIcon size={18} />
          {" " + t("Mağazalarım")}
        </button>
        {demo && (
          <a
            className="demo-store-link"
            href="/p/demo/home"
            target="_blank"
            rel="noreferrer"
          >
            <StoreIcon size={18} />
            {" " + t("Demo mağazayı aç ↗")}
          </a>
        )}
        <div className="dashboard-nav-bottom">
          <UiSettingsButton />
          <div>
            <ShieldCheck size={16} />
            <span>
              {t("Tek sahip erişimi")}
              <small>{t("Yönetici")}</small>
            </span>
          </div>
          <button onClick={logout}>
            <LogOut size={17} />
            {" " + t("Çıkış yap")}
          </button>
        </div>
      </aside>
      <main className="dashboard-main">
        <header>
          <span>
            {t("Çalışma alanı") + " "}
            <ChevronRight size={12} />{" "}
            {selected ? selected.name : t("Mağazalar")}
          </span>
          <span className="owner-badge">
            <span>O</span> Owner
          </span>
        </header>
        <div className="dashboard-content">
          <div className="local-notice">
            <CircleAlert size={15} />
            <span>
              {demo
                ? t(
                    "Demo çalışma alanı · Shopify bağlantısı yok. Sepet ve formlar örnek verilerle çalışır; ödeme alınmaz. Medya yüklemelerini 4 MB altında tut.",
                  )
                : t(
                    "Shopify tema bölümleri eşleştirilebilir. Sayfa yayınları şu an yerel önizlemede çalışır.",
                  )}
            </span>
          </div>
          {!selected ? (
            <>
              <div className="dashboard-title">
                <div>
                  <span className="eyebrow">
                    {t("HER MAĞAZA. TEK BİR ALAN.")}
                  </span>
                  <h1>{t("Tasarımlarının kontrolü sende.")}</h1>
                  <p>
                    {t(
                      "Mağazalarını seç, sayfalarını oluştur ve her ayrıntıyı yönet.",
                    )}
                  </p>
                </div>
                <button
                  className="primary-button"
                  hidden={role !== "owner"}
                  onClick={() => setNewStore(true)}
                >
                  <Plus size={16} />
                  {" " + t("Çalışma alanı ekle")}
                </button>
              </div>
              <div className="dashboard-stats">
                <div>
                  <span>{t("Çalışma alanları")}</span>
                  <b>
                    {stores.length}
                    <StoreIcon size={19} />
                  </b>
                </div>
                <div>
                  <span>{t("Aktif alanlar")}</span>
                  <b>
                    {stores.filter((store) => store.status === "active").length}
                    <Power size={19} />
                  </b>
                </div>
                <div>
                  <span>{t("Kaydedilen sayfalar")}</span>
                  <b>
                    {stores.reduce((sum, store) => sum + store.pageCount, 0)}
                    <FileText size={19} />
                  </b>
                </div>
              </div>
              <div className="stores-heading">
                <h2>
                  {t("Mağazaların") + " "}
                  <span>{stores.length}</span>
                </h2>
                <label className="dashboard-search">
                  <Search size={15} />
                  <input
                    aria-label={t("Mağaza ara")}
                    placeholder={t("Mağaza veya müşteri ara")}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
              </div>
              <div className="store-grid">
                {filtered.map((store) => (
                  <article className="store-card" key={store.id}>
                    <div className="store-card-top">
                      <span className="store-avatar">{store.name[0]}</span>
                      <span className={`status-pill ${store.status}`}>
                        ●{" "}
                        {store.status === "active"
                          ? t("Aktif")
                          : t("Devre dışı")}
                      </span>
                      <button
                        title={t("Mağaza ayrıntıları")}
                        className="icon-button"
                        onClick={() => setSelected(store)}
                      >
                        <MoreHorizontal size={19} />
                      </button>
                    </div>
                    <h3>{store.name}</h3>
                    <p>{store.client || t("Müşteri belirtilmedi")}</p>
                    <span className="connection-label">
                      {store.connection === "synced"
                        ? t("Shopify tema bölümleri alındı")
                        : store.connection === "configured"
                          ? t("Tema erişimi yapılandırıldı")
                          : store.domain
                            ? t("Shopify adresi kayıtlı · tema erişimi gerekli")
                            : t("Yerel çalışma alanı · Shopify bağlı değil")}
                    </span>
                    <div className="store-card-meta">
                      <span>
                        <FileText size={14} />
                        {store.pageCount}
                        {" " + t("sayfa")}
                      </span>
                      <button
                        className="store-toggle"
                        onClick={() =>
                          store.status === "active"
                            ? setConfirm(store)
                            : void changeStatus(store)
                        }
                      >
                        <Power size={12} />
                        {store.status === "active"
                          ? t("Devre dışı bırak")
                          : t("Etkinleştir")}
                      </button>
                    </div>
                    <div className="store-card-bottom">
                      <button onClick={() => setSelected(store)}>
                        {t("Sayfaları yönet") + " "}
                        <ArrowRight size={14} />
                      </button>
                      {store.status === "active" && (
                        <button
                          className="primary-small"
                          disabled={busy}
                          onClick={() => void createPage(store)}
                        >
                          {role === "viewer"
                            ? t("Tasarımı görüntüle")
                            : t("Editörü aç")}{" "}
                          <Plus size={13} />
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              {!filtered.length && (
                <div className="dashboard-empty">
                  {t("Eşleşen çalışma alanı yok.")}
                </div>
              )}
            </>
          ) : (
            <>
              <button className="text-button" onClick={() => setSelected(null)}>
                <ChevronRight className="rotate" size={13} />
                {" " + t("Mağazalara dön")}
              </button>
              <div className="dashboard-title">
                <div>
                  <span className="eyebrow">
                    {selected.client || t("ÇALIŞMA ALANI")}
                  </span>
                  <h1>{selected.name}</h1>
                  <p>{t("Sayfalar, tasarımlar ve işlem geçmişi.")}</p>
                </div>
                <div className="new-page-controls">
                  {role === "owner" && selected.status === "active" && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => setConfirm(selected)}
                    >
                      {t("Devre dışı bırak")}
                    </button>
                  )}
                  <select
                    aria-label={t("Yeni sayfa türü")}
                    value={type}
                    onChange={(event) =>
                      setType(event.target.value as PageType)
                    }
                  >
                    {Object.entries(pageNames).map(([id, name]) => (
                      <option value={id} key={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="primary-button"
                    disabled={busy || selected.status !== "active"}
                    onClick={() => void createPage(selected)}
                  >
                    <Plus size={16} />
                    {" " + t("Yeni sayfa")}
                  </button>
                </div>
              </div>
              {selected.status !== "active" && (
                <div className="form-error">
                  {t("Bu çalışma alanı devre dışı; yerel yayınlar kaldırıldı.")}{" "}
                  <button onClick={() => void changeStatus(selected)}>
                    {t("Etkinleştir")}
                  </button>
                </div>
              )}
              <PageManager
                store={selected}
                role={role}
                open={(id) => openPage(id, selected)}
                notify={notify}
              />
              <h2 className="audit-heading">{t("İşlem geçmişi")}</h2>
              <div className="audit-list">
                {audit.map((event, index) => (
                  <div key={index}>
                    <span>●</span>
                    <p>{event.action}</p>
                    <small>
                      {new Date(event.created).toLocaleString(getUiLocale(), {
                        timeZone: "Europe/Istanbul",
                      })}
                    </small>
                  </div>
                ))}
                {!audit.length && <p>{t("Henüz işlem yok.")}</p>}
              </div>
            </>
          )}
        </div>
      </main>
      {newStore && (
        <div className="modal-backdrop">
          <div className="dialog">
            <button
              className="dialog-close"
              aria-label={t("Pencereyi kapat")}
              onClick={() => setNewStore(false)}
            >
              <X size={19} />
            </button>
            <span className="login-lock">
              <StoreIcon size={22} />
            </span>
            <h2>{t("Yeni çalışma alanı")}</h2>
            <p>
              {t(
                "Mağazana veya müşterine ait tasarımları ayrı bir alanda sakla. Shopify adresini şimdi veya editörün Tema panelinde ekleyebilirsin.",
              )}
            </p>
            <form onSubmit={(event) => void createStore(event)}>
              <label>
                {t("Mağaza adı")}
                <input
                  autoFocus
                  required
                  aria-label={t("Mağaza adı")}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label>
                {t("Müşteri adı")}
                <input
                  aria-label={t("Müşteri adı")}
                  value={client}
                  onChange={(event) => setClient(event.target.value)}
                  placeholder={t("Kendi mağazam / müşteri adı")}
                />
              </label>
              <label>
                {t("Shopify adresi (isteğe bağlı)")}
                <input
                  aria-label={t("Yeni mağazanın Shopify adresi")}
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                  placeholder="magazam.myshopify.com"
                />
              </label>
              <button className="primary-button" disabled={busy}>
                {t("Çalışma alanını oluştur") + " "}
                <Plus size={15} />
              </button>
            </form>
          </div>
        </div>
      )}
      {confirm && (
        <div className="modal-backdrop">
          <div className="dialog">
            <button
              className="dialog-close"
              aria-label={t("Pencereyi kapat")}
              onClick={() => setConfirm(null)}
            >
              <X size={19} />
            </button>
            <span className="danger-icon">
              <Power size={24} />
            </span>
            <h2>
              {confirm.name}
              {" " + t("devre dışı bırakılsın mı?")}
            </h2>
            <p>
              {t(
                "Bu çalışma alanının yerel yayınları kaldırılacak ve düzenleme duracak. Taslaklar saklanacak. Shopify tema dosyaları bu yerel işlemle değiştirilmez.",
              )}
            </p>
            <div className="dialog-actions">
              <button
                className="secondary-button"
                onClick={() => setConfirm(null)}
              >
                {t("Vazgeç")}
              </button>
              <button
                className="danger-button"
                disabled={busy}
                onClick={() => void changeStatus(confirm)}
              >
                {t("Devre dışı bırak")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export function App() {
  const uiLanguage = useSyncExternalStore(subscribeUiLanguage, getUiLanguage);
  useEffect(() => {
    document.documentElement.lang = uiLanguage;
  }, [uiLanguage]);
  const [startupError, setStartupError] = useState("");
  const [startupAttempt, setStartupAttempt] = useState(0);
  const retryStartup = () => {
    setStartupError("");
    setPublicError("");
    setStartupAttempt((n) => n + 1);
  };
  const [status, setStatus] = useState<{
    authenticated: boolean;
    configured: boolean;
    role?: "owner" | "editor" | "viewer";
    demo?: boolean;
    setupError?: string;
  } | null>(null);
  const [editing, setEditing] = useState<{
    id: string;
    store: Store;
    nonce?: number;
  } | null>(null);
  const [pageStoreId, setPageStoreId] = useState<string | undefined>();
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const [publicPage, setPublicPage] = useState<PageDocument | null>(null),
    [publicError, setPublicError] = useState("");
  const [device, setDevice] = useState<Device>("desktop");
  const slugPath = /^\/p\/([\w-]+)\/([a-z0-9-]+)\/?$/.exec(
    window.location.pathname,
  );
  const resourcePath =
    /^\/p\/([\w-]+)\/(products|collections)\/([^/]+)\/?$/.exec(
      window.location.pathname,
    );
  const publicPath = resourcePath
    ? `/public/stores/${resourcePath[1]}/${resourcePath[2]}/${resourcePath[3]}`
    : slugPath
      ? `/public/stores/${slugPath[1]}/${slugPath[2] === "home" ? "home" : "pages/" + slugPath[2]}`
      : null;
  const experimentId = new URLSearchParams(window.location.search).get(
      "experiment",
    ),
    funnelId = new URLSearchParams(window.location.search).get("funnel"),
    funnelStage =
      new URLSearchParams(window.location.search).get("stage") || "0";
  const previewToken = new URLSearchParams(window.location.search).get(
    "preview",
  );
  const [publicMeta, setPublicMeta] = useState<{
    brand: Brand;
    assets: Asset[];
    storeId: string;
    pageId: string;
    catalog: import("./Commerce").Catalog;
    previewToken?: string;
  } | null>(null);
  const publishedId = new URLSearchParams(window.location.search).get(
    "published",
  );
  const notify = useCallback(
    (message: string, error = false) => setToast({ message, error }),
    [],
  );
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.error ? 6500 : 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(
      () =>
        controller.abort(
          new DOMException(t("Sunucu zaman aşımı"), "TimeoutError"),
        ),
      30000,
    );
    const cleanup = () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
    if (publishedId || previewToken || experimentId || funnelId || publicPath) {
      api<{
        document: PageDocument;
        brand: Brand;
        assets: Asset[];
        storeId: string;
        pageId: string;
        catalog: import("./Commerce").Catalog;
        previewToken?: string;
      }>(
        publicPath
          ? publicPath
          : experimentId
            ? `/public/experiments/${encodeURIComponent(experimentId)}`
            : funnelId
              ? `/public/funnels/${encodeURIComponent(funnelId)}/${encodeURIComponent(funnelStage)}`
              : previewToken
                ? `/public/previews/${encodeURIComponent(previewToken)}`
                : `/public/pages/${encodeURIComponent(publishedId!)}`,
        { signal: controller.signal },
      )
        .then((result) => {
          if (!active) return;
          setPublicPage(result.document);
          setPublicMeta(result);
          document.title = result.document.seo?.title || result.document.name;
          const seo = result.document.seo;
          for (const [name, content] of Object.entries({
            description: seo?.description || "",
            robots:
              seo?.noindex || previewToken
                ? "noindex,nofollow"
                : "index,follow",
          })) {
            let m = document.querySelector<HTMLMetaElement>(
              `meta[name="${name}"]`,
            );
            if (!m) {
              m = document.createElement("meta");
              m.name = name;
              document.head.append(m);
            }
            m.content = content;
          }
        })
        .catch((error) => {
          if (active) setPublicError(error.message);
        })
        .finally(() => clearTimeout(timeout));
      const change = () =>
        setDevice(
          window.innerWidth <= 600
            ? "mobile"
            : window.innerWidth <= 900
              ? "tablet"
              : "desktop",
        );
      change();
      window.addEventListener("resize", change);
      return () => {
        cleanup();
        window.removeEventListener("resize", change);
      };
    }
    api<{
      authenticated: boolean;
      configured: boolean;
      csrf?: string;
    }>("/auth/status", { signal: controller.signal })
      .then((result) => {
        if (!active) return;
        if (
          !result ||
          typeof result.authenticated !== "boolean" ||
          typeof result.configured !== "boolean"
        )
          throw new Error(
            t("Sunucudan geçerli giriş bilgisi alınamadı. Tekrar dene."),
          );
        setCsrf(result.csrf ?? "");
        setStatus(result);
      })
      .catch((error) => {
        if (active) setStartupError(error.message);
      })
      .finally(() => clearTimeout(timeout));
    return cleanup;
  }, [
    notify,
    publishedId,
    previewToken,
    experimentId,
    funnelId,
    funnelStage,
    publicPath,
    startupAttempt,
  ]);
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST", body: "{}" });
      setEditing(null);
      setCsrf("");
      setStatus({ authenticated: false, configured: true, demo: status?.demo });
    } catch (error) {
      notify((error as Error).message, true);
    }
  }
  if (publishedId || previewToken || experimentId || funnelId || publicPath)
    return publicPage && publicMeta ? (
      <StudioProvider page={publicPage} value={publicMeta}>
        <PageRenderer document={publicPage} device={device} />
        {previewToken && <PreviewReview token={previewToken} />}
      </StudioProvider>
    ) : publicError ? (
      <StartupFailure
        title={t("Sayfa açılamadı")}
        message={publicError}
        retry={retryStartup}
      />
    ) : (
      <div className="loading-screen">{t("Sayfa yükleniyor…")}</div>
    );
  return (
    <>
      {startupError ? (
        <StartupFailure
          title={t("Stüdyo açılamadı")}
          message={startupError}
          retry={retryStartup}
        />
      ) : !status ? (
        <div className="loading-screen">
          <Loader2 className="spin" />
          {" " + t("Stüdyo hazırlanıyor…")}
        </div>
      ) : !status.authenticated ? (
        <Login
          configured={status.configured}
          demo={status.demo}
          setupError={status.setupError}
          onLogin={(csrf) => {
            setCsrf(csrf);
            api<{
              authenticated: boolean;
              configured: boolean;
              role?: "owner" | "editor" | "viewer";
            }>("/auth/status")
              .then(setStatus)
              .catch((e) => notify(e.message, true));
          }}
        />
      ) : editing && status.role === "viewer" ? (
        <Viewer
          pageId={editing.id}
          store={editing.store}
          back={() => setEditing(null)}
        />
      ) : editing ? (
        <Editor
          key={editing.id + ":" + (editing.nonce || 0)}
          pageId={editing.id}
          store={editing.store}
          role={status.role === "editor" ? "editor" : "owner"}
          openPage={(id) =>
            setEditing({ id, store: editing.store, nonce: Date.now() })
          }
          back={() => setEditing(null)}
          notify={notify}
        />
      ) : (
        <Dashboard
          role={status.role || "owner"}
          demo={status.demo}
          initialStoreId={pageStoreId}
          openPage={(id, store) => {
            setPageStoreId(store.id);
            setEditing({ id, store, nonce: Date.now() });
          }}
          logout={() => void logout()}
          notify={notify}
        />
      )}
      {toast && (
        <div role="status" className={`toast ${toast.error ? "error" : ""}`}>
          {toast.error ? <CircleAlert size={17} /> : <Check size={17} />}
          <span>{t(toast.message)}</span>
          <button
            aria-label={t("Bildirimi kapat")}
            onClick={() => setToast(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}
