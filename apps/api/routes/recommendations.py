from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from packages.shared.database import get_db
from packages.shared.models import Recommendation, Site, CrawlRun, CrawlPage, GscSearchMetric
from packages.contracts.recommendation import (
    RecommendationResponse,
    RecommendationStatusUpdateRequest,
    StrategicRoadmapResponse
)
from apps.api.routes.sites import verify_site_access
from services.security.jwt_auth import get_current_user_payload
from apps.worker.worker import worker_queue
from services.agents.orchestrator import AiOrchestrator
from services.agents.base import get_llm_provider
from services.rag.hybrid_store import HybridKnowledgeStore
from services.seo_engine.engine import SeoRuleEngine

router = APIRouter(prefix="/organizations/{org_id}/sites/{site_id}", tags=["Recommendations & AI Agents"])

@router.post("/recommendations/generate", status_code=status.HTTP_202_ACCEPTED)
async def generate_recommendations_job(
    org_id: str,
    site_id: str,
    crawl_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    await verify_site_access(org_id, site_id, user_id, db, ["OWNER", "ADMIN", "SEO_MANAGER"])
    run = (await db.execute(select(CrawlRun).where(CrawlRun.id == crawl_id, CrawlRun.site_id == site_id))).scalars().first()
    if not run:
        raise HTTPException(status_code=404, detail="Crawl run not found")

    # Enqueue background audit and AI task
    await worker_queue.enqueue("audit_and_ai", site_id=site_id, crawl_run_id=crawl_id)
    return {"message": "AI recommendation processing queued successfully", "site_id": site_id, "crawl_id": crawl_id}

@router.get("/recommendations", response_model=List[RecommendationResponse])
async def list_recommendations(
    org_id: str,
    site_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    await verify_site_access(org_id, site_id, user_id, db)

    res = await db.execute(
        select(Recommendation)
        .where(Recommendation.site_id == site_id)
        .order_by(Recommendation.priority_score.desc())
    )
    return res.scalars().all()

@router.patch("/recommendations/{rec_id}", response_model=RecommendationResponse)
async def update_recommendation_status(
    org_id: str,
    site_id: str,
    rec_id: str,
    req: RecommendationStatusUpdateRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    await verify_site_access(org_id, site_id, user_id, db, ["OWNER", "ADMIN", "SEO_MANAGER", "EDITOR"])

    res = await db.execute(
        select(Recommendation).where(Recommendation.id == rec_id, Recommendation.site_id == site_id)
    )
    rec = res.scalars().first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    rec.status = req.status
    await db.commit()
    await db.refresh(rec)
    return rec

@router.get("/roadmap", response_model=StrategicRoadmapResponse)
async def get_strategic_roadmap(
    org_id: str,
    site_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db)

    pages = (await db.execute(select(CrawlPage).where(CrawlPage.site_id == site_id))).scalars().all()
    page_contexts = [{"url": p.url, "status_code": p.status_code, "canonical_target": p.canonical_target, "has_noindex": p.has_noindex, "title": p.title, "meta_description": p.meta_description, "word_count": p.word_count} for p in pages]
    evaluation = SeoRuleEngine().evaluate_site(page_contexts) if page_contexts else {"health_score": 0, "issues": []}
    critical_count = sum(1 for issue in evaluation["issues"] if issue.severity.value == "CRITICAL")
    opportunity_count = len((await db.execute(select(GscSearchMetric.id).where(GscSearchMetric.site_id == site_id))).all())

    orchestrator = AiOrchestrator(
        llm_provider=get_llm_provider(),
        knowledge_store=HybridKnowledgeStore()
    )
    roadmap = await orchestrator.generate_strategic_roadmap(
        site_id=site_id,
        domain=site.domain,
        health_score=evaluation["health_score"],
        critical_issues_count=critical_count,
        opportunities_count=opportunity_count
    )
    return StrategicRoadmapResponse(**roadmap)
