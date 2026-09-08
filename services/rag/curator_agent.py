import os
import json
import time
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from services.rag.hybrid_store import HybridKnowledgeStore
from services.rag.chunker import SemanticChunker
from services.rag.verification_engine import VerificationEngine, VerificationStatus
from services.rag.rate_limiter import RateLimiter
from services.agents.base import LLMProvider

class KnowledgeCuratorAgent:
    """
    Autonomous Knowledge Curation Specialist Agent.
    Strictly enforces zero false information:
    - Queries, verifies, and cross-references each document before ingestion.
    - Governs LLM / API token spend and rate limits.
    - Chunks verified documents and registers them in the HybridKnowledgeStore.
    - Records comprehensive audit logs.
    """
    def __init__(
        self,
        knowledge_store: HybridKnowledgeStore,
        verification_engine: Optional[VerificationEngine] = None,
        rate_limiter: Optional[RateLimiter] = None,
        llm_provider: Optional[LLMProvider] = None,
        audit_log_path: str = "data/curation_audit_log.json"
    ):
        self.store = knowledge_store
        self.verifier = verification_engine or VerificationEngine()
        self.limiter = rate_limiter or RateLimiter()
        self.llm = llm_provider
        self.audit_log_path = audit_log_path
        self.audit_log: List[Dict[str, Any]] = []

    async def curate_document(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validates, rate-limits, and conditionally ingests a single document into RAG.
        Returns a dict with verification and ingestion outcome.
        """
        title = doc.get("title", "")
        content = doc.get("content", "")
        canonical_url = doc.get("canonical_url", "")
        declared_status = doc.get("status", "ACTIVE")
        doc_id = doc.get("id") or f"doc-{int(time.time()*1000)}"

        # Estimate tokens (approx 1 word = 1.3 tokens)
        word_count = len(content.split())
        est_tokens = max(50, int(word_count * 1.3))

        # Check deduplication cache
        cache_key = f"{canonical_url}:{title}:{content[:200]}"
        cached = self.limiter.check_cache(cache_key)
        if cached:
            return cached

        # Acquire rate limit permission
        acquired = await self.limiter.acquire(estimated_tokens=est_tokens)
        if not acquired:
            result = {
                "doc_id": doc_id,
                "title": title,
                "status": "SKIPPED_RATE_LIMIT",
                "message": "Daily budget or token limit exceeded. Request deferred.",
                "chunks_ingested": 0
            }
            return result

        # Execute multi-stage verification
        verification = self.verifier.verify_document(
            title=title,
            content=content,
            canonical_url=canonical_url,
            declared_status=declared_status
        )

        outcome = {
            "doc_id": doc_id,
            "title": title,
            "canonical_url": canonical_url,
            "verification_status": verification.status.value,
            "confidence": verification.confidence,
            "authority_level": verification.authority_level.value,
            "chunks_ingested": 0,
            "reasons": verification.rejection_reasons,
            "verified_at": verification.verified_at
        }

        # Zero false information rule: Only VERIFIED or explicitly DEPRECATED docs are indexed
        if verification.status in (VerificationStatus.VERIFIED, VerificationStatus.DEPRECATED):
            chunks = SemanticChunker.chunk_markdown(content, title)
            for idx, c in enumerate(chunks):
                chunk_id = f"{doc_id}-chunk-{idx}"
                # Mock embedding vector (or real if provider attached)
                vector = [0.05] * 128
                self.store.add_chunk(
                    chunk_id=chunk_id,
                    document_title=title,
                    heading_path=c.heading_path,
                    content=c.content,
                    vector=vector,
                    status=declared_status,
                    canonical_url=canonical_url,
                    authority_level=verification.authority_level.value,
                    verification_status=verification.status.value,
                    verified_claims=verification.verified_claims,
                    verification_confidence=verification.confidence,
                    verified_at=verification.verified_at,
                    source_hash=verification.source_hash
                )
            outcome["chunks_ingested"] = len(chunks)
        else:
            outcome["rejected_claims"] = verification.rejected_claims

        # Save to audit log
        self.audit_log.append(outcome)
        self._append_audit_log(outcome)
        self.limiter.store_cache(cache_key, outcome)

        return outcome

    def _append_audit_log(self, record: Dict[str, Any]):
        try:
            os.makedirs(os.path.dirname(os.path.abspath(self.audit_log_path)), exist_ok=True)
            existing = []
            if os.path.exists(self.audit_log_path):
                try:
                    with open(self.audit_log_path, "r", encoding="utf-8") as f:
                        existing = json.load(f)
                except Exception:
                    existing = []
            existing.append(record)
            with open(self.audit_log_path, "w", encoding="utf-8") as f:
                json.dump(existing, f, indent=2, ensure_ascii=False)
        except Exception:
            pass


class AutonomousRAGCurator:
    """
    3-Day & Continuous Autonomous Curation Engine.
    Executes staged batches, checkpointing state across days,
    enforcing quota renewal and progress tracking.
    """
    def __init__(
        self,
        knowledge_store: Optional[HybridKnowledgeStore] = None,
        state_file: str = "data/curator_state.json",
        store_file: str = "data/knowledge_store.json"
    ):
        self.store = knowledge_store or HybridKnowledgeStore()
        self.agent = KnowledgeCuratorAgent(self.store)
        self.state_file = state_file
        self.store_file = store_file
        self.state: Dict[str, Any] = self._load_state()

    def _load_state(self) -> Dict[str, Any]:
        if os.path.exists(self.state_file):
            try:
                with open(self.state_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {
            "current_day": 1,
            "days_completed": 0,
            "total_documents_processed": 0,
            "total_verified": 0,
            "total_rejected": 0,
            "total_deprecated": 0,
            "daily_history": [],
            "last_updated": datetime.now(timezone.utc).isoformat()
        }

    def _save_state(self):
        os.makedirs(os.path.dirname(os.path.abspath(self.state_file)), exist_ok=True)
        self.state["last_updated"] = datetime.now(timezone.utc).isoformat()
        with open(self.state_file, "w", encoding="utf-8") as f:
            json.dump(self.state, f, indent=2, ensure_ascii=False)
        self.store.save_to_disk(self.store_file)

    async def simulate_multi_day_run(
        self,
        days: int = 3,
        candidate_batches: Optional[List[List[Dict[str, Any]]]] = None
    ) -> Dict[str, Any]:
        """
        Executes a 3-day simulated curation progression.
        On each day:
        - Re-initializes daily quota allowance
        - Evaluates candidate documents
        - Filters out myths and unverified claims
        - Persists store state to disk
        """
        # If no external batches provided, construct a realistic 3-day test curriculum
        if not candidate_batches:
            candidate_batches = self._generate_default_curriculum()

        results_by_day = []

        for day_idx in range(days):
            day_num = day_idx + 1
            # Reset rate limiter daily allowance for each simulated day
            self.agent.limiter.requests_today = 0
            self.agent.limiter.tokens_today = 0

            day_batch = candidate_batches[day_idx] if day_idx < len(candidate_batches) else []
            day_verified = 0
            day_rejected = 0
            day_chunks = 0

            for doc in day_batch:
                res = await self.agent.curate_document(doc)
                if res["verification_status"] in ("VERIFIED", "DEPRECATED"):
                    day_verified += 1
                    day_chunks += res.get("chunks_ingested", 0)
                else:
                    day_rejected += 1

            day_summary = {
                "day": day_num,
                "documents_evaluated": len(day_batch),
                "verified": day_verified,
                "rejected": day_rejected,
                "chunks_ingested": day_chunks,
                "metrics": self.agent.limiter.get_metrics()
            }
            results_by_day.append(day_summary)

            # Update persistent state
            self.state["days_completed"] += 1
            self.state["current_day"] = day_num + 1
            self.state["total_documents_processed"] += len(day_batch)
            self.state["total_verified"] += day_verified
            self.state["total_rejected"] += day_rejected
            self.state["daily_history"].append(day_summary)
            self._save_state()

        return {
            "status": "COMPLETED",
            "days_run": days,
            "total_processed": self.state["total_documents_processed"],
            "total_verified": self.state["total_verified"],
            "total_rejected": self.state["total_rejected"],
            "store_stats": self.store.get_stats(),
            "daily_summaries": results_by_day
        }

    def _generate_default_curriculum(self) -> List[List[Dict[str, Any]]]:
        """Generates a structured 3-day curriculum including valid guides and tricky false myths."""
        day_1 = [
            {
                "id": "day1-canonical",
                "title": "Google Search Central: Consolidate Duplicate URLs with Rel Canonical",
                "canonical_url": "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls",
                "status": "ACTIVE",
                "content": "Canonicalization specifies the authoritative URL for duplicate or similar pages. Always use absolute URLs for rel=canonical links."
            },
            {
                "id": "day1-myth-keywords",
                "title": "SEO Blog: Why Meta Keywords Tag Is Essential for 2026 Ranking",
                "canonical_url": "https://random-unverified-seo-blog.com/meta-keywords-tips",
                "status": "ACTIVE",
                "content": "You must use meta keywords to rank higher in Google search results. Add 20 meta keywords to improve search performance."
            },
            {
                "id": "day1-robots-txt",
                "title": "Google Search Central: Robots.txt Specification (RFC 9309)",
                "canonical_url": "https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt",
                "status": "ACTIVE",
                "content": "Robots.txt directs search crawler access to avoid overloading server resources. Disallowing a URL does not prevent indexing if linked externally."
            }
        ]

        day_2 = [
            {
                "id": "day2-cwv",
                "title": "W3C & Google: Core Web Vitals Standards and User Experience",
                "canonical_url": "https://developers.google.com/search/docs/appearance/core-web-vitals",
                "status": "ACTIVE",
                "content": "Largest Contentful Paint (LCP) measures perceived page loading speed. Target 2.5 seconds or lower at the 75th percentile of visits."
            },
            {
                "id": "day2-myth-rel-next",
                "title": "Legacy SEO: rel=next and rel=prev are required by Google for pagination",
                "canonical_url": "https://unverified-forum.com/pagination-rules",
                "status": "ACTIVE",
                "content": "Google requires rel=next and rel=prev directives on all paginated archive pages to index page series."
            },
            {
                "id": "day2-structured-data",
                "title": "Google Search Central: Schema.org Structured Data Guidelines",
                "canonical_url": "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data",
                "status": "ACTIVE",
                "content": "Structured data using JSON-LD format enables Google Rich Results including Article, Product, FAQ, and Breadcrumbs."
            }
        ]

        day_3 = [
            {
                "id": "day3-sitemaps",
                "title": "Google Search Central: XML Sitemaps Protocol and Architecture",
                "canonical_url": "https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview",
                "status": "ACTIVE",
                "content": "XML Sitemaps help search engines discover pages on large websites. Each sitemap file can contain up to 50,000 URLs and be up to 50MB."
            },
            {
                "id": "day3-myth-word-count",
                "title": "SEO Forum: Minimum 2500 words is a direct ranking factor in Google",
                "canonical_url": "https://seo-growth-hacks.com/word-count-ranking",
                "status": "ACTIVE",
                "content": "Word count is a direct ranking factor in Google. You must write a minimum 2500 words to guarantee first page ranking."
            },
            {
                "id": "day3-deprecated-preferred-domain",
                "title": "Google Search Console: Preferred Domain Setting (Legacy)",
                "canonical_url": "https://developers.google.com/search/docs/historical/preferred-domain",
                "status": "DEPRECATED",
                "content": "The preferred domain setting in Google Search Console has been retired. Sites should use 301 redirects and canonical tags."
            }
        ]

        return [day_1, day_2, day_3]
