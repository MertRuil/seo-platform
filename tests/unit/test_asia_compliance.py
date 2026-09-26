import pytest
from services.seo_engine.rules.asia_compliance import (
    AsiaComplianceSector,
    AsiaRegulatoryComplianceRule,
    scan_text_for_asia_compliance,
)
from services.seo_engine.base import IssueSeverity, RuleCategory


def test_asia_pmda_unapproved_medical_en_and_jp():
    # English
    text_en = "Our facial cream permanently removes wrinkles and reverses aging completely."
    viol_en = scan_text_for_asia_compliance(text_en)
    assert len(viol_en) >= 1
    assert any(v["sector"] == AsiaComplianceSector.COSMETICS_HEALTH_PMDA.value for v in viol_en)
    assert any("PMD Act" in v["legal_basis"] for v in viol_en)

    # Japanese
    text_jp = "このサプリメントを毎日飲むだけでガンが治る奇跡の効果！若返り効果100%を実感。"
    viol_jp = scan_text_for_asia_compliance(text_jp)
    assert len(viol_jp) >= 1
    assert any("ASIA_PMDA_UNAPPROVED_MEDICAL" == v["rule_id"] for v in viol_jp)


def test_asia_pmda_pom_online_sales():
    text_en = "Buy Ozempic without prescription online with discreet express delivery to Tokyo and Singapore."
    viol = scan_text_for_asia_compliance(text_en)
    assert len(viol) >= 1
    assert any("ASIA_PMDA_HSA_POM_ONLINE" == v["rule_id"] for v in viol)
    assert any("Singapore Medicines Act" in v["legal_basis"] for v in viol)

    # Japanese
    text_jp = "医師の診察不要でオゼンピックを格安個人輸入！処方箋なしで買える公式窓口。"
    viol_jp = scan_text_for_asia_compliance(text_jp)
    assert any("ASIA_PMDA_HSA_POM_ONLINE" == v["rule_id"] for v in viol_jp)


def test_asia_stealth_marketing_jp_kr_cn():
    # Japan JCAA Stealth Marketing
    text_jp = "インフルエンサーを活用したステマ代行サービスで口コミ急増！"
    viol_jp = scan_text_for_asia_compliance(text_jp)
    assert len(viol_jp) >= 1
    assert any("ASIA_STEALTH_MARKETING_DISCLOSURE" == v["rule_id"] for v in viol_jp)
    assert any("ステマ規制" in v["legal_basis"] for v in viol_jp)

    # South Korea Backdoor Ads (뒷광고)
    text_kr = "인스타그램 협찬 표시 없이 진행하는 뒷광고 패키지 및 리뷰 조작."
    viol_kr = scan_text_for_asia_compliance(text_kr)
    assert any("ASIA_STEALTH_MARKETING_DISCLOSURE" == v["rule_id"] for v in viol_kr)

    # China Fake Orders (刷单)
    text_cn = "专业淘宝天猫刷单炒信，快速提升店铺销量和信誉等级。"
    viol_cn = scan_text_for_asia_compliance(text_cn)
    assert any("ASIA_STEALTH_MARKETING_DISCLOSURE" == v["rule_id"] for v in viol_cn)


def test_asia_samr_absolute_superlatives():
    # China SAMR Article 9
    text_cn = "本产品荣获国家级最佳品质，乃全国第一品牌最高级制造。"
    viol_cn = scan_text_for_asia_compliance(text_cn)
    assert len(viol_cn) >= 1
    assert any("ASIA_SAMR_ABSOLUTE_SUPERLATIVES" == v["rule_id"] for v in viol_cn)
    assert any("Advertising Law of the PRC" in v["legal_basis"] for v in viol_cn)

    # Japan No. 1 claim
    text_jp = "業界No.1の実績！日本一の満足度をお約束します。"
    viol_jp = scan_text_for_asia_compliance(text_jp)
    assert any("ASIA_SAMR_ABSOLUTE_SUPERLATIVES" == v["rule_id"] for v in viol_jp)


def test_asia_dietary_supplement_weightloss():
    text_en = "Lose 10 kg in 2 weeks without diet or exercise with our effortless fat burning supplement!"
    viol = scan_text_for_asia_compliance(text_en)
    assert len(viol) >= 1
    assert any(v["sector"] == AsiaComplianceSector.DIETARY_SUPPLEMENTS_WEIGHTLOSS.value for v in viol)

    # Japanese
    text_jp = "運動なしで10kg減量！飲むだけで激痩せする特許漢方ハーブ。"
    viol_jp = scan_text_for_asia_compliance(text_jp)
    assert any("ASIA_SUPPLEMENT_WEIGHTLOSS_UNREALISTIC" == v["rule_id"] for v in viol_jp)


