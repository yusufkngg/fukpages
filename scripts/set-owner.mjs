import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { hashPassword } from "../server/auth.mjs";

if (!process.stdin.isTTY) {
  console.error(
    "Güvenli parola girişi için bu komutu etkileşimli terminalde çalıştırın.",
  );
  process.exit(1);
}
async function secret(prompt) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdout.write(prompt);
  return new Promise((accept, reject) => {
    let value = "";
    const listener = (chunk) => {
      for (const char of chunk.toString()) {
        if (char === "\u0003") {
          cleanup();
          reject(new Error("İptal edildi"));
          return;
        }
        if (char === "\r" || char === "\n") {
          cleanup();
          accept(value);
          return;
        }
        if (char === "\u007f") value = value.slice(0, -1);
        else if (char >= " ") value += char;
      }
    };
    const cleanup = () => {
      process.stdin.off("data", listener);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
    };
    process.stdin.on("data", listener);
  });
}
try {
  const password = await secret("Yeni yönetici şifresi (en az 12 karakter): ");
  if (password.length < 12) throw new Error("Şifre en az 12 karakter olmalı.");
  const confirmation = await secret("Şifreyi tekrar girin: ");
  if (password !== confirmation) throw new Error("Şifreler eşleşmiyor.");
  const directory = resolve(process.env.DATA_DIR ?? ".local");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(resolve(directory, "owner.hash"), hashPassword(password), {
    mode: 0o600,
  });
  chmodSync(resolve(directory, "owner.hash"), 0o600);
  if (existsSync(resolve(directory, "fukpages.sqlite"))) {
    const db = new DatabaseSync(resolve(directory, "fukpages.sqlite"));
    db.exec("DELETE FROM sessions");
    db.close();
  }
  console.log(
    "Yönetici şifresi güvenli biçimde kaydedildi. Kullanıcı adı: owner. Sunucuyu yeniden başlatın.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
