# Netlify demo kurulumu

Bu prototip, şifreli paneli ve örnek mağazayı aynı Netlify projesinde sunar. Shopify bağlantısı yoktur. Ürün, stok ve sepet örnek veridir; ödeme veya gerçek sipariş oluşturulmaz.

## Yeni proje

1. [Netlify proje ekleme ekranını aç](https://app.netlify.com/start). **Import an existing project → GitHub** seç.
2. GitHub hesabını bağla; Netlify'a **yusufkngg/fukpages** deposunu görme izni ver. Depoyu ve **main** dalını seç. Böylece bu depoya yapılan her push aynı projeyi günceller.
3. Netlify `netlify.toml` dosyasını okur: build `npm run build:netlify`, publish `dist`, functions `netlify/functions`, Node 24. Base directory boş kalır; depo kökü kullanılır.
4. Deploy öncesi **Environment variables** alanına `FUKPAGES_DEMO_PASSWORD` ekle. Değerini en az 12 karakterlik kendi şifren yap. Kapsam **Functions** veya **All scopes**, bağlam **Production** olmalı. Şifreyi GitHub'a veya sohbete yazma. `VITE_` öneki ekleme.
5. Deploy'u başlat. Şifreyi sonradan eklersen/değiştirirsen **Deploys → Trigger deploy** ile yeni deploy başlat.
6. Verilen `https://…netlify.app` adresini aç. Kullanıcı adı **owner**, şifre 4. adımda belirlediğin değer.

| Adres | Kullanım |
| --- | --- |
| `/` | Şifreli yönetim paneli; demo sayfayı seçip düzenle |
| `/p/demo/home` | Atanmış ana sayfa; SEO kısa adı değişse de açılır |
| `/p/demo/products/aura-one` | Örnek ürüne atanmış ürün sayfası |
| `/p/demo/collections/demo-collection` | Örnek koleksiyona atanmış koleksiyon sayfası |
| `/api/health` | Sunucu sağlık yanıtı |

Panelde **Demo mağazayı aç** bağlantısı bulunur. Sayfayı düzenleyip **Yerel yayın** ile yayınla; bu adım Netlify üzerindeki demo mağazayı günceller. **Kaydet** taslağı saklar, yayınlanan sürümü ayrıca değiştirmen gerekir.

SEO için **Sayfa → SEO ve yayın → SEO’yu kaydet ve yayını güncelle** kullan.
Bu düğme başlık, meta açıklaması ve kısa adresi kaydeder, yayını günceller ve
yeni bağlantıyı gösterir. Editörün sekme başlığı da alanı takip eder.

0.4, bir defaya mahsus örnek ürün ve koleksiyon sayfalarını ekler ve mevcut
demo kataloğunun ilk ürün/koleksiyonuna atar. Düzenlenmiş sayfa ve atamalar
korunur. Sonraki deploy'lar örnekleri yeniden oluşturmaz; devre dışı mağazayı
etkinleştirmez. Katalog kimlikleri değiştirildiyse yukarıdaki ürün/koleksiyon
adresleri yerine sayfa yönetimindeki **Mağazada aç** bağlantısını kullan.

## Sonraki güncellemeler

GitHub `main` dalına push yapıldığında Netlify yeni deploy'u otomatik oluşturur. Kaynak kodunun GitHub'a gönderilmesi ve deploy'un başarılı olması ayrı aşamalardır; Netlify **Deploys** ekranında durum görünür. Projeyi doğrudan mevcut depodan içe aktar; bağımsız bir depo kopyasının güncellemeleri bu depoyu takip etmez.

Ana deploy'da kalıcı store adı `fukpages-demo-production` olur. Yeni deploy, taslakları/sürümleri/form kayıtlarını ve yüklenen medya/fontları yeniden tohumlamaz. Demo başlangıç verisi sadece ilk kurulumda oluşturulur. Önizleme deploy'ları build anındaki deploy kimliğiyle ayrı depolama kullanır; ana projenin kayıtlarına veya oturumlarına erişmez.

## Depolama ve prototip sınırları

Netlify Blobs, SQLite ve medyanın sıkıştırılmış anlık görüntüsünü saklar. Her istek geçici bir çalışma dizininde çalışır; değişiklik yalnızca güçlü tutarlılık ve ETag koşullu yazımı başarıyla tamamlandıktan sonra başarılı yanıt verir. Yarışan istek güncel veriden tekrar değerlendirilir; eski sayfa sürümü 409 alır. Scrypt şifre doğrulaması, HTTPS/HttpOnly/SameSite cookie ve CSRF kontrolü sunucudadır. Başarısız girişler soğuk başlangıçlarda da korunur; şifre değişikliği oturumları iptal eder. Şifre yoksa yönetim kapalıdır.

- Tek isteğin medya/form-data toplamı **4 MB altında** olmalı. Netlify'ın istek/yanıt ve çalışma süresi limitleri ayrıca geçerlidir.
- Snapshot için **32 MB sıkıştırılmış / 64 MB açılmış JSON** üst sınırı vardır; base64 nedeniyle gerçek medya kapasitesi daha düşüktür. Sınır aşılırsa başarılı kayıt yanıtı verilmez; panelde yerel taslağı dışa aktarabilirsin.
- Depolama her istekte indirilir; küçük, tek sahipli demo içindir. Büyük medya arşivi veya gerçek müşteri trafiği için kalıcı veritabanı ve ayrı nesne depolama gerekir.
- Zamanlı yayınlar istek geldiğinde kontrol edilir; kesintisiz zamanlayıcı bu Netlify demosunda yoktur. Express sunucusunda 15 saniyelik zamanlayıcı devam eder.
- AI ve e-posta/CRM sağlayıcısı yapılandırılmaz. Yerel formlar uygulamada saklanır. Shopify yayını, gerçek ödeme ve sipariş ölçümü bu aşamada yoktur.

## Doğrulama ve sorun giderme

0.3.3, masaüstünde bölümlerin 1200 px genişlikte sola sıkışmasını giderir.
Bölüm arka planı ekranı doldurur; içerik marka container genişliğinde ortalanır,
dar ekranda kullanılabilir genişliğe iner. Özel genişlik, flex/grid ayarları
editör, önizleme ve yayında birlikte çalışır. `npm run test:responsive` 13 ekran
genişliğini (320–4256 px), marka ayarını ve mağazalar arası aktarımı doğrular.

0.3.2, geçersiz yönetici şifre ayarının bütün demo uçlarını 503 ile kapatmasını
giderir. Şifre ayarı geçersizse yönetim erişimi kapalıdır, önceki oturumlar
iptal edilir; demo mağaza ve giriş ekranı açılır. Giriş ekranı düzeltilecek
değişkeni ve gerekli biçimi açıklar. Değeri yalnızca Netlify ortam ayarlarında
değiştir; sohbete yazma. Gerekirse geçersiz `OWNER_PASSWORD_HASH` değişkenini
kaldırıp en az 12 karakterlik `FUKPAGES_DEMO_PASSWORD` kullan.

0.3.1, Netlify/Lambda'da `require(ESM)` kapalıyken `sanitize-html` →
`htmlparser2` yüklemesindeki `ERR_REQUIRE_ESM` çökmesini giderir. Güncel
`sanitize-html` 2.18.0 ve ayrıştırıcısı build sırasında CommonJS paketine
derlenir; deneysel runtime bayrağı açmak gerekmez. `npm run build`, `npm run dev`
ve `npm test` gerekli dosyayı üretir. Üretim başlangıcı önceden derlenmiş dosyayı
kullanabilir. `server/generated/` kaynak deposuna eklenmez; Netlify build'i
dosyayı üretip Function paketine dahil eder.

Panel giriş durumu 30 saniyede yanıtlanmazsa veya API çökerse yükleme ekranı
hata ve **Tekrar dene** düğmesine dönüşür. Demo sayfasında da yeniden deneme
vardır. `X-FukPages-Version` ve Netlify build commit'i mevcutsa
`X-FukPages-Commit` yanıt başlıkları hangi sürümün yayımlandığını gösterir.

Bu hata için Netlify **Deploys** ekranındaki son yayının GitHub `main` dalındaki
son commit'e ait olduğunu kontrol et. Yeni commit'i seçerek yeniden deploy
başlatabilirsin; build cache sorununda **Clear cache and deploy site** kullan.

`npm run build:netlify`, `npm test`, `npm run test:netlify` ve `npm run test:browser` kullanılır. Paket testi `--no-experimental-require-module` ayarıyla resmi Netlify paketleyicisini, resmi **yerel** Blobs sunucusunu ve gerçek native medya/font dönüşümünü çalıştırır; özel `.local`, `.env`, SQLite ve hash dosyalarının pakete girmediğini kontrol eder. Tarayıcı testi aynı modda şifreli paneli, demo mağazayı, sepeti, kalıcı düzenlemeyi, API hatasını, zaman aşımını ve yeniden denemeyi doğrular.

fukpages.netlify.app üzerinde 0.3.2 canlı sürümünün API/giriş ekranı/demo mağaza/yerel sepet ve masaüstü/mobil görünümü ayrıca kontrol edildi. Chromium kaynakları TLS doğrulaması açık bir HTTPS transportuyla aldı. API sağlıklı, oturumsuz yönetim 401 ve geçerli şifre yapılandırması doğrulandı. Gerçek sahibin şifresi kullanılmadı; canlı yönetici oturumu ve canlı sayfa değiştirme/yayınlama bu kontrolde yapılmadı.

- “Yönetici hesabı henüz yapılandırılmadı”: `FUKPAGES_DEMO_PASSWORD` adını, en az 12 karakteri ve Functions/Production kapsamını kontrol edip tekrar deploy et.
- `/api/health` JSON yerine HTML dönüyorsa Functions/redirect ayarlarını ve `netlify.toml` dosyasının depo kökünde olduğunu kontrol et.
- `node:sqlite` hatasında Functions runtime **nodejs24.x** olmalı. Dosyada Node 24 build/runtime ayarları bulunur.
- Blobs hatasında Netlify Function loglarını kontrol et; projenin Blobs erişiminin etkin ve paketlenmiş function'ın mevcut olduğunu doğrula. Erişim anahtarını veya şifreyi loglama.
- Demo mağazayı durdurursan yayın kapanır; yeniden etkinleştirme eski yayını kendiliğinden açmaz. Panelden tekrar yayınla.
