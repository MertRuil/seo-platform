/**
 * Middle East & Gulf (MENA / GCC) Regulatory & Advertising Compliance Rules Library
 * Covering Statutory Frameworks & Regulatory Guidelines across Key Gulf Markets:
 * - United Arab Emirates (UAE):
 *   * UAE Media Council (Federal Decree-Law No. 55 of 2023 on Regulation of Media)
 *   * TDRA (Telecommunications and Digital Government Regulatory Authority)
 *   * Ministry of Health and Prevention (MOHAP - Federal Law No. 4 of 1983 & Ministerial Decree 430/2007)
 *   * Dubai Virtual Assets Regulatory Authority (VARA Marketing Regulations 2023)
 *   * Dubai Land Department (RERA Trakheesi Permit Requirements)
 * - Kingdom of Saudi Arabia (KSA):
 *   * General Authority of Media Regulation (GAMR / Mawthooq 'موثوق' License)
 *   * Saudi Food and Drug Authority (SFDA - Health & Food Products Advertising Regulations)
 *   * Ministry of Commerce (E-Commerce Law - Royal Decree M/126, 2019)
 *   * Saudi Central Bank (SAMA Directives)
 *   * Real Estate General Authority (REGA - Fal License 'رخصة فال' Advertising Rules)
 */

export type MenaComplianceSector =
  | "ISLAMIC_VALUES_PUBLIC_MORALS"
  | "HEALTH_MEDICAL_MOHAP_SFDA"
  | "INFLUENCER_MAWTHOOQ_NMC"
  | "FINANCIAL_CRYPTO_VARA_SAMA"
  | "ECOMMERCE_REAL_ESTATE_FAL"
  | "VAPING_TOBACCO_BAN_MENA";

export interface MenaComplianceViolation {
  ruleId: string;
  sector: MenaComplianceSector;
  title: string;
  matchedPattern: string;
  contextSnippet: string;
  legalBasis: string;
  penaltyRisk: string;
  suggestedFix: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
}

export interface MenaRuleDefinition {
  id: string;
  sector: MenaComplianceSector;
  title: string;
  patterns: RegExp[];
  legalBasis: string;
  penaltyRisk: string;
  suggestedFix: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
}

