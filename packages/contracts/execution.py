from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class ChangeItemPayload(BaseModel):
    target_url: str
    operation: str
    state_before: str
    state_after: str
    expected_hash_before: str

class ChangeSetCreateRequest(BaseModel):
    recommendation_id: Optional[str] = None
    risk_level: str = Field(default="LOW", pattern=r"^(INFO|LOW|MEDIUM|HIGH|CRITICAL)$")
    items: List[ChangeItemPayload]

class ChangeItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    target_url: str
    operation: str
    state_before: str
    state_after: str
    expected_hash_before: str
    status: str

class ChangeSetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    site_id: str
    recommendation_id: Optional[str] = None
    status: str
    risk_level: str
    created_at: datetime
    executed_at: Optional[datetime] = None
    items: List[ChangeItemResponse] = []

class ExecutionResultResponse(BaseModel):
    success: bool
    status: str
    error_message: Optional[str] = None
    rolled_back: bool = False

class ConnectorCreateRequest(BaseModel):
    connector_type: str = Field(description="Connector type: WORDPRESS_REST, GENERIC_WEBHOOK, GIT_PR, CLOUDFLARE_WORKER, GOOGLE_SEARCH_CONSOLE")
    base_url: Optional[str] = None
    credentials: Dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True

class ConnectorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    site_id: str
    connector_type: str
    base_url: Optional[str] = None
    capabilities: List[str] = []
    token_masked: str
    is_active: bool
    created_at: datetime

class ConnectorTestRequest(BaseModel):
    connector_type: str
    base_url: Optional[str] = None
    credentials: Optional[Dict[str, Any]] = None
    connector_id: Optional[str] = None

class ConnectorTestResponse(BaseModel):
    success: bool
    status_code: Optional[int] = None
    message: str
    capabilities: List[str] = []
