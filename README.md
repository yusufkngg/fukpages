# FukPages Studio

Tek sahip girişi, çoklu müşteri/mağaza çalışma alanları ve görsel sayfa editörü.
Bu geliştirme sürümü **yerel taslaklar, yerel katalog ve yerel yayınlar** için çalışır.
Kullanıcının isteğiyle bu aşamada Shopify bağlantısı kurulmaz.
İstenen 155 kontrol maddesinin durum/kanıt kaydı [docs/FEATURE_AUDIT.md](docs/FEATURE_AUDIT.md) içindedir.
Shopify OAuth, ürün API'si, tema yayınlama ve gerçek mağazada yayından kaldırma
henüz uygulanmadı. Shopify tema bölümlerini okuyan bağlantı altyapısı eklendi;
canlı mağaza erişimi bu ortamda henüz yapılandırılmadı.

## Netlify demo

Yeni Netlify projesini GitHub **yusufkngg/fukpages → main** dalından içe aktar.
`netlify.toml` build, Functions, Node 24 ve yönlendirmeleri hazırlar.
Netlify ortam ayarına en az 12 karakterlik `FUKPAGES_DEMO_PASSWORD` ekle;
kullanıcı adı `owner`. Panel `/`, demo mağaza `/p/demo/home` adresindedir.
`main` güncellemeleri otomatik deploy edilir; taslaklar ve medya Netlify Blobs'ta
korunur. [Adım adım kurulum ve prototip sınırları](docs/NETLIFY_DEMO.md).
Canlı demo: https://fukpages.netlify.app/ . Giriş ekranı, API, demo mağaza ve
yerel sepet masaüstü/mobilde canlı olarak doğrulandı. Yönetici şifresi
Netlify ortam ayarlarından sağlanır; gerçek sahip oturumu bu testte açılmadı.

## 0.5 geliştirmeleri

- Arayüz varsayılan İngilizce. Dişli simgesi → **Settings → Language → Türkçe**
  tercihi tarayıcıda saklanır; sayfa içeriği ve SEO metni çevrilmez.
- İkonlu sol menü; **Sections / Elements**, görsel satır kartları ve tek,
  genişliği ayarlanabilen sol ayar paneli. **Settings / Advanced** ayrımı;
  font, boyut, kalın/italik/altı çizili, renk ve hizalama ilk sırada.
- Metne tek tık seçim; çift tık düzenleme. İkon kutusu varsayılan olarak
  glyph'e sığar; ikon seçici ve **Fit to icon** kontrolü bulunur.
- Ctrl/Cmd X/C/V, S, D, Z/Shift+Z; Ctrl+Y, seçim/grup ve ok tuşları.
  **Settings → Keyboard shortcuts** yardımını aç. Kes/yapıştır aynı sayfada
  kimlikleri korur; kopyalar ve sayfalar arası yapıştırma yeni kimlik kullanır.
- Satırın içinde doğrudan metin ve ikon. Bölüm/satır için 1–6 kolon;
  azaltırken içerik korunur. Görsel padding/margin diyagramı ve cihaz ayarları.
- Taşınan ve boyutlandırılan **Layers** ağacı, arama ve cihaz bazında görünürlük.
- **Global Styles** renkler, fontlar, tipografi ve altı boşluk token'ı.
  **Update all pages** veya Ctrl+S ile markayı kaydet; özel font yüklemesi korunur.
- Çok öğeli accordion: düzenleme, çoğaltma, sıralama, kaldırma; başlık/içerik
  arka planı, padding, kenarlık, köşe ve aralık ayarları. Yerel yayında çalışır.
- İkonlu mevcut tema bölüm kartları ve **Choose templates / Add blank section**.
  Gerçek Shopify bölüm verisi bağlantı aşamasını gerektirir.

52 otomatik test; yeni arayüz kabul akışı `npm run test:ui`. İngilizce ve Türkçe
editör açılışı, kalıcı dil tercihi, içerik korunması, native kes/yapıştır, ikon
ölçüsü, çift tık, layer tree boyutlandırma ve accordion yayını kontrol edilir.
[Davranışlar ve ekran görüntüleri](docs/EDITOR_UI.md).

## 0.4 geliştirmeleri

- Ana sayfa, ürün ve koleksiyon sekmeleri; arama, bağımsız taslak çoğaltma ve
  çoklu yerel ürün/koleksiyon ataması. Editörde kaydederek sayfa geçişi ve
  önizleme hedefi seçimi.
- Cihaz bazında serbest yerleştirme, sürükleme, ok tuşları ve kenardan
  genişlik/yükseklik değiştirme. Akışa dönüş, görünür kolonlar ve kolon ekleme.
