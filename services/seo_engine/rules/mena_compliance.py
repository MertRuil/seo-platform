"""
Middle East & Gulf (MENA / GCC) Regulatory Compliance Rules for SEO, Advertising & Content.
Covers Statutory Frameworks & Agency Guidelines across Key Gulf / Middle Eastern Markets:
- United Arab Emirates (UAE):
  * UAE Media Council (Federal Decree-Law No. 55 of 2023 on Regulation of Media)
  * Telecommunications and Digital Government Regulatory Authority (TDRA - Internet Access Guidelines)
  * Ministry of Health and Prevention (MOHAP - Federal Law No. 4 of 1983 & Ministerial Decision 430/2007)
  * Dubai Virtual Assets Regulatory Authority (VARA - Marketing & Promotion Regulations 2023)
  * Dubai Land Department (RERA - Trakheesi Permit Requirements)
- Kingdom of Saudi Arabia (KSA):
  * General Authority of Media Regulation (GAMR / formerly GCAM - Mawthooq 'موثوق' License)
  * Saudi Food and Drug Authority (SFDA - Health & Food Products Advertising Regulations)
  * Ministry of Commerce (E-Commerce Law - Royal Decree M/126, 2019)
  * Saudi Central Bank (SAMA - Financial Promotions & Consumer Protection)
  * Real Estate General Authority (REGA - Fal License 'رخصة فال' Advertising Controls)
"""

import re
from enum import Enum
from typing import Dict, List, Optional, Any
from services.seo_engine.base import SeoRule, RuleCategory, IssueSeverity, RuleCheckResult


class MenaComplianceSector(str, Enum):
    ISLAMIC_VALUES_PUBLIC_MORALS = "ISLAMIC_VALUES_PUBLIC_MORALS"
    HEALTH_MEDICAL_MOHAP_SFDA = "HEALTH_MEDICAL_MOHAP_SFDA"
    INFLUENCER_MAWTHOOQ_NMC = "INFLUENCER_MAWTHOOQ_NMC"
    FINANCIAL_CRYPTO_VARA_SAMA = "FINANCIAL_CRYPTO_VARA_SAMA"
    ECOMMERCE_REAL_ESTATE_FAL = "ECOMMERCE_REAL_ESTATE_FAL"
    VAPING_TOBACCO_BAN_MENA = "VAPING_TOBACCO_BAN_MENA"


