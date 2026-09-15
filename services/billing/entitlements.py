import asyncio
from typing import Optional, Tuple, Dict, Any
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from packages.shared.models import (
    Subscription,
    Plan,
    PlanLimit,
    PlanFeature,
    SubscriptionAddon
)
from services.billing.usage import UsageService
from services.billing.plans import seed_billing_plans


class EntitlementGuard:
    """
    Yetki, özellik geçitleri (Feature Flags) ve kota sınırlarının (Limits)
    merkezi denetim koruyucusu.
    """
    _lock = asyncio.Lock()

    @classmethod
    async def get_or_create_subscription(cls, db: AsyncSession, org_id: str) -> Subscription:
        """
        Organizasyonun aktif aboneliğini döner. Eğer henüz bir abonelik atanmamışsa,
        otomatik olarak Free plan aboneliği oluşturur ve ilk AI kredilerini tanımlar.
        """
        async with cls._lock:
            res = await db.execute(
                select(Subscription)
                .where(Subscription.organization_id == org_id)
                .options(
                    selectinload(Subscription.plan).selectinload(Plan.limits),
                    selectinload(Subscription.plan).selectinload(Plan.features),
                    selectinload(Subscription.addons)
                )
            )
            sub = res.scalars().first()
            if sub:
                return sub

            # Free planı bul veya seed et
            p_res = await db.execute(
                select(Plan)
                .where(Plan.code == "free")
                .options(
                    selectinload(Plan.limits),
                    selectinload(Plan.features)
                )
            )
            free_plan = p_res.scalars().first()
            if not free_plan:
                plans = await seed_billing_plans(db)
                free_plan = plans.get("free")
                p_res = await db.execute(
                    select(Plan)
                    .where(Plan.code == "free")
                    .options(
                        selectinload(Plan.limits),
                        selectinload(Plan.features)
                    )
                )
                free_plan = p_res.scalars().first()

            # Zaten eklenmiş mi kontrol et
            res = await db.execute(
                select(Subscription)
                .where(Subscription.organization_id == org_id)
                .options(
                    selectinload(Subscription.plan).selectinload(Plan.limits),
                    selectinload(Subscription.plan).selectinload(Plan.features),
                    selectinload(Subscription.addons)
                )
            )
            sub = res.scalars().first()
            if sub:
                return sub

            try:
                sub = Subscription(
                    organization_id=org_id,
                    plan_id=free_plan.id,
                    status="ACTIVE",
                    provider="MANUAL"
                )
                db.add(sub)
                await db.commit()

                # Free planın 10 AI kredisini tanımla
                await UsageService.grant_credits(db, org_id, 10, reason="PLAN_GRANT", ref_id="initial_free")
            except Exception:
                await db.rollback()

            # Tekrar ilişkilerle çek
            res = await db.execute(
                select(Subscription)
                .where(Subscription.organization_id == org_id)
                .options(
                    selectinload(Subscription.plan).selectinload(Plan.limits),
                    selectinload(Subscription.plan).selectinload(Plan.features),
                    selectinload(Subscription.addons)
                )
            )
            return res.scalars().first()

    @classmethod
    async def check_feature(cls, db: AsyncSession, org_id: str, feature_key: str) -> bool:
        """
        Organizasyonun planında ilgili özelliğin açık olup olmadığını kontrol eder.
        """
        sub = await cls.get_or_create_subscription(db, org_id)
        if not sub or not sub.plan:
            return False

        # Eğer abonelik duraklatılmış (PAUSED) veya iptal edilmiş (CANCELED) ise kilitlidir
        if sub.status in ("PAUSED", "CANCELED"):
            return False

        for feat in sub.plan.features:
            if feat.feature_key == feature_key:
                return bool(feat.enabled)

        return False

    @classmethod
    async def ensure_feature(cls, db: AsyncSession, org_id: str, feature_key: str):
        """
        Özellik kapalıysa HTTP 402 Payment Required fırlatır.
        """
        allowed = await cls.check_feature(db, org_id, feature_key)
        if not allowed:
            raise HTTPException(
                status_code=402,
                detail={
                    "error": "PAYMENT_REQUIRED",
                    "code": "FEATURE_LOCKED",
                    "message": f"'{feature_key}' özelliği mevcut planınızda bulunmamaktadır. Lütfen paketinizi yükseltin.",
                    "upgrade_to": "pro",
                    "feature": feature_key
                }
            )

    @classmethod
    async def check_limit(
        cls,
        db: AsyncSession,
        org_id: str,
        metric: str,
        requested_qty: int = 1
    ) -> Tuple[bool, Optional[str], Dict[str, Any]]:
        """
        Metrik kotasını kontrol eder.
        Döner: (izin_verildi_mi, durum_kodu_veya_uyarı, detay_sözlüğü)
        """
        sub = await cls.get_or_create_subscription(db, org_id)
        if not sub or not sub.plan:
            return False, "NO_ACTIVE_PLAN", {"metric": metric, "used": 0, "limit": 0}

        # Temel plan limiti
        base_limit = 0
        soft_limit = 0
        for lim in sub.plan.limits:
            if lim.metric == metric:
                base_limit = lim.hard_limit
                soft_limit = lim.soft_limit or int(base_limit * 0.8)
                break

        # Ek paketler (Addons)
        addon_qty = sum(a.quantity for a in sub.addons if a.metric == metric)
        total_effective_limit = base_limit + addon_qty

        # Mevcut dönem kullanımı
        used = await UsageService.get_usage(db, org_id, metric)

        # AI kredisi özel durumu: Kredi defteri bakiyesini de denetle
        if metric == "ai_credits":
            balance = await UsageService.get_credit_balance(db, org_id)
            if balance < requested_qty:
                return False, "INSUFFICIENT_CREDITS", {
                    "metric": metric,
                    "used": used,
                    "limit": total_effective_limit,
                    "balance": balance,
                    "requested": requested_qty
                }

        # Katı sınır kontrolü
        if (used + requested_qty) > total_effective_limit:
            return False, "QUOTA_EXCEEDED", {
                "metric": metric,
                "used": used,
                "limit": total_effective_limit,
                "requested": requested_qty
            }

        # Yumuşak sınır uyarısı (Soft limit)
        if (used + requested_qty) >= soft_limit and soft_limit > 0:
            return True, "SOFT_LIMIT_REACHED", {
                "metric": metric,
                "used": used,
                "limit": total_effective_limit,
                "soft_limit": soft_limit
            }

        return True, None, {"metric": metric, "used": used, "limit": total_effective_limit}

    @classmethod
    async def ensure_limit(
        cls,
        db: AsyncSession,
        org_id: str,
        metric: str,
        requested_qty: int = 1
    ):
        """
        Kota aşılmışsa HTTP 429 Too Many Requests / Quota Exceeded fırlatır.
        """
        allowed, reason, info = await cls.check_limit(db, org_id, metric, requested_qty)
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "QUOTA_EXCEEDED",
                    "code": reason,
                    "message": f"Aylık '{metric}' kotanız dolmuştur ({info.get('used', 0)} / {info.get('limit', 0)}). Lütfen paketinizi yükseltin veya ek paket satın alın.",
                    "details": info
                }
            )

    @classmethod
    async def reserve_crawl_budget(
        cls,
        db: AsyncSession,
        org_id: str,
        requested_pages: int
    ) -> int:
        """
        Yeni bir tarama başlatılmadan önce organizasyonun kalan sayfa kotasını hesaplar.
        Taranabilecek maksimum sayfa adedini döner.
        Kota tamamen tükenmişse HTTPException(429) fırlatır.
        """
        allowed, reason, info = await cls.check_limit(db, org_id, "pages_crawled", requested_qty=1)
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "QUOTA_EXCEEDED",
                    "code": "CRAWL_QUOTA_EXCEEDED",
                    "message": f"Bu ayki taranabilir sayfa kotanız tükenmiştir ({info.get('used')}/{info.get('limit')}).",
                    "details": info
                }
            )

        used = info.get("used", 0)
        limit = info.get("limit", 0)
        remaining = max(0, limit - used)

        return min(requested_pages, remaining)
