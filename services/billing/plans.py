import asyncio
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from packages.shared.models import Plan, PlanPrice, PlanLimit, PlanFeature

DEFAULT_PLANS: List[Dict[str, Any]] = [
    {
        "code": "free",
        "name": "Free",
        "description": "Bireysel ve yeni başlayan siteler için temel SEO denetimi.",
        "is_public": True,
        "sort_order": 0,
        "prices": [
            {"interval": "month", "currency": "USD", "amount_minor": 0, "active": True},
            {"interval": "year", "currency": "USD", "amount_minor": 0, "active": True}
        ],
        "limits": {
            "sites": 1,
            "pages_crawled": 500,
            "ai_credits": 10,
            "auto_fixes": 0,
            "seats": 1,
            "retention_days": 30
        },
        "features": {
            "js_render": False,
            "experiments": False,
            "white_label": False,
            "api_access": False,
            "gsc_integration": False,
            "auto_fixes": False
        }
    },
    {
        "code": "starter",
        "name": "Starter",
        "description": "Büyüyen projeler ve küçük işletmeler için otonom SEO başlangıcı.",
        "is_public": True,
        "sort_order": 1,
        "prices": [
            {"interval": "month", "currency": "USD", "amount_minor": 3900, "active": True},
            {"interval": "year", "currency": "USD", "amount_minor": 38400, "active": True}  # $32/ay eşdeğeri
        ],
        "limits": {
            "sites": 3,
            "pages_crawled": 10000,
            "ai_credits": 100,
            "auto_fixes": 20,
            "seats": 2,
            "retention_days": 180
        },
        "features": {
            "js_render": True,
            "experiments": False,
            "white_label": False,
            "api_access": False,
            "gsc_integration": True,
            "auto_fixes": True
        }
    },
    {
        "code": "pro",
        "name": "Pro",
        "description": "Profesyoneller ve e-ticaret siteleri için tam teşekküllü otonom SEO.",
        "is_public": True,
        "sort_order": 2,
        "prices": [
            {"interval": "month", "currency": "USD", "amount_minor": 11900, "active": True},
            {"interval": "year", "currency": "USD", "amount_minor": 118800, "active": True} # $99/ay eşdeğeri
        ],
        "limits": {
            "sites": 10,
            "pages_crawled": 100000,
            "ai_credits": 750,
            "auto_fixes": 300,
            "seats": 5,
            "retention_days": 365
        },
        "overage": {
            "pages_crawled": {"unit": 50000, "price_minor": 2000}, # +50k sayfa $20
            "ai_credits": {"unit": 250, "price_minor": 2500},      # +250 kredi $25
            "auto_fixes": {"unit": 100, "price_minor": 1500}       # +100 auto-fix $15
        },
        "features": {
            "js_render": True,
            "experiments": True,
            "white_label": False,
            "api_access": True,
            "gsc_integration": True,
            "auto_fixes": True
        }
    },
    {
        "code": "agency",
        "name": "Agency",
        "description": "Ajanslar ve çoklu marka yöneten ekipler için yüksek hacimli büyüme paketi.",
        "is_public": True,
        "sort_order": 3,
        "prices": [
            {"interval": "month", "currency": "USD", "amount_minor": 29900, "active": True},
            {"interval": "year", "currency": "USD", "amount_minor": 298800, "active": True} # $249/ay eşdeğeri
        ],
        "limits": {
            "sites": 50,
            "pages_crawled": 500000,
            "ai_credits": 3000,
            "auto_fixes": 2000,
            "seats": 15,
            "retention_days": 730
        },
        "overage": {
            "pages_crawled": {"unit": 50000, "price_minor": 2000},
            "ai_credits": {"unit": 250, "price_minor": 2500},
            "auto_fixes": {"unit": 100, "price_minor": 1500}
        },
        "features": {
            "js_render": True,
            "experiments": True,
            "white_label": True,
            "api_access": True,
            "gsc_integration": True,
            "auto_fixes": True
        }
    },
    {
        "code": "enterprise",
        "name": "Enterprise",
        "description": "Kurumsal markalar için özel limitler, SLA ve özel CSM desteği.",
        "is_public": False,
        "sort_order": 4,
        "prices": [],
        "limits": {
            "sites": 999999,
            "pages_crawled": 10000000,
            "ai_credits": 50000,
            "auto_fixes": 50000,
            "seats": 999,
            "retention_days": 1825
        },
        "features": {
            "js_render": True,
            "experiments": True,
            "white_label": True,
            "api_access": True,
            "gsc_integration": True,
            "auto_fixes": True
        }
    }
]


