"""
United States (USA) Regulatory Compliance Rules for SEO, Advertising & Content.
Covers Federal Regulations & Standards:
- FTC Act Section 5 (15 U.S.C. § 45) - Unfair or Deceptive Practices & Substantive Truth in Advertising
- FTC Guides for the Use of Environmental Marketing Claims ("Green Guides", 16 CFR Part 260)
- FTC Endorsement Guides & Fake Reviews Final Rule (16 CFR Part 464 - Civil penalties up to $51,744/violation)
- FTC "Made in USA" Labeling Rule (16 CFR Part 323)
- FDA Federal Food, Drug, and Cosmetic Act (FD&C Act, 21 U.S.C. § 321 et seq.)
- Dietary Supplement Health and Education Act of 1994 (DSHEA, 21 U.S.C. § 343(r)(6) & 21 CFR 101.93)
- Prescription Drug DTC Advertising (21 CFR 202.1) & Ryan Haight Act (21 U.S.C. § 829)
- Securities Act of 1933 & Securities Exchange Act of 1934 (Rule 10b-5, 17 CFR § 240.10b-5)
- SEC Investment Adviser Marketing Rule (17 CFR § 275.206(4)-1) & Crypto Enforcement
- CFPB Truth in Lending Act (TILA, 12 CFR Part 1026 - Regulation Z) & Predatory Lending
- American Bar Association (ABA) Model Rules of Professional Conduct (Rule 7.1)
- Prevent All Cigarette Trafficking Act (PACT Act, 15 U.S.C. § 375 et seq.)
"""

import re
from enum import Enum
from typing import Dict, List, Optional, Any
from services.seo_engine.base import SeoRule, RuleCategory, IssueSeverity, RuleCheckResult


class UsComplianceSector(str, Enum):
    HEALTH_FDA = "HEALTH_FDA"
    SUPPLEMENTS_WEIGHTLOSS = "SUPPLEMENTS_WEIGHTLOSS"
    FTC_COMMERCIAL_DECEPTIVE = "FTC_COMMERCIAL_DECEPTIVE"
    FINANCIAL_SEC_CFPB = "FINANCIAL_SEC_CFPB"
    GREEN_GUIDES_FTC = "GREEN_GUIDES_FTC"
    LEGAL_ABA = "LEGAL_ABA"
    TOBACCO_PACT = "TOBACCO_PACT"


