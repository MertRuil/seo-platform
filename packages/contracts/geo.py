from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class GeoPlatformScore(BaseModel):
    platform: str
    score: int
    mentions: int
    citations: int
    status: str
    trend: str
    grounding_mode: str = "SIMULATION"
    avg_confidence: Optional[float] = None


class GeoCitedSource(BaseModel):
    url: str
    domain: str
    title: str
    source_type: str = "COMPETITOR"  # OWNED, COMPETITOR, UGC_COMMUNITY, EDITORIAL_AUTHORITY, OFFICIAL_DOCS
    platforms_citing: List[str] = Field(default_factory=list)
    citation_count: int = 1
    why_cited: str = ""


class GeoMonteCarloMetrics(BaseModel):
    sample_runs: int = 3
    mention_probability: float = 0.0
    citation_probability: float = 0.0
    stability_score: int = 100
    confidence_interval_95: List[float] = Field(default_factory=lambda: [0.0, 0.0])
    temperatures_tested: List[float] = Field(default_factory=lambda: [0.1, 0.4, 0.7])


class LlmsTxtAuditItem(BaseModel):
    check_id: str
    title: str
    passed: bool
    severity: str = "MEDIUM"
    detail: str


class LlmsTxtBundleResponse(BaseModel):
    site_domain: str
    readiness_score: int
    has_live_llms_txt: bool = False
    has_live_llms_full_txt: bool = False
    ai_bots_status: Dict[str, str] = Field(default_factory=dict)
    audit_checks: List[LlmsTxtAuditItem] = Field(default_factory=list)
    llms_txt_content: str
    llms_full_txt_content: str
    pages_indexed_count: int = 0
    generated_at: str


class GeoQuickAction(BaseModel):
    title: str
    impact: str
    category: str
    description: str
    action_type: str = "INJECT_GEO_SCHEMA"
    target_url: Optional[str] = None
    patch_preview: Optional[str] = None


class GeoPromptItem(BaseModel):
    id: str
    prompt: str
    frequency: str
    brand_mentioned: bool
    citation_rank: int
    platform_results: Dict[str, Any]
    top_competitor_cited: Optional[str] = None
    cited_sources: List[GeoCitedSource] = Field(default_factory=list)
    monte_carlo: Optional[GeoMonteCarloMetrics] = None
    recommended_fix: Optional[Dict[str, Any]] = None
    is_simulated: bool = True
    data_source: str = "SIMULATION"


class GeoDataResponse(BaseModel):
    overallVisibility: int
    aiSearchShare: int
    topEngine: str
    platforms: List[GeoPlatformScore]
    prompts: List[GeoPromptItem]
    quickActions: List[GeoQuickAction]
    citedSources: List[GeoCitedSource] = Field(default_factory=list)
    llmsTxtReadiness: Optional[LlmsTxtBundleResponse] = None
    monteCarloSummary: Optional[Dict[str, Any]] = None
    is_simulated: bool = True
    data_source: str = "SIMULATION"


class GeoSimulateRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=500)
    brand_name: Optional[str] = None
    sample_runs: int = Field(default=3, ge=1, le=10)
    enable_web_grounding: bool = True


class GeoSimulateResponse(BaseModel):
    prompt: str
    brand_mentioned: bool
    citation_rank: int
    mentions_count: int
    citations_count: int
    platform_results: Dict[str, Any]
    top_competitor_cited: Optional[str] = None
    cited_sources: List[GeoCitedSource] = Field(default_factory=list)
    monte_carlo: Optional[GeoMonteCarloMetrics] = None
    recommended_fix: Optional[Dict[str, Any]] = None
    is_simulated: bool = True
    data_source: str = "SIMULATION"


class GeoDeployActionRequest(BaseModel):
    action_type: str = Field(
        default="DEPLOY_LLMS_TXT",
        pattern=r"^(DEPLOY_LLMS_TXT|DEPLOY_LLMS_FULL_TXT|INJECT_GEO_SCHEMA|INJECT_DIRECT_ANSWER|ALLOW_AI_BOTS_ROBOTS)$"
    )
    target_url: Optional[str] = None
    title: Optional[str] = None
    prompt_context: Optional[str] = None
    custom_content: Optional[str] = None
    auto_execute: bool = True


class GeoDeployActionResponse(BaseModel):
    success: bool
    action_type: str
    target_url: str
    operation: str
    change_set_id: str
    status: str
    connector_type: str
    message: str
    preview_diff: Dict[str, Any] = Field(default_factory=dict)

