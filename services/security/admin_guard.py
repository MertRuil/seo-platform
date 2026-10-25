from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from packages.shared.database import get_db
from packages.shared.models import User
from services.security.jwt_auth import get_current_user_payload


async def is_platform_admin(db: AsyncSession, payload: dict) -> bool:
    """Token'daki is_admin alanına değil veritabanına bakar: yetki kaldırıldığı an geçersiz olur."""
    if payload.get("auth_source") == "nextjs_local":
        return False
    user = (await db.execute(select(User).where(User.id == payload.get("sub")))).scalars().first()
    return bool(user and user.is_active and user.is_platform_admin)


async def require_platform_admin(
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
) -> User:
    # Next.js'in kendi ürettiği token'lar arka uçtaki kullanıcıyı kanıtlamaz; yönetim uçlarında hiçbir ortamda geçmez.
    if payload.get("auth_source") == "nextjs_local":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Yönetim uçları yalnızca arka uç oturumuyla kullanılabilir.")
    user = (await db.execute(select(User).where(User.id == payload.get("sub")))).scalars().first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Hesap pasif veya bulunamadı.")
    if not user.is_platform_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bu işlem yalnızca platform yöneticilerine açıktır.")
    return user
