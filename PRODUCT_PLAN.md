# FukPages 0.3 kapsam durumu

Güncel özellik/kanıt tablosu [docs/FEATURE_AUDIT.md](docs/FEATURE_AUDIT.md) içindedir.
Kullanıcının son kapsam kararı: Shopify bağlantısı bu aşamada yapılmayacak; AI/CRM sağlayıcısı henüz seçilmedi.
Medya/font/marka, 49 öğe, 30 bölüm ailesi/60 düzen, yerel katalog/form/SEO/yayın geçmişi, A/B/huni, çeviri, isteğe bağlı hesap ve aktarım uygulandı.
0.3: kayıt kurtarma/çakışma birleştirme, güvenli upload tekrar denemesi,
hover/focus, erişilebilir dialog, marka/font aktarımı, A/B sonuçları,
içeriği koruyan bölüm düzeni, kart yönetimi ve gerçek bölüm önizlemesi eklendi.
42 otomatik test ve 720 bölüm/ekran kontrolü geçti. 155 maddeden 113'ü yerel
testle, 23'ü kod incelemesiyle kontrol edildi; ertelenen/sınırlı maddeler raporda.
Şifreli panel ve örnek mağaza için Netlify Functions/Blobs kurulumu hazır;
canlı Netlify hesabına deploy henüz doğrulanmadı. [Kurulum](docs/NETLIFY_DEMO.md).
Aşağıdaki Shopify kabul koşulları sonraki bağlantı aşamasına aittir; tamamlandığı iddia edilmez.

## Ürün ve sonraki bağlantı planı

## Amaç ve kabul edilen kapsam

Kullanıcının kendi Shopify mağazalarını ve hizmet verdiği müşterilerin
mağazalarını tek bir şifre korumalı panelden yönetmesini sağlayacak, GemPages
ile özellik eşdeğerliğini hedefleyen bir sayfa oluşturucu geliştirmek.

- Başlangıçta tek kullanıcı uygulamanın sahibidir. Dosyadaki ajans rolü için
  isteğe bağlı mağaza bazlı editor/viewer desteği vardır; owner hesap
  oluşturmadıkça ek kullanıcı yoktur. Ana yönetim yetkisi owner’da kalır.
- Sayfa kapsamı: tüm sayfa türleri; aşağıdaki Shopify sınırlamaları ayrıca geçerli.
- İlk ürün: bağımsız, şifre korumalı ana yönetim paneli; mağaza başına Shopify
  uygulama bağlantısı; mağaza temasında çalışan yayınlama katmanı. Shopify
  yönetim ekranındaki olası giriş noktası da sahibin girişini gerektirecek.
- Sahip, ana panelden her mağazayı ayrı devre dışı bırakıp yeniden etkinleştirebilir.
- Depo: `/workspace/fukpages`; yerel geliştirme sürümü uygulanmıştır.
- Şifre korumalı owner paneli, müşteri/mağaza çalışma alanları, ayrıntılı blok
  editörü, cihaz stilleri, taslak kaydı ve yerel yayın kaldırma geliştirilmiştir.
  60 hazır bölüm düzeni, bağımsız/senkron bölüm kaydı ve Shopify tema sırasını okuyan
  bağlantı altyapısı eklendi. Canlı mağaza erişimi, gerçek tema HTML/CSS
  önizlemesi/yayınlama ve doğrulanmış GemPages özellik eşdeğerliği henüz
  mevcut değildir. Kullanım: `README.md`.

## Bölüm bazlı yeni çalışma akışı

Tema header/footer grupları ve sayfa şablonunun yerel bölümleri kaynaklarını
koruyarak listelenir. Özel FukPages bölümleri ayrı işaretlenir. "Tema düzenini
kullan" seçimiyle tema bölümlerinin konumu gösterilir ve özel header/footer
kopyaları aynı önizlemede tekrar gösterilmez. Tema bölümlerinin yerel görünümü
şimdilik yapısal yer tutucudur; gerçek Liquid render entegrasyonu gerekir.

