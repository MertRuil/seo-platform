/**
 * Kural tabanlı SEO asistanı: soruyu tam kelime eşleşmesiyle bir konuya yönlendirir.
 * Yapay zeka modeli kullanılmaz. Siteye dair sorular ekranda gerçek veriyle yanıtlanır;
 * mevzuat soruları aşağıdaki genel rehber metinleriyle yanıtlanır (hukuki görüş değildir).
 */
export type AssistantIntent = "ISSUES" | "TRAFFIC" | "AI_ACCESS" | "SCHEMA" | "REG_TR" | "REG_EU" | "REG_US" | "REG_UK" | "REG_ASIA" | "REG_MENA" | "UNKNOWN";

/** Türkçe karakterleri koruyarak küçük harfe çevirir ve kelimelere ayırır. */
export function tokenize(text: string): string[] {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/[.,!?;:()"'“”‘’[\]{}<>/\\|*#@%&+=~`^$]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// Kelime kökleri: token bu kökle başlıyorsa eşleşir ("sorunlarım" -> "sorun"). Kısa kısaltmalar tam eşleşir.
const RULES: Array<{ intent: AssistantIntent; exact?: string[]; prefix?: string[] }> = [
  { intent: "REG_MENA", exact: ["mena", "bae", "uae", "gcc", "sfda", "mohap", "vara", "sama"], prefix: ["dubai", "suudi", "saudi", "körfez", "mawthooq"] },
  { intent: "REG_UK", exact: ["uk", "asa", "cma", "fca", "dmcc"], prefix: ["ingiltere", "britanya", "botox"] },
  { intent: "REG_ASIA", exact: ["apac", "jcaa", "pmda", "samr", "kftc", "mas"], prefix: ["asya", "asia", "japonya", "çin", "kore", "singapur", "yakki"] },
  { intent: "REG_US", exact: ["us", "usa", "abd", "ftc", "fda", "sec", "dshea"], prefix: ["amerika"] },
  { intent: "REG_EU", exact: ["eu", "ab", "efsa", "mica", "empco"], prefix: ["avrupa", "greenwashing"] },
  { intent: "REG_TR", exact: ["titck", "tbb"], prefix: ["mevzuat", "reklam", "yasak", "yasal", "hukuk"] },
  { intent: "AI_ACCESS", exact: ["geo", "llms", "gptbot", "ai"], prefix: ["chatgpt", "perplexity", "gemini", "claude", "yapay", "overview"] },
  { intent: "SCHEMA", exact: ["json", "json-ld", "jsonld"], prefix: ["schema", "şema", "yapılandırılmış"] },
  { intent: "TRAFFIC", exact: ["gsc"], prefix: ["trafik", "tıklama", "gösterim", "sıralama", "düşüş", "performans", "search"] },
  { intent: "ISSUES", prefix: ["sorun", "hata", "kritik", "teknik", "denetim", "canonical", "meta", "başlık", "uyumlu", "uyumluluk", "mobil", "hız"] },
];

export function detectIntent(text: string): AssistantIntent {
  const tokens = tokenize(text);
  for (const r of RULES) {
    if (tokens.some((t) => r.exact?.includes(t) || r.prefix?.some((p) => t.startsWith(p)))) return r.intent;
  }
  return "UNKNOWN";
}

export interface GuideAnswer {
  text: string;
  sources: string[];
}

export const REGULATION_GUIDES: Record<"REG_TR" | "REG_EU" | "REG_US" | "REG_UK" | "REG_ASIA" | "REG_MENA", GuideAnswer> = {
  REG_MENA: {
    text: `**Orta Doğu & Körfez (MENA / GCC) Bölgesi Mevzuat ve Reklam Denetimi:**\n\n1. **Kamu Ahlakı, İslami Değerler & Kumar/Alkol Yasağı (BAE 55/2023 & KSA M/17):** Online kumar, spor bahisleri ve izinsiz alkol teslimatı reklamları kesinlikle yasaktır (1.000.000 AED / SAR ceza ve TDRA/CITC erişim engeli).\n2. **MOHAP & Suudi SFDA Sağlık Beyanları:** "100% kesin kanser tedavisi", "diyabete son", "haftada 10 kilo garantili zayıflama" gibi tıbbi ve sağlık vaatleri resmi reklam lisans numarası olmaksızın suçtur.\n3. **Gizli Reklam & Mawthooq (موثوق) Lisansı:** Ücretli veya ticari menfaat sağlanan tüm tanıtımlarda açıkça Arapça/İngilizce #إعلان veya #Ad ibaresi zorunludur. Ruhsatsız tanıtımlara 500.000 SAR/AED para cezası uygulanır.\n4. **Kripto & Sanal Varlıklar (Dubai VARA & SAMA):** "Sıfır riskli yatırım", "günlük garantili getiri" vaatleri katı şekilde yasaklanmıştır (VARA tarafından 10.000.000 AED ceza).\n5. **Emlak Pazarlaması (Suudi Fal / Dubai RERA Trakheesi):** Emlak ilanlarında Suudi Fal Yetki Numarası veya Dubai Trakheesi İzin Numarası belirtilmeyen tanıtımlar portallardan ve arama motorlarından derhal kaldırılır.\n\nSitenizdeki metinleri kontrol etmek için: İçerik sekmesindeki **BAE & Körfez (MENA) mevzuat taraması** aracıyla Arapça ve İngilizce metinlerinizi güvenle denetleyin.`,
    sources: ["UAE Media Council (Federal Decree-Law 55/2023)", "Saudi SFDA Advertising Guidelines", "Dubai VARA Marketing Regulations", "Saudi GAMR Mawthooq License", "Dubai RERA Trakheesi"],
  },
  REG_UK: {
    text: `**Birleşik Krallık (UK) Brexit Sonrası Reklam ve Mevzuat Denetimi:**\n\n1. **ASA CAP Code Rule 12 & Human Medicines Regulations 2012 (Reg 284):** Reçeteli ilaçların (POM) ve Botox gibi enjeksiyonların halka açık doğrudan veya dolaylı reklamı kesinlikle yasaktır.\n2. **CMA Green Claims Code & DMCC Act 2024:** Kanıtlanamayan çevreci iddialar için CMA, doğrudan mahkemesiz **küresel yıllık cironun %10'una kadar** idari para cezası kesme yetkisine sahiptir.\n3. **FCA PS23/6 Kripto Promosyonları:** Kripto para ve finansal reklamlarda zorunlu yasal risk uyarısı (*"Don't invest unless you're prepared to lose all the money you invest..."*) ve ilk alıcılar için 24 saatlik cayma süresi zorunludur.\n4. **DMCC Act & Sahte Kıtlık (Dark Patterns):** "Son 1 ürün kaldı acele edin" gibi yapay geri sayım sayaçları ve gizli damla fiyatlandırma (drip pricing) yasaktır.\n\nSitenizdeki metinleri kontrol etmek için: İçerik sekmesindeki **Birleşik Krallık (UK) mevzuat taraması** aracıyla İngiltere pazarına yönelik sayfalarınızı denetleyin.`,
    sources: ["UK Advertising Standards Authority (CAP Code Rule 12)", "CMA Digital Markets, Competition and Consumers Act 2024", "Financial Conduct Authority (FCA PS23/6)"],
  },
  REG_ASIA: {
    text: `**Asya & Pasifik (APAC) Bölgesi Mevzuat ve Reklam Denetimi:**\n\n1. **Japonya PMD Act (薬機法 - Yakki-ho Art. 66/68):** Kozmetik, gıda ve takviyelerde tıbbi tedavi/hastalık önleme iddiaları ("ガンが治る", "シミが消える", "若返り効果100%") yasaktır. İhlal halinde 2 yıla kadar hapis veya toplam cironun %4.5'ine varan idari para cezası verilir.\n2. **Japonya JCAA Stealth Marketing Yasağı (ステマ規制, Ekim 2023):** Sponsorlu veya teşvikli içeriklerde belirgin biçimde "#PR" veya "広告" etiketi yer almalıdır; gizli reklam ve sahte yorumlar şirketin cirosundan %3 kesinti cezası doğurur.\n3. **Çin SAMR Reklam Kanunu (中华人民共和国广告法 Madde 9):** "Ulusal Düzey" (国家级), "En Yüksek" (最高级), "En İyi" (最佳), "1 Numara" (第一) gibi kanıtlanamayan mutlak süperlatif ifadelerin kullanımı 100.000 - 1.000.000 RMB ceza gerektirir.\n4. **Güney Kore KFTC Backdoor Advertising (뒷광고):** Tüketiciyi aldatıcı gizli fenomen reklamları ve sahte incelemeler 500 milyon KRW veya cironun %2'si kadar ceza ile yaptırımlandırılır.\n5. **Singapur MAS Kripto Yönergeleri (DPT):** Kamuya açık mecralarda kripto para reklamı ve "guaranteed crypto yield" / "risk-free" vaatleri katı şekilde yasaklanmıştır.\n6. **Tütün & Vaping / Kumar Yasakları:** Singapur ve Güneydoğu Asya'da elektronik sigara (vape) satışı 10.000 SGD ceza ve 6 ay hapis; yasadışı online kumar siteleri anında engellenir.\n\nSitenizdeki metinleri kontrol etmek için: İçerik sekmesindeki **Asya / APAC mevzuat taraması** aracıyla Asya pazarına açılan içeriklerinizi güvenle denetleyin.`,
    sources: ["Japan PMD Act (Yakki-ho)", "JCAA Keihyo-ho (Stealth Marketing)", "China Advertising Law (SAMR Art. 9)", "Singapore MAS Digital Payment Token Guidelines", "Korea Fair Trade Commission (KFTC)"],
  },
  REG_US: {
    text: `**Amerika Birleşik Devletleri Federal Mevzuat ve Reklam Denetimi:**\n\n1. **FTC Act Section 5 & Sahte Yorumlar (16 CFR Part 464):** Tüketiciyi aldatıcı ticari uygulamalar ve teşvik edilmiş/sahte kullanıcı yorumları ihlal başına 51.744 $'a varan doğrudan hukuki para cezasına tabidir.\n2. **FTC Made in USA Kuralı (16 CFR Part 323):** Ürünün tamamı veya neredeyse tamamı ABD'de üretilmedikçe niteliksiz "Made in USA" demek yasaktır.\n3. **FDA & DSHEA (21 U.S.C. § 343(r)(6)):** Gıda takviyelerinde hastalık tedavi/önleme iddiaları yasaktır ve zorunlu FDA feragatnamesi (*"These statements have not been evaluated by the FDA..."*) gereklidir.\n4. **Reçeteli İlaçlar & Ryan Haight Act (21 U.S.C. § 829):** Reçetesiz Ozempic, Xanax gibi ilaçların internetten satışı/reklamı federal suçtur (20 yıla kadar hapis).\n5. **SEC Rule 10b-5 & Kripto:** Kripto ve sermaye piyasalarında "guaranteed returns" ve risksiz kazanç vaatleri menkul kıymet dolandırıcılığı kapsamında kovuşturulur.\n6. **FTC Green Guides:** Karbon ofsetine dayalı asılsız "carbon neutral" iddiaları aldatıcı pazarlama sayılır.\n\nSitenizdeki metinleri kontrol etmek için: İçerik sekmesindeki **ABD Mevzuat Kalkanı** aracıyla metinlerinizi FTC ve FDA kurallarına uygun hale getirin.`,
    sources: ["Federal Trade Commission (16 CFR Part 464)", "FDA FD&C Act / DSHEA", "SEC Rule 10b-5", "CFPB Regulation Z"],
  },
  REG_EU: {
    text: `**Avrupa Birliği reklam ve tüketici mevzuatında öne çıkan kurallar:**\n\n1. **Greenwashing & Çevre İddiaları (Directive (EU) 2024/825 EmpCo):** Karbon kredisi/ofsetlemeye dayalı "carbon neutral", "climate positive", "CO2 neutral" iddiaları yasaklanmıştır. "100% eco-friendly" ifadesi resmi EU Ecolabel sertifikası olmaksızın kullanılamaz (Yıllık cironun %4'üne varan ceza).\n2. **Gıda & Takviyeler (EFSA Reg 1924/2006):** Kilo verme hızı veya miktarı vaat eden ("lose 10 kg in 2 weeks") veya hastalık önleme/tedavi iddiaları yasaktır.\n3. **Finans & Kripto (MiCA 2023/1114 & MiFID II):** Kripto ve yatırımlarda "guaranteed returns", "risk-free investment" vaatleri yasaktır.\n4. **Tüketici Fiyatlandırması (Omnibus 2019/2161):** "Cheapest in Europe" veya kanıtlanamayan fiyat süperlatifleri haksız ticari uygulama kapsamındadır.\n5. **İlaç & Sağlık (Directive 2001/83/EC):** Reçeteli ilaçların (POM) halka açık satışı ve "guaranteed cure" iddiaları yasaktır.\n\nSitenizdeki metinleri kontrol etmek için: İçerik sekmesindeki **Avrupa Birliği mevzuat taraması** simülatörünü çalıştırarak metinlerinizi AB standartlarına getirin.`,
    sources: ["Directive (EU) 2024/825 (EmpCo)", "Regulation (EC) No 1924/2006 (EFSA)", "Regulation (EU) 2023/1114 (MiCA)", "Directive 2001/83/EC"],
  },
  REG_TR: {
    text: `**Türkiye'de Reklam Kurulu, TİTCK ve TBB kurallarında öne çıkanlar:**\n\n1. **Sağlık & Tıbbi İddialar (TİTCK):** "Tedavi eder", "kesin şifa", "garantili sonuç" ve hekimler için "en iyi cerrah" ifadeleri kesinlikle yasaktır (12 Kasım 2025 tarihli Yönetmelik & 1219 sayılı Kanun).\n2. **Gıda Takviyeleri:** Takviyelerde "zayıflatır", "yağ yakar" veya "Sağlık Bakanlığı onaylı" denmesi en yüksek sınırdan idari para cezası ve ürün toplatma sebebidir.\n3. **Hukuk & Avukatlık (TBB):** "En iyi avukat", "dava kazanma garantisi" ve "ücretsiz danışmanlık" reklam yasağı kapsamındadır (1136 sayılı Kanun md. 55).\n4. **Kanıtlanamayan Üstünlükler:** "En ucuz", "rakipsiz fiyat" ifadeleri akredite pazar raporu olmadan kullanılamaz (2026 ceza tavanı: 8.635.800 TL).\n\nSitenizdeki metinleri kontrol etmek için: İçerik Optimizasyonu sekmesindeki **Mevzuat mevzuat taraması** ile metinlerinizi anında tarayın ve tek tıkla düzeltin.`,
    sources: ["T.C. Ticaret Bakanlığı Reklam Kurulu Kararları", "TİTCK Tanıtım ve Bilgilendirme Yönetmeliği", "TBB Reklam Yasağı Yönetmeliği"],
  },
};