- Kalıcı düğme bağlantıları, görsel öğesi/PNG/tarayıcı görseli kopyala-yapıştır;
  gerçek bölüm kartı ve önizlemedeki ürün bağlamını koruyan ekleme.
- Genişliği ayarlanıp hatırlanan yan paneller, dikey uzatılan bölüm ayarları,
  kısa araçlar ve sol tık/Escape/kaydırmayla kapanan sağ tık menüsü.
- `Sayfa → SEO ve yayın → SEO’yu kaydet ve yayını güncelle` ile taslak ve
  ziyaretçinin gördüğü başlık, meta açıklaması ve URL birlikte güncellenir.
  Editör sekmesi de başlığı kullanır. Demo bağlantısı slug değişse de açılır.
- Padding/margin için `10` gibi birimsiz uzunluklar px olarak uygulanır ve
  saklanır; eski belgeler de düzeltilir. `%`, `rem` ve birimsiz line-height korunur.

**47 otomatik test** ve gerçek Netlify Function/resmi yerel Blobs üzerinde ek
tarayıcı kontrolleri: `npm run test:feedback`. Kabul koşulları ve ekran görüntüleri
[docs/EDITOR_FEEDBACK.md](docs/EDITOR_FEEDBACK.md) içinde. Shopify bağlantısı kurulmadı.

## 0.3 geliştirmeleri

0.3.3: bölüm arka planları ekran genişliğini doldurur; marka container'ı yalnızca
içeriği sınırlar ve ortalar. Editör/önizleme/yayın aynı düzeni kullanır. Mobil ve
tablet stilleri, özel flex/grid düzenleri ve aktarımda kaynak içerik genişliği
korunur. `npm run test:responsive` 320–4256 px arasında 13 ekran boyutunu ölçer.

0.3.2: geçersiz Netlify şifre ayarı demo mağazayı kapatmaz. Yönetim erişimi
kapalı kalır, giriş ekranı düzeltilmesi gereken ayarı gösterir ve eski
oturumlar iptal edilir. 42 otomatik test çalışır.

0.3.1: Netlify'daki `ERR_REQUIRE_ESM` başlangıç çökmesi giderildi. Güncel HTML
temizleme paketleri build sırasında CommonJS biçimine derlenir; Lambda uyumlu
paket ve tarayıcı testleri `require(ESM)` kapalıyken de geçer. Panel API
hatasında veya 30 saniyelik zaman aşımında hata/yeniden deneme gösterir.

- Bağlantı kaybında tarayıcıda yerel taslak saklama ve kurtarma; iki sekmenin
  çakışmasını karşılaştırıp alan bazında birleştirme ve iki JSON'u indirme.
- Yükleme tamamlanıp cevap kaybolursa tekrar denemede aynı medya kaydı; yükleme
  ilerleme/hata gösterimi ve açık tekrar deneme.
- Hover/focus renk, kenarlık, gölge ve hareket stilleri; popup/lightbox/sepet
  için Tab/Shift+Tab, Escape ve önceki odağa dönüş.
- Kaynak markayı ve kalıtılan özel font yüzlerini koruyan aktarım; istenirse
  hedef markayı kullanma seçeneği.
- İçeriği/kimlikleri koruyan uyumlu bölüm düzeni değiştirme; tekrar eden kart
  metinlerini düzenleme, sıralama, çoğaltma ve kaldırma.
- Bölümleri gerçek renderer ile marka/font ve üç cihazda önizleme.
- Ziyaretçi/olay bazında tekrar saymayı engelleyen A/B sonuç tablosu, tekil
  sepete ekleme oranı ve %95 güven aralığı; gerçek satın alma ölçümü değildir.
- **42 otomatik test**, **720 bölüm/ekran kontrolü**, **113 yerel olarak
  doğrulanmış madde**. 23 madde kod incelemesi seviyesindedir; 11 Shopify,
  5 sağlayıcı ve 3 kısmi madde için sınırlar raporda korunur.

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

Tek owner hesabı bütün yönetim API'lerine erişir. Başlangıçta ek hesap yoktur;
owner isterse mağazaya sınırlı editor/viewer açabilir. Herkese açık kayıt akışı yoktur. Oturumlar HttpOnly cookie kullanır; yazma işlemleri
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

Editör varsayılan olarak **Bölümler** kütüphanesini açar. 30 aileden 60 hazır düzen vardır. İlk aileler:
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

## Medya, font ve marka kiti

Medya paneli bilgisayardan çoklu yükleme, dosya bırakma, tuvale bırakma ve native
panodan görsel yapıştırmayı destekler. Seçili görselin stilleri korunarak kaynak
veya mobil görsel değiştirilebilir; kutu/bölüm arka planı seçilebilir. Arama,
klasör, etiket, favori, yeniden adlandırma, boyut/format ve kullanım bilgisi vardır.
Kullanılan dosya kaldırılmadan önce etkilenen sayfalar gösterilir. Kaldırma
kütüphaneden arşivler; eski yayın ve sürümlerin dosyaları korunur.

