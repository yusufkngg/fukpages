import { t, localized } from "./i18n.ts";
import { useState } from "react";
import { Dialog } from "./Dialog";
import {
  mergeDocuments,
  downloadDocument,
  type MergeChoices,
} from "./draftRecovery";
import { findBlock, type PageDocument } from "./model";
export type DraftConflict = {
  base: PageDocument;
  local: PageDocument;
  remote: PageDocument;
  version: number;
};
export function ConflictDialog({
  value,
  open,
  onClose,
  apply,
}: {
  value: DraftConflict;
  open: boolean;
  onClose: () => void;
  apply: (document: PageDocument) => Promise<void>;
}) {
  const [choices, setChoices] = useState<MergeChoices>({}),
    [busy, setBusy] = useState(false);
  const result = mergeDocuments(value.base, value.local, value.remote, choices);
  const pending = result.conflicts.filter((c) => !choices[c.path]);
  const blockName = (id: string) =>
    findBlock(value.local.nodes, id)?.name ||
    findBlock(value.remote.nodes, id)?.name ||
    findBlock(value.base.nodes, id)?.name ||
    id;
  const fieldLabel = (path: string) => {
    if (path === "sayfa.name") return t("Sayfa adı");
    const ids = [...path.matchAll(/\[([\w-]+)\]/g)].map((m) => m[1]);
    const key = path.split(".").at(-1) || "";
    const labels: Record<string, string> = localized({
      order: t("Öğe sırası"),
      html: t("Metin"),
      text: t("Düğme metni"),
      src: t("Görsel"),
      name: t("Öğe adı"),
      fontSize: t("Yazı boyutu"),
      color: t("Metin rengi"),
      backgroundColor: t("Arka plan"),
      href: t("Bağlantı"),
      children: t("Alt öğeler"),
    });
    return `${ids.length ? blockName(ids.at(-1)!) + " · " : t("Sayfa · ")}${labels[key] || key}`;
  };
  const describe = (v: unknown): string => {
    if (v === undefined) return t("Silindi");
    if (Array.isArray(v))
      return v
        .map((id) =>
          typeof id === "string" ? blockName(id) : JSON.stringify(id),
        )
        .join(" → ");
    if (v && typeof v === "object" && "name" in v)
      return String(v.name) + t(" · Bölümün içeriği değişti");
    return typeof v === "string" ? v : JSON.stringify(v);
  };
  const submit = async (document: PageDocument) => {
    setBusy(true);
    try {
      await apply(document);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      label={t("Kayıt çakışmasını çöz")}
      className="conflict-dialog"
    >
      <h2>{t("Değişikliklerini karşılaştır")}</h2>
      <p>
        {t(
          "Farklı alanlardaki değişiklikler birlikte korunur. Aynı alan değiştiyse hangi değeri kullanacağını seç. Yerel kopyan bu tarayıcıda korunuyor.",
        )}
      </p>
      <div className="conflict-actions">
        <button onClick={() => downloadDocument(value.local, "yerel")}>
          {t("Yerel kopyayı indir")}
        </button>
        <button onClick={() => downloadDocument(value.remote, "sunucu")}>
          {t("Sunucu kopyasını indir")}
        </button>
      </div>
      {!result.conflicts.length && (
        <p>
          {t(
            "Alan çakışması yok. İki taraftaki değişiklikler birleştirilebilir.",
          )}
        </p>
      )}
      {result.conflicts.map((c) => (
        <fieldset key={c.path}>
          <legend>{fieldLabel(c.path)}</legend>
          <label>
            <input
              type="radio"
              name={c.path}
              checked={choices[c.path] === "local"}
              onChange={() =>
                setChoices((old) => ({ ...old, [c.path]: "local" }))
              }
            />{" "}
            {t("Bu sekmedeki değer") + " "}
            <pre>{describe(c.local)}</pre>
          </label>
          <label>
            <input
              type="radio"
              name={c.path}
              checked={choices[c.path] === "remote"}
              onChange={() =>
                setChoices((old) => ({ ...old, [c.path]: "remote" }))
              }
            />{" "}
            {t("Sunucudaki değer") + " "}
            <pre>{describe(c.remote)}</pre>
          </label>
        </fieldset>
      ))}
      <button
        disabled={busy || pending.length > 0}
        onClick={() => void submit(result.document)}
      >
        {t("Seçimleri birleştir")}
      </button>
      <button disabled={busy} onClick={() => void submit(value.remote)}>
        {t("Sunucudaki sürümü kullan")}
      </button>
    </Dialog>
  );
}
