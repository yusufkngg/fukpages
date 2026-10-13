# İstenen özelliklerin kaynak kapsamı

Bu metin kullanıcının yüklediği kapsamın tamamıdır. Durum ve doğrulama kaydı `FEATURE_AUDIT.md` içinde tutulur.

**Evet, font yükleme ve görsel yükleme kesinlikle olmalı.** Paylaştığın listeye göre temel editörünüz oluşmuş; şimdi eksik olan taraflar **medya yönetimi, marka sistemi, gerçek satış bileşenleri ve Shopify’da güvenilir yayınlama.**

Değerlendirmeyi verdiğin özellik listesine göre yapıyorum; listede belirtilmeyen özellikleri “eklenmeli veya doğrulanmalı” olarak ele aldım. Aşağıdaki kapsam, GemPages’in belgelenmiş özellikleriyle birlikte sizin ürününüz için önerdiğim geliştirmeleri içeriyor; birebir özellik eşitliği denetimi değil.

**1. Görsel yükleme ve medya kütüphanesi — ilk yapılacaklardan**

Yalnızca görsel URL’si yapıştırmak yeterli olmaz. Editörün içinde bir **Medya Kütüphanesi** bulunmalı.

| Özellik               | Nasıl çalışmalı?                                           |
| --------------------- | ---------------------------------------------------------- |
| Bilgisayardan yükleme | Dosya seçerek veya sürükleyerek                            |
| Çoklu yükleme         | Birden fazla görseli birlikte yükleme                      |
| Tuvale görsel bırakma | Boş alana bırakınca görsel öğesi oluşturma                 |
| Görsel değiştirme     | Mevcut görselin stilini koruyarak değiştirme               |
| Panodan yapıştırma    | Kopyalanmış ekran görüntüsünü/görseli ekleme               |
| URL’den içe aktarma   | Görseli kalıcı dosya olarak kaydetme                       |
| Shopify medyası       | Bağlantı kurulduğunda mağazanın görsellerinden seçme       |
| Kütüphane yönetimi    | Arama, klasör/etiket, favori, yeniden adlandırma           |
| Dosya bilgisi         | Boyut, çözünürlük, format                                  |
| Kullanıldığı yerler   | Görselin hangi sayfalarda kullanıldığını gösterme          |
| Silme kontrolü        | Kullanılan görsel silinecekse etkilenen sayfaları gösterme |
| Yükleme durumları     | İlerleme, başarısızlık, yeniden deneme                     |
| Mağaza ayrımı         | Her mağazanın dosyalarını ayrı tutma                       |

**Görsel düzenleme kontrolleri:**

- Kırpma, döndürme, yatay/dikey çevirme.
- En-boy oranı seçimi.
- `Contain / cover` davranışı.
- Odak noktası seçimi: kırpılırken yüzün veya ürünün korunması.
- Mobil için farklı görsel.
- Alternatif metin.
- Görsele bağlantı verme.
- Tıklayınca büyütme/lightbox.
- Arka plan görseli ve renk katmanı.
- Otomatik sıkıştırma ve uygun boyut üretimi.
- Ekran dışı görselleri geç yükleme.
- PNG, JPEG, WebP, AVIF, GIF; SVG için doğrulama ve temizleme.

**Tamamlanma ölçütü:** Görsel yüklendikten sonra sayfa yeniden açıldığında, başka cihazda ve yayınlanan sayfada görünmeye devam etmeli.

**2. Özel font yükleme — mutlaka**

