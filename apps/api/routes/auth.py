from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from packages.shared.database import get_db
from packages.shared.models import User
from typing import Dict
from packages.contracts.auth import (
    UserRegisterRequest, UserLoginRequest, TokenResponse, UserResponse,
    ForgotPasswordRequest, ForgotPasswordResponse, ResetPasswordRequest, OAuthLoginRequest
)
from services.security.crypto import hash_password, verify_password
from services.security.jwt_auth import create_access_token, create_refresh_token, get_current_user_payload

router = APIRouter(prefix="/auth", tags=["Authentication"])

# In-memory tracking of failed login attempts per email
FAILED_ATTEMPTS: Dict[str, int] = {}
RESET_TOKENS: Dict[str, str] = {}  # token -> email

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(req: UserRegisterRequest, db: AsyncSession = Depends(get_db)):
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
    clean_email = req.email.strip().lower()
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalars().first()

    if not user or not verify_password(req.password, user.hashed_password):
        FAILED_ATTEMPTS[clean_email] = FAILED_ATTEMPTS.get(clean_email, 0) + 1
        attempts = FAILED_ATTEMPTS[clean_email]
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
    FAILED_ATTEMPTS.pop(clean_email, None)

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

    import uuid
    reset_token = f"rst_{uuid.uuid4().hex[:16]}"
    RESET_TOKENS[reset_token] = clean_email
    FAILED_ATTEMPTS.pop(clean_email, None)

    return ForgotPasswordResponse(
        success=True,
        message=f"{clean_email} adresine şifre sıfırlama bağlantısı gönderildi.",
        reset_token=reset_token
    )

@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    email = RESET_TOKENS.get(req.token)
    if not email:
        raise HTTPException(status_code=400, detail="Geçersiz veya süresi dolmuş sıfırlama bağlantısı.")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    user.hashed_password = hash_password(req.new_password)
    await db.commit()
    RESET_TOKENS.pop(req.token, None)
    FAILED_ATTEMPTS.pop(email, None)

    return {"success": True, "message": "Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yapabilirsiniz."}

@router.post("/oauth", response_model=TokenResponse)
async def oauth_login(req: OAuthLoginRequest, db: AsyncSession = Depends(get_db)):
    provider = req.provider.lower()
    email = req.email or f"{provider}_user@seo-platform.local"
    full_name = req.full_name or f"{provider.capitalize()} Kullanıcısı"

    clean_email = email.strip().lower()
    result = await db.execute(select(User).where(User.email == clean_email))
    user = result.scalars().first()

    if not user:
        user = User(
            email=clean_email,
            hashed_password=hash_password("OAuthRandomPass999!"),
            full_name=full_name,
            is_active=True
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    FAILED_ATTEMPTS.pop(clean_email, None)

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
