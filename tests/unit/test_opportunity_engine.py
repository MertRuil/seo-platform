import pytest
from services.integrations.gsc_client import GscSearchRow
from services.integrations.opportunity_engine import GscOpportunityEngine

def test_opportunity_engine_detects_low_ctr_snippet():
    # Pos 4.0, 1000 impressions, 10 clicks (1% CTR < 2.5% threshold)
    rows = [
        GscSearchRow(query="autonomous seo", page="https://example.com/tool", clicks=10, impressions=1000, ctr=0.01, position=4.0)
    ]
    opps = GscOpportunityEngine.analyze_opportunities(rows)
    assert len(opps) == 1
    assert opps[0].category == "CTR_SNIPPET_OPPORTUNITY"
    assert "Underperforming CTR" in opps[0].title

def test_opportunity_engine_detects_striking_distance():
    # Pos 12.0, 2500 impressions
    rows = [
        GscSearchRow(query="seo audit automation", page="https://example.com/audit", clicks=20, impressions=2500, ctr=0.008, position=12.0)
    ]
    opps = GscOpportunityEngine.analyze_opportunities(rows)
    assert len(opps) == 1
    assert opps[0].category == "RANKING_EXPANSION_OPPORTUNITY"
    assert "Striking distance" in opps[0].title

def test_opportunity_engine_detects_cannibalization():
    # Two pages competing for same query
    rows = [
        GscSearchRow(query="best seo tools", page="https://example.com/tools-2025", clicks=50, impressions=500, ctr=0.10, position=5.0),
        GscSearchRow(query="best seo tools", page="https://example.com/tools-2026", clicks=30, impressions=400, ctr=0.075, position=6.5)
    ]
    opps = GscOpportunityEngine.analyze_opportunities(rows)
    cannibal_opps = [o for o in opps if o.category == "KEYWORD_CANNIBALIZATION_CANDIDATE"]
    assert len(cannibal_opps) == 1
    assert cannibal_opps[0].query == "best seo tools"
