from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from packages.shared.database import get_db
from packages.shared.models import (
    Plan,
    PlanPrice,
    PlanLimit,
    PlanFeature,
    Subscription,
    SubscriptionAddon
)
from apps.api.routes.auth import get_current_user_payload
from apps.api.routes.sites import verify_site_access
from services.billing.plans import seed_billing_plans
from services.billing.usage import UsageService
from services.billing.entitlements import EntitlementGuard

router = APIRouter(tags=["Billing & Subscriptions"])


# ==========================================
# PYDANTIC RESPONSE & REQUEST MODELLERİ
# ==========================================

class PriceResponse(BaseModel):
    interval: str
    currency: str
    amount_minor: int
    amount_formatted: str
    active: bool

class PlanResponse(BaseModel):
    id: str
    code: str
    name: str
    description: Optional[str]
    is_public: bool
    sort_order: int
    prices: List[PriceResponse]
    limits: Dict[str, int]
    features: Dict[str, bool]

class UsageSummaryResponse(BaseModel):
    metric: str
    used: int
    limit: int
    remaining: int
    is_exceeded: bool

class SubscriptionDetailsResponse(BaseModel):
    organization_id: str
    plan_code: str
    plan_name: str
    status: str
    provider: str
    current_period_start: str
    current_period_end: Optional[str]
    trial_ends_at: Optional[str]
    ai_credit_balance: int
    usages: Dict[str, UsageSummaryResponse]
    features: Dict[str, bool]

class GrantCreditRequest(BaseModel):
    amount: int
    reason: Optional[str] = "MANUAL"

class SwitchPlanRequest(BaseModel):
    plan_code: str


# ==========================================
# YARDIMCI YETKİ KONTROLÜ
# ==========================================

async def verify_org_billing_access(org_id: str, payload: dict, db: AsyncSession, allowed_roles: Optional[List[str]] = None):
    """
    Kullanıcının organizasyon faturalama işlemlerini görüntüleme/yönetme yetkisini doğrular.
    """
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Kimlik doğrulama başarısız")

    from packages.shared.models import Membership
    res = await db.execute(
        select(Membership).where(
            Membership.organization_id == org_id,
            Membership.user_id == user_id
        )
    )
    membership = res.scalars().first()
    if not membership:
        raise HTTPException(status_code=403, detail="Bu organizasyona erişim yetkiniz bulunmuyor")

    if allowed_roles and membership.role not in allowed_roles:
        raise HTTPException(status_code=403, detail=f"Bu işlem için yetersiz rol (Gerekli: {allowed_roles}, Rolünüz: {membership.role})")

    return membership


# ==========================================
# ENDPOINT'LER
# ==========================================

@router.get("/billing/plans", response_model=List[PlanResponse])
async def list_plans(db: AsyncSession = Depends(get_db)):
    """
    Sistemdeki tüm genel plan kataloğunu (Free, Starter, Pro, Agency) listeler.
    Eğer katalog henüz DB'ye yüklenmemişse otomatik olarak seed eder.
    """
    res = await db.execute(
        select(Plan)
        .where(Plan.is_public.is_(True))
        .order_by(Plan.sort_order.asc())
        .options(
            selectinload(Plan.prices),
            selectinload(Plan.limits),
            selectinload(Plan.features)
        )
    )
    plans = res.scalars().all()
    if not plans:
        await seed_billing_plans(db)
        res = await db.execute(
            select(Plan)
            .where(Plan.is_public.is_(True))
            .order_by(Plan.sort_order.asc())
            .options(
                selectinload(Plan.prices),
                selectinload(Plan.limits),
                selectinload(Plan.features)
            )
        )
        plans = res.scalars().all()

    output = []
    for p in plans:
        prices = [
            PriceResponse(
                interval=pr.interval,
                currency=pr.currency,
                amount_minor=pr.amount_minor,
                amount_formatted=f"{pr.amount_minor / 100:.2f} {pr.currency}",
                active=pr.active
            )
            for pr in p.prices if pr.active
        ]
        limits = {lim.metric: lim.hard_limit for lim in p.limits}
        features = {feat.feature_key: feat.enabled for feat in p.features}

        output.append(
            PlanResponse(
                id=p.id,
                code=p.code,
                name=p.name,
                description=p.description,
                is_public=p.is_public,
                sort_order=p.sort_order,
                prices=prices,
                limits=limits,
                features=features
            )
        )
    return output