US_REGULATORY_RULES: List[Dict[str, Any]] = [
    # 1. Health, Pharmaceuticals & Medical Devices (FDA / FD&C Act)
    {
        "rule_id": "US_FDA_DISEASE_CURE",
        "sector": UsComplianceSector.HEALTH_FDA,
        "title": "Unapproved Medical Disease Treatment or Cure Claims",
        "patterns": [
            r"\bguaranteed\s+(?:cure|healing)\b",
            r"\bcures?\s+(?:cancer|diabetes|alzheimer'?s|arthritis|heart\s+disease|autism)\b",
            r"\bmiracle\s+(?:cure|treatment|remedy|healing)\b",
            r"\beradicate\s+(?:disease|tumor|infection)\s+completely\b",
            r"\b100%\s+guaranteed\s+recovery\b",
            r"\brevitalize\s+and\s+reverse\s+aging\s+disease\b",
        ],
        "legal_basis": "FD&C Act (21 U.S.C. § 321(g)(1)) & 21 CFR Part 310 (Unapproved New Drug Claims)",
        "penalty_risk": "FDA Warning Letters, product seizure, federal injunctions, and criminal prosecution under 21 U.S.C. § 333.",
        "suggested_fix": "State that product 'supports overall health under medical supervision' without claiming to diagnose, treat, cure, or prevent disease.",
        "severity": "CRITICAL",
    },
    {
        "rule_id": "US_FDA_ZERO_RISK",
        "sector": UsComplianceSector.HEALTH_FDA,
        "title": "Zero-Risk Medical Surgery or Procedure Claims",
        "patterns": [
            r"\bzero\s+risk\s+(?:surgery|operation|procedure)\b",
            r"\brisk[\s-]free\s+(?:surgery|procedure|implant|lasik)\b",
            r"\b100%\s+safe\s+(?:surgery|procedure|treatment)\b",
            r"\bno\s+possible\s+side\s+effects?\b",
            r"\bcompletely\s+painless\s+and\s+risk[\s-]free\b",
        ],
        "legal_basis": "FDA Medical Device Regulations (21 CFR Part 801) & FTC Act Section 5 (15 U.S.C. § 45)",
        "penalty_risk": "FTC deceptive advertising actions, civil penalties up to $51,744 per violation, and medical malpractice liability.",
        "suggested_fix": "Disclose that all medical procedures carry inherent risks and advise consulting a board-certified physician.",
        "severity": "CRITICAL",
    },
    {
        "rule_id": "US_FDA_POM_NO_PRESCRIPTION",
        "sector": UsComplianceSector.HEALTH_FDA,
        "title": "Online Sales of Prescription-Only Drugs Without Valid Rx",
        "patterns": [
            r"\b(?:buy|order)\s+(?:ozempic|wegovy|mounjaro|adderall|xanax|oxycodone|antibiotics)\s+without\s+prescription\b",
            r"\bno\s+prescription\s+(?:needed|required)\s+for\s+(?:ozempic|adderall|xanax)\b",
            r"\bovernight\s+(?:ozempic|wegovy)\s+no\s+rx\b",
        ],
        "legal_basis": "Ryan Haight Online Pharmacy Consumer Protection Act (21 U.S.C. § 829(e)) & FD&C Act (21 U.S.C. § 353(b))",
        "penalty_risk": "Federal felony prosecution (up to 20 years imprisonment), DEA raids, and immediate domain seizure by US DOJ.",
        "suggested_fix": "Prescription drugs can only be dispensed pursuant to a valid prescription from a licensed healthcare practitioner.",
        "severity": "CRITICAL",
    },

    # 2. Dietary Supplements & Weight Loss (FDA DSHEA / FTC)
    {
        "rule_id": "US_SUPPLEMENT_WEIGHTLOSS_RAPID",
        "sector": UsComplianceSector.SUPPLEMENTS_WEIGHTLOSS,
        "title": "Deceptive Rapid Weight Loss & Fat Burning Guarantees",
        "patterns": [
            r"\blose\s+\d+\s*(?:lbs?|pounds|kg)\s+in\s+\d+\s*(?:days?|weeks?)\b",
            r"\blose\s+weight\s+without\s+diet\s+or\s+exercise\b",
            r"\brapid\s+fat\s+melting\s+guarantee\b",
            r"\bburn\s+belly\s+fat\s+overnight\b",
            r"\bguaranteed\s+weight\s+loss\s+miracle\b",
            r"\beat\s+anything\s+and\s+lose\s+weight\b",
        ],
        "legal_basis": "FTC Act Section 5 & FTC 'Gut Check' Reference Guide for Media on Bogus Weight-Loss Claims",
        "penalty_risk": "FTC federal restitution orders, disgorgement of all sales revenues, and civil penalties up to $51,744/violation.",
        "suggested_fix": "State: 'May support weight management when combined with a balanced diet and regular exercise.'",
        "severity": "CRITICAL",
    },
    {
        "rule_id": "US_SUPPLEMENT_UNAPPROVED_STRUCTURE",
        "sector": UsComplianceSector.SUPPLEMENTS_WEIGHTLOSS,
        "title": "Dietary Supplement Disease Claims Lacking Mandatory DSHEA Disclaimer",
        "patterns": [
            r"\bprevents?\s+(?:diabetes|heart\s+disease|cancer|dementia)\b",
            r"\breverses?\s+(?:high\s+blood\s+pressure|hypertension)\b",
            r"\bnatural\s+alternative\s+to\s+(?:insulin|metformin|statins?)\b",
            r"\bclinically\s+proven\s+to\s+cure\b",
        ],
        "legal_basis": "DSHEA 21 U.S.C. § 343(r)(6) & 21 CFR 101.93 (Mandatory FDA Disclaimer requirement)",
        "penalty_risk": "FDA Warning Letters, import alerts, product detention, and FTC deceptive health claim enforcement.",
        "suggested_fix": "Use permissible structure/function claims and include the mandatory DSHEA disclaimer: 'These statements have not been evaluated by the FDA...'",
        "severity": "HIGH",
    },

    # 3. FTC Commercial Deceptive Practices, Fake Reviews & Made in USA
    {
        "rule_id": "US_FTC_FAKE_REVIEWS",
        "sector": UsComplianceSector.FTC_COMMERCIAL_DECEPTIVE,
        "title": "Incentivized or Deceptive Reviews Without Material Disclosure",
        "patterns": [
            r"\bpay\s+for\s+5[\s-]star\s+reviews?\b",
            r"\bbuy\s+(?:positive\s+google|yelp|trustpilot)\s+reviews?\b",
            r"\bguaranteed\s+5[\s-]star\s+ratings?\b",
            r"\bremove\s+all\s+negative\s+reviews?\s+guaranteed\b",
        ],
        "legal_basis": "FTC Final Rule on Fake Reviews and Testimonials (16 CFR Part 464) & 15 U.S.C. § 45",
        "penalty_risk": "Civil penalties up to $51,744 per violation and permanent injunctive relief under 15 U.S.C. § 45(m)(1)(A).",
        "suggested_fix": "Only collect genuine, unsolicited consumer reviews and prominently disclose any material incentives (#ad, sponsored).",
        "severity": "CRITICAL",
    },
    {
        "rule_id": "US_FTC_MADE_IN_USA",
        "sector": UsComplianceSector.FTC_COMMERCIAL_DECEPTIVE,
        "title": "Unqualified 'Made in USA' Claims Lacking All or Virtually All Domestic Content",
        "patterns": [
            r"\b100%\s+made\s+in\s+the\s+usa\b",
            r"\b100%\s+american\s+made\b",
            r"\ball[\s-]american\s+manufactured\b",
            r"\bproudly\s+made\s+in\s+america\b",
        ],
        "legal_basis": "FTC Made in USA Labeling Rule (16 CFR Part 323) & 15 U.S.C. § 45a",
        "penalty_risk": "FTC civil penalties exceeding $51,744 per occurrence and mandatory corrective advertising orders.",
        "suggested_fix": "Unless all or virtually all components and labor are domestic, use qualified claim: 'Assembled in USA from imported parts'.",
        "severity": "HIGH",
    },
    {
        "rule_id": "US_FTC_DECEPTIVE_FREE_TRIAL",
        "sector": UsComplianceSector.FTC_COMMERCIAL_DECEPTIVE,
        "title": "Deceptive 'Free Trial' with Undisclosed Negative Option Billing",
        "patterns": [
            r"\b100%\s+free\s+trial\s+no\s+risk\b",
            r"\bcompletely\s+free\s+trial\s+keep\s+it\s+forever\b",
            r"\bfree\s+sample\s+just\s+pay\s+\$(?:1|2|3|4|5)\s+s&h\b",
        ],
        "legal_basis": "Restore Online Shoppers' Confidence Act (ROSCA, 15 U.S.C. § 8401) & FTC Negative Option Rule",
        "penalty_risk": "Multi-million dollar FTC restitution judgments and credit card merchant account termination.",
        "suggested_fix": "Clearly and conspicuously disclose billing terms, recurring monthly subscription costs, and simple cancellation procedures before obtaining billing info.",
        "severity": "HIGH",
    },

    # 4. Financial Services, Crypto & Consumer Credit (SEC, CFTC, CFPB)
    {
        "rule_id": "US_FINANCE_GUARANTEED_RETURNS",
        "sector": UsComplianceSector.FINANCIAL_SEC_CFPB,
        "title": "Prohibited Guaranteed Investment Returns & Risk-Free Profits",
        "patterns": [
            r"\bguaranteed\s+(?:returns?|profits?|yield)\b",
            r"\brisk[\s-]free\s+(?:investing|investment|stock|trading)\b",
            r"\b100%\s+guaranteed\s+financial\s+gain\b",
            r"\bguaranteed\s+crypto\s+(?:yield|passive\s+income|profits?)\b",
            r"\bguaranteed\s+\d+%\s+(?:daily|weekly|annual)\s+(?:roi|returns?)\b",
            r"\b100%\s+win\s+rate\s+(?:trading\s+bot|options\s+signals?)\b",
        ],
        "legal_basis": "Securities Act Section 17(a) (15 U.S.C. § 77q) & Exchange Act Rule 10b-5 (17 CFR § 240.10b-5) & SEC Marketing Rule",
        "penalty_risk": "SEC and CFTC civil enforcement, disgorgement of profits plus prejudgment interest, third-tier civil penalties over $1,000,000, and DOJ criminal charges.",
        "suggested_fix": "Disclose risk: 'Investments involve risk, including possible loss of principal. Past performance is no guarantee of future results.'",
        "severity": "CRITICAL",
    },
    {
        "rule_id": "US_FINANCE_PREDATORY_LOANS",
        "sector": UsComplianceSector.FINANCIAL_SEC_CFPB,
        "title": "Predatory No-Credit-Check & Guaranteed Loan Claims",
        "patterns": [
            r"\binstant\s+loans?\s+no\s+credit\s+check\b",
            r"\bbad\s+credit\s+loans?\s+guaranteed\s+approval\b",
            r"\bno\s+credit\s+check\s+guaranteed\s+cash\b",
            r"\bcredit\s+score\s+does(?:n't|\s+not)\s+matter\s+guaranteed\b",
        ],
        "legal_basis": "Truth in Lending Act (TILA, 15 U.S.C. § 1601 et seq., Regulation Z) & CFPB Consumer Financial Protection Act Section 1036",
        "penalty_risk": "CFPB administrative enforcement, statutory damages of $1,000,000+ per day for reckless violations, and state AG lawsuits.",
        "suggested_fix": "State representative APR and note: 'Subject to credit approval and verification of income.'",
        "severity": "CRITICAL",
    },

    # 5. FTC Green Guides (Environmental Claims)
    {
        "rule_id": "US_GREEN_CARBON_NEUTRAL",
        "sector": UsComplianceSector.GREEN_GUIDES_FTC,
        "title": "Unsubstantiated Carbon Neutral & Offset Claims",
        "patterns": [
            r"\bcarbon\s+neutral\s+product\b",
            r"\bclimate\s+neutral\s+guarantee\b",
            r"\bnet[\s-]zero\s+emissions?\s+guarantee\b",
            r"\b100%\s+carbon\s+offset\s+verified\b",
            r"\b100%\s+eco[\s-]friendly\b",
            r"\bcompletely\s+environmentally\s+safe\b",
            r"\bzero\s+environmental\s+impact\b",
        ],
        "legal_basis": "FTC Guides for the Use of Environmental Marketing Claims ('Green Guides', 16 CFR Part 260)",
        "penalty_risk": "FTC enforcement actions for deceptive environmental marketing and California FAL class action lawsuits.",
        "suggested_fix": "Specify precise verified environmental benefits (e.g., 'Made with 75% recycled PET') supported by competent scientific evidence.",
        "severity": "HIGH",
    },

    # 6. Legal Advertising (American Bar Association Model Rules)
    {
        "rule_id": "US_LEGAL_OUTCOME_GUARANTEE",
        "sector": UsComplianceSector.LEGAL_ABA,
        "title": "Guaranteed Legal Outcomes & Misleading Attorney Superlatives",
        "patterns": [
            r"\bguaranteed\s+(?:court\s+victory|case\s+win|verdict|settlement)\b",
            r"\b100%\s+success\s+rate\s+(?:lawyer|attorney|law\s+firm)\b",
            r"\bbest\s+lawyer\s+in\s+(?:america|the\s+us|new\s+york|california|texas|florida)\b",
            r"\bwe\s+never\s+lose\s+a\s+case\b",
            r"\bguaranteed\s+million\s+dollar\s+settlement\b",
        ],
        "legal_basis": "ABA Model Rules of Professional Conduct (Rule 7.1) & State Bar Advertising Rules",
        "penalty_risk": "State Bar disciplinary proceedings, public reprimand, suspension, disbarment, and civil liability for false advertising.",
        "suggested_fix": "State: 'Prior results do not guarantee a similar outcome.' Describe practice areas and credentials objectively.",
        "severity": "CRITICAL",
    },

    # 7. Tobacco & Vaping Online Sales (PACT Act & FDA PMTA)
    {
        "rule_id": "US_TOBACCO_ONLINE_SALES",
        "sector": UsComplianceSector.TOBACCO_PACT,
        "title": "Online Promotion & Mail-Order of E-Cigarettes and Vapes",
        "patterns": [
            r"\bbuy\s+vapes?\s+online\s+cheap\b",
            r"\border\s+puff\s+bars?\s+online\b",
            r"\bdisposable\s+vapes?\s+free\s+shipping\b",
            r"\bbuy\s+nicotine\s+e[\s-]liquid\s+online\b",
            r"\bmail\s+order\s+cigarettes\b",
        ],
        "legal_basis": "Prevent All Cigarette Trafficking Act (PACT Act, 15 U.S.C. § 375 et seq.) & USPS Vape Mail Ban",
        "penalty_risk": "Federal criminal penalties up to 3 years imprisonment, civil penalties up to $5,000 per violation, and ATF seizure.",
        "suggested_fix": "Online retail distribution and mailing of e-cigarettes and vaping products to consumers is restricted under federal law.",
        "severity": "CRITICAL",
    },
]


