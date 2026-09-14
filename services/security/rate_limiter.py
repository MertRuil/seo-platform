import time
import logging
from typing import Dict, List, Optional
from fastapi import Request, HTTPException, status
from packages.config.settings import settings

logger = logging.getLogger(__name__)

# Fallback in-memory store: key -> list of float timestamps
_MEMORY_STORE: Dict[str, List[float]] = {}
_LAST_CLEANUP: float = time.time()
MAX_MEMORY_KEYS = 10000


def _cleanup_memory_store():
    global _LAST_CLEANUP
    now = time.time()
    if now - _LAST_CLEANUP < 60:
        return
    _LAST_CLEANUP = now

    keys_to_delete = []
    for k, timestamps in list(_MEMORY_STORE.items()):
        # Filter timestamps older than 1 hour
        fresh = [t for t in timestamps if now - t < 3600]
        if not fresh:
            keys_to_delete.append(k)
        else:
            _MEMORY_STORE[k] = fresh

    for k in keys_to_delete:
        _MEMORY_STORE.pop(k, None)

    # Hard cap protection against unbounded memory growth
    if len(_MEMORY_STORE) > MAX_MEMORY_KEYS:
        # Evict oldest 20%
        sorted_keys = sorted(_MEMORY_STORE.keys(), key=lambda k: max(_MEMORY_STORE[k]) if _MEMORY_STORE[k] else 0)
        for k in sorted_keys[:2000]:
            _MEMORY_STORE.pop(k, None)


class RateLimiter:
    """
    Sliding-window rate limiter supporting Redis (when available) with
    in-memory fallback for resilient operation.
    """

    def __init__(self, max_requests: int = 60, window_seconds: int = 60, scope: str = "global"):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.scope = scope

    def _get_client_key(self, request: Request) -> str:
        # Prefer authenticated user ID if present in request state or authorization header
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
            try:
                from services.security.jwt_auth import decode_token
                payload = decode_token(token)
                sub = payload.get("sub")
                if sub:
                    return f"user:{sub}:{self.scope}"
            except Exception:
                pass

        # Otherwise use client IP
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        else:
            client_ip = request.client.host if request.client else "unknown"

        return f"ip:{client_ip}:{self.scope}"

    async def __call__(self, request: Request):
        key = self._get_client_key(request)
        now = time.time()

        # 1. Try Redis sliding window if available
        redis_client = getattr(request.app.state, "redis", None) if hasattr(request.app, "state") else None
        if redis_client:
            try:
                redis_key = f"ratelimit:{key}"
                pipe = redis_client.pipeline()
                # Remove timestamps older than window
                pipe.zremrangebyscore(redis_key, 0, now - self.window_seconds)
                # Count remaining
                pipe.zcard(redis_key)
                # Add current timestamp
                pipe.zadd(redis_key, {str(now): now})
                # Set TTL for key expiry
                pipe.expire(redis_key, self.window_seconds + 10)
                results = await pipe.execute()
                current_count = results[1]

                if current_count >= self.max_requests:
                    retry_after = self.window_seconds
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=f"İstek limiti aşıldı ({self.scope}). Lütfen {retry_after} saniye sonra tekrar deneyin.",
                        headers={"Retry-After": str(retry_after)}
                    )
                return True
            except HTTPException:
                raise
            except Exception as e:
                logger.warning(f"Redis rate limiter fallback to in-memory: {e}")

        # 2. In-memory sliding window
        _cleanup_memory_store()
        timestamps = _MEMORY_STORE.get(key, [])
        # Filter timestamps within sliding window
        valid_timestamps = [t for t in timestamps if now - t < self.window_seconds]

        if len(valid_timestamps) >= self.max_requests:
            earliest = min(valid_timestamps)
            retry_after = max(1, int(self.window_seconds - (now - earliest)))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"İstek limiti aşıldı ({self.scope}). Lütfen {retry_after} saniye sonra tekrar deneyin.",
                headers={"Retry-After": str(retry_after)}
            )

        valid_timestamps.append(now)
        _MEMORY_STORE[key] = valid_timestamps
        return True


# Pre-configured rate limiters for expensive endpoints
quick_audit_limiter = RateLimiter(max_requests=10, window_seconds=60, scope="quick_audit")
crawls_limiter = RateLimiter(max_requests=10, window_seconds=60, scope="crawls")
knowledge_ingest_limiter = RateLimiter(max_requests=15, window_seconds=60, scope="knowledge_ingest")
global_api_limiter = RateLimiter(max_requests=120, window_seconds=60, scope="global")
