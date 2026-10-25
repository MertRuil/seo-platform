"""
Hiçbir organizasyona üye olmayan kullanıcılara kendi organizasyonunu ve free planı açar.

Kayıt akışı bunu artık kendisi yapıyor; bu betik önceki sürümde kayıt olmuş hesaplar için.
Varsayılan olarak yalnızca listeler, yazmak için --apply verin.
"""
import sys
import os
import argparse
import asyncio

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from packages.shared.database import engine
from packages.shared.models import Membership, User
from services.accounts.provisioning import ensure_personal_organization
from services.billing.entitlements import EntitlementGuard


async def provision(session: AsyncSession, apply: bool) -> int:
    orphans = (await session.execute(
        select(User).where(~select(Membership.id).where(Membership.user_id == User.id).exists()).order_by(User.created_at)
    )).scalars().all()
    print(f"Organizasyonu olmayan kullanıcı: {len(orphans)}")
    for user in orphans:
        if not apply:
            print(f"  [LİSTE] {user.id}")
            continue
        org = await ensure_personal_organization(session, user)
        await session.commit()
        await EntitlementGuard.get_or_create_subscription(session, org.id)
        print(f"  [OK] {user.id} -> {org.slug}")
    if orphans and not apply:
        print("Yazmak için --apply ile tekrar çalıştırın.")
    return len(orphans)


async def main():
    parser = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    parser.add_argument("--apply", action="store_true", help="Organizasyonları gerçekten oluştur")
    args = parser.parse_args()
    async with async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)() as session:
        await provision(session, args.apply)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