Hazır bölümler tek tıkla veya sürükleyerek eklenir; alt öğeleri mevcut editörle
düzenlenir. Seçilen bölüm kaydedilip yeni kimliklerle başka tasarıma eklenebilir.
Kaydedilen bölüm kopyasını değiştirmek önceki tasarımları değiştirmez.

Shopify okumaları `read_themes` izni ve mağazaya bağlı güvenli erişim gerektirir.
Mevcut ilk bağlantı tek bir mağaza/anahtar çiftidir. Çoklu gerçek mağaza bağlantısı
için OAuth ve mağaza başına token/oturum saklama tamamlanmalıdır. Bölüm verisi
alma, mevcut tema dosyalarına yeni bölümler yayınlamakla aynı işlem değildir;
yayınlama için tema extension/template stratejisi ve gerekli yetkiler ayrıca
doğrulanmalıdır. Mevcut prototipte iki yönlü/otomatik canlı senkronizasyon yoktur.

## Tek sahip girişi ve merkezi mağaza yönetimi

Ana panelin giriş ekranında sahip kimliği ve şifre kullanılacak. Hesap ilk
kurulumda oluşturulacak; herkese açık hesap oluşturma akışı bulunmayacak.
Şifre güvenli bir hash olarak saklanacak. Üretimde HTTPS, HttpOnly/Secure oturum
cookie'si, CSRF koruması, oturum süresi ve başarısız giriş sınırı uygulanacak.
Çıkış ve şifre değişikliği oturumları geçersiz kılabilecek. İki adımlı doğrulama
isteğe bağlı sonraki geliştirmedir; başlangıçta zorunlu tutulmayacak.

Shopify mağaza bağlantısı ve panel sahibinin girişi ayrı yetki kontrolleridir.
Bir mağazaya uygulamanın kurulmuş olması panel erişimi sağlamaz. Yönetim
sayfaları ve API istekleri sunucuda sahip oturumunu doğrulayacak. Shopify callback
ve webhook uçları ise kendi Shopify imza/state doğrulamalarını kullanacak.
Mağaza bağlantı süreci yalnızca giriş yapmış sahip tarafından başlatılacak.

Ana panelde mağazalar müşteri adına göre gruplanabilecek. Her mağazada bağlantı
durumu, etkinlik durumu, sayfalar, son yayın ve işlem geçmişi görülecek. Shopify
erişim bilgileri yalnızca sunucuda tutulacak; tarayıcıya gönderilmeyecek veya
loglara yazılmayacak. Gerekli gizli değerler kurulum sırasında güvenli ayarlardan
alınacak; sohbet veya kaynak dosyalarına yazılmayacak.

### Devre dışı bırakma davranışı

Kullanıcı, mağaza devre dışı bırakıldığında uygulamayla yayınlanan sayfaların da
yayından kaldırılmasını seçti. Kabul edilen davranış:

- Devre dışı bırakma isteği yeni düzenleme/yayınları ve zamanlanmış işleri
  hemen engeller. Kontrol sunucuda ve iş yürütme anında da yapılır.
- Uygulamanın oluşturduğu bağımsız sayfalar, Shopify'ın desteklediği yöntemle
  yayından kaldırılır. Yeniden yayın için tasarım ve sürümler veritabanında korunur.
- Ana sayfa, ürün ve koleksiyon gibi mevcut Shopify kaynaklarında uygulamanın
  tasarımı geri çekilir ve kayıtlı önceki tema/template bağlantısı geri yüklenir.
  Shopify ürün veya koleksiyon kaydı silinmez.
- İlk yayından önce önceki template bağlantısı ve gerekli geri dönüş bilgisi
  saklanır. Başka uygulamaların veya mağaza sahibinin sonradan yaptığı değişiklik
  saptanırsa üzerine sessizce yazılmaz; çakışma panelde gösterilir.
