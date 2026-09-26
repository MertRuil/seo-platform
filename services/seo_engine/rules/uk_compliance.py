import re
from typing import Any, Dict, Optional, List
from enum import Enum
from services.seo_engine.base import SeoRule, RuleCategory, IssueSeverity, RuleCheckResult

class UkComplianceSector(str, Enum):
    HEALTH_ASA_CAP = "HEALTH_ASA_CAP"
    FINANCIAL_FCA = "FINANCIAL_FCA"
    GREEN_CLAIMS_CMA = "GREEN_CLAIMS_CMA"
    CONSUMER_CMA_ASA = "CONSUMER_CMA_ASA"
    VAPING_TOBACCO_ASA = "VAPING_TOBACCO_ASA"

def normalize_uk_text(text: str) -> str:
    """Normalizes text for British English compliance matching."""
    if not text:
        return ""
    return text.lower()

UK_REGULATORY_RULES = [
    # -------------------------------------------------------------
    # 1. HEALTH, MEDICAL & COSMETIC INJECTIONS (ASA CAP RULE 12 & HUMAN MEDICINES REGS 2012)
    # -------------------------------------------------------------
    {
        "id": "UK_ASA_POM_BOTOX",
        "sector": UkComplianceSector.HEALTH_ASA_CAP,
        "title": "Prohibited Advertising of Prescription-Only Medicines (Botox / POMs)",
        "patterns": [
            r"\b(?:botox|botulinum\s+toxin|dysport|azzalure|bocouture|vistabel)\b",
            r"\bbotox\s+(?:injections?|treatments?|clinic|filler|prices?|offers?)\b",
            r"\bprescription[\s-]only\s+medicine\s+promotion\b",
            r"\b(?:ozempic|wegovy)\s+(?:weight\s+loss|slimming|sale|buy)\b",
        ],
        "legal_basis": "UK ASA CAP Code Rule 12.12 & Human Medicines Regulations 2012 (Regulation 284)",
        "penalty_risk": "ASA public ruling, MHRA statutory investigation, immediate digital ad takedown, and professional tribunal referral.",
        "suggested_fix": "Remove all references to Botox or specific prescription brands. Use neutral descriptions like 'consultation for fine lines' or 'aesthetic medical consultations'.",
        "severity": IssueSeverity.CRITICAL,
    },
    {
        "id": "UK_ASA_HEALTH_CURE_CLAIM",
        "sector": UkComplianceSector.HEALTH_ASA_CAP,
        "title": "Prohibited Unproven Medicinal Treatment & Guaranteed Cure Claims",
        "patterns": [
            r"\b(?:cures?|eradicate)\s+cancer\b",
            r"\bmiracle\s+(?:cure|healing|remedy|treatment)\b",
            r"\b100%\s+guaranteed\s+(?:cure|recovery|healing)\b",
            r"\bproven\s+cure\s+for\s+(?:diabetes|arthritis|autism|cancer)\b",
            r"\bguaranteed\s+slimming\b",
            r"\beffortless\s+fat\s+(?:burning|loss)\b",
        ],
        "legal_basis": "UK ASA CAP Code Rule 12.1 (Objective claims must be backed by robust scientific evidence) & Rule 12.2",
        "penalty_risk": "ASA formal adjudication, Trading Standards legal prosecution for unfair and misleading medical marketing.",
        "suggested_fix": "Eliminate absolute cure and recovery promises; qualify statements with verified clinical trial context.",
        "severity": IssueSeverity.CRITICAL,
    },

    # -------------------------------------------------------------
    # 2. FINANCIAL CONDUCT AUTHORITY (FCA PS23/6 & FSMA 2000 SECTION 21)
    # -------------------------------------------------------------
    {
        "id": "UK_FCA_CRYPTO_PROMOTION",
        "sector": UkComplianceSector.FINANCIAL_FCA,
        "title": "FCA Financial Promotions Violation: Crypto Without Mandatory Risk Warning",
        "patterns": [
            r"\b(?:guaranteed|risk[\s-]free|zero[\s-]risk)\s+crypto(?:currency)?\b",
            r"\b100%\s+profit\s+crypto\b",
            r"\bfree\s+crypto\s+on\s+sign[\s-]up\b",
            r"\brefer\s+a\s+friend\s+(?:crypto|bonus)\b",
            r"\bpassive\s+crypto\s+income\s+guaranteed\b",
        ],
        "legal_basis": "FCA Financial Promotions Regime for Cryptoassets (PS23/6 & FSMA 2000 Section 21)",
        "penalty_risk": "Criminal offence under FSMA 2000 Section 21, unlimited statutory fines, FCA warning list, domain and app store blocks.",
        "suggested_fix": "Include statutory FCA risk warning ('Don’t invest unless you’re prepared to lose all the money you invest') and remove incentives to invest.",
        "severity": IssueSeverity.CRITICAL,
    },
    {
        "id": "UK_FCA_GUARANTEED_RETURNS",
        "sector": UkComplianceSector.FINANCIAL_FCA,
        "title": "Prohibited Guaranteed Returns on High-Risk Investments",
        "patterns": [
            r"\bguaranteed\s+(?:returns?|profits?|yields?)\s+on\s+investments?\b",
            r"\brisk[\s-]free\s+(?:forex|trading|stocks?|investing)\b",
            r"\b100%\s+capital\s+guaranteed\s+(?:trading|crypto)\b",
        ],
        "legal_basis": "FCA Consumer Duty (Principle 12) & Financial Promotions Rules (COBS 4)",
        "penalty_risk": "FCA enforcement action, civil restitution orders, and prohibition notices.",
        "suggested_fix": "State clearly that capital is at risk and returns can go down as well as up.",
        "severity": IssueSeverity.CRITICAL,
    },

    # -------------------------------------------------------------
    # 3. CMA GREEN CLAIMS CODE & DMCC ACT 2024 (ENVIRONMENTAL CLAIMS)
    # -------------------------------------------------------------
    {
        "id": "UK_CMA_GREENWASHING",
        "sector": UkComplianceSector.GREEN_CLAIMS_CMA,
        "title": "CMA Green Claims Code Violation: Absolute & Unsubstantiated Eco Claims",
        "patterns": [
            r"\b100%\s+(?:eco[\s-]friendly|green|sustainable|natural)\b",
            r"\bcompletely\s+(?:eco[\s-]friendly|sustainable|carbon[\s-]free)\b",
            r"\bzero\s+carbon\s+product\b",
            r"\bthe\s+greenest\s+(?:choice|product|brand)\b",
            r"\bplanet[\s-]positive\s+product\b",
        ],
        "legal_basis": "CMA Green Claims Code Guidance & Digital Markets, Competition and Consumers (DMCC) Act 2024",
        "penalty_risk": "Direct statutory administrative fines by the CMA up to 10% of global annual turnover or £300,000.",
        "suggested_fix": "Avoid broad absolute terms like '100% eco-friendly'. Specify exact measurable substantiation (e.g., 'Packaging made from 85% recycled materials').",
        "severity": IssueSeverity.HIGH,
    },

    # -------------------------------------------------------------
    # 4. CMA & ASA CONSUMER PROTECTION (DMCC ACT 2024 & CAP CODE RULE 3)
    # -------------------------------------------------------------
    {
        "id": "UK_CMA_DARK_PATTERNS",
        "sector": UkComplianceSector.CONSUMER_CMA_ASA,
        "title": "Prohibited Fake Scarcity, Urgency & Dark Patterns",
        "patterns": [
            r"\bonly\s+\d+\s+left\s+in\s+stock\b",
            r"\boffer\s+expires\s+in\s+\d+\s+minutes?\b",
            r"\bcountdown\s+timer\s+hurry\b",
            r"\bbest\s+price\s+guaranteed\s+in\s+the\s+uk\b",
        ],
        "legal_basis": "DMCC Act 2024 (Schedule 20 Banned Commercial Practices) & ASA CAP Code Rule 3.1",
        "penalty_risk": "CMA consumer enforcement action, statutory compensation orders, and public sanctions.",
        "suggested_fix": "Ensure stock indicators reflect live, verified ERP inventory and remove artificial time-pressure countdowns.",
        "severity": IssueSeverity.HIGH,
    },

    # -------------------------------------------------------------
    # 5. TOBACCO & NICOTINE VAPING (CAP RULE 22 & TRPR 2016)
    # -------------------------------------------------------------
    {
        "id": "UK_ASA_VAPING_PROMOTION",
        "sector": UkComplianceSector.VAPING_TOBACCO_ASA,
        "title": "Prohibited Online Advertising of Nicotine Vaping Products",
        "patterns": [
            r"\b(?:disposable\s+vape|elf\s+bar|geek\s+bar|crystal\s+bar)\s+(?:promotion|sale|deal)\b",
            r"\bbuy\s+nicotine\s+vapes?\s+online\b",
            r"\bcheap\s+disposable\s+vapes?\b",
        ],
        "legal_basis": "UK ASA CAP Code Rule 22.12 & Tobacco and Related Products Regulations 2016 (TRPR)",
        "penalty_risk": "Trading Standards product seizure, ASA enforcement notices, and online advertising prohibition.",
        "suggested_fix": "Prohibit direct promotional advertising of unlicensed nicotine vapes on public websites and web metadata.",
        "severity": IssueSeverity.CRITICAL,
    },
]

