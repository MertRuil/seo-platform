import pytest
from services.seo_engine.rules.uk_compliance import UkRegulatoryComplianceRule, UkComplianceSector
from services.seo_engine.base import IssueSeverity

def test_uk_compliance_clean_page():
    rule = UkRegulatoryComplianceRule()
    page_context = {
        "title": "Aesthetic Skin Consultations in London | Harley Street Clinic",
        "meta_description": "Book a professional consultation with GMC-registered doctors for facial rejuvenation.",
        "h1": ["Medical Facial Aesthetics & Consultations"],
        "content": "We provide thorough medical consultations to evaluate skin concerns. All procedures are carried out by qualified clinicians."
    }
    result = rule.check(page_context)
    assert result is None

def test_uk_compliance_botox_pom_prohibition():
    rule = UkRegulatoryComplianceRule()
    page_context = {
        "title": "Best Botox Injections in London | Special Offers",
        "meta_description": "Get cheap botox treatments this weekend only.",
        "h1": ["Botox Clinic London"],
        "content": "Our clinic offers discounted botox injections and botulinum toxin treatments."
    }
    result = rule.check(page_context)
    assert result is not None
    assert result.passed is False
    assert result.severity == IssueSeverity.CRITICAL
    violations = result.evidence["violations"]
    assert any(v["rule_id"] == "UK_ASA_POM_BOTOX" for v in violations)

def test_uk_compliance_cure_claim():
    rule = UkRegulatoryComplianceRule()
    page_context = {
        "title": "Miracle Cure Herbal Remedy",
        "meta_description": "Our organic tincture cures cancer and guarantees complete healing.",
        "content": "Experience 100% guaranteed cure for chronic illnesses without prescription drugs."
    }
    result = rule.check(page_context)
    assert result is not None
    assert result.passed is False
    assert result.severity == IssueSeverity.CRITICAL
    violations = result.evidence["violations"]
    assert any(v["rule_id"] == "UK_ASA_HEALTH_CURE_CLAIM" for v in violations)

def test_uk_compliance_fca_crypto_promotion():
    rule = UkRegulatoryComplianceRule()
    page_context = {
        "title": "Trade High Yield Crypto in UK",
        "content": "Earn guaranteed crypto returns with zero risk cryptocurrency investment. Free crypto on sign up!"
    }
    result = rule.check(page_context)
    assert result is not None
    assert result.passed is False
    assert result.severity == IssueSeverity.CRITICAL
    violations = result.evidence["violations"]
    assert any(v["rule_id"] == "UK_FCA_CRYPTO_PROMOTION" for v in violations)

def test_uk_compliance_cma_greenwashing():
    rule = UkRegulatoryComplianceRule()
    page_context = {
        "title": "Eco Friendly Fashion UK",
        "content": "Our jackets are 100% eco-friendly and represent a zero carbon product for conscious shoppers."
    }
    result = rule.check(page_context)
    assert result is not None
    assert result.passed is False
    violations = result.evidence["violations"]
    assert any(v["rule_id"] == "UK_CMA_GREENWASHING" for v in violations)

def test_uk_compliance_vaping_promotion():
    rule = UkRegulatoryComplianceRule()
    page_context = {
        "title": "Online Vape Superstore UK",
        "content": "Check out our cheap disposable vapes and elf bar sale today only."
    }
    result = rule.check(page_context)
    assert result is not None
    assert result.passed is False
    violations = result.evidence["violations"]
    assert any(v["rule_id"] == "UK_ASA_VAPING_PROMOTION" for v in violations)

def test_uk_compliance_dark_patterns_scarcity():
    rule = UkRegulatoryComplianceRule()
    page_context = {
        "title": "Exclusive Watch Deals UK",
        "content": "Hurry! Only 2 left in stock! Offer expires in 10 minutes, countdown timer hurry."
    }
    result = rule.check(page_context)
    assert result is not None
    assert result.passed is False
    violations = result.evidence["violations"]
    assert any(v["rule_id"] == "UK_CMA_DARK_PATTERNS" for v in violations)
    assert any(v["sector"] == UkComplianceSector.CONSUMER_CMA_ASA.value for v in violations)