PNG/JPEG/WebP/AVIF/GIF kabul edilir; SVG etkin içerik/dış kaynak kontrolünden sonra
rasterleştirilir. İç gradient/use referansları korunur. Görseller optimize edilir,
320/640/1280/1920 genişlik varyantları oluşturulur; renderer srcset, lazy loading,
contain/cover, odak, dönüş/çevirme, oran, alt metin, bağlantı ve lightbox kullanır.
Kırpma yeni dosya oluşturur; asıl dosya korunur. Dosyalar mağaza bazında ayrılır;
özel/henüz yayınlanmamış dosyalar owner veya yetkili ekip oturumu ister.

HTTPS URL içe aktarma yalnızca izin verilen hostname'lerden yapılır; yönlendirme,
IP adresi ve etkin SVG kaynakları kabul edilmez. Varsayılanlar images.unsplash.com,
images.pexels.com, cdn.shopify.com ve raw.githubusercontent.com. Diğer güvenilen
kaynaklar `MEDIA_IMPORT_HOSTS` ile tam hostname olarak eklenir. Bulut network
policy ayrıca hedefe izin vermelidir; mevcut proxy ve TLS doğrulaması korunur.
Sunucunun fontconfig önbelleği yazılabilir tmp dizininde tutulur.

WOFF/WOFF2/TTF/OTF fontlar doğrulanır; TTF/OTF WOFF2'ye dönüşür. Aile, kalınlık,
italik, değişken eksenler ve Türkçe glif kapsamı saklanır. Katalog sistem fontları
ve yüklenen ailelerden oluşur; canlı metin önizlemesi, yedek font ve kullanım
bilgisi vardır. Değişken eksenler cihaz bazında düzenlenir. Yalnızca gerekli
font yüzleri tarayıcı tarafından yüklenir; yayın/önizleme aynı dosyaları kullanır.
Test fixture fontları OFL lisanslarıyla `tests/fixtures` içinde bulunur.

Marka kitinde primary/secondary/accent/text/background/border renkleri,
başlık/gövde/düğme/yedek fontları, H1–H6 boyut/kalınlık ve satır yüksekliği,
küçük metin/link stilleri, mobil ölçek, container, bölüm boşluğu, köşe ve gölge
vardır. Yeni hazır bölümler marka değerlerine bağlanır; özel değerler korunur.
Globalden ayır mevcut değerleri dondurur; global stile geri dön tekrar bağlar.

## Gelişmiş düzenleme ve bölüm paylaşımı

Stil ve öğe panosu sayfalar arasında kullanılabilir. Shift/Ctrl ile çoklu seçim,
gruplama/çözme, üst öğeyi seçme, kilitleme, katman adlandırma/arama, sağ tık,
klavye yeniden sıralama, kolon sürükleme tutamacı, mobil order, responsive reset,
esnek önizleme genişliği ve hover/focus arka plan durumları vardır.

Sunucudaki kalıcı sürüm geçmişi oturum içi undo'dan ayrıdır. Eski belgeyi taslağa
almak yeni kayda dönüşür. Yerel yayın geçmişi ayrı tutulur ve önceki yayına dönülür.
Kaydetme çakışmaları/hataları gösterilir; sessizce üzerine yazılmaz.

Kayıtlı bölüm bağımsız kopya veya senkron kayıt olabilir. "Senkron bölümü tüm
taslaklarda güncelle" komutu bağlı sayfaları aynı işlemde günceller. Yerel yayın
snapshot'ları tekrar yayınlanana kadar korunur. Bu, otomatik Shopify senkronu değildir.

## Yeni öğeler, katalog ve formlar

Toplam 49 öğe türü vardır. Temel 19'a form/select/checkbox/radio, tabs, carousel,
galeri, logo şeridi, puan, karşılaştırma, önce/sonra, kupon, kargo eşiği, popup,
video popup, yukarı dön, breadcrumb, mobil menü, blog kartları, kontrollü HTML,
uygulama alanı ve ürün/varyant/adet/sepete ekle/collection/bundle öğeleri eklendi.
Kontrollü HTML scriptsiz iframe'de çalışır; uygulama alanı bağlı bir SDK olmadan
bağlantı kurulmamış olarak gösterilir.

