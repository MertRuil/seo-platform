import math
import logging
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from packages.shared.models import Organization, Site

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

        if org.tokens_used_this_month + estimated_tokens > org.monthly_token_budget:
            logger.warning(
                f"Token budget exceeded for org '{org.name}' ({org.id}): "
                f"{org.tokens_used_this_month + estimated_tokens} > {org.monthly_token_budget}"
            )
            raise TokenBudgetExceededException(
                used=org.tokens_used_this_month,
                budget=org.monthly_token_budget,
                org_name=org.name
            )
        return org

    @classmethod
    async def record_usage(
        cls,
        db: AsyncSession,
        organization_id: str,
        tokens_used: int
    ) -> int:
        """
        Atomically records token consumption and updates organization state.
        """
        if tokens_used <= 0:
            return 0

        stmt = select(Organization).where(Organization.id == organization_id)
        res = await db.execute(stmt)
        org = res.scalars().first()
        if not org:
            return 0

        org.tokens_used_this_month = (org.tokens_used_this_month or 0) + tokens_used
        await db.commit()
        await db.refresh(org)
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
