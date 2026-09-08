import pytest
from services.rag.verification_engine import (
    VerificationEngine,
    VerificationStatus,
    AuthorityLevel
)

@pytest.fixture
def engine():
    return VerificationEngine(min_confidence_threshold=0.85)

def test_authority_determination(engine):
    assert engine.determine_authority("https://developers.google.com/search/docs/crawling") == AuthorityLevel.LEVEL_1_OFFICIAL
    assert engine.determine_authority("https://schema.org/Article") == AuthorityLevel.LEVEL_1_OFFICIAL
    assert engine.determine_authority("https://www.w3.org/TR/html5/") == AuthorityLevel.LEVEL_1_OFFICIAL
    assert engine.determine_authority("https://www.rfc-editor.org/rfc/rfc9309.html") == AuthorityLevel.LEVEL_1_OFFICIAL
    assert engine.determine_authority("https://searchengineland.com/guide") == AuthorityLevel.LEVEL_2_AUTHORITATIVE
    assert engine.determine_authority("https://random-forum.com/thread/123") == AuthorityLevel.LEVEL_3_COMMUNITY

def test_verify_official_document(engine):
    res = engine.verify_document(
        title="Consolidate Duplicate URLs",
        content="Use rel=canonical link elements to indicate preferred URLs to Googlebot. Canonical tags are strong hints.",
        canonical_url="https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls"
    )
    assert res.status == VerificationStatus.VERIFIED
    assert res.confidence >= 0.85
    assert res.authority_level == AuthorityLevel.LEVEL_1_OFFICIAL
    assert len(res.verified_claims) > 0
    assert len(res.rejected_claims) == 0

def test_reject_debunked_meta_keywords_myth(engine):
    res = engine.verify_document(
        title="SEO Secrets",
        content="You must use meta keywords to rank higher in Google search algorithms.",
        canonical_url="https://developers.google.com/search/docs/fake"
    )
    assert res.status == VerificationStatus.REJECTED
    assert any("Meta Keywords" in r for r in res.rejected_claims)
    assert len(res.rejection_reasons) > 0

def test_reject_word_count_myth(engine):
    res = engine.verify_document(
        title="Ranking Formula",
        content="Word count is a direct ranking factor. Pages need minimum 3000 words to rank #1.",
        canonical_url="https://searchengineland.com/article"
    )
    assert res.status == VerificationStatus.REJECTED
    assert any("Word Count" in r for r in res.rejected_claims)

def test_reject_robots_txt_deindex_myth(engine):
    res = engine.verify_document(
        title="Robots txt Guide",
        content="Add robots.txt disallow to remove page from search index immediately.",
        canonical_url="https://searchengineland.com/robots-guide"
    )
    assert res.status == VerificationStatus.REJECTED
    assert any("Robots.txt" in r for r in res.rejected_claims)

def test_detect_explicit_deprecated_guidance(engine):
    res = engine.verify_document(
        title="Preferred Domain Setting",
        content="Preferred domain configuration in Search Console has been retired.",
        canonical_url="https://developers.google.com/search/docs/historical/preferred-domain",
        declared_status="DEPRECATED"
    )
    assert res.status == VerificationStatus.DEPRECATED
    assert res.confidence == 1.0

def test_unverified_community_source_gate(engine):
    res = engine.verify_document(
        title="Community Tips",
        content="Here are my tips for optimizing page speed and user experience on standard websites.",
        canonical_url="https://random-unverified-blog.xyz/post"
    )
    assert res.status == VerificationStatus.NEEDS_REVIEW
    assert res.authority_level == AuthorityLevel.LEVEL_3_COMMUNITY
