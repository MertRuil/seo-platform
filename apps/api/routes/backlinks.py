"""
Backlink Management, Live Provider Sync (DataForSEO / OpenPageRank / GSC Export / Live HTML Crawl),
Toxic Link Detection, and Site-Scoped Google Disavow API Router.
Strictly ensures backlink profiles and disavow files are scoped to the requesting site's domain.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.routes.sites import verify_site_access
from packages.shared.database import get_db
from services.security.jwt_auth import get_current_user_payload
from services.seo_engine.backlink_engine import (
    AnchorCategory,
    BacklinkDataProvider,
    BacklinkDataSource,
    BacklinkItem,
    ToxicityRisk,
    analyze_backlinks,
    classify_anchor_text,
    evaluate_backlink_toxicity,
    generate_google_disavow_file,
    get_configured_backlink_providers,
)

router = APIRouter(prefix="/organizations/{org_id}/sites/{site_id}/backlinks", tags=["Backlinks & Disavow"])


class BacklinkResponse(BaseModel):
    id: str
    source_url: str
    source_domain: str
    target_url: str
    anchor_text: str
    anchor_category: str
    is_dofollow: bool
    domain_authority: int
    page_authority: int
    spam_score: int
    is_toxic: bool
    toxicity_risk: str
    toxicity_reasons: List[str]
    first_seen: str
    status: str
    data_source: str = "DEMO_SEED"
    verified_live: bool = False
    http_status: Optional[int] = None
    rel_attributes: List[str] = Field(default_factory=list)


class BacklinkSummaryResponse(BaseModel):
    total_backlinks: int
    referring_domains: int
    dofollow_count: int
    nofollow_count: int
    dofollow_ratio: float
    avg_domain_authority: float
    toxic_backlinks_count: int
    toxic_domains_count: int
    toxicity_percentage: float
    overall_toxicity_risk: str
    anchor_distribution: Dict[str, int]
    top_toxic_domains: List[str]
    data_source: str = "DEMO_SEED"
    live_verified_count: int = 0
    providers_configured: List[str] = Field(default_factory=list)


class DisavowResponse(BaseModel):
    has_toxic_links: bool
    target_domain: str
    toxic_domains_count: int
    disavow_text: str
    message: str


class AddBacklinkRequest(BaseModel):
    source_url: str
    anchor_text: str = ""
    is_dofollow: bool = True
    domain_authority: int = Field(default=50, ge=1, le=100)
    spam_score: int = Field(default=0, ge=0, le=100)
    verify_live: bool = False


class ImportGscBacklinksRequest(BaseModel):
    raw_csv_or_urls: str = Field(min_length=3, max_length=100000)
    verify_live: bool = False


class SyncLiveBacklinksRequest(BaseModel):
    verify_existing_html: bool = False
    limit: int = Field(default=25, ge=1, le=100)


class BacklinkSyncResultResponse(BaseModel):
    synced_count: int
    live_verified_count: int
    data_source: str
    providers_configured: List[str]
    message: str
    items: List[BacklinkResponse]
    summary: BacklinkSummaryResponse


# In-memory site-scoped backlink cache to prevent cross-site data leakage
_SITE_BACKLINKS_CACHE: Dict[str, List[BacklinkItem]] = {}


def _serialize_item(b: BacklinkItem) -> BacklinkResponse:
    return BacklinkResponse(
        id=b.id,
        source_url=b.source_url,
        source_domain=b.source_domain,
        target_url=b.target_url,
        anchor_text=b.anchor_text,
        anchor_category=b.anchor_category.value if hasattr(b.anchor_category, "value") else str(b.anchor_category),
        is_dofollow=b.is_dofollow,
        domain_authority=b.domain_authority,
        page_authority=b.page_authority,
        spam_score=b.spam_score,
        is_toxic=b.is_toxic,
        toxicity_risk=b.toxicity_risk.value if hasattr(b.toxicity_risk, "value") else str(b.toxicity_risk),
        toxicity_reasons=b.toxicity_reasons,
        first_seen=b.first_seen,
        status=b.status,
        data_source=getattr(b, "data_source", "DEMO_SEED"),
        verified_live=getattr(b, "verified_live", False),
        http_status=getattr(b, "http_status", None),
        rel_attributes=getattr(b, "rel_attributes", []),
    )


def _serialize_summary(raw_links: List[BacklinkItem]) -> BacklinkSummaryResponse:
    sum_data = analyze_backlinks(raw_links)
    return BacklinkSummaryResponse(
        total_backlinks=sum_data.total_backlinks,
        referring_domains=sum_data.referring_domains,
        dofollow_count=sum_data.dofollow_count,
        nofollow_count=sum_data.nofollow_count,
        dofollow_ratio=sum_data.dofollow_ratio,
        avg_domain_authority=sum_data.avg_domain_authority,
        toxic_backlinks_count=sum_data.toxic_backlinks_count,
        toxic_domains_count=sum_data.toxic_domains_count,
        toxicity_percentage=sum_data.toxicity_percentage,
        overall_toxicity_risk=sum_data.overall_toxicity_risk.value if hasattr(sum_data.overall_toxicity_risk, "value") else str(sum_data.overall_toxicity_risk),
        anchor_distribution=sum_data.anchor_distribution,
        top_toxic_domains=sum_data.top_toxic_domains,
        data_source=sum_data.data_source,
        live_verified_count=sum_data.live_verified_count,
        providers_configured=sum_data.providers_configured,
    )


def _get_or_init_site_backlinks(site_id: str, site_domain: str, primary_url: Optional[str] = None) -> List[BacklinkItem]:
    """
    Returns the isolated backlink list for the specified site.
    Ensures Acme Store links are NEVER returned for AnalyticsHub or other customer sites.
    """
    if site_id in _SITE_BACKLINKS_CACHE:
        return _SITE_BACKLINKS_CACHE[site_id]

    clean_domain = site_domain.replace("https://", "").replace("http://", "").split("/")[0].lower()

    # Demo Site 1: Acme Ecommerce Store (has 3 toxic demo links for testing disavow)
    if clean_domain == "acmestore.io" or site_id == "site-1":
        links = [
            BacklinkItem(
                id="bl-acme-1",
                source_url="https://techcrunch.com/2026/02/top-enterprise-seo-platforms",
                source_domain="techcrunch.com",
                target_url="https://acmestore.io",
                anchor_text="Acme Store Platform",
                anchor_category=AnchorCategory.BRAND,
                is_dofollow=True,
                domain_authority=91,
                page_authority=78,
                spam_score=1,
                is_toxic=False,
                toxicity_risk=ToxicityRisk.CLEAN,
                toxicity_reasons=[],
                first_seen="2026-02-14",
                data_source=BacklinkDataSource.DEMO_SEED.value,
            ),
            BacklinkItem(
                id="bl-acme-2",
                source_url="https://searchengineland.com/geo-ai-search-optimization-guide",
                source_domain="searchengineland.com",
                target_url="https://acmestore.io/geo",
                anchor_text="yapay zeka seo araçları ve geo",
                anchor_category=AnchorCategory.EXACT_MATCH,
                is_dofollow=True,
                domain_authority=86,
                page_authority=71,
                spam_score=2,
                is_toxic=False,
                toxicity_risk=ToxicityRisk.CLEAN,
                toxicity_reasons=[],
                first_seen="2026-03-01",
                data_source=BacklinkDataSource.DEMO_SEED.value,
            ),
            BacklinkItem(
                id="bl-acme-3",
                source_url="https://medium.com/@seoguru/best-ecommerce-practices-2026",
                source_domain="medium.com",
                target_url="https://acmestore.io/blog/ecommerce-seo",
                anchor_text="https://acmestore.io/blog/ecommerce-seo",
                anchor_category=AnchorCategory.NAKED_URL,
                is_dofollow=False,
                domain_authority=82,
                page_authority=54,
                spam_score=3,
                is_toxic=False,
                toxicity_risk=ToxicityRisk.CLEAN,
                toxicity_reasons=[],
                first_seen="2026-03-10",
                data_source=BacklinkDataSource.DEMO_SEED.value,
            ),
            BacklinkItem(
                id="bl-acme-4",
                source_url="https://free-crypto-casino-bonus.xyz/links-list",
                source_domain="free-crypto-casino-bonus.xyz",
                target_url="https://acmestore.io",
                anchor_text="online casino baccarat win free",
                anchor_category=AnchorCategory.EXACT_MATCH,
                is_dofollow=True,
                domain_authority=4,
                page_authority=6,
                spam_score=88,
                is_toxic=True,
                toxicity_risk=ToxicityRisk.CRITICAL,
                toxicity_reasons=["Yüksek riskli spam TLD uzantısı (.xyz)", "Yasaklı kumar/bahis anahtar kelimesi ('casino')"],
                first_seen="2026-03-18",
                data_source=BacklinkDataSource.DEMO_SEED.value,
            ),
            BacklinkItem(
                id="bl-acme-5",
                source_url="https://auto-traffic-pbn.top/directory-scrape",
                source_domain="auto-traffic-pbn.top",
                target_url="https://acmestore.io/products",
                anchor_text="cheap replica watches payday",
                anchor_category=AnchorCategory.EXACT_MATCH,
                is_dofollow=True,
                domain_authority=3,
                page_authority=5,
                spam_score=92,
                is_toxic=True,
                toxicity_risk=ToxicityRisk.CRITICAL,
                toxicity_reasons=["Yüksek riskli PBN uzantısı (.top)", "Yapay link çiftliği tespit edildi"],
                first_seen="2026-03-22",
                data_source=BacklinkDataSource.DEMO_SEED.value,
            ),
            BacklinkItem(
                id="bl-acme-6",
                source_url="https://spambot-linkfarm.click/viagra-cialis",
                source_domain="spambot-linkfarm.click",
                target_url="https://acmestore.io",
                anchor_text="buy viagra online overnight",
                anchor_category=AnchorCategory.EXACT_MATCH,
                is_dofollow=True,
                domain_authority=2,
                page_authority=3,
                spam_score=96,
                is_toxic=True,
                toxicity_risk=ToxicityRisk.CRITICAL,
                toxicity_reasons=["Yüksek riskli şüpheli uzantı (.click)", "Yasaklı spam anahtar kelime ('viagra')"],
                first_seen="2026-03-24",
                data_source=BacklinkDataSource.DEMO_SEED.value,
            ),
        ]
        _SITE_BACKLINKS_CACHE[site_id] = links
        return links

    # Demo Site 2: SaaS Analytics Hub (Clean profile - ZERO toxic backlinks)
    if clean_domain == "analyticshub.com" or site_id == "site-2":
        links = [
            BacklinkItem(
                id="bl-ah-1",
                source_url="https://github.com/topics/saas-analytics",
                source_domain="github.com",
                target_url="https://analyticshub.com",
                anchor_text="SaaS Analytics Hub Platform",
                anchor_category=AnchorCategory.BRAND,
                is_dofollow=True,
                domain_authority=96,
                page_authority=82,
                spam_score=1,
                is_toxic=False,
                toxicity_risk=ToxicityRisk.CLEAN,
                toxicity_reasons=[],
                first_seen="2026-01-15",
                data_source=BacklinkDataSource.DEMO_SEED.value,
            ),
            BacklinkItem(
                id="bl-ah-2",
                source_url="https://producthunt.com/products/analytics-hub",
                source_domain="producthunt.com",
                target_url="https://analyticshub.com",
                anchor_text="Analytics Hub",
                anchor_category=AnchorCategory.BRAND,
                is_dofollow=True,
                domain_authority=91,
                page_authority=76,
                spam_score=1,
                is_toxic=False,
                toxicity_risk=ToxicityRisk.CLEAN,
                toxicity_reasons=[],
                first_seen="2026-02-01",
                data_source=BacklinkDataSource.DEMO_SEED.value,
            ),
            BacklinkItem(
                id="bl-ah-3",
                source_url="https://techradar.com/pro/best-business-intelligence-tools",
                source_domain="techradar.com",
                target_url="https://analyticshub.com/features",
                anchor_text="veri analitiği ve dashboard çözümleri",
                anchor_category=AnchorCategory.PARTIAL_MATCH,
                is_dofollow=True,
                domain_authority=89,
                page_authority=70,
                spam_score=2,
                is_toxic=False,
                toxicity_risk=ToxicityRisk.CLEAN,
                toxicity_reasons=[],
                first_seen="2026-02-18",
                data_source=BacklinkDataSource.DEMO_SEED.value,
            ),
            BacklinkItem(
                id="bl-ah-4",
                source_url="https://capterra.com/p/analyticshub/reviews",
                source_domain="capterra.com",
                target_url="https://analyticshub.com",
                anchor_text="https://analyticshub.com",
                anchor_category=AnchorCategory.NAKED_URL,
                is_dofollow=False,
                domain_authority=84,
                page_authority=58,
                spam_score=2,
                is_toxic=False,
                toxicity_risk=ToxicityRisk.CLEAN,
                toxicity_reasons=[],
                first_seen="2026-03-05",
                data_source=BacklinkDataSource.DEMO_SEED.value,
            ),
            BacklinkItem(
                id="bl-ah-5",
                source_url="https://dev.to/dataarchitect/modern-analytics-architecture-2026",
                source_domain="dev.to",
                target_url="https://analyticshub.com/integrations",
                anchor_text="Analytics Hub REST API",
                anchor_category=AnchorCategory.BRAND,
                is_dofollow=True,
                domain_authority=79,
                page_authority=61,
                spam_score=3,
                is_toxic=False,
                toxicity_risk=ToxicityRisk.CLEAN,
                toxicity_reasons=[],
                first_seen="2026-03-12",
                data_source=BacklinkDataSource.DEMO_SEED.value,
            ),
        ]
        _SITE_BACKLINKS_CACHE[site_id] = links
        return links

    # Müşteri siteleri boş listeyle başlar: gerçek bir bağlantı kaynağı (GSC bağlantı dışa aktarımı,
    # DataForSEO API veya canlı HTML taraması) bağlanana kadar sahte/uydurma bağlantı eklenmez.
    links: List[BacklinkItem] = []
    _SITE_BACKLINKS_CACHE[site_id] = links
    return links


@router.get("", response_model=List[BacklinkResponse])
async def get_site_backlinks(
    org_id: str,
    site_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    """Fetches backlinks strictly belonging to the requested site."""
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db)
    raw_links = _get_or_init_site_backlinks(site_id, site.domain, site.primary_url)
    return [_serialize_item(b) for b in raw_links]


@router.get("/summary", response_model=BacklinkSummaryResponse)
async def get_site_backlink_summary(
    org_id: str,
    site_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    """Calculates summary, toxicity metrics, and data provenance strictly for the requested site."""
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db)
    raw_links = _get_or_init_site_backlinks(site_id, site.domain, site.primary_url)
    return _serialize_summary(raw_links)


@router.get("/disavow", response_model=DisavowResponse)
async def get_site_disavow_file(
    org_id: str,
    site_id: str,
    download: bool = Query(False, description="Returns as raw downloadable .txt file if True"),
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    """
    Generates a site-specific Google Disavow links file.
    STRICT SECURITY: Refuses to output unrelated spam domains from other sites.
    """
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db)
    raw_links = _get_or_init_site_backlinks(site_id, site.domain, site.primary_url)

    clean_domain = site.domain.replace("https://", "").replace("http://", "").split("/")[0].lower()
    toxic_links = [
        b
        for b in raw_links
        if (b.is_toxic or b.toxicity_risk in (ToxicityRisk.HIGH, ToxicityRisk.CRITICAL))
        and clean_domain in b.target_url.lower()
    ]
    toxic_domains = list(set(b.source_domain for b in toxic_links))

    if not toxic_links:
        disavow_text = (
            f"# -------------------------------------------------------------\n"
            f"# Google Search Console - Disavow Links File\n"
            f"# Generated for domain: {clean_domain}\n"
            f"# Status: Clean Profile - No toxic backlinks identified\n"
            f"# Google Search Console advises against disavowing non-existent links.\n"
            f"# -------------------------------------------------------------\n"
        )
        if download:
            return Response(
                content=disavow_text,
                media_type="text/plain; charset=utf-8",
                headers={"Content-Disposition": f"attachment; filename=google_disavow_{clean_domain}.txt"},
            )
        return DisavowResponse(
            has_toxic_links=False,
            target_domain=clean_domain,
            toxic_domains_count=0,
            disavow_text=disavow_text,
            message=f"{site.name} ({clean_domain}) için disavow edilecek zararlı backlink bulunmuyor. Sitenize link vermemiş alan adlarını disavow etmek arama sıralamanıza zarar verebilir.",
        )

    disavow_text = generate_google_disavow_file(raw_links, mode="domain", target_domain=clean_domain)
    if download:
        return Response(
            content=disavow_text,
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename=google_disavow_{clean_domain}.txt"},
        )

    return DisavowResponse(
        has_toxic_links=True,
        target_domain=clean_domain,
        toxic_domains_count=len(toxic_domains),
        disavow_text=disavow_text,
        message=f"{len(toxic_domains)} adet zararlı alan adı için Google Disavow dosyası başarıyla hazırlandı.",
    )


@router.post("", response_model=BacklinkResponse)
async def add_site_backlink(
    org_id: str,
    site_id: str,
    req: AddBacklinkRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    """
    Registers a new external backlink pointing to the specified site,
    optionally verifying the link live on the source HTML page and enriching DA via OpenPageRank.
    """
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db)
    raw_links = _get_or_init_site_backlinks(site_id, site.domain, site.primary_url)

    parsed_source = urlparse(req.source_url)
    source_domain = (parsed_source.netloc or "external-source.com").lower().removeprefix("www.")
    target_url = site.primary_url or f"https://{site.domain}"
    anchor_text = req.anchor_text.strip() or site.name or site.domain
    is_dofollow = req.is_dofollow
    verified_live = False
    http_status: Optional[int] = None
    rel_attributes: List[str] = []
    data_source = BacklinkDataSource.MANUAL_ENTRY.value

    if req.verify_live:
        live_check = await BacklinkDataProvider.verify_backlink_live_on_page(req.source_url, site.domain)
        verified_live = bool(live_check.get("verified_live", False))
        http_status = live_check.get("http_status")
        if verified_live:
            data_source = BacklinkDataSource.LIVE_CRAWL_VERIFIED.value
            if live_check.get("anchor_text"):
                anchor_text = live_check["anchor_text"]
            if live_check.get("target_url"):
                target_url = live_check["target_url"]
            is_dofollow = bool(live_check.get("is_dofollow", True))
            rel_attributes = live_check.get("rel_attributes") or []

    da_score = req.domain_authority
    opr_scores = await BacklinkDataProvider.fetch_openpagerank_scores([source_domain])
    if source_domain in opr_scores:
        da_score = opr_scores[source_domain]
        if data_source == BacklinkDataSource.MANUAL_ENTRY.value:
            data_source = BacklinkDataSource.OPENPAGERANK_ENRICHED.value

    is_toxic, risk, computed_spam, reasons = evaluate_backlink_toxicity(
        source_url=req.source_url,
        anchor_text=anchor_text,
        source_da=da_score,
        source_spam_score=req.spam_score,
    )

    category = classify_anchor_text(anchor_text, site.name, target_url)

    new_item = BacklinkItem(
        id=f"bl-{site_id}-{len(raw_links) + 1}",
        source_url=req.source_url,
        source_domain=source_domain,
        target_url=target_url,
        anchor_text=anchor_text,
        anchor_category=category,
        is_dofollow=is_dofollow,
        domain_authority=da_score,
        page_authority=max(1, da_score - 12),
        spam_score=computed_spam,
        is_toxic=is_toxic,
        toxicity_risk=risk,
        toxicity_reasons=reasons,
        data_source=data_source,
        verified_live=verified_live,
        http_status=http_status,
        rel_attributes=rel_attributes,
    )
    raw_links.insert(0, new_item)
    _SITE_BACKLINKS_CACHE[site_id] = raw_links

    return _serialize_item(new_item)


@router.post("/sync-live", response_model=BacklinkSyncResultResponse)
async def sync_live_site_backlinks(
    org_id: str,
    site_id: str,
    req: SyncLiveBacklinksRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    """
    Synchronizes backlinks from configured live providers (DataForSEO Backlinks API,
    OpenPageRank Authority API, and optional live HTML link verification).
    """
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db)
    raw_links = _get_or_init_site_backlinks(site_id, site.domain, site.primary_url)

    dfs_items = await BacklinkDataProvider.fetch_from_dataforseo(
        target_domain=site.domain,
        brand_name=site.name,
        limit=req.limit,
    )

    existing_urls = {b.source_url for b in raw_links}
    added_count = 0
    for item in dfs_items:
        if item.source_url not in existing_urls:
            raw_links.insert(0, item)
            existing_urls.add(item.source_url)
            added_count += 1

    # Enrich Domain Authority via OpenPageRank if configured
    all_domains = [b.source_domain for b in raw_links]
    opr_scores = await BacklinkDataProvider.fetch_openpagerank_scores(all_domains)
    for b in raw_links:
        if b.source_domain in opr_scores:
            b.domain_authority = opr_scores[b.source_domain]
            b.page_authority = max(1, b.domain_authority - 10)
            if b.data_source == BacklinkDataSource.MANUAL_ENTRY.value:
                b.data_source = BacklinkDataSource.OPENPAGERANK_ENRICHED.value

    # Optionally verify existing links via live HTML crawl
    if req.verify_existing_html:
        for b in raw_links[:10]:
            check = await BacklinkDataProvider.verify_backlink_live_on_page(b.source_url, site.domain)
            if check.get("verified_live"):
                b.verified_live = True
                b.http_status = check.get("http_status", 200)
                b.is_dofollow = bool(check.get("is_dofollow", b.is_dofollow))
                b.rel_attributes = check.get("rel_attributes") or b.rel_attributes
                if b.data_source in (BacklinkDataSource.MANUAL_ENTRY.value, BacklinkDataSource.GSC_LINKS_IMPORT.value):
                    b.data_source = BacklinkDataSource.LIVE_CRAWL_VERIFIED.value

    _SITE_BACKLINKS_CACHE[site_id] = raw_links
    summary_resp = _serialize_summary(raw_links)
    configured = get_configured_backlink_providers()

    if dfs_items:
        msg = f"DataForSEO Live API üzerinden {added_count} yeni canlı backlink çekildi ve toksisite analizi tamamlandı."
    elif opr_scores:
        msg = f"OpenPageRank API üzerinden {len(opr_scores)} alan adının gerçek Domain Otorite (DR) puanları güncellendi."
    elif req.verify_existing_html:
        msg = f"Canlı HTML tarayıcısı ile mevcut bağlantıların kaynak sayfaları denetlendi ({summary_resp.live_verified_count} doğrulanmış bağlantı)."
    else:
        msg = (
            "Canlı üçüncü parti API anahtarı (DATAFORSEO_LOGIN / OPENPAGERANK_API_KEY) tanımlı değil; "
            "mevcut bağlantı profili korundu. GSC CSV içe aktarma veya Canlı HTML Doğrulama modunu kullanabilirsiniz."
        )

    return BacklinkSyncResultResponse(
        synced_count=added_count,
        live_verified_count=summary_resp.live_verified_count,
        data_source=summary_resp.data_source,
        providers_configured=configured,
        message=msg,
        items=[_serialize_item(b) for b in raw_links],
        summary=summary_resp,
    )


@router.post("/import-gsc", response_model=BacklinkSyncResultResponse)
async def import_gsc_site_backlinks(
    org_id: str,
    site_id: str,
    req: ImportGscBacklinksRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    """
    Imports external links exported from Google Search Console (CSV or newline-separated URLs/domains),
    evaluates spam/toxicity signals, and optionally verifies them live on the web.
    """
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db)
    raw_links = _get_or_init_site_backlinks(site_id, site.domain, site.primary_url)

    parsed_items = BacklinkDataProvider.parse_gsc_links_export(
        raw_text_or_lines=req.raw_csv_or_urls,
        target_domain=site.domain,
        brand_name=site.name,
    )

    if req.verify_live:
        for item in parsed_items[:10]:
            check = await BacklinkDataProvider.verify_backlink_live_on_page(item.source_url, site.domain)
            if check.get("verified_live"):
                item.verified_live = True
                item.http_status = check.get("http_status", 200)
                if check.get("anchor_text"):
                    item.anchor_text = check["anchor_text"]
                item.is_dofollow = bool(check.get("is_dofollow", True))
                item.rel_attributes = check.get("rel_attributes") or []
                item.data_source = BacklinkDataSource.LIVE_CRAWL_VERIFIED.value

    existing_urls = {b.source_url for b in raw_links}
    added_count = 0
    for item in reversed(parsed_items):
        if item.source_url not in existing_urls:
            raw_links.insert(0, item)
            existing_urls.add(item.source_url)
            added_count += 1

    _SITE_BACKLINKS_CACHE[site_id] = raw_links
    summary_resp = _serialize_summary(raw_links)

    return BacklinkSyncResultResponse(
        synced_count=added_count,
        live_verified_count=summary_resp.live_verified_count,
        data_source=summary_resp.data_source,
        providers_configured=get_configured_backlink_providers(),
        message=f"Google Search Console dışa aktarımından {added_count} yeni bağlantı başarıyla analiz edilerek eklendi.",
        items=[_serialize_item(b) for b in raw_links],
        summary=summary_resp,
    )
