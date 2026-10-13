import { t } from "./i18n.ts";
import {
  FileText,
  FlaskConical,
  Image,
  LayoutDashboard,
  LayoutTemplate,
  Layers,
  Package,
  PanelsTopLeft,
  Palette,
  Plus,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";

export type RailTool =
  | "blocks"
  | "sections"
  | "templates"
  | "layers"
  | "media"
  | "brand"
  | "workflow"
  | "catalog"
  | "theme"
  | "growth"
  | "team";

type RailEntry = [RailTool, LucideIcon, string, string];
// Captions stay short; the tooltip explains what each panel holds.
const railGroups: { id: string; tools: RailEntry[] }[] = [
  {
    id: "build",
    tools: [
      ["blocks", Plus, "Öğeler", "Sürükle-bırak öğeler"],
      ["sections", PanelsTopLeft, "Bölümler", "Hazır ve kayıtlı bölümler"],
      [
        "templates",
        LayoutTemplate,
        "Şablonlar",
        "Tam sayfa başlangıç şablonları",
      ],
      ["layers", Layers, "Katmanlar", "Sayfa yapısı ve katman ağacı"],
    ],
  },
  {
    id: "design",
    tools: [
      ["media", Image, "Medya", "Görseller ve dosyalar"],
      ["brand", Palette, "Marka", "Global stiller: renk, font, boşluk"],
    ],
  },
  {
    id: "page",
    tools: [
      ["workflow", FileText, "Sayfa", "SEO, adres ve yayın"],
      ["catalog", Package, "Ürünler", "Yerel ürün kataloğu"],
      ["theme", Store, "Tema", "Shopify tema düzeni"],
      ["growth", FlaskConical, "Akışlar", "Çeviriler, A/B testleri ve huniler"],
    ],
  },
];

export function ToolRail({
  active,
  layersOpen,
  owner,
  open,
  exit,
}: {
  active: string;
  layersOpen: boolean;
  owner: boolean;
  open: (tool: RailTool) => void;
  exit: () => void;
}) {
  const groupsForRole = owner
    ? [
        ...railGroups,
        {
          id: "admin",
          tools: [
            ["team", Users, "Hesaplar", "Ekip hesapları ve roller"],
          ] as RailEntry[],
        },
      ]
    : railGroups;
  return (
    <nav className="tool-rail" aria-label={t("Editör araçları")}>
      <div className="tool-rail-groups">
        {groupsForRole.map((group) => (
          <div className="tool-rail-group" key={group.id}>
            {group.tools.map(([id, Icon, caption, hint]) => {
              const isActive = id === "layers" ? layersOpen : active === id;
              return (
                <button
                  key={id}
                  data-rail={id}
                  className={isActive ? "active" : ""}
                  aria-pressed={isActive}
                  title={`${t(caption)} · ${t(hint)}`}
                  onClick={() => open(id)}
                >
                  <Icon size={18} strokeWidth={1.75} />
                  <span className="rail-caption">{t(caption)}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <button
        className="tool-rail-exit"
        title={t("Mağaza yönetimi")}
        onClick={exit}
      >
        <LayoutDashboard size={18} strokeWidth={1.75} />
        <span className="rail-caption">{t("Mağazalar")}</span>
      </button>
    </nav>
  );
}
