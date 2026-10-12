# FukPages Studio

Tek sahip girişi, çoklu müşteri/mağaza çalışma alanları ve görsel sayfa editörü.
Bu ilk geliştirme sürümü **yerel taslaklar ve yerel yayınlar** için çalışır.
Shopify OAuth, ürün API'si, tema yayınlama ve gerçek mağazada yayından kaldırma
henüz uygulanmadı. Shopify tema bölümlerini okuyan bağlantı altyapısı eklendi;
canlı mağaza erişimi bu ortamda henüz yapılandırılmadı.

## Gereksinimler ve kurulum

Node.js 24.5 veya üzeri ve npm gerekir. Mevcut checkout'u kullanın; bu bulut görevi
zaten izole bir ortamda çalışır, ayrıca Git worktree oluşturmayın.

```sh
cd /workspace/fukpages
npm ci --include=dev --cache /tmp/fukpages-npm-cache
npm run build
```

İlk gerçek kullanım için yönetici şifresini etkileşimli terminalde belirleyin:

```sh
npm run owner:setup
```

Komut şifreyi ekrana yazmaz. En az 12 karakter ister, iki girişin eşleşmesini
kontrol eder ve yalnızca scrypt hash'ini `.local/owner.hash` dosyasına kaydeder.
Kullanıcı adı `owner` olur. Şifreyi kaynak koduna, komut satırına veya sohbete
yazmayın. İsteğe bağlı `OWNER_LOGIN` kullanıcı adını, `OWNER_PASSWORD_HASH`
kurumunuzun güvenli ortam ayarlarından sağlanan scrypt hash'ini belirler.
Bu hash `scrypt:<32 hex salt>:<128 hex digest>` biçimindedir.
Hash veya `.local/owner.hash` yoksa giriş kapalıdır; varsayılan bir şifre bulunmaz.

## Çalıştırma

```sh
cd /workspace/fukpages
npm run dev
```

Bu komut Express sunucusunu 3001, Vite geliştirme sunucusunu 5173 portunda
başlatır. Vite `/api` isteklerini Express'e iletir. `npm run build` sonrasında
`npm start`, derlenmiş uygulamayı ve API'yi tek sunucudan sunar.
Sunucu Node'un `--use-env-proxy` ve `--use-system-ca` seçeneklerini kullanır;
mevcut HTTPS proxy ve güvenilir sertifika ayarlarını takip eder. TLS doğrulaması
açık kalır. Bu ağ yolu ortamda resmi Shopify kaynağına HTTPS isteğiyle doğrulandı.

`DATA_DIR` verilmezse SQLite veritabanı `.local/fukpages.sqlite` içinde saklanır.
`.local/`, bağımlılıklar ve derleme çıktıları Git tarafından yok sayılır.
Veritabanı ve owner hash'i kalıcı dosyalardır; çalışan süreçler yeni bulut
görevlerinde tekrar başlatılmalıdır. `NODE_ENV=production` oturum cookie'sinin
HTTPS gerektiren `Secure` niteliğini açar; üretim HTTPS arkasında çalıştırılmalıdır.

## Çalışan editör yetenekleri

- İç içe bölüm, satır, kolon ve kutular; kütüphaneden sürükleme veya tıklayarak
  ekleme; öğeleri taşıma; katman ağacından seçim ve yeniden sıralama.
- Başlık, rich text, görsel, düğme, ikon, etiket, input, textarea, video, liste,
  accordion, ayırıcı, boşluk, örnek ürün kartı ve geri sayım blokları.
- Metne çift tıklayarak doğrudan düzenleme; seçilen metinde bold, italic,
  underline ve strike-through. İçerik panelinden metin/bağlantı/görsel alanları.
- Genişlik/yükseklik, flex/grid, yön, hizalama, gap, padding/margin, font,
  tipografi, renk, kenarlık, köşe, gölge, konum, opaklık ve animasyon kontrolleri.
- Masaüstü 1120px, tablet 768px ve mobil 390px önizlemeleri. Stil kalıtımı:
  masaüstü → tablet → mobil. Cihazdaki özel değerler ayrı saklanır; tablet/mobil
  değişiklikleri masaüstünü değiştirmez. Her cihazın görünürlüğü ayrıca yönetilir.
- Geri al/ileri al, çoğalt/sil, yukarı/aşağı taşıma, JSON içe/dışa aktarma,
  üç başlangıç şablonu, temiz önizleme ve sunucuda kalıcı otomatik taslak kaydı.
- Eşzamanlı eski kayıtların üzerine yazılmasını engelleyen sürüm kontrolü.
- Landing, home, product, collection, page, blog, article, cart ve search taslak
  türleri. Bu türler henüz Shopify template bağlantısı oluşturmaz.

Kısayollar: `Ctrl/Cmd+S` kaydet, `Ctrl/Cmd+Z` geri al,
`Ctrl/Cmd+Shift+Z` ileri al, `Ctrl/Cmd+D` çoğalt, `Delete` sil, `Escape` seçimi
kaldır/önizlemeyi kapat. Metin/input alanları kendi klavye davranışlarını korur.

## Yönetim ve yerel yayınlama

Tek owner hesabı bütün yönetim API'lerine erişir. Müşteri hesapları veya herkese
açık kayıt akışı bulunmaz. Oturumlar HttpOnly cookie kullanır; yazma işlemleri
CSRF token'ı ister; başarısız girişler sınırlandırılır.

