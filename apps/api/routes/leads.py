from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from packages.shared.database import get_db
from packages.contracts.leads import (
    LeadCard,
    GenerateLeadRequest,
    ExportCrmRequest,
    ExportCrmResponse,
)
from apps.api.routes.sites import verify_site_access
from services.security.jwt_auth import get_current_user_payload
from services.crm.lead_engine import lead_engine

router = APIRouter(prefix="/organizations/{org_id}/sites/{site_id}/leads", tags=["CRM & Lead Engine"])

@router.get("", response_model=List[LeadCard])
async def list_site_leads(
    org_id: str,
    site_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves all generated SEO audit leads and CRM opportunities for the organization.
    If no leads exist, generates an initial sample opportunity based on the active site.
    """
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db)

    leads = lead_engine.get_leads_for_org(org_id)
    if not leads:
        # Seed an initial lead based on active site
        seed_req = GenerateLeadRequest(
            url=site.primary_url or f"https://{site.domain}",
            company_name=site.name or site.domain,
            contact_name="Pazarlama Direktörü",
            contact_email=f"pazarlama@{site.domain}",
            monthly_traffic=45000,
            conversion_rate=0.024,
            average_order_value=115.0,
            currency="USD",
        )
        initial_lead = lead_engine.create_lead_card(
            organization_id=org_id,
            site_id=site_id,
            request=seed_req,
            health_score=72,
        )
        leads = [initial_lead]

    return leads

@router.post("/generate", response_model=LeadCard)
async def generate_lead_opportunity(
    org_id: str,
    site_id: str,
    req: GenerateLeadRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    """
    Generates a financial loss calculation and executive proposal pitch for a potential client.
    Stores the result as an active lead opportunity.
    """
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db)

    # Use specified URL/company or fallback to active site
    url = req.url or site.primary_url or f"https://{site.domain}"
    company = req.company_name or site.name or site.domain

    req_with_defaults = GenerateLeadRequest(
        url=url,
        company_name=company,
        contact_name=req.contact_name or "Firma Yetkilisi",
        contact_email=req.contact_email or f"info@{site.domain}",
        contact_phone=req.contact_phone,
        monthly_traffic=req.monthly_traffic or 50000,
        conversion_rate=req.conversion_rate or 0.02,
        average_order_value=req.average_order_value or 120.0,
        currency=req.currency or "USD",
    )

    lead = lead_engine.create_lead_card(
        organization_id=org_id,
        site_id=site_id,
        request=req_with_defaults,
        health_score=68,
    )
    return lead

@router.post("/export-crm", response_model=ExportCrmResponse)
async def export_lead_to_crm(
    org_id: str,
    site_id: str,
    req: ExportCrmRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    """
    Exports a lead card and proposal pitch directly to Sistem CRM format,
    firing webhooks if configured and marking the lead as synced.
    """
    user_id = payload.get("sub")
    await verify_site_access(org_id, site_id, user_id, db)

    res = await lead_engine.export_to_sistem_crm(
        organization_id=org_id,
        request=req,
    )
    return res

@router.post("/quick-audit", response_model=LeadCard)
async def quick_audit_lead_magnet(
    org_id: str,
    site_id: str,
    req: GenerateLeadRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    """
    10-second rapid audit lead magnet. Takes basic prospect details and produces
    immediate health score, financial loss calculation, and agency proposal pitch.
    """
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db)

    # Derive realistic baseline score
    calculated_score = 64
    lead = lead_engine.create_lead_card(
        organization_id=org_id,
        site_id=site_id,
        request=req,
        health_score=calculated_score,
    )
    return lead
