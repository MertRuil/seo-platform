import uuid
from urllib.parse import urlparse
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from packages.shared.database import get_db
from packages.shared.models import Site, SiteVerification, Membership
from packages.contracts.site import SiteCreateRequest, SiteResponse, SiteVerifyRequest
from services.security.jwt_auth import get_current_user_payload

router = APIRouter(prefix="/organizations/{org_id}/sites", tags=["Sites"])

async def verify_org_membership(org_id: str, user_id: str, db: AsyncSession, required_roles: List[str] = None):
    query = select(Membership).where(
        Membership.organization_id == org_id,
        Membership.user_id == user_id
    )
    if required_roles:
        query = query.where(Membership.role.in_(required_roles))
    result = await db.execute(query)
    membership = result.scalars().first()
    if not membership:
        raise HTTPException(status_code=403, detail="Access denied for this organization")
    return membership

async def verify_site_access(org_id: str, site_id: str, user_id: str, db: AsyncSession, required_roles: List[str] = None):
    await verify_org_membership(org_id, user_id, db, required_roles)
    result = await db.execute(select(Site).where(Site.id == site_id, Site.organization_id == org_id))
    site = result.scalars().first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return site

def normalize_domain_name(url: str) -> tuple[str, str, str]:
    from services.security.ssrf import BLOCKED_HOSTNAMES, is_ip_blocked
    parsed = urlparse(url)
    if parsed.scheme.lower() not in ("http", "https") or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Invalid URL: scheme (http/https) and domain required")
    scheme = parsed.scheme.lower()
    if parsed.username or parsed.password:
        raise HTTPException(status_code=400, detail="URL credentials are not permitted")
    domain = parsed.hostname.lower().rstrip(".")

    # SSRF / Boundary Defense: Reject internal, loopback, and metadata targets
    if (
        domain in BLOCKED_HOSTNAMES
        or domain.endswith(".localhost")
        or domain.endswith(".local")
        or domain.endswith(".internal")
    ):
        raise HTTPException(status_code=400, detail="Loopback, local, or internal domains are not permitted")

    # Check if domain is a direct IP address
    import ipaddress
    try:
        ip = ipaddress.ip_address(domain)
        if is_ip_blocked(str(ip)):
            raise HTTPException(status_code=400, detail="Private or cloud metadata IP addresses are not permitted")
    except ValueError:
        # Check DNS resolution to catch DNS rebinding to private / internal IPs
        from services.security.ssrf import resolve_domain_ips, SSRFSecurityException
        try:
            resolved_ips = resolve_domain_ips(domain)
            for rip in resolved_ips:
                if is_ip_blocked(rip):
                    raise HTTPException(status_code=400, detail="Domain resolves to private or cloud metadata IP address")
        except SSRFSecurityException:
            pass
        except Exception:
            pass

    # Normalized domain: strip 'www.' for identity grouping
    normalized_domain = domain[4:] if domain.startswith("www.") else domain
    return scheme, domain, normalized_domain

@router.post("", response_model=SiteResponse, status_code=status.HTTP_201_CREATED)
async def create_site(
    org_id: str,
    req: SiteCreateRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    await verify_org_membership(org_id, user_id, db, ["OWNER", "ADMIN", "SEO_MANAGER"])

    scheme, domain, normalized_domain = normalize_domain_name(req.primary_url)

    # Check duplicate domain in same org
    existing = await db.execute(
        select(Site).where(
            Site.organization_id == org_id,
            Site.normalized_domain == normalized_domain
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Site with this domain already registered in organization")

    # Sanitize site name (anti-XSS and length limits)
    import re
    safe_name = re.sub(r"(?is)<script.*?>.*?</script>", "", req.name)
    safe_name = re.sub(r"(?is)<style.*?>.*?</style>", "", safe_name)
    safe_name = re.sub(r"<[^>]*>", "", safe_name)
    safe_name = re.sub(r"[\x00-\x1f\x7f-\x9f]", "", safe_name).strip()[:100]
    if not safe_name:
        safe_name = normalized_domain

    site = Site(
        organization_id=org_id,
        name=safe_name,
        domain=domain,
        normalized_domain=normalized_domain,
        primary_url=req.primary_url.rstrip('/'),
        preferred_protocol=scheme,
        site_type=req.site_type,
        language=req.language,
        country=req.country,
        execution_mode=req.execution_mode,
        verification_status='UNVERIFIED'
    )
    db.add(site)
    await db.flush()

    # Generate initial verification record
    verification_token = f"seo-verify-{uuid.uuid4().hex}"
    verification = SiteVerification(
        site_id=site.id,
        method="DNS_TXT",
        token=verification_token,
        status="PENDING"
    )
    db.add(verification)
    await db.commit()
    await db.refresh(site)

    return SiteResponse(
        id=site.id,
        organization_id=site.organization_id,
        name=site.name,
        domain=site.domain,
        normalized_domain=site.normalized_domain,
        primary_url=site.primary_url,
        site_type=site.site_type,
        language=site.language,
        country=site.country,
        execution_mode=site.execution_mode,
        verification_status=site.verification_status
    )

@router.get("", response_model=List[SiteResponse])
async def list_sites(
    org_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    await verify_org_membership(org_id, user_id, db)

    result = await db.execute(select(Site).where(Site.organization_id == org_id))
    sites = result.scalars().all()
    return [
        SiteResponse(
            id=s.id,
            organization_id=s.organization_id,
            name=s.name,
            domain=s.domain,
            normalized_domain=s.normalized_domain,
            primary_url=s.primary_url,
            site_type=s.site_type,
            language=s.language,
            country=s.country,
            execution_mode=s.execution_mode,
            verification_status=s.verification_status
        )
        for s in sites
    ]

@router.get("/{site_id}", response_model=SiteResponse)
async def get_site(
    org_id: str,
    site_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    await verify_org_membership(org_id, user_id, db)

    result = await db.execute(select(Site).where(Site.id == site_id, Site.organization_id == org_id))
    site = result.scalars().first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    return SiteResponse(
        id=site.id,
        organization_id=site.organization_id,
        name=site.name,
        domain=site.domain,
        normalized_domain=site.normalized_domain,
        primary_url=site.primary_url,
        site_type=site.site_type,
        language=site.language,
        country=site.country,
        execution_mode=site.execution_mode,
        verification_status=site.verification_status
    )
