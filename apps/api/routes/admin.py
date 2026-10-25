"""
Platform yönetim uçları (/api/v1/admin). Yalnızca veritabanında is_platform_admin olan aktif kullanıcılara açıktır.
Her yazma işlemi audit_logs tablosuna önceki ve sonraki durumuyla kaydedilir.
"""
import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from packages.config.settings import settings
from packages.shared.database import get_db
from packages.shared.models import (
    AuditLog, BillingEvent, CrawlRun, CreditLedger, Invoice, Membership, Organization,
    Plan, PlanPrice, Site, Subscription, UsageCounter, UsageEvent, User,
)
from services.accounts.provisioning import create_owned_organization
from services.agents.base import model_for
from services.billing.entitlements import EntitlementGuard
from services.billing.usage import UsageService
from services.security.admin_guard import require_platform_admin
from services.security.jwt_auth import invalidate_user_auth_cache

router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_platform_admin)])

ROLE_PATTERN = r"^(OWNER|ADMIN|SEO_MANAGER|EDITOR|VIEWER)$"
USAGE_METRICS = ("pages_crawled", "auto_fixes", "ai_credits", "ai_tokens")
# Aylık yinelenen gelire giren abonelik durumları; deneme, duraklatılmış ve iptal edilmiş olanlar girmez.
MRR_STATUSES = ("ACTIVE", "PAST_DUE")


class UserUpdateRequest(BaseModel):
    is_active: Optional[bool] = None
    is_platform_admin: Optional[bool] = None


class OrganizationCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    owner_email: str = Field(..., min_length=3, max_length=255)
    slug: Optional[str] = Field(None, pattern=r"^[a-z0-9][a-z0-9-]{1,47}$")


class MemberAddRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    role: str = Field("VIEWER", pattern=ROLE_PATTERN)


class MemberUpdateRequest(BaseModel):
    role: str = Field(..., pattern=ROLE_PATTERN)


class PlanChangeRequest(BaseModel):
    plan_code: str = Field(..., min_length=1, max_length=50)
    reason: str = Field(..., min_length=5, max_length=500)


class CreditGrantRequest(BaseModel):
    amount: int = Field(..., gt=0, le=1_000_000)
    reason: str = Field(..., min_length=5, max_length=500)


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    # SQLite saat dilimi bilgisini kaybediyor; karşılaştırmalar için UTC kabul edilir.
    return dt.replace(tzinfo=timezone.utc) if dt and dt.tzinfo is None else dt


def _iso(dt: Optional[datetime]) -> Optional[str]:
    # Bölgesiz zaman tarayıcıda yerel saat sanılır; her zaman UTC işaretiyle döner.
    return _aware(dt).isoformat() if dt else None


async def _paginate(db: AsyncSession, query, page: int, page_size: int):
    total = (await db.execute(select(func.count()).select_from(query.order_by(None).subquery()))).scalar_one()
    rows = (await db.execute(query.offset((page - 1) * page_size).limit(page_size))).all()
    return total, rows


async def _audit(
    db: AsyncSession, request: Request, admin: User, action: str, resource_type: str, resource_id: str,
    before: Any = None, after: Any = None, org_id: Optional[str] = None,
) -> None:
    db.add(AuditLog(
        organization_id=org_id,
        user_id=admin.id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        state_before=json.dumps(before, ensure_ascii=False) if before is not None else None,
        state_after=json.dumps(after, ensure_ascii=False) if after is not None else None,
        ip_address=request.client.host if request.client else None,
    ))


def _monthly_price(prices: List[PlanPrice]) -> Optional[Dict[str, Any]]:
    """Abonelikte fatura dönemi tutulmadığı için liste fiyatı esas alınır: aylık fiyat, yoksa yıllık / 12."""
    active = [p for p in prices if p.active and (p.region in (None, "", "GLOBAL"))] or [p for p in prices if p.active]
    monthly = next((p for p in active if p.interval == "month"), None)
    if monthly:
        return {"amount_minor": monthly.amount_minor, "currency": monthly.currency}
    yearly = next((p for p in active if p.interval == "year"), None)
    if yearly:
        return {"amount_minor": round(yearly.amount_minor / 12), "currency": yearly.currency}
    return None


async def _prices_by_plan(db: AsyncSession) -> Dict[str, List[PlanPrice]]:
    prices: Dict[str, List[PlanPrice]] = {}
    for p in (await db.execute(select(PlanPrice))).scalars().all():
        prices.setdefault(p.plan_id, []).append(p)
    return prices


