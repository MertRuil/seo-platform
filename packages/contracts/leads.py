from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class FinancialLossMetrics(BaseModel):
    health_score: int
    monthly_traffic: int
    conversion_rate: float
    average_order_value: float
    traffic_at_risk: int
    monthly_revenue_loss: float
    annual_revenue_loss: float
    critical_barriers: List[str]
    top_quick_wins: List[str]
    currency: str = "USD"

class LeadCard(BaseModel):
    id: str
    organization_id: str
    site_id: Optional[str] = None
    company_name: str
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    target_url: str
    metrics: FinancialLossMetrics
    proposal_pitch: str
    recommended_tier: str
    crm_status: str = "draft"  # draft, exported, synced
    crm_lead_id: Optional[str] = None
    created_at: str

class GenerateLeadRequest(BaseModel):
    url: Optional[str] = None
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    monthly_traffic: Optional[int] = 50000
    conversion_rate: Optional[float] = 0.02
    average_order_value: Optional[float] = 120.0
    currency: Optional[str] = "USD"

class ExportCrmRequest(BaseModel):
    lead_id: Optional[str] = None
    company_name: str
    contact_name: str
    contact_email: str
    contact_phone: Optional[str] = None
    target_url: str
    annual_value: Optional[float] = None
    proposal_pitch: Optional[str] = None
    destination_crm: Optional[str] = "Sistem CRM"
    webhook_url: Optional[str] = None
    custom_notes: Optional[str] = None

class ExportCrmResponse(BaseModel):
    success: bool
    crm_lead_id: str
    activity_id: str
    destination: str
    synced_payload: Dict[str, Any]
    message: str