GemPages’in özel font ekleme için ayrı bir yardım akışı bulunuyor. Sizin üründe bunu doğrudan marka ayarlarının parçası yapmanızı öneririm. [Help Center](https://help.gempages.net/articles/can-i-upload-my-own-font?utm_source=chatgpt.com)

| Özellik             | Önerilen davranış                                    |
| ------------------- | ---------------------------------------------------- |
| Font yükleme        | Öncelikle WOFF2 ve WOFF                              |
| Ek formatlar        | TTF/OTF içe aktarma ve uygun dönüşüm                 |
| Font ailesi         | Aynı fontun dosyalarını tek aile altında toplama     |
| Kalınlık eşleştirme | Regular 400, Medium 500, Bold 700 gibi               |
| İtalik eşleştirme   | Normal ve italik dosyalarını ayırma                  |
| Değişken font       | Desteklenen kalınlık aralığını kullanabilme          |
| Canlı önizleme      | Örnek metni fontla gösterme                          |
| Türkçe kontrolü     | “İ ı Ş ş Ğ ğ Ç ç Ö ö Ü ü” önizlemesi                 |
| Hazır font kataloğu | Aranabilir, önizlemeli font seçimi                   |
| Yedek font          | Font yüklenemezse kullanılacak aile                  |
| Global atama        | Başlık, gövde ve buton fontu seçme                   |
| Kullanım bilgisi    | Hangi sayfalarda kullanıldığını gösterme             |
| Performans          | Yalnızca kullanılan aileleri ve kalınlıkları yükleme |

**Kritik nokta:** Font editörde, önizlemede ve canlı sayfada aynı görünmeli. Sadece yönetim panelinde çalışan font yükleme tamamlanmış sayılmamalı.

**3. Marka kiti ve global stiller — mevcut stil panelinden farklı**

Şu an öğe bazında tasarım yapabiliyorsunuz. Buna ek olarak **mağaza genelinde tasarım kuralları** lazım:

- Ana renk, ikinci renk, vurgu rengi.
- Metin, arka plan ve kenarlık renkleri.
- H1–H6 başlık stilleri.
- Gövde, küçük metin ve bağlantı stilleri.
- Birincil, ikincil ve çerçeveli buton stilleri.
- Varsayılan container genişliği.
- Bölüm boşlukları.
- Köşe yuvarlama ve gölge seçenekleri.
- Masaüstü ve mobil tipografi ölçeği.
- “Bu öğeyi global stilden ayır” seçeneği.
- “Global stile geri dön” seçeneği.

**Örneğin:** Mağazanın ana rengini değiştirince bu renge bağlı tüm butonlar güncellenmeli; özel renk verilmiş butonlar korunmalı.

**4. Editörde eklenmesi veya kontrol edilmesi gereken özellikler**

Mevcut taşıma, çoğaltma ve katman sistemini yeniden yapmaya gerek yok. Üzerine şunlar eklenmeli:

| Özellik                         | Sağladığı fayda                             |
| ------------------------------- | ------------------------------------------- |
| Stil kopyala/yapıştır           | Aynı görünümü hızlı uygulama                |
| Sayfalar arası kopyalama        | Tasarımları tekrar kullanma                 |
| Çoklu seçim                     | Birkaç öğeyi birlikte düzenleme             |
| Gruplama ve grubu çözme         | Karmaşık bölümleri yönetme                  |
| Öğeyi kilitleme                 | Yanlışlıkla taşıma ve silmeyi önleme        |
| Katman adlandırma ve arama      | Büyük sayfalarda gezinme                    |
| Üst öğeyi seçme                 | İç içe kutularda doğru öğeye ulaşma         |
| Sağ tık menüsü                  | Hızlı işlemler                              |
| Klavye ile taşıma               | Sürüklemeye alternatif erişim               |
| Sütunları tutarak boyutlandırma | Daha hızlı yerleşim                         |
| Mobil sıralama                  | Mobilde görsel ve metin sırasını değiştirme |
| Responsive değeri sıfırlama     | Masaüstünden miras alınan değere dönme      |
| Esnek önizleme genişliği        | Sadece üç sabit cihazla sınırlı kalmama     |
| Hover/focus durum düzenleme     | Buton ve bağlantı durumları                 |
| Kaydetme hatası bildirimi       | Değişiklik kaybolmasını önleme              |
| Kalıcı sürüm geçmişi            | Önceki günün tasarımına dönebilme           |

**Geri al/ileri al ile sürüm geçmişi aynı özellik değil.** Oturum içindeki işlemleri geri almak var; ayrıca sayfayı kapatıp açtıktan sonra eski kayıtları geri yükleyebilmek gerekiyor.

**5. Eksik sürükle-bırak öğeleri**

19 öğeniz iyi bir temel. En önemli eksik **örnek ürün kartından gerçek ürün sistemine geçiş**.

| Grup            | Eklenmesi gerekenler                                    |
| --------------- | ------------------------------------------------------- |
| Ürün bilgisi    | Dinamik ürün adı, açıklaması, fiyatı, indirim fiyatı    |
| Ürün görselleri | Küçük önizlemeli galeri, yakınlaştırma, varyant görseli |
| Varyant         | Renk, beden, dropdown ve buton seçenekleri              |
| Satın alma      | Adet seçici, sepete ekle, sticky sepete ekle            |
| Ürün durumu     | Stokta yok, seçilemeyen varyant, stok bilgisi           |
| Ürün listesi    | Koleksiyondan ürün grid’i, ilgili ürünler               |
| Koleksiyon      | Başlık, açıklama, görsel, sıralama, sayfalama           |
| İçerik          | Tabs, carousel, görsel galeri, kayan logo şeridi        |
| Güven           | Yorum özeti, yıldız puanı, yorum uygulaması alanı       |
| Karşılaştırma   | Karşılaştırma tablosu, önce/sonra görseli               |
| Kampanya        | Kupon kopyalama, teslimat bilgisi, kargo eşiği          |
| Etkileşim       | Popup, video popup, yukarı dön                          |
| Navigasyon      | Breadcrumb, mobil menü, bölüm bağlantıları              |
| Blog            | Yazı listesi, yazar, tarih, özet ve içerik              |
| Entegrasyon     | Uygulama bileşeni, kontrollü özel kod alanı             |

GemPages’in mevcut kataloğunda ürün varyantları, ürün galerisi, sticky sepete ekle, popup, carousel, tabs ve dinamik koleksiyon/blog bileşenleri bulunuyor. Bunlar işlevsel kapsamı yakalamak için önemli referanslar. [GemPages Help Center](https://help.gempages.net/article-category/elements?utm_source=chatgpt.com)

**6. Formlar — input ve textarea bulunması yetmez**

Bir **Form container’ı** olmalı; alanlar onun içine yerleşmeli.

- E-posta, telefon, metin ve uzun metin.
- Dropdown, checkbox, radio.
- Zorunlu alan ve doğrulama.
- Alan etiketi, açıklaması ve hata mesajı.
- Gönderiliyor, başarılı ve başarısız durumları.
- Başarılı gönderim sonrası yönlendirme.
- Spam koruması.
- Gönderim kayıtları.
- E-posta/CRM/webhook hedefi.
- Newsletter için pazarlama izni alanı.
- Tekrar gönderimi önleme.

Formun verisinin nereye gittiği editörde açıkça görünmeli: **“Bu form şu listeye gönderiyor.”**

**7. Butonların aksiyon sistemi**

Buton ayarını yalnızca URL ile sınırlamayın:

- Sayfaya git.
- Ürüne veya koleksiyona git.
- Sayfadaki bölüme kaydır.
- Popup aç/kapat.
- Sepete ekle.
- Sepeti aç.
- Form gönder.
- Kupon kodunu kopyala.
- Telefon, e-posta veya WhatsApp bağlantısı aç.

Aksiyon tipine göre ilgili ayarlar gösterilmeli. “Sepete ekle” seçildiğinde ürün/varyant bağlamı istenmeli.

**8. Hazır section kütüphanesinde neler eksik?**

Mevcut 11 aileyi koruyup aşağıdaki aileleri ekleyin:

| Yeni section            | Önerilen varyantlar                 |
| ----------------------- | ----------------------------------- |
| Gerçek ürün satın alma  | Galeri solda, galeri sağda, kompakt |
| Ürün kullanım adımları  | Üç adım, görselli adımlar           |
| Karşılaştırma           | İki ürün, özellik tablosu           |
| Önce/sonra              | Kaydırılabilir karşılaştırma        |
| UGC/video               | Video grid’i, tek büyük video       |
| Paket teklif            | İkili/üçlü ürün paketi              |
| Teknik özellikler       | Tablo, ikonlu özellik listesi       |
| Beden tablosu           | Açılır pencere, tablo               |
| Teslimat ve iade        | İkonlu bant, detaylı açıklama       |
| Marka/logolar           | Sabit sıra, kayan şerit             |
| İlgili ürünler          | Grid, carousel                      |
| E-posta toplama popup’ı | Görselli, minimal                   |
| Sticky satın alma       | Mobil ve masaüstü                   |
| Blog seçkisi            | Üç kart, editoryal yerleşim         |

**Önerdiğim hedef:** Önce 25–30 iyi hazırlanmış section, ardından 50–60 varyant.

Section eklenirken kullanıcının fontu ve renkleri otomatik uygulanmalı. İçerikler taşmamalı; mobil düzeni ayrıca hazırlanmış olmalı.

Bir de iki ayrı kayıt türü gerekli:

- **Kayıtlı kopya:** Her sayfada bağımsız düzenlenir.
- **Senkron section:** Bir değişiklik, bağlı tüm sayfalara uygulanır.

Sizde ilkine yakın bir özellik var; ikincisi listede görünmüyor.

**9. Shopify tarafında tamamlanması gerekenler**

En büyük işlevsel açık burada:

- Mağaza başına bağlantı ve bağlantı durumu.
- Canlı ürün/koleksiyon seçicisi.
- Dinamik alan bağlama.
- Metafield desteği.
- Varyant–fiyat–görsel–stok senkronizasyonu.
- Gerçek sepete ekleme ve hata yönetimi.
- Shopify’a yayınlama/yayından kaldırma.
- Ürünlere ve koleksiyonlara şablon atama.
- Mevcut temayla gerçek önizleme.
- Tema değişikliği algılama.
- Yayınlanan sürümün kaydı.
- Önceki başarılı yayına dönüş.
- Bağlantı koptuğunda ve mağaza devre dışı bırakıldığında açık davranış.

**Tema okumayı üç ayrı yetenek olarak düşünün:** tema yapısını okumak, gerçek görünümü önizlemek ve düzenlenen sonucu temaya uygulamak. Sizde ilkine ait altyapı var; diğer ikisi ayrıca geliştirilmek zorunda.

**Çift yönlü otomatik senkronizasyonu ilk hedef yapmanızı önermem.** Önce Shopify ürün verisinin kaynağı, uygulamanız da oluşturduğu sayfaların tasarım kaynağı olsun. Dışarıdan değişiklik algılandığında üzerine yazmadan fark gösterin.

Herhangi bir temanın Liquid kodunu kayıpsız şekilde görsel öğelere dönüştürmek ise ayrı, büyük bir geliştirme konusu.

**10. Yayın, SEO ve kalite özellikleri**

- Sayfa URL’si ve SEO başlığı.
- Meta açıklama ve sosyal paylaşım görseli.
- İndeksleme ayarı.
- Taslak–canlı sürüm ayrımı.
- Paylaşılabilir önizleme bağlantısı.
- Zamanlanmış yayın ve yayından kaldırma.
- Boş bağlantı ve eksik görsel kontrolü.
- Eksik ürün bağlantısı kontrolü.
- Mobil yatay taşma kontrolü.
- Görsellerin sayfa hızına etkisini gösterme.
- Başlık hiyerarşisi ve alternatif metin uyarıları.
- Yayınlama hatasının anlaşılır açıklaması.
- Gerçek sayfada temel tıklama ve sepete ekleme ölçümü.

Ayrıca **sepet ve arama taslak türlerinin bulunması, çalışan sepet ve arama desteği olduğu anlamına gelmiyor.** Arayüzde her sayfa türü için “tasarım”, “veri bağlantısı” ve “yayınlama” durumlarını ayrı göstermek faydalı olur.

**11. Daha sonra eklenecek GemPages düzeyindeki genişleme alanları**

- Yorum, e-posta pazarlama ve abonelik uygulaması entegrasyonları.
- Çok dil ve çeviri yönetimi.
- Bundle ve adet bazlı teklifler.
- AI ile section/sayfa üretimi.
- Görselden düzenlenebilir tasarım.
- A/B testleri.
- Satış hunileri ve satın alma sonrası teklifler.
- Ajans rolleri ve müşteri önizleme/onay akışı.
- Mağazalar arası şablon aktarımında ürün ve medya eşleştirme.

Bunları temel medya, veri ve yayınlama akışından sonra geliştirin.

**Ben olsam sıradaki işleri şöyle sıralarım:**

| Sıra | İş paketi                              | Bittiğinde ne kazanırsınız?               |
| ---- | -------------------------------------- | ----------------------------------------- |
| 1    | Görsel yükleme + medya kütüphanesi     | Gerçek marka içerikleriyle çalışma        |
| 2    | Font yükleme + marka kiti              | Tutarlı, markaya uygun tasarım            |
| 3    | Stil kopyalama + kalıcı sürüm geçmişi  | Daha hızlı ve güvenilir düzenleme         |
| 4    | Shopify bağlantısı + gerçek ürün bloğu | Çalışan satış sayfası                     |
| 5    | Shopify yayınlama + geri dönüş         | Gerçek mağazada kullanılabilir ürün       |
| 6    | Formlar + buton aksiyonları            | Çalışan iletişim ve pazarlama akışları    |
| 7    | Yeni elementler + section varyantları  | Daha geniş tasarım kapasitesi             |
| 8    | Entegrasyonlar + AI + testler          | GemPages’in geniş ürün kapsamına yaklaşma |

**Şu anki en doğru hedefiniz: Kullanıcı kendi görselini ve fontunu yüklesin, gerçek ürününü bağlasın, mobil görünümü düzenlesin ve Shopify’da çalışan sayfayı yayınlasın.** Bu zincir tamamlandığında, eklediğiniz her yeni section ve element doğrudan kullanılabilir değer üretir.
