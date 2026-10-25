# Model karşılaştırma testi

Claude Haiku 5.5, Gemini 3.5 Flash-Lite ve Gemini 3.8 Flash'ı aynı veriyle çalıştırır:

- **20 Copilot sorusu:** Üretimdeki `build_copilot_prompt` ve sistem talimatıyla, iki kurgusal site verisi üzerinde. 6 soru tuzak (cevap veride yok), 1 soru veri içinde prompt injection içerir.
- **10 öneri üretimi:** Teknik ajanın prompt düzeni ve ortak JSON şeması kullanılır; çıktı `RecommendationOutput` ile doğrulanır. 1 maddenin sayfa başlığında injection var.
- **8 değer önerisi:** Otomatik pilotun siteye yazacağı başlık, meta açıklaması ve JSON-LD. Kural kimlikleri üretimdekiyle aynı; prompt ve sistem talimatı üretimdeki içerik ve şema ajanından yakalanır. Önerilen değer `services/agents/proposed_change.py::build_proposed_change` kontrolünden geçerse kabul sayılır. 1 maddenin H1'inde injection var; diğerleri sayfada olmayan sayı, fiyat ya da tarih uydurmaya açık.

## Kurulum

```bash
uv pip install --python .venv/bin/python anthropic
```

Kök `.env` dosyasına ya da ortama `ANTHROPIC_API_KEY` ve `GOOGLE_API_KEY` (veya `GEMINI_API_KEY`) ekleyin.

## Çalıştırma

```bash
.venv/bin/python scripts/model_eval/run.py --dry-run
.venv/bin/python scripts/model_eval/run.py
```

Varsayılan düşünme ayarı Copilot için `low`, öneriler için `medium`. Değiştirmek için `--effort-copilot` ve `--effort-recs` kullanın. Tam çalıştırma 114 API çağrısı yapar; 90 çağrılık önceki tahminden orantıyla toplam maliyet 0,65 USD civarı. Yalnızca değer önerileri için `--only actions` 24 çağrı yapar.

## Değerlendirme

`results/<zaman>/` altında üç dosya oluşur:

- `summary.md`: Hata sayısı, süre, token, maliyet, 50 site için aylık tahmin, JSON/şema geçerliliği, tuzak ve injection sonuçları, kaynakta olmayan rakamlar. "Siteye yazılacak değerler" tablosu model başına doldurma, kabul oranı ve kabul edilen değer başına maliyeti verir; madde tablosunda reddedilen değerin gerekçesi görünür.
- `report.html`: Kör değerlendirme. Model adları gizli; her maddede en iyi yanıtı seçip hatalıları işaretleyin, sonra "Seçimleri indir".
- `key.json`: A/B/C ile model eşlemesi. Puanlamadan önce açmayın.

```bash
.venv/bin/python scripts/model_eval/report.py scripts/model_eval/results/<zaman> --score ~/Downloads/picks.json
```

Otomatik kontroller kaba sezgisel yöntemlerdir. Rakam ve tuzak kontrolü yalnızca elle bakılacak yerleri gösterir; asıl karar kör değerlendirmeyle verilir.
