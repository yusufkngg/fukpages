import { useState, useEffect } from "react";
import { api } from "./api";
import { PageRenderer } from "./Renderer";
import { StudioProvider, type Brand, type Asset } from "./studio";
import type { PageDocument, Store } from "./model";
import type { Catalog } from "./Commerce";
export function Viewer({
  pageId,
  store,
  back,
}: {
  pageId: string;
  store: Store;
  back: () => void;
}) {
  const [data, setData] = useState<{
      document: PageDocument;
      brand: Brand;
      assets: Asset[];
      catalog: Catalog;
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    Promise.all([
      api<{ document: PageDocument }>(`/pages/${pageId}`),
      api<{ brand: Brand }>(`/stores/${store.id}/brand`),
      api<Asset[]>(`/stores/${store.id}/assets`),
      api<Catalog>(`/stores/${store.id}/catalog`),
    ])
      .then(([p, b, assets, catalog]) =>
        setData({ document: p.document, brand: b.brand, assets, catalog }),
      )
      .catch((e) => setError(e.message));
  }, [pageId, store.id]);
  return (
    <div>
      <button onClick={back}>Mağazalara dön</button>
      <p>İzleyici · Salt okunur tasarım</p>
      {data ? (
        <StudioProvider
          page={data.document}
          value={{ ...data, storeId: store.id, previewToken: "owner-view" }}
        >
          <PageRenderer document={data.document} device="desktop" />
        </StudioProvider>
      ) : (
        <p>{error || "Yükleniyor…"}</p>
      )}
    </div>
  );
}
