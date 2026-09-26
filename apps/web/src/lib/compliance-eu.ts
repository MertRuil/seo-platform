/**
 * European Union (EU) Regulatory & Advertising Compliance Rules Library
 * Covering Directives & Regulations:
 * - Directive 2001/83/EC (Medicinal products advertising) & MDR (EU) 2017/745
 * - Regulation (EC) No 1924/2006 (EFSA Nutrition & Health claims) & FIC (EU) 1169/2011
 * - Directive (EU) 2024/825 (EmpCo / Greenwashing) & Green Claims Directive
 * - Directive 2005/29/EC (UCPD) & Omnibus Directive (EU) 2019/2161 & Price Indication
 * - Markets in Crypto-Assets Regulation (EU) 2023/1114 (MiCA) & MiFID II (2014/65/EU)
 * - Consumer Credit Directive (EU) 2023/2225
 * - Tobacco Products Directive 2014/40/EU (Article 20 e-cigarette cross-border ban)
 * - CCBE Code of Conduct for European Lawyers
 */

export type EuComplianceSector =
  | "HEALTH_PHARMA"
  | "FOOD_SUPPLEMENT"
  | "GREEN_CLAIMS"
  | "CONSUMER_ECOMMERCE"
  | "FINANCIAL_SERVICES"
  | "LEGAL_SERVICES"
  | "TOBACCO_NICOTINE";

export interface EuComplianceViolation {
  ruleId: string;
  sector: EuComplianceSector;
  title: string;
  matchedPattern: string;
  contextSnippet: string;
  legalBasis: string;
  penaltyRisk: string;
  suggestedFix: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
}

export interface EuRuleDefinition {
  id: string;
  sector: EuComplianceSector;
  title: string;
  patterns: RegExp[];
  legalBasis: string;
  penaltyRisk: string;
  suggestedFix: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
}

