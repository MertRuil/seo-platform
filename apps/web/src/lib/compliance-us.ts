/**
 * United States (US) Regulatory & Advertising Compliance Rules Library
 * Covering Federal Statutes & Regulatory Agencies:
 * - FTC Act Section 5 (15 U.S.C. § 45) - Unfair or Deceptive Acts or Practices
 * - FTC Guides for the Use of Environmental Marketing Claims ("Green Guides", 16 CFR Part 260)
 * - FTC Final Rule on Fake Reviews and Testimonials (16 CFR Part 464 - $51,744/violation)
 * - FTC "Made in USA" Labeling Rule (16 CFR Part 323)
 * - Restore Online Shoppers' Confidence Act (ROSCA, 15 U.S.C. § 8401)
 * - FDA Federal Food, Drug, and Cosmetic Act (FD&C Act, 21 U.S.C. § 321 et seq.)
 * - Dietary Supplement Health and Education Act of 1994 (DSHEA, 21 U.S.C. § 343(r)(6))
 * - Ryan Haight Online Pharmacy Consumer Protection Act (21 U.S.C. § 829(e))
 * - Securities Act of 1933 & Exchange Act Rule 10b-5 (17 CFR § 240.10b-5)
 * - SEC Investment Adviser Marketing Rule (17 CFR § 275.206(4)-1)
 * - CFPB Truth in Lending Act (TILA, 12 CFR Part 1026 - Regulation Z)
 * - American Bar Association (ABA) Model Rules of Professional Conduct (Rule 7.1)
 * - Prevent All Cigarette Trafficking Act (PACT Act, 15 U.S.C. § 375 et seq.)
 */

export type UsComplianceSector =
  | "HEALTH_FDA"
  | "SUPPLEMENTS_WEIGHTLOSS"
  | "FTC_COMMERCIAL_DECEPTIVE"
  | "FINANCIAL_SEC_CFPB"
  | "GREEN_GUIDES_FTC"
  | "LEGAL_ABA"
  | "TOBACCO_PACT";

export interface UsComplianceViolation {
  ruleId: string;
  sector: UsComplianceSector;
  title: string;
  matchedPattern: string;
  contextSnippet: string;
  legalBasis: string;
  penaltyRisk: string;
  suggestedFix: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
}

export interface UsRuleDefinition {
  id: string;
  sector: UsComplianceSector;
  title: string;
  patterns: RegExp[];
  legalBasis: string;
  penaltyRisk: string;
  suggestedFix: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
}

