from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict

class GscSearchMetricResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    site_id: str
    metric_date: date
    query: str
    page: str
    clicks: int
    impressions: int
    ctr: float
    position: float

class CruxMetricResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    site_id: str
    url: str
    form_factor: str
    p75_lcp_ms: Optional[int] = None
    p75_inp_ms: Optional[int] = None
    p75_cls: Optional[float] = None
    fetched_at: datetime

class OpportunityResponse(BaseModel):
    type: str
    query: Optional[str] = None
    page: Optional[str] = None
    impressions: int
    clicks: int
    ctr: float
    position: float
    recommended_action: str

class GscSyncResponse(BaseModel):
    success: bool
    status: Optional[str] = "HEALTHY"
    error_code: Optional[str] = None
    gsc_metrics_synced: int
    crux_metrics_synced: int
    opportunities_found: int
    message: str
