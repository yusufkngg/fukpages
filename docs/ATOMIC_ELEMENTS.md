# Bağımsız sayfa öğeleri — 0.6.0

Bileşik görünüm gerçek blok ağacından oluşur. Her çocuk ayrı seçilir ve sağ
panelde kendi özelliklerini açar. Üst Row gap, yön, hizalama ve sarmayı yönetir.

```text
Row
├── Item List
│   ├── Icon
│   └── Text
├── Item List
│   ├── Icon
│   └── Text
└── Item List
    ├── Icon
    └── Text
```

- Menü: ayrı Text etiketleri; non-breaking boşluklarla tek yazı içine dizilmez.
- Sosyal kanıt: beş ayrı Icon + ayrı yorum Text. Tek ikonun rengi, glyph'i,
  boyutu, görünürlüğü veya kaynağı diğerlerini değiştirmez.
- Item List: ikon/metin ikilisi. Listeler birden çok Item List içerir.
- Button/badge: caption Text ve varsa Icon ayrı çocuklardır. Bağlantı/eylem üst
  Button'dadır; caption/ikon düzenlemek için çocuğu seç. Parent toolbar, layer
  tree veya üst öğe seçimiyle bütün düğmeyi seçebilirsin.
- Ürün kartı: görsel, başlık, fiyat/eski fiyat ve açıklama ayrı bloklardır.
  Yerel katalog bağlanınca kendi product gallery/field öğeleri kullanılır.
  Kaynak ürün değişiminde mevcut kimlik/stil ve eklenen içerik korunur.
- Hazır müşteri yorumu: yıldızlar, alıntı, yazar ve örnek etiketi ayrı öğelerdir.
- Özel ikon: yüklenen SVG/PNG veya URL. `Use icon colour`, şeffaf ikonun alpha
  şeklini seçilen renkle gösterir; çok renkli dosyanın kendi görünümü de seçilebilir.

Eski belgeler editör açılışında idempotent olarak dönüştürülür. Root kimliği,
CSS anchor, link/eylem, renk/biçimlendirme, cihaz geometrisi ve çeviriler korunur.
Normal çok satırlı paragraflar parçalanmaz. İnceleme sırasında otomatik yayın
üretilmez; taslak normal kayıt akışına girer ve Publish locally yayını günceller.
Kilitli içerik, derinlik/600 blok sınırı veya desteklenmeyen zengin blok markup'ı
otomatik dönüşüm dışında tutulur. Manuel `Split into elements` komutu vardır.

Business widget'larının intrinsic kontrol ve değerleri kendi widget ayarlarında
kalır; bu değişiklik dekoratif ikonları metin kutularında paketleme sorununu giderir.
Shopify bağlantısı, gerçek ödeme ve dış sağlayıcı işleri bu aşamada ertelenmiştir.

## Kanıt

- 57 test: kök kimlik/anchor/çeviri/format/cihaz korunması, dönüşüm idempotence,
  ayrı kayıtlı çocuklar, geçerli hiyerarşi, custom içerik/ürün kaynak değişimi.
- 60 hazır bölümün Text/Heading içeriğinde dekoratif glyph veya boşlukla dizilmiş
  menü bulunmaması; server validator ile canonical kayıt.
- `npm run test:atomic`: gerçek Chromium, gerçek Netlify Function ve resmi yerel
  Blobs. Tek yıldız rengi/glyph'i/kes-yapıştır; menü etiket/gap; SVG yükleme,
  ikon rengi, aynı graph'ın kaydı/yeniden açılması/yayını ve dört genişlik.
- Mevcut editor/media/form/recovery/section/Netlify ve 13 responsive genişlik
  regresyonları. Canlı sahibin şifresi veya oturumu testte kullanılmaz.

[Item List ve özel ikon](screenshots/atomic-item-list.png) ·
[Ayrı yıldız ve yorum öğeleri](screenshots/atomic-review-row.png)
