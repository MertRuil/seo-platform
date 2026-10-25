import re
import secrets
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from packages.shared.models import Membership, Organization, User

_TR_ASCII = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.translate(_TR_ASCII).lower()).strip("-")
    return slug[:48] or "calisma-alani"


def default_organization_name(user: User) -> str:
    return (user.full_name or "").strip() or user.email.split("@")[0]


async def _unique_slug(db: AsyncSession, base: str) -> str:
    slug = base
    while (await db.execute(select(Organization.id).where(Organization.slug == slug))).first():
        slug = f"{base}-{secrets.token_hex(2)}"
    return slug


async def create_owned_organization(db: AsyncSession, user_id: str, name: str, slug: Optional[str] = None) -> Organization:
    """Organizasyonu ve kullanıcının OWNER üyeliğini ekler; commit ve abonelik çağırana kalır."""
    org = Organization(name=name, slug=slug or await _unique_slug(db, slugify(name)))
    db.add(org)
    await db.flush()
    db.add(Membership(user_id=user_id, organization_id=org.id, role="OWNER"))
    await db.flush()
    return org


async def ensure_personal_organization(db: AsyncSession, user: User) -> Optional[Organization]:
    """Hiçbir organizasyona üye olmayan kullanıcıya kendi organizasyonunu açar; üyeliği varsa None döner."""
    has_membership = (await db.execute(select(Membership.id).where(Membership.user_id == user.id).limit(1))).first()
    if has_membership:
        return None
    return await create_owned_organization(db, user.id, default_organization_name(user))
