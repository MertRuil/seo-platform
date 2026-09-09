import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from packages.shared.database import AsyncSessionLocal
from packages.shared.models import CrawlRun, Site, CrawlPage, Recommendation
from services.crawler.crawler_service import CrawlerService
from services.seo_engine.engine import SeoRuleEngine
from services.agents.orchestrator import AiOrchestrator
from services.agents.base import get_llm_provider
from services.rag.hybrid_store import HybridKnowledgeStore
from services.rag.seeds import SEED_DOCUMENTS
from services.rag.chunker import SemanticChunker

logger = logging.getLogger("worker.tasks")

async def run_crawl_job(crawl_run_id: str) -> bool:
    """Executes crawler job for the specified crawl run."""
    async with AsyncSessionLocal() as db:
        try:
            crawler = CrawlerService(db, crawl_run_id)
            await crawler.run()
            logger.info(f"CrawlRun {crawl_run_id} completed successfully.")
            return True
        except Exception as e:
            logger.error(f"Error executing crawl {crawl_run_id}: {e}")
            res = await db.execute(select(CrawlRun).where(CrawlRun.id == crawl_run_id))
            run = res.scalars().first()
            if run:
                run.status = "FAILED"
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
                    "title": p.title,
                    "meta_description": p.meta_description,
                    "word_count": p.word_count
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

            orchestrator = AiOrchestrator(
                llm_provider=get_llm_provider(),
                knowledge_store=knowledge_store
            )

            pages_by_url = {p.url: {"title": p.title, "word_count": p.word_count, "status_code": p.status_code} for p in pages}
            recs_data = await orchestrator.process_crawl_issues(
                site_id=site_id,
                issues=results.get("issues", []),
                pages_by_url=pages_by_url
            )

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
                    status="PENDING"
                )
                db.add(rec_entity)
                created_count += 1

            await db.commit()
            return created_count
        except Exception as e:
            logger.error(f"Audit & AI job failed: {e}")
            return 0


async def run_rag_curator_job(days: int = 1) -> Dict[str, Any]:
    """Background worker task to run autonomous RAG knowledge curation and verification."""
    from services.rag.curator_agent import AutonomousRAGCurator
    curator = AutonomousRAGCurator()
    return await curator.simulate_multi_day_run(days=days)

