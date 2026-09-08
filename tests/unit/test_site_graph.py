import pytest
from services.site_graph.graph_engine import SiteGraphEngine

def test_site_graph_pagerank_and_orphans():
    engine = SiteGraphEngine()
    pages = [
        {"url": "https://example.com/", "title": "Home"},
        {"url": "https://example.com/about", "title": "About"},
        {"url": "https://example.com/services", "title": "Services"},
        {"url": "https://example.com/orphan-case-study", "title": "Orphan Study"},
    ]
    links = [
        {"source_url": "https://example.com/", "target_url": "https://example.com/about", "anchor_text": "About Us", "is_internal": True},
        {"source_url": "https://example.com/", "target_url": "https://example.com/services", "anchor_text": "Our Services", "is_internal": True},
        {"source_url": "https://example.com/about", "target_url": "https://example.com/", "anchor_text": "Back to Home", "is_internal": True},
    ]

    engine.build_graph(pages, links)
    metrics = engine.compute_metrics("https://example.com/")

    # Orphan page has in-degree 0
    assert "https://example.com/orphan-case-study" in metrics["orphan_pages"]
    # Depths
    assert metrics["depths"]["https://example.com/"] == 0
    assert metrics["depths"]["https://example.com/about"] == 1
    # PageRank on home is highest
    pr = metrics["pagerank"]
    assert pr["https://example.com/"] > pr["https://example.com/orphan-case-study"]

    # Opportunities to link hub to orphan
    opps = engine.find_internal_link_opportunities("https://example.com/")
    assert len(opps) == 1
    assert opps[0]["target_orphan"] == "https://example.com/orphan-case-study"
    assert opps[0]["source_hub"] == "https://example.com/"
