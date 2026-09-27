import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from packages.shared.models import OAuthCredential
from services.security.crypto import decrypt_secret, encrypt_secret
from packages.config.settings import settings

logger = logging.getLogger("integrations.google_token")

MOCK_FIXTURE_TOKENS = {"mock_token", "mock_token_123"}

def is_fixture_token(token: Optional[str]) -> bool:
    """
    Centralized check for Google OAuth fixture/mock tokens.
    Recognizes exact mock tokens ('mock_token', 'mock_token_123')
    as well as prefixed mock tokens ('mock-gsc-token-...', 'mock-gsc-refresh-...').
    """
    if not token:
        return False
    clean = token.strip()
    if clean in MOCK_FIXTURE_TOKENS:
        return True
    if clean.lower().startswith("mock-") or "mock" in clean.lower():
        return True
    return False

async def ensure_valid_google_token(cred: OAuthCredential, db: AsyncSession) -> Optional[str]:
    """
    Checks if Google OAuth credential token is valid and unexpired.
    If the access token has expired (or is close to expiring within 2 minutes),
    exchanges the stored encrypted_refresh_token with Google to obtain a fresh access token.
    Updates the database with the new token and expiry.
    Returns the valid raw access token, or None if refresh fails.
    """
    if not cred or not cred.encrypted_access_token:
        return None

    try:
        raw_access = decrypt_secret(cred.encrypted_access_token)
    except Exception as e:
        logger.error(f"Failed to decrypt Google access token: {e}")
        return None

    now = datetime.now(timezone.utc)
    expiry = cred.token_expiry
    if expiry and expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)

    # Check if token is still valid (with 2 minutes buffer)
    if expiry and expiry > (now + timedelta(seconds=120)):
        return raw_access

    # Token is expired or expiring soon; check for refresh token
    if not cred.encrypted_refresh_token:
        # If no refresh token and not expired yet, return raw_access
        if expiry and expiry > now:
            return raw_access
        logger.warning(f"Google OAuth token expired for org {cred.organization_id} and no refresh token found.")
        return None

    try:
        raw_refresh = decrypt_secret(cred.encrypted_refresh_token)
    except Exception as e:
        logger.error(f"Failed to decrypt Google refresh token: {e}")
        return None

    if not raw_refresh:
        return None

    # Handle fixture/mock tokens in dev or test
    if is_fixture_token(raw_refresh) or not settings.GOOGLE_OAUTH_CLIENT_SECRET:
        cred.token_expiry = now + timedelta(seconds=3600)
        await db.commit()
        return raw_access

    # Exchange refresh token with Google OAuth2 endpoint
    token_url = "https://oauth2.googleapis.com/token"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(token_url, data={
                "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
                "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
                "refresh_token": raw_refresh,
                "grant_type": "refresh_token"
            })
            if resp.status_code != 200:
                logger.error(f"Google OAuth token refresh failed (HTTP {resp.status_code}): {resp.text}")
                return None

            data = resp.json()
            new_access_token = data.get("access_token")
            if not new_access_token:
                logger.error("Google OAuth token refresh response missing access_token")
                return None

            expires_in = data.get("expires_in", 3600)
            cred.encrypted_access_token = encrypt_secret(new_access_token)
            cred.token_expiry = now + timedelta(seconds=expires_in)

            # Some responses may include a rotated refresh token
            new_refresh = data.get("refresh_token")
            if new_refresh:
                cred.encrypted_refresh_token = encrypt_secret(new_refresh)

            await db.commit()
            return new_access_token
    except Exception as e:
        logger.error(f"Exception during Google OAuth token refresh: {e}")
        return None
