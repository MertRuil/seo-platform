from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class RecommendationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    site_id: str
    issue_id: Optional[str] = None
    category: str
    title: str
    description: str
    reason: str
    expected_impact: Optional[str] = None
    confidence: float
    priority_score: float
    risk_level: str
    effort: str
    evidence_json: str
    rag_sources_json: str
    status: str
    created_at: datetime

class RecommendationStatusUpdateRequest(BaseModel):
    status: str = Field(..., pattern=r"^(APPROVED|REJECTED|IN_PROGRESS|RESOLVED)$")

class StrategicRoadmapResponse(BaseModel):
    site_id: str
    category: str
    title: str
    diagnosis: str
    roadmap: str
    priority_score: float
    risk_level: str
    citations: List[Dict[str, Any]]