MENA_REGULATORY_RULES: List[Dict[str, Any]] = [
    # 1. Respect for Islamic Values, Public Morals, Gambling & Alcohol Ban
    {
        "rule_id": "MENA_ISLAMIC_MORALS_GAMBLING_ALCOHOL",
        "sector": MenaComplianceSector.ISLAMIC_VALUES_PUBLIC_MORALS,
        "title": "Strict Prohibition on Gambling, Betting, and Unlicensed Alcohol Promotion",
        "patterns": [
            r"\b(?:online\s+casino|sports\s+betting|play\s+poker\s+for\s+real\s+money|live\s+roulette\s+betting)\b",
            r"\b(?:best\s+gambling\s+sites\s+dubai|win\s+real\s+cash\s+gambling\s+saudi)\b",
            r"\b(?:buy\s+alcohol\s+online\s+riyadh|cheap\s+liquor\s+delivery\s+uae)\b",
            r"(?:كازينو\s+أونلاين|مراهنات\s+رياضية|ألعاب\s+قمار\s+بأموال\s+حقيقية|موقع\s+مراهنات)",
            r"(?:شراء\s+خمور\s+أونلاين|توصيل\s+مشروبات\s+كحولية|شراء\s+كحول\s+بدون\s+تصريح)",
            r"(?:قمار\s+عبر\s+الإنترنت|روليت\s+مباشر\s+بفلوس|لعب\s+بوكر\s+بأموال)",
        ],
        "legal_basis": "UAE Federal Decree-Law No. 55 of 2023 (Art. 16/17) & KSA Anti-Cyber Crime Law (Royal Decree M/17)",
        "penalty_risk": "Fines up to 1,000,000 AED / SAR, immediate TDRA/CITC domain blocking, and potential criminal deportation/prosecution.",
        "suggested_fix": "Strictly eliminate all references to gambling, unpermitted alcohol sales, and content violating Islamic ethics and public morals.",
        "severity": IssueSeverity.CRITICAL,
    },

    # 2. Health & Medical Advertising (MOHAP UAE / SFDA Saudi Arabia)
    {
        "rule_id": "MENA_MOHAP_SFDA_MIRACLE_CURES",
        "sector": MenaComplianceSector.HEALTH_MEDICAL_MOHAP_SFDA,
        "title": "Unapproved Health Claims, Miracle Cures and Deceptive Medical Promises",
        "patterns": [
            r"\b(?:guaranteed\s+cure\s+for\s+diabetes|100%\s+cancer\s+cure|permanent\s+treatment\s+for\s+hypertension)\b",
            r"\b(?:miracle\s+cure\s+for\s+chronic\s+illness|instant\s+slimming\s+guaranteed|lose\s+10kg\s+in\s+7\s+days)\b",
            r"(?:علاج\s+نهائي\s+للسكري|شفاء\s+تام\s+من\s+السرطان|خلطة\s+سحرية\s+لعلاج|علاج\s+فوري\s+للضغط)",
            r"(?:تخسيس\s+10\s+كيلو\s+في\s+أسبوع\s+مضمون|علاج\s+معجزة\s+للأمراض|يقضي\s+على\s+الورم\s+نهائياً)",
            r"(?:علاج\s+العقم\s+بشكل\s+مضمون|تخلص\s+من\s+الصلع\s+في\s+3\s+أيام)",
        ],
        "legal_basis": "UAE MOHAP Ministerial Decree 430/2007 & Saudi SFDA Health Product Advertising Executive Regulations",
        "penalty_risk": "Fines up to 500,000 AED/SAR, facility closure, revocation of commercial medical license, and criminal referral.",
        "suggested_fix": "Replace absolute cure assertions with evidence-based wellness terminology and cite explicit MOHAP/SFDA advertising approval numbers.",
        "severity": IssueSeverity.CRITICAL,
    },
    {
        "rule_id": "MENA_MOHAP_SFDA_PRESCRIPTION_DRUGS",
        "sector": MenaComplianceSector.HEALTH_MEDICAL_MOHAP_SFDA,
        "title": "Online Marketing of Prescription-Only Medicines (POM)",
        "patterns": [
            r"\b(?:buy\s+ozempic\s+without\s+prescription|order\s+xanax\s+online\s+dubai|botox\s+injections\s+for\s+sale)\b",
            r"\b(?:buy\s+antibiotics\s+online\s+saudi|prescription\s+medicines\s+home\s+delivery\s+no\s+rx)\b",
            r"(?:شراء\s+أوزمبيك\s+بدون\s+وصفة|حبوب\s+إجهاض\s+للبيع|شراء\s+ترامادول\s+أونلاين)",
            r"(?:شراء\s+مضادات\s+حيوية\s+بدون\s+روشتة|توصيل\s+أدوية\s+مقيدة\s+بدون\s+وصفة)",
        ],
        "legal_basis": "UAE Federal Law No. 4 of 1983 & Saudi Pharmacy and Medical Products Law (Royal Decree M/31)",
        "penalty_risk": "Imprisonment and fines up to 1,000,000 SAR / AED for illegal pharmaceutical distribution without pharmacist prescription verification.",
        "suggested_fix": "Prohibit online promotional sales of POM drugs; restrict to licensed tele-consultation booking without direct drug delivery promises.",
        "severity": IssueSeverity.CRITICAL,
    },

    # 3. Influencer & Advertiser Disclosures (UAE NMC / Saudi Mawthooq)
    {
        "rule_id": "MENA_INFLUENCER_MAWTHOOQ_NMC_DISCLOSURE",
        "sector": MenaComplianceSector.INFLUENCER_MAWTHOOQ_NMC,
        "title": "Undisclosed Commercial Sponsorship and Missing Mawthooq / NMC Permit",
        "patterns": [
            r"\b(?:unbiased\s+review\s+not\s+an\s+ad|honest\s+personal\s+opinion\s+zero\s+sponsorship)\b",
            r"(?:تجربة\s+شخصية\s+غير\s+مدفوعة|تقييم\s+صادق\s+ليس\s+إعلاناً|نصيحة\s+لوجه\s+الله\s+بدون\s+إعلان)",
            r"(?:إعلان\s+بدون\s+ترخيص\s+موثوق|تسويق\s+بدون\s+تصريح\s+إعلامي)",
        ],
        "legal_basis": "UAE Media Council Cabinet Resolution No. 23 of 2017 & KSA GAMR Mawthooq ('موثوق') Regulatory Guide",
        "penalty_risk": "Fines up to 500,000 SAR / AED and cancellation of commercial advertising permit or social media account suspension.",
        "suggested_fix": "Display explicit Arabic/English commercial indicators (#إعلان or #Ad / إعلان مدفوع) and verify active Mawthooq or UAE Media Council advertising permit.",
        "severity": IssueSeverity.HIGH,
    },

    # 4. Financial & Virtual Asset Promotions (UAE VARA / Saudi SAMA)
    {
        "rule_id": "MENA_VARA_SAMA_CRYPTO_UNAUTHORIZED_RETURNS",
        "sector": MenaComplianceSector.FINANCIAL_CRYPTO_VARA_SAMA,
        "title": "Unauthorized Crypto Promotions, Binary Options and Guaranteed Return Promises",
        "patterns": [
            r"\b(?:guaranteed\s+(?:weekly|monthly|annual)\s+returns?|zero\s+risk\s+investment\s+dubai)\b",
            r"\b(?:get\s+rich\s+quick\s+crypto\s+trading|double\s+your\s+money\s+in\s+24\s+hours)\b",
            r"(?:عائد\s+استثماري\s+مضمون|أرباح\s+يومية\s+مؤكدة|استثمار\s+بدون\s+أي\s+مخاطرة)",
            r"(?:ثراء\s+سريع\s+من\s+التداول|مضاعفة\s+رأس\s+المال\s+في\s+24\s+ساعة|تداول\s+خيارات\s+ثنائية\s+مضمونة)",
            r"(?:تداول\s+فوركس\s+غير\s+مرخص|استثمار\s+عملات\s+رقمية\s+بعائد\s+ثابت)",
        ],
        "legal_basis": "Dubai VARA Marketing & Promotion Regulations 2023 & SAMA (Saudi Central Bank) Consumer Protection Directives",
        "penalty_risk": "Fines up to 10,000,000 AED by VARA, asset freezing, and criminal fraud referral under SAMA and UAE Central Bank rules.",
        "suggested_fix": "Include mandatory statutory risk warning: 'Virtual asset investments involve high financial risk. Past performance does not guarantee future results' and display VARA/SAMA licensing.",
        "severity": IssueSeverity.CRITICAL,
    },

    # 5. E-Commerce & Real Estate Licensing (KSA Fal / Dubai RERA Trakheesi)
    {
        "rule_id": "MENA_REGA_FAL_RERA_UNLICENSED_REAL_ESTATE",
        "sector": MenaComplianceSector.ECOMMERCE_REAL_ESTATE_FAL,
        "title": "Unlicensed Real Estate Promotion without KSA Fal License or Dubai RERA Permit",
        "patterns": [
            r"\b(?:luxury\s+villa\s+for\s+sale\s+no\s+license\s+needed|direct\s+property\s+sale\s+without\s+rera)\b",
            r"(?:عقارات\s+للبيع\s+بدون\s+ترخيص\s+فال|فيلا\s+للبيع\s+بدون\s+تصريح\s+إعلاني)",
            r"(?:شقق\s+للبيع\s+بدون\s+رقم\s+ترخيص\s+تراخيص|تسويق\s+عقاري\s+بدون\s+رخصة\s+فال)",
        ],
        "legal_basis": "KSA Real Estate General Authority (REGA - Fal Law) & Dubai Land Department (RERA Trakheesi Permit)",
        "penalty_risk": "Fines up to 200,000 SAR / AED and immediate de-listing from search indexes and property portals.",
        "suggested_fix": "State mandatory regulatory license credentials: Saudi Fal License Number (رقم رخصة فال) or Dubai RERA Trakheesi Permit Number (رقم تصريح تراخيص).",
        "severity": IssueSeverity.HIGH,
    },

    # 6. Tobacco & Nicotine Vaping Promotion (ESMA UAE / SFDA KSA)
    {
        "rule_id": "MENA_TOBACCO_VAPING_PROMOTION",
        "sector": MenaComplianceSector.VAPING_TOBACCO_BAN_MENA,
        "title": "Unapproved Promotion and Sale of E-Cigarettes and Tobacco Products",
        "patterns": [
            r"\b(?:buy\s+disposable\s+vape\s+no\s+id\s+required|flavoured\s+nicotine\s+pods\s+home\s+delivery)\b",
            r"\b(?:cheap\s+e-cigarettes\s+express\s+delivery\s+riyadh|vape\s+delivery\s+dubai\s+cash\s+on\s+delivery)\b",
            r"(?:توصيل\s+فيب\s+بدون\s+تحقق\s+من\s+العمر|شراء\s+سحبة\s+سيجارة\s+أونلاين|نكهات\s+فيب\s+مع\s+توصيل\s+سريع)",
            r"(?:سجائر\s+إلكترونية\s+رخيصة\s+توصيل\s+فوري|شراء\s+شيشة\s+إلكترونية\s+أونلاين)",
        ],
        "legal_basis": "UAE ESMA Technical Regulations for Electronic Nicotine Products & Saudi SFDA Tobacco Control Regulations",
        "penalty_risk": "Fines up to 500,000 AED / SAR, customs confiscation of stock, and online store shutdown.",
        "suggested_fix": "Prohibit direct online consumer marketing of unlicensed tobacco and vaping products without age verification and ESMA/SFDA compliance marks.",
        "severity": IssueSeverity.CRITICAL,
    },
]


