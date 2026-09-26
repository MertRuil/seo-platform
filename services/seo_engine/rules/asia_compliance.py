"""
Asia & Pacific (APAC) Regulatory Compliance Rules for SEO, Advertising & Content.
Covers Statutory Frameworks & Agency Guidelines across Key Asian Markets:
- Japan:
  * Pharmaceutical and Medical Devices Act (PMD Act / 薬機法, Yakki-ho Art. 66/68)
  * Act against Unjustifiable Premiums and Misleading Representations (景品表示法, Keihyo-ho)
  * JCAA Stealth Marketing Regulations (ステマ規制, Oct 2023)
  * Medical Care Act (医療法)
  * Financial Instruments and Exchange Act & Payment Services Act (FSA)
- China:
  * Advertising Law of the People's Republic of China (中华人民共和国广告法 Art. 9, 16-18)
  * Anti-Unfair Competition Law (反不正当竞争法 Art. 8 - Ban on fake orders/reviews 刷单/炒信)
  * E-Commerce Law of the PRC (电子商务法 Art. 17)
- Singapore:
  * Health Sciences Authority (HSA) - Health Products Act & Medicines Act
  * Monetary Authority of Singapore (MAS) - Guidelines on Digital Payment Token (DPT) Services
  * Competition and Consumer Commission of Singapore (CCCS) - Environmental Claims Guidelines
  * Tobacco (Control of Advertisements and Sale) Act & Gambling Control Act 2022
- South Korea:
  * Korea Fair Trade Commission (KFTC) - Act on Fair Labeling and Advertising (뒷광고 Backdoor Ads)
  * Ministry of Food and Drug Safety (MFDS) - Health Functional Food Act & Pharmaceutical Affairs Act
"""

import re
from enum import Enum
from typing import Dict, List, Optional, Any
from services.seo_engine.base import SeoRule, RuleCategory, IssueSeverity, RuleCheckResult


class AsiaComplianceSector(str, Enum):
    COSMETICS_HEALTH_PMDA = "COSMETICS_HEALTH_PMDA"
    STEALTH_MARKETING_JCAA_KFTC = "STEALTH_MARKETING_JCAA_KFTC"
    ABSOLUTE_SUPERLATIVES_SAMR = "ABSOLUTE_SUPERLATIVES_SAMR"
    DIETARY_SUPPLEMENTS_WEIGHTLOSS = "DIETARY_SUPPLEMENTS_WEIGHTLOSS"
    FINANCIAL_CRYPTO_MAS = "FINANCIAL_CRYPTO_MAS"
    GREEN_CLAIMS_APAC = "GREEN_CLAIMS_APAC"
    VAPING_GAMBLING_BAN_APAC = "VAPING_GAMBLING_BAN_APAC"