async def _user_or_404(db: AsyncSession, user_id: str) -> User:
    user = (await db.execute(select(User).where(User.id == user_id))).scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
    return user


async def _org_or_404(db: AsyncSession, org_id: str) -> Organization:
    org = (await db.execute(select(Organization).where(Organization.id == org_id))).scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organizasyon bulunamadı.")
    return org


async def _user_by_email(db: AsyncSession, email: str) -> User:
    user = (await db.execute(select(User).where(User.email == email.strip().lower()))).scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Bu e-posta adresiyle kayıtlı kullanıcı yok.")
    return user


async def _other_active_admins(db: AsyncSession, user_id: str) -> int:
    return (await db.execute(
        select(func.count(User.id)).where(User.is_platform_admin.is_(True), User.is_active.is_(True), User.id != user_id)
    )).scalar_one()


async def _other_owners(db: AsyncSession, org_id: str, user_id: str) -> int:
    return (await db.execute(
        select(func.count(Membership.id)).where(
            Membership.organization_id == org_id, Membership.role == "OWNER", Membership.user_id != user_id
        )
    )).scalar_one()


async def _membership_or_404(db: AsyncSession, org_id: str, user_id: str) -> Membership:
    m = (await db.execute(
        select(Membership).where(Membership.organization_id == org_id, Membership.user_id == user_id)
    )).scalars().first()
    if not m:
        raise HTTPException(status_code=404, detail="Kullanıcı bu organizasyonun üyesi değil.")
    return m


def _audit_row(log: AuditLog, email: Optional[str], org_name: Optional[str]) -> Dict[str, Any]:
    return {
        "id": log.id,
        "created_at": _iso(log.created_at),
        "user_id": log.user_id,
        "user_email": email,
        "organization_id": log.organization_id,
        "organization_name": org_name,
        "site_id": log.site_id,
        "action": log.action,
        "resource_type": log.resource_type,
        "resource_id": log.resource_id,
        "state_before": log.state_before,
        "state_after": log.state_after,
        "ip_address": log.ip_address,
    }


def _audit_query():
    return (
        select(AuditLog, User.email, Organization.name)
        .outerjoin(User, User.id == AuditLog.user_id)
        .outerjoin(Organization, Organization.id == AuditLog.organization_id)
        .order_by(AuditLog.created_at.desc(), AuditLog.id)
    )


# ---------- Genel bakış ----------

async def _billing_summary(db: AsyncSession) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    since = now - timedelta(days=30)

    subs = (await db.execute(select(Subscription))).scalars().all()
    prices_by_plan = await _prices_by_plan(db)

    mrr: Dict[str, int] = {}
    past_due = new_paid = canceled = 0
    for s in subs:
        price = _monthly_price(prices_by_plan.get(s.plan_id, []))
        paid_plan = bool(price and price["amount_minor"] > 0)
        if s.status in MRR_STATUSES and paid_plan:
            mrr[price["currency"]] = mrr.get(price["currency"], 0) + price["amount_minor"]
        if s.status == "PAST_DUE":
            past_due += 1
        if paid_plan and s.status in ("ACTIVE", "PAST_DUE") and (_aware(s.created_at) or now) >= since:
            new_paid += 1
        if s.canceled_at and _aware(s.canceled_at) >= since:
            canceled += 1

    collected: Dict[str, int] = {}
    paid_rows = (await db.execute(
        select(Invoice.currency, func.sum(Invoice.total_minor))
        .where(Invoice.status == "PAID", Invoice.paid_at >= month_start)
        .group_by(Invoice.currency)
    )).all()
    for currency, total in paid_rows:
        collected[currency] = int(total or 0)

    return {
        "basis": "list_price",
        "mrr_minor": mrr,
        "collected_this_month_minor": collected,
        "past_due": past_due,
        "new_paid_last_30_days": new_paid,
        "canceled_last_30_days": canceled,
    }


