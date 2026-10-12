import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleAlert,
  FileText,
  Layers,
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
}: {
  configured: boolean;
  onLogin: (csrf: string) => void;
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
      const result = await api<{ csrf: string }>("/auth/login", {
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
      <div className="login-visual">
        <div className="login-brand">
          <span className="brand-mark">
            <Layers size={21} />
          </span>
          fukpages<span>STUDIO</span>
        </div>
        <div className="login-statement">
          <div className="eyebrow">YOUR IDEAS. YOUR STORES.</div>
          <h1>
            Güzel fikirler.
            <br />
            Güçlü sayfalar.
          </h1>
          <p>
            Her mağaza için bir tasarım alanı.
            <br />
            Her ayrıntı üzerinde tam kontrol.
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
              <img src="/assets/headphones.svg" alt="Örnek kulaklık tasarımı" />
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
          <span className="eyebrow">SAHİP ERİŞİMİ</span>
          <h2>Stüdyona hoş geldin.</h2>
          <p>Mağazalarını ve tasarımlarını yönetmek için giriş yap.</p>
          <form onSubmit={(event) => void submit(event)}>
            <label>
              Kullanıcı adı
              <input
                autoComplete="username"
                aria-label="Kullanıcı adı"
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                required
              />
            </label>
            <label>
              Şifre
              <input
                autoComplete="current-password"
                aria-label="Şifre"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            {!configured && (
              <div className="form-error">
                <CircleAlert size={16} />
                Yönetici hesabı henüz yapılandırılmadı. Kurulum tamamlandıktan
                sonra giriş yapabilirsin.
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
                  Stüdyoya gir <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
          <small>
            <ShieldCheck size={13} /> Yalnızca uygulama sahibine açık.
          </small>
        </div>
      </main>
    </div>
  );
}
function MouseMark() {
  return <span>↗</span>;
}
function Dashboard({
  openPage,
  logout,
  notify,
}: {
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
    [client, setClient] = useState("");
  const [type, setType] = useState<PageType>("landing"),
    [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Store | null>(null);
  const [audit, setAudit] = useState<{ action: string; created: number }[]>([]);
  const reload = useCallback(async () => {
    const result = await api<Store[]>("/stores");
    setStores(result);
    return result;
  }, []);
  useEffect(() => {
    void reload().catch((error) => notify(error.message, true));
  }, [reload, notify]);
  useEffect(() => {
    if (!selected) return;
    let valid = true;
    Promise.all([
      api<PageSummary[]>(`/stores/${selected.id}/pages`),
      api<{ action: string; created: number }[]>(
        `/stores/${selected.id}/audit`,
      ),
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
      const result = await api<{ id: string }>(`/stores/${store.id}/pages`, {
        method: "POST",
        body: json({ document: starterDocument(type) }),
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
      await api("/stores", { method: "POST", body: json({ name, client }) });
      setNewStore(false);
      setName("");
      setClient("");
      await reload();
      notify("Yerel çalışma alanı oluşturuldu. Shopify bağlantısı henüz yok.");
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
          ? "Çalışma alanı durduruldu ve yerel yayınlar kaldırıldı."
          : "Çalışma alanı etkinleştirildi. Sayfalar yeniden yayınlanabilir.",
      );
    } catch (error) {
      notify((error as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  const filtered = stores.filter((store) =>
    `${store.name} ${store.client}`
      .toLocaleLowerCase("tr")
      .includes(search.toLocaleLowerCase("tr")),
  );
  return (
    <div className="dashboard">
      <aside className="dashboard-nav">
        <div className="brand">
          <span className="brand-mark">
            <Layers size={19} />
          </span>
          <b>
            fuk<span>pages</span>
          </b>
        </div>
        <span className="workspace-label">OWNER WORKSPACE</span>
        <button className="active" onClick={() => setSelected(null)}>
          <StoreIcon size={18} /> Mağazalarım
        </button>
        <div className="dashboard-nav-bottom">
          <div>
            <ShieldCheck size={16} />
            <span>
              Tek sahip erişimi<small>Yönetici</small>
            </span>
          </div>
          <button onClick={logout}>
            <LogOut size={17} /> Çıkış yap
          </button>
        </div>
      </aside>
      <main className="dashboard-main">
        <header>
          <span>
            Çalışma alanı <ChevronRight size={12} />{" "}
            {selected ? selected.name : "Mağazalar"}
          </span>
          <span className="owner-badge">
            <span>O</span> Owner
          </span>
        </header>
        <div className="dashboard-content">
          <div className="local-notice">
            <CircleAlert size={15} />
            <span>
              Yerel geliştirme sürümü. Shopify mağazaları henüz bağlı değil;
              yayınlar bu ortamda çalışır.
            </span>
          </div>
          {!selected ? (
            <>
              <div className="dashboard-title">
                <div>
                  <span className="eyebrow">HER MAĞAZA. TEK BİR ALAN.</span>
                  <h1>Tasarımlarının kontrolü sende.</h1>
                  <p>
                    Mağazalarını seç, sayfalarını oluştur ve her ayrıntıyı
                    yönet.
                  </p>
                </div>
                <button
                  className="primary-button"
                  onClick={() => setNewStore(true)}
                >
                  <Plus size={16} /> Çalışma alanı ekle
                </button>
              </div>
              <div className="dashboard-stats">
                <div>
                  <span>Çalışma alanları</span>
                  <b>
                    {stores.length}
                    <StoreIcon size={19} />
                  </b>
                </div>
                <div>
                  <span>Aktif alanlar</span>
                  <b>
                    {stores.filter((store) => store.status === "active").length}
                    <Power size={19} />
                  </b>
                </div>
                <div>
                  <span>Kaydedilen sayfalar</span>
                  <b>
                    {stores.reduce((sum, store) => sum + store.pageCount, 0)}
                    <FileText size={19} />
                  </b>
                </div>
              </div>
              <div className="stores-heading">
                <h2>
                  Mağazaların <span>{stores.length}</span>
                </h2>
                <label className="dashboard-search">
                  <Search size={15} />
                  <input
                    aria-label="Mağaza ara"
                    placeholder="Mağaza veya müşteri ara"
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
                        ● {store.status === "active" ? "Aktif" : "Devre dışı"}
                      </span>
                      <button
                        title="Mağaza ayrıntıları"
                        className="icon-button"
                        onClick={() => setSelected(store)}
                      >
                        <MoreHorizontal size={19} />
                      </button>
                    </div>
                    <h3>{store.name}</h3>
                    <p>{store.client || "Müşteri belirtilmedi"}</p>
                    <span className="connection-label">
                      Yerel çalışma alanı · Shopify bağlı değil
                    </span>
                    <div className="store-card-meta">
                      <span>
                        <FileText size={14} />
                        {store.pageCount} sayfa
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
                          ? "Devre dışı bırak"
                          : "Etkinleştir"}
                      </button>
                    </div>
                    <div className="store-card-bottom">
                      <button onClick={() => setSelected(store)}>
                        Sayfaları yönet <ArrowRight size={14} />
                      </button>
                      {store.status === "active" && (
                        <button
                          className="primary-small"
                          disabled={busy}
                          onClick={() => void createPage(store)}
                        >
                          Editörü aç <Plus size={13} />
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              {!filtered.length && (
                <div className="dashboard-empty">
                  Eşleşen çalışma alanı yok.
                </div>
              )}
            </>
          ) : (
            <>
              <button className="text-button" onClick={() => setSelected(null)}>
                <ChevronRight className="rotate" size={13} /> Mağazalara dön
              </button>
              <div className="dashboard-title">
                <div>
                  <span className="eyebrow">
                    {selected.client || "ÇALIŞMA ALANI"}
                  </span>
                  <h1>{selected.name}</h1>
                  <p>Sayfalar, tasarımlar ve işlem geçmişi.</p>
                </div>
                <div className="new-page-controls">
                  <select
                    aria-label="Yeni sayfa türü"
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
                    <Plus size={16} /> Yeni sayfa
                  </button>
                </div>
              </div>
              {selected.status !== "active" && (
                <div className="form-error">
                  Bu çalışma alanı devre dışı; yerel yayınlar kaldırıldı.{" "}
                  <button onClick={() => void changeStatus(selected)}>
                    Etkinleştir
                  </button>
                </div>
              )}
              <div className="page-table">
                <div className="page-table-header">
                  <span>Sayfa adı</span>
                  <span>Tür</span>
                  <span>Son güncelleme</span>
                  <span />
                </div>
                {pages.map((page) => (
                  <div className="page-table-row" key={page.id}>
                    <span>
                      <FileText size={17} />
                      {page.name}
                    </span>
                    <span>{pageNames[page.type]}</span>
                    <span>
                      {new Date(page.updated).toLocaleDateString("tr-TR", {
                        timeZone: "Europe/Istanbul",
                      })}
                    </span>
                    <button
                      disabled={selected.status !== "active"}
                      onClick={() => openPage(page.id, selected)}
                    >
                      Düzenle <ArrowRight size={14} />
                    </button>
                  </div>
                ))}
                {!pages.length && (
                  <div className="dashboard-empty">
                    <FileText size={25} />
                    <p>
                      Henüz sayfa yok. Bir tür seçip ilk tasarımını oluştur.
                    </p>
                  </div>
                )}
              </div>
              <h2 className="audit-heading">İşlem geçmişi</h2>
              <div className="audit-list">
                {audit.map((event, index) => (
                  <div key={index}>
                    <span>●</span>
                    <p>{event.action}</p>
                    <small>
                      {new Date(event.created).toLocaleString("tr-TR", {
                        timeZone: "Europe/Istanbul",
                      })}
                    </small>
                  </div>
                ))}
                {!audit.length && <p>Henüz işlem yok.</p>}
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
              aria-label="Pencereyi kapat"
              onClick={() => setNewStore(false)}
            >
              <X size={19} />
            </button>
            <span className="login-lock">
              <StoreIcon size={22} />
            </span>
            <h2>Yeni çalışma alanı</h2>
            <p>
              Mağazana veya müşterine ait tasarımları ayrı bir alanda sakla.
              Shopify bağlantısı sonraki kurulum adımıdır.
            </p>
            <form onSubmit={(event) => void createStore(event)}>
              <label>
                Mağaza adı
                <input
                  autoFocus
                  required
                  aria-label="Mağaza adı"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label>
                Müşteri adı
                <input
                  aria-label="Müşteri adı"
                  value={client}
                  onChange={(event) => setClient(event.target.value)}
                  placeholder="Kendi mağazam / müşteri adı"
                />
              </label>
              <button className="primary-button" disabled={busy}>
                Çalışma alanını oluştur <Plus size={15} />
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
              aria-label="Pencereyi kapat"
              onClick={() => setConfirm(null)}
            >
              <X size={19} />
            </button>
            <span className="danger-icon">
              <Power size={24} />
            </span>
            <h2>{confirm.name} devre dışı bırakılsın mı?</h2>
            <p>
              Bu çalışma alanının yerel yayınları kaldırılacak ve düzenleme
              duracak. Taslaklar saklanacak. Şu anda bağlı bir Shopify mağazası
              bulunmuyor.
            </p>
            <div className="dialog-actions">
              <button
                className="secondary-button"
                onClick={() => setConfirm(null)}
              >
                Vazgeç
              </button>
              <button
                className="danger-button"
                disabled={busy}
                onClick={() => void changeStatus(confirm)}
              >
                Devre dışı bırak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export function App() {
  const [status, setStatus] = useState<{
    authenticated: boolean;
    configured: boolean;
  } | null>(null);
  const [editing, setEditing] = useState<{ id: string; store: Store } | null>(
    null,
  );
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const [publicPage, setPublicPage] = useState<PageDocument | null>(null),
    [publicError, setPublicError] = useState("");
  const [device, setDevice] = useState<Device>("desktop");
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
    if (publishedId) {
      api<{ document: PageDocument }>(
        `/public/pages/${encodeURIComponent(publishedId)}`,
      )
        .then((result) => setPublicPage(result.document))
        .catch((error) => setPublicError(error.message));
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
      return () => window.removeEventListener("resize", change);
    }
    api<{ authenticated: boolean; configured: boolean; csrf?: string }>(
      "/auth/status",
    )
      .then((result) => {
        setCsrf(result.csrf ?? "");
        setStatus(result);
      })
      .catch((error) => notify(error.message, true));
  }, [notify, publishedId]);
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST", body: "{}" });
      setEditing(null);
      setCsrf("");
      setStatus({ authenticated: false, configured: true });
    } catch (error) {
      notify((error as Error).message, true);
    }
  }
  if (publishedId)
    return publicPage ? (
      <PageRenderer document={publicPage} device={device} />
    ) : (
      <div className="loading-screen">{publicError || "Sayfa yükleniyor…"}</div>
    );
  return (
    <>
      {!status ? (
        <div className="loading-screen">
          <Loader2 className="spin" /> Stüdyo hazırlanıyor…
        </div>
      ) : !status.authenticated ? (
        <Login
          configured={status.configured}
          onLogin={(csrf) => {
            setCsrf(csrf);
            setStatus({ authenticated: true, configured: true });
          }}
        />
      ) : editing ? (
        <Editor
          key={editing.id}
          pageId={editing.id}
          store={editing.store}
          back={() => setEditing(null)}
          notify={notify}
        />
      ) : (
        <Dashboard
          openPage={(id, store) => setEditing({ id, store })}
          logout={() => void logout()}
          notify={notify}
        />
      )}
      {toast && (
        <div role="status" className={`toast ${toast.error ? "error" : ""}`}>
          {toast.error ? <CircleAlert size={17} /> : <Check size={17} />}
          <span>{toast.message}</span>
          <button aria-label="Bildirimi kapat" onClick={() => setToast(null)}>
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}