- Her sayfa için sonuç izlenir. Mağaza durumu yayından kaldırma tamamlanana kadar
  `suspending`, bütün hedefler doğrulandığında `suspended` olur.
- Shopify erişimi veya bir işlem başarısızsa durum `suspension_failed` olur.
  Hangi sayfaların hâlâ yayında olduğu gösterilir; yönetim/yeni yayın kapalı kalır.
- Yeniden etkinleştirme, Shopify bağlantısı geçerliyse yönetimi açar. Sayfalar
  sahibin ayrı yeniden yayın işlemiyle geri döner.
- Uygulama kaldırılmışsa yeniden bağlantı gerekir; etkinleştirme bunu atlayamaz.
- İstek ve sayfa bazındaki sonuçlar işlem geçmişine kaydedilir.

Bu işlem yalnızca uygulamanın yönettiği yayınları kapsar. Yayından kaldırma
Shopify tarafında doğrulanacak; yalnızca panelde bir durum alanını değiştirmek
yeterli değildir. Başlatılan veya eski sıraya alınmış bir yayın işi, devre dışı
bırakma işlemiyle yarışıp sayfayı tekrar yayınlayamamalı.

## İlk ekranlar

1. Sahip girişi ve çıkış.
2. Müşteri/mağaza listesi, mağaza bağlama ve durum kontrolleri.
3. Mağaza ayrıntısı: sayfalar, şablonlar, yayın geçmişi.
4. Editör: bloklar, tasarım alanı, ayar paneli ve responsive önizleme.
5. Yayınlama ve önceki sürüme dönüş.

## Özellik eşdeğerliği nasıl ölçülecek?

GemPages'in güncel sürümündeki özellikler tek tek envantere alınacak. Her satırda
kaynak, beklenen davranış, bağımlılık, desteklenen sayfa türleri ve kabul testi
bulunacak. Aşağıdaki liste başlangıç kapsamıdır; tamamlanmış bir rakip ürün
incelemesi değildir. Özelliklerin tamamı doğrulanmadan eşdeğerlik iddia edilmeyecek.

| Alan                   | Başlangıç kapsamı                                                                      | Doğrulama örneği                                                    |
| ---------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Görsel editör          | İç içe bloklar, sürükle-bırak, katman ağacı, kopyalama, silme, geri al/ileri al        | Bir bloğu taşıyıp geri alınca tasarım aynı kalır                    |
| Responsive tasarım     | Masaüstü/tablet/mobil ayarlar, görünürlük, aralık, tipografi, grid/flex                | Mobilde verilen bir değer masaüstü tasarımını değiştirmez           |
| İçerik blokları        | Metin, görsel, video, buton, kolon, sekme, accordion, form, duyuru                     | Bloklar editörde ve yayınlanan sayfada aynı içeriği gösterir        |
| E-ticaret blokları     | Ürün, koleksiyon, varyant, fiyat, stok, sepete ekleme, ürün listesi, sticky cart       | Doğru varyant ve adet Shopify sepetine eklenir                      |
| Şablonlar              | Sayfa ve bölüm şablonları, kaydedilen bloklar, global bölümler                         | Kaydedilen bölüm başka sayfada tekrar kullanılabilir                |
| Yayınlama              | Taslak, önizleme, sürümler, yayınlama, geri alma                                       | Başarısız yayın aktif sürümü bozmaz                                 |
| SEO ve erişilebilirlik | Başlık/meta alanları, semantik HTML, alt metin, klavye kullanımı                       | Yayınlanan HTML gerekli içeriği ve başlıkları içerir                |
| Mağazalar              | Mağaza bazlı sayfalar ve medya, tasarım aktarımı, ürün eşleştirme                      | Bir mağazanın sayfası diğer mağazanın verisini okuyamaz             |
| Sahip paneli           | Şifre girişi, müşteri grupları, mağaza etkinleştirme/devre dışı bırakma, işlem geçmişi | Şifresiz API erişimi reddedilir; devre dışı mağazada yayın çalışmaz |
| Entegrasyonlar         | Yorum, e-posta, analitik ve diğer uygulamaların belgeli bağlantıları                   | Entegrasyon bir gerçek mağaza testinde çalışır                      |
| Optimizasyon           | A/B testleri, ziyaret/dönüşüm ölçümü, raporlar                                         | Atama tutarlı; siparişler çift sayılmaz                             |
| AI                     | Brief'ten taslak, metin/bölüm üretimi, onaylanabilir düzenlemeler                      | AI mevcut tasarımı sessizce yayınlamaz                              |

