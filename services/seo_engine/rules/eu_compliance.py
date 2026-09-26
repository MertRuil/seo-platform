import re
from typing import Any, Dict, Optional, List
from enum import Enum
from services.seo_engine.base import SeoRule, RuleCategory, IssueSeverity, RuleCheckResult

class EuComplianceSector(str, Enum):
    HEALTH_PHARMA = "HEALTH_PHARMA"
    FOOD_SUPPLEMENT = "FOOD_SUPPLEMENT"
    GREEN_CLAIMS = "GREEN_CLAIMS"
    CONSUMER_ECOMMERCE = "CONSUMER_ECOMMERCE"
    FINANCIAL_SERVICES = "FINANCIAL_SERVICES"
    LEGAL_SERVICES = "LEGAL_SERVICES"
    TOBACCO_NICOTINE = "TOBACCO_NICOTINE"

def normalize_eu_text(text: str) -> str:
    """Normalizes text for European multilingual matching (English, German, French, etc.)."""
    if not text:
        return ""
    # Lowercase and normalize common European accented characters for resilient regex
    s = text.lower()
    return s

EU_REGULATORY_RULES = [
    # -------------------------------------------------------------
    # 1. HEALTH, MEDICAL & PHARMACEUTICALS (DIRECTIVE 2001/83/EC & MDR 2017/745)
    # -------------------------------------------------------------
    {
        "id": "EU_HEALTH_CURE_CLAIM",
        "sector": EuComplianceSector.HEALTH_PHARMA,
        "title": "Prohibited Guaranteed Cure & Miracle Healing Claims",
        "patterns": [
            r"\bguaranteed\s+(?:cure|healing)\b",
            r"\b100%\s+(?:cure|guaranteed\s+recovery)\b",
            r"\bmiracle\s+(?:cure|treatment|remedy)\b",
            r"\beradicate\s+(?:disease|illness)\s+completely\b",
            r"\bheilungsversprechen\b",
            r"\bgarantierte\s+heilung\b",
            r"\bwundermittel\b",
            r"\bguérison\s+garantie\b",
            r"\bremède\s+miracle\b",
        ],
        "legal_basis": "Directive 2001/83/EC (Articles 86-90) & Medical Devices Regulation (EU) 2017/745 Article 7",
        "penalty_risk": "National health authority sanctions, injunctions and advertising bans across EU Member States.",
        "suggested_fix": "State 'supports recovery under medical supervision' instead of promising an absolute cure.",
        "severity": IssueSeverity.CRITICAL,
    },
    {
        "id": "EU_HEALTH_ZERO_RISK",
        "sector": EuComplianceSector.HEALTH_PHARMA,
        "title": "Prohibited Zero-Risk & No Side Effects Claims",
        "patterns": [
            r"\bzero\s+risk\s+(?:surgery|operation|procedure)\b",
            r"\brisk[\s-]free\s+(?:surgery|treatment|procedure)\b",
            r"\bno\s+side\s+effects?\b",
            r"\b100%\s+safe\s+procedure\b",
            r"\brisikofreie\s+operation\b",
            r"\bohne\s+nebenwirkungen\b",
            r"\bsans\s+aucun\s+effet\s+secondaire\b",
            r"\bopération\s+sans\s+risque\b",
        ],
        "legal_basis": "EU MDR 2017/745 Article 7(d) & Directive 2005/29/EC (Misleading Safety Claims)",
        "penalty_risk": "Fines from national competent authorities (e.g. BfArM, ANSM) and civil liability.",
        "suggested_fix": "Disclose that all medical procedures carry inherent risks and consult a qualified physician.",
        "severity": IssueSeverity.CRITICAL,
    },
    {
        "id": "EU_HEALTH_POM_ONLINE",
        "sector": EuComplianceSector.HEALTH_PHARMA,
        "title": "Prohibited Public Advertising of Prescription-Only Medicines (POM)",
        "patterns": [
            r"\b(?:buy|order)\s+(?:ozempic|wegovy|mounjaro|antibiotics|xanax|valium)\s+without\s+prescription\b",
            r"\bprescription[\s-]free\s+(?:antibiotics|sedatives|weight\s+loss\s+injections?)\b",
            r"\brezeptfrei\s+(?:ozempic|wegovy|antibiotika)\b",
            r"\bsans\s+ordonnance\s+(?:ozempic|antibiotiques)\b",
        ],
        "legal_basis": "Directive 2001/83/EC Article 88 (Ban on direct-to-consumer advertising of POM)",
        "penalty_risk": "Criminal prosecution for illicit pharmaceutical distribution and immediate domain seizure.",
        "suggested_fix": "Prescription medications cannot be advertised directly to the public online.",
        "severity": IssueSeverity.CRITICAL,
    },

    # -------------------------------------------------------------
    # 2. FOOD SUPPLEMENTS & WEIGHT LOSS (EFSA REGULATION (EC) NO 1924/2006)
    # -------------------------------------------------------------
    {
        "id": "EU_FOOD_WEIGHT_LOSS_RATE",
        "sector": EuComplianceSector.FOOD_SUPPLEMENT,
        "title": "Prohibited Rate or Amount of Weight Loss Claims",
        "patterns": [
            r"\blose\s+\d+\s*(?:kg|kilos|lbs|pounds)\s+in\s+\d+\s*(?:days?|weeks?)\b",
            r"\b(?:rapid|guaranteed)\s+fat\s+burn(?:ing)?\b",
            r"\bslimming\s+guarantee\b",
            r"\bburns?\s+belly\s+fat\s+in\s+\d+\s+days?\b",
            r"\b\d+\s*kg\s+in\s+\d+\s*(?:woche|tagen?)\s+abnehmen\b",
            r"\bfettverbrennung\s+garantiert\b",
            r"\bperdre\s+\d+\s*kg\s+en\s+\d+\s*(?:jours?|semaines?)\b",
            r"\bbrûle[\s-]graisse\s+garanti\b",
        ],
        "legal_basis": "Regulation (EC) No 1924/2006 Article 12(b) (Prohibition of claims referring to rate/amount of weight loss)",
        "penalty_risk": "Product recalls and administrative fines by national food safety authorities (BVL, DGCCRF, NVWA).",
        "suggested_fix": "Use authorized EFSA claim: 'Supports weight management as part of an energy-restricted diet.'",
        "severity": IssueSeverity.CRITICAL,
    },
    {
        "id": "EU_FOOD_DISEASE_PREVENTION",
        "sector": EuComplianceSector.FOOD_SUPPLEMENT,
        "title": "Prohibited Disease Prevention or Cure Claims on Food/Supplements",
        "patterns": [
            r"\bcures?\s+(?:cancer|diabetes|arthritis|alzheimer'?s)\b",
            r"\bprevents?\s+(?:cancer|diabetes|heart\s+attacks?)\b",
            r"\bheals?\s+chronic\s+diseases?\b",
            r"\bschützt\s+vor\s+(?:krebs|diabetes)\b",
            r"\bheilt\s+arthrose\b",
            r"\bguérit\s+le\s+diabète\b",
            r"\bprévient\s+le\s+cancer\b",
        ],
        "legal_basis": "Regulation (EU) No 1169/2011 (FIC) Article 7(3) & Regulation (EC) No 1924/2006 Article 14",
        "penalty_risk": "Heavy food safety fines and mandatory market withdrawal for attributing medicinal properties to food.",
        "suggested_fix": "Only use European Commission authorized general health function claims from the EU Register.",
        "severity": IssueSeverity.CRITICAL,
    },

    # -------------------------------------------------------------
    # 3. GREENWASHING & ENVIRONMENTAL CLAIMS (DIRECTIVE (EU) 2024/825 EMPCO)
    # -------------------------------------------------------------
    {
        "id": "EU_GREEN_OFFSETTING_CLAIMS",
        "sector": EuComplianceSector.GREEN_CLAIMS,
        "title": "Banned Climate Neutral Claims Based on Offsetting",
        "patterns": [
            r"\bcarbon\s+neutral\b",
            r"\bclimate\s+neutral\b",
            r"\bco2\s+neutral\b",
            r"\bclimate\s+positive\b",
            r"\bnet[\s-]zero\s+product\b",
            r"\bclimate\s+compensated\b",
            r"\bklimaneutral\b",
            r"\bco2[\s-]neutral\b",
            r"\bklimapositiv\b",
            r"\bneutre\s+en\s+carbone\b",
            r"\bzéro\s+émission\s+nette\b",
        ],
        "legal_basis": "Directive (EU) 2024/825 (Empowering Consumers for the Green Transition - EmpCo) Annex I, point 4a",
        "penalty_risk": "Fines up to 4% of annual turnover in Member States under Unfair Commercial Practices Directive.",
        "suggested_fix": "Report verified lifecycle emission reductions directly rather than claiming neutrality through offset credits.",
        "severity": IssueSeverity.HIGH,
    },
    {
        "id": "EU_GREEN_GENERIC_ECO",
        "sector": EuComplianceSector.GREEN_CLAIMS,
        "title": "Prohibited Generic Unsubstantiated Green Claims",
        "patterns": [
            r"\b100%\s+eco[\s-]friendly\b",
            r"\b100%\s+green\s+product\b",
            r"\b100%\s+sustainable\b",
            r"\bcompletely\s+environmentally\s+friendly\b",
            r"\b100%\s+umweltfreundlich\b",
            r"\bvöllig\s+ökologisch\b",
            r"\b100%\s+écologique\b",
        ],
        "legal_basis": "Directive (EU) 2024/825 (EmpCo Directive) & Green Claims Directive (Article 3)",
        "penalty_risk": "Injunctions and commercial practice penalties without third-party certified EU Ecolabel proof.",
        "suggested_fix": "Specify the precise environmental attribute (e.g. 'Packaging made from 80% recycled paper') with certification.",
        "severity": IssueSeverity.HIGH,
    },

    # -------------------------------------------------------------
    # 4. CONSUMER PROTECTION, PRICING & E-COMMERCE (OMNIBUS DIRECTIVE & UCPD & DSA)
    # -------------------------------------------------------------
    {
        "id": "EU_COMMERCIAL_SUPERLATIVE",
        "sector": EuComplianceSector.CONSUMER_ECOMMERCE,
        "title": "Unsubstantiated Market Superlatives ('Cheapest in Europe', 'Unbeatable')",
        "patterns": [
            r"\bcheapest\s+(?:in\s+europe|in\s+the\s+eu|in\s+the\s+world)\b",
            r"\bunbeatable\s+price\b",
            r"\bbest\s+price\s+guarantee\b",
            r"\blowest\s+price\s+guaranteed\b",
            r"\bgünstigster\s+in\s+europa\b",
            r"\btiefstpreisgarantie\b",
            r"\bunschlagbarer\s+preis\b",
            r"\ble\s+moins\s+cher\s+d'?europe\b",
            r"\bprix\s+imbattable\b",
        ],
        "legal_basis": "Unfair Commercial Practices Directive (2005/29/EC) & Omnibus Directive (EU) 2019/2161",
        "penalty_risk": "National competition authorities issue fines up to 4% of annual turnover or at least €2,000,000.",
        "suggested_fix": "Use verifiable factual statements like 'Competitive pricing' unless backed by independent market audits.",
        "severity": IssueSeverity.HIGH,
    },
    {
        "id": "EU_COMMERCIAL_FALSE_REFUND",
        "sector": EuComplianceSector.CONSUMER_ECOMMERCE,
        "title": "Misleading Unconditional Refund Guarantee",
        "patterns": [
            r"\bunconditional\s+(?:money[\s-]back\s+guarantee|refund)\b",
            r"\bno\s+questions?\s+asked\s+refund\b",
            r"\bbedingungslose\s+geld[\s-]zurück[\s-]garantie\b",
            r"\bremboursement\s+inconditionnel\b",
        ],
        "legal_basis": "Consumer Rights Directive (2011/83/EU) Article 16 (Statutory exceptions to right of withdrawal)",
        "penalty_risk": "Enforcement actions for deceptive trade practices regarding mandatory consumer withdrawal rights.",
        "suggested_fix": "State: '14-day statutory right of withdrawal in accordance with EU consumer protection law.'",
        "severity": IssueSeverity.MEDIUM,
    },

    # -------------------------------------------------------------
    # 5. FINANCIAL SERVICES, CRYPTO & CONSUMER CREDIT (MICA & MIFID II & CCD)
    # -------------------------------------------------------------
    {
        "id": "EU_FINANCE_GUARANTEED_RETURNS",
        "sector": EuComplianceSector.FINANCIAL_SERVICES,
        "title": "Prohibited Guaranteed Returns & Risk-Free Investment Claims",
        "patterns": [
            r"\bguaranteed\s+(?:returns?|profits?|yield)\b",
            r"\brisk[\s-]free\s+(?:investment|trading)\b",
            r"\b100%\s+(?:safe\s+investment|guaranteed\s+profit)\b",
            r"\bguaranteed\s+crypto\s+(?:profit|yield|returns?)\b",
            r"\b100%\s+winning\s+(?:trading\s+bot|signals?)\b",
            r"\bgarantierte\s+rendite\b",
            r"\brisikofreie\s+geldanlage\b",
            r"\bgarantierter\s+krypto[\s-]gewinn\b",
            r"\brendement\s+garanti\b",
            r"\binvestissement\s+sans\s+risque\b",
        ],
        "legal_basis": "Markets in Crypto-Assets Regulation (EU) 2023/1114 (MiCA) & MiFID II (Directive 2014/65/EU)",
        "penalty_risk": "ESMA and national financial regulators (BaFin, AMF, CNMV) fines up to €5,000,000 or 10% of annual turnover.",
        "suggested_fix": "Must include mandatory EU risk warning: 'Capital at risk. Past performance does not guarantee future results.'",
        "severity": IssueSeverity.CRITICAL,
    },
    {
        "id": "EU_FINANCE_PREDATORY_CREDIT",
        "sector": EuComplianceSector.FINANCIAL_SERVICES,
        "title": "Prohibited Predatory No-Credit-Check Loan Promotions",
        "patterns": [
            r"\binstant\s+loans?\s+no\s+credit\s+check\b",
            r"\bbad\s+credit\s+loans?\s+guaranteed\b",
            r"\bcredit\s+score\s+does(?:n't|\s+not)\s+matter\b",
            r"\bkredit\s+ohne\s+schufa\s+sofort\b",
            r"\btrotz\s+schufa\s+garantiert\b",
            r"\bcrédit\s+sans\s+enquête\s+fiché\b",
        ],
        "legal_basis": "Consumer Credit Directive (EU) 2023/2225 (Obligation to assess creditworthiness & marketing restrictions)",
        "penalty_risk": "Regulatory sanctions by national financial supervision bodies and immediate promotion ban.",
        "suggested_fix": "Specify representative APR and state that credit approval is subject to mandatory creditworthiness assessment.",
        "severity": IssueSeverity.CRITICAL,
    },

    # -------------------------------------------------------------
    # 6. TOBACCO & CROSS-BORDER VAPING (TOBACCO PRODUCTS DIRECTIVE 2014/40/EU)
    # -------------------------------------------------------------
    {
        "id": "EU_TOBACCO_CROSSBORDER_VAPING",
        "sector": EuComplianceSector.TOBACCO_NICOTINE,
        "title": "Prohibited Cross-Border Online Advertising of E-Cigarettes & Vapes",
        "patterns": [
            r"\bbuy\s+e[\s-]cigarettes?\s+online\b",
            r"\border\s+vapes?\s+online\s+cheap\b",
            r"\bcheap\s+disposable\s+vapes?\b",
            r"\bbuy\s+puff\s+bar\s+online\b",
            r"\border\s+iqos\s+(?:online|heatsticks?)\b",
            r"\be[\s-]zigaretten\s+online\s+bestellen\b",
            r"\bpuff\s+bar\s+kaufen\b",
            r"\bacheter\s+vape\s+en\s+ligne\b",
            r"\bcommander\s+cigarette\s+électronique\b",
        ],
        "legal_basis": "Tobacco Products Directive 2014/40/EU (Article 20 on cross-border advertising/sponsorship bans)",
        "penalty_risk": "Customs seizures, national public health fines, and digital service blocking.",
        "suggested_fix": "Cross-border online promotion and advertising of electronic cigarettes and refills is strictly prohibited in the EU.",
        "severity": IssueSeverity.CRITICAL,
    },

    # -------------------------------------------------------------
    # 7. LEGAL SERVICES (CCBE CODE OF CONDUCT)
    # -------------------------------------------------------------
    {
        "id": "EU_LEGAL_OUTCOME_GUARANTEE",
        "sector": EuComplianceSector.LEGAL_SERVICES,
        "title": "Prohibited Judicial Outcome Guarantees & Misleading Superlatives",
        "patterns": [
            r"\bguaranteed\s+(?:court\s+win|acquittal|case\s+victory)\b",
            r"\b100%\s+success\s+rate\s+(?:lawyer|attorney)\b",
            r"\bbest\s+lawyer\s+in\s+(?:europe|germany|france|spain|italy)\b",
            r"\berfolgsgarantie\s+vor\s+gericht\b",
            r"\b100%\s+freispruch\s+garantie\b",
            r"\bbester\s+anwalt\s+deutschlands\b",
            r"\bgagner\s+votre\s+procès\s+garanti\b",
        ],
        "legal_basis": "CCBE (Council of Bars and Law Societies of Europe) Code of Conduct & National Bar Regulations",
        "penalty_risk": "Disciplinary proceedings by National Bar Associations, temporary disbarment, and unfair competition damages.",
        "suggested_fix": "Accurately state areas of legal practice and qualifications without guaranteeing judicial outcomes.",
        "severity": IssueSeverity.CRITICAL,
    },
]

