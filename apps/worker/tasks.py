import json
import logging
from datetime import datetime, timezone
from urllib.parse import urlparse
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from packages.shared.database import AsyncSessionLocal
from packages.shared.models import (
    CrawlRun, Site, CrawlPage, Recommendation,
    ChangeSet, ChangeItem, SiteConnector, AuditLog, utc_now
)
from services.crawler.crawler_service import CrawlerService
from services.seo_engine.engine import SeoRuleEngine
from services.agents.orchestrator import AiOrchestrator, MAX_ISSUES_PER_RUN, issue_key
from services.agents.base import get_llm_provider, is_placeholder_provider
from services.agents.proposed_change import plan_auto_change
from services.rag.hybrid_store import HybridKnowledgeStore
from services.rag.seeds import SEED_DOCUMENTS
from services.rag.chunker import SemanticChunker
from services.executor.executor_service import SafeSiteExecutor
from services.executor.connector_factory import build_connector_from_record
from services.executor.connectors.webhook import GenericWebhookConnector
from services.integrations.indexing_client import IndexNowClient

logger = logging.getLogger("worker.tasks")

def _page_facts(page: CrawlPage) -> Dict[str, Any]:
    """Ajanların ve önerilen değer kontrollerinin kullandığı sayfa bilgileri."""
    try:
        structured_data = json.loads(page.structured_data_json) if page.structured_data_json else []
    except (TypeError, ValueError):
        structured_data = []
    return {
        "url": page.url,
        "status_code": page.status_code,
        "title": page.title,
        "meta_description": page.meta_description,
        "h1": page.h1,
        "html_lang": page.html_lang,
        "word_count": page.word_count,
        "canonical_target": page.canonical_target,
        "structured_data": structured_data if isinstance(structured_data, list) else [structured_data],
    }


async def autonomous_auto_execute_low_risk(db: AsyncSession, site: Site, crawl_run_id: str) -> int:
    """
    Autonomous Execution Engine:
    Identifies low-risk, deterministic SEO fixes, creates atomic ChangeSets,
    executes them through the site's connector, verifies optimistic concurrency,
    records audit logs, and triggers instant IndexNow notifications.
    """
    try:
        from packages.config.settings import settings
        if settings.is_production_like and site.verification_status != "VERIFIED":
            return 0
        if settings.is_production_like:
            from services.billing.entitlements import EntitlementGuard
            await EntitlementGuard.ensure_feature(db, site.organization_id, "auto_fixes")
        # 1. Fetch pending low-risk recommendations for the site
        recs_res = await db.execute(
            select(Recommendation).where(
                Recommendation.site_id == site.id,
                Recommendation.status == "PENDING",
                Recommendation.risk_level == "LOW"
            ).order_by(Recommendation.priority_score.desc(), Recommendation.created_at)
        )
        low_risk_recs = recs_res.scalars().all()
        if not low_risk_recs:
            return 0

        # 2. Resolve Connector
        connector_record = (
            await db.execute(
                select(SiteConnector).where(
                    SiteConnector.site_id == site.id,
                    SiteConnector.is_active.is_(True)
                )
            )
        ).scalars().first()

        if connector_record:
            try:
                connector = build_connector_from_record(connector_record)
                if not await connector.verify_connection():
                    logger.warning(f"Active connector verification failed for site {site.id}. Skipping auto-execution.")
                    return 0
            except Exception as e:
                logger.error(f"Failed to build connector for site {site.id}: {e}")
                return 0
        else:
            logger.info(f"No active connector configured for site {site.id}. Skipping auto-execution.")
            return 0

        executor = SafeSiteExecutor(connector)
        capabilities = set(await connector.get_capabilities())
        auto_executed = 0

        # Pre-load crawl pages hash map for concurrency hash matching
        pages_res = await db.execute(
            select(CrawlPage).where(
                CrawlPage.site_id == site.id,
                CrawlPage.crawl_run_id == crawl_run_id
            )
        )
        pages_map = {p.url: p for p in pages_res.scalars().all()}
        # Yeni başlık/meta sitedeki başka bir sayfayla ya da bu çalıştırmada yazılan bir değerle çakışmasın.
        taken_titles = {p.title for p in pages_map.values() if p.title}
        taken_metas = {p.meta_description for p in pages_map.values() if p.meta_description}

        for rec in low_risk_recs:
            try:
                evidence = json.loads(rec.evidence_json) if isinstance(rec.evidence_json, str) else (rec.evidence_json or {})
            except Exception:
                evidence = {}

            # Kanıtta sayfa yoksa ana sayfaya düşülmez; değişiklik yanlış sayfaya yazılabilir.
            target_url = evidence.get("url") or evidence.get("page_url")
            if not target_url:
                continue
            host = (urlparse(target_url).hostname or "").lower().removeprefix("www.")
            if host != site.normalized_domain:
                # Do not execute if outside tenant domain boundary
                continue

            page = pages_map.get(target_url)
            if page is None:
                continue
            expected_hash = page.canonical_seo_hash or page.raw_html_hash or ""

            # Yalnızca kontrollerden geçmiş somut değer yazılır; önerinin başlığı ve teşhisi sayfa içeriği değildir.
            try:
                proposed = json.loads(rec.proposed_change_json) if rec.proposed_change_json else {}
            except (TypeError, ValueError):
                proposed = {}
            plan = plan_auto_change(
                rec.issue_id or "", rec.category, proposed, _page_facts(page), target_url,
                capabilities, taken_titles, taken_metas,
            )
            if plan is None:
                continue
            operation, before, after = plan
            state_before = json.dumps(before, ensure_ascii=False)
            state_after = json.dumps(after, ensure_ascii=False)

            # Create Atomic ChangeSet
            cs = ChangeSet(
                site_id=site.id,
                recommendation_id=rec.id,
                risk_level="LOW",
                status="APPROVED",  # Pre-approved by AUTO_LOW_RISK mode
                created_by="autonomous-seo-pilot",
                approved_by="autonomous-seo-pilot",
                approved_at=datetime.now(timezone.utc)
            )
            db.add(cs)
            await db.flush()

            ci = ChangeItem(
                change_set_id=cs.id,
                target_url=target_url,
                operation=operation,
                state_before=state_before,
                state_after=state_after,
                expected_hash_before=expected_hash,
                status="PENDING"
            )
            db.add(ci)
            await db.flush()

            cs.status = "EXECUTING"
            await db.commit()

            # Execute change safely
            async def persist_backup(snapshot):
                ci.state_before = json.dumps(snapshot)
                await db.commit()
            exec_res = await executor.execute_change_item(
                change_item={
                    "id": ci.id,
                    "target_url": ci.target_url,
                    "expected_hash_before": ci.expected_hash_before,
                    "risk_level": "LOW",
                    "operation": ci.operation,
                    "state_after": ci.state_after
                },
                require_approval=False,
                is_approved=True,
                persist_backup=persist_backup,
            )

            if exec_res.success:
                ci.status = "SUCCESS"
                cs.status = "SUCCESS"
                cs.executed_at = datetime.now(timezone.utc)
                rec.status = "RESOLVED"

                # Record in AuditLog
                audit = AuditLog(
                    organization_id=site.organization_id,
                    site_id=site.id,
                    user_id=None,
                    action="AUTONOMOUS_EXECUTE_LOW_RISK",
                    resource_type="CHANGE_SET",
                    resource_id=cs.id,
                    state_before=state_before,
                    state_after=state_after
                )
                db.add(audit)
                await db.commit()
                if after.get("title"):
                    taken_titles.add(after["title"])
                if after.get("meta_description"):
                    taken_metas.add(after["meta_description"])

                # Dispatch Instant IndexNow Notification
                try:
                    indexing_client = IndexNowClient()
                    await indexing_client.submit_urls(host=site.domain, url_list=[target_url])
                except Exception as e:
                    logger.warning(f"IndexNow notification failed for {target_url}: {e}")

                auto_executed += 1
            else:
                ci.status = "FAILED"
                cs.status = "FAILED"
                rec.status = "EXECUTION_FAILED"
                await db.commit()

        return auto_executed
    except Exception as e:
        logger.error(f"Error during autonomous auto execution for site {site.id}: {e}")
        return 0

