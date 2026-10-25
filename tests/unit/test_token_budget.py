import pytest
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from packages.shared.database import Base
from packages.shared.models import Organization, UsageCounter
from services.billing.usage import UsageService
from services.security.token_budget import TokenBudgetService, TokenBudgetExceededException


@pytest.fixture
async def async_db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        yield session

    await engine.dispose()


async def _org(db: AsyncSession, org_id: str, budget: int, stale_used: int = 0) -> Organization:
    org = Organization(id=org_id, name=f"Org {org_id}", slug=org_id, monthly_token_budget=budget, tokens_used_this_month=stale_used)
    db.add(org)
    await db.commit()
    return org


def _previous_period():
    start, _ = UsageService.get_current_period()
    prev_start = datetime(start.year - 1, 12, 1, tzinfo=timezone.utc) if start.month == 1 else datetime(start.year, start.month - 1, 1, tzinfo=timezone.utc)
    return prev_start, start


@pytest.mark.anyio
def test_token_estimation_heuristic():
    prompt = "Analyze the technical SEO health of this homepage."
    completion = "Recommendation: Ensure canonical URL matches destination."
    tokens = TokenBudgetService.estimate_tokens(prompt, completion)
    assert tokens >= 25
    assert isinstance(tokens, int)


@pytest.mark.asyncio
async def test_token_budget_exceeded_raises(async_db: AsyncSession):
    await _org(async_db, "org_budget_test", budget=1000)
    await TokenBudgetService.record_usage(async_db, "org_budget_test", tokens_used=950)

    # 950 + 100 > 1000
    with pytest.raises(TokenBudgetExceededException) as exc_info:
        await TokenBudgetService.check_budget(async_db, "org_budget_test", estimated_tokens=100)

    assert exc_info.value.status_code == 429
    assert "aylık AI jeton/token bütçesini aştı" in exc_info.value.detail


@pytest.mark.asyncio
async def test_token_budget_records_usage_in_period_counter(async_db: AsyncSession):
    org = await _org(async_db, "org_record_test", budget=50000)

    assert await TokenBudgetService.record_usage(async_db, org.id, tokens_used=500, ref_type="TEST") == 500
    assert await TokenBudgetService.record_usage(async_db, org.id, tokens_used=250) == 750
    assert org.tokens_used_this_month == 750
    assert await UsageService.get_usage(async_db, org.id, "ai_tokens") == 750
    assert await TokenBudgetService.monthly_tokens(async_db, [org.id]) == {org.id: 750}


@pytest.mark.asyncio
async def test_last_month_usage_does_not_block_new_month(async_db: AsyncSession):
    # Eski sütun geçen ayın toplamını taşısa da bütçe bu ayın sayacından okunur.
    org = await _org(async_db, "org_rollover", budget=1000, stale_used=1000)
    prev_start, prev_end = _previous_period()
    async_db.add(UsageCounter(organization_id=org.id, metric="ai_tokens", period_start=prev_start, period_end=prev_end, used=1000))
    await async_db.commit()

    checked = await TokenBudgetService.check_budget(async_db, org.id, estimated_tokens=500)
    assert checked.tokens_used_this_month == 0
    assert await TokenBudgetService.monthly_tokens(async_db, [org.id]) == {}