@router.get("/overview")
async def overview(db: AsyncSession = Depends(get_db)):
    since = datetime.now(timezone.utc) - timedelta(days=7)
    users_total = (await db.execute(select(func.count(User.id)))).scalar_one()
    users_active = (await db.execute(select(func.count(User.id)).where(User.is_active.is_(True)))).scalar_one()
    orgs = (await db.execute(select(func.count(Organization.id)))).scalar_one()
    sites = (await db.execute(select(func.count(Site.id)))).scalar_one()
    crawls = (await db.execute(select(func.count(CrawlRun.id)).where(CrawlRun.created_at >= since))).scalar_one()
    crawls_failed = (await db.execute(
        select(func.count(CrawlRun.id)).where(CrawlRun.created_at >= since, CrawlRun.status == "FAILED")
    )).scalar_one()

    plan_rows = (await db.execute(
        select(Plan.code, func.count(Subscription.id)).join(Subscription, Subscription.plan_id == Plan.id).group_by(Plan.code)
    )).all()
    plans = {code: count for code, count in plan_rows}
    without = orgs - sum(plans.values())
    if without > 0:
        plans["none"] = without

    recent = (await db.execute(_audit_query().where(AuditLog.action.like("admin.%")).limit(10))).all()
    return {
        "users": {"total": users_total, "active": users_active},
        "organizations": orgs,
        "sites": sites,
        "crawls_last_7_days": {"total": crawls, "failed": crawls_failed},
        "plans": plans,
        "billing": await _billing_summary(db),
        "recent_admin_actions": [_audit_row(*r) for r in recent],
    }


@router.get("/system")
async def system_status(db: AsyncSession = Depends(get_db)):
    """Bileşenlerin yapılandırılıp yapılandırılmadığını döner; hiçbir anahtar veya bağlantı değeri döndürmez."""
    try:
        await db.execute(text("SELECT 1"))
        database = True
    except Exception:
        database = False

    redis_ok = False
    try:
        from redis.asyncio import Redis
        client = Redis.from_url(settings.REDIS_URL, socket_connect_timeout=1, socket_timeout=1)
        try:
            redis_ok = bool(await client.ping())
        finally:
            await client.aclose()
    except Exception:
        redis_ok = False

    provider = (settings.LLM_PROVIDER or "").lower()
    key_field = {"google": "GOOGLE_API_KEY", "openai": "OPENAI_API_KEY", "anthropic": "ANTHROPIC_API_KEY", "claude": "ANTHROPIC_API_KEY"}.get(provider)
    return {
        "environment": settings.ENVIRONMENT,
        "database": database,
        "redis": redis_ok,
        "queue": "redis" if redis_ok else ("unavailable" if settings.is_production_like else "in_process"),
        "llm": {
            "provider": provider or None,
            "model": model_for(provider) if provider in ("google", "openai", "anthropic", "claude") else None,
            "api_key_configured": bool(key_field and getattr(settings, key_field, None)),
        },
        "smtp_configured": bool(settings.SMTP_HOST),
        # Paddle sağlayıcısıyla aynı kaynak: settings.
        "payments_configured": bool(settings.PADDLE_API_KEY and settings.PADDLE_WEBHOOK_SECRET),
    }


# ---------- Kullanıcılar ----------

@router.get("/users")
async def list_users(
    q: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status", pattern="^(active|inactive)$"),
    admin: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    query = select(User).order_by(User.created_at.desc(), User.id)
    if q:
        needle = q.strip().lower()
        query = query.where(or_(
            func.lower(User.email).contains(needle, autoescape=True),
            func.lower(func.coalesce(User.full_name, "")).contains(needle, autoescape=True),
        ))
    if status_filter:
        query = query.where(User.is_active.is_(status_filter == "active"))
    if admin is not None:
        query = query.where(User.is_platform_admin.is_(admin))

    total, rows = await _paginate(db, query, page, page_size)
    users = [r[0] for r in rows]
    memberships: Dict[str, List[Dict[str, str]]] = {u.id: [] for u in users}
    if users:
        for m, org_name in (await db.execute(
            select(Membership, Organization.name)
            .join(Organization, Organization.id == Membership.organization_id)
            .where(Membership.user_id.in_(memberships.keys()))
            .order_by(Membership.created_at)
        )).all():
            memberships[m.user_id].append({"organization_id": m.organization_id, "organization_name": org_name, "role": m.role})

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [{
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "is_active": u.is_active,
            "is_platform_admin": u.is_platform_admin,
            "created_at": _iso(u.created_at),
            "last_login_at": _iso(u.last_login_at),
            "memberships": memberships[u.id],
        } for u in users],
    }


