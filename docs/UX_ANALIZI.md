# CALPEO arayüz ve kullanılabilirlik analizi

Tarih: 21 Ekim 2026. Kapsam: web paneli (`apps/web`, 27 sayfa) ve mobil uygulama (`apps/mobile`, 18 ekran).

Yöntem:
- Web panelinin bütün sayfaları demo verisiyle tarayıcıda açıldı. Her sayfa 1440 px genişlikte otomatik bir betikle ölçüldü: başlık yapısı, adsız kontroller, etiketsiz alanlar, 12 px altındaki metinler, kesilen metinler, taşma ve emoji. Ağır sayfalar ayrıca 375 px'te ölçüldü.
- Mobil uygulama Expo'nun web modunda 375 px'te açıldı. Giriş, Panel, Diğer ve Anahtar Kelimeler ekranları gezildi.
- Renk kontrastı tasarım belirteçlerinden WCAG formülüyle hesaplandı.
- Tanımsız Tailwind sınıfları tarayıcıda yüklenen CSS'e bakılarak doğrulandı.

Sınırlar:
- Gerçek kullanıcıyla test yapılmadı.
- Ekran okuyucuyla deneme yapılmadı.
- Mobil uygulama gerçek cihazda değil, web modunda incelendi; iOS ve Android'e özgü davranışlar (geri tuşu, güvenli alan) koddan çıkarıldı.

## Genel değerlendirme

Arayüzün temeli sağlam. Web panelinde semantik renk belirteçleri, açık ve koyu tema, görünür odak halkası ve hareket azaltma desteği var. Sorunlar sayfası, teşhisi ve önerilen kodu yan yana göstererek "neden" sorusunu rakiplerden daha iyi yanıtlıyor.

Kullanıcı dostu olmayı engelleyen dört sorun var:

1. Tasarım sistemi 14 dosyada sessizce bozuluyor (aşağıda 1. madde).
2. Yeni kullanıcı için varsayılan olan Sade Mod, ekranda çelişkili mesaj ve teknik jargon gösteriyor.
3. Menüde 27 sayfa var; rakipler aynı kapsamı daha az giriş noktasıyla sunuyor.
4. Mobil uygulama ekran okuyucuyla neredeyse kullanılamıyor; Android geri tuşu uygulamadan çıkarıyor.

## Rakiplerle karşılaştırma

| Konu | CALPEO | SE Ranking | Ahrefs | Semrush |
|---|---|---|---|---|
| G2 kullanım kolaylığı puanı | yok | 9,2 | 8,8 | 8,3 |
| Kullanıcı yorumu | — | sade ve uygun fiyatlı | sade ama kalabalık sayfalar | kapsamlı ama dağınık; öğrenmesi zor |
| Sorun önem seviyesi | 4 seviye (Kritik, Yüksek, Orta, Düşük) | hata, uyarı, bildirim | hata, uyarı, bildirim | hata, uyarı, bildirim |
| Sağlık puanı tanımı | 94/100, yanında "1 kritik sorun"; formül ana ekranda yok | — | hatasız iç URL oranı, yardım sayfasında açık | kontroller içinde hata ve uyarı ağırlıklı oran |
| Denetim ekranının düzeni | ayrı ayrı 6 teknik sayfa | — | tek özet, ilk 10 sorun tablosu, kategoriler | özet ve 7 tematik rapor kutusu |
| Sorunun nedeni ve çözümü | teşhis, önerilen kod ve kaynak belge aynı kartta | — | sorun ve URL listesi, açıklama yan panelde | sorun ve "neden, nasıl düzeltilir" açıklaması |
| Başlangıç ve uzman ayrımı | Sade Mod ve Uzman Modu düğmesi | — | yok | yok; kurulum yardımı var |

Rakiplerden çıkan ders: Ahrefs ve Semrush denetimi tek bir giriş noktasında topluyor, ayrıntıyı alt raporlara bırakıyor. CALPEO aynı bilgiyi menüde 6 kardeş sayfaya dağıtıyor (Teknik Sağlık, Sorunlar, Taranan Sayfalar, Yapılandırılmış Veri, İç Link Grafı, Web Vitals). Bu sayfaların üçü 100 kelimenin altında: Web Vitals 66, Deneyler 69, Şema 80.