ASIA_REGULATORY_RULES: List[Dict[str, Any]] = [
    # 1. Cosmetics, Health, and Prescription Drugs (Japan Yakki-ho / Singapore HSA / China)
    {
        "rule_id": "ASIA_PMDA_UNAPPROVED_MEDICAL",
        "sector": AsiaComplianceSector.COSMETICS_HEALTH_PMDA,
        "title": "Unapproved Medical or Therapeutic Claims on Cosmetics and General Goods",
        "patterns": [
            r"\b(?:permanent(?:ly)?\s+removes?\s+wrinkles|reverses?\s+aging\s+completely)\b",
            r"\b(?:cures?\s+(?:cancer|diabetes|hypertension|alzheimer)|guaranteed\s+disease\s+cure)\b",
            r"\b(?:miracle\s+treatment\s+for\s+chronic\s+disease|eradicates?\s+all\s+tumors?)\b",
            r"(?:ガンが治る|糖尿病が完治|若返り効果100%|シミが完全に消える|病気が治る)",
            r"(?:包治百病|彻底根治糖尿病|抗癌神药|消灭肿瘤|彻底治愈高血压)",
            r"(?:암을\s*완치|당뇨병\s*치료|노화\s*완전\s*역전|기미\s*완전\s*제거)",
        ],
        "legal_basis": "Japan PMD Act (薬機法, Art. 66/68) & Singapore Health Products Act & China Drug Administration Law",
        "penalty_risk": "Up to 2 years imprisonment, administrative sales surcharges up to 4.5% of gross revenue, or corporate fines up to 300M JPY / 2M RMB.",
        "suggested_fix": "Limit claims to moisturizing and appearance support without asserting medical cure or structural body alteration.",
        "severity": "CRITICAL",
    },
    {
        "rule_id": "ASIA_PMDA_HSA_POM_ONLINE",
        "sector": AsiaComplianceSector.COSMETICS_HEALTH_PMDA,
        "title": "Online DTC Sales of Prescription-Only Medicines (POM)",
        "patterns": [
            r"\b(?:buy|order)\s+(?:ozempic|wegovy|saxenda|retin[\s-]a|viagra|antibiotics)\s+without\s+(?:prescription|doctor)\b",
            r"\bno\s+prescription\s+required\s+for\s+(?:ozempic|wegovy|saxenda)\b",
            r"(?:処方箋なしで買える|医師の診察不要でオゼンピック|処方薬個人輸入代行)",
            r"(?:无需处方购买|处方药包邮|代购处方药|免处方直邮)",
            r"(?:처방전\s*없이\s*구매|의사\s*처방\s*없이\s*오젬픽|전문의약품\s*해외직구)",
        ],
        "legal_basis": "Singapore Medicines Act & Japan Medical Care Act & South Korea Pharmaceutical Affairs Act",
        "penalty_risk": "Strict import ban, criminal detention, immediate domain blocking, and license revocation.",
        "suggested_fix": "Prescription medications can only be obtained through registered clinics upon physician consultation.",
        "severity": "CRITICAL",
    },

    # 2. Stealth Marketing & Fake Reviews (Japan JCAA / Korea KFTC / China SAMR)
    {
        "rule_id": "ASIA_STEALTH_MARKETING_DISCLOSURE",
        "sector": AsiaComplianceSector.STEALTH_MARKETING_JCAA_KFTC,
        "title": "Undisclosed Sponsored Content & Fake Review Acquisition",
        "patterns": [
            r"\b(?:buy\s+(?:google|naver|douyin|xiaohongshu)\s+reviews|purchase\s+fake\s+reviews)\b",
            r"\b(?:stealth\s+marketing\s+service|undisclosed\s+influencer\s+promotion)\b",
            r"(?:ステマ代行|やらせレビュー|サクラレビュー募集|ステルスマーケティング)",
            r"(?:刷单|炒信|买好评|刷好评|小红书假种草|购买虚假评价)",
            r"(?:뒷광고|댓글\s*알바|리뷰\s*조작|가짜\s*후기\s*구매|체험단\s*미표시)",
        ],
        "legal_basis": "Japan Premiums & Representations Act (ステマ規制, Oct 2023), South Korea Fair Labeling Act (뒷광고), China E-Commerce Law Art. 17",
        "penalty_risk": "Administrative surcharge of 3% of sales in Japan; fines up to 500 million KRW (or 2% of revenue) in Korea; up to 2 million RMB in China.",
        "suggested_fix": "Disclose all sponsored relationships prominently with '#PR', '広告', or '유료광고' at the beginning of the text.",
        "severity": "CRITICAL",
    },

    # 3. Absolute Superlatives & Unsubstantiated "No. 1" Claims (China SAMR / Japan JCAA)
    {
        "rule_id": "ASIA_SAMR_ABSOLUTE_SUPERLATIVES",
        "sector": AsiaComplianceSector.ABSOLUTE_SUPERLATIVES_SAMR,
        "title": "Illegal Absolute Superlatives & Unsubstantiated 'No. 1' Claims",
        "patterns": [
            r"\b(?:national\s+level\s+best|absolute\s+best\s+in\s+china|highest\s+level\s+quality)\b",
            r"\b(?:japan'?s?\s+number\s+(?:one|1)|asia'?s?\s+(?:best|number\s+(?:one|1)))\b",
            r"\b(?:korea'?s?\s+number\s+(?:one|1)|guaranteed\s+number\s+one\s+brand)\b",
            r"(?:国家级|最高级|最佳|第一品牌|顶级品质|绝无仅有)",
            r"(?:日本一|業界No\.?1|必ず痩せる|効果100%|完璧な効果)",
            r"(?:대한민국\s*최고|국내\s*1위|완벽한\s*효과\s*보장)",
        ],
        "legal_basis": "Advertising Law of the PRC (Article 9, Item 3) & Japan Premiums & Representations Act (優良誤認 - Superior Misrepresentation)",
        "penalty_risk": "Fines between 100,000 and 1,000,000 RMB by SAMR; 3% sales surcharge by Japan Consumer Affairs Agency (CAA).",
        "suggested_fix": "Replace absolute superlatives with verifiable facts or specific, time-limited third-party survey metrics.",
        "severity": "HIGH",
    },

    # 4. Dietary Supplements & Aggressive Weight Loss (Japan MHLW / Korea MFDS)
    {
        "rule_id": "ASIA_SUPPLEMENT_WEIGHTLOSS_UNREALISTIC",
        "sector": AsiaComplianceSector.DIETARY_SUPPLEMENTS_WEIGHTLOSS,
        "title": "Unrealistic Weight Loss & Food As Drug Misrepresentation",
        "patterns": [
            r"\blose\s+\d+\s*kg\s+in\s+\d+\s*(?:days?|weeks?)\s+without\s+(?:diet|exercise)\b",
            r"\b(?:effortless\s+fat\s+burning\s+supplement|miracle\s+slimming\s+tea)\b",
            r"\b(?:burn\s+belly\s+fat\s+while\s+sleeping|permanent\s+weight\s+loss\s+guaranteed)\b",
            r"(?:飲むだけで激痩せ|運動なしで10kg減量|食事制限なしで脂肪燃焼)",
            r"(?:无需节食月瘦\d+斤|躺着减肥|无副作用强效燃脂|神效瘦身茶)",
            r"(?:운동\s*없이\s*\d+kg\s*감량|먹기만\s*해도\s*살빠지는|다이어트\s*보장)",
        ],
        "legal_basis": "Japan Yakki-ho & South Korea Health Functional Food Act & Singapore HSA Guidelines",
        "penalty_risk": "Immediate product recall, ban from Japanese/Korean e-commerce platforms (Rakuten, Coupang), and administrative surcharges.",
        "suggested_fix": "State that product supports healthy weight management when combined with a calorie-controlled diet and exercise.",
        "severity": "HIGH",
    },

    # 5. Financial Services, Crypto & Predatory Lending (Singapore MAS / Japan FSA)
    {
        "rule_id": "ASIA_MAS_CRYPTO_FINANCIAL_PROMISE",
        "sector": AsiaComplianceSector.FINANCIAL_CRYPTO_MAS,
        "title": "Prohibited Public Crypto Marketing & Guaranteed Investment Yields",
        "patterns": [
            r"\bguaranteed\s+(?:crypto|bitcoin|forex)\s+(?:yield|return|profit)\b",
            r"\b100%\s+risk[\s-]free\s+(?:crypto\s+arbitrage|investment\s+algorithm)\b",
            r"\binstant\s+personal\s+loans?\s+no\s+credit\s+check\b",
            r"\bguaranteed\s+loan\s+approval\s+regardless\s+of\s+credit\b",
            r"(?:元本保証の仮想通貨|確実な暗号資産利回り|審査なし即日融資|誰でも必ず借りられる)",
            r"(?:稳赚不赔虚拟币|保证100%收益率|无征信即时放款|高回报无风险理财)",
            r"(?:원금\s*보장\s*코인\s*수익|100%\s*무위험\s*투자|신용\s*조회\s*없는\s*즉시대출)",
        ],
        "legal_basis": "Monetary Authority of Singapore (MAS DPT Guidelines 2022) & Japan Financial Services Agency (FSA / 資金決済法)",
        "penalty_risk": "Civil enforcement, criminal referral by MAS/FSA, permanent suspension of financial/digital token licenses.",
        "suggested_fix": "Disclose all capital risks: 'Digital asset trading carries high risk. Capital is at risk; past returns do not indicate future results.'",
        "severity": "CRITICAL",
    },

    # 6. Environmental & Green Claims (Singapore CCCS / Japan JCAA)
    {
        "rule_id": "ASIA_GREENWASHING_UNSUBSTANTIATED",
        "sector": AsiaComplianceSector.GREEN_CLAIMS_APAC,
        "title": "Unsubstantiated Carbon Neutral & Eco-Friendly Claims",
        "patterns": [
            r"\b(?:100%\s+eco[\s-]friendly|completely\s+green\s+product|certified\s+carbon\s+neutral\s+delivery)\b",
            r"\b(?:zero\s+carbon\s+guaranteed|100%\s+sustainable\s+lifecycle)\b",
            r"(?:環境負荷ゼロ|100%エコ|カーボンニュートラル保証|完全無公害)",
            r"(?:零碳环保|100%纯天然无害|绝对零污染|完全绿色产品)",
            r"(?:100%\s*친환경|탄소중립\s*완벽\s*보장|공해\s*전혀\s*없는)",
        ],
        "legal_basis": "CCCS Singapore Guidelines on Environmental Claims & Japan Consumer Affairs Agency Environmental Advertising Guidelines",
        "penalty_risk": "Consumer protection enforcement for unfair deceptive trade practices (CPFTA) and corrective orders.",
        "suggested_fix": "Provide specific, verifiable packaging or manufacturing data (e.g., 'Container made of 60% post-consumer recycled materials').",
        "severity": "HIGH",
    },

    # 7. Vaping & Unauthorized Online Gambling Ban (Singapore / East Asia)
    {
        "rule_id": "ASIA_TOBACCO_VAPE_GAMBLING_BAN",
        "sector": AsiaComplianceSector.VAPING_GAMBLING_BAN_APAC,
        "title": "Total Prohibition on E-Cigarettes/Vapes & Unauthorized Online Gambling",
        "patterns": [
            r"\b(?:buy|order)\s+(?:vapes?|e[\s-]cigarettes?|puff\s+bars?|relx\s+pods?)\s+online\b",
            r"\b(?:trusted\s+online\s+casino\s+singapore|best\s+online\s+betting\s+malaysia)\b",
            r"\b(?:online\s+baccarat\s+singapore|online\s+slot\s+game\s+malaysia)\b",
            r"(?:電子タバコ通販|ニコチンリキッド販売|オンラインカジノおすすめ|ネットカジノ勝てる)",
            r"(?:电子烟线上购买|网上赌博直营|真人视讯百家乐|网络彩票稳赢)",
            r"(?:전자담배\s*온라인\s*구매|사설\s*토토\s*사이트|온라인\s*카지노\s*추천|바카라\s*필승법)",
        ],
        "legal_basis": "Singapore Tobacco (Control of Advertisements and Sale) Act & Singapore Gambling Control Act 2022 & China E-Cigarette Online Ban",
        "penalty_risk": "Severe criminal penalties: up to SGD 10,000 fine and 6 months imprisonment for vape possession/purchase in Singapore; domain blocking.",
        "suggested_fix": "Remove all references to electronic vaporizers, nicotine delivery systems, and unauthorized gambling services.",
        "severity": "CRITICAL",
    },
]


