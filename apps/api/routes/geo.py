from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from packages.shared.database import get_db
from packages.contracts.geo import (
    GeoDataResponse,
    GeoSimulateRequest,
    GeoSimulateResponse
)
from apps.api.routes.sites import verify_site_access
from services.security.jwt_auth import get_current_user_payload
from services.geo.geo_tracker_service import GeoTrackerService

router = APIRouter(prefix="/organizations/{org_id}/sites/{site_id}/geo", tags=["GEO & AI Search Tracker"])

@router.get("", response_model=GeoDataResponse)
async def get_site_geo_analytics(
    org_id: str,
    site_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    """
    Fetches aggregate GEO (Generative Engine Optimization) analytics for a site,
    including LLM visibility scores, platform citations, and prompt evaluations.
    """
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db)

    geo_data = await GeoTrackerService.get_site_geo_telemetry(
        site_domain=site.domain,
        site_name=site.name
    )
    return GeoDataResponse(**geo_data)

@router.post("/simulate", response_model=GeoSimulateResponse)
async def simulate_ai_search_query(
    org_id: str,
    site_id: str,
    req: GeoSimulateRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    """
    Simulates a live AI query across Perplexity, ChatGPT, Gemini, and Google AI Overviews,
    returning whether the brand is mentioned or cited, citation ranking, and snippets.
    """
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db)

    sim_res = await GeoTrackerService.simulate_ai_search(
        prompt=req.prompt,
        site_domain=site.domain,
        brand_name=req.brand_name or site.name
    )
    return GeoSimulateResponse(**sim_res)
