/**
 * Türkiye Cumhuriyeti Ticaret Bakanlığı Reklam Kurulu, TİTCK, TBB, SPK ve BDDK
 * mevzuatlarına göre sektörel olarak yasaklanmış Türkçe kelime ve iddia kalıpları kütüphanesi.
 */

export type ComplianceSector =
  | "HEALTH_MEDICAL"
  | "FOOD_SUPPLEMENT"
  | "LEGAL_SERVICES"
  | "FINANCIAL_SERVICES"
  | "SUPERLATIVE_COMMERCIAL"
  | "ILLEGAL_BETTING_TOBACCO";

export interface ComplianceViolation {
  ruleId: string;
  sector: ComplianceSector;
  title: string;
  matchedPattern: string;
  contextSnippet: string;
  legalBasis: string;
  penaltyRisk: string;
  suggestedFix: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
}

export function normalizeTurkish(text: string): string {
  if (!text) return "";
  let s = text.replace(/İ/g, "i").replace(/I/g, "i").replace(/ı/g, "i");
  s = s.replace(/Ğ/g, "g").replace(/ğ/g, "g");
  s = s.replace(/Ü/g, "u").replace(/ü/g, "u");
  s = s.replace(/Ş/g, "s").replace(/ş/g, "s");
  s = s.replace(/Ö/g, "o").replace(/ö/g, "o");
  s = s.replace(/Ç/g, "c").replace(/ç/g, "c");
  return s.toLowerCase().replace(/\u0307/g, "");
}

export interface RuleDefinition {
  id: string;
  sector: ComplianceSector;
  title: string;
  patterns: RegExp[];
  legalBasis: string;
  penaltyRisk: string;
  suggestedFix: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
}