def scan_text_for_asia_compliance(text: str, sector: Optional[AsiaComplianceSector] = None) -> List[Dict[str, Any]]:
    """
    Scans a given text or content body against Asian & Pacific (APAC) regulatory rules.
    Returns matched violations with statutory basis and proposed remedies.
    """
    if not text:
        return []

    normalized_text = text.lower()
    violations: List[Dict[str, Any]] = []

    for rule in ASIA_REGULATORY_RULES:
        if sector and rule["sector"] != sector:
            continue

        for pattern in rule["patterns"]:
            # Check pattern against both normalized text and raw text (for unicode Japanese/Chinese/Korean)
            flags = re.IGNORECASE
            match = re.search(pattern, normalized_text, flags) or re.search(pattern, text, flags)
            if match:
                start = match.start()
                end = match.end()
                snippet = text[max(0, start - 25):min(len(text), end + 25)]

                violations.append({
                    "rule_id": rule["rule_id"],
                    "sector": rule["sector"].value,
                    "title": rule["title"],
                    "matched_pattern": match.group(0),
                    "context_snippet": snippet.strip(),
                    "legal_basis": rule["legal_basis"],
                    "penalty_risk": rule["penalty_risk"],
                    "suggested_fix": rule["suggested_fix"],
                    "severity": rule["severity"],
                })
                break  # Record one violation per rule to prevent duplicate triggers

    return violations


class AsiaRegulatoryComplianceRule(SeoRule):
    """
    Evaluates page content against Asian & Pacific (APAC) Regulatory Standards
    (Japan PMD Act / Yakki-ho & Keihyo-ho, China SAMR Advertising Law,
    Singapore MAS DPT / HSA Guidelines, South Korea KFTC Fair Labeling).
    """

    rule_id = "RULE_ASIA_REGULATORY_COMPLIANCE"
    name = "Asia & Pacific (APAC) Regulatory & Truth in Advertising Compliance Shield"
    category = RuleCategory.COMPLIANCE
    default_severity = IssueSeverity.CRITICAL
    documentation_url = "https://www.caa.go.jp/policies/policy/representation/fair_labeling/"

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

        violations = scan_text_for_asia_compliance(aggregated_text)
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
            title=f"Asia/APAC Regulatory Violation: {first_v['title']}",
            description=(
                f"Page content contains {len(violations)} prohibited claim(s) under Asian Regulatory Standards "
                f"(Japan PMD/JCAA, China SAMR, Singapore MAS/HSA, South Korea KFTC): "
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
                f"Compliant Asian/APAC Alternative: {first_v['suggested_fix']}"
            ),
            documentation_url=self.documentation_url
        )