@router.get("/users/{user_id}")
async def get_user(user_id: str, db: AsyncSession = Depends(get_db)):
    user = await _user_or_404(db, user_id)
    rows = (await db.execute(
        select(Membership, Organization.name)
        .join(Organization, Organization.id == Membership.organization_id)
        .where(Membership.user_id == user_id)
        .order_by(Membership.created_at)
    )).all()
    owned_org_ids = [m.organization_id for m, _ in rows if m.role == "OWNER"]
    sites = (await db.execute(select(Site).where(Site.organization_id.in_(owned_org_ids)).order_by(Site.created_at))).scalars().all() if owned_org_ids else []
    logs = (await db.execute(
        _audit_query().where(or_(AuditLog.user_id == user_id, (AuditLog.resource_type == "user") & (AuditLog.resource_id == user_id))).limit(20)
    )).all()
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "is_active": user.is_active,
        "is_platform_admin": user.is_platform_admin,
        "created_at": _iso(user.created_at),
        "last_login_at": _iso(user.last_login_at),
        "memberships": [{"organization_id": m.organization_id, "organization_name": name, "role": m.role, "created_at": _iso(m.created_at)} for m, name in rows],
        "owned_sites": [{"id": s.id, "organization_id": s.organization_id, "name": s.name, "domain": s.normalized_domain} for s in sites],
        "audit": [_audit_row(*r) for r in logs],
    }


@router.patch("/users/{user_id}")
async def update_user(
    user_id: str, req: UserUpdateRequest, request: Request,
    admin: User = Depends(require_platform_admin), db: AsyncSession = Depends(get_db),
):
    user = await _user_or_404(db, user_id)
    before = {"is_active": user.is_active, "is_platform_admin": user.is_platform_admin}
    after = {
        "is_active": user.is_active if req.is_active is None else req.is_active,
        "is_platform_admin": user.is_platform_admin if req.is_platform_admin is None else req.is_platform_admin,
    }
    if after == before:
        return {"id": user.id, **before}

    if user.id == admin.id and (not after["is_active"] or not after["is_platform_admin"]):
        raise HTTPException(status_code=400, detail="Kendi hesabınızı pasife alamaz veya yöneticiliğinizi kaldıramazsınız.")
    losing_admin = before["is_platform_admin"] and before["is_active"] and not (after["is_platform_admin"] and after["is_active"])
    if losing_admin and await _other_active_admins(db, user.id) == 0:
        raise HTTPException(status_code=400, detail="Son platform yöneticisi kaldırılamaz.")

    user.is_active = after["is_active"]
    user.is_platform_admin = after["is_platform_admin"]
    await _audit(db, request, admin, "admin.user.update", "user", user.id, before, after)
    await db.commit()
    invalidate_user_auth_cache(user.id)
    return {"id": user.id, **after}


# ---------- Organizasyonlar ----------

async def _subscription_map(db: AsyncSession, org_ids: List[str]) -> Dict[str, Subscription]:
    if not org_ids:
        return {}
    subs = (await db.execute(
        select(Subscription).where(Subscription.organization_id.in_(org_ids))
        .options(selectinload(Subscription.plan).selectinload(Plan.limits))
    )).scalars().all()
    return {s.organization_id: s for s in subs}


async def _current_usage(db: AsyncSession, org_ids: List[str]) -> Dict[str, Dict[str, int]]:
    """Bu dönemin sayaçları; okurken sayaç oluşturmaz (UsageService.get_usage oluşturur)."""
    if not org_ids:
        return {}
    period_start, _ = UsageService.get_current_period()
    rows = (await db.execute(
        select(UsageCounter.organization_id, UsageCounter.metric, UsageCounter.used)
        .where(UsageCounter.organization_id.in_(org_ids), UsageCounter.period_start == period_start)
    )).all()
    usage: Dict[str, Dict[str, int]] = {}
    for org_id, metric, used in rows:
        usage.setdefault(org_id, {})[metric] = used
    return usage


def _limits(sub: Optional[Subscription], org: Organization) -> Dict[str, Optional[int]]:
    limits: Dict[str, Optional[int]] = {m: None for m in USAGE_METRICS}
    if sub and sub.plan:
        for limit in sub.plan.limits:
            if limit.metric in limits:
                limits[limit.metric] = limit.hard_limit
    limits["ai_tokens"] = org.monthly_token_budget
    return limits