## Sayfa türleri ve yayınlama sınırları

| Sayfa türü                           | Tasarım yaklaşımı                           | Shopify üzerinde ayrıca doğrulanacak konu                       |
| ------------------------------------ | ------------------------------------------- | --------------------------------------------------------------- |
| Ana sayfa                            | Ortak editör + ana sayfa bağlamı            | Aktif temaya bağlama ve mevcut bölümlerle uyumluluk             |
| Ürün                                 | Ortak editör + ürün/varyant bağlamı         | Ürün template ataması, stok/fiyat/sepet davranışı               |
| Koleksiyon                           | Ortak editör + koleksiyon bağlamı           | Listeleme, filtre, sıralama, sayfalama                          |
| Landing page / standart sayfa        | Ortak editör + sayfa bağlamı                | Shopify sayfa adresi, SEO ve template bağlantısı                |
| Blog / makale                        | Ortak editör + blog/makale bağlamı          | Liste ve yazı adresleri, içerik bağlantısı                      |
| Sepet                                | Ortak editör + sepet bağlamı                | Tema cart drawer, miktar güncelleme, indirim ve checkout geçişi |
| Arama                                | Ortak editör + arama bağlamı                | Arama parametreleri, sonuçlar, sayfalama                        |
| Diğer tema sayfaları                 | Desteklenen bağlama göre                    | 404, parola ekranı ve ilgili tema template desteği              |
| Checkout / teşekkür / müşteri hesabı | Shopify'ın izin verdiği extension modelleri | Mağaza planı, extension hedefi, dağıtım ve platform izinleri    |

Checkout ve müşteri hesabı sayfaları serbest tema sayfaları gibi düzenlenebilir
varsayılmayacak. Desteklenen işlemler gerçek mağaza planı ve güncel Shopify
kurallarıyla doğrulanacak; desteklenmeyen işlemler ürün kapsamına vaat olarak
eklenmeyecek.

## Teknik temel

- İlk yerel sürüm: React, TypeScript, Vite, Express ve Node.js SQLite.
- Gerçek Shopify entegrasyonunda resmi React Router uygulama şablonu ve
  Shopify doğrulama kütüphaneleri temel alınacak.
- Merkezi panel için React; Shopify içinde açılan ekranlar
  gerekirse App Bridge ve Polaris bileşenlerini kullanır.
- Sahip girişi için sunucu tarafında şifre doğrulama ve oturum yönetimi.
- Shopify doğrulaması için resmi uygulama kütüphanesi; mağaza başına ayrı
  Shopify oturumu ve sahip oturumundan bağımsız yetki denetimi.
- Veri erişimi için Shopify GraphQL Admin API; API sürümü sabitlenecek.
- Kalıcı tasarım/sürüm verisi için Prisma ve PostgreSQL. İlk yerel deneyde resmi
  şablonun SQLite yapılandırması kullanılabilir; üretime geçiş ayrıca doğrulanır.
- Editör için blok ağacı ve dnd-kit sürükle-bırak altyapısı uygulandı. İlk yerel
  önizleme uygulama içi renderer kullanır; Shopify storefront yayını ve gerekli
  iframe izolasyonu entegrasyon aşamasında hazırlanacak.