export const MENA_COMPLIANCE_RULES: MenaRuleDefinition[] = [
  // 1. Respect for Islamic Values, Public Morals, Gambling & Alcohol Ban
  {
    id: "MENA_ISLAMIC_MORALS_GAMBLING_ALCOHOL",
    sector: "ISLAMIC_VALUES_PUBLIC_MORALS",
    title: "Kumar, Bahis ve Ruhsatsız Alkol Tanıtımı Yasağı",
    patterns: [
      /\b(?:online\s+casino|sports\s+betting|play\s+poker\s+for\s+real\s+money|live\s+roulette\s+betting)\b/i,
      /\b(?:best\s+gambling\s+sites\s+dubai|win\s+real\s+cash\s+gambling\s+saudi)\b/i,
      /\b(?:buy\s+alcohol\s+online\s+riyadh|cheap\s+liquor\s+delivery\s+uae)\b/i,
      /(?:كازينو\s+أونلاين|مراهنات\s+رياضية|ألعاب\s+قمار\s+بأموال\s+حقيقية|موقع\s+مراهنات)/i,
      /(?:شراء\s+خمور\s+أونلاين|توصيل\s+مشروبات\s+كحولية|شراء\s+كحول\s+بدون\s+تصريح)/i,
      /(?:قمار\s+عبر\s+الإنترنت|روليت\s+مباشر\s+بفلوس|لعب\s+بوكر\s+بأموال)/i,
    ],
    legalBasis: "BAE 55/2023 Sayılı Medya Düzenleme Kararnamesi (Md. 16/17) & Suudi Siber Suçlarla Mücadele Kanunu (M/17)",
    penaltyRisk: "1.000.000 AED / SAR'a kadar idari para cezası, TDRA/CITC tarafından anında site engelleme ve sınır dışı/adli yaptırım.",
    suggestedFix: "Kumar, lisanssız alkol ve İslami kamu ahlakına aykırı tüm tanıtım ifadelerini siteden tamamen kaldırın.",
    severity: "CRITICAL",
  },

  // 2. Health & Medical Advertising (MOHAP UAE / SFDA Saudi Arabia)
  {
    id: "MENA_MOHAP_SFDA_MIRACLE_CURES",
    sector: "HEALTH_MEDICAL_MOHAP_SFDA",
    title: "MOHAP / SFDA Onaysız Mucizevi Şifa ve Tedavi İddiaları",
    patterns: [
      /\b(?:guaranteed\s+cure\s+for\s+diabetes|100%\s+cancer\s+cure|permanent\s+treatment\s+for\s+hypertension)\b/i,
      /\b(?:miracle\s+cure\s+for\s+chronic\s+illness|instant\s+slimming\s+guaranteed|lose\s+10kg\s+in\s+7\s+days)\b/i,
      /(?:علاج\s+نهائي\s+للسكري|شفاء\s+تام\s+من\s+السرطان|خلطة\s+سحرية\s+لعلاج|علاج\s+فوري\s+للضغط)/i,
      /(?:تخسيس\s+10\s+كيلو\s+في\s+أسبوع\s+مضمون|علاج\s+معجزة\s+للأمراض|يقضي\s+على\s+الورم\s+نهائياً)/i,
      /(?:علاج\s+العقم\s+بشكل\s+مضمون|تخلص\s+من\s+الصلع\s+في\s+3\s+أيام)/i,
    ],
    legalBasis: "BAE MOHAP 430/2007 Sayılı Bakanlık Kararı & Suudi SFDA Sağlık ve Gıda Reklamları İcra Yönetmeliği",
    penaltyRisk: "500.000 AED / SAR'a kadar para cezası, sağlık lisansı iptali ve adli kovuşturma.",
    suggestedFix: "Mutlak şifa vaatlerini kaldırarak kanıta dayalı ifadeler kullanın ve resmi MOHAP / SFDA reklam izin numarasını belirtin.",
    severity: "CRITICAL",
  },
  {
    id: "MENA_MOHAP_SFDA_PRESCRIPTION_DRUGS",
    sector: "HEALTH_MEDICAL_MOHAP_SFDA",
    title: "Reçeteli İlaçların (POM) Kamuya Açık Online Satışı ve Tanıtımı Yasağı",
    patterns: [
      /\b(?:buy\s+ozempic\s+without\s+prescription|order\s+xanax\s+online\s+dubai|botox\s+injections\s+for\s+sale)\b/i,
      /\b(?:buy\s+antibiotics\s+online\s+saudi|prescription\s+medicines\s+home\s+delivery\s+no\s+rx)\b/i,
      /(?:شراء\s+أوزمبيك\s+بدون\s+وصفة|حبوب\s+إجهاض\s+للبيع|شراء\s+ترامادول\s+أونلاين)/i,
      /(?:شراء\s+مضادات\s+حيوية\s+بدون\s+روشتة|توصيل\s+أدوية\s+مقيدة\s+بدون\s+وصفة)/i,
    ],
    legalBasis: "BAE 1983/4 Sayılı İlaç Kanunu & Suudi Eczacılık ve Tıbbi Ürünler Kanunu (M/31)",
    penaltyRisk: "1.000.000 SAR / AED para cezası, yasadışı ilaç dağıtımı gerekçesiyle hapis cezası ve gümrük el koyması.",
    suggestedFix: "Reçeteli ilaçların online satış ve tanıtımını durdurun; yalnızca yetkili klinik randevusu ve hekim reçetesi yönlendirmesi yapın.",
    severity: "CRITICAL",
  },

  // 3. Influencer & Advertiser Disclosures (UAE NMC / Saudi Mawthooq)
  {
    id: "MENA_INFLUENCER_MAWTHOOQ_NMC_DISCLOSURE",
    sector: "INFLUENCER_MAWTHOOQ_NMC",
    title: "Gizli Reklam ve Mawthooq (موثوق) / BAE Medya Lisansı Bildirim Eksikliği",
    patterns: [
      /\b(?:unbiased\s+review\s+not\s+an\s+ad|honest\s+personal\s+opinion\s+zero\s+sponsorship)\b/i,
      /(?:تجربة\s+شخصية\s+غير\s+مدفوعة|تقييم\s+صادق\s+ليس\s+إعلاناً|نصيحة\s+لوجه\s+الله\s+بدون\s+إعلان)/i,
      /(?:إعلان\s+بدون\s+ترخيص\s+موثوق|تسويق\s+بدون\s+تصريح\s+إعلامي)/i,
    ],
    legalBasis: "BAE Medya Konseyi 2017/23 Sayılı Karar & Suudi GAMR Mawthooq ('موثوق') Reklam Rehberi",
    penaltyRisk: "500.000 SAR / AED'ye varan para cezası, reklam lisansının iptali ve sosyal medya kanallarının askıya alınması.",
    suggestedFix: "Açıkça Arapça/İngilizce ticari etiket (#إعلان veya #Ad / إعلان مدفوع) ekleyin ve aktif Mawthooq/NMC reklam lisans numarasını belirtin.",
    severity: "HIGH",
  },

  // 4. Financial & Virtual Asset Promotions (UAE VARA / Saudi SAMA)
  {
    id: "MENA_VARA_SAMA_CRYPTO_UNAUTHORIZED_RETURNS",
    sector: "FINANCIAL_CRYPTO_VARA_SAMA",
    title: "Yetkisiz Kripto / Forex Reklamı ve Sıfır Risk / Garanti Getiri Vaatleri",
    patterns: [
      /\b(?:guaranteed\s+(?:weekly|monthly|annual)\s+returns?|zero\s+risk\s+investment\s+dubai)\b/i,
      /\b(?:get\s+rich\s+quick\s+crypto\s+trading|double\s+your\s+money\s+in\s+24\s+hours)\b/i,
      /(?:عائد\s+استثماري\s+مضمون|أرباح\s+يومية\s+مؤكدة|استثمار\s+بدون\s+أي\s+مخاطرة)/i,
      /(?:ثراء\s+سريع\s+من\s+التداول|مضاعفة\s+رأس\s+المال\s+في\s+24\s+ساعة|تداول\s+خيارات\s+ثنائية\s+مضمونة)/i,
      /(?:تداول\s+فوركس\s+غير\s+مرخص|استثمار\s+عملات\s+رقمية\s+بعائد\s+ثابت)/i,
    ],
    legalBasis: "Dubai VARA 2023 Pazarlama Yönetmeliği & Suudi Merkez Bankası (SAMA) Tüketici Koruma İlkeleri",
    penaltyRisk: "VARA tarafından 10.000.000 AED'ye kadar ceza, varlık dondurma ve SAMA/DFSA adli dolandırıcılık sevki.",
    suggestedFix: "Zorunlu yasal risk uyarısını ekleyin ('Kripto varlık yatırımları yüksek risk içerir...') ve resmi VARA/SAMA lisans numarasını gösterin.",
    severity: "CRITICAL",
  },

  // 5. E-Commerce & Real Estate Licensing (KSA Fal / Dubai RERA Trakheesi)
  {
    id: "MENA_REGA_FAL_RERA_UNLICENSED_REAL_ESTATE",
    sector: "ECOMMERCE_REAL_ESTATE_FAL",
    title: "Lisanssız Emlak Reklamı (Suudi Fal / Dubai RERA Trakheesi İhlali)",
    patterns: [
      /\b(?:luxury\s+villa\s+for\s+sale\s+no\s+license\s+needed|direct\s+property\s+sale\s+without\s+rera)\b/i,
      /(?:عقارات\s+للبيع\s+بدون\s+ترخيص\s+فال|فيلا\s+للبيع\s+بدون\s+تصريح\s+إعلاني)/i,
      /(?:شقق\s+للبيع\s+بدون\s+رقم\s+ترخيص\s+تراخيص|تسويق\s+عقاري\s+بدون\s+رخصة\s+فال)/i,
    ],
    legalBasis: "Suudi Gayrimenkul Genel Otoritesi (REGA - Fal Kanunu) & Dubai Tapu Dairesi (RERA Trakheesi)",
    penaltyRisk: "200.000 SAR / AED para cezası, emlak portallarından ve arama motoru dizinlerinden zorunlu çıkarma.",
    suggestedFix: "Zorunlu emlak yetki lisansını belirtin: Suudi Fal Lisans Numarası (رقم رخصة فال) veya Dubai RERA Trakheesi İzin Numarası (رقم تصريح تراخيص).",
    severity: "HIGH",
  },

  // 6. Tobacco & Nicotine Vaping Promotion (ESMA UAE / SFDA KSA)
  {
    id: "MENA_TOBACCO_VAPING_PROMOTION",
    sector: "VAPING_TOBACCO_BAN_MENA",
    title: "Ruhsatsız Tütün ve Elektronik Sigara (Vape) Pazarlaması Yasağı",
    patterns: [
      /\b(?:buy\s+disposable\s+vape\s+no\s+id\s+required|flavoured\s+nicotine\s+pods\s+home\s+delivery)\b/i,
      /\b(?:cheap\s+e-cigarettes\s+express\s+delivery\s+riyadh|vape\s+delivery\s+dubai\s+cash\s+on\s+delivery)\b/i,
      /(?:توصيل\s+فيب\s+بدون\s+تحقق\s+من\s+العمر|شراء\s+سحبة\s+سيجارة\s+أونلاين|نكهات\s+فيب\s+مع\s+توصيل\s+سريع)/i,
      /(?:سجائر\s+إلكترونية\s+رخيصة\s+توصيل\s+فوري|شراء\s+شيشة\s+إلكترونية\s+أونلاين)/i,
    ],
    legalBasis: "BAE ESMA Teknik Düzenlemeleri & Suudi SFDA Tütün Kontrol Kanunu",
    penaltyRisk: "500.000 AED / SAR ceza, ürünlere gümrük el koyması ve e-ticaret mağazasının kapatılması.",
    suggestedFix: "Tütün ve elektronik nikotin cihazlarının halka açık doğrudan pazarlamasını durdurun.",
    severity: "CRITICAL",
  },
];

