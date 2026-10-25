import uuid

from packages.shared.database import AsyncSessionLocal, Base, engine
from packages.shared.models import User
from services.security.crypto import hash_password
from services.security.jwt_auth import create_access_token, password_fingerprint


async def create_user_token(is_platform_admin: bool = False, is_active: bool = True, claims: dict | None = None):
    """Veritabanında gerçek bir kullanıcı oluşturur; (user_id, token) döner. Yetki kontrolleri veritabanına baktığı için gerekli."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as db:
        user = User(
            email=f"u-{uuid.uuid4().hex[:10]}@test-calpeo.com",
            hashed_password=hash_password("Password123!"),
            is_platform_admin=is_platform_admin,
            is_active=is_active,
        )
        db.add(user)
        await db.commit()
        # Giriş ucunun ürettiği token gibi pwd_fp taşır; pasifleştirme ve şifre değişimi iptali buna bakar
        token = create_access_token({"sub": user.id, "pwd_fp": password_fingerprint(user.hashed_password), **(claims or {})})
        return user.id, token