CALPEO'nun önde olduğu alanlar:
- Her önerinin yanında etki, güven ve kaynak belge var.
- Grafikte dağıtım işareti var ("#42 canonical düzeltmesi").
- Teşhis ve önerilen kod aynı kartta, yan yana.

Bunlar ürünün "kanıt" iddiasını destekliyor ve rakiplerde bu derecede görünür değil.

## Bulgular (önem sırasıyla)

### Öncelik 1: güveni ve doğruluğu bozanlar

**1. Tanımsız Tailwind sınıfları stilsiz kalıyor.**
- Sebep: `tailwind.config.js` içinde `theme.colors` doğrudan tanımlanmış (`extend` altında değil). Bu yüzden Tailwind'in hazır paleti tamamen kapanıyor.
- Etkilenen sınıflar: `text-emerald-*`, `text-amber-*`, `text-gray-*`, `bg-indigo-*`, `rounded-xl`, `shadow-sm`, `bg-accent/10` gibi saydamlık ekleri, `bg-accent-strong`, `text-accent-contrast`, `text-evidence-ink`. Tarayıcıdaki CSS'te bunların hiçbiri üretilmemiş.
- Kullanım sayısı dosya başına:
  - `keywords` 63
  - `reports` 38
  - `integrations` 35
  - ana sayfa 23
  - `LevelSelectorModal` 19
  - `geo` 19
  - `backlinks` 18
  - `leads` 13
  - `content` 11
  - diğer 5 dosya 14
- Görünür sonuç: Sade Mod'daki ana düğme "Önerileri Uygula" koyu temada beyaz yazıyı #7b96ff zemin üzerinde gösteriyor; kontrast 2,75:1, gerekli değer 4,5:1.
- Aynı durum: `bg-accent text-white` kalıbını kullanan 6 yer (GEO, Raporlar, Backlink, seviye seçici).
- Çözüm iki adımlı:
  - Renkleri `rgb(var(--x) / <alpha-value>)` biçimine geçirerek saydamlık eklerini çalışır hale getirmek.
  - Palet sınıflarını mevcut belirteçlere (`evidence`, `warn`, `critical`) çevirmek.
  - Sonra derlemede tanımsız sınıfı yakalayan bir lint kuralı eklemek.

**2. Sade Mod çelişkili mesaj veriyor ve jargon kullanıyor.**
- Sade Mod varsayılan mod (`DensityContext.tsx:28`), yani her yeni kullanıcı bu ekranla karşılaşıyor.
- Çelişki: Başlık "Sitenizin Durumu Harika! 🎉". Aynı ekranda "1 kritik sorun" ve "4 kritik fırsat" yazıyor. Başlık yalnızca `health.score >= 80` koşuluna bakıyor (`app/page.tsx:133`); kritik sorun sayısını hesaba katmıyor.
- Jargon: Başlangıç kullanıcısına şu ifadeler gösteriliyor:
  - "Diff incele"
  - "Anchor önerileri"
  - "canonical döngüsü"
  - "PageRank +0,6 · NetworkX site grafı"
- Tutarsız vaat: "Görevleri tek tıkla uygulayabilirsiniz" yazıyor. Oysa başlık ve meta değişiklikleri onay bekliyor; otomatik pilot yalnızca doğrulanmış değerleri uyguluyor.
- İki mod iki ayrı ürün gibi görünüyor:
  - Sade: emoji, gradyan zeminli kart, "Harika!".
  - Uzman: serif başlık, kanıt dili.
  - Uzman Modu ana sayfası daha iyi: tek cümlelik başlık ("Görünürlük artıyor, 1 kritik iş karar bekliyor.") sorunun cevabını veriyor.
- Öneri:
  - Sade Mod aynı yerleşimi korusun, teknik terimleri gizlesin.
  - Görev metinleri sonuç diliyle yazılsın: "Ürün sayfasının Google'da yanlış adresle görünmesini düzelt".
  - Başlık kritik sorun sayısına göre seçilsin.

