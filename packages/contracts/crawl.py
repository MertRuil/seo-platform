from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class CrawlTriggerRequest(BaseModel):
    crawl_mode: str = Field(default="GOOGLEBOT_SIMULATION", pattern=r"^(GOOGLEBOT_SIMULATION|OWNER_AUDIT)$")
    max_pages: int = Field(default=100, ge=1, le=10000)
    max_depth: int = Field(default=5, ge=1, le=20)

class CrawlRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    site_id: str
    crawl_mode: str
    status: str
    total_urls_discovered: int
    total_urls_crawled: int
    total_errors: int
    max_pages: int
    max_depth: int
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    created_at: datetime

class CrawlPageDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    url: str
    normalized_url: str
    depth: int
    status_code: int
    content_type: Optional[str] = None
    response_time_ms: Optional[int] = None
    is_indexable_candidate: bool
    canonical_target: Optional[str] = None
    title: Optional[str] = None
    meta_description: Optional[str] = None
    word_count: int
