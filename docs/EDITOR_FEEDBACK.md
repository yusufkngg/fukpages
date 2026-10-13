# Editör geri bildirimleri — 0.4.0

Bu sürüm ekran görüntülerinde bildirilen düzenleme sorunlarını ve ana sayfa,
ürün ve koleksiyon yönetimini kapsar. Katalog, atamalar, yayınlar ve sepet
demo verileriyle çalışır; Shopify bağlantısı bu aşamada yapılmaz.

| Bildirilen ihtiyaç | Sonuç ve kontrol |
| --- | --- |
| Bölüm kartı ile eklenen tasarım farklı | Kart gerçek renderer kullanır. Önizlenen bölüm ve seçilen ürün eklenip kaydedilir; bağlama korunur. |
| Görsel kopyala/yapıştır | Ctrl+C/V bağımsız kimliklerle öğe kopyalar. PNG panosu ve tarayıcıdan kopyalanmış görsel HTML'i yüklenir; metin alanlarında normal yapıştırma devam eder. |
| Düğme linki kayıtta dönüyor | Tek bağlantı hedefi; `www.example.com/buy` → `https://www.example.com/buy`. Kayıt/tekrar açma kontrol edildi. Geçersiz değer taslakta korunur ve hata gösterilir. |
| Düğme taşınamıyor ve boyutlandırılamıyor | `Serbest yerleştir` veya üst öğenin yerleşim modu. Gerçek sürükleme, ölçek, sınırlar, ok/Shift+ok hareketi ve kenardan genişlik/yükseklik değişimi kontrol edildi. |
| Mobil düzen bağımsız olmalı | Masaüstü serbest konum mobil akışı bozmaz. Mobil konum, akışa dönüş ve tekrar normal boyutlandırma masaüstü koordinatını değiştirmez. Tablet de ayrı ayarlanır. |
| Kolonlar görünmüyor | Yeni satır iki boş, görünür kolonla başlar; üçüncüsü eklenir. Ayırıcılarla oran değişir. |
| Paneller yoğun ve uzatılamıyor | Kısa araçlar, açık aralıklar; iki yan panel genişliği sürüklenip hatırlanır. Bölüm ayarları dikey uzatılır; gerçek pointer kontrolleri geçti. |
| Sağ tık menüsü kalıyor | Dışarı sol tık, Escape ve kaydırma kapatır; sol tık hedefi seçer. |
| Üç sayfa türü, genel liste ve geçiş | Ana sayfa/ürün/koleksiyon sekmeleri, arama, oluşturma, bağımsız taslak çoğaltma, atamalar/yayın durumu ve editörde sayfa geçişi. |
| Ürün/koleksiyon atama | Çoklu yerel hedef; ikinci şablona aynı hedef, yanlış mağaza/hedef ve eski sürüm reddedilir. Kopyanın yayını/atamaları boş kalır. |
| Yayındaki doğru ürün/koleksiyon | URL bağlamındaki hedef dinamik alanları doldurur. Ürün başlığı/sepet ve koleksiyon listesi tarayıcıda kontrol edildi. Sabit bağlanmış öğeler kendi hedefini korur. |
| SEO değişti ama görünmüyor | `Sayfa → SEO ve yayın` içindeki tek kaydet/yayınla düğmesi yeni adresi gösterir. Editör sekmesi, ilk HTML `<title>`, meta açıklaması ve ziyaretçi sekmesi kontrol edildi. |
| Kısa adres değişince demo bağlantısı bozuluyor | Atanmış `/p/demo/home` adresi yeni slug yayımlandıktan sonra da açılır. |
| Padding/margin için 10 çalışmıyor | Birimsiz uzunluk px olur. Çok karakterli yazma, bağlı dört kenar, rem birimi, mobil override ve kayıt/tekrar açma/yayın kontrol edildi. Eski belge de renderer'da düzeltilir; line-height, opacity, font-weight birimsiz kalır. |
| Kalite uyarıları | Linkler ve H1 sayısı kontrol edilir. Uyarı ilgili öğeyi seçip içerik ayarını açar. |

## Kanıt ve kapsam

- `npm test`: 47 test. Atama çakışması/rol/mağaza/sürüm sınırları, bağımsız
  kimlikler ve iç bağlantılar; katalog görsellerinin ilgili etkin yayınla
  sınırlanması, mağaza durunca yayının kapanması, birimsiz CSS uzunlukları.
- `npm run test:feedback`: gerçek Chromium/Netlify Function/resmi yerel Blobs;
  geçici şifre ve veri. Gerçek sahibin hesabı kullanılmaz.
- `npm run test:browser`: mevcut editör, medya/font, kritik akış, kurtarma,
  bölüm ve Netlify regresyonları; 720 bölüm/ekran kontrolü.
- `npm run test:responsive`: 13 genişlik, özel flex/grid ve marka container'ı.
- `npm run build:netlify`, `npm run test:netlify`, `npm run format:check`.

[Editörde serbest konum ve bölümler](screenshots/editor-free-placement.png) ·
[Ürün sayfaları listesi](screenshots/page-manager.png)

Dış URL görselleri izin verilen HTTPS kaynaklarından içe alınır; tarayıcı pano
izni ve Netlify medya boyutu sınırı geçerlidir. Shopify tema şablonuna gerçek
atama, ertelenen Shopify bağlantısını gerektirir.
