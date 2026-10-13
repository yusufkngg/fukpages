import { t } from "./i18n.ts";
import { useState, useEffect } from "react";
import { api, json } from "./api";
import type { Store } from "./model";
export function TeamPanel({
  notify,
}: {
  notify: (m: string, e?: boolean) => void;
}) {
  const [accounts, setAccounts] = useState<
      {
        id: string;
        login: string;
        role: string;
        stores: string[];
        active: boolean;
      }[]
    >([]),
    [stores, setStores] = useState<Store[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [login, setLogin] = useState(""),
    [password, setPassword] = useState(""),
    [role, setRole] = useState("viewer");
  const reload = async () => setAccounts(await api<typeof accounts>("/team"));
  useEffect(() => {
    void reload().catch((e) => notify(e.message, true));
    api<Store[]>("/stores")
      .then(setStores)
      .catch((e) => notify(e.message, true));
  }, []);
  return (
    <div className="library-scroll feature-panel">
      <h3>{t("İsteğe bağlı ajans hesapları")}</h3>
      <p>
        {t(
          "Başlangıçta yalnızca ana yönetici vardır. Ek hesaplar yalnızca burada oluşturulur; genel kayıt kapalıdır.",
        )}
      </p>
      <label>
        {t("Kullanıcı adı")}
        <input
          autoComplete="off"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
        />
      </label>
      <label>
        {t("Şifre")}
        <input
          aria-label={t("Yeni hesap şifresi")}
          type="password"
          autoComplete="new-password"
          minLength={12}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <label>
        {t("Rol")}
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="viewer">{t("İzleyici · salt okunur tasarım")}</option>
          <option value="editor">
            {t("Düzenleyici · yetkili mağaza taslakları")}
          </option>
        </select>
      </label>
      <p>{t("Yetkili mağazalar")}</p>
      {stores.map((s) => (
        <label key={s.id}>
          <input
            type="checkbox"
            checked={selected.includes(s.id)}
            onChange={(e) =>
              setSelected((v) =>
                e.target.checked ? [...v, s.id] : v.filter((id) => id !== s.id),
              )
            }
          />
          {s.name}
        </label>
      ))}
      <button
        onClick={async () => {
          try {
            await api("/team", {
              method: "POST",
              body: json({ login, password, role, stores: selected }),
            });
            setPassword("");
            setLogin("");
            await reload();
            notify(
              t("Hesap oluşturuldu. Yönetim yetkisi ana yöneticide kalır."),
            );
          } catch (e) {
            notify((e as Error).message, true);
          }
        }}
      >
        {t("Hesabı oluştur")}
      </button>
      {accounts.map((a) => (
        <div key={a.id} className="feature-card">
          <b>
            {a.login} · {a.role}
          </b>
          <small>
            {a.stores
              .map((id) => stores.find((s) => s.id === id)?.name)
              .join(", ")}
          </small>
          <button
            onClick={async () => {
              try {
                await api("/team/" + a.id, {
                  method: "PATCH",
                  body: json({ active: !a.active }),
                });
                await reload();
                notify(
                  t("Hesap durumu değiştirildi; eski oturumlar kapatıldı."),
                );
              } catch (e) {
                notify((e as Error).message, true);
              }
            }}
          >
            {a.active ? t("Devre dışı bırak") : t("Etkinleştir")}
          </button>
        </div>
      ))}
    </div>
  );
}