function normalizeMenaArabicText(text: string): string {
  if (!text) return "";
  return text
    .replace(/[\u064B-\u0652]/g, "") // Diacritics
    .replace(/[إأآا]/g, "ا") // Alef
    .replace(/ة/g, "ه") // Teh marbuta
    .replace(/ى/g, "ي"); // Yeh / Alef maksura
}

export function scanTextForMenaCompliance(
  text: string,
  sectorFilter?: MenaComplianceSector
): MenaComplianceViolation[] {
  if (!text) return [];

  const norm = normalizeMenaArabicText(text);
  const violations: MenaComplianceViolation[] = [];

  for (const rule of MENA_COMPLIANCE_RULES) {
    if (sectorFilter && rule.sector !== sectorFilter) continue;

    for (const pat of rule.patterns) {
      const match = norm.match(pat);
      if (match) {
        const matched = match[0];
        const matchIdx = match.index || 0;
        const start = Math.max(0, matchIdx - 35);
        const end = Math.min(norm.length, matchIdx + matched.length + 35);
        const snippet = norm.slice(start, end).trim();

        violations.push({
          ruleId: rule.id,
          sector: rule.sector,
          title: rule.title,
          matchedPattern: matched,
          contextSnippet: `...${snippet}...`,
          legalBasis: rule.legalBasis,
          penaltyRisk: rule.penaltyRisk,
          suggestedFix: rule.suggestedFix,
          severity: rule.severity,
        });
        break; // Match first pattern per rule
      }
    }
  }

  return violations;
}

export function getMenaSectorName(sector: MenaComplianceSector): string {
  switch (sector) {
    case "ISLAMIC_VALUES_PUBLIC_MORALS":
      return "İslami Değerler, Kumar & Alkol (TDRA / GCAM)";
    case "HEALTH_MEDICAL_MOHAP_SFDA":
      return "Sağlık & Tıbbi İddialar (MOHAP / SFDA)";
    case "INFLUENCER_MAWTHOOQ_NMC":
      return "Gizli Reklam & Mawthooq Lisansı (NMC / GAMR)";
    case "FINANCIAL_CRYPTO_VARA_SAMA":
      return "Kripto & Garanti Getiri (VARA / SAMA)";
    case "ECOMMERCE_REAL_ESTATE_FAL":
      return "E-Ticaret & Emlak Lisansı (Fal / RERA)";
    case "VAPING_TOBACCO_BAN_MENA":
      return "Tütün & Elektronik Sigara (ESMA / SFDA)";
    default:
      return sector;
  }
}