**3. Ekranlar arasında veri tutarsızlığı var.**
- Web ana sayfasında üst çubuk "Örnek site / flagship-store.com" diyor. Hemen altındaki etiket "ACME TÜRKİYE" diyor.
- Mobil demoda site "Acme Ecommerce Store / acmestore.io".
- Taramalar sayfası "İlk siteyi ekleyin" diyor; diğer sayfalar aynı anda dolu veri gösteriyor.
- Mobil Panel'de sabah brifingi "14.3k gösterim" diyor. Aynı ekrandaki Search Console kartı "Veri yok" diyor ve demo modunda kırmızı "OAuth ile Yeniden Doğrula" hatası gösteriyor.
- Öneri: Web ve mobil tek bir demo veri kaynağı kullansın. Demo modunda bağlantı hatası kartı gösterilmesin.

**4. Menü çok kalabalık.**
- Sol menüde 7 grup altında 27 bağlantı var.
- Aynı ikon farklı sayfalarda tekrar ediyor: `Link2` iki yerde, `FileText` iki yerde, `Users` iki yerde.
- Bakılan rehberler birincil menüde 7 civarı giriş öneriyor.
- Önerilen yapı 5 ana alan:
  - **Özet**
  - **Yapılacaklar**: Öncelikli İşler, Değişiklikler, Deneyler
  - **Görünürlük**: Performans, Anahtar Kelimeler, GEO, Rakipler, Backlink
  - **Site sağlığı**: tek sayfa, içinde Sorunlar, Sayfalar, Şema, Linkler ve Web Vitals sekmeleri
  - **Yönetim**
- CRM köprüsü, mevzuat kalkanı ve bilgi tabanı gibi ajans özellikleri pakete göre gizlenebilir.

### Öncelik 2: okunabilirlik ve tutarlılık

**5. Sayı, para ve yüzde biçimleri tutarsız.**
- Yanlış yüzde biçimleri:
  - "+8,1%" (ana sayfa, `app/page.tsx` sade kart)
  - "+4,8 %" (Uzman Modu)
- Doğru kullanım aynı ekranlarda zaten var: "%98,2".
- Para birimi ve ondalık:
  - Web'de "₺14.50"; Türkçede ondalık virgülle yazılır: "₺14,50".
  - Mobilde aynı veri "$18.5" olarak, dolarla gösteriliyor.
- Kısaltma: Mobilde "14.3k"; web'de aynı tür sayı "142,8B" ve "2,41M".
- Öneri: Kısaltma için `Intl.NumberFormat("tr-TR", { notation: "compact" })` kullanmak; bu "142,8 B" ve "2,4 Mn" verir. Mobil de aynı yardımcıyı kullanmalı.

**6. Metin boyutu küçük.**
- Gövde metni 13 px.
- 12 px altındaki metin parçası sayısı:
  - GEO 115
  - Backlink 46
  - ana sayfa 29
  - Anahtar Kelimeler 20
- `text-[10px]` ve `text-[11px]` 22 yerde, ölçeğin dışında kullanılıyor.
- 375 px'te grafik eksen yazıları okunmuyor.
- Mobil uygulamada 8–11 pt yazı boyutu 230 stilde geçiyor.
- Öneri: Alt sınır 12 px olsun (tasarım belirteçleri dosyası zaten bunu yazıyor), 11 px yalnızca mono etiketlerde kalsın. Mobilde 12 pt altı kaldırılsın.

**7. Bazı sayfalar çok uzun ve dili karışık.**
- GEO sayfası 909 kelime. Masaüstünde 3.207 px, mobilde 7.763 px uzun (yaklaşık 10 ekran).
- Sayfa başlıkları ürün içinde pazarlama dili kullanıyor:
  - "Semrush ve Ahrefs kalitesinde" (Anahtar Kelimeler)
  - "Ahrefs ve Semrush standartlarında" (Rakipler)
  - "Surfer SEO NLP standardı" (İçerik)
