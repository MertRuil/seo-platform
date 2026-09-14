import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException
from services.security.rate_limiter import RateLimiter

@pytest.mark.anyio
async def test_sliding_window_rate_limiter_allows_under_limit():
    limiter = RateLimiter(max_requests=3, window_seconds=10, scope="unit_test_under")
    req = MagicMock()
    req.headers = {}
    req.client.host = "192.168.1.100"
    req.app.state = MagicMock(spec=[])  # no redis

    # 3 requests should succeed
    for _ in range(3):
        res = await limiter(req)
        assert res is True


@pytest.mark.anyio
async def test_sliding_window_rate_limiter_blocks_over_limit():
    limiter = RateLimiter(max_requests=2, window_seconds=10, scope="unit_test_over")
    req = MagicMock()
    req.headers = {}
    req.client.host = "192.168.1.101"
    req.app.state = MagicMock(spec=[])

    # First 2 succeed
    await limiter(req)
    await limiter(req)

    # 3rd must raise 429
    with pytest.raises(HTTPException) as exc_info:
        await limiter(req)

    assert exc_info.value.status_code == 429
    assert "Retry-After" in exc_info.value.headers
    assert "İstek limiti aşıldı" in exc_info.value.detail
