import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from services.security.jwt_auth import get_current_user_payload
from packages.config.settings import settings
from packages.contracts.knowledge import (
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
    KnowledgeChunkDTO,
    KnowledgeStatsResponse,
    KnowledgeSourcesResponse,
    KnowledgeSourceDTO,
    DocumentIngestRequest,
    DocumentIngestResponse
)
from services.rag.hybrid_store import HybridKnowledgeStore
from services.rag.seeds import SEED_DOCUMENTS
from services.rag.chunker import SemanticChunker
from services.rag.curator_agent import KnowledgeCuratorAgent
from services.rag.rate_limiter import RateLimiter
from services.rag.verification_engine import VerificationEngine

router = APIRouter(prefix="/knowledge", tags=["Knowledge & RAG"])

# Singleton knowledge store and curator agent for API lifecycle
_STORE = HybridKnowledgeStore()
_LIMITER = RateLimiter(
    rpm_limit=settings.RAG_RATE_LIMIT_RPM,
    tpm_limit=settings.RAG_RATE_LIMIT_TPM,
    daily_request_budget=settings.RAG_DAILY_REQUEST_BUDGET,
    daily_token_budget=settings.RAG_DAILY_TOKEN_BUDGET
)
_CURATOR = KnowledgeCuratorAgent(
    knowledge_store=_STORE,
    rate_limiter=_LIMITER,
    verification_engine=VerificationEngine(min_confidence_threshold=settings.RAG_VERIFICATION_MIN_CONFIDENCE),
    audit_log_path="data/curation_audit_log.json"
)

def _initialize_knowledge_store():
    """Populates knowledge store from disk or seeds if empty."""
    if os.path.exists(settings.RAG_STORE_PATH):
        try:
            _STORE.load_from_disk(settings.RAG_STORE_PATH)
        except Exception:
            pass

    if len(_STORE.chunks) == 0:
        for seed in SEED_DOCUMENTS:
            chunks = SemanticChunker.chunk_markdown(seed["content"], seed["title"])
            for idx, c in enumerate(chunks):
                _STORE.add_chunk(
                    chunk_id=f"{seed['id']}-{idx}",
                    document_title=seed["title"],
                    heading_path=c.heading_path,
                    content=c.content,
                    vector=[0.05] * 128,
                    status=seed["status"],
                    canonical_url=seed.get("canonical_url", ""),
                    authority_level=seed.get("authority_level", "LEVEL_1_OFFICIAL"),
                    verification_status="VERIFIED" if seed["status"] == "ACTIVE" else "DEPRECATED",
                    verified_claims=[seed["title"]]
                )

# Initialize on import
_initialize_knowledge_store()

@router.get("/stats", response_model=KnowledgeStatsResponse)
async def get_knowledge_stats():
    """Returns real-time statistics on RAG chunks, verification levels, and rate limit telemetry."""
    stats = _STORE.get_stats()
    metrics = _LIMITER.get_metrics()
    return KnowledgeStatsResponse(
        total_chunks=stats["total_chunks"],
        active_chunks=stats["active_chunks"],
        deprecated_chunks=stats["deprecated_chunks"],
        verified_chunks=stats["verified_chunks"],
        level_1_official_chunks=stats["level_1_official_chunks"],
        rate_limit_metrics=metrics
    )

@router.get("/sources", response_model=KnowledgeSourcesResponse)
async def list_knowledge_sources():
    """Returns official Level-1 documentation standards and curated sources."""
    # Deduplicate sources by canonical_url
    seen_urls = set()
    sources: List[KnowledgeSourceDTO] = []

    # First add all seed docs
    for doc in SEED_DOCUMENTS:
        url = doc.get("canonical_url", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            sources.append(KnowledgeSourceDTO(
                id=doc["id"],
                title=doc["title"],
                canonical_url=url,
                authority_level=doc.get("authority_level", "LEVEL_1_OFFICIAL"),
                status=doc.get("status", "ACTIVE")
            ))

    # Next check any dynamically curated documents in store
    for cid, c in _STORE.chunks.items():
        url = c.get("canonical_url", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            sources.append(KnowledgeSourceDTO(
                id=cid,
                title=c["document_title"],
                canonical_url=url,
                authority_level=c.get("authority_level", "LEVEL_1_OFFICIAL"),
                status=c.get("status", "ACTIVE")
            ))

    return KnowledgeSourcesResponse(
        total_sources=len(sources),
        sources=sources
    )

@router.post("/search", response_model=KnowledgeSearchResponse)
async def search_knowledge(request: KnowledgeSearchRequest):
    """
    Executes hybrid dense + Okapi BM25 search over verified Level-1 documentation.
    Strictly suppresses deprecated and rejected information.
    """
    scored_chunks = _STORE.search_hybrid(
        query=request.query,
        query_vector=request.query_vector,
        top_k=request.top_k
    )

    results = [
        KnowledgeChunkDTO(
            chunk_id=c.chunk_id,
            document_title=c.document_title,
            heading_path=c.heading_path,
            content=c.content,
            score=round(c.score, 4),
            canonical_url=c.canonical_url,
            authority_level=c.authority_level,
            verification_status=c.verification_status
        )
        for c in scored_chunks
    ]

    return KnowledgeSearchResponse(
        query=request.query,
        results_count=len(results),
        results=results
    )

@router.post("/verify-and-ingest", response_model=DocumentIngestResponse)
async def verify_and_ingest_document(
    request: DocumentIngestRequest,
    payload: dict = Depends(get_current_user_payload)
):
    """
    Submits a candidate document to the autonomous curator agent:
    1. Requires ADMIN or OWNER authorization.
    2. Verifies source authority tier.
    3. Runs deterministic anti-myth checks.
    4. Rejects false claims or unverified community sources.
    5. Chunks and ingests verified documents into the RAG knowledge store.
    """
    user_role = payload.get("role", "")
    is_admin = payload.get("is_admin", False)
    if not is_admin and user_role not in ("OWNER", "ADMIN", "SEO_MANAGER"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yalnızca yetkili platform ve SEO yöneticileri RAG bilgi deposuna veri ekleyebilir."
        )

    doc_payload = {
        "id": request.id,
        "title": request.title,
        "content": request.content,
        "canonical_url": request.canonical_url,
        "status": request.status
    }

    result = await _CURATOR.curate_document(doc_payload)

    if result.get("status") == "SKIPPED_RATE_LIMIT":
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=result["message"]
        )

    return DocumentIngestResponse(
        doc_id=result["doc_id"],
        title=result["title"],
        canonical_url=result["canonical_url"],
        verification_status=result["verification_status"],
        confidence=result["confidence"],
        authority_level=result["authority_level"],
        chunks_ingested=result["chunks_ingested"],
        reasons=result.get("reasons", []),
        verified_at=result["verified_at"]
    )