export const TURKISH_COMPLIANCE_RULES: RuleDefinition[] = [
  // 1. Sağlık ve Tıbbi İddialar (TİTCK & Sağlık Bakanlığı)
  {
    id: "TR_HEALTH_TREATMENT",
    sector: "HEALTH_MEDICAL",
    title: "Tıbbi Tedavi ve Kesin Şifa Vaadi Yasağı",
    patterns: [
      /\btedavi\s+eder\b/i,
      /\bkesin\s+tedavi\b/i,
      /\bgarantili\s+tedavi\b/i,
      /\bsifa\s+bul\b/i,
      /\bhastaligi\s+yok\s+eder\b/i,
      /\btedavisi\s+%?100\b/i,
      /\bmucize\s+tedavi\b/i,
      /\bkokten\s+cozum\b/i,
    ],
    legalBasis: "1219 sayılı Tababet Kanunu & Sağlık Hizmetlerinde Tanıtım ve Bilgilendirme Yönetmeliği md. 5",
    penaltyRisk: "TİTCK ve Reklam Kurulu tarafından idari para cezası ve reklam durdurma.",
    suggestedFix: "'Tedavi sürecini destekler' veya 'Hekim kontrolünde değerlendirilmelidir' ifadesini kullanın.",
    severity: "CRITICAL",
  },
  {
    id: "TR_HEALTH_SUPERLATIVE",
    sector: "HEALTH_MEDICAL",
    title: "Hekim / Klinik Üstünlük ve Talep Yaratma Yasağı",
    patterns: [
      /\ben\s+iyi\s+doktor\b/i,
      /\ben\s+iyi\s+cerrah\b/i,
      /\ben\s+iyi\s+hekim\b/i,
      /\ben\s+basarili\s+cerrah\b/i,
      /\b1\s+numarali\s+klinik\b/i,
      /\bturkiye'?nin\s+en\s+iyi\s+(?:hastanesi|klinigi)\b/i,
      /\ben\s+iyi\s+dis\s+hekimi\b/i,
    ],
    legalBasis: "Sağlık Hizmetlerinde Tanıtım Yönetmeliği md. 5/1-ç (Haksız rekabet ve üstünlük iddiası yasağı)",
    penaltyRisk: "Reklam Kurulu para cezası ve Tabip Odası disiplin cezası.",
    suggestedFix: "Üstünlük sıfatı yerine yalnızca hekimin unvanını ve deneyim alanlarını yalın belirtin.",
    severity: "HIGH",
  },
  {
    id: "TR_HEALTH_BEFORE_AFTER",
    sector: "HEALTH_MEDICAL",
    title: "Önce-Sonra (Before-After) ve Sıfır Risk Vaadi Yasağı",
    patterns: [
      /\boncesi\s+sonrasi\b/i,
      /\bbefore\s+after\b/i,
      /\bonce\s+sonra\s+fotograflar\b/i,
      /\bgarantili\s+sonuc\b/i,
      /\bagrisiz\s+acisiz\s+kesin\b/i,
      /\bsifir\s+risk\b/i,
      /\byan\s+etkisi\s+yoktur\b/i,
    ],
    legalBasis: "Sağlık Hizmetlerinde Tanıtım Yönetmeliği md. 5/1-d",
    penaltyRisk: "Web sayfasına erişim engeli ve idari para cezası.",
    suggestedFix: "'Tedavi süreci hakkında hekiminize danışınız' şeklinde genel bilgilendirme yapın.",
    severity: "CRITICAL",
  },

  // 2. Gıda Takviyeleri & Zayıflama
  {
    id: "TR_FOOD_WEIGHT_LOSS",
    sector: "FOOD_SUPPLEMENT",
    title: "Takviyelerde Zayıflama ve Tıbbi Etki İddiası Yasağı",
    patterns: [
      /\bzayiflati(?:r|yor)\b/i,
      /\byag\s+yakici\s+garanti\b/i,
      /\b1\s+haftada\s+\d+\s+kilo\b/i,
      /\bistahi\s+tamamen\s+keser\b/i,
      /\bkanseri\s+onler\b/i,
      /\bsekeri\s+dusurur\b/i,
      /\btansiyonu\s+dengeler\b/i,
    ],
    legalBasis: "Türk Gıda Kodeksi Beslenme ve Sağlık Beyanları Yönetmeliği & Tüketici Kanunu md. 61",
    penaltyRisk: "Ticaret Bakanlığı Reklam Kurulu tarafından en üst sınırdan idari para cezası ve ürün toplatma.",
    suggestedFix: "'Tokluk hissine yardımcı olabilir' veya 'Normal metabolizmayı destekler' gibi onaylı beyanlar kullanın.",
    severity: "CRITICAL",
  },
  {
    id: "TR_FOOD_MINISTRY",
    sector: "FOOD_SUPPLEMENT",
    title: "Sağlık Bakanlığı Onaylı Takviye/İlaç Aldatmacası",
    patterns: [
      /\bsaglik\s+bakanligi\s+onayli\b/i,
      /\bbakanlik\s+onayli\s+ilac\b/i,
      /\bdoktor\s+tavsiyeli\s+takviye\b/i,
      /\bprofesor\s+onayli\b/i,
    ],
    legalBasis: "TİTCK Takviye Edici Gıda Kılavuzu (Gıda takviyeleri Sağlık Bakanlığı değil, Tarım Bakanlığı onaylıdır)",
    penaltyRisk: "Nitelikli tüketici aldatmasından doğrudan savcılık bildirimi ve idari para cezası.",
    suggestedFix: "'T.C. Tarım ve Orman Bakanlığı Onaylı Takviye Edici Gıda No: ...' ruhsat numarasını belirtin.",
    severity: "CRITICAL",
  },

  // 3. Hukuk ve Avukatlık (TBB)
  {
    id: "TR_LEGAL_SUPERLATIVE",
    sector: "LEGAL_SERVICES",
    title: "Avukatlıkta Üstünlük, Başarı ve Karşılaştırma Yasağı",
    patterns: [
      /\ben\s+iyi\s+avukat\b/i,
      /\ben\s+iyi\s+ceza\s+avukati\b/i,
      /\ben\s+basarili\s+avukat\b/i,
      /\buzman\s+bosanma\s+avukati\b/i,
      /\bturkiye'?nin\s+en\s+iyi\s+hukuk\s+burosu\b/i,
      /\b1\s+numarali\s+avukat\b/i,
    ],
    legalBasis: "1136 sayılı Avukatlık Kanunu md. 55 ve TBB Reklam Yasağı Yönetmeliği md. 7",
    penaltyRisk: "Baro Disiplin Kurulu soruşturması, kınama ve para cezası.",
    suggestedFix: "'Avukatlık ve Hukuki Danışmanlık' veya 'Çalışma Alanlarımız' ifadesini kullanın.",
    severity: "CRITICAL",
  },
  {
    id: "TR_LEGAL_GUARANTEE",
    sector: "LEGAL_SERVICES",
    title: "Dava Kazanma Garantisi ve Ücretsiz Hizmet Yasağı",
    patterns: [
      /\bdava\s+kazanma\s+garantisi\b/i,
      /\bkesin\s+beraat\b/i,
      /\btazminat\s+garantisi\b/i,
      /\b%100\s+basari\s+orani\b/i,
      /\bucretsiz\s+danismanlik\b/i,
      /\bucretsiz\s+dava\b/i,
      /\bindirimli\s+avukatlik\b/i,
    ],
    legalBasis: "Avukatlık Kanunu md. 164 (Asgari tarife altı iş yasağı) & TBB Meslek Kuralları",
    penaltyRisk: "Disiplin cezası ve haksız rekabet tazminatı.",
    suggestedFix: "'Hukuki süreç ve dava danışmanlığı için büromuzla iletişime geçebilirsiniz.'",
    severity: "CRITICAL",
  },

  // 4. Finans, Kredi ve Yatırım (SPK & BDDK)
  {
    id: "TR_FINANCE_RETURN",
    sector: "FINANCIAL_SERVICES",
    title: "Finansta Kesin Kazanç ve Garantili Getiri Vaadi Yasağı",
    patterns: [
      /\bkesin\s+kazanc\b/i,
      /\bgarantili\s+getiri\b/i,
      /\bkayipsiz\s+yatirim\b/i,
      /\bgunluk\s+%\s*\d+\s+kar\b/i,
      /\bzengin\s+olma\s+garantisi\b/i,
      /\bkesin\s+al-sat\s+sinyali\b/i,
      /\b%100\s+kazandiran\s+bot\b/i,
    ],
    legalBasis: "6362 sayılı Sermaye Piyasası Kanunu md. 106-107 (Piyasa Dolandırıcılığı)",
    penaltyRisk: "SPK idari para cezası ve adli işlem.",
    suggestedFix: "'Yatırımlar piyasa riski içerir, geçmiş getiri gelecek için garanti teşkil etmez.'",
    severity: "CRITICAL",
  },
  {
    id: "TR_FINANCE_LOAN",
    sector: "FINANCIAL_SERVICES",
    title: "Yetkisiz Kredi, Tefecilik ve Sicil Yok Sayma Reklamı",
    patterns: [
      /\bsicili\s+bozuklara\s+kredi\b/i,
      /\bkredi\s+notu\s+onemsiz\b/i,
      /\bsenetlen\s+kredi\b/i,
      /\bsenete\s+kredi\b/i,
      /\btefeci\s+kredi\b/i,
      /\bkefilsiz\s+sartsiz\s+aninda\s+para\b/i,
      /\bbanka\s+harici\s+kredi\b/i,
    ],
    legalBasis: "5411 sayılı Bankacılık Kanunu md. 150 & TCK md. 241 (Tefecilik Suçu)",
    penaltyRisk: "Savcılık soruşturması ve BTK tarafından anında erişim engeli.",
    suggestedFix: "Sadece yetkili banka ve finansman kuruluşlarının resmi faiz oranlarını listeleyin.",
    severity: "CRITICAL",
  },

  // 5. E-Ticaret ve Genel Ticari Reklam (Ticaret Bakanlığı)
  {
    id: "TR_COMMERCIAL_SUPERLATIVE",
    sector: "SUPERLATIVE_COMMERCIAL",
    title: "Kanıtlanamayan Üstünlük İddiası ('En Ucuz', 'Rakipsiz')",
    patterns: [
      /\bturkiye'?nin\s+en\s+ucuzu\b/i,
      /\ben\s+ucuz\s+fiyat\b/i,
      /\brakipsiz\s+fiyat\b/i,
      /\bdunyanin\s+en\s+iyisi\b/i,
      /\brakipsiz\s+kalite\b/i,
      /\btek\s+adres\b/i,
    ],
    legalBasis: "Ticari Reklam ve Haksız Ticari Uygulamalar Yönetmeliği md. 7-8-9 (İspat Zorunluluğu)",
    penaltyRisk: "Akredite pazar raporu olmadan kullanımı halinde Reklam Kurulu para cezası.",
    suggestedFix: "'Avantajlı fiyat seçenekleri' veya 'Rekabetçi fiyatlar' ifadesini tercih edin.",
    severity: "HIGH",
  },
  {
    id: "TR_COMMERCIAL_RETURN",
    sector: "SUPERLATIVE_COMMERCIAL",
    title: "Koşulsuz Şartsız İade Yanıltmacası",
    patterns: [
      /\bkosulsuz\s+sartsiz\s+iade\b/i,
      /\bsartsiz\s+iade\s+garantisi\b/i,
    ],
    legalBasis: "Mesafeli Sözleşmeler Yönetmeliği md. 15 (Cayma hakkı istisnaları)",
    penaltyRisk: "Tüketiciyi cayma hakkı konusunda yanıltmaktan dolayı idari yaptırım.",
    suggestedFix: "'Yasal cayma hakkı kapsamında 14 gün içinde kolay iade imkanı'",
    severity: "MEDIUM",
  },

  // 6. Yasadışı Bahis ve Tütün
  {
    id: "TR_ILLEGAL_BETTING",
    sector: "ILLEGAL_BETTING_TOBACCO",
    title: "Yasadışı Bahis ve Kumar Terimleri",
    patterns: [
      /\bcanli\s+bahis\s+oyna\b/i,
      /\bkacak\s+iddaa\b/i,
      /\bbonus\s+veren\s+bahis\s+siteleri\b/i,
      /\bcasino\s+slot\s+oyna\b/i,
      /\bsweet\s+bonanza\s+taktikleri\b/i,
      /\bguvenilir\s+bahis\s+sitesi\b/i,
    ],
    legalBasis: "7258 sayılı Kanun md. 5 & TCK md. 228",
    penaltyRisk: "Hapis cezası ve BTK tarafından re'sen anında site kapatma.",
    suggestedFix: "Yasadışı bahis içeriği barındırılamaz, derhal kaldırılmalıdır.",
    severity: "CRITICAL",
  },
  {
    id: "TR_TOBACCO_VAPE",
    sector: "ILLEGAL_BETTING_TOBACCO",
    title: "Tütün, Nargile ve Elektronik Sigara Satış/Tanıtım Yasağı",
    patterns: [
      /\belektronik\s+sigara\s+satin\s+al\b/i,
      /\biqos\s+siparis\b/i,
      /\bpuff\s+bar\s+fiyat\b/i,
      /\bvape\s+likit\s+al\b/i,
      /\bnargile\s+tutunu\s+siparis\b/i,
    ],
    legalBasis: "4207 sayılı Kanun ve Cumhurbaşkanlığı Kararı 2149",
    penaltyRisk: "Kaçakçılıkla Mücadele Kanunu kapsamında adli işlem ve site engelleme.",
    suggestedFix: "Tütün ve nikotin ürünlerinin internet ortamında satışı ve tanıtımı tamamen yasaktır.",
    severity: "CRITICAL",
  },
];

