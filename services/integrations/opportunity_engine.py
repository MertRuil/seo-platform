from typing import List, Dict, Any
from services.integrations.gsc_client import GscSearchRow

class OpportunityCandidate:
    def __init__(
        self,
        category: str,
        query: str,
        page: str,
        impressions: int,
        clicks: int,
        ctr: float,
        position: float,
        title: str,
        description: str,
        recommended_action: str
    ):
        self.category = category
        self.query = query
        self.page = page
        self.impressions = impressions
        self.clicks = clicks
        self.ctr = ctr
        self.position = position
        self.title = title
        self.description = description
        self.recommended_action = recommended_action

class GscOpportunityEngine:
    CTR_BENCHMARK_TOP_10 = 0.025  # 2.5% CTR threshold for positions 3-10

    @staticmethod
    def analyze_opportunities(rows: List[GscSearchRow]) -> List[OpportunityCandidate]:
        opportunities: List[OpportunityCandidate] = []
        query_to_pages: Dict[str, List[GscSearchRow]] = {}

        for row in rows:
            # Map query to pages for cannibalization detection
            if row.query not in query_to_pages:
                query_to_pages[row.query] = []
            query_to_pages[row.query].append(row)

            # Pattern 1: High Impressions + Position 3-10 + Low CTR => Snippet / Title Opportunity
            if row.impressions >= 500 and (3.0 <= row.position <= 10.0) and (row.ctr < GscOpportunityEngine.CTR_BENCHMARK_TOP_10):
                opportunities.append(OpportunityCandidate(
                    category="CTR_SNIPPET_OPPORTUNITY",
                    query=row.query,
                    page=row.page,
                    impressions=row.impressions,
                    clicks=row.clicks,
                    ctr=row.ctr,
                    position=row.position,
                    title=f"Underperforming CTR on query '{row.query}'",
                    description=f"Page ranks at average position {row.position:.1f} with {row.impressions:,} impressions, but only achieves {row.ctr*100:.2f}% CTR (below 2.5% benchmark).",
                    recommended_action="Rewrite title tag and meta description to more directly address search intent and increase click-through rate."
                ))

            # Pattern 2: High Impressions + Position 8-20 => Content Expansion Opportunity
            elif row.impressions >= 1000 and (8.0 < row.position <= 20.0):
                opportunities.append(OpportunityCandidate(
                    category="RANKING_EXPANSION_OPPORTUNITY",
                    query=row.query,
                    page=row.page,
                    impressions=row.impressions,
                    clicks=row.clicks,
                    ctr=row.ctr,
                    position=row.position,
                    title=f"Striking distance query '{row.query}' (Pos {row.position:.1f})",
                    description=f"High search interest ({row.impressions:,} impressions) on Page 2 (Pos {row.position:.1f}). Substantive content enhancement could push it to Page 1.",
                    recommended_action="Expand content with dedicated section or FAQ addressing this subtopic."
                ))

        # Pattern 3: Keyword Cannibalization (Multiple pages ranking for same query with split traffic)
        for query, page_rows in query_to_pages.items():
            if len(page_rows) > 1:
                total_impr = sum(r.impressions for r in page_rows)
                if total_impr >= 300:
                    sorted_pages = sorted(page_rows, key=lambda r: r.clicks, reverse=True)
                    opportunities.append(OpportunityCandidate(
                        category="KEYWORD_CANNIBALIZATION_CANDIDATE",
                        query=query,
                        page=sorted_pages[0].page,
                        impressions=total_impr,
                        clicks=sum(r.clicks for r in page_rows),
                        ctr=sum(r.clicks for r in page_rows) / total_impr if total_impr else 0.0,
                        position=sorted_pages[0].position,
                        title=f"Potential keyword cannibalization on '{query}'",
                        description=f"{len(page_rows)} different URLs are competing for query '{query}', splitting impressions and link equity.",
                        recommended_action="Review search intent between competing pages; consolidate content or strengthen canonical/internal link differentiation."
                    ))

        return opportunities
