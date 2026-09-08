import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from packages.shared.database import get_db
from packages.shared.models import CrawlRun, CrawlPage, Site
from packages.contracts.crawl import CrawlTriggerRequest, CrawlRunResponse, CrawlPageDetailResponse
from apps.api.routes.sites import verify_site_access
from services.security.jwt_auth import get_current_user_payload
from apps.worker.worker import worker_queue

router = APIRouter(prefix="/organizations/{org_id}/sites/{site_id}/crawls", tags=["Crawls"])

@router.post("", response_model=CrawlRunResponse, status_code=status.HTTP_201_CREATED)
async def trigger_crawl(
    org_id: str,
    site_id: str,
    req: CrawlTriggerRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db, ["OWNER", "ADMIN", "SEO_MANAGER"])

    crawl_run = CrawlRun(
        site_id=site_id,
        crawl_mode=req.crawl_mode,
        max_pages=req.max_pages,
        max_depth=req.max_depth,
        status="QUEUED"
    )
    db.add(crawl_run)
    await db.commit()
    await db.refresh(crawl_run)

    # Enqueue crawl job in background worker
    await worker_queue.enqueue("crawl", crawl_run_id=crawl_run.id)

    return crawl_run

@router.get("", response_model=List[CrawlRunResponse])
async def list_crawl_runs(
    org_id: str,
    site_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    await verify_site_access(org_id, site_id, user_id, db)

    res = await db.execute(
        select(CrawlRun).where(CrawlRun.site_id == site_id).order_by(CrawlRun.created_at.desc())
    )
    return res.scalars().all()

@router.get("/{crawl_id}", response_model=CrawlRunResponse)
async def get_crawl_run(
    org_id: str,
    site_id: str,
    crawl_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    await verify_site_access(org_id, site_id, user_id, db)

    res = await db.execute(
        select(CrawlRun).where(CrawlRun.id == crawl_id, CrawlRun.site_id == site_id)
    )
    run = res.scalars().first()
    if not run:
        raise HTTPException(status_code=404, detail="Crawl run not found")
    return run

@router.get("/{crawl_id}/pages", response_model=List[CrawlPageDetailResponse])
async def list_crawl_pages(
    org_id: str,
    site_id: str,
    crawl_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    await verify_site_access(org_id, site_id, user_id, db)

    res = await db.execute(
        select(CrawlPage).where(CrawlPage.crawl_run_id == crawl_id, CrawlPage.site_id == site_id)
    )
    return res.scalars().all()