def scan_text_for_eu_compliance(text: str, sector: Optional[EuComplianceSector] = None) -> List[Dict[str, Any]]:
    """
    Scans a given text or URL content against the European Union regulatory rules.
    Returns a list of detected violations with matched pattern, context snippet,
    legal basis, and suggested compliant replacement.
    """
    if not text:
        return []

    normalized = normalize_eu_text(text)
    violations: List[Dict[str, Any]] = []

    for rule in EU_REGULATORY_RULES:
        if sector and rule["sector"] != sector:
            continue

        for pat in rule["patterns"]:
            match = re.search(pat, normalized)
            if match:
                start = match.start()
                end = match.end()
                snippet_start = max(0, start - 30)
                snippet_end = min(len(text), end + 30)
                matched_snippet = text[snippet_start:snippet_end]

                violations.append({
                    "rule_id": rule["id"],
                    "sector": rule["sector"].value,
                    "title": rule["title"],
                    "matched_pattern": match.group(0),
                    "context_snippet": matched_snippet.strip(),
                    "legal_basis": rule["legal_basis"],
                    "penalty_risk": rule["penalty_risk"],
                    "suggested_fix": rule["suggested_fix"],
                    "severity": rule["severity"].value,
                })
                break

    return violations

class EuRegulatoryComplianceRule(SeoRule):
    """
    Evaluates web page content and metadata against European Union directives and regulations
    (EFSA Health Claims, Green Claims / EmpCo Directive, MiCA, Omnibus, MDR, TPD).
    """
    rule_id = "RULE_EU_REGULATORY_COMPLIANCE"
    name = "European Union (EU) Regulatory & Advertising Compliance Shield"
    category = RuleCategory.COMPLIANCE
    default_severity = IssueSeverity.CRITICAL
    documentation_url = "https://commission.europa.eu/law/law-topic/consumer-protection-law_en"

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

        violations = scan_text_for_eu_compliance(aggregated_text)
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
            title=f"EU Regulatory Violation: {first_v['title']}",
            description=(
                f"Page content contains {len(violations)} prohibited claim(s) under European Union directives: "
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
                f"Compliant EU Alternative: {first_v['suggested_fix']}"
            ),
            documentation_url=self.documentation_url
        )
