/**
 * United Kingdom (UK) Post-Brexit Regulatory & Advertising Compliance Rules Library
 * Covering UK Statutory Bodies & Codes:
 * - ASA (Advertising Standards Authority) & CAP Code (Rule 12 Health & POMs, Rule 3 Misleading, Rule 22 Vaping)
 * - Human Medicines Regulations 2012 (Regulation 284 POM advertising prohibition - Botox)
 * - CMA (Competition and Markets Authority) Green Claims Code & Digital Markets, Competition and Consumers (DMCC) Act 2024
 * - FCA (Financial Conduct Authority) PS23/6 Financial Promotions for Cryptoassets & FSMA 2000 Section 21
 * - Consumer Duty (FCA Principle 12)
 * - Tobacco and Related Products Regulations 2016 (TRPR)
 */

export type UkComplianceSector =
  | "HEALTH_ASA_CAP"
  | "FINANCIAL_FCA"
  | "GREEN_CLAIMS_CMA"
  | "CONSUMER_CMA_ASA"
  | "VAPING_TOBACCO_ASA";

export function getUkSectorName(sector: UkComplianceSector): string {
  switch (sector) {
    case "HEALTH_ASA_CAP":
      return "🏥 Sağlık & Reçeteli İlaç (ASA CAP / POM)";
    case "FINANCIAL_FCA":
      return "🪙 Finans & Kripto (FCA PS23/6)";
    case "GREEN_CLAIMS_CMA":
      return "🌿 Yeşil İddialar (CMA Green Claims)";
    case "CONSUMER_CMA_ASA":
      return "⏱️ Tüketici Hakları & Aciliyet (DMCC / ASA)";
    case "VAPING_TOBACCO_ASA":
      return "🚭 Vaping & Tütün (CAP Rule 22)";
    default:
      return sector;
  }
}

export interface UkComplianceViolation {
  ruleId: string;
  sector: UkComplianceSector;
  title: string;
  matchedPattern: string;
  contextSnippet: string;
  legalBasis: string;
  penaltyRisk: string;
  suggestedFix: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
}

export interface UkRuleDefinition {
  id: string;
  sector: UkComplianceSector;
  title: string;
  patterns: RegExp[];
  legalBasis: string;
  penaltyRisk: string;
  suggestedFix: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
}