@router.get("/organizations")
async def list_organizations(
    q: Optional[str] = None,
    plan: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    query = select(Organization).order_by(Organization.created_at.desc(), Organization.id)
    if q:
        needle = q.strip().lower()
        query = query.where(or_(
            func.lower(Organization.name).contains(needle, autoescape=True),
            func.lower(Organization.slug).contains(needle, autoescape=True),
        ))
    if plan:
        query = query.join(Subscription, Subscription.organization_id == Organization.id).join(Plan, Plan.id == Subscription.plan_id).where(Plan.code == plan)

    total, rows = await _paginate(db, query, page, page_size)
    orgs = [r[0] for r in rows]
    ids = [o.id for o in orgs]
    members = dict((await db.execute(select(Membership.organization_id, func.count(Membership.id)).where(Membership.organization_id.in_(ids)).group_by(Membership.organization_id))).all()) if ids else {}
    site_counts = dict((await db.execute(select(Site.organization_id, func.count(Site.id)).where(Site.organization_id.in_(ids)).group_by(Site.organization_id))).all()) if ids else {}
    subs = await _subscription_map(db, ids)
    usage = await _current_usage(db, ids)

    items = []
    for o in orgs:
        sub = subs.get(o.id)
        limits = _limits(sub, o)
        items.append({
            "id": o.id,
            "name": o.name,
            "slug": o.slug,
            "plan_code": sub.plan.code if sub and sub.plan else None,
            "plan_name": sub.plan.name if sub and sub.plan else None,
            "subscription_status": sub.status if sub else None,
            "member_count": members.get(o.id, 0),
            "site_count": site_counts.get(o.id, 0),
            "ai_credits": {"used": usage.get(o.id, {}).get("ai_credits", 0), "limit": limits["ai_credits"]},
            "created_at": _iso(o.created_at),
        })
    return {"total": total, "page": page, "page_size": page_size, "items": items}


@router.post("/organizations", status_code=status.HTTP_201_CREATED)
async def create_organization(
    req: OrganizationCreateRequest, request: Request,
    admin: User = Depends(require_platform_admin), db: AsyncSession = Depends(get_db),
):
    owner = await _user_by_email(db, req.owner_email)
    if req.slug and (await db.execute(select(Organization.id).where(Organization.slug == req.slug))).first():
        raise HTTPException(status_code=409, detail="Bu kısa ad (slug) kullanılıyor.")
    org = await create_owned_organization(db, owner.id, req.name.strip(), slug=req.slug)
    await _audit(db, request, admin, "admin.org.create", "organization", org.id,
                 after={"name": org.name, "slug": org.slug, "owner_id": owner.id}, org_id=org.id)
    await db.commit()
    await EntitlementGuard.get_or_create_subscription(db, org.id)
    return {"id": org.id, "name": org.name, "slug": org.slug, "owner_id": owner.id}


@router.get("/organizations/{org_id}")
async def get_organization(org_id: str, db: AsyncSession = Depends(get_db)):
    org = await _org_or_404(db, org_id)
    members = (await db.execute(
        select(Membership, User.email, User.full_name)
        .join(User, User.id == Membership.user_id)
        .where(Membership.organization_id == org_id)
        .order_by(Membership.created_at)
    )).all()
    sites = (await db.execute(select(Site).where(Site.organization_id == org_id).order_by(Site.created_at))).scalars().all()
    last_crawls: Dict[str, CrawlRun] = {}
    if sites:
        for run in (await db.execute(
            select(CrawlRun).where(CrawlRun.site_id.in_([s.id for s in sites])).order_by(CrawlRun.created_at.desc())
        )).scalars().all():
            last_crawls.setdefault(run.site_id, run)
    sub = (await _subscription_map(db, [org_id])).get(org_id)
    usage = (await _current_usage(db, [org_id])).get(org_id, {})
    limits = _limits(sub, org)

    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "created_at": _iso(org.created_at),
        "members": [{"user_id": m.user_id, "email": email, "full_name": name, "role": m.role, "created_at": _iso(m.created_at)} for m, email, name in members],
        "sites": [{
            "id": s.id,
            "name": s.name,
            "domain": s.normalized_domain,
            "verification_status": s.verification_status,
            "last_crawl": {
                "id": last_crawls[s.id].id,
                "status": last_crawls[s.id].status,
                "created_at": _iso(last_crawls[s.id].created_at),
                "finished_at": _iso(last_crawls[s.id].finished_at),
            } if s.id in last_crawls else None,
        } for s in sites],
        "subscription": {
            "plan_code": sub.plan.code if sub.plan else None,
            "plan_name": sub.plan.name if sub.plan else None,
            "status": sub.status,
            "provider": sub.provider,
            "current_period_end": _iso(sub.current_period_end),
            "trial_ends_at": _iso(sub.trial_ends_at),
        } if sub else None,
        "usage": {m: {"used": usage.get(m, 0), "limit": limits[m]} for m in USAGE_METRICS},
        "ai_credit_balance": await UsageService.get_credit_balance(db, org_id),
        "tokens": {"used_this_month": usage.get("ai_tokens", 0), "monthly_budget": org.monthly_token_budget},
    }


