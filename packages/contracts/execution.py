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