Yeni çalışma alanı oluşturabilir, sayfalarını yönetebilir ve devre dışı
bırakabilirsiniz. Devre dışı bırakma, yerel yayınları aynı işlemde kaldırır ve
sunucu tarafında yeni kayıt/yayın işlemlerini engeller. Yeniden etkinleştirmek
taslakları açar; önceki yayınları otomatik geri getirmez.

"Yerel yayın" sayfanın o anki kayıtlı sürümünü yayınlar. Sonraki taslak
değişiklikleri tekrar yayınlanana kadar ziyaretçi sürümüne geçmez. Bu yerel
ziyaretçi görünümü uygulamanın `published` query parametresiyle ve yayın API'siyle
çalışır. Canlı Shopify mağazasına içerik göndermez.

## Bölüm kütüphanesi ve Shopify tema eşleşmesi

Editör varsayılan olarak **Bölümler** kütüphanesini açar. 11 hazır düzen vardır:
ürün hero'su, ortalanmış hero, özellik kartları, görsel/hikâye, ürün vitrini,
yorumlar, SSS, bülten, kampanya bandı, header ve footer. Bunlar tek bir bölüm
olarak eklenir; içindeki metin, kutu, görsel ve düğmeler bağımsız düzenlenebilir.
Bir öğe seçip "Seçili bölümü kaydet" ile onu içeren bütün bölümü saklayabilirsiniz.
"Kaydettiklerim" sekmesinden eklenen kopyalar yeni kimliklerle oluşturulur;
bir kopyayı düzenlemek kaynak bölümü veya diğer sayfaları değiştirmez.

**Tema** panelinde mağazanın `.myshopify.com` adresini kaydedin. Sunucuda şu
bağlantı gereksinimleri güvenli ortam ayarlarıyla sağlanmalıdır:

- `SHOPIFY_SHOP_DOMAIN`: aynı mağazanın hostname'i; URL şeması veya yol içermez.
- `SHOPIFY_ADMIN_ACCESS_TOKEN`: ilgili mağazada `read_themes` yetkisi olan Admin
  API bağlantısı. Değeri sohbete, Git deposuna veya tarayıcıya koymayın. Proxy
  secret kullanılıyorsa hedef HTTPS hostname'i aynı mağaza olmalıdır.

İlk bağlantı bir mağaza/anahtar çiftini destekler. Ayrı müşteri mağazaları için
Shopify OAuth ve mağaza başına oturum saklama sonraki entegrasyon işidir; tek
anahtarın bütün bağımsız mağazalarda çalıştığı varsayılmaz.

"Temayı senkronize et" yayındaki temayı GraphQL Admin API `2026-10` üzerinden
okur: `layout/theme.liquid`, seçili sayfa türünün JSON şablonu, header/footer
bölüm grupları ve ilgili section şemaları. JSON yorumları, bölüm sırası, ayarlar
ve gizli bölümler korunur. Şablon veya erişim eksikse işlem başarısız gösterilir;
uydurulmuş bir tema kaydı üretilmez. Tema dosyalarına yazan bir API çağrısı yoktur.

"Tema düzenini kullan" ile header/footer ve mevcut tema bölümleri yapısal olarak
gösterilir; özel FukPages bölümleri içerik alanında kalır. Kaynak tema bölümlerinin
ayarları okunur ve Shopify tema düzenleyicisine bağlantı verilir. **Gerçek Liquid
HTML/CSS önizlemesi henüz yapılmaz**; bu alanlar konum belirten yer tutuculardır.
Yerel ziyaretçi yayını da gerçek Shopify storefront yayını yerine geçmez.

Tema snapshot'ları mağaza ve şablonla eşlenir. Bir başka mağazanın snapshot'ı
kullanılamaz. Yeniden senkronizasyon özel tasarım bloklarını değiştirmez.
Mağazayı devre dışı bırakmak yeni senkronizasyon ve bölüm kayıtlarını engeller.

Sorgu şekilleri Shopify'ın resmi CLI kaynaklarıyla karşılaştırıldı:
[get_themes](https://github.com/Shopify/cli/blob/main/packages/cli-kit/src/cli/api/graphql/admin/queries/get_themes.graphql),
[get_theme_file_bodies](https://github.com/Shopify/cli/blob/main/packages/cli-kit/src/cli/api/graphql/admin/queries/get_theme_file_bodies.graphql).

## Doğrulama

```sh
npm test
npm run build
python tests/browser_smoke.py
python tests/browser_smoke.py --dev
python tests/browser_smoke.py --theme-fixture
```

Sunucu testleri gerçek HTTP/SQLite üzerinden owner erişimi, CSRF, giriş limiti,
responsive verinin kaydı, eski sürüm çakışması, HTML doğrulaması ve mağaza bazlı
yerel yayın kaldırmayı kontrol eder.

Tarayıcı testi Python Playwright ve `/usr/bin/chromium` ister; mevcut bulut
ortamında ikisi de bulunur. Test derlenmiş uygulamayı gerçek Chromium'da açar,
geçici test owner'ı ve geçici veritabanı kullanır; bunları bitince kaldırır.
Gerçek giriş, sürükle-bırak, taşıma, cihaz stilleri, metin düzenleme, kaydetme,
yeniden açma, bölüm kaydı/kopyalama ve yerel yayını kaldırma akışlarını kontrol eder. Ekran görüntülerini
`.local/validation` altına yazar. Test owner'ı gerçek kullanım hesabı değildir.

Sonraki Shopify entegrasyonunun kapsamı ve kabul koşulları
[PRODUCT_PLAN.md](PRODUCT_PLAN.md) içinde tutulur.
