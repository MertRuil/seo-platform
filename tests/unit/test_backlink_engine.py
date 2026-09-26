"""
Unit tests for Backlink Analysis, Toxicity Detection, and Google Disavow Generator.
"""

import pytest
from services.seo_engine.backlink_engine import (
    AnchorCategory,
    ToxicityRisk,
    BacklinkItem,
    classify_anchor_text,
    evaluate_backlink_toxicity,
    analyze_backlinks,
    generate_google_disavow_file
)


def test_classify_anchor_text():
    # Brand
    assert classify_anchor_text("Acme Store", "Acme Store", "https://acmestore.io") == AnchorCategory.BRAND
    # Partial match
    assert classify_anchor_text("En İyi Acme Store Modelleri", "Acme Store", "https://acmestore.io") == AnchorCategory.PARTIAL_MATCH
    # Naked URL
    assert classify_anchor_text("https://acmestore.io/urunler", "Acme Store", "https://acmestore.io") == AnchorCategory.NAKED_URL
    assert classify_anchor_text("acmestore.io/blog", "Acme Store", "https://acmestore.io") == AnchorCategory.NAKED_URL
    # Generic
    assert classify_anchor_text("tıklayın", "Acme Store", "https://acmestore.io") == AnchorCategory.GENERIC
    assert classify_anchor_text("click here", "Acme Store", "https://acmestore.io") == AnchorCategory.GENERIC
    # Exact Match
    assert classify_anchor_text("organik seo danışmanlığı", "Acme Store", "https://acmestore.io") == AnchorCategory.EXACT_MATCH


def test_evaluate_clean_backlink():
    is_toxic, risk, score, reasons = evaluate_backlink_toxicity(
        source_url="https://techcrunch.com/2026/03/modern-ecommerce-seo",
        anchor_text="Acme Store E-commerce Platform",
        source_da=88,
        source_spam_score=2
    )
    assert not is_toxic
    assert risk == ToxicityRisk.CLEAN
    assert len(reasons) == 0


def test_evaluate_toxic_tld_and_spam_anchor():
    is_toxic, risk, score, reasons = evaluate_backlink_toxicity(
        source_url="https://shady-link-farm.xyz/cheap-poker-list",
        anchor_text="play online casino poker free",
        source_da=4,
        source_spam_score=75
    )
    assert is_toxic
    assert risk in (ToxicityRisk.HIGH, ToxicityRisk.CRITICAL)
    assert score >= 65
    assert any(".xyz" in r for r in reasons)
    assert any("poker" in r or "casino" in r for r in reasons)


def test_analyze_backlinks_summary():
    b1 = BacklinkItem(
        id="b1",
        source_url="https://reputable-news.com/tech",
        source_domain="reputable-news.com",
        target_url="https://acmestore.io",
        anchor_text="Acme Store",
        anchor_category=AnchorCategory.BRAND,
        is_dofollow=True,
        domain_authority=80,
        page_authority=65,
        spam_score=1,
        is_toxic=False,
        toxicity_risk=ToxicityRisk.CLEAN
    )
    b2 = BacklinkItem(
        id="b2",
        source_url="https://blog.partner.io/guide",
        source_domain="partner.io",
        target_url="https://acmestore.io/features",
        anchor_text="e-ticaret seo kontrol listesi",
        anchor_category=AnchorCategory.EXACT_MATCH,
        is_dofollow=False,
        domain_authority=50,
        page_authority=40,
        spam_score=5,
        is_toxic=False,
        toxicity_risk=ToxicityRisk.CLEAN
    )
    b3 = BacklinkItem(
        id="b3",
        source_url="https://toxic-farm.top/pbn-links",
        source_domain="toxic-farm.top",
        target_url="https://acmestore.io",
        anchor_text="buy cheap viagra casino",
        anchor_category=AnchorCategory.EXACT_MATCH,
        is_dofollow=True,
        domain_authority=6,
        page_authority=8,
        spam_score=85,
        is_toxic=True,
        toxicity_risk=ToxicityRisk.CRITICAL,
        toxicity_reasons=["Yüksek riskli TLD (.top)", "Spam anahtar kelime"]
    )

    summary = analyze_backlinks([b1, b2, b3])
    assert summary.total_backlinks == 3
    assert summary.referring_domains == 3
    assert summary.dofollow_count == 2
    assert summary.nofollow_count == 1
    assert summary.dofollow_ratio == 66.7
    assert summary.toxic_backlinks_count == 1
    assert summary.toxic_domains_count == 1
    assert "toxic-farm.top" in summary.top_toxic_domains


def test_generate_google_disavow_file():
    toxic_item = BacklinkItem(
        id="tox1",
        source_url="https://spammy-network.win/directory-list",
        source_domain="spammy-network.win",
        target_url="https://acmestore.io",
        anchor_text="crypto yield bot",
        anchor_category=AnchorCategory.EXACT_MATCH,
        is_dofollow=True,
        domain_authority=3,
        page_authority=5,
        spam_score=90,
        is_toxic=True,
        toxicity_risk=ToxicityRisk.CRITICAL,
        toxicity_reasons=["Kritik spam TLD (.win)"]
    )

    disavow_content = generate_google_disavow_file([toxic_item], mode="domain")
    assert "Google Disavow Links File" in disavow_content
    assert "domain:spammy-network.win" in disavow_content
    assert "# Reason: Kritik spam TLD (.win)" in disavow_content
    assert disavow_content.endswith("# End of Google Disavow File")


def test_empty_backlinks_summary():
    empty_summary = analyze_backlinks([])
    assert empty_summary.total_backlinks == 0
    assert empty_summary.dofollow_ratio == 0.0
    assert empty_summary.overall_toxicity_risk == ToxicityRisk.CLEAN