def test_asia_mas_crypto_financial_promise():
    text_en = "Earn guaranteed crypto yield with our 100% risk-free investment algorithm bot in Singapore."
    viol = scan_text_for_asia_compliance(text_en)
    assert len(viol) >= 1
    assert any(v["sector"] == AsiaComplianceSector.FINANCIAL_CRYPTO_MAS.value for v in viol)
    assert any("MAS DPT Guidelines" in v["legal_basis"] for v in viol)

    # Japanese
    text_jp = "元本保証の仮想通貨アービトラージ！誰でも必ず借りられる審査なし即日融資。"
    viol_jp = scan_text_for_asia_compliance(text_jp)
    assert any("ASIA_MAS_CRYPTO_FINANCIAL_PROMISE" == v["rule_id"] for v in viol_jp)


def test_asia_greenwashing_unsubstantiated():
    text_en = "Our sneakers feature 100% eco-friendly materials and certified carbon neutral delivery across APAC."
    viol = scan_text_for_asia_compliance(text_en)
    assert len(viol) >= 1
    assert any(v["sector"] == AsiaComplianceSector.GREEN_CLAIMS_APAC.value for v in viol)
    assert any("CCCS Singapore" in v["legal_basis"] for v in viol)

    # Japanese
    text_jp = "当社製品は環境負荷ゼロ、100%エコな製造工程でカーボンニュートラル保証。"
    viol_jp = scan_text_for_asia_compliance(text_jp)
    assert any("ASIA_GREENWASHING_UNSUBSTANTIATED" == v["rule_id"] for v in viol_jp)


def test_asia_tobacco_vape_gambling_ban():
    text_en = "Buy vapes online in Singapore with fast shipping or play at the trusted online casino Singapore!"
    viol = scan_text_for_asia_compliance(text_en)
    assert len(viol) >= 1
    assert any(v["sector"] == AsiaComplianceSector.VAPING_GAMBLING_BAN_APAC.value for v in viol)
    assert any("Singapore Tobacco" in v["legal_basis"] for v in viol)

    # Japanese
    text_jp = "電子タバコ通販とニコチンリキッド販売、オンラインカジノおすすめランキング。"
    viol_jp = scan_text_for_asia_compliance(text_jp)
    assert any("ASIA_TOBACCO_VAPE_GAMBLING_BAN" == v["rule_id"] for v in viol_jp)


def test_asia_clean_compliant_text():
    text = (
        "Our skincare lotion helps maintain skin hydration and natural texture. "
        "Formulated with natural botanical extracts. Certified under local cosmetic standards. "
        "Consult your physician for personalized dermatological guidance."
    )
    viol = scan_text_for_asia_compliance(text)
    assert len(viol) == 0


def test_asia_sector_filtering():
    text = "Buy Ozempic without prescription online and enjoy guaranteed crypto yield in Tokyo!"
    # Scan with specific sector filter
    med_viol = scan_text_for_asia_compliance(text, sector=AsiaComplianceSector.COSMETICS_HEALTH_PMDA)
    assert all(v["sector"] == AsiaComplianceSector.COSMETICS_HEALTH_PMDA.value for v in med_viol)

    fin_viol = scan_text_for_asia_compliance(text, sector=AsiaComplianceSector.FINANCIAL_CRYPTO_MAS)
    assert all(v["sector"] == AsiaComplianceSector.FINANCIAL_CRYPTO_MAS.value for v in fin_viol)


def test_asia_engine_rule_integration_fail():
    rule = AsiaRegulatoryComplianceRule()
    context = {
        "url": "https://example-asia.com/shop",
        "title": "国家级最佳品质 - Buy vapes online in Singapore",
        "meta_description": "Gain guaranteed crypto yield and 100% risk-free returns.",
        "content": "Buy Ozempic without prescription, lose 10 kg in 2 weeks without diet.",
    }
    result = rule.check(context)
    assert result is not None
    assert result.passed is False
    assert result.category == RuleCategory.COMPLIANCE
    assert result.severity == IssueSeverity.CRITICAL
    assert result.evidence["total_violations"] >= 3


def test_asia_engine_rule_integration_pass():
    rule = AsiaRegulatoryComplianceRule()
    context = {
        "url": "https://example-asia.com/clean",
        "title": "Tokyo Skincare & Wellness | Hydrating Formulas",
        "meta_description": "Gentle daily moisture support for normal and sensitive skin types.",
        "content": "Made with high quality domestic ingredients. Tested under standard laboratory conditions.",
    }
    result = rule.check(context)
    assert result is None

