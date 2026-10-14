// Inspector section for tabs and carousels: add, rename, reorder, duplicate
// and delete panels. Each panel is a container block, so its contents are
// edited on the canvas like any other element.
import { t } from "./i18n.ts";
import { ArrowDown, ArrowUp, Copy, Eye, Plus, Trash2 } from "lucide-react";
import { make, panelStyles } from "./atomicContent";
import { cloneBlock, type Block } from "./model";
import { panelTitle, showPanel } from "./Panels";

export function PanelSettings({
  node,
  update,
}: {
  node: Block;
  update: (fn: (n: Block) => Block, key?: string) => void;
}) {
  const tabs = node.kind === "tabs";
  const setPanels = (fn: (panels: Block[]) => Block[], key?: string) =>
    update((n) => ({ ...n, children: fn(n.children) }), key);
  const add = () => {
    const index = node.children.length;
    const panel = make(
      "box",
      {
        panelTitle: tabs
          ? t("Sekme {p0}", { p0: index + 1 })
          : t("Slayt {p0}", { p0: index + 1 }),
      },
      tabs
        ? { ...panelStyles }
        : { ...panelStyles, alignItems: "center", textAlign: "center" },
      [
        tabs
          ? make("text", { html: t("Sekme içeriği") }, { fontSize: "16px" })
          : make(
              "image",
              { src: "/assets/headphones.svg", alt: "" },
              { width: "100%", maxWidth: "720px", objectFit: "contain" },
            ),
      ],
    );
    panel.name = String(panel.props.panelTitle);
    setPanels((panels) => [...panels, panel]);
    setTimeout(() => showPanel(node.id, index), 0);
  };
  const move = (index: number, by: number) => {
    setPanels((panels) => {
      const next = [...panels];
      const [panel] = next.splice(index, 1);
      next.splice(index + by, 0, panel);
      return next;
    });
    setTimeout(() => showPanel(node.id, index + by), 0);
  };
  return (
    <section className="panel-settings" data-panel-settings>
      <h3>{tabs ? t("Sekmeler") : t("Slaytlar")}</h3>
      <p className="setting-help">
        {tabs
          ? t(
              "Her sekme kendi öğelerini taşır. İçeriği tuvalde seçip düzenle; öğeleri sekmeye sürükleyebilirsin.",
            )
          : t(
              "Her slayt kendi öğelerini taşır. Görsel, başlık veya buton ekleyip tuvalde düzenle.",
            )}
      </p>
      <ol>
        {node.children.map((panel, index) => {
          const title = panelTitle(panel, index, node.kind);
          return (
            <li key={panel.id}>
              <input
                aria-label={
                  tabs
                    ? t("Sekme başlığı {p0}", { p0: index + 1 })
                    : t("Slayt adı {p0}", { p0: index + 1 })
                }
                value={String(panel.props.panelTitle ?? "")}
                placeholder={title}
                onChange={(e) => {
                  const value = e.target.value;
                  setPanels(
                    (panels) =>
                      panels.map((p) =>
                        p.id === panel.id
                          ? {
                              ...p,
                              name: value || p.name,
                              props: { ...p.props, panelTitle: value },
                            }
                          : p,
                      ),
                    `panel-title:${panel.id}`,
                  );
                }}
              />
              <div className="panel-actions">
                <button
                  type="button"
                  aria-label={t("Tuvalde göster: {p0}", { p0: title })}
                  title={t("Tuvalde göster")}
                  onClick={() => showPanel(node.id, index)}
                >
                  <Eye size={13} />
                </button>
                <button
                  type="button"
                  disabled={index === 0}
                  aria-label={t("Yukarı taşı: {p0}", { p0: title })}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  disabled={index === node.children.length - 1}
                  aria-label={t("Aşağı taşı: {p0}", { p0: title })}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  type="button"
                  aria-label={t("Çoğalt: {p0}", { p0: title })}
                  onClick={() => {
                    setPanels((panels) => [
                      ...panels.slice(0, index + 1),
                      {
                        ...cloneBlock(panel),
                        props: {
                          ...panel.props,
                          panelTitle: t("{p0} kopya", { p0: title }),
                        },
                      },
                      ...panels.slice(index + 1),
                    ]);
                    setTimeout(() => showPanel(node.id, index + 1), 0);
                  }}
                >
                  <Copy size={13} />
                </button>
                <button
                  type="button"
                  disabled={node.children.length < 2}
                  aria-label={t("Sil: {p0}", { p0: title })}
                  onClick={() => {
                    setPanels((panels) =>
                      panels.filter((p) => p.id !== panel.id),
                    );
                    setTimeout(
                      () => showPanel(node.id, Math.max(0, index - 1)),
                      0,
                    );
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <button type="button" className="panel-add" onClick={add}>
        <Plus size={13} />
        {tabs ? t("Sekme ekle") : t("Slayt ekle")}
      </button>
      {!tabs && (
        <label className="control">
          <span>{t("Otomatik geçiş (saniye, 0 = kapalı)")}</span>
          <input
            type="number"
            min={0}
            max={30}
            aria-label={t("Otomatik geçiş (saniye, 0 = kapalı)")}
            value={Number(node.props.autoplay || 0)}
            onChange={(e) =>
              update(
                (n) => ({
                  ...n,
                  props: { ...n.props, autoplay: e.target.value },
                }),
                `autoplay:${node.id}`,
              )
            }
          />
        </label>
      )}
    </section>
  );
}