export const UK_COMPLIANCE_RULES: UkRuleDefinition[] = [
  // 1. Health, POMs & Cosmetic Injections (ASA CAP Rule 12 & Human Medicines Regulations 2012)
  {
    id: "UK_ASA_POM_BOTOX",
    sector: "HEALTH_ASA_CAP",
    title: "Reçeteli İlaç (Botox / POM) Halka Açık Reklam Yasağı",
    patterns: [
      /\b(?:botox|botulinum\s+toxin|dysport|azzalure|bocouture|vistabel)\b/i,
      /\bbotox\s+(?:injections?|treatments?|clinic|filler|prices?|offers?)\b/i,
      /\bprescription[\s-]only\s+medicine\s+promotion\b/i,
      /\b(?:ozempic|wegovy)\s+(?:weight\s+loss|slimming|sale|buy)\b/i,
    ],
    legalBasis: "UK ASA CAP Code Rule 12.12 & Human Medicines Regulations 2012 (Regulation 284)",
    penaltyRisk: "ASA kamuya açık resmi kınama kararı, MHRA ceza soruşturması, arama motoru ve sosyal medya reklam hesaplarının kapatılması.",
    suggestedFix: "Botox, Vistabel gibi reçeteli marka isimlerini kaldırın; 'consultation for facial aesthetics' veya 'anti-wrinkle treatment' gibi genel klinik terimler kullanın.",
    severity: "CRITICAL",
  },
  {
    id: "UK_ASA_HEALTH_CURE_CLAIM",
    sector: "HEALTH_ASA_CAP",
    title: "Kanıtlanmamış Tıbbi Tedavi & Mucizevi İyileşme Vaadi",
    patterns: [
      /\b(?:cures?|eradicate)\s+cancer\b/i,
      /\bmiracle\s+(?:cure|healing|remedy|treatment)\b/i,
      /\b100%\s+guaranteed\s+(?:cure|recovery|healing)\b/i,
      /\bproven\s+cure\s+for\s+(?:diabetes|arthritis|autism|cancer)\b/i,
      /\bguaranteed\s+slimming\b/i,
      /\beffortless\s+fat\s+(?:burning|loss)\b/i,
    ],
    legalBasis: "UK ASA CAP Code Rule 12.1 (Objective claims must be backed by robust scientific evidence) & Rule 12.2",
    penaltyRisk: "ASA yanıltıcı reklam kararı, Trading Standards yasal yaptırımları ve reklamın yayından kaldırılması.",
    suggestedFix: "Mutlak iyileşme vaatlerini kaldırın; bağımsız klinik çalışmalarla desteklenen 'destekleyebilir / katkı sağlayabilir' formunu kullanın.",
    severity: "CRITICAL",
  },

  // 2. Financial Conduct Authority (FCA PS23/6 & FSMA 2000 Section 21)
  {
    id: "UK_FCA_CRYPTO_PROMOTION",
    sector: "FINANCIAL_FCA",
    title: "FCA Kripto Promosyon İhlali: Zorunlu Risk Uyarısı Eksik",
    patterns: [
      /\b(?:guaranteed|risk[\s-]free|zero[\s-]risk)\s+crypto(?:currency)?\b/i,
      /\b100%\s+profit\s+crypto\b/i,
      /\bfree\s+crypto\s+on\s+sign[\s-]up\b/i,
      /\brefer\s+a\s+friend\s+(?:crypto|bonus)\b/i,
      /\bpassive\s+crypto\s+income\s+guaranteed\b/i,
    ],
    legalBasis: "FCA Financial Promotions Regime for Cryptoassets (PS23/6 & FSMA 2000 Section 21)",
    penaltyRisk: "FSMA 2000 Bölüm 21 uyarınca suç, sınırsız adli para cezası, FCA uyarı listesi, web sitesi ve mobil uygulama erişim engeli.",
    suggestedFix: "Yasal FCA risk uyarısını ekleyin: 'Don’t invest unless you’re prepared to lose all the money you invest. This is a high-risk investment.'",
    severity: "CRITICAL",
  },
  {
    id: "UK_FCA_GUARANTEED_RETURNS",
    sector: "FINANCIAL_FCA",
    title: "Yüksek Riskli Finansal Ürünlerde Garantili Getiri Vaadi",
    patterns: [
      /\bguaranteed\s+(?:returns?|profits?|yields?)\s+on\s+investments?\b/i,
      /\brisk[\s-]free\s+(?:forex|trading|stocks?|investing)\b/i,
      /\b100%\s+capital\s+guaranteed\s+(?:trading|crypto)\b/i,
    ],
    legalBasis: "FCA Consumer Duty (Principle 12) & Financial Promotions Rules (COBS 4)",
    penaltyRisk: "FCA adli takibatı, tazminat kararları ve İngiltere finansal piyasalarından men cezası.",
    suggestedFix: "Sermayenin risk altında olduğunu açıkça belirtin: 'Capital at risk. Past performance is no guarantee of future results.'",
    severity: "CRITICAL",
  },

  // 3. CMA Green Claims Code & DMCC Act 2024
  {
    id: "UK_CMA_GREENWASHING",
    sector: "GREEN_CLAIMS_CMA",
    title: "CMA Yeşil Aklama (Greenwashing) ve Kanıtsız Eko İddiası",
    patterns: [
      /\b100%\s+(?:eco[\s-]friendly|green|sustainable|natural)\b/i,
      /\bcompletely\s+(?:eco[\s-]friendly|sustainable|carbon[\s-]free)\b/i,
      /\bzero\s+carbon\s+product\b/i,
      /\bthe\s+greenest\s+(?:choice|product|brand)\b/i,
      /\bplanet[\s-]positive\s+product\b/i,
    ],
    legalBasis: "CMA Green Claims Code Guidance & Digital Markets, Competition and Consumers (DMCC) Act 2024",
    penaltyRisk: "CMA tarafından küresel yıllık cironun %10'una kadar doğrudan idari para cezası yaptırımı.",
    suggestedFix: "'100% eco-friendly' gibi mutlak sıfatlar yerine ölçülebilir yaşam döngüsü verisi verin (örn: 'Üretiminde %85 geri dönüştürülmüş hammadde kullanılmıştır').",
    severity: "HIGH",
  },

  // 4. Consumer Protection & Dark Patterns (DMCC Act 2024 & CAP Rule 3)
  {
    id: "UK_CMA_DARK_PATTERNS",
    sector: "CONSUMER_CMA_ASA",
    title: "Tüketiciyi Aldatıcı Sahte Kıtlık ve Aciliyet Baskısı (Dark Pattern)",
    patterns: [
      /\bonly\s+\d+\s+left\s+in\s+stock\b/i,
      /\boffer\s+expires\s+in\s+\d+\s+minutes?\b/i,
      /\bcountdown\s+timer\s+hurry\b/i,
      /\bbest\s+price\s+guaranteed\s+in\s+the\s+uk\b/i,
    ],
    legalBasis: "DMCC Act 2024 (Schedule 20 Banned Commercial Practices) & ASA CAP Code Rule 3.1",
    penaltyRisk: "CMA ve Trading Standards tüketiciyi yanıltıcı ticari uygulama cezaları ve kamuya açık ifşa.",
    suggestedFix: "Stok sayaçlarının gerçek ERP verisiyle eşleştiğini belgeleyin ya da yapay aciliyet baskısı oluşturan sayaçları kaldırın.",
    severity: "HIGH",
  },

  // 5. Nicotine Vaping & Tobacco (CAP Rule 22 & TRPR 2016)
  {
    id: "UK_ASA_VAPING_PROMOTION",
    sector: "VAPING_TOBACCO_ASA",
    title: "Elektronik Sigara ve Vaping Ürünlerinin Tanıtım Yasağı",
    patterns: [
      /\b(?:disposable\s+vape|elf\s+bar|geek\s+bar|crystal\s+bar)\s+(?:promotion|sale|deal)\b/i,
      /\bbuy\s+nicotine\s+vapes?\s+online\b/i,
      /\bcheap\s+disposable\s+vapes?\b/i,
    ],
    legalBasis: "UK ASA CAP Code Rule 22.12 & Tobacco and Related Products Regulations 2016 (TRPR)",
    penaltyRisk: "Trading Standards ürün toplatma, el koyma ve ASA reklam engelleme yaptırımları.",
    suggestedFix: "Ruhsatsız nikotinli ürünlerin halka açık web sitelerinde promosyon ve indirimli satış reklamlarını kaldırın.",
    severity: "CRITICAL",
  },
];

export function scanTextForUkCompliance(text: string): UkComplianceViolation[] {
  if (!text || !text.trim()) return [];

  const violations: UkComplianceViolation[] = [];

  for (const rule of UK_COMPLIANCE_RULES) {
    for (const pattern of rule.patterns) {
      const match = pattern.exec(text);
      if (match) {
        const matchIndex = match.index;
        const start = Math.max(0, matchIndex - 35);
        const end = Math.min(text.length, matchIndex + match[0].length + 35);
        const snippet = `...${text.slice(start, end).trim()}...`;

        violations.push({
          ruleId: rule.id,
          sector: rule.sector,
          title: rule.title,
          matchedPattern: match[0],
          contextSnippet: snippet,
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
