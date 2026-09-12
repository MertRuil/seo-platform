import logging
from typing import Dict, Any, Optional
import httpx
from fastapi import HTTPException, status
from packages.config.settings import settings

logger = logging.getLogger("security.oauth_verifier")

GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

async def verify_oauth_token(provider: str, token: str, expected_email: str) -> Dict[str, Any]:
    """
    Cryptographically verifies an OAuth provider token and ensures the verified
    email identity strictly matches the requested email.
    
    Raises HTTPException(401) on invalid tokens, expired tokens, or email mismatch.
    """
    clean_provider = provider.strip().lower()
    clean_expected_email = expected_email.strip().lower()

    if not token or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OAuth belirteci (token) eksik veya boş."
        )

    clean_token = token.strip()

    # Reject obvious dummy tokens in all environments
    if clean_token.lower() in ("x", "test", "token", "dummy", "fake", "123", "admin"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz veya sahte OAuth belirteci."
        )

    # Secure test token pattern allowed ONLY in 'test' environment when explicitly enabled
    if settings.ENVIRONMENT.lower() == "test" and getattr(settings, "ALLOW_TEST_OAUTH_TOKENS", False) is True:
        if clean_token.startswith("test-oauth-token:") or clean_token.startswith("mock-valid-token:"):
            # Format: test-oauth-token:expected_email
            parts = clean_token.split(":", 1)
            token_email = parts[1].strip().lower() if len(parts) > 1 else ""
            if token_email and token_email == clean_expected_email:
                return {
                    "email": token_email,
                    "email_verified": True,
                    "provider": clean_provider,
                    "is_test_token": True
                }
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"OAuth test belirtecindeki e-posta ({token_email}) ile istekteki e-posta ({clean_expected_email}) eşleşmiyor."
            )

    if clean_provider == "google":
        return await _verify_google_token(clean_token, clean_expected_email)
    elif clean_provider in ("github", "microsoft"):
        return await _verify_generic_bearer_token(clean_provider, clean_token, clean_expected_email)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Desteklenmeyen OAuth sağlayıcısı: '{provider}'."
        )

def _check_google_audience(data: Dict[str, Any]):
    """Guards against token substitution attacks by enforcing client_id / audience matching."""
    expected_aud = settings.GOOGLE_OAUTH_CLIENT_ID
    token_aud = data.get("aud")
    if expected_aud:
        if token_aud != expected_aud:
            logger.warning(f"Google token audience mismatch. Expected: {expected_aud}, got: {token_aud}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google belirteci hedef kitle (aud) uyuşmazlığı: Belirteç bu uygulama için üretilmemiş."
            )
    elif settings.ENVIRONMENT.lower() == "production":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Sunucu güvenlik yapılandırma hatası: GOOGLE_OAUTH_CLIENT_ID üretim ortamında tanımlanmalıdır."
        )

async def _verify_google_token(token: str, expected_email: str) -> Dict[str, Any]:
    """Verifies Google ID Token via Google Tokeninfo or Access Token via Userinfo with audience check."""
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            # 1. Try as ID Token first (standard for OpenID Connect)
            resp = await client.get(GOOGLE_TOKENINFO_URL, params={"id_token": token})
            if resp.status_code == 200:
                data = resp.json()
                verified_email = (data.get("email") or "").strip().lower()
                email_verified = data.get("email_verified") in (True, "true", "True", 1, "1")

                if not email_verified:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Google hesabında e-posta adresi doğrulanmamış."
                    )

                if not verified_email:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Google belirtecinde geçerli e-posta adresi bulunamadı."
                    )

                if verified_email != expected_email:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail=f"Google belirtecindeki e-posta ({verified_email}) ile istekteki e-posta ({expected_email}) eşleşmiyor."
                    )

                _check_google_audience(data)
                return data

            # 2. Fallback: Try as OAuth2 Access Token via Tokeninfo (which returns aud and email)
            resp_access = await client.get(
                GOOGLE_TOKENINFO_URL,
                params={"access_token": token}
            )
            if resp_access.status_code == 200:
                data = resp_access.json()
                verified_email = (data.get("email") or "").strip().lower()
                email_verified = data.get("email_verified") in (True, "true", "True", 1, "1")

                if not email_verified:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Google hesabında e-posta adresi doğrulanmamış."
                    )

                if not verified_email:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Google belirtecinde geçerli e-posta adresi bulunamadı."
                    )

                if verified_email != expected_email:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail=f"Google belirtecindeki e-posta ({verified_email}) ile istekteki e-posta ({expected_email}) eşleşmiyor."
                    )

                _check_google_audience(data)
                return data

            logger.warning(f"Google token verification failed with status {resp.status_code}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google OAuth belirteci doğrulanamadı veya süresi dolmuş."
            )

    except httpx.RequestError as e:
        logger.error(f"Network error contacting Google OAuth endpoints: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Google kimlik doğrulama sunucusuna ulaşılamadı."
        )

async def _verify_generic_bearer_token(provider: str, token: str, expected_email: str) -> Dict[str, Any]:
    """Verifies token against provider user API, including fetching verified emails for GitHub private profiles."""
    url = "https://api.github.com/user" if provider == "github" else "https://graph.microsoft.com/v1.0/me"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            headers = {"Authorization": f"Bearer {token}", "User-Agent": "SEO-Platform-Auth"}
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"{provider.capitalize()} belirteci doğrulanamadı."
                )
            data = resp.json()

            # Token substitution guard: a GitHub token minted for another OAuth app must not log users in here
            if provider == "github":
                expected_client = settings.GITHUB_OAUTH_CLIENT_ID
                token_client = resp.headers.get("x-oauth-client-id")
                if expected_client:
                    if token_client != expected_client:
                        raise HTTPException(
                            status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="GitHub belirteci bu uygulama için üretilmemiş (client id uyuşmazlığı)."
                        )
                elif settings.ENVIRONMENT.lower() in {"production", "prod"}:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Sunucu güvenlik yapılandırma hatası: GITHUB_OAUTH_CLIENT_ID üretim ortamında tanımlanmalıdır."
                    )

            verified_email = (data.get("email") or data.get("userPrincipalName") or "").strip().lower()

            # If GitHub user email is hidden / private in profile, fetch /user/emails
            if provider == "github" and not verified_email:
                emails_resp = await client.get("https://api.github.com/user/emails", headers=headers)
                if emails_resp.status_code == 200:
                    emails_data = emails_resp.json()
                    primary_emails = [
                        e.get("email", "").strip().lower()
                        for e in emails_data
                        if isinstance(e, dict) and e.get("primary") and e.get("verified")
                    ]
                    if primary_emails:
                        verified_email = primary_emails[0]

            # STRICT CHECK: If verified_email is missing or empty, it MUST FAIL!
            if not verified_email:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"{provider.capitalize()} hesabında doğrulanmış birincil e-posta adresi bulunamadı."
                )

            # STRICT CHECK: Verified email must match expected email!
            if verified_email != expected_email:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"{provider.capitalize()} hesabındaki e-posta ({verified_email}) ile istekteki e-posta ({expected_email}) eşleşmiyor."
                )
            return data
    except httpx.RequestError as e:
        logger.error(f"Network error contacting {provider} OAuth endpoints: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"{provider.capitalize()} kimlik doğrulama sunucusuna ulaşılamadı."
        )
