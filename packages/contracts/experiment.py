from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class ExperimentCreateRequest(BaseModel):
    name: str
    variant_pages: List[str] = Field(..., min_length=1)
    control_pages: List[str] = Field(..., min_length=1)

class ExperimentEvaluationResponse(BaseModel):
    experiment_name: str
    diff_in_diff_lift: float
    variant_relative_lift_percent: float
    is_statistically_significant: bool
    conclusion: str
