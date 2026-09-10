from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from packages.shared.database import get_db
from packages.shared.models import GscSearchMetric, CruxMetric, Site
from packages.contracts.integration import (
    GscSearchMetricResponse,
    CruxMetricResponse,
    OpportunityResponse
)
from apps.api.routes.sites import verify_site_access
from services.security.jwt_auth import get_current_user_payload
from services.integrations.opportunity_engine import GscOpportunityEngine
from services.integrations.gsc_client import GscSearchRow

router = APIRouter(prefix="/organizations/{org_id}/sites/{site_id}/integrations", tags=["Integrations & Performance"])

@router.get("/gsc", response_model=List[GscSearchMetricResponse])
async def get_gsc_metrics(
    org_id: str,
    site_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    await verify_site_access(org_id, site_id, user_id, db)

    res = await db.execute(
        select(GscSearchMetric).where(GscSearchMetric.site_id == site_id).order_by(GscSearchMetric.metric_date.desc()).limit(100)
    )
    return res.scalars().all()

@router.get("/crux", response_model=List[CruxMetricResponse])
async def get_crux_metrics(
    org_id: str,
    site_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    await verify_site_access(org_id, site_id, user_id, db)

    res = await db.execute(
        select(CruxMetric).where(CruxMetric.site_id == site_id).order_by(CruxMetric.fetched_at.desc()).limit(50)
    )
    return res.scalars().all()

@router.get("/opportunities", response_model=List[OpportunityResponse])
async def get_opportunities(
    org_id: str,
    site_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    await verify_site_access(org_id, site_id, user_id, db)

    res = await db.execute(
        select(GscSearchMetric).where(GscSearchMetric.site_id == site_id)
    )
    metrics = res.scalars().all()

    rows = [
        GscSearchRow(
            query=m.query,
            page=m.page,
            clicks=m.clicks,
            impressions=m.impressions,
            ctr=float(m.ctr),
            position=float(m.position)
        )
        for m in metrics
    ]

    opps = GscOpportunityEngine.analyze_opportunities(rows)
    return [
        OpportunityResponse(
            type=o.category,
            query=o.query,
            page=o.page,
            impressions=o.impressions,
            clicks=o.clicks,
            ctr=o.ctr,
            position=o.position,
            recommended_action=o.recommended_action
        )
        for o in opps
    ]

from urllib.parse import urlparse
from packages.contracts.indexing import (
    IndexNowSubmitRequest,
    IndexNowSubmitResponse,
    GoogleIndexingSubmitRequest,
    GoogleIndexingSubmitResponse
)
from services.integrations.indexing_client import IndexNowClient, GoogleIndexingClient
from services.security.ssrf import validate_safe_url

@router.post("/indexnow", response_model=IndexNowSubmitResponse)
async def submit_urls_to_indexnow(
    org_id: str,
    site_id: str,
    req: IndexNowSubmitRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    """
    Submits a batch of URLs to the IndexNow protocol (Bing, Yandex, Seznam).
    Strictly validates that host and submitted URLs belong to the verified site.
    """
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db, ["OWNER", "ADMIN", "SEO_MANAGER"])

    target_host = (req.host or site.domain).lower().strip().removeprefix("http://").removeprefix("https://").split("/")[0]
    normalized_target_host = target_host[4:] if target_host.startswith("www.") else target_host

    if normalized_target_host != site.normalized_domain and not normalized_target_host.endswith("." + site.normalized_domain):
        raise HTTPException(
            status_code=400,
            detail="IndexNow bildirimi yalnızca seçili siteye ait alan adı için yapılabilir."
        )

    for u in req.url_list:
        parsed_u = urlparse(u)
        host_u = (parsed_u.hostname or "").lower().removeprefix("www.")
        if host_u != site.normalized_domain and not host_u.endswith("." + site.normalized_domain):
            raise HTTPException(
                status_code=400,
                detail=f"Bildirilen '{u}' adresi seçili sitenin alan adına ait olmalıdır."
            )

    client = IndexNowClient(key=req.key)
    result = await client.submit_urls(
        host=target_host,
        url_list=req.url_list,
        key_location=req.key_location
    )
    return IndexNowSubmitResponse(**result)

@router.post("/google-indexing", response_model=GoogleIndexingSubmitResponse)
async def submit_url_to_google_indexing(
    org_id: str,
    site_id: str,
    req: GoogleIndexingSubmitRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    """
    Submits a URL update or deletion notification to Google Indexing API.
    Strictly validates that the URL belongs to the verified site.
    """
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db, ["OWNER", "ADMIN", "SEO_MANAGER"])

    parsed = urlparse(req.url)
    host = (parsed.hostname or "").lower().removeprefix("www.")
    if host != site.normalized_domain and not host.endswith("." + site.normalized_domain):
        raise HTTPException(
            status_code=400,
            detail="Google Indexing bildirimi yalnızca seçili siteye ait sayfalar için yapılabilir."
        )

    client = GoogleIndexingClient()
    result = await client.publish_url_notification(
        url=req.url,
        action_type=req.action_type
    )
    return GoogleIndexingSubmitResponse(**result)
