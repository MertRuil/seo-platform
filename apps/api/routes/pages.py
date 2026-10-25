from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_
from typing import List, Optional
from pydantic import BaseModel
import json
from packages.shared.database import get_db
from packages.shared.models import CrawlPage, AuditLog, User, Membership
from packages.shared.text_search import fold, fold_text
from apps.api.routes.sites import verify_site_access
from services.security.jwt_auth import get_current_user_payload

router = APIRouter(prefix="/organizations/{org_id}/sites/{site_id}", tags=["Pages"])

@router.get("/audit")
async def list_site_audit(org_id: str, site_id: str, payload: dict = Depends(get_current_user_payload), db: AsyncSession = Depends(get_db)):
    await verify_site_access(org_id, site_id, payload.get("sub"), db)
    role = (await db.execute(select(Membership.role).where(Membership.organization_id==org_id,Membership.user_id==payload.get("sub")))).scalar_one()
    rows = (await db.execute(select(AuditLog,User.email).outerjoin(User,User.id==AuditLog.user_id).where(AuditLog.organization_id==org_id,AuditLog.site_id==site_id).order_by(AuditLog.created_at.desc()).limit(200))).all()
    return [{"time":entry.created_at.isoformat(),"user":email or "Sistem","action":entry.action,"target":entry.resource_id,"detail":entry.resource_type,"ip":entry.ip_address or "" if role in ("OWNER","ADMIN") else ""} for entry,email in rows]

class PageExplorerItem(BaseModel):
    id: str
    url: str
    normalized_url: str
    status_code: int
    depth: int
    title: Optional[str] = None
    meta_description: Optional[str] = None
    h1: Optional[str] = None
    canonical_target: Optional[str] = None
    has_noindex: bool
    is_indexable_candidate: bool
    in_sitemap: bool = False
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
    q: Optional[str] = Query(None, max_length=200),
    status_code: Optional[int] = None,
    noindex: Optional[bool] = None,
    in_sitemap: Optional[bool] = Query(None, description="Site haritasında yer alıp almadığına göre filtrele"),
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    await verify_site_access(org_id, site_id, user_id, db)

    query = select(CrawlPage).where(
        CrawlPage.site_id == site_id,
        CrawlPage.crawl_run_id == crawl_id
    )
    if q:
        needle = fold_text(q)
        query = query.where(or_(fold(CrawlPage.url).contains(needle, autoescape=True), fold(func.coalesce(CrawlPage.title, "")).contains(needle, autoescape=True)))
    if status_code is not None:
        query = query.where(CrawlPage.status_code == status_code)
    if noindex is not None:
        query = query.where(CrawlPage.has_noindex == noindex)
    if in_sitemap is not None:
        query = query.where(CrawlPage.in_sitemap == in_sitemap)

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
            in_sitemap=p.in_sitemap,
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


@router.get("/crawls/{crawl_id}/schema")
async def list_crawl_schema(org_id: str, site_id: str, crawl_id: str,
                            payload: dict = Depends(get_current_user_payload),
                            db: AsyncSession = Depends(get_db)):
    await verify_site_access(org_id, site_id, payload.get("sub"), db)
    pages = (await db.execute(select(CrawlPage).where(
        CrawlPage.site_id == site_id, CrawlPage.crawl_run_id == crawl_id,
        CrawlPage.structured_data_json.is_not(None),
    ))).scalars().all()
    rows = []
    for page in pages:
        try:
            nodes = [json.loads(page.structured_data_json)]
        except (ValueError, TypeError):
            rows.append({"type": "JSON-LD", "page": page.url, "status": "Hatalı", "richResult": "Doğrulanamadı", "missing": "Geçersiz JSON sözdizimi"})
            continue
        types = set()
        while nodes:
            node = nodes.pop()
            if isinstance(node, list):
                nodes.extend(node)
            elif isinstance(node, dict):
                values = node.get("@type", [])
                if isinstance(values, str): values = [values]
                if isinstance(values, list): types.update(v for v in values if isinstance(v, str))
                nodes.extend(v for v in node.values() if isinstance(v, (list, dict)))
        for schema_type in sorted(types):
            rows.append({"type": schema_type, "page": page.url, "status": "Uyarı", "richResult": "Google uygunluğu ayrıca doğrulanmalı", "missing": "JSON-LD okundu; alan ve zengin sonuç doğrulaması yapılmadı"})
    return rows
