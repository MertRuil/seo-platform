import pytest
from services.seo_engine.rules.mena_compliance import (
    MenaComplianceSector,
    scan_text_for_mena_compliance,
    MenaRegulatoryComplianceRule
)
from services.seo_engine.engine import SeoRuleEngine


def test_mena_gambling_and_alcohol_violation():
    # English test
    text_en = "Join the best online casino and win real cash gambling saudi with live roulette betting today."
    violations_en = scan_text_for_mena_compliance(text_en)
    assert len(violations_en) > 0
    assert any(v["sector"] == MenaComplianceSector.ISLAMIC_VALUES_PUBLIC_MORALS for v in violations_en)
    assert "Federal Decree-Law No. 55 of 2023" in violations_en[0]["legal_basis"]

    # Arabic test
    text_ar = "أفضل كازينو أونلاين في دبي للعب بوكر بأموال حقيقية وتوصيل مشروبات كحولية إلى باب منزلك."
    violations_ar = scan_text_for_mena_compliance(text_ar)
    assert len(violations_ar) > 0
    assert any(v["sector"] == MenaComplianceSector.ISLAMIC_VALUES_PUBLIC_MORALS for v in violations_ar)


def test_mena_mohap_sfda_miracle_cure_violation():
    # English miracle cure
    text_en = "Discover our guaranteed cure for diabetes and lose 10kg in 7 days with zero diet changes."
    violations_en = scan_text_for_mena_compliance(text_en)
    assert len(violations_en) > 0
    assert any(v["sector"] == MenaComplianceSector.HEALTH_MEDICAL_MOHAP_SFDA for v in violations_en)

    # Arabic miracle cure
    text_ar = "خلطة سحرية لعلاج السكري بشكل نهائي وشفا تام من السرطان بدون جراحة أو أدوية."
    violations_ar = scan_text_for_mena_compliance(text_ar)
    assert len(violations_ar) > 0
    assert any("MOHAP" in v["legal_basis"] or "SFDA" in v["legal_basis"] for v in violations_ar)


def test_mena_prescription_pom_advertising_violation():
    text = "Fast delivery: buy ozempic without prescription in dubai or order xanax online today."
    violations = scan_text_for_mena_compliance(text)
    assert len(violations) > 0
    assert any("buy ozempic without prescription" in v["matched_pattern"] for v in violations)
    assert any(v["sector"] == MenaComplianceSector.HEALTH_MEDICAL_MOHAP_SFDA for v in violations)


def test_mena_influencer_mawthooq_nmc_violation():
    text_ar = "هذه تجربة شخصية غير مدفوعة وأفضل منتج للشعر جربته في الرياض، رابط الشراء بالأسفل."
    violations = scan_text_for_mena_compliance(text_ar)
    assert len(violations) > 0
    assert any(v["sector"] == MenaComplianceSector.INFLUENCER_MAWTHOOQ_NMC for v in violations)
    assert any("Mawthooq" in v["legal_basis"] or "Media Council" in v["legal_basis"] for v in violations)


def test_mena_vara_sama_crypto_guaranteed_returns():
    text = "Invest in our fund for guaranteed monthly returns of 50% and zero risk investment dubai crypto trading."
    violations = scan_text_for_mena_compliance(text)
    assert len(violations) > 0
    assert any(v["sector"] == MenaComplianceSector.FINANCIAL_CRYPTO_VARA_SAMA for v in violations)
    assert any("VARA" in v["legal_basis"] or "SAMA" in v["legal_basis"] for v in violations)


def test_mena_real_estate_fal_rera_violation():
    text_ar = "عقارات للبيع بدون ترخيص فال وبدون وسيط، سارع بحجز شقتك في الرياض بأسعار خيالية."
    violations = scan_text_for_mena_compliance(text_ar)
    assert len(violations) > 0
    assert any(v["sector"] == MenaComplianceSector.ECOMMERCE_REAL_ESTATE_FAL for v in violations)


def test_mena_clean_compliant_text():
    text = (
        "Welcome to our premium boutique hotel in Dubai. "
        "Book your executive suite online with official tourism licensing number DTCM-12345. "
        "Enjoy our wellness spa and signature dining experience."
    )
    violations = scan_text_for_mena_compliance(text)
    assert len(violations) == 0


def test_mena_compliance_rule_in_engine():
    engine = SeoRuleEngine()
    
    # Page with violation
    bad_page = {
        "url": "https://example.ae/slimming",
        "title": "Guaranteed cure for diabetes and slimming",
        "h1": ["Instant slimming guaranteed in Dubai"],
        "content": "Buy our miracle cure for chronic illness today with free delivery."
    }
    issues = engine.evaluate_page(bad_page)
    mena_issues = [i for i in issues if i.rule_id == "COMPLIANCE_MENA_STATUTORY"]
    assert len(mena_issues) == 1
    assert mena_issues[0].severity == "CRITICAL"
    assert mena_issues[0].recommendation_template is not None

    # Clean page
    clean_page = {
        "url": "https://example.sa/furniture",
        "title": "Modern Office Furniture Riyadh",
        "h1": "Ergonomic Chairs and Desks",
        "content": "Browse our licensed commercial office furniture collection in Saudi Arabia with full VAT compliance."
    }
    clean_issues = engine.evaluate_page(clean_page)
    clean_mena = [i for i in clean_issues if i.rule_id == "COMPLIANCE_MENA_STATUTORY"]
    assert len(clean_mena) == 0