@router.post("/organizations/{org_id}/members", status_code=status.HTTP_201_CREATED)
async def add_member(
    org_id: str, req: MemberAddRequest, request: Request,
    admin: User = Depends(require_platform_admin), db: AsyncSession = Depends(get_db),
):
    await _org_or_404(db, org_id)
    user = await _user_by_email(db, req.email)
    exists = (await db.execute(select(Membership.id).where(Membership.organization_id == org_id, Membership.user_id == user.id))).first()
    if exists:
        raise HTTPException(status_code=409, detail="Kullanıcı zaten bu organizasyonun üyesi.")
    db.add(Membership(user_id=user.id, organization_id=org_id, role=req.role))
    await _audit(db, request, admin, "admin.member.add", "membership", user.id, after={"role": req.role}, org_id=org_id)
    await db.commit()
    return {"organization_id": org_id, "user_id": user.id, "email": user.email, "role": req.role}


@router.patch("/organizations/{org_id}/members/{user_id}")
async def update_member(
    org_id: str, user_id: str, req: MemberUpdateRequest, request: Request,
    admin: User = Depends(require_platform_admin), db: AsyncSession = Depends(get_db),
):
    m = await _membership_or_404(db, org_id, user_id)
    if m.role == req.role:
        return {"organization_id": org_id, "user_id": user_id, "role": m.role}
    if m.role == "OWNER" and await _other_owners(db, org_id, user_id) == 0:
        raise HTTPException(status_code=400, detail="Organizasyonun son sahibinin rolü değiştirilemez; önce başka bir sahip ekleyin.")
    before = {"role": m.role}
    m.role = req.role
    await _audit(db, request, admin, "admin.member.update", "membership", user_id, before, {"role": req.role}, org_id=org_id)
    await db.commit()
    return {"organization_id": org_id, "user_id": user_id, "role": req.role}


@router.delete("/organizations/{org_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    org_id: str, user_id: str, request: Request,
    admin: User = Depends(require_platform_admin), db: AsyncSession = Depends(get_db),
):
    m = await _membership_or_404(db, org_id, user_id)
    if m.role == "OWNER" and await _other_owners(db, org_id, user_id) == 0:
        raise HTTPException(status_code=400, detail="Organizasyonun son sahibi çıkarılamaz; önce başka bir sahip ekleyin.")
    await _audit(db, request, admin, "admin.member.remove", "membership", user_id, before={"role": m.role}, org_id=org_id)
    await db.delete(m)
    await db.commit()


@router.post("/organizations/{org_id}/plan")
async def change_plan(
    org_id: str, req: PlanChangeRequest, request: Request,
    admin: User = Depends(require_platform_admin), db: AsyncSession = Depends(get_db),
):
    await _org_or_404(db, org_id)
    plan = (await db.execute(
        select(Plan).where(Plan.code == req.plan_code.lower()).options(selectinload(Plan.limits), selectinload(Plan.features))
    )).scalars().first()
    if not plan:
        raise HTTPException(status_code=404, detail=f"'{req.plan_code}' kodlu plan bulunamadı.")
    current = await EntitlementGuard.get_or_create_subscription(db, org_id)
    before = {"plan_code": current.plan.code if current.plan else None, "status": current.status, "provider": current.provider}
    # Önce kayıt: switch_plan commit ediyor, denetim satırı aynı işlemde yazılır.
    await _audit(db, request, admin, "admin.plan.change", "subscription", current.id, before,
                 {"plan_code": plan.code, "status": "ACTIVE", "provider": "MANUAL", "reason": req.reason}, org_id=org_id)
    sub = await EntitlementGuard.switch_plan(db, org_id, plan, provider="MANUAL")
    return {"organization_id": org_id, "plan_code": plan.code, "status": sub.status, "provider": sub.provider}


