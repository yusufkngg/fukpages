import { useState, useSyncExternalStore } from "react";
import { Settings, Languages } from "lucide-react";
import { Dialog } from "./Dialog";
import {
  getUiLanguage,
  setUiLanguage,
  subscribeUiLanguage,
  t,
  type UiLanguage,
} from "./i18n";
export function UiSettingsButton() {
  const [open, setOpen] = useState(false);
  const language = useSyncExternalStore(subscribeUiLanguage, getUiLanguage);
  return (
    <>
      <button
        className="ui-settings-button"
        aria-label={t("Ayarlar")}
        title={t("Ayarlar")}
        onClick={() => setOpen(true)}
      >
        <Settings size={18} />
      </button>
      <Dialog
        open={open}
        label={t("Ayarlar")}
        onClose={() => setOpen(false)}
        className="ui-settings-dialog"
      >
        <h2>
          <Settings size={20} /> {t("Ayarlar")}
        </h2>
        <label>
          <span>
            <Languages size={16} /> {t("Dil")}
          </span>
          <select
            aria-label={t("Dil")}
            value={language}
            onChange={(e) => setUiLanguage(e.target.value as UiLanguage)}
          >
            <option value="en">English</option>
            <option value="tr">Türkçe</option>
          </select>
        </label>
        <p>
          {language === "en"
            ? "Interface language only. Your page content stays unchanged."
            : "Yalnızca arayüz dili değişir. Sayfa içeriğin korunur."}
        </p>
        <details className="shortcut-help">
          <summary>
            {language === "en" ? "Keyboard shortcuts" : "Klavye kısayolları"}
          </summary>
          <table>
            <tbody>
              {[
                [
                  "Ctrl / ⌘ + X / C / V",
                  "Cut / Copy / Paste",
                  "Kes / Kopyala / Yapıştır",
                ],
                ["Ctrl / ⌘ + S", "Save", "Kaydet"],
                ["Ctrl / ⌘ + Z", "Undo", "Geri al"],
                ["Ctrl / ⌘ + Shift + Z", "Redo", "İleri al"],
                ["Ctrl / ⌘ + D", "Duplicate", "Çoğalt"],
                ["Ctrl / ⌘ + A", "Select all elements", "Tüm öğeleri seç"],
                ["Ctrl / ⌘ + G", "Group", "Grupla"],
                ["Ctrl / ⌘ + Shift + G", "Ungroup", "Grubu çöz"],
                ["Delete / Backspace", "Delete selection", "Seçimi sil"],
                ["↑ ↓ ← →", "Move selected element", "Seçili öğeyi taşı"],
                [
                  "Esc",
                  "Close menu / Exit text editing",
                  "Menüyü kapat / Metin düzenlemeden çık",
                ],
              ].map(([keys, en, tr]) => (
                <tr key={keys}>
                  <td>
                    <kbd>{keys}</kbd>
                  </td>
                  <td>{language === "en" ? en : tr}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            {language === "en"
              ? "Select an element first. Double-click text to edit it. While typing, editing shortcuts act on your text. Hold Shift with an arrow for a 10px step in free positioning."
              : "Önce bir öğe seç. Metni düzenlemek için çift tıkla. Yazarken düzenleme kısayolları metne uygulanır. Serbest yerleşimde ok tuşuyla Shift kullanarak 10px ilerle."}
          </p>
        </details>
        <button className="primary-button" onClick={() => setOpen(false)}>
          {t("Kapat")}
        </button>
      </Dialog>
    </>
  );
}