- JSON sayfa şeması için doğrulama ve açık şema sürümü.
- Mağaza yayını için Liquid/HTML/CSS üreten renderer ve gerektiğinde küçük
  storefront JavaScript modülleri. Shopify ürün/fiyat/stok bilgileri sabit
  tasarım metni olarak kopyalanmayacak.
- Theme App Extension ile tema entegrasyonu araştırılacak. Tam template
  oluşturma veya değiştirme gerektiren yolların API yetkileri ve onay
  gereksinimleri ayrıca doğrulanacak; yalnızca extension eklemenin her sayfayı
  tamamen değiştirmeye yeteceği varsayılmayacak.

Mağazaya editörün tüm React uygulaması gönderilmeyecek. Ziyaretçi sayfası,
gerekli içeriği içeren HTML ve işlev için gerekli küçük scriptlerle çalışacak.
Dinamik ürün fiyatları ve stok Shopify kaynaklarıyla tutarlı kalacak.

## Temel veri modeli

- `OwnerAccount`: tek sahip kimliği ve güvenli şifre hash'i.
- `OwnerSession`: sahibin panel oturumu, bitiş ve iptal durumu.
- `Client`: mağazaların ait olduğu müşteri veya kullanıcının kendi grubu.
- `Shop`: müşteri, mağaza kimliği, Shopify bağlantı durumu ve ayrı yönetim
  durumu (`active` / `suspending` / `suspended` / `suspension_failed`).
- `ShopifySession`: resmi Shopify oturum saklama modeline göre.
- `AuditEvent`: mağaza durum değişikliği, yayın ve geri alma gibi işlemler.
- `Page`: mağaza, tür, adres/handle, bağlı Shopify kaynak kimliği.
- `PageRevision`: değiştirilemeyen JSON tasarım sürümü, şema sürümü.
- `Publication`: yayınlanan sürüm, hedef tema/template, önceki template bağlantısı,
  durum ve zaman; yayından kaldırma sonuçları.
- `ReusableSection`: mağaza bazlı kaydedilen veya global bölüm.
- `MediaAsset`: Shopify dosya kaynağı veya belgeli medya bağlantısı.
- `Experiment`: sonraki aşamada A/B varyantları ve atama kuralları.

Taslak ve yayınlanan sürüm ayrı tutulacak. Geri alma, daha önce doğrulanmış
bir yayın sürümünü tekrar etkinleştirecek. Aynı yayını tekrar çalıştırmak
çoğaltılmış sayfa/template üretmemeli. Mağazalar arası aktarımda ürün, koleksiyon,
medya ve URL bağlantıları hedef mağazaya eşlenecek.

## Uygulama sırası

### 0. Şifre korumalı ana panel

Önce tek sahip hesabı, giriş/çıkış, müşteri/mağaza veri modeli ve etkinlik kontrolü
hazırlanacak. Mağaza bağlantısı gerçek Shopify kurulumu tamamlanana kadar açıkça
bağlantısız gösterilecek; örnek veriler gerçek bağlantı gibi sunulmayacak.

Kabul koşulları: oturumsuz panel isteği girişe yönlenir; oturumsuz yönetim API
isteği reddedilir; yanlış şifre erişim sağlamaz; geçerli oturumla mağazalar
görülebilir; etkin olmayan mağazada yönetim/yayın API'si ve bekleyen işler
engellenir. Gerçek yayından kaldırma kontrolü Shopify bağlantısından sonra yapılır.

### 1. Shopify bağlantısı ve bir uçtan uca yayın

İlk teslim: bir geliştirme mağazasına kurulum; uygulamada bir sayfa tasarlama;
taslağı kaydetme; önizleme; mağaza üzerinde yayın; önceki sürüme dönüş.

İlk bloklar: section, kolon, başlık, metin, görsel, buton ve ürün/sepet bloğu.
Landing page ilk doğrulama hedefidir. Ortak şema baştan tüm sayfa türlerinin
bağlamını taşıyacak; diğer sayfaların yayın bağlantıları sırayla tamamlanacak.
Bu ilk teslim, tüm ürünün tamamlandığı anlamına gelmez.

