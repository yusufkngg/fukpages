# Özellik denetimi — FukPages 0.3

Kullanıcının özgün özellik listesi [REQUESTED_FEATURES.md](REQUESTED_FEATURES.md) içinde korunur. 155 madde için durum ve kanıt [requirements.json](requirements.json) içinde saklanır. Shopify bağlantısı bu aşamada yapılmaz; AI ve e-posta/CRM sağlayıcısı henüz seçilmedi.

## Doğrulama

- `npm test`: 42 test; HTTP/SQLite, gerçek medya/font dönüşümü, rol sınırları, form, SEO, sürüm/senkron bölüm, aktarım, A/B, taslak birleştirme ve Netlify sunucusuz kayıt/çakışma.
- `npm run build`: TypeScript ve Vite üretim derlemesi.
- `npm run test:browser`: gerçek Chromium; editör, ürün, medya, font, formlar, çeviri, klavye erişimi, kayıt kurtarma, çakışma, popup, bölüm düzen/kart/önizleme ve demo panel/mağaza akışları.
- 60 bölüm × 3 içerik durumu × 4 ekran genişliği = **720 bölüm kontrolü**. Taşma ve JavaScript hatası yok; bu sayı 720 ayrı özellik veya bütün etkileşimlerin testi değildir.
- `npm run test:netlify`: Netlify'ın resmi paketleyicisiyle Node 24 paketi; özel dosyaların hariç tutulması; resmi **yerel** Blobs sunucusunda şifreli giriş, kalıcı kayıt, görsel yükleme ve TTF→WOFF2 dönüşümü.
- 0.3.1 regresyonu: paket ve Netlify tarayıcı kontrolü `--no-experimental-require-module` modunda çalışır. İlk API hatası, yanıtsız istek zaman aşımı ve tekrar denemeyle toparlanma doğrulanır; sonsuz başlangıç ekranı kaldırılmıştır.
- `npm run test:network`: izin verilen GitHub görselini gerçek HTTPS/proxy üzerinden içe alma. Shopify/AI çağrısı yapmaz.
- `npm run format:check` ve `npm audit --omit=dev`.

Testler geçici şifre/veritabanı ve örnek veriler kullanır. Gerçek yönetici hesabı, mağaza veya sağlayıcı kullanılmaz. Netlify canlı deploy hesabı bu ortamda bağlı değildir; paket ve yerel sunucusuz test, canlı deploy doğrulaması yerine geçmez.

## Bu sürümdeki ek kabul kontrolleri

| İş akışı | Kanıt ve kapsam |
| --- | --- |
| Kayıp bağlantıdan sonra taslak kurtarma | Gerçek kayıt isteği kesilir; sayfa yeniden açıldığında yerel taslak geri alınır ve sunucuya kaydedilir. |
| İki sekmede kayıt çakışması | Eski sürüm 409 alır; yerel/sunucu farkları karşılaştırılır, alan seçimleri birleştirilip doğrulanır. Her iki JSON indirilebilir. |
| Popup klavye erişimi | Tab/Shift+Tab odak döngüsü, Escape ve önceki öğeye dönüş; ışık kutusu ve sepet de aynı native dialog bileşenini kullanır. |
| Bölüm düzeni değiştirme | Uyumlu düzen değişikliğinde içerik, öğe kimlikleri, bağlantılar, görünürlük korunur; ek içerik sessizce üretilmez. |
| Tekrarlanan kartlar | Metinleri değiştir, sırasını değiştir, çoğalt, kaldır; kopyalarda iç bağlantılar yeni kimliklere eşlenir. |
| Bölüm önizlemesi | Gerçek sayfa renderer'ı ile marka/font ve masaüstü/tablet/mobil görünümü; önizlemede eylemler çalıştırılmaz. |
| Netlify prototipi | Şifreli panel `/`, örnek mağaza `/p/demo/demo-store`; SQLite+medya koşullu Blobs kaydı; soğuk başlangıç, yarışan kayıt, kayıp upload cevabı, parola değişimi ve mağaza durdurma testleri. Canlı deploy bekliyor. |

## Durum sayıları

- Doğrulandı (yerel/test): 113
- Kodda uygulandı / incelendi: 23
- Shopify aşamasına ertelendi: 11
- Sağlayıcı/bağlantı gerekiyor: 5
- Kısmen doğrulandı veya sınırlı: 3

## Madde bazında kayıt