async def run_crawl_job(crawl_run_id: str) -> bool:
    """Executes crawler job for the specified crawl run and automatically chains into audit & AI recommendations."""
    async with AsyncSessionLocal() as db:
        try:
            crawler = CrawlerService(db, crawl_run_id)
            await crawler.run()
            logger.info(f"CrawlRun {crawl_run_id} completed successfully.")

            # Automatically chain into audit and AI processing
            res = await db.execute(select(CrawlRun).where(CrawlRun.id == crawl_run_id))
            run = res.scalars().first()
            if run:
                await run_audit_and_ai_job(site_id=run.site_id, crawl_run_id=crawl_run_id)

            return True
        except Exception as e:
            logger.error(f"Error executing crawl {crawl_run_id}: {e}")
            res = await db.execute(select(CrawlRun).where(CrawlRun.id == crawl_run_id))
            run = res.scalars().first()
            if run:
                run.status = "FAILED"
                run.finished_at = utc_now()
                await db.commit()
            return False

async def run_audit_and_ai_job(site_id: str, crawl_run_id: str) -> int:
    """Evaluates deterministic SEO rules and produces AI recommendations."""
    async with AsyncSessionLocal() as db:
        try:
            # 1. Fetch crawled pages
            res = await db.execute(
                select(CrawlPage).where(
                    CrawlPage.site_id == site_id,
                    CrawlPage.crawl_run_id == crawl_run_id
                )
            )
            pages = res.scalars().all()
            if not pages:
                return 0

            page_contexts = [
                {
                    "url": p.url,
                    "status_code": p.status_code,
                    "canonical_target": p.canonical_target,
                    "has_noindex": p.has_noindex,
                    "in_sitemap": p.in_sitemap,
                    "is_indexable_candidate": p.is_indexable_candidate,
                    "is_canonical": p.is_canonical if p.is_canonical is not None else True,
                    "is_crawlable_by_google": p.is_crawlable_by_google,
                    "title": p.title,
                    "meta_description": p.meta_description,
                    "h1": getattr(p, "h1", None),
                    "headings": {"h1": [p.h1]} if getattr(p, "h1", None) else {},
                    "internal_links": json.loads(p.internal_links_json) if getattr(p, "internal_links_json", None) else [],
                    "structured_data": json.loads(p.structured_data_json) if getattr(p, "structured_data_json", None) else [],
                    "schema_types": [
                        item.get("@type")
                        for item in (json.loads(p.structured_data_json) if getattr(p, "structured_data_json", None) else [])
                        if isinstance(item, dict) and item.get("@type")
                    ],
                    "schema_syntax_errors": [],
                    "html_lang": getattr(p, "html_lang", None),
                    "hreflangs": json.loads(p.hreflangs_json) if getattr(p, "hreflangs_json", None) else [],
                    "word_count": p.word_count,
                }
                for p in pages
            ]

            # 2. Evaluate deterministic rules
            engine = SeoRuleEngine()
            results = engine.evaluate_site(page_contexts)

            # 3. Setup knowledge store and orchestrator
            knowledge_store = HybridKnowledgeStore()
            for seed in SEED_DOCUMENTS:
                chunks = SemanticChunker.chunk_markdown(seed["content"], seed["title"])
                for idx, c in enumerate(chunks):
                    knowledge_store.add_chunk(
                        chunk_id=f"{seed['id']}-{idx}",
                        document_title=seed["title"],
                        heading_path=c.heading_path,
                        content=c.content,
                        vector=[0.1] * 128,
                        status=seed["status"]
                    )

            llm_provider = get_llm_provider()
            if is_placeholder_provider(llm_provider):
                logger.warning(f"LLM yapılandırılmadı, sahte öneri kaydedilmemesi için AI adımı atlandı ({site_id})")
                return 0

            # Açık önerisi olan sorun her taramada yeniden modele gönderilmez; aynı öneri çoğalmaz.
            open_recs = (
                await db.execute(
                    select(Recommendation.issue_id, Recommendation.evidence_json).where(
                        Recommendation.site_id == site_id,
                        Recommendation.status.notin_(["RESOLVED", "REJECTED"])
                    )
                )
            ).all()
            open_keys = {issue_key(issue_id, json.loads(evidence or "{}")) for issue_id, evidence in open_recs}
            new_issues = [i for i in results.get("issues", []) if issue_key(i.rule_id, i.evidence) not in open_keys]
            if not new_issues:
                logger.info(f"Yeni sorun yok, AI öneri üretimi atlandı ({site_id})")
                return 0

            from services.security.token_budget import TokenBudgetService
            estimated = min(len(new_issues), MAX_ISSUES_PER_RUN) * 350 + 500
            try:
                await TokenBudgetService.check_budget_for_site(db, site_id, estimated_tokens=estimated)
            except Exception as e:
                logger.warning(f"Organizasyon AI jeton bütçesi tükendi, öneri üretimi atlandı ({site_id}): {e}")
                return 0

            orchestrator = AiOrchestrator(
                llm_provider=llm_provider,
                knowledge_store=knowledge_store
            )

            pages_by_url = {p.url: _page_facts(p) for p in pages}
            recs_data = await orchestrator.process_crawl_issues(
                site_id=site_id,
                issues=new_issues,
                pages_by_url=pages_by_url
            )

            # Record token usage for organization
            await TokenBudgetService.record_usage_for_site(db, site_id, tokens_used=max(500, len(recs_data) * 400))

            # 4. Save recommendations to database
            created_count = 0
            for r in recs_data:
                rec_entity = Recommendation(
                    site_id=site_id,
                    issue_id=r["issue_id"],
                    category=r["category"],
                    title=r["title"],
                    description=r["description"],
                    reason=r["reason"],
                    expected_impact=r["expected_impact"],
                    confidence=r["confidence"],
                    priority_score=r["priority_score"],
                    risk_level=r["risk_level"],
                    effort=r["effort"],
                    evidence_json=r["evidence_json"],
                    rag_sources_json=r["rag_sources_json"],
                    proposed_change_json=r.get("proposed_change_json"),
                    status="PENDING"
                )
                db.add(rec_entity)
                created_count += 1

            await db.commit()

            # 5. Check Autonomous Auto-Pilot Execution
            site_res = await db.execute(select(Site).where(Site.id == site_id))
            site = site_res.scalars().first()
            if site and site.execution_mode in ("AUTO_LOW_RISK", "AUTONOMOUS"):
                auto_applied = await autonomous_auto_execute_low_risk(db, site, crawl_run_id)
                logger.info(f"Autonomous Auto-Pilot: Applied {auto_applied} low-risk fixes automatically for {site.domain}")

            return created_count
        except Exception as e:
            logger.error(f"Audit & AI job failed: {e}")
            return 0

async def run_rag_curator_job(days: int = 1) -> Dict[str, Any]:
    """Background worker task to run autonomous RAG knowledge curation and verification."""
    from services.rag.curator_agent import AutonomousRAGCurator
    curator = AutonomousRAGCurator()
    return await curator.simulate_multi_day_run(days=days)
