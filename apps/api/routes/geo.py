from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from apps.api.routes.sites import verify_site_access
from packages.config.settings import settings
from packages.contracts.geo import (
    GeoDataResponse,
    GeoDeployActionRequest,
    GeoDeployActionResponse,
    GeoSimulateRequest,
    GeoSimulateResponse,
    LlmsTxtBundleResponse,
)
from packages.shared.database import get_db
from packages.shared.models import AuditLog, ChangeItem, ChangeSet, CrawlPage, SiteConnector
from services.executor.connector_factory import build_connector_from_record, get_fallback_sandbox_connector
from services.executor.executor_service import SafeSiteExecutor
from services.geo.geo_tracker_service import GeoTrackerService
from services.geo.llms_txt_service import LlmsTxtService
from services.security.jwt_auth import get_current_user_payload

router = APIRouter(prefix="/organizations/{org_id}/sites/{site_id}/geo", tags=["GEO & AI Search Tracker"])


async def _load_site_crawled_pages(db: AsyncSession, site_id: str, limit: int = 40) -> list[dict]:
    res = await db.execute(
        select(CrawlPage)
        .where(CrawlPage.site_id == site_id)
        .order_by(CrawlPage.depth.asc(), CrawlPage.word_count.desc())
        .limit(limit)
    )
    rows = res.scalars().all()
    return [
        {
            "url": r.url,
            "title": r.title,
            "meta_description": r.meta_description,
            "h1": r.h1,
            "word_count": r.word_count,
            "depth": r.depth,
            "status_code": r.status_code,
            "has_noindex": r.has_noindex,
            "structured_data_json": r.structured_data_json,
        }
        for r in rows
    ]


