from fastapi import APIRouter, HTTPException, Request, status
import asyncio
import time
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from services.crawler.safe_client import SafeHttpClient
from services.crawler.html_extractor import HtmlExtractor
from services.crawler.url_normalizer import UrlNormalizer
from services.seo_engine.engine import SeoRuleEngine
from services.agents.orchestrator import AiOrchestrator
from services.agents.base import get_llm_provider
from services.rag.hybrid_store import HybridKnowledgeStore
from services.rag.seeds import SEED_DOCUMENTS
from services.rag.chunker import SemanticChunker

router = APIRouter(prefix="/audit", tags=["Hızlı Site Denetimi"])

# Per-IP Rate Limiting: max 5 quick audits per 60 seconds (with memory leak protection)
_IP_AUDIT_HISTORY: Dict[str, List[float]] = {}
MAX_AUDITS_PER_MINUTE = 5
MAX_IP_TRACKING_ENTRIES = 5000

def _cleanup_ip_audit_history():
    now = time.time()
    if len(_IP_AUDIT_HISTORY) > 500:
        stale_ips = [
            ip for ip, timestamps in _IP_AUDIT_HISTORY.items()
            if not timestamps or now - timestamps[-1] >= 60.0
        ]
        for ip in stale_ips:
            _IP_AUDIT_HISTORY.pop(ip, None)
    if len(_IP_AUDIT_HISTORY) > MAX_IP_TRACKING_ENTRIES:
        for ip in list(_IP_AUDIT_HISTORY.keys())[:1000]:
            _IP_AUDIT_HISTORY.pop(ip, None)

def _enforce_audit_rate_limit(client_ip: str):
    _cleanup_ip_audit_history()
    now = time.time()
    history = _IP_AUDIT_HISTORY.get(client_ip, [])
    recent = [t for t in history if now - t < 60.0]
    if len(recent) >= MAX_AUDITS_PER_MINUTE:
        _IP_AUDIT_HISTORY[client_ip] = recent
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Hızlı denetim istek kotasına ulaştınız (dakikada maksimum 5 analiz). Lütfen biraz bekleyin."
        )
    recent.append(now)
    _IP_AUDIT_HISTORY[client_ip] = recent

class QuickAuditRequest(BaseModel):
    url: str = Field(..., description="Taranacak ve analiz edilecek web sitesi adresi (örn: https://example.com)")
    max_pages: int = Field(default=5, ge=1, le=50, description="Taranacak maksimum sayfa sayısı")

class IssueDetail(BaseModel):
    rule_id: str
    title: str
    severity: str
    description: str
    recommendation: str

class QuickAuditResponse(BaseModel):
    url: str
    status_code: int
    health_score: int
    page_info: Dict[str, Any]
    issues: List[IssueDetail]
    ai_recommendations: List[Dict[str, Any]]

def _build_knowledge_store() -> HybridKnowledgeStore:
    store = HybridKnowledgeStore()
    for seed in SEED_DOCUMENTS:
        chunks = SemanticChunker.chunk_markdown(seed["content"], seed["title"])
        for idx, c in enumerate(chunks):
            store.add_chunk(chunk_id=f"{seed['id']}-{idx}", document_title=seed["title"], heading_path=c.heading_path, content=c.content, vector=[0.05] * 128, status=seed["status"])
    return store

KNOWLEDGE_STORE = _build_knowledge_store()
AUDIT_CAPACITY = asyncio.Semaphore(4)

@router.post("/quick", response_model=QuickAuditResponse, status_code=status.HTTP_200_OK)
async def perform_quick_site_audit(req: QuickAuditRequest, request: Request):
    """
    Canlı bir web sitesinin URL'sini alarak anında tarar,
    deterministik SEO kurallarını ve AI uzman ajanlarını çalıştırır.
    """
    client_ip = request.client.host if request.client else "unknown"
    _enforce_audit_rate_limit(client_ip)

    try:
        normalized_url = UrlNormalizer.normalize(req.url)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    client = SafeHttpClient(mode="GOOGLEBOT_SIMULATION")

    try:
        async with AUDIT_CAPACITY:
            resp = await client.fetch(normalized_url)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Siteye erişilemedi veya güvenlik kuralı (SSRF) engelledi: {str(e)}"
        )

    extracted = HtmlExtractor.extract(resp.text, resp.final_url) if resp.status_code == 200 else None

    page_context = {
        "url": normalized_url,
        "status_code": resp.status_code,
        "canonical_target": extracted.canonical_url if extracted else None,
        "has_noindex": extracted.has_noindex if extracted else False,
        "title": extracted.title if extracted else None,
        "meta_description": extracted.meta_description if extracted else None,
        "word_count": extracted.word_count if extracted else 0
    }

    # 1. Deterministik Kural Motoru
    engine = SeoRuleEngine()
    audit_results = engine.evaluate_site([page_context])

    # 2. RAG Bilgi Beyni & AI Ajanları
    orchestrator = AiOrchestrator(
        llm_provider=get_llm_provider(),
        knowledge_store=KNOWLEDGE_STORE
    )

    recs = await orchestrator.process_crawl_issues(
        site_id="quick-audit",
        issues=audit_results["issues"],
        pages_by_url={normalized_url: page_context}
    )

    formatted_issues = [
        IssueDetail(
            rule_id=i.rule_id,
            title=i.title,
            severity=i.severity.value,
            description=i.description,
            recommendation=i.recommendation_template
        )
        for i in audit_results["issues"]
    ]

    return QuickAuditResponse(
        url=normalized_url,
        status_code=resp.status_code,
        health_score=audit_results["health_score"],
        page_info={
            "title": extracted.title if extracted else None,
            "meta_description": extracted.meta_description if extracted else None,
            "canonical_url": extracted.canonical_url if extracted else None,
            "word_count": extracted.word_count if extracted else 0,
            "has_noindex": extracted.has_noindex if extracted else False,
            "response_time_ms": resp.response_time_ms
        },
        issues=formatted_issues,
        ai_recommendations=recs
    )
