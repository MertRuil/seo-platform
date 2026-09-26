import pytest
from services.seo_engine.rules.us_compliance import (
    UsComplianceSector,
    UsRegulatoryComplianceRule,
    scan_text_for_us_compliance,
)
from services.seo_engine.base import IssueSeverity, RuleCategory


def test_us_fda_disease_cure():
    text = "Our revolutionary clinical formula cures cancer and guarantees complete disease eradication."
    violations = scan_text_for_us_compliance(text)
    assert len(violations) >= 1
    assert any(v["sector"] == UsComplianceSector.HEALTH_FDA.value for v in violations)
    assert any("FD&C Act" in v["legal_basis"] for v in violations)


def test_us_fda_zero_risk_surgery():
    text = "Experience our zero risk surgery with 100% safe procedure guarantee and no possible side effects."
    violations = scan_text_for_us_compliance(text)
    assert len(violations) >= 1
    assert any("US_FDA_ZERO_RISK" == v["rule_id"] for v in violations)


def test_us_fda_prescription_drug_no_rx():
    text = "Buy Ozempic without prescription online today with express discreet shipping!"
    violations = scan_text_for_us_compliance(text)
    assert len(violations) >= 1
    assert any("US_FDA_POM_NO_PRESCRIPTION" == v["rule_id"] for v in violations)
    assert any("Ryan Haight" in v["legal_basis"] for v in violations)


def test_us_supplement_rapid_weightloss():
    text = "Lose 30 lbs in 2 weeks with our rapid fat melting guarantee and lose weight without diet or exercise!"
    violations = scan_text_for_us_compliance(text)
    assert len(violations) >= 1
    assert any(v["sector"] == UsComplianceSector.SUPPLEMENTS_WEIGHTLOSS.value for v in violations)
    assert any("FTC Act Section 5" in v["legal_basis"] for v in violations)


def test_us_supplement_disease_prevention_claim():
    text = "Our botanical drops prevent diabetes and heart disease, acting as a natural alternative to insulin."
    violations = scan_text_for_us_compliance(text)
    assert len(violations) >= 1
    assert any("US_SUPPLEMENT_UNAPPROVED_STRUCTURE" == v["rule_id"] for v in violations)
    assert any("DSHEA" in v["legal_basis"] for v in violations)


def test_us_ftc_fake_reviews():
    text = "Boost your local profile: pay for 5-star reviews on Google and Yelp with guaranteed ratings!"
    violations = scan_text_for_us_compliance(text)
    assert len(violations) >= 1
    assert any("US_FTC_FAKE_REVIEWS" == v["rule_id"] for v in violations)
    assert any("16 CFR Part 464" in v["legal_basis"] for v in violations)


def test_us_ftc_made_in_usa_unqualified():
    text = "Engineered globally and 100% made in the USA with 100% American made quality!"
    violations = scan_text_for_us_compliance(text)
    assert len(violations) >= 1
    assert any("US_FTC_MADE_IN_USA" == v["rule_id"] for v in violations)
    assert any("16 CFR Part 323" in v["legal_basis"] for v in violations)


def test_us_ftc_deceptive_free_trial():
    text = "Claim your 100% free trial no risk today, completely free trial keep it forever!"
    violations = scan_text_for_us_compliance(text)
    assert len(violations) >= 1
    assert any("US_FTC_DECEPTIVE_FREE_TRIAL" == v["rule_id"] for v in violations)
    assert any("ROSCA" in v["legal_basis"] for v in violations)


def test_us_sec_guaranteed_investment_returns():
    text = "Our proprietary automated trading algorithm offers guaranteed returns and risk-free investing with guaranteed crypto yield."
    violations = scan_text_for_us_compliance(text)
    assert len(violations) >= 1
    assert any(v["sector"] == UsComplianceSector.FINANCIAL_SEC_CFPB.value for v in violations)
    assert any("Rule 10b-5" in v["legal_basis"] for v in violations)


def test_us_cfpb_predatory_loans():
    text = "Need emergency cash? Instant loans no credit check with bad credit loans guaranteed approval!"
    violations = scan_text_for_us_compliance(text)
    assert len(violations) >= 1
    assert any("US_FINANCE_PREDATORY_LOANS" == v["rule_id"] for v in violations)
    assert any("TILA" in v["legal_basis"] for v in violations)


def test_us_green_guides_carbon_neutral():
    text = "Shop our certified carbon neutral product with 100% eco-friendly and zero environmental impact design."
    violations = scan_text_for_us_compliance(text)
    assert len(violations) >= 1
    assert any(v["sector"] == UsComplianceSector.GREEN_GUIDES_FTC.value for v in violations)
    assert any("16 CFR Part 260" in v["legal_basis"] for v in violations)


def test_us_aba_legal_guarantee():
    text = "The best lawyer in New York with 100% success rate attorney and guaranteed court victory in commercial litigation."
    violations = scan_text_for_us_compliance(text)
    assert len(violations) >= 1
    assert any(v["sector"] == UsComplianceSector.LEGAL_ABA.value for v in violations)
    assert any("ABA Model Rules" in v["legal_basis"] for v in violations)


def test_us_tobacco_online_vaping():
    text = "Order vapes online cheap with disposable vapes free shipping straight to your mailbox."
    violations = scan_text_for_us_compliance(text)
    assert len(violations) >= 1
    assert any(v["sector"] == UsComplianceSector.TOBACCO_PACT.value for v in violations)
    assert any("PACT Act" in v["legal_basis"] for v in violations)


def test_us_clean_compliant_text():
    text = """
    Our certified clinical team provides diagnostic evaluations and physician consultations.
    Dietary supplement statements have not been evaluated by the Food and Drug Administration.
    This product is not intended to diagnose, treat, cure, or prevent any disease.
    Investments involve risk, including loss of principal. Prior results do not guarantee a similar outcome.
    """
    violations = scan_text_for_us_compliance(text)
    assert len(violations) == 0


def test_us_rule_integration_with_page_context():
    rule = UsRegulatoryComplianceRule()
    page_context = {
        "url": "https://example-us.com/store",
        "title": "Guaranteed Returns & Risk-Free Investing",
        "meta_description": "We guarantee 20% weekly ROI with 100% win rate trading bot.",
        "h1": "100% Made in the USA Products",
        "content": "Invest now and buy Ozempic without prescription online."
    }
    result = rule.check(page_context)
    assert result is not None
    assert result.passed is False
    assert result.category == RuleCategory.COMPLIANCE
    assert result.severity == IssueSeverity.CRITICAL
    assert result.evidence["total_violations"] >= 2
