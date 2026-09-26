/**
 * Asia & Pacific (APAC) Regulatory & Advertising Compliance Rules Library
 * Covering Statutory Frameworks & Regulatory Guidelines across Key Asian Markets:
 * - Japan:
 *   * Pharmaceutical and Medical Devices Act (PMD Act / 薬機法, Yakki-ho Art. 66/68)
 *   * Act against Unjustifiable Premiums and Misleading Representations (景品表示法, Keihyo-ho)
 *   * JCAA Stealth Marketing Regulations (ステマ規制, Oct 2023)
 *   * Medical Care Act (医療法)
 *   * Financial Instruments and Exchange Act & Payment Services Act (FSA)
 * - China:
 *   * Advertising Law of the People's Republic of China (中华人民共和国广告法 Art. 9, 16-18)
 *   * Anti-Unfair Competition Law (反不正当竞争法 Art. 8 - Ban on fake orders/reviews 刷单/炒信)
 *   * E-Commerce Law of the PRC (电子商务法 Art. 17)
 * - Singapore:
 *   * Health Sciences Authority (HSA) - Health Products Act & Medicines Act
 *   * Monetary Authority of Singapore (MAS) - Guidelines on Digital Payment Token (DPT) Services
 *   * Competition and Consumer Commission of Singapore (CCCS) - Environmental Claims Guidelines
 *   * Tobacco (Control of Advertisements and Sale) Act & Gambling Control Act 2022
 * - South Korea:
 *   * Korea Fair Trade Commission (KFTC) - Act on Fair Labeling and Advertising (뒷광고 Backdoor Ads)
 *   * Ministry of Food and Drug Safety (MFDS) - Health Functional Food Act & Pharmaceutical Affairs Act
 */

export type AsiaComplianceSector =
  | "COSMETICS_HEALTH_PMDA"
  | "STEALTH_MARKETING_JCAA_KFTC"
  | "ABSOLUTE_SUPERLATIVES_SAMR"
  | "DIETARY_SUPPLEMENTS_WEIGHTLOSS"
  | "FINANCIAL_CRYPTO_MAS"
  | "GREEN_CLAIMS_APAC"
  | "VAPING_GAMBLING_BAN_APAC";

export interface AsiaComplianceViolation {
  ruleId: string;
  sector: AsiaComplianceSector;
  title: string;
  matchedPattern: string;
  contextSnippet: string;
  legalBasis: string;
  penaltyRisk: string;
  suggestedFix: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
}

export interface AsiaRuleDefinition {
  id: string;
  sector: AsiaComplianceSector;
  title: string;
  patterns: RegExp[];
  legalBasis: string;
  penaltyRisk: string;
  suggestedFix: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
}

