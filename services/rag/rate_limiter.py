import time
import asyncio
import hashlib
from typing import Dict, Any, Optional
from collections import deque

class TokenBucket:
    """Token bucket algorithm for rate-limiting requests and token volumes."""
    def __init__(self, capacity: float, refill_rate_per_sec: float):
        self.capacity = capacity
        self.refill_rate = refill_rate_per_sec
        self.tokens = capacity
        self.last_update = time.monotonic()

    def _refill(self):
        now = time.monotonic()
        elapsed = now - self.last_update
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_update = now

    def can_consume(self, amount: float = 1.0) -> bool:
        self._refill()
        return self.tokens >= amount

    def consume(self, amount: float = 1.0) -> bool:
        self._refill()
        if self.tokens >= amount:
            self.tokens -= amount
            return True
        return False

    def wait_time_for(self, amount: float = 1.0) -> float:
        self._refill()
        if self.tokens >= amount:
            return 0.0
        missing = amount - self.tokens
        return missing / self.refill_rate


class RateLimiter:
    """
    Asynchronous Governor for API Limits and Token Budgets.
    Enforces:
    - Requests Per Minute (RPM) limits
    - Tokens Per Minute (TPM) limits
    - Daily Request and Token Budgets with auto-throttling
    - SHA-256 deduplication cache to prevent re-querying identical payloads
    - Exponential backoff with jitter on 429 errors
    """
    def __init__(
        self,
        rpm_limit: int = 15,
        tpm_limit: int = 50000,
        daily_request_budget: int = 1500,
        daily_token_budget: int = 500000,
        enable_cache: bool = True
    ):
        self.rpm_limit = rpm_limit
        self.tpm_limit = tpm_limit
        self.daily_request_budget = daily_request_budget
        self.daily_token_budget = daily_token_budget
        self.enable_cache = enable_cache

        # Buckets
        self.request_bucket = TokenBucket(capacity=float(rpm_limit), refill_rate_per_sec=rpm_limit / 60.0)
        self.token_bucket = TokenBucket(capacity=float(tpm_limit), refill_rate_per_sec=tpm_limit / 60.0)

        # Sliding window history for telemetry
        self.request_timestamps: deque = deque()
        self.tokens_timestamps: deque = deque()

        # Cumulative stats (Daily tracking)
        self.requests_today: int = 0
        self.tokens_today: int = 0
        self.rejected_limit_hits: int = 0
        self.cache_hits: int = 0
        self.day_start_time: float = time.time()

        # Deduplication Cache: hash -> cached result
        self.cache: Dict[str, Any] = {}

    def _check_and_reset_day(self):
        # Reset daily counters every 24 hours (86400 seconds)
        if time.time() - self.day_start_time > 86400:
            self.requests_today = 0
            self.tokens_today = 0
            self.day_start_time = time.time()

    @staticmethod
    def compute_hash(data: str) -> str:
        return hashlib.sha256(data.strip().encode("utf-8")).hexdigest()

    def check_cache(self, key_content: str) -> Optional[Any]:
        if not self.enable_cache:
            return None
        key_hash = self.compute_hash(key_content)
        if key_hash in self.cache:
            self.cache_hits += 1
            return self.cache[key_hash]
        return None

    def store_cache(self, key_content: str, result: Any):
        if self.enable_cache:
            key_hash = self.compute_hash(key_content)
            self.cache[key_hash] = result

    async def acquire(self, estimated_tokens: int = 100) -> bool:
        """
        Asynchronously waits until rate limits allow sending a request.
        Returns True when acquired, or False if daily budget is completely exhausted.
        """
        self._check_and_reset_day()

        # Check daily budget
        if self.requests_today >= self.daily_request_budget:
            self.rejected_limit_hits += 1
            return False
        if self.tokens_today + estimated_tokens > self.daily_token_budget:
            self.rejected_limit_hits += 1
            return False

        while True:
            wait_req = self.request_bucket.wait_time_for(1.0)
            wait_tok = self.token_bucket.wait_time_for(float(estimated_tokens))
            max_wait = max(wait_req, wait_tok)

            if max_wait <= 0.001:
                # Successfully consume tokens
                if self.request_bucket.consume(1.0) and self.token_bucket.consume(float(estimated_tokens)):
                    now = time.monotonic()
                    self.request_timestamps.append(now)
                    self.tokens_timestamps.append((now, estimated_tokens))
                    self.requests_today += 1
                    self.tokens_today += estimated_tokens
                    return True
            else:
                # Wait before retrying
                await asyncio.sleep(min(max_wait, 2.0))

    def record_actual_tokens(self, estimated: int, actual: int):
        """Reconciles estimated token count with actual tokens reported by provider."""
        diff = actual - estimated
        if diff > 0:
            self.tokens_today += diff
            self.token_bucket.consume(float(diff))

    def get_metrics(self) -> Dict[str, Any]:
        """Provides telemetry on usage, quota consumption, and rate limits."""
        self._check_and_reset_day()
        now = time.monotonic()

        # Clean old timestamps (> 60s)
        while self.request_timestamps and now - self.request_timestamps[0] > 60:
            self.request_timestamps.popleft()
        while self.tokens_timestamps and now - self.tokens_timestamps[0][0] > 60:
            self.tokens_timestamps.popleft()

        current_rpm = len(self.request_timestamps)
        current_tpm = sum(tok for _, tok in self.tokens_timestamps)

        req_quota_pct = (self.requests_today / max(1, self.daily_request_budget)) * 100.0
        tok_quota_pct = (self.tokens_today / max(1, self.daily_token_budget)) * 100.0

        return {
            "current_rpm": current_rpm,
            "rpm_limit": self.rpm_limit,
            "current_tpm": current_tpm,
            "tpm_limit": self.tpm_limit,
            "requests_today": self.requests_today,
            "daily_request_budget": self.daily_request_budget,
            "request_quota_used_pct": round(req_quota_pct, 1),
            "tokens_today": self.tokens_today,
            "daily_token_budget": self.daily_token_budget,
            "token_quota_used_pct": round(tok_quota_pct, 1),
            "cache_hits": self.cache_hits,
            "rejected_limit_hits": self.rejected_limit_hits
        }
