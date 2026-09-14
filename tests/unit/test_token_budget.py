import pytest
from packages.shared.models import Organization
from services.security.token_budget import TokenBudgetService, TokenBudgetExceededException


@pytest.mark.anyio
def test_token_estimation_heuristic():
    prompt = "Analyze the technical SEO health of this homepage."
    completion = "Recommendation: Ensure canonical URL matches destination."
    tokens = TokenBudgetService.estimate_tokens(prompt, completion)
    assert tokens >= 25
    assert isinstance(tokens, int)


@pytest.mark.anyio
async def test_token_budget_exceeded_raises():
    org = Organization(
        id="org_budget_test",
        name="Budget Limited Org",
        slug="budget-limited-org",
        monthly_token_budget=1000,
        tokens_used_this_month=950
    )

    from unittest.mock import AsyncMock, MagicMock
    db = AsyncMock()
    mock_res = MagicMock()
    mock_res.scalars().first.return_value = org
    db.execute.return_value = mock_res

    # 100 estimated tokens would exceed 1000 limit (950 + 100 > 1000)
    with pytest.raises(TokenBudgetExceededException) as exc_info:
        await TokenBudgetService.check_budget(db, org.id, estimated_tokens=100)

    assert exc_info.value.status_code == 429
    assert "aylık AI jeton/token bütçesini aştı" in exc_info.value.detail


@pytest.mark.anyio
async def test_token_budget_records_usage():
    org = Organization(
        id="org_record_test",
        name="Record Test Org",
        slug="record-test-org",
        monthly_token_budget=50000,
        tokens_used_this_month=1000
    )

    from unittest.mock import AsyncMock, MagicMock
    db = AsyncMock()
    mock_res = MagicMock()
    mock_res.scalars().first.return_value = org
    db.execute.return_value = mock_res

    total_used = await TokenBudgetService.record_usage(db, org.id, tokens_used=500)
    assert total_used == 1500
    assert org.tokens_used_this_month == 1500
    db.commit.assert_called_once()