export const ASIA_COMPLIANCE_RULES: AsiaRuleDefinition[] = [
  // 1. Cosmetics, Health, and Prescription Drugs (Japan Yakki-ho / Singapore HSA / China)
  {
    id: "ASIA_PMDA_UNAPPROVED_MEDICAL",
    sector: "COSMETICS_HEALTH_PMDA",
    title: "Unapproved Medical or Therapeutic Claims on Cosmetics and General Goods",
    patterns: [
      /\b(?:permanent(?:ly)?\s+removes?\s+wrinkles|reverses?\s+aging\s+completely)\b/i,
      /\b(?:cures?\s+(?:cancer|diabetes|hypertension|alzheimer)|guaranteed\s+disease\s+cure)\b/i,
      /\b(?:miracle\s+treatment\s+for\s+chronic\s+disease|eradicates?\s+all\s+tumors?)\b/i,
      /(?:ガンが治る|糖尿病が完治|若返り効果100%|シミが完全に消える|病気が治る)/i,
      /(?:包治百病|彻底根治糖尿病|抗癌神药|消灭肿瘤|彻底治愈高血压)/i,
      /(?:암을\s*완치|당뇨병\s*치료|노화\s*완전\s*역전|기미\s*완전\s*제거)/i,
    ],
    legalBasis: "Japan PMD Act (薬機法, Art. 66/68) & Singapore Health Products Act & China Drug Administration Law",
    penaltyRisk: "Up to 2 years imprisonment, administrative sales surcharges up to 4.5% of gross revenue, or corporate fines up to 300M JPY / 2M RMB.",
    suggestedFix: "Limit claims to moisturizing and appearance support without asserting medical cure or structural body alteration.",
    severity: "CRITICAL",
  },
  {
    id: "ASIA_PMDA_HSA_POM_ONLINE",
    sector: "COSMETICS_HEALTH_PMDA",
    title: "Online DTC Sales of Prescription-Only Medicines (POM)",
    patterns: [
      /\b(?:buy|order)\s+(?:ozempic|wegovy|saxenda|retin[\s-]a|viagra|antibiotics)\s+without\s+(?:prescription|doctor)\b/i,
      /\bno\s+prescription\s+required\s+for\s+(?:ozempic|wegovy|saxenda)\b/i,
      /(?:処方箋なしで買える|医師の診察不要でオゼンピック|処方薬個人輸入代行)/i,
      /(?:无需处方购买|处方药包邮|代购处方药|免处方直邮)/i,
      /(?:처방전\s*없이\s*구매|의사\s*처방\s*없이\s*오젬픽|전문의약품\s*해외직구)/i,
    ],
    legalBasis: "Singapore Medicines Act & Japan Medical Care Act & South Korea Pharmaceutical Affairs Act",
    penaltyRisk: "Strict import ban, criminal detention, immediate domain blocking, and license revocation.",
    suggestedFix: "Prescription medications can only be obtained through registered clinics upon physician consultation.",
    severity: "CRITICAL",
  },

  // 2. Stealth Marketing & Fake Reviews (Japan JCAA / Korea KFTC / China SAMR)
  {
    id: "ASIA_STEALTH_MARKETING_DISCLOSURE",
    sector: "STEALTH_MARKETING_JCAA_KFTC",
    title: "Undisclosed Sponsored Content & Fake Review Acquisition",
    patterns: [
      /\b(?:buy\s+(?:google|naver|douyin|xiaohongshu)\s+reviews|purchase\s+fake\s+reviews)\b/i,
      /\b(?:stealth\s+marketing\s+service|undisclosed\s+influencer\s+promotion)\b/i,
      /(?:ステマ代行|やらせレビュー|サクラレビュー募集|ステルスマーケティング)/i,
      /(?:刷单|炒信|买好评|刷好评|小红书假种草|购买虚假评价)/i,
      /(?:뒷광고|댓글\s*알바|리뷰\s*조작|가짜\s*후기\s*구매|체험단\s*미표시)/i,
    ],
    legalBasis: "Japan Premiums & Representations Act (ステマ規制, Oct 2023), South Korea Fair Labeling Act (뒷광고), China E-Commerce Law Art. 17",
    penaltyRisk: "Administrative surcharge of 3% of sales in Japan; fines up to 500 million KRW (or 2% of revenue) in Korea; up to 2 million RMB in China.",
    suggestedFix: "Disclose all sponsored relationships prominently with '#PR', '広告', or '유료광고' at the beginning of the text.",
    severity: "CRITICAL",
  },

  // 3. Absolute Superlatives & Unsubstantiated "No. 1" Claims (China SAMR / Japan JCAA)
  {
    id: "ASIA_SAMR_ABSOLUTE_SUPERLATIVES",
    sector: "ABSOLUTE_SUPERLATIVES_SAMR",
    title: "Illegal Absolute Superlatives & Unsubstantiated 'No. 1' Claims",
    patterns: [
      /\b(?:national\s+level\s+best|absolute\s+best\s+in\s+china|highest\s+level\s+quality)\b/i,
      /\b(?:japan'?s?\s+number\s+(?:one|1)|asia'?s?\s+(?:best|number\s+(?:one|1)))\b/i,
      /\b(?:korea'?s?\s+number\s+(?:one|1)|guaranteed\s+number\s+one\s+brand)\b/i,
      /(?:国家级|最高级|最佳|第一品牌|顶级品质|绝无仅有)/i,
      /(?:日本一|業界No\.?1|必ず痩せる|効果100%|完璧な効果)/i,
      /(?:대한민국\s*최고|국내\s*1위|완벽한\s*효과\s*보장)/i,
    ],
    legalBasis: "Advertising Law of the PRC (Article 9, Item 3) & Japan Premiums & Representations Act (優良誤認 - Superior Misrepresentation)",
    penaltyRisk: "Fines between 100,000 and 1,000,000 RMB by SAMR; 3% sales surcharge by Japan Consumer Affairs Agency (CAA).",
    suggestedFix: "Replace absolute superlatives with verifiable facts or specific, time-limited third-party survey metrics.",
    severity: "HIGH",
  },

  // 4. Dietary Supplements & Aggressive Weight Loss (Japan MHLW / Korea MFDS)
  {
    id: "ASIA_SUPPLEMENT_WEIGHTLOSS_UNREALISTIC",
    sector: "DIETARY_SUPPLEMENTS_WEIGHTLOSS",
    title: "Unrealistic Weight Loss & Food As Drug Misrepresentation",
    patterns: [
      /\blose\s+\d+\s*kg\s+in\s+\d+\s*(?:days?|weeks?)\s+without\s+(?:diet|exercise)\b/i,
      /\b(?:effortless\s+fat\s+burning\s+supplement|miracle\s+slimming\s+tea)\b/i,
      /\b(?:burn\s+belly\s+fat\s+while\s+sleeping|permanent\s+weight\s+loss\s+guaranteed)\b/i,
      /(?:飲むだけで激痩せ|運動なしで10kg減量|食事制限なしで脂肪燃焼)/i,
      /(?:无需节食月瘦\d+斤|躺着减肥|无副作用强效燃脂|神效瘦身茶)/i,
      /(?:운동\s*없이\s*\d+kg\s*감량|먹기만\s*해도\s*살빠지는|다이어트\s*보장)/i,
    ],
    legalBasis: "Japan Yakki-ho & South Korea Health Functional Food Act & Singapore HSA Guidelines",
    penaltyRisk: "Immediate product recall, ban from Japanese/Korean e-commerce platforms (Rakuten, Coupang), and administrative surcharges.",
    suggestedFix: "State that product supports healthy weight management when combined with a calorie-controlled diet and exercise.",
    severity: "HIGH",
  },

  // 5. Financial Services, Crypto & Predatory Lending (Singapore MAS / Japan FSA)
  {
    id: "ASIA_MAS_CRYPTO_FINANCIAL_PROMISE",
    sector: "FINANCIAL_CRYPTO_MAS",
    title: "Prohibited Public Crypto Marketing & Guaranteed Investment Yields",
    patterns: [
      /\bguaranteed\s+(?:crypto|bitcoin|forex)\s+(?:yield|return|profit)\b/i,
      /\b100%\s+risk[\s-]free\s+(?:crypto\s+arbitrage|investment\s+algorithm)\b/i,
      /\binstant\s+personal\s+loans?\s+no\s+credit\s+check\b/i,
      /\bguaranteed\s+loan\s+approval\s+regardless\s+of\s+credit\b/i,
      /(?:元本保証の仮想通貨|確実な暗号資産利回り|審査なし即日融資|誰でも必ず借りられる)/i,
      /(?:稳赚不赔虚拟币|保证100%收益率|无征信即时放款|高回报无风险理财)/i,
      /(?:원금\s*보장\s*코인\s*수익|100%\s*무위험\s*투자|신용\s*조회\s*없는\s*즉시대출)/i,
    ],
    legalBasis: "Monetary Authority of Singapore (MAS DPT Guidelines 2022) & Japan Financial Services Agency (FSA / 資金決済法)",
    penaltyRisk: "Civil enforcement, criminal referral by MAS/FSA, permanent suspension of financial/digital token licenses.",
    suggestedFix: "Disclose all capital risks: 'Digital asset trading carries high risk. Capital is at risk; past returns do not indicate future results.'",
    severity: "CRITICAL",
  },

  // 6. Environmental & Green Claims (Singapore CCCS / Japan JCAA)
  {
    id: "ASIA_GREENWASHING_UNSUBSTANTIATED",
    sector: "GREEN_CLAIMS_APAC",
    title: "Unsubstantiated Carbon Neutral & Eco-Friendly Claims",
    patterns: [
      /\b(?:100%\s+eco[\s-]friendly|completely\s+green\s+product|certified\s+carbon\s+neutral\s+delivery)\b/i,
      /\b(?:zero\s+carbon\s+guaranteed|100%\s+sustainable\s+lifecycle)\b/i,
      /(?:環境負荷ゼロ|100%エコ|カーボンニュートラル保証|完全無公害)/i,
      /(?:零碳环保|100%纯天然无害|绝对零污染|完全绿色产品)/i,
      /(?:100%\s*친환경|탄소중립\s*완벽\s*보장|공해\s*전혀\s*없는)/i,
    ],
    legalBasis: "CCCS Singapore Guidelines on Environmental Claims & Japan Consumer Affairs Agency Environmental Advertising Guidelines",
    penaltyRisk: "Consumer protection enforcement for unfair deceptive trade practices (CPFTA) and corrective orders.",
    suggestedFix: "Provide specific, verifiable packaging or manufacturing data (e.g., 'Container made of 60% post-consumer recycled materials').",
    severity: "HIGH",
  },

  // 7. Vaping & Unauthorized Online Gambling Ban (Singapore / East Asia)
  {
    id: "ASIA_TOBACCO_VAPE_GAMBLING_BAN",
    sector: "VAPING_GAMBLING_BAN_APAC",
    title: "Total Prohibition on E-Cigarettes/Vapes & Unauthorized Online Gambling",
    patterns: [
      /\b(?:buy|order)\s+(?:vapes?|e[\s-]cigarettes?|puff\s+bars?|relx\s+pods?)\s+online\b/i,
      /\b(?:trusted\s+online\s+casino\s+singapore|best\s+online\s+betting\s+malaysia)\b/i,
      /\b(?:online\s+baccarat\s+singapore|online\s+slot\s+game\s+malaysia)\b/i,
      /(?:電子タバコ通販|ニコチンリキッド販売|オンラインカジノおすすめ|ネットカジノ勝てる)/i,
      /(?:电子烟线上购买|网上赌博直营|真人视讯百家乐|网络彩票稳赢)/i,
      /(?:전자담배\s*온라인\s*구매|사설\s*토토\s*사이트|온라인\s*카지노\s*추천|바카라\s*필승법)/i,
    ],
    legalBasis: "Singapore Tobacco (Control of Advertisements and Sale) Act & Singapore Gambling Control Act 2022 & China E-Cigarette Online Ban",
    penaltyRisk: "Severe criminal penalties: up to SGD 10,000 fine and 6 months imprisonment for vape possession/purchase in Singapore; domain blocking.",
    suggestedFix: "Remove all references to electronic vaporizers, nicotine delivery systems, and unauthorized gambling services.",
    severity: "CRITICAL",
  },
];

export function scanAsiaCompliance(
  text: string,
  sectorFilter?: AsiaComplianceSector
): AsiaComplianceViolation[] {
  if (!text) return [];

  const violations: AsiaComplianceViolation[] = [];
  const normalized = text.toLowerCase();

  for (const rule of ASIA_COMPLIANCE_RULES) {
    if (sectorFilter && rule.sector !== sectorFilter) continue;

    for (const pattern of rule.patterns) {
      const match = pattern.exec(normalized) || pattern.exec(text);
      if (match) {
        const start = match.index;
        const end = start + match[0].length;
        const snippet = text.slice(Math.max(0, start - 25), Math.min(text.length, end + 25));

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
        break; // Record one violation per rule
      }
    }
  }

  return violations;
}

export function getAsiaSectorName(sector: AsiaComplianceSector): string {
  switch (sector) {
    case "COSMETICS_HEALTH_PMDA":
      return "Health & Cosmetics (Japan Yakki-ho / Singapore HSA)";
    case "STEALTH_MARKETING_JCAA_KFTC":
      return "Stealth Marketing & Fake Reviews (JCAA / KFTC)";
    case "ABSOLUTE_SUPERLATIVES_SAMR":
      return "Superlatives & No. 1 Claims (China SAMR Art. 9)";
    case "DIETARY_SUPPLEMENTS_WEIGHTLOSS":
      return "Dietary Supplements & Slimming (MHLW / MFDS)";
    case "FINANCIAL_CRYPTO_MAS":
      return "Financial & Crypto Guidelines (Singapore MAS / FSA)";
    case "GREEN_CLAIMS_APAC":
      return "Environmental & Green Claims (Singapore CCCS)";
    case "VAPING_GAMBLING_BAN_APAC":
      return "Vaping & Online Gambling Ban (Singapore / East Asia)";
    default:
      return sector;
  }
}