- Türkçe ve İngilizce terimler karışıyor: Keyword Gap, Lead Pipeline, Whitelabel, Citation, Monte Carlo, Diff, Anchor.
- Öneri:
  - Başlık sayfanın ne işe yaradığını söylesin: "Rakiplerin sıralandığı, sizin olmadığınız kelimeler".
  - GEO sekmelere bölünsün.
  - Terimler için tek bir sözlük kullanılsın.

**8. Mobil genişlikte web paneli eksik kalıyor.**
- Dönem seçici (7, 28, 90 gün) `md` altında gizli. Telefonda dönem değiştirilemiyor.
- Tema ve mod düğmeleri yalnızca ikon veya emoji (🌱 ⚡); metin etiketi yok.
- Üst çubuktaki düğmeler 28 px yüksek. Dokunmatik ekran için 44 px önerilir.
- Ana sayfadaki "Bu hafta karar bekleyen" kartlarında görev metni üç noktayla kesiliyor; bu masaüstünde de var, 8 öğe kesik.
- Demo uyarısı telefonda tam da önemli kısımda kesiliyor: "örnek veri göste…".

**9. Erişilebilirlik açıkları.**
- `main id="icerik"` var ama ona giden "içeriğe atla" bağlantısı yok.
- Etiketsiz alanlar:
  - AI asistan sohbet kutusu
  - Anahtar Kelimeler arama kutusu
  - Backlink arama kutusu
  - GEO soru alanı ve metin kutusu
  - İçerik metin kutusu
  - Lead sayfasındaki 3 kaydırıcı
- Backlink tablosunda erişilebilir adı olmayan 8 bağlantı var.
- Fatura sayfasında etiketsiz bir silme ikonu var.
- Kontrast belirteç düzeyinde iyi. Tek istisna: `evidence` metni `evidence-soft` zemin üzerinde 4,45:1, sınırın hemen altında.

**10. Emoji kullanımı kanıt diliyle çelişiyor.**
- Web: mod düğmesi 🌱 ⚡, başlıklar 🎉 🚀, Lead düğmesi "🎯 Finansal Kaybı Hesapla".
- Mobil: "7 Gün SEO Serisi 🔥" oyunlaştırma kartı.
- Uzman Modu ve giriş sayfası ciddi bir karar aracı gibi konuşuyor; bu öğeler o tonu bozuyor.

### Mobil uygulama

**11. Ekran okuyucu desteği neredeyse yok.**
- 570 dokunulabilir öğeye karşılık yalnızca 2 yerde `accessibilityLabel` var.
- İkon düğmelerinin hiçbiri VoiceOver veya TalkBack'te anlamlı okunmuyor: arama, bildirim, yenile, çıkış, artı.

**12. Geri tuşu uygulamadan çıkarıyor.**
- Uygulama bir gezinme kütüphanesi kullanmıyor; ekranlar `activeTab` durumuyla değişiyor (`App.tsx`).
- `BackHandler` hiç kullanılmamış. Android'de "Diğer" altındaki bir ekrandayken geri tuşu bir önceki ekrana dönmüyor, uygulamayı kapatıyor.
- Öneri: Expo Router veya React Navigation'a geçmek ya da en azından `BackHandler` ile bir geçmiş yığını tutmak.

**13. Görsel dil web'den ayrı.**
- Mobil: koyu "cam" görünüm, indigo #6366F1.
- Web: açık tema varsayılan, mavi #3157e5, düz yüzeyler.
- Aynı ürün iki farklı marka gibi görünüyor.
- Kontrast: Mobil `textMuted` rengi kart zemininde 3,85:1, 4,5:1 sınırının altında.

**14. Giriş ekranı karışık.**
- Giriş düğmesinin altında 4 ayrı yol var:
  - "Geliştirici demo girişi"
  - "Demo bilgilerini doldur"
  - "Hesapsız dene"
  - "Kurulum Sihirbazı"
- Düzeltme: "Geliştirici demo girişi" ve "Demo bilgilerini doldur" `__DEV__` koşuluna bağlı, yayın derlemesinde görünmüyor. İlk sürümde bunun tersi yazılmıştı; inceleme geliştirme sunucusunda yapıldığı için yanlış okundu.
- Geliştirme derlemesinde "Hesapsız dene" satırı ekranın sağından taşıyor; alt bağlantılar (KVKK, Kullanım Koşulları, Gizlilik) kesiliyor.
- Şifre kuralı uyumsuz: Mobil "En az 6 karakter" diyor (`LoginScreen.tsx:302`), web 8 karakter istiyor (`login/page.tsx:119`).
- Tarayıcı sekme başlığı "SEO Platform"; marka adı CALPEO.

