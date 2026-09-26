import pytest
from services.seo_engine.rules.turkish_compliance import (
    TurkishRegulatoryComplianceRule,
    scan_text_for_turkish_compliance,
    TurkishComplianceSector
)
from services.seo_engine.base import IssueSeverity, RuleCategory

def test_health_treatment_claims_detected():
    text = "Bu krem sedef hastalığını tedavi eder ve kesin çözüm sağlar."
    violations = scan_text_for_turkish_compliance(text)
    assert len(violations) > 0
    assert any(v["rule_id"] == "TR_HEALTH_TREATMENT_CLAIM" for v in violations)
    assert violations[0]["sector"] == TurkishComplianceSector.HEALTH_MEDICAL.value
    assert violations[0]["severity"] == "CRITICAL"
    assert "1219 sayılı Tababet Kanunu" in violations[0]["legal_basis"]

def test_health_superlative_doctor_detected():
    text = "İstanbul'un en iyi cerrahı ve Türkiye'nin en iyi kliniği ile tanışın."
    violations = scan_text_for_turkish_compliance(text)
    assert any(v["rule_id"] == "TR_HEALTH_SUPERLATIVE_DOCTOR" for v in violations)
    assert any(v["sector"] == TurkishComplianceSector.HEALTH_MEDICAL.value for v in violations)

def test_before_after_claim_detected():
    text = "Burun estetiği öncesi sonrası fotoğrafları ve garantili sonuçlar burada."
    violations = scan_text_for_turkish_compliance(text)
    assert any(v["rule_id"] == "TR_HEALTH_BEFORE_AFTER" for v in violations)

def test_food_supplement_weight_loss_claim_detected():
    text = "Mucize çayımız 1 haftada 10 kilo verdirir ve kanseri önler."
    violations = scan_text_for_turkish_compliance(text)
    assert any(v["rule_id"] == "TR_FOOD_WEIGHT_LOSS_CLAIM" for v in violations)
    assert any(v["sector"] == TurkishComplianceSector.FOOD_SUPPLEMENT.value for v in violations)

def test_food_supplement_ministry_deception_detected():
    text = "Bu bitkisel kapsül Sağlık Bakanlığı onaylı takviye olarak satılmaktadır."
    violations = scan_text_for_turkish_compliance(text)
    assert any(v["rule_id"] == "TR_FOOD_MINISTRY_DECEPTION" for v in violations)

def test_attorney_superlative_advertising_detected():
    text = "Ankara'nın en iyi ceza avukatı ve 1 numaralı avukat bürosu."
    violations = scan_text_for_turkish_compliance(text)
    assert any(v["rule_id"] == "TR_LEGAL_SUPERLATIVE_LAWYER" for v in violations)
    assert any(v["sector"] == TurkishComplianceSector.LEGAL_SERVICES.value for v in violations)
    assert "1136 sayılı Avukatlık Kanunu" in violations[0]["legal_basis"]

def test_attorney_guarantee_and_free_services_detected():
    text = "Büromuzda dava kazanma garantisi ve ücretsiz danışmanlık verilmektedir."
    violations = scan_text_for_turkish_compliance(text)
    assert any(v["rule_id"] == "TR_LEGAL_GUARANTEE_FREE" for v in violations)

def test_finance_guaranteed_return_and_unlicensed_loans_detected():
    text = "Kripto botumuzla günlük %10 kar ve kesin kazanç vaat ediyoruz. Sicili bozuklara kredi."
    violations = scan_text_for_turkish_compliance(text)
    assert any(v["rule_id"] == "TR_FINANCE_GUARANTEED_RETURN" for v in violations)
    assert any(v["rule_id"] == "TR_FINANCE_ILLEGAL_LOAN" for v in violations)
    assert any(v["sector"] == TurkishComplianceSector.FINANCIAL_SERVICES.value for v in violations)

def test_commercial_unproven_superlative_detected():
    text = "Türkiye'nin en ucuzu biziz, rakipsiz fiyatlarla hemen sipariş verin."
    violations = scan_text_for_turkish_compliance(text)
    assert any(v["rule_id"] == "TR_COMMERCIAL_UNPROVEN_SUPERLATIVE" for v in violations)
    assert any(v["sector"] == TurkishComplianceSector.SUPERLATIVE_COMMERCIAL.value for v in violations)

def test_commercial_fake_scarcity_detected():
    # 1. "son 3 adet kaldı"
    text1 = "Acele edin, bu fiyata son 3 adet kaldı!"
    violations1 = scan_text_for_turkish_compliance(text1)
    assert any(v["rule_id"] == "TR_COMMERCIAL_FAKE_SCARCITY" for v in violations1)
    assert any(v["sector"] == TurkishComplianceSector.SUPERLATIVE_COMMERCIAL.value for v in violations1)

    # 2. "stokta son 1 ürün kaldı"
    text2 = "Stokta son 1 ürün kaldı hemen sipariş verin."
    violations2 = scan_text_for_turkish_compliance(text2)
    assert any(v["rule_id"] == "TR_COMMERCIAL_FAKE_SCARCITY" for v in violations2)

    # 3. "yalnızca son 5 adet kaldı"
    text3 = "Depomuzda yalnızca son 5 adet kaldı tükenmeden alın."
    violations3 = scan_text_for_turkish_compliance(text3)
    assert any(v["rule_id"] == "TR_COMMERCIAL_FAKE_SCARCITY" for v in violations3)

    # 4. "hemen almazsanız tükeniyor"
    text4 = "Kampanya süresi doluyor, hemen almazsanız tükeniyor!"
    violations4 = scan_text_for_turkish_compliance(text4)
    assert any(v["rule_id"] == "TR_COMMERCIAL_FAKE_SCARCITY" for v in violations4)

def test_illegal_betting_and_vape_detected():
    text = "Canlı bahis oyna ve elektronik sigara satın al."
    violations = scan_text_for_turkish_compliance(text)
    assert any(v["rule_id"] == "TR_ILLEGAL_BETTING" for v in violations)
    assert any(v["rule_id"] == "TR_TOBACCO_VAPE" for v in violations)

def test_seo_rule_engine_integration():
    rule = TurkishRegulatoryComplianceRule()
    page_context = {
        "url": "https://example-klinik.com.tr/tedaviler",
        "title": "En İyi Doktor ile Kesin Tedavi",
        "meta_description": "Kliniğimizde sedef hastalığını tedavi eder ve garantili sonuç sunarız.",
        "h1": "Türkiye'nin En İyi Kliniği",
        "body_text": "Öncesi sonrası görsellerimiz ile sıfır risk altında işlem yapın."
    }
    result = rule.check(page_context)
    assert result is not None
    assert result.passed is False
    assert result.category == RuleCategory.COMPLIANCE
    assert result.severity == IssueSeverity.CRITICAL
    assert "Türkiye Reklam Mevzuatı İhlali" in result.title
    assert "total_violations" in result.evidence
    assert result.evidence["total_violations"] >= 3

def test_clean_page_passes_compliance_rule():
    rule = TurkishRegulatoryComplianceRule()
    clean_page_context = {
        "url": "https://example.com/hizmetler",
        "title": "Kurumsal Yazılım ve Danışmanlık Hizmetleri",
        "meta_description": "İşletmeniz için modern bulut çözümleri ve teknik altyapı danışmanlığı.",
        "h1": "Bulut Bilişim Çözümleri",
        "body_text": "Yazılım mimarisi ve veri analitiği alanında profesyonel hizmet sunuyoruz."
    }
    result = rule.check(clean_page_context)
    assert result is None
