# Editör arayüzü — 0.5.0

Varsayılan arayüz İngilizcedir. Dişli simgesi → **Settings → Language → Türkçe**
seçimi tarayıcıda korunur; sayfa metni, mağaza adları, katalog ve SEO alanları
müşterinin içeriğidir ve dil değişikliğinde aynı kalır. Arayüz etiketleri teknik
öğe/bölüm kimliklerini değiştirmez.

| İstek | Davranış ve kanıt |
| --- | --- |
| Basit sol menü | İkon rail'i, Sections/Elements geçişi, görsel satır kartları. Seçilen öğenin ayarları aynı sol panelde açılır; geri ok kütüphaneye döner. Panel genişliği sürüklenip hatırlanır. İkincil işlemler Element actions altında açılır. |
| Metin ayarları | Settings altında font, boyut ±, kalın/italik/altı çizili, renk ve hizalama; daha fazla ayar isteğe bağlı açılır. Advanced görünürlük, konum, animasyon ve diğer gelişmiş davranışları tutar. |
| Tek tıkta yazı imleci | Tek tık seçer, contentEditable kapalıdır ve normal imleç gösterilir. Çift tık düzenlemeyi açar; blur/Escape düzenlemeden çıkar. |
| Ctrl+X çalışmıyor | Native clipboard kes/kopyala/yapıştır; metin alanında normal metin işlemleri. Kesme pano yazımı tamamlandıktan sonra öğeyi kaldırır. Aynı sayfaya yapıştırma kimlikleri korur, kopyalar yeni kimlik alır. |
| Diğer kısayollar | Ctrl/Cmd S/D/Z/Shift+Z, Ctrl+Y; Ctrl/Cmd A/G/Shift+G, Delete/Backspace, ok ve Shift+ok. Settings altında yardım. Ctrl+S marka panelinde global stili, diğer panellerde sayfa taslağını kaydeder. X/V/D/Z/Y/S tarayıcı akışında; grouping/lock/cross-root referanslar model testinde kontrol edilir. |
| İkon çerçevesi | Varsayılan inline-flex / fit-content, ikon seçici ve Fit to icon. Sonsuzluk ikonunun kutusu tarayıcıda 70px’den küçük ve satırın yarısından dar ölçülür. Kullanıcının özel genişliği korunur. |
| Row içinde metin ve ikon | Inline satır kartı ile doğrudan text/icon çocukları; ayrıca 1–4 kolon kartları. Bölüm/satır ayarında 1–6 kolon seçilir; azalan kolonların içeriği kalanlara taşınır, kimlik/metin korunur. |
| Bölüm ayarları | Layout kartları, cihaz bazında ölçüler ve padding/margin diyagramı. Choose templates/Add blank section ekleme noktası; mevcut tema snapshot bölüm kartlarında ikon. Gerçek Shopify bağlantısı bu aşamada yok. |
| Layer tree | Bağımsız floating panel, drag header, köşeden resize, arama, açılıp kapanan çocuklar ve cihaz bazında görünürlük. Kilitli üst öğenin çocukları taşınamaz/görünürlükleri değiştirilemez. |
| Global Styles | Renk swatch'ları; heading/body/button fontları, typography ve xxs/xs/sm/md/lg/xl spacing. Özel font yükleme/search açılabilir. Update all pages veya Ctrl+S markayı kaydeder. Aktarımda kaynak spacing token'ları da somut CSS değerine çevrilir. |
| Accordion | 1–40 başlık/cevap öğesi, ekle/çoğalt/taşı/sil, başlık/içerik arka planı, padding, kenarlık, radius/gap. Cevaplar düz metindir. Geçersiz JSON, tekrar eden kimlik, renk ve ölçüler reddedilir. Üç öğeli yayın tarayıcıda açılır. |

## Doğrulama

- `npm test`: 52 test; arayüz dili/kimlikler, içerik koruyan kolon sayısı,
  kardeşler arası linklerin kopyalanması, spacing aktarımı ve accordion sınırları
  için yeni kontrat kontrolleri dahil.
- `npm run test:ui`: gerçek Chromium + Netlify Function + resmi yerel Blobs;
  geçici owner hesabı. İngilizce/Türkçe açılış, reload, metin, pano, ikon,
  Layers, Global Styles ve accordion kayıt/yayını.
- Mevcut `test:feedback`, `test:browser`, `test:responsive`, `test:netlify`,
  build ve format kontrolleri. 720 preset/içerik/genişlik kontrolü ve 13
  responsive genişlik, her kısayolun tüm işletim sistemlerinde testi anlamına gelmez.

Ekran görüntüleri izole test verileridir; gerçek sahip hesabı veya şifresi kullanılmaz.

[Metin ayarları](screenshots/english-text-settings.png) ·
[Öğe kütüphanesi](screenshots/english-elements.png) ·
[Global Styles](screenshots/english-global-styles.png) ·
[Layers](screenshots/english-layers.png) ·
[Accordion](screenshots/english-studio.png)

Shopify, AI ve e-posta/CRM sağlayıcı sınırları [FEATURE_AUDIT.md](FEATURE_AUDIT.md)
içinde korunur. Yerel katalog ataması veya demo sepeti gerçek Shopify siparişi değildir.
