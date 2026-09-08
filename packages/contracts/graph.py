from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class InternalLinkOpportunityResponse(BaseModel):
    source_url: str
    target_url: str
    reason: str
    target_pagerank: float
    source_pagerank: float

class SiteGraphResponse(BaseModel):
    site_id: str
    total_nodes: int
    total_edges: int
    orphan_pages: List[str]
    top_pagerank_pages: List[Dict[str, Any]]
    linking_opportunities: List[InternalLinkOpportunityResponse]
