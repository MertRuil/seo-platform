from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from packages.shared.models import (
    UsageCounter,
    UsageEvent,
    CreditLedger,
    Subscription,
    PlanLimit
)


class UsageService:
    @staticmethod
    def get_current_period() -> Tuple[datetime, datetime]:
        """
        Mevcut takvim ayı dönem başlangıç ve bitiş zamanlarını UTC olarak hesaplar.
        """
        now = datetime.now(timezone.utc)
        period_start = datetime(now.year, now.month, 1, 0, 0, 0, tzinfo=timezone.utc)
        # Bir sonraki ayın 1'i
        if now.month == 12:
            period_end = datetime(now.year + 1, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        else:
            period_end = datetime(now.year, now.month + 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        return period_start, period_end

    @classmethod
    async def get_or_create_counter(
        cls,
        db: AsyncSession,
        org_id: str,
        metric: str,
        period_start: Optional[datetime] = None,
        period_end: Optional[datetime] = None
    ) -> UsageCounter:
        """
        Organizasyonun dönemsel sayacını getirir veya yoksa 0 ile başlatır.
        """
        if not period_start or not period_end:
            p_start, p_end = cls.get_current_period()
        else:
            p_start, p_end = period_start, period_end

        res = await db.execute(
            select(UsageCounter).where(
                UsageCounter.organization_id == org_id,
                UsageCounter.metric == metric,
                UsageCounter.period_start == p_start
            )
        )
        counter = res.scalars().first()
        if not counter:
            counter = UsageCounter(
                organization_id=org_id,
                metric=metric,
                period_start=p_start,
                period_end=p_end,
                used=0
            )
            db.add(counter)
            await db.flush()
        return counter

    @classmethod
    async def get_usage(cls, db: AsyncSession, org_id: str, metric: str) -> int:
        """
        Organizasyonun bu dönem harcadığı toplam birimi döner.
        """
        counter = await cls.get_or_create_counter(db, org_id, metric)
        return counter.used

    @classmethod
    async def consume(
        cls,
        db: AsyncSession,
        org_id: str,
        metric: str,
        quantity: int,
        ref_type: Optional[str] = None,
        ref_id: Optional[str] = None
    ) -> int:
        """
        Sayacı atomik olarak artırır ve denetim olayını (UsageEvent) kaydeder.
        Eğer metrik ai_credits ise, CreditLedger üzerinden düşüş gerçekleştirir.
        Dönen değer güncel kullanım toplamıdır.
        """
        if quantity <= 0:
            return await cls.get_usage(db, org_id, metric)

        counter = await cls.get_or_create_counter(db, org_id, metric)
        counter.used += quantity

        event = UsageEvent(
            organization_id=org_id,
            metric=metric,
            quantity=quantity,
            ref_type=ref_type,
            ref_id=ref_id
        )
        db.add(event)

        if metric == "ai_credits":
            # AI kredi bakiyesinden düş
            current_balance = await cls.get_credit_balance(db, org_id)
            new_balance = max(0, current_balance - quantity)
            ledger_entry = CreditLedger(
                organization_id=org_id,
                delta=-quantity,
                reason="CONSUME",
                balance_after=new_balance,
                ref_id=ref_id
            )
            db.add(ledger_entry)

        await db.commit()
        return counter.used

    @classmethod
    async def get_credit_balance(cls, db: AsyncSession, org_id: str) -> int:
        """
        Organizasyonun mevcut kullanılabilir AI kredi bakiyesini döner.
        """
        res = await db.execute(
            select(CreditLedger)
            .where(CreditLedger.organization_id == org_id)
            .order_by(CreditLedger.created_at.desc())
        )
        latest = res.scalars().first()
        return latest.balance_after if latest else 0

    @classmethod
    async def grant_credits(
        cls,
        db: AsyncSession,
        org_id: str,
        amount: int,
        reason: str = "PLAN_GRANT",
        ref_id: Optional[str] = None
    ) -> int:
        """
        Organizasyona AI kredisi yükler (Plan başlangıcı, ek paket, iade veya manuel).
        Dönen değer işlem sonrası yeni bakiyedir.
        """
        current_balance = await cls.get_credit_balance(db, org_id)
        new_balance = current_balance + amount
        entry = CreditLedger(
            organization_id=org_id,
            delta=amount,
            reason=reason,
            balance_after=new_balance,
            ref_id=ref_id
        )
        db.add(entry)
        await db.commit()
        return new_balance