export const EU_COMPLIANCE_RULES: EuRuleDefinition[] = [
  // 1. Health & Pharmaceuticals
  {
    id: "EU_HEALTH_CURE_CLAIM",
    sector: "HEALTH_PHARMA",
    title: "Prohibited Guaranteed Cure & Miracle Healing Claims",
    patterns: [
      /\bguaranteed\s+(?:cure|healing)\b/i,
      /\b100%\s+(?:cure|guaranteed\s+recovery)\b/i,
      /\bmiracle\s+(?:cure|treatment|remedy)\b/i,
      /\beradicate\s+(?:disease|illness)\s+completely\b/i,
      /\bheilungsversprechen\b/i,
      /\bgarantierte\s+heilung\b/i,
      /\bwundermittel\b/i,
      /\bguérison\s+garantie\b/i,
      /\bremède\s+miracle\b/i,
    ],
    legalBasis: "Directive 2001/83/EC (Articles 86-90) & Medical Devices Regulation (EU) 2017/745 Article 7",
    penaltyRisk: "National health authority sanctions, injunctions and advertising bans across EU Member States.",
    suggestedFix: "State 'supports recovery under medical supervision' instead of promising an absolute cure.",
    severity: "CRITICAL",
  },
  {
    id: "EU_HEALTH_ZERO_RISK",
    sector: "HEALTH_PHARMA",
    title: "Prohibited Zero-Risk & No Side Effects Claims",
    patterns: [
      /\bzero\s+risk\s+(?:surgery|operation|procedure)\b/i,
      /\brisk[\s-]free\s+(?:surgery|treatment|procedure)\b/i,
      /\bno\s+side\s+effects?\b/i,
      /\b100%\s+safe\s+procedure\b/i,
      /\brisikofreie\s+operation\b/i,
      /\bohne\s+nebenwirkungen\b/i,
      /\bsans\s+aucun\s+effet\s+secondaire\b/i,
      /\bopération\s+sans\s+risque\b/i,
    ],
    legalBasis: "EU MDR 2017/745 Article 7(d) & Directive 2005/29/EC (Misleading Safety Claims)",
    penaltyRisk: "Fines from national competent authorities (e.g. BfArM, ANSM) and civil liability.",
    suggestedFix: "Disclose that all medical procedures carry inherent risks and consult a qualified physician.",
    severity: "CRITICAL",
  },
  {
    id: "EU_HEALTH_POM_ONLINE",
    sector: "HEALTH_PHARMA",
    title: "Prohibited Public Advertising of Prescription-Only Medicines (POM)",
    patterns: [
      /\b(?:buy|order)\s+(?:ozempic|wegovy|mounjaro|antibiotics|xanax|valium)\s+without\s+prescription\b/i,
      /\bprescription[\s-]free\s+(?:antibiotics|sedatives|weight\s+loss\s+injections?)\b/i,
      /\brezeptfrei\s+(?:ozempic|wegovy|antibiotika)\b/i,
      /\bsans\s+ordonnance\s+(?:ozempic|antibiotiques)\b/i,
    ],
    legalBasis: "Directive 2001/83/EC Article 88 (Ban on direct-to-consumer advertising of POM)",
    penaltyRisk: "Criminal prosecution for illicit pharmaceutical distribution and immediate domain seizure.",
    suggestedFix: "Prescription medications cannot be advertised directly to the public online.",
    severity: "CRITICAL",
  },

  // 2. Food Supplements & Weight Loss (EFSA)
  {
    id: "EU_FOOD_WEIGHT_LOSS_RATE",
    sector: "FOOD_SUPPLEMENT",
    title: "Prohibited Rate or Amount of Weight Loss Claims",
    patterns: [
      /\blose\s+\d+\s*(?:kg|kilos|lbs|pounds)\s+in\s+\d+\s*(?:days?|weeks?)\b/i,
      /\b(?:rapid|guaranteed)\s+fat\s+burn(?:ing)?\b/i,
      /\bslimming\s+guarantee\b/i,
      /\bburns?\s+belly\s+fat\s+in\s+\d+\s+days?\b/i,
      /\b\d+\s*kg\s+in\s+\d+\s*(?:woche|tagen?)\s+abnehmen\b/i,
      /\bfettverbrennung\s+garantiert\b/i,
      /\bperdre\s+\d+\s*kg\s+en\s+\d+\s*(?:jours?|semaines?)\b/i,
      /\bbrûle[\s-]graisse\s+garanti\b/i,
    ],
    legalBasis: "Regulation (EC) No 1924/2006 Article 12(b) (Prohibition of claims referring to rate/amount of weight loss)",
    penaltyRisk: "Product recalls and administrative fines by national food safety authorities (BVL, DGCCRF, NVWA).",
    suggestedFix: "Use authorized EFSA claim: 'Supports weight management as part of an energy-restricted diet.'",
    severity: "CRITICAL",
  },
  {
    id: "EU_FOOD_DISEASE_PREVENTION",
    sector: "FOOD_SUPPLEMENT",
    title: "Prohibited Disease Prevention or Cure Claims on Food/Supplements",
    patterns: [
      /\bcures?\s+(?:cancer|diabetes|arthritis|alzheimer'?s)\b/i,
      /\bprevents?\s+(?:cancer|diabetes|heart\s+attacks?)\b/i,
      /\bheals?\s+chronic\s+diseases?\b/i,
      /\bschützt\s+vor\s+(?:krebs|diabetes)\b/i,
      /\bheilt\s+arthrose\b/i,
      /\bguérit\s+le\s+diabète\b/i,
      /\bprévient\s+le\s+cancer\b/i,
    ],
    legalBasis: "Regulation (EU) No 1169/2011 (FIC) Article 7(3) & Regulation (EC) No 1924/2006 Article 14",
    penaltyRisk: "Heavy food safety fines and mandatory market withdrawal for attributing medicinal properties to food.",
    suggestedFix: "Only use European Commission authorized general health function claims from the EU Register.",
    severity: "CRITICAL",
  },

  // 3. Greenwashing & Environmental Claims (EmpCo Directive)
  {
    id: "EU_GREEN_OFFSETTING_CLAIMS",
    sector: "GREEN_CLAIMS",
    title: "Banned Climate Neutral Claims Based on Offsetting",
    patterns: [
      /\bcarbon\s+neutral\b/i,
      /\bclimate\s+neutral\b/i,
      /\bco2\s+neutral\b/i,
      /\bclimate\s+positive\b/i,
      /\bnet[\s-]zero\s+product\b/i,
      /\bclimate\s+compensated\b/i,
      /\bklimaneutral\b/i,
      /\bco2[\s-]neutral\b/i,
      /\bklimapositiv\b/i,
      /\bneutre\s+en\s+carbone\b/i,
      /\bzéro\s+émission\s+nette\b/i,
    ],
    legalBasis: "Directive (EU) 2024/825 (Empowering Consumers for the Green Transition - EmpCo) Annex I, point 4a",
    penaltyRisk: "Fines up to 4% of annual turnover in Member States under Unfair Commercial Practices Directive.",
    suggestedFix: "Report verified lifecycle emission reductions directly rather than claiming neutrality through offset credits.",
    severity: "HIGH",
  },
  {
    id: "EU_GREEN_GENERIC_ECO",
    sector: "GREEN_CLAIMS",
    title: "Prohibited Generic Unsubstantiated Green Claims",
    patterns: [
      /\b100%\s+eco[\s-]friendly\b/i,
      /\b100%\s+green\s+product\b/i,
      /\b100%\s+sustainable\b/i,
      /\bcompletely\s+environmentally\s+friendly\b/i,
      /\b100%\s+umweltfreundlich\b/i,
      /\bvöllig\s+ökologisch\b/i,
      /\b100%\s+écologique\b/i,
    ],
    legalBasis: "Directive (EU) 2024/825 (EmpCo Directive) & Green Claims Directive (Article 3)",
    penaltyRisk: "Injunctions and commercial practice penalties without third-party certified EU Ecolabel proof.",
    suggestedFix: "Specify the precise environmental attribute (e.g. 'Packaging made from 80% recycled paper') with certification.",
    severity: "HIGH",
  },

  // 4. Consumer Protection, Pricing & E-Commerce
  {
    id: "EU_COMMERCIAL_SUPERLATIVE",
    sector: "CONSUMER_ECOMMERCE",
    title: "Unsubstantiated Market Superlatives ('Cheapest in Europe', 'Unbeatable')",
    patterns: [
      /\bcheapest\s+(?:in\s+europe|in\s+the\s+eu|in\s+the\s+world)\b/i,
      /\bunbeatable\s+price\b/i,
      /\bbest\s+price\s+guarantee\b/i,
      /\blowest\s+price\s+guaranteed\b/i,
      /\bgünstigster\s+in\s+europa\b/i,
      /\btiefstpreisgarantie\b/i,
      /\bunschlagbarer\s+preis\b/i,
      /\ble\s+moins\s+cher\s+d'?europe\b/i,
      /\bprix\s+imbattable\b/i,
    ],
    legalBasis: "Unfair Commercial Practices Directive (2005/29/EC) & Omnibus Directive (EU) 2019/2161",
    penaltyRisk: "National competition authorities issue fines up to 4% of annual turnover or at least €2,000,000.",
    suggestedFix: "Use verifiable factual statements like 'Competitive pricing' unless backed by independent market audits.",
    severity: "HIGH",
  },
  {
    id: "EU_COMMERCIAL_FALSE_REFUND",
    sector: "CONSUMER_ECOMMERCE",
    title: "Misleading Unconditional Refund Guarantee",
    patterns: [
      /\bunconditional\s+(?:money[\s-]back\s+guarantee|refund)\b/i,
      /\bno\s+questions?\s+asked\s+refund\b/i,
      /\bbedingungslose\s+geld[\s-]zurück[\s-]garantie\b/i,
      /\bremboursement\s+inconditionnel\b/i,
    ],
    legalBasis: "Consumer Rights Directive (2011/83/EU) Article 16 (Statutory exceptions to right of withdrawal)",
    penaltyRisk: "Enforcement actions for deceptive trade practices regarding mandatory consumer withdrawal rights.",
    suggestedFix: "State: '14-day statutory right of withdrawal in accordance with EU consumer protection law.'",
    severity: "MEDIUM",
  },

  // 5. Financial Services, Crypto & Consumer Credit
  {
    id: "EU_FINANCE_GUARANTEED_RETURNS",
    sector: "FINANCIAL_SERVICES",
    title: "Prohibited Guaranteed Returns & Risk-Free Investment Claims",
    patterns: [
      /\bguaranteed\s+(?:returns?|profits?|yield)\b/i,
      /\brisk[\s-]free\s+(?:investment|trading)\b/i,
      /\b100%\s+(?:safe\s+investment|guaranteed\s+profit)\b/i,
      /\bguaranteed\s+crypto\s+(?:profit|yield|returns?)\b/i,
      /\b100%\s+winning\s+(?:trading\s+bot|signals?)\b/i,
      /\bgarantierte\s+rendite\b/i,
      /\brisikofreie\s+geldanlage\b/i,
      /\bgarantierter\s+krypto[\s-]gewinn\b/i,
      /\brendement\s+garanti\b/i,
      /\binvestissement\s+sans\s+risque\b/i,
    ],
    legalBasis: "Markets in Crypto-Assets Regulation (EU) 2023/1114 (MiCA) & MiFID II (Directive 2014/65/EU)",
    penaltyRisk: "ESMA and national financial regulators (BaFin, AMF, CNMV) fines up to €5,000,000 or 10% of annual turnover.",
    suggestedFix: "Must include mandatory EU risk warning: 'Capital at risk. Past performance does not guarantee future results.'",
    severity: "CRITICAL",
  },
  {
    id: "EU_FINANCE_PREDATORY_CREDIT",
    sector: "FINANCIAL_SERVICES",
    title: "Prohibited Predatory No-Credit-Check Loan Promotions",
    patterns: [
      /\binstant\s+loans?\s+no\s+credit\s+check\b/i,
      /\bbad\s+credit\s+loans?\s+guaranteed\b/i,
      /\bcredit\s+score\s+does(?:n't|\s+not)\s+matter\b/i,
      /\bkredit\s+ohne\s+schufa\s+sofort\b/i,
      /\btrotz\s+schufa\s+garantiert\b/i,
      /\bcrédit\s+sans\s+enquête\s+fiché\b/i,
    ],
    legalBasis: "Consumer Credit Directive (EU) 2023/2225 (Obligation to assess creditworthiness & marketing restrictions)",
    penaltyRisk: "Regulatory sanctions by national financial supervision bodies and immediate promotion ban.",
    suggestedFix: "Specify representative APR and state that credit approval is subject to mandatory creditworthiness assessment.",
    severity: "CRITICAL",
  },

  // 6. Tobacco & Cross-Border Vaping
  {
    id: "EU_TOBACCO_CROSSBORDER_VAPING",
    sector: "TOBACCO_NICOTINE",
    title: "Prohibited Cross-Border Online Advertising of E-Cigarettes & Vapes",
    patterns: [
      /\bbuy\s+e[\s-]cigarettes?\s+online\b/i,
      /\border\s+vapes?\s+online\s+cheap\b/i,
      /\bcheap\s+disposable\s+vapes?\b/i,
      /\bbuy\s+puff\s+bar\s+online\b/i,
      /\border\s+iqos\s+(?:online|heatsticks?)\b/i,
      /\be[\s-]zigaretten\s+online\s+bestellen\b/i,
      /\bpuff\s+bar\s+kaufen\b/i,
      /\bacheter\s+vape\s+en\s+ligne\b/i,
      /\bcommander\s+cigarette\s+électronique\b/i,
    ],
    legalBasis: "Tobacco Products Directive 2014/40/EU (Article 20 on cross-border advertising/sponsorship bans)",
    penaltyRisk: "Customs seizures, national public health fines, and digital service blocking.",
    suggestedFix: "Cross-border online promotion and advertising of electronic cigarettes and refills is strictly prohibited in the EU.",
    severity: "CRITICAL",
  },

  // 7. Legal Services
  {
    id: "EU_LEGAL_OUTCOME_GUARANTEE",
    sector: "LEGAL_SERVICES",
    title: "Prohibited Judicial Outcome Guarantees & Misleading Superlatives",
    patterns: [
      /\bguaranteed\s+(?:court\s+win|acquittal|case\s+victory)\b/i,
      /\b100%\s+success\s+rate\s+(?:lawyer|attorney)\b/i,
      /\bbest\s+lawyer\s+in\s+(?:europe|germany|france|spain|italy)\b/i,
      /\berfolgsgarantie\s+vor\s+gericht\b/i,
      /\b100%\s+freispruch\s+garantie\b/i,
      /\bbester\s+anwalt\s+deutschlands\b/i,
      /\bgagner\s+votre\s+procès\s+garanti\b/i,
    ],
    legalBasis: "CCBE (Council of Bars and Law Societies of Europe) Code of Conduct & National Bar Regulations",
    penaltyRisk: "Disciplinary proceedings by National Bar Associations, temporary disbarment, and unfair competition damages.",
    suggestedFix: "Accurately state areas of legal practice and qualifications without guaranteeing judicial outcomes.",
    severity: "CRITICAL",
  },
];

export function scanEuCompliance(text: string, sector?: EuComplianceSector): EuComplianceViolation[] {
  if (!text) return [];
  const normalized = text.toLowerCase();
  const violations: EuComplianceViolation[] = [];

  for (const rule of EU_COMPLIANCE_RULES) {
    if (sector && rule.sector !== sector) continue;

    for (const pat of rule.patterns) {
      const match = pat.exec(normalized);
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
        break;
      }
    }
  }

  return violations;
}

export function getEuSectorName(sector: EuComplianceSector): string {
  switch (sector) {
    case "HEALTH_PHARMA":
      return "Health & Pharma (Dir 2001/83/EC & MDR)";
    case "FOOD_SUPPLEMENT":
      return "Food & Weight Loss (EFSA Reg 1924/2006)";
    case "GREEN_CLAIMS":
      return "Green Claims & Climate (Dir (EU) 2024/825)";
    case "CONSUMER_ECOMMERCE":
      return "E-Commerce & Pricing (Omnibus / UCPD)";
    case "FINANCIAL_SERVICES":
      return "Finance & Crypto (MiCA & MiFID II)";
    case "LEGAL_SERVICES":
      return "Legal Services (CCBE Standards)";
    case "TOBACCO_NICOTINE":
      return "Tobacco & Vaping (TPD 2014/40/EU)";
    default:
      return sector;
  }
}
