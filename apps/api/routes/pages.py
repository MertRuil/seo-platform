from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from packages.shared.database import get_db
from packages.shared.models import CrawlPage
from apps.api.routes.sites import verify_site_access
from services.security.jwt_auth import get_current_user_payload

router = APIRouter(prefix="/organizations/{org_id}/sites/{site_id}", tags=["Pages"])

class PageExplorerItem(BaseModel):
    id: str
    url: str
    normalized_url: str
    status_code: int
    depth: int
    title: Optional[str] = None
    meta_description: Optional[str] = None
    canonical_target: Optional[str] = None
    has_noindex: bool
    is_indexable_candidate: bool
    word_count: int
    response_time_ms: Optional[int] = None

class PaginatedPagesResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: List[PageExplorerItem]

@router.get("/crawls/{crawl_id}/pages", response_model=PaginatedPagesResponse)
async def list_crawl_pages(
    org_id: str,
    site_id: str,
    crawl_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status_code: Optional[int] = None,
    noindex: Optional[bool] = None,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    await verify_site_access(org_id, site_id, user_id, db)

    query = select(CrawlPage).where(
        CrawlPage.site_id == site_id,
        CrawlPage.crawl_run_id == crawl_id
    )
    if status_code is not None:
        query = query.where(CrawlPage.status_code == status_code)
    if noindex is not None:
        query = query.where(CrawlPage.has_noindex == noindex)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    query = query.order_by(CrawlPage.depth.asc(), CrawlPage.url.asc()).limit(limit).offset(offset)
    result = await db.execute(query)
    pages = result.scalars().all()

    items = [
        PageExplorerItem(
            id=p.id,
            url=p.url,
            normalized_url=p.normalized_url,
            status_code=p.status_code,
            depth=p.depth,
            title=p.title,
            meta_description=p.meta_description,
            canonical_target=p.canonical_target,
            has_noindex=p.has_noindex,
            is_indexable_candidate=p.is_indexable_candidate,
            word_count=p.word_count,
            response_time_ms=p.response_time_ms
        )
        for p in pages
    ]

    return PaginatedPagesResponse(
        total=total,
        limit=limit,
        offset=offset,
        items=items
    )
