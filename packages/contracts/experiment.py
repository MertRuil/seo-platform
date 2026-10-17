from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import date

class ExperimentCreateRequest(BaseModel):
    name: str
    variant_pages: List[str] = Field(..., min_length=1)
    control_pages: List[str] = Field(..., min_length=1)
    change_date: Optional[date] = None
    window_days: int = Field(14, ge=7, le=90)

class ExperimentEvaluationResponse(BaseModel):
    experiment_name: str
    diff_in_diff_lift: float
    variant_relative_lift_percent: float
    is_statistically_significant: bool
    conclusion: str
    variant_growth_percent: float = 0
    control_growth_percent: float = 0