def normalize_mena_text(text: str) -> str:
    """Normalizes Arabic and English text for robust regulatory regex scanning."""
    if not text:
        return ""
    # Remove excessive diacritics / tashkeel from Arabic text
    text = re.sub(r"[\u064B-\u0652]", "", text)
    # Normalize Arabic alef variants
    text = re.sub(r"[إأآا]", "ا", text)
    # Normalize Arabic teh marbuta / heh
    text = re.sub(r"ة", "ه", text)
    # Normalize Arabic yeh / alef maksura
    text = re.sub(r"ى", "ي", text)
    return text


def scan_text_for_mena_compliance(text: str, sector_filter: Optional[MenaComplianceSector] = None) -> List[Dict[str, Any]]:
    """
    Scans a given text or metadata against Middle East & Gulf (MENA / GCC) statutory advertising rules.
    Returns detected violations with legal citations, penalty risks, and remediation advice.
    """
    if not text:
        return []

    norm_text = normalize_mena_text(text)
    violations = []

    for rule in MENA_REGULATORY_RULES:
        if sector_filter and rule["sector"] != sector_filter:
            continue

        matched = False
        for pat in rule["patterns"]:
            norm_pat = normalize_mena_text(pat)
            match = re.search(norm_pat, norm_text, re.IGNORECASE)
            if match:
                matched = True
                matched_str = match.group(0)
                start_idx = max(0, match.start() - 35)
                end_idx = min(len(norm_text), match.end() + 35)
                context_snippet = norm_text[start_idx:end_idx].strip()

                violations.append({
                    "rule_id": rule["rule_id"],
                    "sector": rule["sector"],
                    "title": rule["title"],
                    "matched_pattern": matched_str,
                    "snippet": f"...{context_snippet}...",
                    "legal_basis": rule["legal_basis"],
                    "penalty_risk": rule["penalty_risk"],
                    "suggested_fix": rule["suggested_fix"],
                    "severity": rule["severity"]
                })
                break

    return violations


