# İlerleme

Dal: `review/mobile`. Son güncelleme: 25 Ekim 2026. `main`'e göre 38 commit önde.

## Durum

| Kontrol | Sonuç |
|---|---|
| Arka uç testleri (`pytest`) | 482 test geçiyor |
| Web testleri (`npm test`, `test:auth`) | Geçiyor |
| `tsc --noEmit`, `next build` | Hatasız |
| `npm run lint` | Hata yok, önceden kalan uyarılar var |
| Tarayıcı kontrolü | Yönetim ekranları, Değişiklikler ve Genel Görünüm, yerel SQLite API'ye karşı denendi |

## Tamamlanan işler

### Canlı veri ve güvenilirlik (17-22 Ekim)

- Paddle ödeme korumaları, şifre sıfırlama e-postası, release şeması (`da31538`).
- llms.txt servisi, canlı AI görünürlük ölçümü, backlink sağlayıcıları; backlink kayıtları veritabanında (`be802c7`, `857eb97`, `f105977`).
- Uydurma metrikler ve sonuçlar kaldırıldı; IP güveni ve JWT iptal kontrolü sıkılaştırıldı (`0482f1b`, `856238b`).
- Ajanlar Türkçe öneri üretiyor, tarama başına model çağrısı sınırlı (`6b8e201`, `7c82df7`).
- Otomatik pilot yalnızca doğrulanmış başlık, meta ve JSON-LD yazıyor; sayfada olmayan bilgi reddediliyor (`cede301`, `4637382`).

### Arayüz (22 Ekim)

- Kullanılabilirlik analizi: `docs/UX_ANALIZI.md` (`957859a`).
- Menü 5 alana indi, sade mod, tek demo sitesi, ortak terim sözlüğü, 12 px yazı alt sınırı (`46cfcc6`, `8b7e595`, `d6bfc99`, `790519d`).
- Mobil erişilebilirlik etiketleri, geri tuşu, web ile ortak tasarım belirteçleri (`24f1016`).

### Yönetici paneli (25 Ekim)

Plan: `docs/YONETICI_PANELI_PLANI.md` (`c4bd2dd`).

- Kayıtta kişisel organizasyon ve free plan açılıyor (`1af35ef`).
- Yönetici uçları, veritabanından yetki kontrolü, gerçek AI kullanımı kaydı (`6c5542a`).
- `/admin` altında kullanıcılar, organizasyonlar, ödemeler, kullanım ve denetim kaydı ekranları (`4b1c607`).
- Eksik Next vekil uçları eklendi; vekili olmayan istemci yolu kalmadı, test bunu denetliyor (`1993120`, `6a78bbf`).

### Hata düzeltmeleri (25 Ekim)

- Düzeltme ve geri alma hatasında sahte "uygulandı" gösterilmiyor; sandbox ve onay bekleyen setler ayrı bildirimle anlatılıyor (`2d6ad1c`, `ba29266`).
- Tarama sürerken "tarandı" denmiyor; veri yokken "Artıyor" rozeti çıkmıyor (`199e8fa`).
- Aylık token bütçesi dönem sayacından okunuyor, ay dönünce sıfırlanıyor (`d3f796a`).
- Hızlı denetimin AI kullanımı oturumlu kullanıcının organizasyonuna yazılıyor (`dceafa2`).
- `/health/ready` veritabanı yokken 503 dönüyor (`98297d7`).
- Paddle anahtarları `settings` üzerinden okunuyor (`bc7bd89`).
- Varsayılan LLM modelleri: Google `gemini-3.8-flash`, OpenAI `gpt-4o`, Anthropic `claude-opus-5-5`; kapatılmış model ayarlıysa varsayılana düşülüyor (`a4bdb8e`).
- Aramada Türkçe İ/ı eşleşiyor (`4a8365c`).
- Tailwind yapılandırmasındaki lint hatası giderildi (`15ae917`).

### Model karşılaştırması

- Claude Haiku 5.5, Gemini 3.5 Flash-Lite ve Gemini 3.8 Flash için karşılaştırma betiği: `scripts/model_eval/` (`ff851d7`).
- Siteye yazılacak başlık, meta ve JSON-LD için 8 madde eklendi; özet, `build_proposed_change` kabul oranını ve kabul başına maliyeti veriyor (`61e43ba`). Kuru çalıştırma geçti.

## Açık işler

- **Model karşılaştırmasının ücretli çalıştırması yapılmadı.** Kök `.env` dosyasına `ANTHROPIC_API_KEY` ve `GOOGLE_API_KEY` eklenince:
  `.venv/bin/python scripts/model_eval/run.py --only actions` (24 çağrı). Ucuz model seçimi bu sonuca göre yapılacak.
- **Supabase'e ulaşılamıyor** ("tenant/user not found"). Projenin duraklatılmadığı ve `DATABASE_URL`'in güncel olduğu kontrol edilmeli.
- **`.env` içindeki `DEFAULT_LLM_MODEL`** eski değerdeyse `gemini-3.8-flash` yapılmalı. Kod eski değeri uyarıyla atlıyor.
- **`gpt-4o` 14 Ocak 2027'de API'den kalkıyor.** OpenAI kullanılacaksa yerine geçecek model seçilmeli.
- **Ödeme akışı canlı değil.** Paddle anahtarları tanımlanana kadar fatura ve ödeme olayı gelmez.
- Geliştirme ortamında arka uç kapalıyken Next'in yerel deposu devreye giriyor; Değişiklikler sayfasında bu durumda örnek setler şeritsiz görünüyor. Üretimde bu yol 502/504 döner.
- `review/web-altyapi` ve `review/web-sayfalar` dallarında bu dala alınmamış commit'ler var.
