from fastapi import APIRouter, HTTPException, Request, status
import asyncio
import time
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from services.crawler.safe_client import SafeHttpClient
from services.crawler.html_extractor import HtmlExtractor
from services.crawler.headless_renderer import HeadlessRenderEngine
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

from services.security.rate_limiter import quick_audit_limiter
from fastapi import Depends

KNOWLEDGE_STORE = _build_knowledge_store()
AUDIT_CAPACITY = asyncio.Semaphore(4)

@router.post("/quick", response_model=QuickAuditResponse, status_code=status.HTTP_200_OK, dependencies=[Depends(quick_audit_limiter)])
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

    html_to_parse = resp.text
    if resp.status_code == 200:
        try:
            spa_profile = HeadlessRenderEngine.detect_spa_profile(resp.text)
            if spa_profile.is_spa:
                rendered_html, _, _ = await HeadlessRenderEngine.render_and_reconcile(resp.final_url, resp.text)
                html_to_parse = rendered_html
        except Exception:
            pass

    extracted = HtmlExtractor.extract(html_to_parse, resp.final_url, response_headers=dict(resp.headers) if resp.headers else None) if resp.status_code == 200 else None
    h1_val = (extracted.headings.get("h1", [None])[0] if (extracted and extracted.headings.get("h1")) else None)

    page_context = {
        "url": normalized_url,
        "status_code": resp.status_code,
        "canonical_target": extracted.canonical_url if extracted else (resp.redirect_chain[0].to_url if resp.redirect_chain else None),
        "has_noindex": extracted.has_noindex if extracted else False,
        "title": extracted.title if extracted else None,
        "all_titles": extracted.all_titles if extracted else [],
        "meta_description": extracted.meta_description if extracted else None,
        "all_meta_descriptions": extracted.all_meta_descriptions if extracted else [],
        "h1": h1_val,
        "headings": extracted.headings if extracted else {},
        "viewport": extracted.viewport if extracted else None,
        "is_responsive_viewport": extracted.is_responsive_viewport if extracted else False,
        "has_fixed_viewport_width": extracted.has_fixed_viewport_width if extracted else False,
        "prevents_user_scalable": extracted.prevents_user_scalable if extracted else False,
        "mobile_alternate_url": extracted.mobile_alternate_url if extracted else None,
        "has_vary_user_agent": extracted.has_vary_user_agent if extracted else False,
        "headers": dict(resp.headers) if resp.headers else {},
        "structured_data": extracted.structured_data if extracted else [],
        "schema_types": extracted.schema_types if extracted else [],
        "schema_syntax_errors": extracted.schema_syntax_errors if extracted else [],
        "html_lang": extracted.html_lang if extracted else None,
        "hreflangs": extracted.hreflangs if extracted else [],
        "internal_links": [
            {"href": l.href, "anchor_text": l.anchor_text, "rel": l.rel}
            for l in (extracted.links if extracted else [])
            if l.is_internal
        ],
        "word_count": extracted.word_count if extracted else 0,
        "redirect_chain": resp.redirect_chain,
        "is_redirect_loop": resp.is_redirect_loop,
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

    is_mobile_ok = bool(extracted and extracted.viewport and extracted.is_responsive_viewport and not extracted.has_fixed_viewport_width)

    return QuickAuditResponse(
        url=normalized_url,
        status_code=resp.status_code,
        health_score=audit_results["health_score"],
        page_info={
            "title": extracted.title if extracted else None,
            "all_titles": extracted.all_titles if extracted else [],
            "meta_description": extracted.meta_description if extracted else None,
            "all_meta_descriptions": extracted.all_meta_descriptions if extracted else [],
            "h1": h1_val,
            "canonical_url": extracted.canonical_url if extracted else None,
            "word_count": extracted.word_count if extracted else 0,
            "has_noindex": extracted.has_noindex if extracted else False,
            "response_time_ms": resp.response_time_ms,
            "viewport": extracted.viewport if extracted else None,
            "is_mobile_friendly": is_mobile_ok,
            "structured_data": extracted.structured_data if extracted else [],
            "schema_types": extracted.schema_types if extracted else [],
            "has_structured_data": bool(extracted and (extracted.structured_data or extracted.schema_types)),
            "html_lang": extracted.html_lang if extracted else None,
            "hreflangs": extracted.hreflangs if extracted else [],
            "has_hreflang": bool(extracted and extracted.hreflangs)
        },
        issues=formatted_issues,
        ai_recommendations=recs
    )