**15. Yüzen artı düğmesi içeriğin üstüne biniyor.**
- Panel'de "Yeni Tarama Tetikle" düğmesinin ve "Diğer" kartlarının ok işaretlerinin üstünü kapatıyor.
- Anahtar Kelimeler ekranında üstte bir "+" daha var; iki artı farklı işler yapıyor.
- "Diğer" menüsünde ilk kart "Sistem CRM & Lead'ler". Çoğu kullanıcı için ilk sırada Anahtar Kelimeler veya Görevler olmalı.
- Hata ekranı kullanıcıya ham hata mesajını gösteriyor (`App.tsx`, `ErrorBoundary`).

## Güçlü yanlar

- **Tasarım belirteçleri.** `globals.css` içindeki semantik renkler AA kontrastını sağlıyor. Belirtilen tek istisna var.
- **Erişilebilirlik altyapısı.** Görünür odak halkası (`:focus-visible`), menüde `aria-current`, hareket azaltma desteği.
- **Menü davranışı.** Daraltılabilen menü durumunu hatırlıyor.
- **Sorunlar sayfası.** Teşhis, önerilen çözüm, eski ve yeni kod, kaynak belge ve etkilenen URL sayısı tek kartta.
- **Öncelikli İşler.** Her işin yanında etki, güven yüzdesi ve kaynak var.
- **Dürüst demo dili.** Örnek veri her sayfada açıkça belirtiliyor.
- **Mobil temel yapı.** 5 sekmeli alt menü ve ızgara şeklinde "Diğer" sayfası kolay keşfediliyor.

## Önerilen sıra

1. **1–2 gün**
   - Tailwind renklerini düzeltmek ve tanımsız sınıfları belirteçlere çevirmek (madde 1).
   - Sade Mod başlık mantığını düzeltmek (madde 2).
   - Sayı biçimlerini tek yardımcıda toplamak (madde 5).
   - "İçeriğe atla" bağlantısı ve eksik etiketleri eklemek (madde 9).
   - Mobil şifre kuralını 8 karaktere çekmek (madde 14).
2. **1 hafta**
   - Sade Mod metinlerini sonuç diliyle yeniden yazmak (madde 2).
   - Menüyü 5 alana indirmek, teknik sayfaları sekmelere almak (madde 4).
   - Tek demo veri kaynağı kurmak (madde 3).
   - Mobil web üst çubuğunu düzeltmek (madde 8).
3. **2–3 hafta**
   - Mobilde erişilebilirlik etiketleri eklemek (madde 11).
   - Gezinme ve geri tuşunu düzeltmek (madde 12).
   - Web ve mobil için ortak renk ve yazı ölçeği kurmak (madde 13, 6).

## Kaynaklar

- [G2: Ahrefs ve SE Ranking karşılaştırması](https://www.g2.com/compare/ahrefs-vs-se-ranking)
- [G2: Semrush, Ahrefs, SE Ranking, Moz Pro karşılaştırması](https://g2.com/compare/semrush-vs-ahrefs-vs-se-ranking-vs-moz-pro-vs-spyfu)
- [The CMO: Semrush ve Ahrefs incelemesi](https://thecmo.com/tools/semrush-vs-ahrefs/)
- [Ahrefs Academy: Site Audit özeti](https://ahrefs.com/academy/how-to-use-ahrefs/site-audit/sa-overview)
- [Semrush: Site Audit özeti](https://www.semrush.com/kb/540-site-audit-overview)
- [Semrush: Site Audit tematik raporlar](https://www.semrush.com/kb/959-site-audit-thematic-reports)
- [Userpilot: kademeli gösterim](https://userpilot.com/blog/progressive-disclosure/)
- [Idealogic: SaaS pano tasarımı](https://idealogic.io/blog/dashboard-design)
