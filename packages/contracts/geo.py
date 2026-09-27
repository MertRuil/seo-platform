from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

class GeoPlatformScore(BaseModel):
    platform: str
    score: int
    mentions: int
    citations: int
    status: str
    trend: str

class GeoPromptItem(BaseModel):
    id: str
    prompt: str
    frequency: str
    brand_mentioned: bool
    citation_rank: int
    platform_results: Dict[str, Any]
    top_competitor_cited: Optional[str] = None

class GeoQuickAction(BaseModel):
    title: str
    impact: str
    category: str
    description: str

class GeoDataResponse(BaseModel):
    overallVisibility: int
    aiSearchShare: int
    topEngine: str
    platforms: List[GeoPlatformScore]
    prompts: List[GeoPromptItem]
    quickActions: List[GeoQuickAction]

class GeoSimulateRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=500)
    brand_name: Optional[str] = None

class GeoSimulateResponse(BaseModel):
    prompt: str
    brand_mentioned: bool
    citation_rank: int
    mentions_count: int
    citations_count: int
    platform_results: Dict[str, Any]
    top_competitor_cited: Optional[str] = None