class MenaRegulatoryComplianceRule(SeoRule):
    """
    SEO Compliance Rule: Detects violations of Middle East & Gulf (UAE Media Council,
    Saudi SFDA, GAMR Mawthooq, SAMA, VARA) advertising and e-commerce regulations in page content.
    """
    rule_id = "COMPLIANCE_MENA_STATUTORY"
    name = "Orta Doğu & Körfez (BAE Media Council / Suudi SFDA / Mawthooq / VARA) Mevzuat Kalkanı"
    category = RuleCategory.COMPLIANCE
    default_severity = IssueSeverity.CRITICAL
    documentation_url = "https://chd.mediacouncil.gov.ae/"

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

        violations = scan_text_for_mena_compliance(aggregated_text)
        if not violations:
            return None

        critical_count = sum(1 for v in violations if v["severity"] == IssueSeverity.CRITICAL or v["severity"] == "CRITICAL")
        chosen_severity = IssueSeverity.CRITICAL if critical_count > 0 else IssueSeverity.HIGH

        first_v = violations[0]
        violation_list_str = ", ".join([f"'{v['matched_pattern']}' ({v['title']})" for v in violations[:3]])

        return RuleCheckResult(
            passed=False,
            rule_id=self.rule_id,
            category=self.category,
            severity=chosen_severity,
            confidence=1.0,
            title=f"Orta Doğu / Körfez (MENA) Mevzuat İhlali: {first_v['title']}",
            description=(
                f"Sayfa içeriğinde Orta Doğu / Körfez (BAE & Suudi Arabistan) reklam mevzuatına aykırı "
                f"{len(violations)} ifade tespit edildi: {violation_list_str}. Yasal Dayanak: {first_v['legal_basis']}"
            ),
            evidence={
                "url": page_context.get("url"),
                "total_violations": len(violations),
                "violations": violations,
                "first_violation": first_v,
                "penalty_risk": first_v["penalty_risk"]
            },
            recommendation_template=(
                f"Yasaklı veya lisanssız ifadeyi ('{first_v['matched_pattern']}') derhal kaldırın. "
                f"Uyumlu Alternatif / Çözüm: {first_v['suggested_fix']}"
            ),
            documentation_url=self.documentation_url
        )