@router.post("/organizations/{org_id}/credits")
async def grant_credits(
    org_id: str, req: CreditGrantRequest, request: Request,
    admin: User = Depends(require_platform_admin), db: AsyncSession = Depends(get_db),
):
    await _org_or_404(db, org_id)
    before = await UsageService.get_credit_balance(db, org_id)
    await _audit(db, request, admin, "admin.credits.grant", "credits", org_id,
                 {"balance": before}, {"balance": before + req.amount, "amount": req.amount, "reason": req.reason}, org_id=org_id)
    balance = await UsageService.grant_credits(db, org_id, req.amount, reason="MANUAL", ref_id=f"admin:{admin.id}")
    return {"organization_id": org_id, "balance": balance}


# ---------- Ödemeler ----------

@router.get("/plans")
async def list_plans(db: AsyncSession = Depends(get_db)):
    # Elle plan atamada herkese açık olmayan planlar (enterprise gibi) da seçilebilir.
    plans = (await db.execute(select(Plan).order_by(Plan.sort_order, Plan.code))).scalars().all()
    prices = await _prices_by_plan(db)
    return [{"code": p.code, "name": p.name, "is_public": p.is_public, "monthly_price": _monthly_price(prices.get(p.id, []))} for p in plans]


@router.get("/billing/summary")
async def billing_summary(db: AsyncSession = Depends(get_db)):
    return await _billing_summary(db)


@router.get("/billing/subscriptions")
async def list_subscriptions(
    status_filter: Optional[str] = Query(None, alias="status"),
    plan: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Subscription, Organization.name, Plan.code, Plan.name)
        .join(Organization, Organization.id == Subscription.organization_id)
        .join(Plan, Plan.id == Subscription.plan_id)
        .order_by(Subscription.created_at.desc(), Subscription.id)
    )
    if status_filter:
        query = query.where(Subscription.status == status_filter.upper())
    if plan:
        query = query.where(Plan.code == plan)
    total, rows = await _paginate(db, query, page, page_size)
    prices_by_plan = await _prices_by_plan(db)
    return {"total": total, "page": page, "page_size": page_size, "items": [{
        "id": s.id,
        "organization_id": s.organization_id,
        "organization_name": org_name,
        "plan_code": code,
        "plan_name": name,
        "status": s.status,
        "provider": s.provider,
        "current_period_end": _iso(s.current_period_end),
        "trial_ends_at": _iso(s.trial_ends_at),
        "cancel_at_period_end": s.cancel_at_period_end,
        "monthly_price": _monthly_price(prices_by_plan.get(s.plan_id, [])),
        "created_at": _iso(s.created_at),
    } for s, org_name, code, name in rows]}


@router.get("/billing/invoices")
async def list_invoices(
    status_filter: Optional[str] = Query(None, alias="status"),
    date_from: Optional[datetime] = Query(None, alias="from"),
    date_to: Optional[datetime] = Query(None, alias="to"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Invoice, Organization.name)
        .join(Organization, Organization.id == Invoice.organization_id)
        .order_by(func.coalesce(Invoice.issued_at, Invoice.created_at).desc(), Invoice.id)
    )
    if status_filter:
        query = query.where(Invoice.status == status_filter.upper())
    if date_from:
        query = query.where(func.coalesce(Invoice.issued_at, Invoice.created_at) >= date_from)
    if date_to:
        query = query.where(func.coalesce(Invoice.issued_at, Invoice.created_at) < date_to)
    total, rows = await _paginate(db, query, page, page_size)
    return {"total": total, "page": page, "page_size": page_size, "items": [{
        "id": i.id,
        "number": i.number,
        "organization_id": i.organization_id,
        "organization_name": org_name,
        "status": i.status,
        "currency": i.currency,
        "subtotal_minor": i.subtotal_minor,
        "tax_minor": i.tax_minor,
        "total_minor": i.total_minor,
        "pdf_url": i.pdf_url,
        "issued_at": _iso(i.issued_at),
        "paid_at": _iso(i.paid_at),
    } for i, org_name in rows]}


