// Yasaklı İngilizce terimler ve Türkçe karşılıkları packages/glossary/terms.json içinde; burada yalnızca ekranda kullanılan eşlemeler var.

/** Arama sonuç sayfası özellikleri; veri İngilizce anahtarla gelir, ekranda Google'ın Türkçe adı gösterilir. */
const SERP_FEATURE_LABELS: Record<string, string> = {
  "AI Overview": "AI Genel Bakış",
  "Featured Snippet": "Öne çıkan snippet",
  "People Also Ask": "Diğer kullanıcılar şunları da sordu",
  "Local Pack": "Yerel sonuçlar",
  "Video Pack": "Video sonuçları",
  SiteLinks: "Site bağlantıları",
};

export const serpFeatureLabel = (feature: string) => SERP_FEATURE_LABELS[feature] ?? feature;
