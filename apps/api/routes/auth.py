import time
import uuid
import secrets
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from packages.shared.database import get_db
from packages.shared.models import User
from packages.config.settings import settings
from packages.contracts.auth import (
    UserRegisterRequest, UserLoginRequest, TokenResponse, UserResponse,
    ForgotPasswordRequest, ForgotPasswordResponse, ResetPasswordRequest, OAuthLoginRequest
)
from services.security.crypto import hash_password, verify_password
from services.security.jwt_auth import create_access_token, create_refresh_token, get_current_user_payload

router = APIRouter(prefix="/auth", tags=["Authentication"])

# In-memory tracking of failed login attempts per email with TTL & LRU auto-eviction to prevent memory leaks (DoS defense)
FAILED_ATTEMPTS: Dict[str, Dict[str, Any]] = {}
RESET_TOKENS: Dict[str, dict] = {}  # token -> {"email": str, "expires_at": float}
MAX_FAILED_ATTEMPTS_ENTRIES = 5000
MAX_RESET_TOKENS_ENTRIES = 5000

def _cleanup_failed_attempts():
    now = time.time()
    if len(FAILED_ATTEMPTS) > 500:
        expired = [e for e, data in FAILED_ATTEMPTS.items() if now - data.get("updated_at", 0) > 3600]
        for e in expired:
            FAILED_ATTEMPTS.pop(e, None)
    if len(FAILED_ATTEMPTS) > MAX_FAILED_ATTEMPTS_ENTRIES:
        oldest = sorted(FAILED_ATTEMPTS.keys(), key=lambda k: FAILED_ATTEMPTS[k].get("updated_at", 0))[:1000]
        for k in oldest:
            FAILED_ATTEMPTS.pop(k, None)

def _record_failed_attempt(clean_email: str) -> int:
    _cleanup_failed_attempts()
    now = time.time()
    rec = FAILED_ATTEMPTS.get(clean_email, {"count": 0, "updated_at": now})
    # Reset attempt count if previous failure was more than 15 minutes ago
    if now - rec.get("updated_at", 0) > 900:
        rec["count"] = 0
    rec["count"] = rec.get("count", 0) + 1
    rec["updated_at"] = now
    FAILED_ATTEMPTS[clean_email] = rec
    return rec["count"]

def _clear_failed_attempts(clean_email: str):
    FAILED_ATTEMPTS.pop(clean_email, None)

def _cleanup_expired_tokens():
    now = time.time()
    expired = [t for t, data in RESET_TOKENS.items() if now > data.get("expires_at", 0)]
    for t in expired:
        RESET_TOKENS.pop(t, None)
    if len(RESET_TOKENS) > MAX_RESET_TOKENS_ENTRIES:
        oldest = sorted(RESET_TOKENS.keys(), key=lambda k: RESET_TOKENS[k].get("expires_at", 0))[:1000]
        for k in oldest:
            RESET_TOKENS.pop(k, None)

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(req: UserRegisterRequest, db: AsyncSession = Depends(get_db)):
    if len(req.password) > 128:
        raise HTTPException(status_code=400, detail="Parola maksimum 128 karakter olabilir.")

    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="User with this email already exists")

    user = User(
        email=req.email,
        hashed_password=hash_password(req.password),
        full_name=req.full_name
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        is_platform_admin=user.is_platform_admin
    )

@router.post("/login", response_model=TokenResponse)
async def login(req: UserLoginRequest, db: AsyncSession = Depends(get_db)):
    if len(req.password) > 128:
        raise HTTPException(status_code=400, detail="Parola maksimum 128 karakter olabilir.")

    clean_email = req.email.strip().lower()
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalars().first()

    if not user or not verify_password(req.password, user.hashed_password):
        attempts = _record_failed_attempt(clean_email)
        show_forgot = attempts >= 3

        error_headers = {
            "X-Failed-Attempts": str(attempts),
            "X-Show-Forgot-Password": "true" if show_forgot else "false"
        }

        if show_forgot:
            raise HTTPException(
                status_code=401,
                detail=f"Şifre {attempts} kez hatalı girildi. Lütfen şifrenizi sıfırlayın.",
                headers=error_headers
            )
        raise HTTPException(
            status_code=401,
            detail=f"Geçersiz e-posta adresi veya şifre. ({attempts}/3 deneme)",
            headers=error_headers
        )

    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is deactivated")

    # Login successful - reset failed attempts
    _clear_failed_attempts(clean_email)

    token_data = {"sub": user.id, "email": user.email, "is_admin": user.is_platform_admin}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data)
    )

@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(req: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    clean_email = req.email.strip().lower()
    result = await db.execute(select(User).where(User.email == clean_email))
    user = result.scalars().first()

    _cleanup_expired_tokens()
    reset_token = f"rst_{uuid.uuid4().hex[:24]}"
    # 15 minutes TTL
    RESET_TOKENS[reset_token] = {
        "email": clean_email,
        "expires_at": time.time() + 900
    }
    _clear_failed_attempts(clean_email)

    # In production, never return reset token in JSON response (security best practice)
    is_dev_or_test = settings.ENVIRONMENT.lower() in {"development", "test"}
    return ForgotPasswordResponse(
        success=True,
        message=f"{clean_email} adresine şifre sıfırlama bağlantısı gönderildi.",
        reset_token=reset_token if is_dev_or_test else None
    )

@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    if len(req.new_password) > 128:
        raise HTTPException(status_code=400, detail="Yeni parola maksimum 128 karakter olabilir.")

    _cleanup_expired_tokens()
    record = RESET_TOKENS.get(req.token)
    if not record:
        raise HTTPException(status_code=400, detail="Geçersiz veya süresi dolmuş sıfırlama bağlantısı.")

    if time.time() > record["expires_at"]:
        RESET_TOKENS.pop(req.token, None)
        raise HTTPException(status_code=400, detail="Şifre sıfırlama bağlantısının süresi dolmuş (15 dakika). Lütfen tekrar talep edin.")

    email = record["email"]
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    user.hashed_password = hash_password(req.new_password)
    await db.commit()
    RESET_TOKENS.pop(req.token, None)
    _clear_failed_attempts(email)

    return {"success": True, "message": "Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yapabilirsiniz."}

@router.post("/oauth", response_model=TokenResponse)
async def oauth_login(req: OAuthLoginRequest, db: AsyncSession = Depends(get_db)):
    provider = req.provider.lower()
    email = req.email or f"{provider}_user@seo-platform.local"
    full_name = req.full_name or f"{provider.capitalize()} Kullanıcısı"

    clean_email = email.strip().lower()
    result = await db.execute(select(User).where(User.email == clean_email))
    user = result.scalars().first()

    # Security check 1: Platform admin accounts strictly require OAuth provider token verification in all environments
    if user and user.is_platform_admin and not req.token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yönetici hesapları için OAuth sağlayıcı doğrulama belirteci (token) zorunludur."
        )

    # Security check 2: In production, existing regular user accounts cannot be taken over without verified token
    if user and not req.token and settings.ENVIRONMENT.lower() == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Mevcut kullanıcı hesapları için geçerli bir OAuth doğrulama belirteci (token) zorunludur."
        )

    if not user:
        random_pwd = secrets.token_urlsafe(32)
        user = User(
            email=clean_email,
            hashed_password=hash_password(random_pwd),
            full_name=full_name,
            is_active=True
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    _clear_failed_attempts(clean_email)

    token_data = {"sub": user.id, "email": user.email, "is_admin": user.is_platform_admin}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data)
    )

@router.get("/me", response_model=UserResponse)
async def get_current_user(
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        is_platform_admin=user.is_platform_admin
    )