Ürünler paneli **yerel katalog** JSON'unu yönetir: ürün adı/açıklama/görseller,
metafield, varyant seçenekleri, kuruş cinsinden fiyat/indirim fiyatı/stok ve
koleksiyonlar. Yayındaki yerel sayfalar katalog değişikliğini okur. Galeri,
varyant-fiyat-görsel-stok, adet, koleksiyon sıralama/sayfalama, paket ve adet teklifi
önizlemeleri çalışır. Sepet tarayıcıda yerel tutulur; **ödeme oluşturmaz**.
Shopify gerçek ürün/checkout bağlantısı bu aşamada ertelenmiştir.

Form container ve alanlar zorunluluk/email/telefon/seçenek/izin doğrulaması,
özel mesaj, loading/success/failure, yönlendirme, honeypot/rate-limit, idempotent
tekrar ve kalıcı kayıtları destekler. Formun hedefi görünür. Varsayılan hedef
uygulama içidir; yalnızca "webhook" seçilen form ve yapılandırılmış HTTPS hedefi
varsa harici kuyruk oluşturulur. Retry aynı idempotency anahtarını korur. Yerel
formlar sağlayıcı yapılandırılmış olsa bile otomatik dışarı gönderilmez.
E-posta/CRM uygulamasına özgü SDK bağlantıları sağlayıcı seçimi gerektirir.

Butonlar sayfa/ürün/koleksiyon URL'si, bölüm kaydırma, popup aç/kapat, yerel
sepet ekle/aç, form submit, kupon, telefon/mailto/WhatsApp aksiyonları kullanır.

## Sayfa, SEO, çeviri ve ajans akışları

Sayfa paneli kısa URL `/p/:store/:slug`, ilk HTML'de SEO/OG meta, noindex,
7 günlük snapshot önizleme bağlantısı, yerel publish/unpublish zamanlaması,
kalite uyarıları ve görsel byte/resource timing bilgisini sunar. Zamanlamalar
sunucu çalışırken yürür; mağaza durdurulunca yayın ve pending planlar kapatılır.
Yeniden etkinleştirme kendiliğinden eski yayınları açmaz.

Akışlar panelinde içerik çevirileri ve dil seçimi, yerel A/B testi (kalıcı ziyaretçi
ataması), sayfa hunisi, preview/onay kayıtları ve mağazalar arası aktarım vardır.
Aktarım ürün/koleksiyon eşleştirmesi ister; dosyalar hedef mağazaya kopyalanır.
Aktarım varsayılan olarak kaynak marka görünümünü somut stillere çevirir;
kalıtılan fontlar dahil kullanılan tüm font yüzleri kopyalanır. Hedef mağazanın
marka kiti değişmez. İstenirse hedef markayı kullanma seçeneği seçilebilir.
Huni ödeme/satın alma sonrası Shopify teklifi değildir. Ölçüm yerel view/click/add
olaylarını toplar; gerçek Shopify satış ölçümü değildir.

Başlangıçta yalnızca owner hesabı vardır; genel kayıt yoktur. İsteğe bağlı ekip
hesabını owner açar: mağaza bazında editor veya salt okunur viewer. Başka mağaza
kaynaklarına erişim ve owner işlemleri sunucuda engellenir. Hesabı durdurmak veya
rolünü değiştirmek mevcut oturumları iptal eder. Müşteri önizleme/onay için hesap
zorunlu değildir; owner'ın ürettiği süreli bağlantı yeterlidir.

## İsteğe bağlı dış hizmetler

Canlı sağlayıcı bu görevde bağlanmadı. AI JSON/vision tasarım adaptörü sonuçları
normal belge doğrulamasından geçirir; geçersiz yanıt uygulanmaz. Provider mevcut
değilse UI üretimi açmaz ve API 503 verir. `FUKPAGES_AI_API_KEY` güvenli ayardan,
`AI_MODEL` isteğe bağlı model seçiminden gelir; HTTPS hedefi api.openai.com'dur.
Platforma ayrılan OPENAI_ isimleri yerine uygulamaya özel anahtar adı kullanılır.
Anahtar sohbete, Git'e veya tarayıcıya yazılmaz. Tasarım taslağa alınır; otomatik yayın yoktur.

Webhook için isteğe bağlı `FORM_WEBHOOK_URL` (HTTPS) ve `FORM_WEBHOOK_SECRET`
güvenli ortam ayarlarıdır. Gerçek hedef hostname'i ve provider listesi seçilmeden
sahte bağlantı/binding oluşturulmaz. Canlı AI/e-posta/CRM/abonelik entegrasyonu
ve Shopify yayınlama doğrulanmış kabul edilmez; ayrıntılar özellik denetiminde yer alır.

## Doğrulama

```sh
npm test
npm run build
python tests/browser_smoke.py
python tests/browser_smoke.py --dev
python tests/browser_smoke.py --theme-fixture
python tests/browser_studio.py
npm run test:feedback
npm run test:responsive
npm run test:network
npm run format:check
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
