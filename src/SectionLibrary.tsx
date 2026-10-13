import { SectionPreview } from "./SectionPreview";
import { createSectionPreset } from "./sections";
import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import {
  Bookmark,
  Check,
  ChevronRight,
  Layers,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  sectionCategories,
  sectionPresets,
  type SavedSection,
  type SectionCategory,
  type SectionPreset,
} from "./sections";
import type { Block } from "./model";

function PresetCard({
  preset,
  add,
  preview,
}: {
  preset: SectionPreset;
  add: () => void;
  preview: () => void;
}) {
  const drag = useDraggable({
    id: `section-preset:${preset.id}`,
    data: { sectionPresetId: preset.id },
  });
  return (
    <div className="preset-entry">
      <button
        ref={drag.setNodeRef}
        {...drag.attributes}
        {...drag.listeners}
        onClick={add}
        className={`section-preset-card ${drag.isDragging ? "dragging" : ""}`}
        data-section-preset={preset.id}
      >
        <div
          className={`section-thumb ${preset.category} ${preset.id}`}
          style={{ backgroundColor: preset.accent }}
        >
          <span className="mini-brand">fukpages / sections</span>
          <div className="mini-section-title">
            {preset.category === "hero" ? (
              <>
                MAKE IT
                <br />
                YOUR OWN.
              </>
            ) : preset.category === "layout" ? (
              "Your brand."
            ) : preset.category === "conversion" ? (
              "A little more."
            ) : (
              "Designed for you."
            )}
          </div>
          {preset.id === "product-hero" || preset.id === "image-story" ? (
            <img src="/assets/headphones.svg" alt="" />
          ) : (
            <div className="mini-section-grid">
              <i />
              <i />
              <i />
            </div>
          )}
          <span className="mini-cta" />
        </div>
        <div className="section-card-title">
          <b>{preset.name}</b>
          <span>
            <Plus size={12} />
          </span>
        </div>
        <p>{preset.description}</p>
      </button>
      <button
        className="preset-preview-button"
        onClick={preview}
        aria-label={`${preset.name} önizle`}
      >
        Önizle
      </button>
    </div>
  );
}
export function SectionLibrary({
  saved,
  addPreset,
  addSaved,
  saveSelected,
  selectedSection,
  removeSaved,
}: {
  saved: SavedSection[];
  addPreset: (id: string) => void;
  addSaved: (section: Block) => void;
  saveSelected: (name: string, synchronized?: boolean) => Promise<boolean>;
  selectedSection?: Block;
  removeSaved: (id: string) => Promise<void>;
}) {
  const [tab, setTab] = useState("catalog"),
    [category, setCategory] = useState<SectionCategory>("all"),
    [search, setSearch] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewSection = previewId ? createSectionPreset(previewId) : undefined;
  const [synchronized, setSynchronized] = useState(false);
  const [saveName, setSaveName] = useState(""),
    [naming, setNaming] = useState(false),
    [busy, setBusy] = useState(false);
  const filtered = sectionPresets.filter(
    (preset) =>
      (category === "all" || preset.category === category) &&
      `${preset.name} ${preset.description}`
        .toLocaleLowerCase("tr")
        .includes(search.toLocaleLowerCase("tr")),
  );
  return (
    <>
      <div className="section-library-tabs">
        <button
          className={tab === "catalog" ? "active" : ""}
          onClick={() => setTab("catalog")}
        >
          Hazır bölümler <span>{sectionPresets.length}</span>
        </button>
        <button
          className={tab === "saved" ? "active" : ""}
          onClick={() => setTab("saved")}
        >
          <Bookmark size={12} /> Kaydettiklerim <span>{saved.length}</span>
        </button>
      </div>
      <label className="library-search">
        <Search size={14} />
        <input
          aria-label="Bölüm ara"
          placeholder="Bölüm ara…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      {tab === "catalog" && (
        <div className="section-categories">
          {sectionCategories.map(([id, label]) => (
            <button
              key={id}
              className={category === id ? "active" : ""}
              onClick={() => setCategory(id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="library-scroll section-catalog">
        {tab === "catalog"
          ? filtered.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                add={() => addPreset(preset.id)}
                preview={() => setPreviewId(preset.id)}
              />
            ))
          : saved
              .filter((item) =>
                item.name
                  .toLocaleLowerCase("tr")
                  .includes(search.toLocaleLowerCase("tr")),
              )
              .map((item) => (
                <div className="saved-section-card" key={item.id}>
                  <button
                    className="saved-section-insert"
                    onClick={() => addSaved(item.section)}
                  >
                    <Layers size={20} />
                    <span>
                      <b>{item.name}</b>
                      <small>
                        {item.section.props.linkedSectionId
                          ? "Senkron · "
                          : "Bağımsız · "}
                        {item.section.children.length} alt öğe · tam
                        düzenlenebilir
                      </small>
                    </span>
                    <Plus size={13} />
                  </button>
                  <button
                    className="saved-section-remove"
                    title="Kütüphaneden kaldır"
                    onClick={() => void removeSaved(item.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
        {tab === "catalog" && !filtered.length && (
          <p className="setting-help">Eşleşen hazır bölüm bulunamadı.</p>
        )}
        {tab === "saved" && !saved.length && (
          <div className="saved-section-empty">
            <Bookmark size={24} />
            <h3>İyi tasarımlar tekrar kullanılır.</h3>
            <p>Sayfadan bir bölüm seçip kütüphanene kaydet.</p>
          </div>
        )}
      </div>
      {previewSection && (
        <SectionPreview
          section={previewSection}
          onClose={() => setPreviewId(null)}
          apply={() => {
            addPreset(previewId!);
            setPreviewId(null);
          }}
        />
      )}
      <div className="save-section-bar">
        {naming ? (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              try {
                if (await saveSelected(saveName, synchronized)) {
                  setNaming(false);
                  setTab("saved");
                }
              } finally {
                setBusy(false);
              }
            }}
          >
            <input
              autoFocus
              aria-label="Kaydedilen bölüm adı"
              value={saveName}
              onChange={(event) => setSaveName(event.target.value)}
              maxLength={100}
              required
            />
            <label className="toggle-row">
              <input
                type="checkbox"
                aria-label="Senkron bölüm olarak kaydet"
                checked={synchronized}
                onChange={(e) => setSynchronized(e.target.checked)}
              />{" "}
              Senkron bölüm
            </label>
            <button type="submit" disabled={busy} title="Bölümü kaydet">
              <Check size={14} />
            </button>
            <button
              type="button"
              onClick={() => setNaming(false)}
              title="Vazgeç"
            >
              ×
            </button>
          </form>
        ) : (
          <button
            disabled={!selectedSection}
            onClick={() => {
              setSaveName(selectedSection?.name ?? "Yeni bölüm");
              setNaming(true);
            }}
          >
            <Bookmark size={13} />
            <span>Seçili bölümü kaydet</span>
            <ChevronRight size={12} />
          </button>
        )}
      </div>
    </>
  );
}
