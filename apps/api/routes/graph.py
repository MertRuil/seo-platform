from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from packages.shared.database import get_db
from packages.shared.models import CrawlPage, Site
from packages.contracts.graph import SiteGraphResponse, InternalLinkOpportunityResponse
from apps.api.routes.sites import verify_site_access
from services.security.jwt_auth import get_current_user_payload
from services.site_graph.graph_engine import SiteGraphEngine

router = APIRouter(prefix="/organizations/{org_id}/sites/{site_id}/graph", tags=["Site Graph & Internal Linking"])

@router.get("", response_model=SiteGraphResponse)
async def get_site_graph_and_links(
    org_id: str,
    site_id: str,
    crawl_id: str = None,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db)

    query = select(CrawlPage).where(CrawlPage.site_id == site_id)
    if crawl_id:
        query = query.where(CrawlPage.crawl_run_id == crawl_id)

    res = await db.execute(query)
    pages = res.scalars().all()

    page_dicts = [{"url": p.url, "title": p.title, "status_code": p.status_code} for p in pages]
    links = []
    # If no crawled links exist yet, provide root link
    if site.primary_url:
        page_dicts.append({"url": site.primary_url, "title": site.name, "status_code": 200})

    graph_engine = SiteGraphEngine()
    graph_engine.build_graph(page_dicts, links)

    metrics = graph_engine.compute_metrics(site.primary_url)
    opps = graph_engine.find_internal_link_opportunities(site.primary_url)

    pr = metrics["pagerank"]
    top_pages = [
        {"url": url, "pagerank": round(score, 4)}
        for url, score in sorted(pr.items(), key=lambda x: x[1], reverse=True)[:10]
    ]

    return SiteGraphResponse(
        site_id=site_id,
        total_nodes=metrics["total_nodes"],
        total_edges=metrics["total_edges"],
        orphan_pages=metrics["orphan_pages"],
        top_pagerank_pages=top_pages,
        linking_opportunities=[
            InternalLinkOpportunityResponse(
                source_url=o["source_hub"],
                target_url=o["target_orphan"],
                reason=o.get("recommendation", "Pass PageRank equity from hub to low-link target"),
                target_pagerank=round(pr.get(o["target_orphan"], 0.0), 4),
                source_pagerank=round(o.get("source_pr", 0.0), 4)
            )
            for o in opps
        ]
    )