@router.get("/organizations/{org_id}/billing/subscription", response_model=SubscriptionDetailsResponse)
async def get_subscription_details(
    org_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    """
    Organizasyonun mevcut abonelik durumunu, planını, özellik yetkilerini ve anlık kullanım özetini döner.
    """
    await verify_org_billing_access(org_id, payload, db)

    sub = await EntitlementGuard.get_or_create_subscription(db, org_id)
    plan = sub.plan

    # Kullanım özetleri (pages_crawled, ai_credits, auto_fixes)
    tracked_metrics = ["pages_crawled", "ai_credits", "auto_fixes", "sites"]
    usages: Dict[str, UsageSummaryResponse] = {}

    for metric in tracked_metrics:
        lim_val = next((lim.hard_limit for lim in plan.limits if lim.metric == metric), 0)
        # Addon desteği
        addon_sum = sum(a.quantity for a in sub.addons if a.metric == metric)
        total_lim = lim_val + addon_sum
        used = await UsageService.get_usage(db, org_id, metric)

        usages[metric] = UsageSummaryResponse(
            metric=metric,
            used=used,
            limit=total_lim,
            remaining=max(0, total_lim - used),
            is_exceeded=(used >= total_lim and total_lim > 0)
        )

    credit_balance = await UsageService.get_credit_balance(db, org_id)
    features = {f.feature_key: f.enabled for f in plan.features}

    return SubscriptionDetailsResponse(
        organization_id=org_id,
        plan_code=plan.code,
        plan_name=plan.name,
        status=sub.status,
        provider=sub.provider,
        current_period_start=sub.current_period_start.isoformat(),
        current_period_end=sub.current_period_end.isoformat() if sub.current_period_end else None,
        trial_ends_at=sub.trial_ends_at.isoformat() if sub.trial_ends_at else None,
        ai_credit_balance=credit_balance,
        usages=usages,
        features=features
    )


@router.post("/organizations/{org_id}/billing/plan", response_model=SubscriptionDetailsResponse)
async def switch_organization_plan(
    org_id: str,
    req: SwitchPlanRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    """
    Organizasyon planını değiştirir (Faz 0 için doğrudan plan geçişi).
    """
    await verify_org_billing_access(org_id, payload, db, allowed_roles=["OWNER", "ADMIN"])

    res = await db.execute(
        select(Plan)
        .where(Plan.code == req.plan_code.lower())
        .options(
            selectinload(Plan.limits),
            selectinload(Plan.features)
        )
    )
    target_plan = res.scalars().first()
    if not target_plan:
        raise HTTPException(status_code=404, detail=f"'{req.plan_code}' kodlu plan bulunamadı")

    sub = await EntitlementGuard.get_or_create_subscription(db, org_id)
    sub.plan_id = target_plan.id
    sub.plan = target_plan
    sub.status = "ACTIVE"
    await db.commit()
    await db.refresh(sub)

    # Eğer yeni planın AI kredisi varsa, orantılı grant yap
    plan_credits = next((l.hard_limit for l in target_plan.limits if l.metric == "ai_credits"), 0)
    if plan_credits > 0:
        await UsageService.grant_credits(db, org_id, plan_credits, reason="PLAN_GRANT", ref_id=f"switch_{target_plan.code}")

    return await get_subscription_details(org_id=org_id, payload=payload, db=db)


@router.post("/organizations/{org_id}/billing/credits/grant")
async def grant_ai_credits(
    org_id: str,
    req: GrantCreditRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    """
    Organizasyona manuel veya promosyon AI kredisi ekler.
    """
    await verify_org_billing_access(org_id, payload, db, allowed_roles=["OWNER", "ADMIN"])

    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Eklenecek kredi miktarı pozitif bir sayı olmalıdır")

    new_balance = await UsageService.grant_credits(
        db,
        org_id,
        req.amount,
        reason=req.reason or "MANUAL",
        ref_id="admin_grant"
    )

    return {
        "organization_id": org_id,
        "granted_amount": req.amount,
        "new_balance": new_balance,
        "status": "success"
    }
