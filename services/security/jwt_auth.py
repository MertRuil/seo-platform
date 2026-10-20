import hashlib
import time
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, Tuple
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from packages.config.settings import settings

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours
REFRESH_TOKEN_EXPIRE_DAYS = 30

security = HTTPBearer(auto_error=False)

# İptal kontrolü için kullanıcı durumu önbelleği: sub -> (son_geçerlilik, is_active, pwd_fp).
# Her istekte DB sorgusunu önler. Şifre değişikliği aynı süreçte anında, diğer worker/instance'larda
# en geç AUTH_STATE_TTL_SECONDS içinde etkili olur.
AUTH_STATE_TTL_SECONDS = 30
_AUTH_STATE_CACHE_MAX = 10000
_auth_state_cache: Dict[str, Tuple[float, bool, str]] = {}


def password_fingerprint(hashed_password: Optional[str]) -> str:
    return hashlib.sha256((hashed_password or "").encode("utf-8")).hexdigest()[:16]


def invalidate_user_auth_cache(user_id: str) -> None:
    _auth_state_cache.pop(user_id, None)


async def _load_user_auth_state(user_id: str) -> Optional[Tuple[bool, str]]:
    now = time.monotonic()
    cached = _auth_state_cache.get(user_id)
    if cached and cached[0] > now:
        return cached[1], cached[2]

    from sqlalchemy.future import select
    from packages.shared.database import AsyncSessionLocal
    from packages.shared.models import User

    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.id == user_id))).scalars().first()
    if not user:
        _auth_state_cache.pop(user_id, None)
        return None

    if len(_auth_state_cache) >= _AUTH_STATE_CACHE_MAX:
        expired = [k for k, v in _auth_state_cache.items() if v[0] <= now]
        for key in expired or list(_auth_state_cache)[:1000]:
            _auth_state_cache.pop(key, None)
    state = (bool(user.is_active), password_fingerprint(user.hashed_password))
    _auth_state_cache[user_id] = (now + AUTH_STATE_TTL_SECONDS, *state)
    return state

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.APP_SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(data: Dict[str, Any]) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.APP_SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.APP_SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_user_payload(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_token(credentials.credentials)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if payload.get("auth_source") == "nextjs_local" and settings.is_production_like:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Local fallback tokens are not accepted in production backend",
            headers={"WWW-Authenticate": "Bearer"},
        )
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token subject missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Revocation check: if token includes password fingerprint (pwd_fp), verify user is still active and password unchanged
    pwd_fp = payload.get("pwd_fp")
    if pwd_fp:
        state = await _load_user_auth_state(sub)
        if state is None or not state[0]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is inactive or no longer exists",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if state[1] != pwd_fp:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been invalidated due to password change",
                headers={"WWW-Authenticate": "Bearer"},
            )

    return payload