| ID | İstenen özellik / geçerli kapsam | Durum | Kanıt / sınır |
| --- | --- | --- | --- |
| F001 | Bilgisayardan yükleme · Dosya seçerek veya sürükleyerek | Doğrulandı (yerel/test) | server/studio.mjs; src/MediaPanel.tsx; src/Renderer.tsx; tests/studio.test.mjs; tests/browser_studio.py |
| F002 | Çoklu yükleme · Birden fazla görseli birlikte yükleme | Doğrulandı (yerel/test) | server/studio.mjs; src/MediaPanel.tsx; src/Renderer.tsx; tests/studio.test.mjs; tests/browser_studio.py |
| F003 | Tuvale görsel bırakma · Boş alana bırakınca görsel öğesi oluşturma | Doğrulandı (yerel/test) | tests/browser_critical.py; Chromium DataTransfer ile dosya bırakma, gerçek yükleme ve yeni görsel bloğunun kalıcı kaydı geçti. Fiziksel OS fare sürüklemesi ayrıca test edilmedi. |
| F004 | Görsel değiştirme · Mevcut görselin stilini koruyarak değiştirme | Doğrulandı (yerel/test) | server/studio.mjs; src/MediaPanel.tsx; src/Renderer.tsx; tests/studio.test.mjs; tests/browser_studio.py |
| F005 | Panodan yapıştırma · Kopyalanmış ekran görüntüsünü/görseli ekleme | Doğrulandı (yerel/test) | server/studio.mjs; src/MediaPanel.tsx; src/Renderer.tsx; tests/studio.test.mjs; tests/browser_studio.py |
| F006 | URL’den içe aktarma · Görseli kalıcı dosya olarak kaydetme | Doğrulandı (yerel/test) | server/studio.mjs; src/MediaPanel.tsx; src/Renderer.tsx; tests/studio.test.mjs; tests/browser_studio.py |
| F007 | Shopify medyası · Bağlantı kurulduğunda mağazanın görsellerinden seçme | Shopify aşamasına ertelendi | Kullanıcı 13 Ekim 2026: “şuanlık shopify bağlamadan yapacağız”. Canlı mağaza, gerçek tema HTML/Liquid, şablon atama, gerçek sepet/ödeme ve uzaktan yayın bu aşamada yapılmadı. |
| F008 | Kütüphane yönetimi · Arama, klasör/etiket, favori, yeniden adlandırma | Doğrulandı (yerel/test) | tests/browser_critical.py; Chromium: yeniden adlandırma, klasör, etiket, favori ve arama geçti. |
| F009 | Dosya bilgisi · Boyut, çözünürlük, format | Doğrulandı (yerel/test) | server/studio.mjs; src/MediaPanel.tsx; src/Renderer.tsx; tests/studio.test.mjs; tests/browser_studio.py |
| F010 | Kullanıldığı yerler · Görselin hangi sayfalarda kullanıldığını gösterme | Doğrulandı (yerel/test) | server/studio.mjs; src/MediaPanel.tsx; src/Renderer.tsx; tests/studio.test.mjs; tests/browser_studio.py |
| F011 | Silme kontrolü · Kullanılan görsel silinecekse etkilenen sayfaları gösterme | Doğrulandı (yerel/test) | server/studio.mjs; src/MediaPanel.tsx; src/Renderer.tsx; tests/studio.test.mjs; tests/browser_studio.py |
| F012 | Yükleme durumları · İlerleme, başarısızlık, yeniden deneme | Doğrulandı (yerel/test) | tests/browser_reliability.py; tests/studio.test.mjs: sunucuda tamamlanan yüklemenin cevabı kesildi; aynı dosya tekrarlandığında tek medya kaydı ve aynı asset ID korundu, yeniden başlatma da geçti. UI ilerleme/hata/yeniden deneme kontrol edildi. |
| F013 | Mağaza ayrımı · Her mağazanın dosyalarını ayrı tutma | Doğrulandı (yerel/test) | server/studio.mjs; src/MediaPanel.tsx; src/Renderer.tsx; tests/studio.test.mjs; tests/browser_studio.py |
| F014 | Kırpma, döndürme, yatay/dikey çevirme. | Doğrulandı (yerel/test) | server/studio.mjs; src/MediaPanel.tsx; src/Renderer.tsx; tests/studio.test.mjs; tests/browser_studio.py |
| F015 | En-boy oranı seçimi. | Doğrulandı (yerel/test) | tests/browser_critical.py; Gerçek Chromium birleşik içerik/düzenleme/yayın akışında kontrol edildi. |
| F016 | `Contain / cover` davranışı. | Doğrulandı (yerel/test) | tests/browser_critical.py; Gerçek Chromium birleşik içerik/düzenleme/yayın akışında kontrol edildi. |
| F017 | Odak noktası seçimi: kırpılırken yüzün veya ürünün korunması. | Doğrulandı (yerel/test) | tests/browser_critical.py; Gerçek Chromium birleşik içerik/düzenleme/yayın akışında kontrol edildi. |
| F018 | Mobil için farklı görsel. | Doğrulandı (yerel/test) | tests/browser_critical.py; Gerçek Chromium birleşik içerik/düzenleme/yayın akışında kontrol edildi. |
| F019 | Alternatif metin. | Doğrulandı (yerel/test) | server/studio.mjs; src/MediaPanel.tsx; src/Renderer.tsx; tests/studio.test.mjs; tests/browser_studio.py |
| F020 | Görsele bağlantı verme. | Kodda uygulandı / incelendi | Görsel bağlantısı güvenli URL ile render edilir; gerçek dış bağlantı açılması denenmedi. |
| F021 | Tıklayınca büyütme/lightbox. | Doğrulandı (yerel/test) | tests/browser_critical.py; Gerçek Chromium birleşik içerik/düzenleme/yayın akışında kontrol edildi. |
| F022 | Arka plan görseli ve renk katmanı. | Doğrulandı (yerel/test) | tests/browser_critical.py; Gerçek Chromium birleşik içerik/düzenleme/yayın akışında kontrol edildi. |
| F023 | Otomatik sıkıştırma ve uygun boyut üretimi. | Doğrulandı (yerel/test) | server/studio.mjs; src/MediaPanel.tsx; src/Renderer.tsx; tests/studio.test.mjs; tests/browser_studio.py |
| F024 | Ekran dışı görselleri geç yükleme. | Doğrulandı (yerel/test) | tests/browser_critical.py; 16000 px aşağıdaki görsel, kaydırma öncesi istek göndermez; kaydırınca gerçek dosyayı yükler. |
| F025 | PNG, JPEG, WebP, AVIF, GIF; SVG için doğrulama ve temizleme. | Doğrulandı (yerel/test) | server/studio.mjs; src/MediaPanel.tsx; src/Renderer.tsx; tests/studio.test.mjs; tests/browser_studio.py |
| F026 | Font yükleme · Öncelikle WOFF2 ve WOFF | Doğrulandı (yerel/test) | server/studio.mjs; src/BrandPanel.tsx; src/studio.tsx; src/NodeExtras.tsx; font dönüşüm ve Chromium kontrolleri |
| F027 | Ek formatlar · TTF/OTF içe aktarma ve uygun dönüşüm | Doğrulandı (yerel/test) | server/studio.mjs; src/BrandPanel.tsx; src/studio.tsx; src/NodeExtras.tsx; font dönüşüm ve Chromium kontrolleri |
| F028 | Font ailesi · Aynı fontun dosyalarını tek aile altında toplama | Doğrulandı (yerel/test) | server/studio.mjs; src/BrandPanel.tsx; src/studio.tsx; src/NodeExtras.tsx; font dönüşüm ve Chromium kontrolleri |
| F029 | Kalınlık eşleştirme · Regular 400, Medium 500, Bold 700 gibi | Doğrulandı (yerel/test) | tests/browser_critical.py; Regular 400 ve Bold 700 ayrı gerçek font dosyaları ile yüklenir; aktarımda iki yüz de korunur. |
| F030 | İtalik eşleştirme · Normal ve italik dosyalarını ayırma | Doğrulandı (yerel/test) | tests/browser_critical.py; Normal ve italic ayrı font dosyaları, metadata ve document.fonts üzerinden doğrulandı. |
| F031 | Değişken font · Desteklenen kalınlık aralığını kullanabilme | Doğrulandı (yerel/test) | server/studio.mjs; src/BrandPanel.tsx; src/studio.tsx; src/NodeExtras.tsx; font dönüşüm ve Chromium kontrolleri |
| F032 | Canlı önizleme · Örnek metni fontla gösterme | Doğrulandı (yerel/test) | server/studio.mjs; src/BrandPanel.tsx; src/studio.tsx; src/NodeExtras.tsx; font dönüşüm ve Chromium kontrolleri |
| F033 | Türkçe kontrolü · “İ ı Ş ş Ğ ğ Ç ç Ö ö Ü ü” önizlemesi | Doğrulandı (yerel/test) | server/studio.mjs; src/BrandPanel.tsx; src/studio.tsx; src/NodeExtras.tsx; font dönüşüm ve Chromium kontrolleri |
| F034 | Hazır font kataloğu · Aranabilir, önizlemeli font seçimi | Doğrulandı (yerel/test) | tests/browser_critical.py; Sistem fontları ve yüklenmiş ailelerin arama/önizleme kataloğu test edildi. Uzak Google Fonts kataloğu yok. |
| F035 | Yedek font · Font yüklenemezse kullanılacak aile | Doğrulandı (yerel/test) | server/studio.mjs; src/BrandPanel.tsx; src/studio.tsx; src/NodeExtras.tsx; font dönüşüm ve Chromium kontrolleri |
| F036 | Global atama · Başlık, gövde ve buton fontu seçme | Doğrulandı (yerel/test) | server/studio.mjs; src/BrandPanel.tsx; src/studio.tsx; src/NodeExtras.tsx; font dönüşüm ve Chromium kontrolleri |
| F037 | Kullanım bilgisi · Hangi sayfalarda kullanıldığını gösterme | Doğrulandı (yerel/test) | server/studio.mjs; src/BrandPanel.tsx; src/studio.tsx; src/NodeExtras.tsx; font dönüşüm ve Chromium kontrolleri |
| F038 | Performans · Yalnızca kullanılan aileleri ve kalınlıkları yükleme | Doğrulandı (yerel/test) | server/studio.mjs; src/BrandPanel.tsx; src/studio.tsx; src/NodeExtras.tsx; font dönüşüm ve Chromium kontrolleri |
| F039 | Ana renk, ikinci renk, vurgu rengi. | Doğrulandı (yerel/test) | server/studio.mjs cleanBrand; src/studio.tsx; src/BrandPanel.tsx; src/sections.ts |
| F040 | Metin, arka plan ve kenarlık renkleri. | Doğrulandı (yerel/test) | server/studio.mjs cleanBrand; src/studio.tsx; src/BrandPanel.tsx; src/sections.ts |
| F041 | H1–H6 başlık stilleri. | Doğrulandı (yerel/test) | tests/browser_critical.py; Gerçek Chromium birleşik içerik/düzenleme/yayın akışında kontrol edildi. |
| F042 | Gövde, küçük metin ve bağlantı stilleri. | Doğrulandı (yerel/test) | tests/browser_critical.py; Gerçek Chromium birleşik içerik/düzenleme/yayın akışında kontrol edildi. |
| F043 | Birincil, ikincil ve çerçeveli buton stilleri. | Doğrulandı (yerel/test) | tests/browser_critical.py; Birincil, ikincil ve çerçeveli stiller tarayıcıda ölçüldü; outline kenarlığı düzeltildi. |
| F044 | Varsayılan container genişliği. | Kodda uygulandı / incelendi | Global container max-width uygulanır. |
| F045 | Bölüm boşlukları. | Kodda uygulandı / incelendi | Hazır bölümlerde global bölüm boşluğu; mobil özel değerleri korunur. |
| F046 | Köşe yuvarlama ve gölge seçenekleri. | Kodda uygulandı / incelendi | Global köşe/gölge tokenları hazır bölümlerde uygulanır. |
| F047 | Masaüstü ve mobil tipografi ölçeği. | Doğrulandı (yerel/test) | tests/browser_critical.py; Gerçek Chromium birleşik içerik/düzenleme/yayın akışında kontrol edildi. |
| F048 | “Bu öğeyi global stilden ayır” seçeneği. | Doğrulandı (yerel/test) | server/studio.mjs cleanBrand; src/studio.tsx; src/BrandPanel.tsx; src/sections.ts |
| F049 | “Global stile geri dön” seçeneği. | Doğrulandı (yerel/test) | server/studio.mjs cleanBrand; src/studio.tsx; src/BrandPanel.tsx; src/sections.ts |
| F050 | Stil kopyala/yapıştır · Aynı görünümü hızlı uygulama | Doğrulandı (yerel/test) | tests/browser_critical.py; Gerçek Chromium birleşik içerik/düzenleme/yayın akışında kontrol edildi. |
| F051 | Sayfalar arası kopyalama · Tasarımları tekrar kullanma | Doğrulandı (yerel/test) | tests/browser_critical.py; Gerçek Chromium birleşik içerik/düzenleme/yayın akışında kontrol edildi. |
| F052 | Çoklu seçim · Birkaç öğeyi birlikte düzenleme | Doğrulandı (yerel/test) | src/Editor.tsx; src/editorCommands.ts; src/SelectionTools.tsx; src/WorkflowPanel.tsx; tests/editor-commands.test.ts |
| F053 | Gruplama ve grubu çözme · Karmaşık bölümleri yönetme | Doğrulandı (yerel/test) | src/Editor.tsx; src/editorCommands.ts; src/SelectionTools.tsx; src/WorkflowPanel.tsx; tests/editor-commands.test.ts |
| F054 | Öğeyi kilitleme · Yanlışlıkla taşıma ve silmeyi önleme | Doğrulandı (yerel/test) | src/Editor.tsx; src/editorCommands.ts; src/SelectionTools.tsx; src/WorkflowPanel.tsx; tests/editor-commands.test.ts |
| F055 | Katman adlandırma ve arama · Büyük sayfalarda gezinme | Doğrulandı (yerel/test) | tests/browser_critical.py; Gerçek Chromium birleşik içerik/düzenleme/yayın akışında kontrol edildi. |
| F056 | Üst öğeyi seçme · İç içe kutularda doğru öğeye ulaşma | Doğrulandı (yerel/test) | tests/browser_critical.py; Gerçek Chromium birleşik içerik/düzenleme/yayın akışında kontrol edildi. |
| F057 | Sağ tık menüsü · Hızlı işlemler | Doğrulandı (yerel/test) | tests/browser_critical.py; Gerçek Chromium birleşik içerik/düzenleme/yayın akışında kontrol edildi. |
| F058 | Klavye ile taşıma · Sürüklemeye alternatif erişim | Doğrulandı (yerel/test) | tests/browser_critical.py; Gerçek Chromium birleşik içerik/düzenleme/yayın akışında kontrol edildi. |
| F059 | Sütunları tutarak boyutlandırma · Daha hızlı yerleşim | Doğrulandı (yerel/test) | Gerçek Chromium pointer tutamacıyla kolon genişliği değişti; undo ile geri döndü. tests/browser_studio.py. |
| F060 | Mobil sıralama · Mobilde görsel ve metin sırasını değiştirme | Kodda uygulandı / incelendi | Cihaz bazlı order ve flex-direction stilleri incelendi. |
| F061 | Responsive değeri sıfırlama · Masaüstünden miras alınan değere dönme | Doğrulandı (yerel/test) | src/Editor.tsx; src/editorCommands.ts; src/SelectionTools.tsx; src/WorkflowPanel.tsx; tests/editor-commands.test.ts |
| F062 | Esnek önizleme genişliği · Sadece üç sabit cihazla sınırlı kalmama | Doğrulandı (yerel/test) | src/Editor.tsx; src/editorCommands.ts; src/SelectionTools.tsx; src/WorkflowPanel.tsx; tests/editor-commands.test.ts |
| F063 | Hover/focus durum düzenleme · Buton ve bağlantı durumları | Doğrulandı (yerel/test) | src/StateStyles.tsx; src/studio.tsx; tests/browser_reliability.py: gerçek ziyaretçi hover ve klavye focus renkleri uygulandı. |
| F064 | Kaydetme hatası bildirimi · Değişiklik kaybolmasını önleme | Doğrulandı (yerel/test) | src/Editor.tsx; src/editorCommands.ts; src/SelectionTools.tsx; src/WorkflowPanel.tsx; tests/editor-commands.test.ts |
| F065 | Kalıcı sürüm geçmişi · Önceki günün tasarımına dönebilme | Doğrulandı (yerel/test) | src/Editor.tsx; src/editorCommands.ts; src/SelectionTools.tsx; src/WorkflowPanel.tsx; tests/editor-commands.test.ts |
| F066 | Ürün bilgisi · Dinamik ürün adı, açıklaması, fiyatı, indirim fiyatı | Doğrulandı (yerel/test) | server/catalog.mjs; src/Commerce.tsx; src/AdvancedContent.tsx; yerel katalog ve Chromium testleri |
| F067 | Ürün görselleri · Küçük önizlemeli galeri, yakınlaştırma, varyant görseli | Doğrulandı (yerel/test) | server/catalog.mjs; src/Commerce.tsx; src/AdvancedContent.tsx; yerel katalog ve Chromium testleri |
| F068 | Varyant · Renk, beden, dropdown ve buton seçenekleri | Doğrulandı (yerel/test) | server/catalog.mjs; src/Commerce.tsx; src/AdvancedContent.tsx; yerel katalog ve Chromium testleri |
| F069 | Satın alma · Adet seçici, sepete ekle, sticky sepete ekle | Doğrulandı (yerel/test) | server/catalog.mjs; src/Commerce.tsx; src/AdvancedContent.tsx; yerel katalog ve Chromium testleri |
| F070 | Ürün durumu · Stokta yok, seçilemeyen varyant, stok bilgisi | Doğrulandı (yerel/test) | server/catalog.mjs; src/Commerce.tsx; src/AdvancedContent.tsx; yerel katalog ve Chromium testleri |
| F071 | Ürün listesi · Koleksiyondan ürün grid’i, ilgili ürünler | Doğrulandı (yerel/test) | server/catalog.mjs; src/Commerce.tsx; src/AdvancedContent.tsx; yerel katalog ve Chromium testleri |
| F072 | Koleksiyon · Başlık, açıklama, görsel, sıralama, sayfalama | Doğrulandı (yerel/test) | server/catalog.mjs; src/Commerce.tsx; src/AdvancedContent.tsx; yerel katalog ve Chromium testleri |
| F073 | İçerik · Tabs, carousel, görsel galeri, kayan logo şeridi | Doğrulandı (yerel/test) | server/catalog.mjs; src/Commerce.tsx; src/AdvancedContent.tsx; yerel katalog ve Chromium testleri |
| F074 | Güven · Yorum özeti, yıldız puanı, yorum uygulaması alanı | Kısmen doğrulandı veya sınırlı | Düzenlenebilir puan/yorum sayısı ve hazır yorum bölümleri var. Gerçek yorum uygulaması bağlantısı yok. |
| F075 | Karşılaştırma · Karşılaştırma tablosu, önce/sonra görseli | Doğrulandı (yerel/test) | server/catalog.mjs; src/Commerce.tsx; src/AdvancedContent.tsx; yerel katalog ve Chromium testleri |
| F076 | Kampanya · Kupon kopyalama, teslimat bilgisi, kargo eşiği | Kodda uygulandı / incelendi | Kupon kopyalama, teslimat metni ve yerel sepet kargo eşiği uygulanır; tüm aksiyonlar ayrı tarayıcı testine alınmadı. |
| F077 | Etkileşim · Popup, video popup, yukarı dön | Doğrulandı (yerel/test) | server/catalog.mjs; src/Commerce.tsx; src/AdvancedContent.tsx; yerel katalog ve Chromium testleri |
| F078 | Navigasyon · Breadcrumb, mobil menü, bölüm bağlantıları | Doğrulandı (yerel/test) | tests/browser_critical.py; Gerçek Chromium birleşik içerik/düzenleme/yayın akışında kontrol edildi. |
| F079 | Blog · Yazı listesi, yazar, tarih, özet ve içerik | Doğrulandı (yerel/test) | tests/browser_critical.py; Gerçek Chromium birleşik içerik/düzenleme/yayın akışında kontrol edildi. |
| F080 | Entegrasyon · Uygulama bileşeni, kontrollü özel kod alanı | Sağlayıcı/bağlantı gerekiyor | Kontrollü HTML ve uygulama yer tutucusu var. Belirli üçüncü taraf uygulamanın SDK bileşeni henüz bağlanmadı. |
| F081 | E-posta, telefon, metin ve uzun metin. | Doğrulandı (yerel/test) | server/studio.mjs form endpoints; src/AdvancedContent.tsx FormContent; server/growth.mjs webhook queue; tests/studio.test.mjs |
| F082 | Dropdown, checkbox, radio. | Doğrulandı (yerel/test) | server/studio.mjs form endpoints; src/AdvancedContent.tsx FormContent; server/growth.mjs webhook queue; tests/studio.test.mjs |
| F083 | Zorunlu alan ve doğrulama. | Doğrulandı (yerel/test) | server/studio.mjs form endpoints; src/AdvancedContent.tsx FormContent; server/growth.mjs webhook queue; tests/studio.test.mjs |
| F084 | Alan etiketi, açıklaması ve hata mesajı. | Doğrulandı (yerel/test) | tests/browser_critical.py; Gerçek Chromium birleşik içerik/düzenleme/yayın akışında kontrol edildi. |
| F085 | Gönderiliyor, başarılı ve başarısız durumları. | Doğrulandı (yerel/test) | server/studio.mjs form endpoints; src/AdvancedContent.tsx FormContent; server/growth.mjs webhook queue; tests/studio.test.mjs |
| F086 | Başarılı gönderim sonrası yönlendirme. | Doğrulandı (yerel/test) | tests/browser_critical.py; Gerçek Chromium birleşik içerik/düzenleme/yayın akışında kontrol edildi. |
| F087 | Spam koruması. | Doğrulandı (yerel/test) | server/studio.mjs form endpoints; src/AdvancedContent.tsx FormContent; server/growth.mjs webhook queue; tests/studio.test.mjs |
| F088 | Gönderim kayıtları. | Doğrulandı (yerel/test) | server/studio.mjs form endpoints; src/AdvancedContent.tsx FormContent; server/growth.mjs webhook queue; tests/studio.test.mjs |
| F089 | E-posta/CRM/webhook hedefi. | Sağlayıcı/bağlantı gerekiyor | Yerel form kayıtları çalışır. Opt-in HTTPS webhook kuyruğu, tekrar deneme ve idempotency test transportuyla doğrulandı; canlı e-posta/CRM sağlayıcısı seçilmedi. |
| F090 | Newsletter için pazarlama izni alanı. | Doğrulandı (yerel/test) | server/studio.mjs form endpoints; src/AdvancedContent.tsx FormContent; server/growth.mjs webhook queue; tests/studio.test.mjs |
| F091 | Tekrar gönderimi önleme. | Doğrulandı (yerel/test) | server/studio.mjs form endpoints; src/AdvancedContent.tsx FormContent; server/growth.mjs webhook queue; tests/studio.test.mjs |
| F092 | Sayfaya git. | Kodda uygulandı / incelendi | src/AdvancedContent.tsx performAction; src/NodeExtras.tsx; src/Renderer.tsx; kod incelendi, dış uygulama/telefon/e-posta açılması canlı denenmedi. |
| F093 | Ürüne veya koleksiyona git. | Kısmen doğrulandı veya sınırlı | URL ile ürün/koleksiyon sayfasına gitme aksiyonu var; Shopify canlı ürün/koleksiyon URL çözümlemesi ertelendi. |
| F094 | Sayfadaki bölüme kaydır. | Doğrulandı (yerel/test) | tests/browser_critical.py; Gerçek Chromium birleşik içerik/düzenleme/yayın akışında kontrol edildi. |
| F095 | Popup aç/kapat. | Kodda uygulandı / incelendi | src/AdvancedContent.tsx performAction; src/NodeExtras.tsx; src/Renderer.tsx; kod incelendi, dış uygulama/telefon/e-posta açılması canlı denenmedi. |
| F096 | Sepete ekle. | Kodda uygulandı / incelendi | src/AdvancedContent.tsx performAction; src/NodeExtras.tsx; src/Renderer.tsx; kod incelendi, dış uygulama/telefon/e-posta açılması canlı denenmedi. |
| F097 | Sepeti aç. | Kodda uygulandı / incelendi | src/AdvancedContent.tsx performAction; src/NodeExtras.tsx; src/Renderer.tsx; kod incelendi, dış uygulama/telefon/e-posta açılması canlı denenmedi. |
| F098 | Form gönder. | Doğrulandı (yerel/test) | tests/browser_critical.py; Gerçek Chromium birleşik içerik/düzenleme/yayın akışında kontrol edildi. |
| F099 | Kupon kodunu kopyala. | Doğrulandı (yerel/test) | tests/browser_critical.py; Gerçek Chromium birleşik içerik/düzenleme/yayın akışında kontrol edildi. |
| F100 | Telefon, e-posta veya WhatsApp bağlantısı aç. | Kodda uygulandı / incelendi | src/AdvancedContent.tsx performAction; src/NodeExtras.tsx; src/Renderer.tsx; kod incelendi, dış uygulama/telefon/e-posta açılması canlı denenmedi. |
| F101 | Yerel katalogla ürün satın alma bölümü · Galeri solda, sağda, kompakt | Doğrulandı (yerel/test) | Yerel ürün/varyant/stok/sepet Chromium kontrolleri geçti. Gerçek Shopify siparişi veya ödeme yok; kullanıcının kararıyla ertelendi. |
| F102 | Ürün kullanım adımları · Üç adım, görselli adımlar | Kodda uygulandı / incelendi | src/sections.ts; src/SectionLibrary.tsx; tests/editor-commands.test.ts; Chromium 60 düzen; senkron bölüm HTTP/SQLite testi |
| F103 | Karşılaştırma · İki ürün, özellik tablosu | Kodda uygulandı / incelendi | src/sections.ts; src/SectionLibrary.tsx; tests/editor-commands.test.ts; Chromium 60 düzen; senkron bölüm HTTP/SQLite testi |
| F104 | Önce/sonra · Kaydırılabilir karşılaştırma | Doğrulandı (yerel/test) | src/sections.ts; src/SectionLibrary.tsx; tests/editor-commands.test.ts; Chromium 60 düzen; senkron bölüm HTTP/SQLite testi |
| F105 | UGC/video · Video grid’i, tek büyük video | Kodda uygulandı / incelendi | src/sections.ts; src/SectionLibrary.tsx; tests/editor-commands.test.ts; Chromium 60 düzen; senkron bölüm HTTP/SQLite testi |
| F106 | Paket teklif · İkili/üçlü ürün paketi | Kodda uygulandı / incelendi | src/sections.ts; src/SectionLibrary.tsx; tests/editor-commands.test.ts; Chromium 60 düzen; senkron bölüm HTTP/SQLite testi |
| F107 | Teknik özellikler · Tablo, ikonlu özellik listesi | Kodda uygulandı / incelendi | src/sections.ts; src/SectionLibrary.tsx; tests/editor-commands.test.ts; Chromium 60 düzen; senkron bölüm HTTP/SQLite testi |
| F108 | Beden tablosu · Açılır pencere, tablo | Doğrulandı (yerel/test) | src/sections.ts; src/SectionLibrary.tsx; tests/editor-commands.test.ts; Chromium 60 düzen; senkron bölüm HTTP/SQLite testi |
| F109 | Teslimat ve iade · İkonlu bant, detaylı açıklama | Kodda uygulandı / incelendi | src/sections.ts; src/SectionLibrary.tsx; tests/editor-commands.test.ts; Chromium 60 düzen; senkron bölüm HTTP/SQLite testi |
| F110 | Marka/logolar · Sabit sıra, kayan şerit | Kodda uygulandı / incelendi | src/sections.ts; src/SectionLibrary.tsx; tests/editor-commands.test.ts; Chromium 60 düzen; senkron bölüm HTTP/SQLite testi |
| F111 | İlgili ürünler · Grid, carousel | Kodda uygulandı / incelendi | src/sections.ts; src/SectionLibrary.tsx; tests/editor-commands.test.ts; Chromium 60 düzen; senkron bölüm HTTP/SQLite testi |
| F112 | E-posta toplama popup’ı · Görselli, minimal | Kodda uygulandı / incelendi | src/sections.ts; src/SectionLibrary.tsx; tests/editor-commands.test.ts; Chromium 60 düzen; senkron bölüm HTTP/SQLite testi |
| F113 | Sticky satın alma · Mobil ve masaüstü | Kodda uygulandı / incelendi | src/sections.ts; src/SectionLibrary.tsx; tests/editor-commands.test.ts; Chromium 60 düzen; senkron bölüm HTTP/SQLite testi |
| F114 | Blog seçkisi · Üç kart, editoryal yerleşim | Kodda uygulandı / incelendi | src/sections.ts; src/SectionLibrary.tsx; tests/editor-commands.test.ts; Chromium 60 düzen; senkron bölüm HTTP/SQLite testi |
| F115 | **Kayıtlı kopya:** Her sayfada bağımsız düzenlenir. | Doğrulandı (yerel/test) | src/sections.ts; src/SectionLibrary.tsx; tests/editor-commands.test.ts; Chromium 60 düzen; senkron bölüm HTTP/SQLite testi |
| F116 | **Senkron section:** Bir değişiklik, bağlı tüm sayfalara uygulanır. | Doğrulandı (yerel/test) | server/studio.mjs; tests/studio.test.mjs: senkron bölüm değişikliği bağlı taslaklara sürümlü kaydedilir. Canlı yayın değişmez; yeniden yayın gerekir. Bağımsız bölüm kopyası önceki sayfaları değiştirmez. |
| F117 | Mağaza başına bağlantı ve bağlantı durumu. | Shopify aşamasına ertelendi | Kullanıcı 13 Ekim 2026: “şuanlık shopify bağlamadan yapacağız”. Canlı mağaza, gerçek tema HTML/Liquid, şablon atama, gerçek sepet/ödeme ve uzaktan yayın bu aşamada yapılmadı. |
| F118 | Canlı ürün/koleksiyon seçicisi. | Shopify aşamasına ertelendi | Kullanıcı 13 Ekim 2026: “şuanlık shopify bağlamadan yapacağız”. Canlı mağaza, gerçek tema HTML/Liquid, şablon atama, gerçek sepet/ödeme ve uzaktan yayın bu aşamada yapılmadı. |
| F119 | Dinamik alan bağlama. | Shopify aşamasına ertelendi | Kullanıcı 13 Ekim 2026: “şuanlık shopify bağlamadan yapacağız”. Canlı mağaza, gerçek tema HTML/Liquid, şablon atama, gerçek sepet/ödeme ve uzaktan yayın bu aşamada yapılmadı. |
| F120 | Metafield desteği. | Shopify aşamasına ertelendi | Kullanıcı 13 Ekim 2026: “şuanlık shopify bağlamadan yapacağız”. Canlı mağaza, gerçek tema HTML/Liquid, şablon atama, gerçek sepet/ödeme ve uzaktan yayın bu aşamada yapılmadı. |
| F121 | Varyant–fiyat–görsel–stok senkronizasyonu. | Shopify aşamasına ertelendi | Kullanıcı 13 Ekim 2026: “şuanlık shopify bağlamadan yapacağız”. Canlı mağaza, gerçek tema HTML/Liquid, şablon atama, gerçek sepet/ödeme ve uzaktan yayın bu aşamada yapılmadı. |
| F122 | Gerçek sepete ekleme ve hata yönetimi. | Shopify aşamasına ertelendi | Kullanıcı 13 Ekim 2026: “şuanlık shopify bağlamadan yapacağız”. Canlı mağaza, gerçek tema HTML/Liquid, şablon atama, gerçek sepet/ödeme ve uzaktan yayın bu aşamada yapılmadı. |
| F123 | Shopify’a yayınlama/yayından kaldırma. | Shopify aşamasına ertelendi | Kullanıcı 13 Ekim 2026: “şuanlık shopify bağlamadan yapacağız”. Canlı mağaza, gerçek tema HTML/Liquid, şablon atama, gerçek sepet/ödeme ve uzaktan yayın bu aşamada yapılmadı. |
| F124 | Ürünlere ve koleksiyonlara şablon atama. | Shopify aşamasına ertelendi | Kullanıcı 13 Ekim 2026: “şuanlık shopify bağlamadan yapacağız”. Canlı mağaza, gerçek tema HTML/Liquid, şablon atama, gerçek sepet/ödeme ve uzaktan yayın bu aşamada yapılmadı. |
| F125 | Mevcut temayla gerçek önizleme. | Shopify aşamasına ertelendi | Kullanıcı 13 Ekim 2026: “şuanlık shopify bağlamadan yapacağız”. Canlı mağaza, gerçek tema HTML/Liquid, şablon atama, gerçek sepet/ödeme ve uzaktan yayın bu aşamada yapılmadı. |
| F126 | Tema değişikliği algılama. | Shopify aşamasına ertelendi | Kullanıcı 13 Ekim 2026: “şuanlık shopify bağlamadan yapacağız”. Canlı mağaza, gerçek tema HTML/Liquid, şablon atama, gerçek sepet/ödeme ve uzaktan yayın bu aşamada yapılmadı. |
| F127 | Yayınlanan sürümün kaydı. | Doğrulandı (yerel/test) | Yerel yayın geçmişi/geri dönüş/devre dışı bırakma test edildi. Shopify üzerindeki karşılığı ertelendi. |
| F128 | Önceki başarılı yayına dönüş. | Doğrulandı (yerel/test) | Yerel yayın geçmişi/geri dönüş/devre dışı bırakma test edildi. Shopify üzerindeki karşılığı ertelendi. |
| F129 | Bağlantı koptuğunda ve mağaza devre dışı bırakıldığında açık davranış. | Doğrulandı (yerel/test) | Yerel yayın geçmişi/geri dönüş/devre dışı bırakma test edildi. Shopify üzerindeki karşılığı ertelendi. |
| F130 | Sayfa URL’si ve SEO başlığı. | Doğrulandı (yerel/test) | server/seo.mjs; server/studio.mjs; src/WorkflowPanel.tsx; tests/studio.test.mjs |
| F131 | Meta açıklama ve sosyal paylaşım görseli. | Doğrulandı (yerel/test) | server/seo.mjs; server/studio.mjs; src/WorkflowPanel.tsx; tests/studio.test.mjs |
| F132 | İndeksleme ayarı. | Doğrulandı (yerel/test) | server/seo.mjs; server/studio.mjs; src/WorkflowPanel.tsx; tests/studio.test.mjs |
| F133 | Taslak–canlı sürüm ayrımı. | Doğrulandı (yerel/test) | server/seo.mjs; server/studio.mjs; src/WorkflowPanel.tsx; tests/studio.test.mjs |
| F134 | Paylaşılabilir önizleme bağlantısı. | Doğrulandı (yerel/test) | server/seo.mjs; server/studio.mjs; src/WorkflowPanel.tsx; tests/studio.test.mjs |
| F135 | Zamanlanmış yayın ve yayından kaldırma. | Doğrulandı (yerel/test) | server/seo.mjs; server/studio.mjs; src/WorkflowPanel.tsx; tests/studio.test.mjs |
| F136 | Boş bağlantı ve eksik görsel kontrolü. | Doğrulandı (yerel/test) | server/seo.mjs; server/studio.mjs; src/WorkflowPanel.tsx; tests/studio.test.mjs |
| F137 | Eksik ürün bağlantısı kontrolü. | Doğrulandı (yerel/test) | server/seo.mjs; server/studio.mjs; src/WorkflowPanel.tsx; tests/studio.test.mjs |
| F138 | Mobil yatay taşma kontrolü. | Kodda uygulandı / incelendi | server/seo.mjs; server/studio.mjs; src/WorkflowPanel.tsx; tests/studio.test.mjs |
| F139 | Görsellerin sayfa hızına etkisini gösterme. | Doğrulandı (yerel/test) | Dosya byte yükü, native Resource Timing süre/transfer/önbellek bilgileri, varyantlar ve lazy loading vardır; gerçek Chromium panel kontrolü geçti. Lighthouse/Core Web Vitals puanı değildir. |
| F140 | Başlık hiyerarşisi ve alternatif metin uyarıları. | Doğrulandı (yerel/test) | server/seo.mjs; server/studio.mjs; src/WorkflowPanel.tsx; tests/studio.test.mjs |
| F141 | Yayınlama hatasının anlaşılır açıklaması. | Doğrulandı (yerel/test) | server/seo.mjs; server/studio.mjs; src/WorkflowPanel.tsx; tests/studio.test.mjs |
| F142 | Gerçek sayfada temel tıklama ve sepete ekleme ölçümü. | Doğrulandı (yerel/test) | server/seo.mjs; server/studio.mjs; src/WorkflowPanel.tsx; tests/studio.test.mjs |
| F143 | Yorum, e-posta pazarlama ve abonelik uygulaması entegrasyonları. | Sağlayıcı/bağlantı gerekiyor | Yorum, pazarlama ve abonelik uygulaması sağlayıcıları seçilmedi; özel SDK bağlayıcıları ve gerçek abonelik işlemleri tamamlanmadı. |
| F144 | Çok dil ve çeviri yönetimi. | Doğrulandı (yerel/test) | src/GrowthPanel.tsx; server/growth.mjs; src/TransferPanel.tsx; server/team.mjs; tests/studio.test.mjs |
| F145 | Yerel sepet için bundle ve adet bazlı teklifler | Doğrulandı (yerel/test) | src/Commerce.tsx; tests/browser_studio.py; tests/studio.test.mjs: yerel paket/adet fiyat ve stok hesabı. Shopify ödeme, gerçek indirim ve sipariş henüz yok. |
| F146 | AI ile section/sayfa üretimi. | Sağlayıcı/bağlantı gerekiyor | OpenAI JSON/vision tasarım adaptörü ve editör akışı var. Geçerli/geçersiz sonuçlar test transportuyla doğrulandı. Canlı sağlayıcı/anahtar bulunmadığı için gerçek AI üretimi doğrulanmadı. |
| F147 | Görselden düzenlenebilir tasarım. | Sağlayıcı/bağlantı gerekiyor | OpenAI JSON/vision tasarım adaptörü ve editör akışı var. Geçerli/geçersiz sonuçlar test transportuyla doğrulandı. Canlı sağlayıcı/anahtar bulunmadığı için gerçek AI üretimi doğrulanmadı. |
| F148 | A/B testleri. | Doğrulandı (yerel/test) | server/metrics.mjs; src/ExperimentResults.tsx; tests/studio.test.mjs; tests/browser_critical.py: ziyaretçi bazlı kalıcı atama, olay ID dedup, tekil sepete ekleme dönüşümü, A/B sonuçları, oran ve %95 Wilson aralığı. Ölçüt yerel sepete eklemedir; satın alma ve otomatik kazanan iddiası yok. |
| F149 | Satış hunileri ve satın alma sonrası teklifler. | Kısmen doğrulandı veya sınırlı | 2–10 adımlı yerel sayfa hunisi ve sonraki adım çalışır. Shopify ödeme/satın alma sonrası teklifleri ertelendi. |
| F150 | Ajans rolleri ve müşteri önizleme/onay akışı. | Doğrulandı (yerel/test) | src/GrowthPanel.tsx; server/growth.mjs; src/TransferPanel.tsx; server/team.mjs; tests/studio.test.mjs |
| F151 | Mağazalar arası şablon aktarımında ürün ve medya eşleştirme. | Doğrulandı (yerel/test) | tests/studio.test.mjs; tests/browser_critical.py: ürün/medya eşleştirme, kaynaktan kalıtılan marka stilleri ve tüm kullanılan font yüzleri korunarak aktarım; hedef marka değişmez. Hedef markayı kullanma ayrıca seçilebilir. |
| F152 | Medya yüklemesi yeniden açma, farklı ziyaretçi oturumu ve yerel yayında kalıcı olmalı. | Doğrulandı (yerel/test) | tests/studio.test.mjs; tests/browser_studio.py |
| F153 | Özel font editörde, önizlemede ve yerel yayında aynı dosyadan yüklenmeli. | Doğrulandı (yerel/test) | tests/browser_studio.py; src/studio.tsx |
| F154 | 25–30 bölüm ailesi ve 50–60 düzen hedefi. | Doğrulandı (yerel/test) | tests/browser_sections_quality.py: 60 düzen × 3 içerik durumu (normal/uzun Türkçe + ek kart/eksik görsel + alternatif font) × 4 genişlik (1440/820/390/320) = 720 kontrol; yatay taşma ve pageerror yok. Bu test bütün etkileşimler için ayrı test iddiası değildir. |
| F155 | Yeni bölümler marka renk/fontlarını kullanmalı ve mobil düzen içermeli. | Doğrulandı (yerel/test) | tests/browser_sections_quality.py: 60 düzen × 3 içerik durumu (normal/uzun Türkçe + ek kart/eksik görsel + alternatif font) × 4 genişlik (1440/820/390/320) = 720 kontrol; yatay taşma ve pageerror yok. Bu test bütün etkileşimler için ayrı test iddiası değildir. |
