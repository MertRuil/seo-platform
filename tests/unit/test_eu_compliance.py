import pytest
from services.seo_engine.rules.eu_compliance import (
    EuRegulatoryComplianceRule,
    scan_text_for_eu_compliance,
    EuComplianceSector
)
from services.seo_engine.base import IssueSeverity, RuleCategory

def test_eu_health_cure_claims_detected():
    text = "Our clinic offers a guaranteed cure for chronic illnesses and miracle remedies."
    violations = scan_text_for_eu_compliance(text)
    assert len(violations) > 0
    assert any(v["rule_id"] == "EU_HEALTH_CURE_CLAIM" for v in violations)
    assert violations[0]["sector"] == EuComplianceSector.HEALTH_PHARMA.value
    assert violations[0]["severity"] == "CRITICAL"
    assert "Directive 2001/83/EC" in violations[0]["legal_basis"]

def test_eu_zero_risk_surgery_detected():
    text = "We provide zero risk surgery with no side effects and a 100% safe procedure."
    violations = scan_text_for_eu_compliance(text)
    assert any(v["rule_id"] == "EU_HEALTH_ZERO_RISK" for v in violations)
    assert any("MDR 2017/745" in v["legal_basis"] for v in violations)

def test_eu_pom_online_advertising_detected():
    text = "Order Ozempic without prescription online with fast shipping across Europe."
    violations = scan_text_for_eu_compliance(text)
    assert any(v["rule_id"] == "EU_HEALTH_POM_ONLINE" for v in violations)

def test_eu_weight_loss_rate_claims_detected():
    text = "Take this capsule and lose 10 kg in 2 weeks with our rapid fat burning formula."
    violations = scan_text_for_eu_compliance(text)
    assert any(v["rule_id"] == "EU_FOOD_WEIGHT_LOSS_RATE" for v in violations)
    assert any(v["sector"] == EuComplianceSector.FOOD_SUPPLEMENT.value for v in violations)
    assert any("Regulation (EC) No 1924/2006" in v["legal_basis"] for v in violations)

def test_eu_food_disease_prevention_detected():
    text = "Natural mushroom extract that cures cancer and prevents diabetes effectively."
    violations = scan_text_for_eu_compliance(text)
    assert any(v["rule_id"] == "EU_FOOD_DISEASE_PREVENTION" for v in violations)

def test_eu_greenwashing_offsetting_claims_detected():
    text = "Buy our carbon neutral product and enjoy 100% climate positive shopping."
    violations = scan_text_for_eu_compliance(text)
    assert any(v["rule_id"] == "EU_GREEN_OFFSETTING_CLAIMS" for v in violations)
    assert any("Directive (EU) 2024/825" in v["legal_basis"] for v in violations)

def test_eu_generic_green_claims_detected():
    text = "Our t-shirt is 100% eco-friendly and 100% sustainable."
    violations = scan_text_for_eu_compliance(text)
    assert any(v["rule_id"] == "EU_GREEN_GENERIC_ECO" for v in violations)

def test_eu_commercial_superlatives_detected():
    text = "We are the cheapest in Europe with an unbeatable price and best price guarantee."
    violations = scan_text_for_eu_compliance(text)
    assert any(v["rule_id"] == "EU_COMMERCIAL_SUPERLATIVE" for v in violations)
    assert any("Omnibus Directive" in v["legal_basis"] for v in violations)

def test_eu_financial_guaranteed_returns_detected():
    text = "Invest in our algorithm for guaranteed returns and risk-free investment with guaranteed crypto profit."
    violations = scan_text_for_eu_compliance(text)
    assert any(v["rule_id"] == "EU_FINANCE_GUARANTEED_RETURNS" for v in violations)
    assert any("MiCA" in v["legal_basis"] for v in violations)

def test_eu_predatory_loans_detected():
    text = "Get instant loans no credit check today. Bad credit loans guaranteed."
    violations = scan_text_for_eu_compliance(text)
    assert any(v["rule_id"] == "EU_FINANCE_PREDATORY_CREDIT" for v in violations)
    assert any("Consumer Credit Directive" in v["legal_basis"] for v in violations)

def test_eu_tobacco_vaping_detected():
    text = "Buy e-cigarettes online and cheap disposable vapes with fast EU delivery."
    violations = scan_text_for_eu_compliance(text)
    assert any(v["rule_id"] == "EU_TOBACCO_CROSSBORDER_VAPING" for v in violations)
    assert any("Tobacco Products Directive 2014/40/EU" in v["legal_basis"] for v in violations)

def test_eu_legal_judicial_guarantee_detected():
    text = "Top defense attorney offering a guaranteed court win and 100% success rate lawyer service."
    violations = scan_text_for_eu_compliance(text)
    assert any(v["rule_id"] == "EU_LEGAL_OUTCOME_GUARANTEE" for v in violations)
    assert any("CCBE" in v["legal_basis"] for v in violations)

def test_eu_multilingual_german_and_french():
    text_de = "Wir bieten eine risikofreie Operation und garantierte Heilung ohne Nebenwirkungen."
    violations_de = scan_text_for_eu_compliance(text_de)
    assert len(violations_de) > 0

    text_fr = "Commandez votre produit neutre en carbone et recevez un remède miracle avec guérison garantie."
    violations_fr = scan_text_for_eu_compliance(text_fr)
    assert len(violations_fr) > 0

def test_eu_clean_compliant_text():
    text = (
        "Our specialized medical team provides diagnostics and evidence-based treatments. "
        "Consult your physician for personalized medical advice. "
        "Our competitive pricing and standard 14-day statutory return rights apply. "
        "Investments involve market risk and past performance does not guarantee future results."
    )
    violations = scan_text_for_eu_compliance(text)
    assert len(violations) == 0

def test_eu_rule_integration_with_page_context():
    rule = EuRegulatoryComplianceRule()
    page_context = {
        "url": "https://example-eu.com/clinic",
        "title": "Zero Risk Surgery & Guaranteed Cure",
        "meta_description": "Get carbon neutral treatments with guaranteed returns.",
        "h1": "Best Hospital in Europe",
        "content": "Our clinic offers a guaranteed cure with no side effects."
    }
    result = rule.check(page_context)
    assert result is not None
    assert result.passed is False
    assert result.category == RuleCategory.COMPLIANCE
    assert result.severity == IssueSeverity.CRITICAL
    assert result.evidence["total_violations"] >= 3