Kabul koşulları:

1. Sahip paneline giriş yapılır ve gerçek Shopify bağlantısı doğrulanır.
2. Düzenlenen sayfa kaydedilip yeniden açıldığında aynı tasarım yüklenir.
3. Masaüstü ve mobil önizleme, yayınlanan sayfayla tutarlıdır.
4. Ürün bloğu gerçek ürünü gösterir ve seçilen varyantı sepete ekler.
5. Yayınlama ve geri alma geliştirme temasında çalışır.
6. Yayınlanan sayfa editör sunucusunun açık olmasına bağımlı değildir.
7. Mağaza devre dışı bırakıldığında yeni yayın engellenir; uygulamanın bağımsız
   sayfaları yayından kalkar ve mevcut Shopify sayfalarının önceki template
   bağlantıları geri yüklenir. Sonuç gerçek storefront adreslerinde doğrulanır.
8. Kısmi Shopify hatası, kalan yayınları ve başarısız durumu gösterir; yeniden
   deneme tamamlanmış işlemleri bozmaz. Bekleyen yayın işleri sayfaları açamaz.

### 2. Tüm sayfa türleri ve özellik eşdeğerliği

Ürün, koleksiyon, ana sayfa, blog/makale, sepet ve arama bağlantıları; daha geniş
blok kütüphanesi; şablonlar; global bölümler; SEO; uygulama entegrasyonları;
mağazalar arası aktarım ve yayın geçmişi tamamlanır. Her tür için gerçek Shopify
URL'sinde işlevsel kontrol gerekir; editör önizlemesi tek başına yeterli değildir.

### 3. Gelişmiş yetenekler

AI üretimi, dönüşüm ölçümü, A/B testleri, zamanlanmış yayın, mağazalar arası
toplu işlemler ve hız denetimleri. Bu yetenekler için ölçülebilir kabul koşulları
tanımlanacak. Rakipte zaten bulunan özellikler üstünlük olarak sunulmayacak.

## Gerçek Shopify bağlantısından önce gerekli bilgiler

Mağaza sayısı, mağazaların aynı Shopify Plus kuruluşunda olup olmadığı, kullanılan
temalar ve Shopify planları belirlenmeli. Müşterilerin birbirinden bağımsız
mağazaları da bağlanacağı için dağıtım modeli buna uygun seçilecek. Shopify'ın
güncel dağıtım kuralları doğrulanmadan tek bir özel dağıtımın bağımsız bütün
mağazalara kurulabileceği varsayılmayacak. Müşteriler gerekli Shopify kurulum
yetkisini sağlayacak; panel kullanıcısı yine yalnızca uygulamanın sahibi olacak.

Geliştirme mağazası ve Shopify geliştirici uygulaması üzerinden doğrulama gerekir.
Şifre veya erişim anahtarı sohbet içinde istenmeyecek; gerektiğinde güvenli
ortam ayarları kullanılacak. Canlı mağaza yayını, test temasındaki doğrulamadan
sonra kullanıcının açık talebiyle yapılacak.

## İncelenen resmi başlangıç kaynağı

[Shopify App Template — React Router](https://github.com/Shopify/shopify-app-template-react-router)
şablonunun README ve package.json dosyaları 12 Ekim 2026 tarihinde incelendi.
İncelenen şablon Node.js >=22.12 istiyor; ortamda Node.js 24.19.0 bulunuyor.
Bu inceleme Shopify uygulama temelini destekler; tüm yayınlama yollarının veya
GemPages özellik listesinin doğrulandığı anlamına gelmez.

shopify.dev ve Shopify App Store sayfalarına doğrudan erişim mevcut ağ politikası
nedeniyle başarısız oldu. Güncel yayınlama/dağıtım kuralları ve rakip özellik
envanteri uygulama aşamasında erişilebilir resmi kaynaklardan tamamlanmalı.
