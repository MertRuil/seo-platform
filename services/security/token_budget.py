import math
import logging
from typing import Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from packages.shared.models import Organization, Site, UsageCounter

logger = logging.getLogger(__name__)


class TokenBudgetExceededException(HTTPException):
    def __init__(self, used: int, budget: int, org_name: str = "Organizasyon"):
        detail = (
            f"{org_name} aylık AI jeton/token bütçesini aştı ({used:,} / {budget:,} jeton kullanıldı). "
            f"Yeni analiz veya öneri üretebilmek için lütfen bütçenizi artırın veya bir sonraki fatura dönemini bekleyin."
        )
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
            headers={"Retry-After": "86400"}
        )


class TokenBudgetService:
    @staticmethod
    def estimate_tokens(prompt: str, completion: str = "") -> int:
        """
        Estimates total token usage for prompt and completion.
        Industry standard heuristic: ~1 token per 4 UTF-8 characters (min 100 tokens).
        """
        total_chars = len(prompt or "") + len(completion or "")
        return max(100, math.ceil(total_chars / 4.0))

    @staticmethod
    async def monthly_tokens(db: AsyncSession, organization_ids: List[str]) -> Dict[str, int]:
        """
        Bu takvim ayının (UTC) ai_tokens sayaçları. Ay dönünce yeni dönemin sayacı olmadığından kullanım
        kendiliğinden sıfırdan başlar; Organization.tokens_used_this_month yalnızca bu değerin kopyasıdır.
        """
        from services.billing.usage import UsageService
        if not organization_ids:
            return {}
        period_start, _ = UsageService.get_current_period()
        rows = (await db.execute(
            select(UsageCounter.organization_id, UsageCounter.used).where(
                UsageCounter.organization_id.in_(organization_ids),
                UsageCounter.metric == "ai_tokens",
                UsageCounter.period_start == period_start,
            )
        )).all()
        return {org_id: used for org_id, used in rows}

    @classmethod
    async def check_budget(
        cls,
        db: AsyncSession,
        organization_id: str,
        estimated_tokens: int = 500
    ) -> Organization:
        """
        Verifies organization has remaining monthly token budget before calling LLM.
        """
        stmt = select(Organization).where(Organization.id == organization_id)
        res = await db.execute(stmt)
        org = res.scalars().first()
        if not org:
            return None

        used = (await cls.monthly_tokens(db, [org.id])).get(org.id, 0)
        org.tokens_used_this_month = used
        if used + estimated_tokens > org.monthly_token_budget:
            logger.warning(
                f"Token budget exceeded for org '{org.name}' ({org.id}): "
                f"{used + estimated_tokens} > {org.monthly_token_budget}"
            )
            raise TokenBudgetExceededException(
                used=used,
                budget=org.monthly_token_budget,
                org_name=org.name
            )
        return org

    @classmethod
    async def record_usage(
        cls,
        db: AsyncSession,
        organization_id: str,
        tokens_used: int,
        ref_type: Optional[str] = None,
        ref_id: Optional[str] = None
    ) -> int:
        """
        Token tüketimini bu dönemin ai_tokens sayacına ve kullanım olaylarına yazar; aylık toplamı döner.
        """
        from services.billing.usage import UsageService
        if tokens_used <= 0:
            return 0

        org = (await db.execute(select(Organization).where(Organization.id == organization_id))).scalars().first()
        if not org:
            return 0

        org.tokens_used_this_month = await UsageService.consume(db, organization_id, "ai_tokens", tokens_used, ref_type=ref_type, ref_id=ref_id)
        await db.commit()
        logger.info(f"Recorded {tokens_used} AI tokens for org '{org.name}'. Total this month: {org.tokens_used_this_month}")
        return org.tokens_used_this_month

    @classmethod
    async def check_budget_for_site(
        cls,
        db: AsyncSession,
        site_id: str,
        estimated_tokens: int = 500
    ) -> Optional[Organization]:
        stmt = select(Site).where(Site.id == site_id)
        res = await db.execute(stmt)
        site = res.scalars().first()
        if not site or not site.organization_id:
            return None
        return await cls.check_budget(db, site.organization_id, estimated_tokens)

    @classmethod
    async def record_usage_for_site(
        cls,
        db: AsyncSession,
        site_id: str,
        tokens_used: int
    ) -> int:
        stmt = select(Site).where(Site.id == site_id)
        res = await db.execute(stmt)
        site = res.scalars().first()
        if not site or not site.organization_id:
            return 0
        return await cls.record_usage(db, site.organization_id, tokens_used)

    @classmethod
    async def record_provider_usage(
        cls,
        db: AsyncSession,
        organization_id: str,
        provider,
        ref_type: Optional[str] = None,
        ref_id: Optional[str] = None
    ) -> int:
        """
        Sağlayıcının bildirdiği gerçek token sayısını organizasyona yazar: dönemlik sayaç ve kullanım olayı
        (yönetim paneli) ile aylık bütçe sayacı. Anahtarsız test sağlayıcısı token bildirmez, kayıt düşmez.
        """
        tokens = provider.take_tokens() if hasattr(provider, "take_tokens") else 0
        if tokens <= 0:
            return 0
        await cls.record_usage(db, organization_id, tokens, ref_type=ref_type, ref_id=ref_id)
        return tokens