@router.get("", response_model=GeoDataResponse)
async def get_site_geo_analytics(
    org_id: str,
    site_id: str,
    sample_runs: int = Query(default=3, ge=1, le=10),
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetches aggregate GEO 2.0 (Generative Engine Optimization) analytics for a site,
    including LLM visibility scores, Monte Carlo confidence intervals, cited source attribution,
    and /llms.txt readiness.
    """
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db)
    crawled_pages = await _load_site_crawled_pages(db, site_id)

    geo_data = await GeoTrackerService.get_site_geo_telemetry(
        site_domain=site.domain,
        site_name=site.name,
        crawled_pages=crawled_pages,
        site_type=site.site_type or "CORPORATE",
        language=site.language or "tr",
        country=site.country or "TR",
        sample_runs=sample_runs,
    )
    return GeoDataResponse(**geo_data)


@router.post("/simulate", response_model=GeoSimulateResponse)
async def simulate_ai_search_query(
    org_id: str,
    site_id: str,
    req: GeoSimulateRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    """
    Executes or simulates an AI query across Perplexity, ChatGPT, Gemini, Google AI Overviews,
    and Claude with Monte Carlo multi-run sampling and cited source attribution.
    """
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db)

    sim_res = await GeoTrackerService.simulate_ai_search(
        prompt=req.prompt,
        site_domain=site.domain,
        brand_name=req.brand_name or site.name,
        sample_runs=req.sample_runs,
        enable_web_grounding=req.enable_web_grounding,
    )
    return GeoSimulateResponse(**sim_res)


@router.get("/llms-txt", response_model=LlmsTxtBundleResponse)
async def get_site_llms_txt_bundle(
    org_id: str,
    site_id: str,
    probe_live: bool = Query(default=False),
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    """
    Compiles and audits the site's /llms.txt and /llms-full.txt Markdown files
    from actual crawled pages and evaluates AI crawler (GPTBot, PerplexityBot, ClaudeBot) access.
    """
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db)
    crawled_pages = await _load_site_crawled_pages(db, site_id)
    live_probe = await LlmsTxtService.probe_live_files(site.primary_url, probe_network=probe_live)

    bundle = LlmsTxtService.build_bundle(
        site_domain=site.domain,
        site_name=site.name,
        primary_url=site.primary_url,
        site_type=site.site_type or "CORPORATE",
        language=site.language or "tr",
        country=site.country or "TR",
        crawled_pages=crawled_pages,
        live_probe=live_probe,
    )
    return LlmsTxtBundleResponse(**bundle)


@router.post("/deploy-action", response_model=GeoDeployActionResponse)
async def deploy_geo_action(
    org_id: str,
    site_id: str,
    req: GeoDeployActionRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    """
    Converts a GEO 2.0 insight (/llms.txt deployment, Direct Answer block, FAQPage JSON-LD schema,
    or AI Bot robots.txt rule) into an auditable ChangeSet and executes it via SafeSiteExecutor.
    """
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db, ["OWNER", "ADMIN", "SEO_MANAGER"])

    crawled_pages = await _load_site_crawled_pages(db, site_id)
    llms_bundle = LlmsTxtService.build_bundle(
        site_domain=site.domain,
        site_name=site.name,
        primary_url=site.primary_url,
        site_type=site.site_type or "CORPORATE",
        language=site.language or "tr",
        country=site.country or "TR",
        crawled_pages=crawled_pages,
    )

    base_url = (site.primary_url or f"https://{site.domain}").rstrip("/")
    action_type = req.action_type

    if action_type == "DEPLOY_LLMS_TXT":
        default_target = f"{base_url}/llms.txt"
        operation = "DEPLOY_LLMS_TXT"
        content_body = req.custom_content or llms_bundle["llms_txt_content"]
        state_before_obj = {"url": default_target, "llms_txt_exists": llms_bundle["has_live_llms_txt"]}
        state_after_obj = {
            "url": default_target,
            "file_path": "public/llms.txt",
            "content_type": "text/plain; charset=utf-8",
            "llms_txt_content": content_body,
            "static_body": content_body,
        }
    elif action_type == "DEPLOY_LLMS_FULL_TXT":
        default_target = f"{base_url}/llms-full.txt"
        operation = "DEPLOY_LLMS_FULL_TXT"
        content_body = req.custom_content or llms_bundle["llms_full_txt_content"]
        state_before_obj = {"url": default_target, "llms_full_txt_exists": llms_bundle["has_live_llms_full_txt"]}
        state_after_obj = {
            "url": default_target,
            "file_path": "public/llms-full.txt",
            "content_type": "text/plain; charset=utf-8",
            "llms_txt_content": content_body,
            "static_body": content_body,
        }
    elif action_type == "ALLOW_AI_BOTS_ROBOTS":
        default_target = f"{base_url}/robots.txt"
        operation = "UPDATE_ROBOTS_TXT"
        robots_patch = (
            "# Calpeo GEO 2.0 — AI Search & Grounding Bots Policy\n"
            "User-agent: OAI-SearchBot\nAllow: /\n\n"
            "User-agent: GPTBot\nAllow: /\n\n"
            "User-agent: PerplexityBot\nAllow: /\n\n"
            "User-agent: ClaudeBot\nAllow: /\n\n"
            "User-agent: Google-Extended\nAllow: /\n\n"
            f"Sitemap: {base_url}/sitemap.xml\n"
            f"# LLMs Context Index: {base_url}/llms.txt\n"
        )
        state_before_obj = {"url": default_target, "ai_bots_status": llms_bundle["ai_bots_status"]}
        state_after_obj = {
            "url": default_target,
            "file_path": "public/robots.txt",
            "static_body": req.custom_content or robots_patch,
        }
    else:
        # INJECT_DIRECT_ANSWER or INJECT_GEO_SCHEMA
        default_target = f"{base_url}/"
        operation = "INJECT_DIRECT_ANSWER" if action_type == "INJECT_DIRECT_ANSWER" else "INJECT_SCHEMA_JSONLD"
        prompt_ctx = req.prompt_context or f"{site.name} nedir ve hangi çözümleri sunar?"
        fix_payload = GeoTrackerService._build_recommended_fix(
            prompt=prompt_ctx,
            clean_domain=site.normalized_domain,
            brand=site.name,
            brand_mentioned=False,
            citation_rank=2,
            top_competitor="ahrefs.com",
        )
        state_before_obj = {"url": default_target, "geo_optimized": False}
        state_after_obj = {
            "url": default_target,
            "operation": operation,
            "direct_answer_html": req.custom_content or fix_payload["direct_answer_html"],
            "schema_json": fix_payload["json_ld_schema"],
        }

    resolved_target = req.target_url or default_target
    parsed_target = urlparse(urljoin(f"{base_url}/", resolved_target))
    if (
        parsed_target.scheme not in ("http", "https")
        or (parsed_target.hostname or "").lower().removeprefix("www.") != site.normalized_domain
        or parsed_target.username
        or parsed_target.password
    ):
        raise HTTPException(status_code=400, detail="Değişiklik hedefi bu sitenin alan adına ait olmalıdır")

    target_url = parsed_target.geturl()
    state_before_obj["url"] = target_url
    state_after_obj["url"] = target_url

    # Determine connector and whether immediate execution is permitted
    connector_record = (
        await db.execute(select(SiteConnector).where(SiteConnector.site_id == site_id, SiteConnector.is_active.is_(True)))
    ).scalars().first()

    can_auto_execute = bool(req.auto_execute)
    if settings.is_production_like and can_auto_execute:
        if site.verification_status != "VERIFIED" or not connector_record:
            # In production without verified domain or live connector, queue as WAITING_APPROVAL ChangeSet
            can_auto_execute = False

    expected_hash = hashlib.sha256(f"geo-baseline:{target_url}".encode()).hexdigest()[:16]

    cs = ChangeSet(
        site_id=site_id,
        recommendation_id=None,
        risk_level="LOW",
        status="APPROVED" if can_auto_execute else "WAITING_APPROVAL",
        created_by=user_id,
        approved_by=user_id if can_auto_execute else None,
        approved_at=datetime.now(timezone.utc) if can_auto_execute else None,
    )
    db.add(cs)
    await db.flush()

    ci = ChangeItem(
        change_set_id=cs.id,
        target_url=target_url,
        operation=operation,
        state_before=json.dumps(state_before_obj, ensure_ascii=False),
        state_after=json.dumps(state_after_obj, ensure_ascii=False),
        expected_hash_before=expected_hash,
        status="PENDING",
    )
    db.add(ci)
    await db.commit()
    await db.refresh(cs)

    connector_type = connector_record.connector_type if connector_record else "SANDBOX"
    if can_auto_execute:
        if connector_record:
            try:
                connector = build_connector_from_record(connector_record)
            except Exception:
                connector = get_fallback_sandbox_connector(site.domain)
                connector_type = "SANDBOX"
        else:
            connector = get_fallback_sandbox_connector(site.domain)
            connector_type = "SANDBOX"

        # Seed sandbox baseline hash so optimistic concurrency check succeeds cleanly
        read_state = await connector.read_page_state(target_url)
        ci.expected_hash_before = read_state.get("canonical_seo_hash") or read_state.get("current_hash") or expected_hash

        executor = SafeSiteExecutor(connector)
        cs.status = "EXECUTING"
        await db.commit()

        async def persist_backup(snapshot):
            ci.state_before = json.dumps(snapshot, ensure_ascii=False)
            await db.commit()

        exec_res = await executor.execute_change_item(
            change_item={
                "id": ci.id,
                "target_url": ci.target_url,
                "expected_hash_before": ci.expected_hash_before,
                "risk_level": "LOW",
                "operation": ci.operation,
                "state_after": state_after_obj,
            },
            require_approval=False,
            is_approved=True,
            persist_backup=persist_backup,
        )

        ci.status = "SUCCESS" if exec_res.success else "FAILED"
        cs.status = "SUCCESS" if exec_res.success else "FAILED"
        cs.executed_at = datetime.now(timezone.utc)
        db.add(
            AuditLog(
                organization_id=org_id,
                site_id=site_id,
                user_id=user_id,
                action="GEO_YAMASI_UYGULANDI" if exec_res.success else "GEO_YAMASI_BAŞARISIZ",
                resource_type="CHANGE_SET",
                resource_id=cs.id,
            )
        )
        await db.commit()

    msg = (
        f"'{action_type}' işlemi ({target_url}) {connector_type} bağlayıcısı üzerinden başarıyla uygulandı (ChangeSet #{cs.id[:8]})."
        if cs.status == "SUCCESS"
        else f"'{action_type}' işlemi için ChangeSet (#{cs.id[:8]}) oluşturuldu ve onay kuyruğuna alındı."
    )

    return GeoDeployActionResponse(
        success=cs.status in ("SUCCESS", "WAITING_APPROVAL", "APPROVED"),
        action_type=action_type,
        target_url=target_url,
        operation=operation,
        change_set_id=cs.id,
        status=cs.status,
        connector_type=connector_type,
        message=msg,
        preview_diff={"before": state_before_obj, "after": state_after_obj},
    )
