import { TransferPanel } from "./TransferPanel";
import { useState, useEffect } from "react";
import { api, json } from "./api";
import {
  mapBlock,
  type PageDocument,
  type Block,
  type PageSummary,
} from "./model";
import type { Asset } from "./studio";
export function GrowthPanel({
  pageId,
  storeId,
  page,
  assets,
  commit,
  save,
  notify,
}: {
  pageId: string;
  storeId: string;
  page: PageDocument;
  assets: Asset[];
  commit: (f: (p: PageDocument) => PageDocument) => void;
  save: () => Promise<boolean>;
  notify: (m: string, e?: boolean) => void;
}) {
  const [pages, setPages] = useState<PageSummary[]>([]),
    [target, setTarget] = useState(""),
    [prompt, setPrompt] = useState(""),
    [image, setImage] = useState(""),
    [busy, setBusy] = useState(false),
    [links, setLinks] = useState<string[]>([]),
    [locale, setLocale] = useState("en"),
    [source, setSource] = useState(""),
    [translation, setTranslation] = useState(""),
    [reviews, setReviews] = useState<
      { reviewer: string; decision: string; note: string }[]
    >([]),
    [integrations, setIntegrations] = useState<{
      ai: { configured: boolean; model: string };
      forms: { configured: boolean; destination: string };
    } | null>(null);
  useEffect(() => {
    api<PageSummary[]>(`/stores/${storeId}/pages`)
      .then(setPages)
      .catch((e) => notify(e.message, true));
    api<typeof reviews>(`/pages/${pageId}/reviews`)
      .then(setReviews)
      .catch((e) => notify(e.message, true));
    api<NonNullable<typeof integrations>>(`/stores/${storeId}/integrations`)
      .then(setIntegrations)
      .catch((e) => notify(e.message, true));
  }, [storeId, pageId]);
  const nodes: Block[] = [];
  const walk = (items: Block[]) =>
    items.forEach((n) => {
      if (
        [
          "heading",
          "text",
          "button",
          "image",
          "input",
          "textarea",
          "accordion",
          "tabs",
          "carousel",
          "logos",
          "comparison",
          "sizeTable",
          "shipping",
          "popup",
          "videoPopup",
          "breadcrumb",
          "mobileMenu",
          "blogList",
          "form",
          "select",
          "checkbox",
          "radio",
        ].includes(n.kind)
      )
        nodes.push(n);
      walk(n.children);
    });
  walk(page.nodes);
  return (
    <div className="library-scroll feature-panel">
      <h3>Dil ve çeviriler</h3>
      <label>
        Dil kodu
        <input
          aria-label="Çeviri dili"
          value={locale}
          onChange={(e) => setLocale(e.target.value)}
        />
      </label>
      <button
        onClick={() => {
          if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(locale)) {
            notify("Dil kodu en, tr veya en-US biçiminde olmalı.", true);
            return;
          }
          commit((p) => ({
            ...p,
            locales: [
              ...new Set([
                p.defaultLocale || "tr",
                ...(p.locales || []),
                locale,
              ]),
            ],
            defaultLocale: p.defaultLocale || "tr",
          }));
        }}
      >
        Dili ekle
      </button>
      <label>
        Çevrilecek öğe
        <select
          aria-label="Çevrilecek öğe"
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            const n = nodes.find((n) => n.id === e.target.value);
            let old = {};
            try {
              old =
                JSON.parse(String(n?.props.translations || "{}"))[locale] || {};
            } catch {}
            setTranslation(JSON.stringify(old, null, 2));
          }}
        >
          <option value="">Öğe seç</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
      </label>
      <p>
        Çeviri JSON alanları: html, text, title, description, alt, placeholder,
        label, items, options ve submitLabel.
      </p>
      <textarea
        aria-label="Çeviri JSON"
        value={translation}
        onChange={(e) => setTranslation(e.target.value)}
      />
      <button
        onClick={() => {
          try {
            const translated = JSON.parse(translation),
              node = nodes.find((n) => n.id === source);
            if (!node) return;
            let existing = {};
            try {
              existing = JSON.parse(String(node.props.translations || "{}"));
            } catch {}
            commit((p) => ({
              ...p,
              nodes: mapBlock(p.nodes, source, (n) => ({
                ...n,
                props: {
                  ...n.props,
                  translations: JSON.stringify({
                    ...existing,
                    [locale]: translated,
                  }),
                },
              })),
            }));
            notify("Çeviri taslağa eklendi.");
          } catch {
            notify("Geçerli çeviri JSON’u gir.", true);
          }
        }}
      >
        Çeviriyi uygula
      </button>
      <h3>Yerel A/B testi ve huni</h3>
      <label>
        İkinci yayındaki sayfa
        <select
          aria-label="İkinci test sayfası"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          <option value="">Sayfa seç</option>
          {pages
            .filter((p) => p.id !== pageId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </label>
      <button
        onClick={async () => {
          try {
            if (!(await save())) return;
            const r = await api<{ path: string }>(
              `/stores/${storeId}/experiments`,
              {
                method: "POST",
                body: json({
                  name: page.name + " A/B",
                  a: pageId,
                  b: target,
                  split: 50,
                }),
              },
            );
            setLinks((l) => [...l, r.path]);
            notify("Yerel %50 / %50 testi oluşturuldu.");
          } catch (e) {
            notify((e as Error).message, true);
          }
        }}
      >
        %50 / %50 A/B testi oluştur
      </button>
      <button
        onClick={async () => {
          try {
            const r = await api<{ path: string }>(
              `/stores/${storeId}/funnels`,
              {
                method: "POST",
                body: json({
                  name: page.name + " akışı",
                  pages: [pageId, target],
                }),
              },
            );
            setLinks((l) => [...l, r.path]);
            notify("İki adımlı yerel huni oluşturuldu.");
          } catch (e) {
            notify((e as Error).message, true);
          }
        }}
      >
        İki adımlı huni oluştur
      </button>
      {links.map((l) => (
        <a href={l} key={l} target="_blank" rel="noreferrer">
          {new URL(l, window.location.origin).href}
        </a>
      ))}
      <p>Ödeme ve satın alma sonrası Shopify teklifleri bu aşamada kapalı.</p>
      <h3>AI tasarım üretimi</h3>
      <p>
        {integrations?.ai.configured
          ? `${integrations.ai.model} hazır`
          : "AI sağlayıcısı henüz yapılandırılmadı."}
      </p>
      <textarea
        aria-label="AI tasarım isteği"
        placeholder="Oluşturulacak sayfayı anlat"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <select
        aria-label="AI referans görseli"
        value={image}
        onChange={(e) => setImage(e.target.value)}
      >
        <option value="">Görsel kullanma</option>
        {assets
          .filter((a) => a.type === "image" && !a.archived)
          .map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
      </select>
      <button
        disabled={busy || !integrations?.ai.configured}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await api<{ document: PageDocument }>(
              `/stores/${storeId}/ai`,
              {
                method: "POST",
                body: json({ prompt, assetId: image || undefined }),
              },
            );
            commit(() => ({ ...r.document, name: page.name, type: page.type }));
            notify("AI tasarımı taslağa alındı. Kontrol edip kaydet.");
          } catch (e) {
            notify((e as Error).message, true);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Üretiliyor…"
          : image
            ? "Görselden düzenlenebilir tasarım"
            : "AI ile sayfa oluştur"}
      </button>
      <h3>Form hedefi</h3>
      <p>
        {integrations?.forms.destination || "Uygulama içi gönderim kayıtları"}
      </p>
      <TransferPanel
        pageId={pageId}
        storeId={storeId}
        page={page}
        save={save}
        notify={notify}
      />
      <h3>Müşteri önizleme/onayları</h3>
      <p>
        Sayfa panelindeki paylaşılabilir önizlemede müşteri yorum bırakabilir.
        Yönetim erişimi yalnızca sana aittir.
      </p>
      {reviews.map((r, i) => (
        <div className="feature-card" key={i}>
          <b>
            {r.reviewer} ·{" "}
            {r.decision === "approve" ? "Onaylandı" : "Değişiklik istendi"}
          </b>
          <p>{r.note}</p>
        </div>
      ))}
    </div>
  );
}
export function PreviewReview({ token }: { token: string }) {
  const [reviewer, setReviewer] = useState(""),
    [note, setNote] = useState(""),
    [message, setMessage] = useState("");
  return (
    <aside className="preview-review">
      <b>Önizleme değerlendirmesi</b>
      <input
        aria-label="Değerlendiren adı"
        placeholder="Adın"
        value={reviewer}
        onChange={(e) => setReviewer(e.target.value)}
      />
      <input
        aria-label="Değerlendirme notu"
        placeholder="Not"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {["approve", "changes"].map((d) => (
        <button
          key={d}
          onClick={async () => {
            try {
              await api(`/public/previews/${token}/review`, {
                method: "POST",
                body: json({ reviewer, note, decision: d }),
              });
              setMessage("Değerlendirme kaydedildi.");
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          {d === "approve" ? "Onayla" : "Değişiklik iste"}
        </button>
      ))}
      <small role="status">{message}</small>
    </aside>
  );
}