def scan_text_for_uk_compliance(text: str) -> List[Dict[str, Any]]:
    """Scans text for UK post-Brexit regulatory violations."""
    if not text:
        return []

    norm_text = normalize_uk_text(text)
    violations = []

    for rule in UK_REGULATORY_RULES:
        for pat in rule["patterns"]:
            match = re.search(pat, norm_text, re.IGNORECASE)
            if match:
                matched_str = match.group(0)
                start_idx = max(0, match.start() - 35)
                end_idx = min(len(norm_text), match.end() + 35)
                context_snippet = norm_text[start_idx:end_idx].strip()

                violations.append({
                    "rule_id": rule["id"],
                    "sector": rule["sector"].value,
                    "title": rule["title"],
                    "matched_pattern": pat,
                    "matched_term": matched_str,
                    "context_snippet": f"...{context_snippet}...",
                    "legal_basis": rule["legal_basis"],
                    "penalty_risk": rule["penalty_risk"],
                    "suggested_fix": rule["suggested_fix"],
                    "severity": rule["severity"].value
                })
                break

    return violations

class UkRegulatoryComplianceRule(SeoRule):
    """
    Deterministic rule that scans on-page content, meta titles, descriptions, and headings
    against UK post-Brexit regulatory frameworks (ASA / CAP Code, CMA Green Claims & DMCC Act 2024, FCA PS23/6).
    """
    rule_id = "RULE_UK_REGULATORY_COMPLIANCE"
    name = "UK Post-Brexit Advertising & Regulatory Compliance Shield"
    category = RuleCategory.COMPLIANCE
    default_severity = IssueSeverity.CRITICAL
    documentation_url = "https://www.asa.org.uk/codes-and-rulings/advertising-codes/non-broadcast-code.html"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        h1_val = page_context.get("h1") or ""
        h1_str = " ".join(h1_val) if isinstance(h1_val, list) else str(h1_val)
        h2_val = page_context.get("h2") or ""
        h2_str = " ".join(h2_val) if isinstance(h2_val, list) else str(h2_val)

        fields_to_check = [
            ("title", page_context.get("title") or ""),
            ("meta_description", page_context.get("meta_description") or ""),
            ("h1", h1_str),
            ("h2", h2_str),
            ("content", page_context.get("content") or page_context.get("body_text") or ""),
            ("url", page_context.get("url") or "")
        ]

        aggregated_text = "\n".join([val for _, val in fields_to_check if val])
        if not aggregated_text.strip():
            return None

        violations = scan_text_for_uk_compliance(aggregated_text)
        if not violations:
            return None

        critical_count = sum(1 for v in violations if v["severity"] == "CRITICAL")
        chosen_severity = IssueSeverity.CRITICAL if critical_count > 0 else IssueSeverity.HIGH

        first_v = violations[0]
        violation_list_str = ", ".join([f"'{v['matched_term']}' ({v['title']})" for v in violations[:3]])

        return RuleCheckResult(
            passed=False,
            rule_id=self.rule_id,
            category=self.category,
            severity=chosen_severity,
            confidence=1.0,
            title=f"UK Regulatory Violation: {first_v['title']}",
            description=(
                f"Page content contains {len(violations)} prohibited claim(s) under UK statutory codes: "
                f"{violation_list_str}. Legal Basis: {first_v['legal_basis']}"
            ),
            evidence={
                "url": page_context.get("url"),
                "total_violations": len(violations),
                "violations": violations,
                "penalty_risk": first_v["penalty_risk"],
            },
            recommendation_template=(
                f"Remove the non-compliant phrase '{first_v['matched_term']}' immediately. "
                f"Compliant UK Alternative: {first_v['suggested_fix']}"
            ),
            documentation_url=self.documentation_url
        )