export function scanTurkishCompliance(text: string, sector?: ComplianceSector): ComplianceViolation[] {
  if (!text) return [];
  const normalized = normalizeTurkish(text);
  const violations: ComplianceViolation[] = [];

  for (const rule of TURKISH_COMPLIANCE_RULES) {
    if (sector && rule.sector !== sector) continue;

    for (const pat of rule.patterns) {
      const match = pat.exec(normalized);
      if (match) {
        const start = match.index;
        const end = start + match[0].length;
        const snippet = text.slice(Math.max(0, start - 20), Math.min(text.length, end + 20));

        violations.push({
          ruleId: rule.id,
          sector: rule.sector,
          title: rule.title,
          matchedPattern: match[0],
          contextSnippet: snippet.trim(),
          legalBasis: rule.legalBasis,
          penaltyRisk: rule.penaltyRisk,
          suggestedFix: rule.suggestedFix,
          severity: rule.severity,
        });
        break;
      }
    }
  }

  return violations;
}

export function getSectorName(sector: ComplianceSector): string {
  switch (sector) {
    case "HEALTH_MEDICAL":
      return "Sağlık & Medikal (TİTCK)";
    case "FOOD_SUPPLEMENT":
      return "Gıda Takviyeleri & Zayıflama (Tarım Bakanlığı)";
    case "LEGAL_SERVICES":
      return "Hukuk & Avukatlık (TBB)";
    case "FINANCIAL_SERVICES":
      return "Finans, Kredi & Yatırım (SPK & BDDK)";
    case "SUPERLATIVE_COMMERCIAL":
      return "E-Ticaret & Reklam (Ticaret Bakanlığı)";
    case "ILLEGAL_BETTING_TOBACCO":
      return "Bahis & Tütün (BTK / TAPDK)";
    default:
      return sector;
  }
}
