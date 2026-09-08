from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from pydantic import BaseModel
from packages.shared.database import get_db
from packages.shared.models import CrawlRun, CrawlPage, Site
from apps.api.routes.sites import verify_site_access
from services.security.jwt_auth import get_current_user_payload
from services.seo_engine.engine import SeoRuleEngine

router = APIRouter(prefix="/organizations/{org_id}/sites/{site_id}", tags=["Issues & Health"])

class IssueSummaryResponse(BaseModel):
    rule_id: str
    category: str
    severity: str
    title: str
    description: str
    recommendation_template: str
    documentation_url: Optional[str] = None
    affected_url_count: int

class SiteHealthReportResponse(BaseModel):
    site_id: str
    crawl_run_id: str
    health_score: int
    total_pages_evaluated: int
    total_issues_found: int
    issues: List[IssueSummaryResponse]

@router.get("/crawls/{crawl_id}/health", response_model=SiteHealthReportResponse)
async def get_crawl_health_and_issues(
    org_id: str,
    site_id: str,
    crawl_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    await verify_site_access(org_id, site_id, user_id, db)

    # Fetch crawled pages
    result = await db.execute(
        select(CrawlPage).where(
            CrawlPage.site_id == site_id,
            CrawlPage.crawl_run_id == crawl_id
        )
    )
    pages = result.scalars().all()
    if not pages:
        raise HTTPException(status_code=404, detail="No crawled pages found for this crawl run")

    page_contexts = [
        {
            "url": p.url,
            "status_code": p.status_code,
            "canonical_target": p.canonical_target,
            "has_noindex": p.has_noindex,
            "title": p.title,
            "meta_description": p.meta_description,
            "word_count": p.word_count,
            "headings": {}
        }
        for p in pages
    ]

    engine = SeoRuleEngine()
    evaluation = engine.evaluate_site(page_contexts)

    # Group issues by rule_id
    issues_by_rule = {}
    for issue in evaluation["issues"]:
        if issue.rule_id not in issues_by_rule:
            issues_by_rule[issue.rule_id] = {
                "rule_id": issue.rule_id,
                "category": issue.category.value,
                "severity": issue.severity.value,
                "title": issue.title,
                "description": issue.description,
                "recommendation_template": issue.recommendation_template,
                "documentation_url": issue.documentation_url,
                "count": 0
            }
        issues_by_rule[issue.rule_id]["count"] += 1

    summary_list = [
        IssueSummaryResponse(
            rule_id=data["rule_id"],
            category=data["category"],
            severity=data["severity"],
            title=data["title"],
            description=data["description"],
            recommendation_template=data["recommendation_template"],
            documentation_url=data["documentation_url"],
            affected_url_count=data["count"]
        )
        for data in issues_by_rule.values()
    ]

    return SiteHealthReportResponse(
        site_id=site_id,
        crawl_run_id=crawl_id,
        health_score=evaluation["health_score"],
        total_pages_evaluated=evaluation["total_pages_evaluated"],
        total_issues_found=evaluation["total_issues_found"],
        issues=summary_list
    )
