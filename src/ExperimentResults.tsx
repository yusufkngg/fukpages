import { useCallback, useEffect, useState } from "react";
import { api, json } from "./api";
type Experiment = {
  id: string;
  name: string;
  active: number;
  split: number;
  results: {
    variants: {
      variant: string;
      visitors: number;
      clicks: number;
      carts: number;
      cartRate: number;
      interval: number[];
    }[];
    observedLift: number | null;
    note: string;
    goal: string;
  };
};
export function ExperimentResults({
  storeId,
  refreshKey,
  notify,
}: {
  storeId: string;
  refreshKey: number;
  notify: (m: string, error?: boolean) => void;
}) {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const load = useCallback(
    () =>
      api<Experiment[]>(`/stores/${storeId}/experiments`)
        .then(setExperiments)
        .catch((e) => notify(e.message, true)),
    [storeId, notify],
  );
  useEffect(() => {
    void load();
  }, [load, refreshKey]);
  const percent = (n: number) => `${(n * 100).toFixed(1)}%`;
  return (
    <div className="experiment-results" data-experiment-results>
      <h3>A/B sonuçları</h3>
      <button onClick={() => void load()}>Test sonuçlarını yenile</button>
      {!experiments.length && <p>Henüz yerel A/B testi yok.</p>}
      {experiments.map((e) => (
        <article key={e.id}>
          <b>{e.name}</b> · {e.active ? "Aktif" : "Durduruldu"} · %{e.split}/%
          {100 - e.split}
          <a href={`/?experiment=${e.id}`} target="_blank" rel="noreferrer">
            Testi aç
          </a>
          <table>
            <caption>{e.results.goal}</caption>
            <thead>
              <tr>
                <th>Varyant</th>
                <th>Ziyaretçi</th>
                <th>Tıklayan</th>
                <th>Sepete ekleyen</th>
                <th>Oran · %95 aralık</th>
              </tr>
            </thead>
            <tbody>
              {e.results.variants.map((v) => (
                <tr key={v.variant}>
                  <th>{v.variant.toUpperCase()}</th>
                  <td>{v.visitors}</td>
                  <td>{v.clicks}</td>
                  <td>{v.carts}</td>
                  <td>
                    {percent(v.cartRate)} ·{" "}
                    {v.visitors
                      ? v.interval.map(percent).join(" – ")
                      : "Trafik bekleniyor"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Gözlenen B/A farkı:{" "}
            {e.results.observedLift === null
              ? "A varyantında dönüşüm bekleniyor"
              : percent(e.results.observedLift)}
          </p>
          <small>{e.results.note}</small>
          <button
            onClick={async () => {
              try {
                await api(`/stores/${storeId}/experiments/${e.id}`, {
                  method: "PATCH",
                  body: json({ active: !e.active }),
                });
                await load();
              } catch (error) {
                notify((error as Error).message, true);
              }
            }}
          >
            {e.active ? "Testi durdur" : "Testi devam ettir"}
          </button>
        </article>
      ))}
    </div>
  );
}
