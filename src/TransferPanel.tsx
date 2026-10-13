import { useState, useEffect } from "react";
import { api, json } from "./api";
import type { PageDocument, Store, Block } from "./model";
import type { Catalog } from "./Commerce";
export function TransferPanel({
  pageId,
  storeId,
  page,
  save,
  notify,
}: {
  pageId: string;
  storeId: string;
  page: PageDocument;
  save: () => Promise<boolean>;
  notify: (m: string, e?: boolean) => void;
}) {
  const [stores, setStores] = useState<Store[]>([]),
    [target, setTarget] = useState(""),
    [catalog, setCatalog] = useState<Catalog>({
      source: "local",
      products: [],
      collections: [],
    }),
    [productMap, setProductMap] = useState<Record<string, string>>({}),
    [collectionMap, setCollectionMap] = useState<Record<string, string>>({});
  useEffect(() => {
    api<Store[]>("/stores")
      .then(setStores)
      .catch((e) => notify(e.message, true));
  }, []);
  useEffect(() => {
    if (target)
      api<Catalog>(`/stores/${target}/catalog`)
        .then(setCatalog)
        .catch((e) => notify(e.message, true));
    setProductMap({});
    setCollectionMap({});
  }, [target]);
  const products = new Set<string>(),
    collections = new Set<string>();
  const walk = (nodes: Block[]) =>
    nodes.forEach((n) => {
      if (n.props.productId) products.add(String(n.props.productId));
      if (n.props.collectionId) collections.add(String(n.props.collectionId));
      walk(n.children);
    });
  walk(page.nodes);
  return (
    <div className="feature-card">
      <h3>Başka mağazaya aktar</h3>
      <select
        aria-label="Aktarım hedef mağazası"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      >
        <option value="">Hedef mağaza</option>
        {stores
          .filter((s) => s.id !== storeId && s.status === "active")
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
      </select>
      {[...products].map((id) => (
        <label key={id}>
          {id} →
          <select
            aria-label={`Ürün eşleştirme ${id}`}
            value={productMap[id] || ""}
            onChange={(e) =>
              setProductMap((m) => ({ ...m, [id]: e.target.value }))
            }
          >
            <option value="">Hedef ürün</option>
            {catalog.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
      ))}
      {[...collections].map((id) => (
        <label key={id}>
          {id} →
          <select
            value={collectionMap[id] || ""}
            onChange={(e) =>
              setCollectionMap((m) => ({ ...m, [id]: e.target.value }))
            }
          >
            <option value="">Hedef koleksiyon</option>
            {catalog.collections.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
      ))}
      <p>
        Görseller ve kullanılan özel fontlar hedef mağazaya kopyalanıp eşlenir.
        Senkron bölüm ve tema bağlantısı bağımsız taslağa dönüşür.
      </p>
      <button
        disabled={!target}
        onClick={async () => {
          try {
            if (!(await save())) return;
            await api(`/pages/${pageId}/transfer`, {
              method: "POST",
              body: json({ targetStoreId: target, productMap, collectionMap }),
            });
            notify("Tasarım hedef mağazada yeni taslak olarak oluşturuldu.");
          } catch (e) {
            notify((e as Error).message, true);
          }
        }}
      >
        Eşleştirip aktar
      </button>
    </div>
  );
}