def scan_text_for_us_compliance(text: str, sector: Optional[str] = None) -> List[Dict[str, Any]]:
    """Scans text against US regulatory compliance rules."""
    if not text:
        return []

    violations = []
    text_lower = text.lower()

    for rule in US_REGULATORY_RULES:
        if sector and rule["sector"].value != sector:
            continue

        for pattern in rule["patterns"]:
            match = re.search(pattern, text_lower, re.IGNORECASE)
            if match:
                start = match.start()
                end = match.end()
                snippet = text[max(0, start - 25): min(len(text), end + 25)].strip()

                violations.append({
                    "rule_id": rule["rule_id"],
                    "sector": rule["sector"].value,
                    "title": rule["title"],
                    "matched_pattern": match.group(0),
                    "context_snippet": snippet,
                    "legal_basis": rule["legal_basis"],
                    "penalty_risk": rule["penalty_risk"],
                    "suggested_fix": rule["suggested_fix"],
                    "severity": rule["severity"],
                })
                break

    return violations


class UsRegulatoryComplianceRule(SeoRule):
    """
    Evaluates page content against United States Federal Regulatory Standards
    (FTC Act Section 5, FDA FD&C Act / DSHEA, SEC Rule 10b-5, ABA Rules, PACT Act).
    """

    rule_id = "RULE_US_REGULATORY_COMPLIANCE"
    name = "United States (US) Regulatory & Truth in Advertising Compliance Shield"
    category = RuleCategory.COMPLIANCE
    default_severity = IssueSeverity.CRITICAL
    documentation_url = "https://www.ftc.gov/business-guidance/advertising-marketing"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        fields_to_check = [
            ("title", page_context.get("title") or ""),
            ("meta_description", page_context.get("meta_description") or ""),
            ("h1", page_context.get("h1") or ""),
            ("h2", " ".join(page_context.get("h2", [])) if isinstance(page_context.get("h2"), list) else str(page_context.get("h2") or "")),
            ("content", page_context.get("content") or page_context.get("body_text") or ""),
            ("url", page_context.get("url") or "")
        ]

        aggregated_text = "\n".join([val for _, val in fields_to_check if val])
        if not aggregated_text.strip():
            return None

        violations = scan_text_for_us_compliance(aggregated_text)
        if not violations:
            return None

        critical_count = sum(1 for v in violations if v["severity"] == "CRITICAL")
        chosen_severity = IssueSeverity.CRITICAL if critical_count > 0 else IssueSeverity.HIGH

        first_v = violations[0]
        violation_list_str = ", ".join([f"'{v['matched_pattern']}' ({v['title']})" for v in violations[:3]])

        return RuleCheckResult(
            passed=False,
            rule_id=self.rule_id,
            category=self.category,
            severity=chosen_severity,
            confidence=1.0,
            title=f"US Regulatory Violation: {first_v['title']}",
            description=(
                f"Page content contains {len(violations)} prohibited claim(s) under US Federal Law (FTC/FDA/SEC): "
                f"{violation_list_str}. Legal Basis: {first_v['legal_basis']}"
            ),
            evidence={
                "url": page_context.get("url"),
                "total_violations": len(violations),
                "violations": violations,
                "penalty_risk": first_v["penalty_risk"],
            },
            recommendation_template=(
                f"Remove the non-compliant phrase '{first_v['matched_pattern']}' immediately. "
                f"Compliant US Alternative: {first_v['suggested_fix']}"
            ),
            documentation_url=self.documentation_url
        )