_seed_lock = asyncio.Lock()


async def seed_billing_plans(db: AsyncSession) -> Dict[str, Plan]:
    """
    Plan kataloğunu veritabanına idempotent şekilde yükler veya günceller.
    Dönen sözlük plan_code -> Plan nesnesidir.
    """
    async with _seed_lock:
        plans_by_code: Dict[str, Plan] = {}

        for plan_def in DEFAULT_PLANS:
            code = plan_def["code"]
            res = await db.execute(select(Plan).where(Plan.code == code))
            plan = res.scalars().first()

            if not plan:
                try:
                    plan = Plan(
                        code=code,
                        name=plan_def["name"],
                        description=plan_def["description"],
                        is_public=plan_def["is_public"],
                        sort_order=plan_def["sort_order"]
                    )
                    db.add(plan)
                    await db.flush()
                except Exception:
                    await db.rollback()
                    res = await db.execute(select(Plan).where(Plan.code == code))
                    plan = res.scalars().first()
            else:
                plan.name = plan_def["name"]
                plan.description = plan_def["description"]
                plan.is_public = plan_def["is_public"]
                plan.sort_order = plan_def["sort_order"]

            plans_by_code[code] = plan
            if not plan:
                continue

            # Prices
            for price_def in plan_def.get("prices", []):
                p_res = await db.execute(
                    select(PlanPrice).where(
                        PlanPrice.plan_id == plan.id,
                        PlanPrice.interval == price_def["interval"],
                        PlanPrice.currency == price_def["currency"]
                    )
                )
                price = p_res.scalars().first()
                if not price:
                    try:
                        price = PlanPrice(
                            plan_id=plan.id,
                            interval=price_def["interval"],
                            currency=price_def["currency"],
                            amount_minor=price_def["amount_minor"],
                            active=price_def["active"]
                        )
                        db.add(price)
                        await db.flush()
                    except Exception:
                        await db.rollback()
                else:
                    price.amount_minor = price_def["amount_minor"]
                    price.active = price_def["active"]

            # Limits
            overages = plan_def.get("overage", {})
            for metric, hard_limit in plan_def.get("limits", {}).items():
                l_res = await db.execute(
                    select(PlanLimit).where(
                        PlanLimit.plan_id == plan.id,
                        PlanLimit.metric == metric
                    )
                )
                limit = l_res.scalars().first()
                soft_limit = int(hard_limit * 0.8) if hard_limit > 0 else 0
                ov_data = overages.get(metric, {})
                unit = ov_data.get("unit")
                price_minor = ov_data.get("price_minor")

                if not limit:
                    try:
                        limit = PlanLimit(
                            plan_id=plan.id,
                            metric=metric,
                            hard_limit=hard_limit,
                            soft_limit=soft_limit,
                            overage_unit=unit,
                            overage_price_minor=price_minor
                        )
                        db.add(limit)
                        await db.flush()
                    except Exception:
                        await db.rollback()
                else:
                    limit.hard_limit = hard_limit
                    limit.soft_limit = soft_limit
                    limit.overage_unit = unit
                    limit.overage_price_minor = price_minor

            # Features
            for f_key, enabled in plan_def.get("features", {}).items():
                f_res = await db.execute(
                    select(PlanFeature).where(
                        PlanFeature.plan_id == plan.id,
                        PlanFeature.feature_key == f_key
                    )
                )
                feature = f_res.scalars().first()
                if not feature:
                    try:
                        feature = PlanFeature(
                            plan_id=plan.id,
                            feature_key=f_key,
                            enabled=enabled
                        )
                        db.add(feature)
                        await db.flush()
                    except Exception:
                        await db.rollback()
                else:
                    feature.enabled = enabled

        await db.commit()

        # Re-fetch plans with all eager relationships loaded
        from sqlalchemy.orm import selectinload
        all_plans_res = await db.execute(
            select(Plan).options(
                selectinload(Plan.prices),
                selectinload(Plan.limits),
                selectinload(Plan.features)
            )
        )
        return {p.code: p for p in all_plans_res.scalars().all()}
