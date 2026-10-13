import { useState } from "react";
import { mapBlock, type Block } from "./model";
import {
  compatibleLayouts,
  changeSectionLayout,
  repeatedGroups,
  cardFields,
  changeCard,
  sectionDependencies,
} from "./sectionDesign";
import { SectionPreview } from "./SectionPreview";
export function SectionDesign({
  section,
  update,
}: {
  section: Block;
  update: (section: Block) => void;
}) {
  const layouts = compatibleLayouts(section),
    groups = repeatedGroups(section);
  const [target, setTarget] = useState(""),
    [preview, setPreview] = useState(false),
    [groupId, setGroupId] = useState("");
  const group = groups.find((g) => g.id === groupId) || groups[0];
  const candidate = changeSectionLayout(
    section,
    target || String(section.props.presetId),
  );
  return (
    <details className="section-design" data-section-design>
      <summary>Bölüm düzeni ve kartlar</summary>
      {layouts.length > 1 ? (
        <>
          <label>
            Düzen
            <select
              aria-label="İçeriği koruyan bölüm düzeni"
              value={target || String(section.props.presetId)}
              onChange={(e) => setTarget(e.target.value)}
            >
              {layouts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <p>
            Metinler, görseller ve bağlantılar korunur. Yerleşim değişir; yeni
            öğeler eklenmez.
          </p>
          <button onClick={() => setPreview(true)}>Yeni düzeni önizle</button>
          <button onClick={() => update(candidate)}>
            İçeriği koruyarak uygula
          </button>
        </>
      ) : (
        <p>
          Bu bölümün diğer düzenleri hazır bölüm kütüphanesinde önizlenebilir.
        </p>
      )}
      {sectionDependencies(section).map((m) => (
        <p className="feature-warning" key={m}>
          {m}
        </p>
      ))}
      {!!groups.length && (
        <>
          <h4>Tekrarlanan kartlar</h4>
          <select
            aria-label="Kart grubu"
            value={group?.id}
            onChange={(e) => setGroupId(e.target.value)}
          >
            {groups.map((g, i) => (
              <option key={g.id} value={g.id}>
                {g.name} · {i + 1}
              </option>
            ))}
          </select>
          {group?.children.map((card, index) => (
            <article key={card.id} data-card-editor>
              <b>
                Kart {index + 1} · {card.name}
              </b>
              {cardFields(card).map((f) => (
                <label key={f.id}>
                  {f.name}
                  <textarea
                    aria-label={`Kart ${index + 1} ${f.name}`}
                    value={f.value}
                    onChange={(e) =>
                      update({
                        ...section,
                        children: mapBlock(section.children, f.id, (n) => ({
                          ...n,
                          props: { ...n.props, [f.prop]: e.target.value },
                        })),
                      })
                    }
                  />
                </label>
              ))}
              <div>
                {(
                  [
                    ["up", "Yukarı"],
                    ["down", "Aşağı"],
                    ["copy", "Çoğalt"],
                    ["remove", "Sil"],
                  ] as const
                ).map(([action, label]) => (
                  <button
                    key={action}
                    aria-label={`Kart ${index + 1} ${label}`}
                    disabled={
                      (action === "up" && index === 0) ||
                      (action === "down" &&
                        index === group.children.length - 1) ||
                      (action === "remove" && group.children.length === 1) ||
                      (action === "copy" && group.children.length >= 24)
                    }
                    onClick={() =>
                      update(changeCard(section, group.id, index, action))
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </>
      )}
      {preview && (
        <SectionPreview
          section={candidate}
          onClose={() => setPreview(false)}
          apply={() => {
            update(candidate);
            setPreview(false);
          }}
          actionLabel="Bu düzeni uygula"
        />
      )}
    </details>
  );
}
