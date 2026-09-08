import pytest
import asyncio
from services.rag.rate_limiter import RateLimiter, TokenBucket

def test_token_bucket_consume_and_refill():
    bucket = TokenBucket(capacity=10.0, refill_rate_per_sec=5.0)
    assert bucket.can_consume(5.0)
    assert bucket.consume(5.0)
    assert bucket.tokens <= 5.1
    # Cannot consume 10 when 5 remain
    assert not bucket.consume(10.0)

@pytest.mark.anyio
async def test_rate_limiter_acquire_and_daily_budget():
    limiter = RateLimiter(
        rpm_limit=60,
        tpm_limit=10000,
        daily_request_budget=5,
        daily_token_budget=1000
    )

    # First 5 acquisitions succeed
    for _ in range(5):
        acquired = await limiter.acquire(estimated_tokens=50)
        assert acquired is True

    # 6th acquisition should be blocked by daily budget
    exhausted = await limiter.acquire(estimated_tokens=50)
    assert exhausted is False
    assert limiter.rejected_limit_hits == 1

def test_rate_limiter_deduplication_cache():
    limiter = RateLimiter()
    content = "Google requires canonical tags to consolidate URLs."

    assert limiter.check_cache(content) is None

    limiter.store_cache(content, {"status": "VERIFIED", "score": 1.0})
    cached = limiter.check_cache(content)
    assert cached is not None
    assert cached["status"] == "VERIFIED"
    assert limiter.cache_hits == 1

def test_rate_limiter_metrics():
    limiter = RateLimiter(rpm_limit=15, daily_request_budget=100)
    metrics = limiter.get_metrics()
    assert "current_rpm" in metrics
    assert "daily_request_budget" in metrics
    assert metrics["rpm_limit"] == 15
    assert metrics["daily_request_budget"] == 100
    assert metrics["request_quota_used_pct"] == 0.0