export const US_COMPLIANCE_RULES: UsRuleDefinition[] = [
  // 1. Health, Pharmaceuticals & Medical Devices (FDA / FD&C Act)
  {
    id: "US_FDA_DISEASE_CURE",
    sector: "HEALTH_FDA",
    title: "Prohibited Unapproved Medical Disease Treatment or Cure Claims",
    patterns: [
      /\bguaranteed\s+(?:cure|healing)\b/i,
      /\bcures?\s+(?:cancer|diabetes|alzheimer'?s|arthritis|heart\s+disease|autism)\b/i,
      /\bmiracle\s+(?:cure|treatment|remedy|healing)\b/i,
      /\beradicate\s+(?:disease|tumor|infection)\s+completely\b/i,
      /\b100%\s+guaranteed\s+recovery\b/i,
      /\brevitalize\s+and\s+reverse\s+aging\s+disease\b/i,
    ],
    legalBasis: "FD&C Act (21 U.S.C. § 321(g)(1)) & 21 CFR Part 310 (Unapproved New Drug Claims)",
    penaltyRisk: "FDA Warning Letters, product seizure, federal injunctions, and criminal prosecution under 21 U.S.C. § 333.",
    suggestedFix: "State that product 'supports overall wellness under medical supervision' without claiming to diagnose, treat, cure, or prevent disease.",
    severity: "CRITICAL",
  },
  {
    id: "US_FDA_ZERO_RISK",
    sector: "HEALTH_FDA",
    title: "Zero-Risk Medical Surgery or Procedure Claims",
    patterns: [
      /\bzero\s+risk\s+(?:surgery|operation|procedure)\b/i,
      /\brisk[\s-]free\s+(?:surgery|procedure|implant|lasik)\b/i,
      /\b100%\s+safe\s+(?:surgery|procedure|treatment)\b/i,
      /\bno\s+possible\s+side\s+effects?\b/i,
      /\bcompletely\s+painless\s+and\s+risk[\s-]free\b/i,
    ],
    legalBasis: "FDA Medical Device Regulations (21 CFR Part 801) & FTC Act Section 5 (15 U.S.C. § 45)",
    penaltyRisk: "FTC deceptive advertising actions, civil penalties up to $51,744 per violation, and medical malpractice liability.",
    suggestedFix: "Disclose that all medical procedures carry inherent risks and advise consulting a board-certified physician.",
    severity: "CRITICAL",
  },
  {
    id: "US_FDA_POM_NO_PRESCRIPTION",
    sector: "HEALTH_FDA",
    title: "Online Sales of Prescription-Only Drugs Without Valid Rx",
    patterns: [
      /\b(?:buy|order)\s+(?:ozempic|wegovy|mounjaro|adderall|xanax|oxycodone|antibiotics)\s+without\s+prescription\b/i,
      /\bno\s+prescription\s+(?:needed|required)\s+for\s+(?:ozempic|adderall|xanax)\b/i,
      /\bovernight\s+(?:ozempic|wegovy)\s+no\s+rx\b/i,
    ],
    legalBasis: "Ryan Haight Online Pharmacy Consumer Protection Act (21 U.S.C. § 829(e)) & FD&C Act (21 U.S.C. § 353(b))",
    penaltyRisk: "Federal felony prosecution (up to 20 years imprisonment), DEA raids, and immediate domain seizure by US DOJ.",
    suggestedFix: "Prescription drugs can only be dispensed pursuant to a valid prescription from a licensed healthcare practitioner.",
    severity: "CRITICAL",
  },

  // 2. Dietary Supplements & Weight Loss (FDA DSHEA / FTC)
  {
    id: "US_SUPPLEMENT_WEIGHTLOSS_RAPID",
    sector: "SUPPLEMENTS_WEIGHTLOSS",
    title: "Deceptive Rapid Weight Loss & Fat Burning Guarantees",
    patterns: [
      /\blose\s+\d+\s*(?:lbs?|pounds|kg)\s+in\s+\d+\s*(?:days?|weeks?)\b/i,
      /\blose\s+weight\s+without\s+diet\s+or\s+exercise\b/i,
      /\brapid\s+fat\s+melting\s+guarantee\b/i,
      /\bburn\s+belly\s+fat\s+overnight\b/i,
      /\bguaranteed\s+weight\s+loss\s+miracle\b/i,
      /\beat\s+anything\s+and\s+lose\s+weight\b/i,
    ],
    legalBasis: "FTC Act Section 5 & FTC 'Gut Check' Reference Guide for Media on Bogus Weight-Loss Claims",
    penaltyRisk: "FTC federal restitution orders, disgorgement of all sales revenues, and civil penalties up to $51,744/violation.",
    suggestedFix: "State: 'May support weight management when combined with a balanced diet and regular exercise.'",
    severity: "CRITICAL",
  },
  {
    id: "US_SUPPLEMENT_UNAPPROVED_STRUCTURE",
    sector: "SUPPLEMENTS_WEIGHTLOSS",
    title: "Dietary Supplement Disease Claims Lacking Mandatory DSHEA Disclaimer",
    patterns: [
      /\bprevents?\s+(?:diabetes|heart\s+disease|cancer|dementia)\b/i,
      /\breverses?\s+(?:high\s+blood\s+pressure|hypertension)\b/i,
      /\bnatural\s+alternative\s+to\s+(?:insulin|metformin|statins?)\b/i,
      /\bclinically\s+proven\s+to\s+cure\b/i,
    ],
    legalBasis: "DSHEA 21 U.S.C. § 343(r)(6) & 21 CFR 101.93 (Mandatory FDA Disclaimer requirement)",
    penaltyRisk: "FDA Warning Letters, import alerts, product detention, and FTC deceptive health claim enforcement.",
    suggestedFix: "Use permissible structure/function claims and include the mandatory DSHEA disclaimer: 'These statements have not been evaluated by the FDA...'",
    severity: "HIGH",
  },

  // 3. FTC Commercial Deceptive Practices, Fake Reviews & Made in USA
  {
    id: "US_FTC_FAKE_REVIEWS",
    sector: "FTC_COMMERCIAL_DECEPTIVE",
    title: "Incentivized or Deceptive Reviews Without Material Disclosure",
    patterns: [
      /\bpay\s+for\s+5[\s-]star\s+reviews?\b/i,
      /\bbuy\s+(?:positive\s+google|yelp|trustpilot)\s+reviews?\b/i,
      /\bguaranteed\s+5[\s-]star\s+ratings?\b/i,
      /\bremove\s+all\s+negative\s+reviews?\s+guaranteed\b/i,
    ],
    legalBasis: "FTC Final Rule on Fake Reviews and Testimonials (16 CFR Part 464) & 15 U.S.C. § 45",
    penaltyRisk: "Civil penalties up to $51,744 per violation and permanent injunctive relief under 15 U.S.C. § 45(m)(1)(A).",
    suggestedFix: "Only collect genuine, unsolicited consumer reviews and prominently disclose any material incentives (#ad, sponsored).",
    severity: "CRITICAL",
  },
  {
    id: "US_FTC_MADE_IN_USA",
    sector: "FTC_COMMERCIAL_DECEPTIVE",
    title: "Unqualified 'Made in USA' Claims Lacking Domestic Content",
    patterns: [
      /\b100%\s+made\s+in\s+the\s+usa\b/i,
      /\b100%\s+american\s+made\b/i,
      /\ball[\s-]american\s+manufactured\b/i,
      /\bproudly\s+made\s+in\s+america\b/i,
    ],
    legalBasis: "FTC Made in USA Labeling Rule (16 CFR Part 323) & 15 U.S.C. § 45a",
    penaltyRisk: "FTC civil penalties exceeding $51,744 per occurrence and mandatory corrective advertising orders.",
    suggestedFix: "Unless all or virtually all components and labor are domestic, use qualified claim: 'Assembled in USA from imported parts'.",
    severity: "HIGH",
  },
  {
    id: "US_FTC_DECEPTIVE_FREE_TRIAL",
    sector: "FTC_COMMERCIAL_DECEPTIVE",
    title: "Deceptive 'Free Trial' with Undisclosed Negative Option Billing",
    patterns: [
      /\b100%\s+free\s+trial\s+no\s+risk\b/i,
      /\bcompletely\s+free\s+trial\s+keep\s+it\s+forever\b/i,
      /\bfree\s+sample\s+just\s+pay\s+\$(?:1|2|3|4|5)\s+s&h\b/i,
    ],
    legalBasis: "Restore Online Shoppers' Confidence Act (ROSCA, 15 U.S.C. § 8401) & FTC Negative Option Rule",
    penaltyRisk: "Multi-million dollar FTC restitution judgments and credit card merchant account termination.",
    suggestedFix: "Clearly and conspicuously disclose billing terms, recurring monthly subscription costs, and simple cancellation procedures before obtaining billing info.",
    severity: "HIGH",
  },

  // 4. Financial Services, Crypto & Consumer Credit (SEC, CFTC, CFPB)
  {
    id: "US_FINANCE_GUARANTEED_RETURNS",
    sector: "FINANCIAL_SEC_CFPB",
    title: "Prohibited Guaranteed Investment Returns & Risk-Free Profits",
    patterns: [
      /\bguaranteed\s+(?:returns?|profits?|yield)\b/i,
      /\brisk[\s-]free\s+(?:investing|investment|stock|trading)\b/i,
      /\b100%\s+guaranteed\s+financial\s+gain\b/i,
      /\bguaranteed\s+crypto\s+(?:yield|passive\s+income|profits?)\b/i,
      /\bguaranteed\s+\d+%\s+(?:daily|weekly|annual)\s+(?:roi|returns?)\b/i,
      /\b100%\s+win\s+rate\s+(?:trading\s+bot|options\s+signals?)\b/i,
    ],
    legalBasis: "Securities Act Section 17(a) (15 U.S.C. § 77q) & Exchange Act Rule 10b-5 (17 CFR § 240.10b-5) & SEC Marketing Rule",
    penaltyRisk: "SEC and CFTC civil enforcement, disgorgement of profits plus prejudgment interest, third-tier civil penalties over $1,000,000, and DOJ criminal charges.",
    suggestedFix: "Disclose risk: 'Investments involve risk, including possible loss of principal. Past performance is no guarantee of future results.'",
    severity: "CRITICAL",
  },
  {
    id: "US_FINANCE_PREDATORY_LOANS",
    sector: "FINANCIAL_SEC_CFPB",
    title: "Predatory No-Credit-Check & Guaranteed Loan Claims",
    patterns: [
      /\binstant\s+loans?\s+no\s+credit\s+check\b/i,
      /\bbad\s+credit\s+loans?\s+guaranteed\s+approval\b/i,
      /\bno\s+credit\s+check\s+guaranteed\s+cash\b/i,
      /\bcredit\s+score\s+does(?:n't|\s+not)\s+matter\s+guaranteed\b/i,
    ],
    legalBasis: "Truth in Lending Act (TILA, 15 U.S.C. § 1601 et seq., Regulation Z) & CFPB Consumer Financial Protection Act Section 1036",
    penaltyRisk: "CFPB administrative enforcement, statutory damages of $1,000,000+ per day for reckless violations, and state AG lawsuits.",
    suggestedFix: "State representative APR and note: 'Subject to credit approval and verification of income.'",
    severity: "CRITICAL",
  },

  // 5. FTC Green Guides (Environmental Claims)
  {
    id: "US_GREEN_CARBON_NEUTRAL",
    sector: "GREEN_GUIDES_FTC",
    title: "Unsubstantiated Carbon Neutral & Offset Claims",
    patterns: [
      /\bcarbon\s+neutral\s+product\b/i,
      /\bclimate\s+neutral\s+guarantee\b/i,
      /\bnet[\s-]zero\s+emissions?\s+guarantee\b/i,
      /\b100%\s+carbon\s+offset\s+verified\b/i,
      /\b100%\s+eco[\s-]friendly\b/i,
      /\bcompletely\s+environmentally\s+safe\b/i,
      /\bzero\s+environmental\s+impact\b/i,
    ],
    legalBasis: "FTC Guides for the Use of Environmental Marketing Claims ('Green Guides', 16 CFR Part 260)",
    penaltyRisk: "FTC enforcement actions for deceptive environmental marketing and California FAL class action lawsuits.",
    suggestedFix: "Specify precise verified environmental benefits (e.g., 'Made with 75% recycled PET') supported by competent scientific evidence.",
    severity: "HIGH",
  },

  // 6. Legal Advertising (American Bar Association Model Rules)
  {
    id: "US_LEGAL_OUTCOME_GUARANTEE",
    sector: "LEGAL_ABA",
    title: "Guaranteed Legal Outcomes & Misleading Attorney Superlatives",
    patterns: [
      /\bguaranteed\s+(?:court\s+victory|case\s+win|verdict|settlement)\b/i,
      /\b100%\s+success\s+rate\s+(?:lawyer|attorney|law\s+firm)\b/i,
      /\bbest\s+lawyer\s+in\s+(?:america|the\s+us|new\s+york|california|texas|florida)\b/i,
      /\bwe\s+never\s+lose\s+a\s+case\b/i,
      /\bguaranteed\s+million\s+dollar\s+settlement\b/i,
    ],
    legalBasis: "ABA Model Rules of Professional Conduct (Rule 7.1) & State Bar Advertising Rules",
    penaltyRisk: "State Bar disciplinary proceedings, public reprimand, suspension, disbarment, and civil liability for false advertising.",
    suggestedFix: "State: 'Prior results do not guarantee a similar outcome.' Describe practice areas and credentials objectively.",
    severity: "CRITICAL",
  },

  // 7. Tobacco & Vaping Online Sales (PACT Act & FDA PMTA)
  {
    id: "US_TOBACCO_ONLINE_SALES",
    sector: "TOBACCO_PACT",
    title: "Online Promotion & Mail-Order of E-Cigarettes and Vapes",
    patterns: [
      /\bbuy\s+vapes?\s+online\s+cheap\b/i,
      /\border\s+puff\s+bars?\s+online\b/i,
      /\bdisposable\s+vapes?\s+free\s+shipping\b/i,
      /\bbuy\s+nicotine\s+e[\s-]liquid\s+online\b/i,
      /\bmail\s+order\s+cigarettes\b/i,
    ],
    legalBasis: "Prevent All Cigarette Trafficking Act (PACT Act, 15 U.S.C. § 375 et seq.) & USPS Vape Mail Ban",
    penaltyRisk: "Federal criminal penalties up to 3 years imprisonment, civil penalties up to $5,000 per violation, and ATF seizure.",
    suggestedFix: "Online retail distribution and mailing of e-cigarettes and vaping products to consumers is restricted under federal law.",
    severity: "CRITICAL",
  },
];

export function scanUsCompliance(text: string, sector?: UsComplianceSector): UsComplianceViolation[] {
  if (!text) return [];
  const normalized = text.toLowerCase();
  const violations: UsComplianceViolation[] = [];

  for (const rule of US_COMPLIANCE_RULES) {
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

export function getUsSectorName(sector: UsComplianceSector): string {
  switch (sector) {
    case "HEALTH_FDA":
      return "Health & FDA (FD&C Act & Ryan Haight)";
    case "SUPPLEMENTS_WEIGHTLOSS":
      return "Supplements & Weight Loss (DSHEA / FTC)";
    case "FTC_COMMERCIAL_DECEPTIVE":
      return "FTC Deceptive & Reviews (16 CFR Part 464)";
    case "FINANCIAL_SEC_CFPB":
      return "Securities & Lending (SEC 10b-5 / TILA)";
    case "GREEN_GUIDES_FTC":
      return "Environmental Claims (FTC Green Guides)";
    case "LEGAL_ABA":
      return "Legal Services (ABA Model Rule 7.1)";
    case "TOBACCO_PACT":
      return "Tobacco & Vaping (PACT Act & FDA PMTA)";
    default:
      return sector;
  }
}