@router.get("/billing/events")
async def list_billing_events(
    processed: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    # Ham webhook içeriği (müşteri ve ödeme ayrıntıları) döndürülmez.
    query = select(
        BillingEvent.id, BillingEvent.provider, BillingEvent.event_type,
        BillingEvent.created_at, BillingEvent.processed_at, BillingEvent.error,
    ).order_by(BillingEvent.created_at.desc(), BillingEvent.id)
    if processed is not None:
        query = query.where(BillingEvent.processed_at.is_not(None) if processed else BillingEvent.processed_at.is_(None))
    total, rows = await _paginate(db, query, page, page_size)
    return {"total": total, "page": page, "page_size": page_size, "items": [{
        "id": r.id,
        "provider": r.provider,
        "event_type": r.event_type,
        "created_at": _iso(r.created_at),
        "processed_at": _iso(r.processed_at),
        "error": r.error,
    } for r in rows]}


# ---------- Kullanım ----------

def _usage_level(used: int, limit: Optional[int]) -> Optional[float]:
    return round(used / limit, 4) if limit and limit > 0 else None


@router.get("/usage")
async def list_usage(
    metric: Optional[str] = Query(None, pattern="^(pages_crawled|auto_fixes|ai_credits|ai_tokens)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    orgs = (await db.execute(select(Organization))).scalars().all()
    ids = [o.id for o in orgs]
    subs = await _subscription_map(db, ids)
    usage = await _current_usage(db, ids)

    items = []
    for o in orgs:
        limits = _limits(subs.get(o.id), o)
        metrics = {}
        for m in USAGE_METRICS:
            used = usage.get(o.id, {}).get(m, 0)
            ratio = _usage_level(used, limits[m])
            metrics[m] = {
                "used": used,
                "limit": limits[m],
                "ratio": ratio,
                "level": None if ratio is None else ("over" if ratio >= 1 else "warn" if ratio >= 0.8 else "ok"),
            }
        sub = subs.get(o.id)
        items.append({
            "organization_id": o.id,
            "organization_name": o.name,
            "plan_code": sub.plan.code if sub and sub.plan else None,
            "metrics": metrics,
        })

    def sort_key(item):
        ratios = [item["metrics"][metric]["ratio"]] if metric else [v["ratio"] for v in item["metrics"].values()]
        return max((r for r in ratios if r is not None), default=-1)

    items.sort(key=sort_key, reverse=True)
    start = (page - 1) * page_size
    period_start, period_end = UsageService.get_current_period()
    return {
        "period_start": _iso(period_start),
        "period_end": _iso(period_end),
        "total": len(items),
        "page": page,
        "page_size": page_size,
        "items": items[start:start + page_size],
    }


@router.get("/usage/{org_id}")
async def get_usage(org_id: str, db: AsyncSession = Depends(get_db)):
    await _org_or_404(db, org_id)
    since = datetime.now(timezone.utc) - timedelta(days=30)
    day = func.date(UsageEvent.created_at)
    daily = (await db.execute(
        select(day, UsageEvent.metric, func.sum(UsageEvent.quantity))
        .where(UsageEvent.organization_id == org_id, UsageEvent.created_at >= since)
        .group_by(day, UsageEvent.metric)
        .order_by(day)
    )).all()
    events = (await db.execute(
        select(UsageEvent).where(UsageEvent.organization_id == org_id).order_by(UsageEvent.created_at.desc()).limit(50)
    )).scalars().all()
    ledger = (await db.execute(
        select(CreditLedger).where(CreditLedger.organization_id == org_id).order_by(CreditLedger.created_at.desc()).limit(50)
    )).scalars().all()
    return {
        "organization_id": org_id,
        "daily": [{"date": str(d), "metric": metric, "quantity": int(q or 0)} for d, metric, q in daily],
        "events": [{"id": e.id, "metric": e.metric, "quantity": e.quantity, "ref_type": e.ref_type, "ref_id": e.ref_id, "created_at": _iso(e.created_at)} for e in events],
        "credit_ledger": [{"id": c.id, "delta": c.delta, "reason": c.reason, "balance_after": c.balance_after, "ref_id": c.ref_id, "created_at": _iso(c.created_at)} for c in ledger],
    }


# ---------- Denetim kaydı ----------

@router.get("/audit")
async def list_audit(
    org: Optional[str] = None,
    user: Optional[str] = None,
    action: Optional[str] = None,
    date_from: Optional[datetime] = Query(None, alias="from"),
    date_to: Optional[datetime] = Query(None, alias="to"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    query = _audit_query()
    if org:
        query = query.where(AuditLog.organization_id == org)
    if user:
        query = query.where(AuditLog.user_id == user)
    if action:
        query = query.where(AuditLog.action.startswith(action, autoescape=True))
    if date_from:
        query = query.where(AuditLog.created_at >= date_from)
    if date_to:
        query = query.where(AuditLog.created_at < date_to)
    total, rows = await _paginate(db, query, page, page_size)
    return {"total": total, "page": page, "page_size": page_size, "items": [_audit_row(*r) for r in rows]}
