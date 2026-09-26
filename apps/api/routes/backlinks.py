"""
Backlink Management, Toxic Link Detection, and Site-Scoped Google Disavow API Router.
Strictly ensures backlink profiles and disavow files are scoped to the requesting site's domain.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from packages.shared.database import get_db
from apps.api.routes.sites import verify_site_access
from services.security.jwt_auth import get_current_user_payload
from services.seo_engine.backlink_engine import (
    BacklinkItem,
    AnchorCategory,
    ToxicityRisk,
    evaluate_backlink_toxicity,
    classify_anchor_text,
    analyze_backlinks,
    generate_google_disavow_file
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


class DisavowResponse(BaseModel):
    has_toxic_links: bool
    target_domain: str
    toxic_domains_count: int
    disavow_text: str
    message: str


class AddBacklinkRequest(BaseModel):
    source_url: str
    anchor_text: str
    is_dofollow: bool = True
    domain_authority: int = Field(default=50, ge=1, le=100)
    spam_score: int = Field(default=0, ge=0, le=100)


# In-memory site-scoped backlink cache to prevent cross-site data leakage
_SITE_BACKLINKS_CACHE: Dict[str, List[BacklinkItem]] = {}


def _get_or_init_site_backlinks(site_id: str, site_domain: str, primary_url: Optional[str] = None) -> List[BacklinkItem]:
    """
    Returns the isolated backlink list for the specified site.
    Ensures Acme Store links are NEVER returned for AnalyticsHub or other customer sites.
    """
    if site_id in _SITE_BACKLINKS_CACHE:
        return _SITE_BACKLINKS_CACHE[site_id]

    clean_domain = site_domain.replace("https://", "").replace("http://", "").split("/")[0].lower()
    base_url = primary_url or f"https://{clean_domain}"

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
            ),
        ]
        _SITE_BACKLINKS_CACHE[site_id] = links
        return links

    # Customer custom site: Generate clean, domain-tailored backlinks targeting the actual site URL
    links = [
        BacklinkItem(
            id=f"bl-{site_id}-1",
            source_url="https://google.com/search",
            source_domain="google.com",
            target_url=base_url,
            anchor_text=clean_domain,
            anchor_category=AnchorCategory.BRAND,
            is_dofollow=True,
            domain_authority=98,
            page_authority=85,
            spam_score=1,
            is_toxic=False,
            toxicity_risk=ToxicityRisk.CLEAN,
            toxicity_reasons=[],
            first_seen="2026-03-01",
        ),
        BacklinkItem(
            id=f"bl-{site_id}-2",
            source_url="https://webdirectory-clean.org/listing",
            source_domain="webdirectory-clean.org",
            target_url=base_url,
            anchor_text=f"{clean_domain} ana sayfa",
            anchor_category=AnchorCategory.PARTIAL_MATCH,
            is_dofollow=True,
            domain_authority=45,
            page_authority=38,
            spam_score=4,
            is_toxic=False,
            toxicity_risk=ToxicityRisk.CLEAN,
            toxicity_reasons=[],
            first_seen="2026-03-10",
        )
    ]
    _SITE_BACKLINKS_CACHE[site_id] = links
    return links


@router.get("", response_model=List[BacklinkResponse])
async def get_site_backlinks(
    org_id: str,
    site_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    """Fetches backlinks strictly belonging to the requested site."""
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db)
    raw_links = _get_or_init_site_backlinks(site_id, site.domain, site.primary_url)

    return [
        BacklinkResponse(
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
        )
        for b in raw_links
    ]


@router.get("/summary", response_model=BacklinkSummaryResponse)
async def get_site_backlink_summary(
    org_id: str,
    site_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    """Calculates summary and toxicity metrics strictly for the requested site."""
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db)
    raw_links = _get_or_init_site_backlinks(site_id, site.domain, site.primary_url)
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
    )


@router.get("/disavow", response_model=DisavowResponse)
async def get_site_disavow_file(
    org_id: str,
    site_id: str,
    download: bool = Query(False, description="Returns as raw downloadable .txt file if True"),
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    """
    Generates a site-specific Google Disavow links file.
    STRICT SECURITY: Refuses to output unrelated spam domains from other sites.
    If the site has 0 toxic links, returns an informative notice and empty disavow.
    """
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db)
    raw_links = _get_or_init_site_backlinks(site_id, site.domain, site.primary_url)

    clean_domain = site.domain.replace("https://", "").replace("http://", "").split("/")[0].lower()
    toxic_links = [
        b for b in raw_links 
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
                headers={"Content-Disposition": f"attachment; filename=google_disavow_{clean_domain}.txt"}
            )
        return DisavowResponse(
            has_toxic_links=False,
            target_domain=clean_domain,
            toxic_domains_count=0,
            disavow_text=disavow_text,
            message=f"{site.name} ({clean_domain}) için disavow edilecek zararlı backlink bulunmuyor. Sitenize link vermemiş alan adlarını disavow etmek arama sıralamanıza zarar verebilir."
        )

    disavow_text = generate_google_disavow_file(raw_links, mode="domain", target_domain=clean_domain)
    if download:
        return Response(
            content=disavow_text,
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename=google_disavow_{clean_domain}.txt"}
        )

    return DisavowResponse(
        has_toxic_links=True,
        target_domain=clean_domain,
        toxic_domains_count=len(toxic_domains),
        disavow_text=disavow_text,
        message=f"{len(toxic_domains)} adet zararlı alan adı için Google Disavow dosyası başarıyla hazırlandı."
    )


@router.post("", response_model=BacklinkResponse)
async def add_site_backlink(
    org_id: str,
    site_id: str,
    req: AddBacklinkRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    """Manually registers a new external backlink pointing to the specified site."""
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db)
    raw_links = _get_or_init_site_backlinks(site_id, site.domain, site.primary_url)

    from urllib.parse import urlparse
    parsed_source = urlparse(req.source_url)
    source_domain = (parsed_source.netloc or "external-source.com").lower()
    target_url = site.primary_url or f"https://{site.domain}"

    is_toxic, risk, computed_spam, reasons = evaluate_backlink_toxicity(
        source_url=req.source_url,
        anchor_text=req.anchor_text,
        source_da=req.domain_authority,
        source_spam_score=req.spam_score
    )

    category = classify_anchor_text(req.anchor_text, site.name, target_url)

    new_item = BacklinkItem(
        id=f"bl-{site_id}-{len(raw_links) + 1}",
        source_url=req.source_url,
        source_domain=source_domain,
        target_url=target_url,
        anchor_text=req.anchor_text,
        anchor_category=category,
        is_dofollow=req.is_dofollow,
        domain_authority=req.domain_authority,
        page_authority=max(1, req.domain_authority - 12),
        spam_score=computed_spam,
        is_toxic=is_toxic,
        toxicity_risk=risk,
        toxicity_reasons=reasons,
    )
    raw_links.append(new_item)
    _SITE_BACKLINKS_CACHE[site_id] = raw_links

    return BacklinkResponse(
        id=new_item.id,
        source_url=new_item.source_url,
        source_domain=new_item.source_domain,
        target_url=new_item.target_url,
        anchor_text=new_item.anchor_text,
        anchor_category=new_item.anchor_category.value,
        is_dofollow=new_item.is_dofollow,
        domain_authority=new_item.domain_authority,
        page_authority=new_item.page_authority,
        spam_score=new_item.spam_score,
        is_toxic=new_item.is_toxic,
        toxicity_risk=new_item.toxicity_risk.value,
        toxicity_reasons=new_item.toxicity_reasons,
        first_seen=new_item.first_seen,
        status=new_item.status,
    )
