from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from packages.shared.database import get_db
from packages.shared.models import Organization, Membership, User
from packages.contracts.organization import (
    OrganizationCreateRequest, OrganizationResponse, AddMemberRequest, MemberResponse
)
from services.security.jwt_auth import get_current_user_payload

router = APIRouter(prefix="/organizations", tags=["Organizations"])

@router.post(
    "",
    response_model=OrganizationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Yeni Organizasyon Oluştur",
    description="Sistem üzerinde yeni bir organizasyon oluşturur. İsteği gönderen kullanıcı otomatik olarak bu organizasyonun 'OWNER' (Sahip) rolüne atanır."
)
async def create_organization(
    req: OrganizationCreateRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    # Slug benzersizlik kontrolü
    result = await db.execute(select(Organization).where(Organization.slug == req.slug))
    if result.scalars().first():
        raise HTTPException(
            status_code=400,
            detail="Bu benzersiz kod adı (slug) ile kaydedilmiş bir organizasyon zaten mevcut."
        )

    org = Organization(name=req.name, slug=req.slug)
    db.add(org)
    await db.flush()

    # Oluşturan kullanıcı OWNER yapılır
    membership = Membership(
        user_id=user_id,
        organization_id=org.id,
        role='OWNER'
    )
    db.add(membership)
    await db.commit()
    await db.refresh(org)

    return OrganizationResponse(
        id=org.id,
        name=org.name,
        slug=org.slug,
        monthly_token_budget=org.monthly_token_budget,
        tokens_used_this_month=org.tokens_used_this_month
    )

@router.get(
    "",
    response_model=List[OrganizationResponse],
    summary="Kullanıcının Organizasyonlarını Listele",
    description="Oturum açmış mevcut kullanıcının üye veya sahip olduğu tüm organizasyonların listesini döndürür."
)
async def list_organizations(
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    query = (
        select(Organization)
        .join(Membership, Membership.organization_id == Organization.id)
        .where(Membership.user_id == user_id)
    )
    result = await db.execute(query)
    orgs = result.scalars().all()
    return [
        OrganizationResponse(
            id=o.id,
            name=o.name,
            slug=o.slug,
            monthly_token_budget=o.monthly_token_budget,
            tokens_used_this_month=o.tokens_used_this_month
        )
        for o in orgs
    ]

@router.post(
    "/{org_id}/members",
    response_model=MemberResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Organizasyona Üye Davet Et / Ekle",
    description="Belirtilen organizasyona yeni bir kullanıcı ekler. Bu işlemi yalnızca organizasyon SAHİBİ (OWNER) veya YÖNETİCİSİ (ADMIN) gerçekleştirebilir."
)
async def add_member(
    org_id: str,
    req: AddMemberRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    # İsteği yapan kullanıcının OWNER veya ADMIN yetkisi var mı?
    member_check = await db.execute(
        select(Membership).where(
            Membership.organization_id == org_id,
            Membership.user_id == user_id,
            Membership.role.in_(['OWNER', 'ADMIN'])
        )
    )
    current_mem = member_check.scalars().first()
    if not current_mem:
        raise HTTPException(
            status_code=403,
            detail="Yalnızca Organizasyon SAHİBİ (OWNER) veya YÖNETİCİSİ (ADMIN) üye ekleyebilir."
        )

    # Güvenlik Kontrolü (Yetki Yükseltme Engeli): Yalnızca OWNER olan biri başka bir kullanıcıya OWNER rolü verebilir
    if req.role == 'OWNER' and current_mem.role != 'OWNER':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yalnızca mevcut bir Organizasyon Sahibi (OWNER) başka bir kullanıcıya OWNER rolü atayabilir."
        )

    # Eklenmek istenen kullanıcıyı bul
    target_user_result = await db.execute(select(User).where(User.email == req.email))
    target_user = target_user_result.scalars().first()
    if not target_user:
        raise HTTPException(
            status_code=404,
            detail="Belirtilen e-posta adresine sahip kullanıcı bulunamadı."
        )

    # Zaten üye mi kontrol et
    existing = await db.execute(
        select(Membership).where(
            Membership.organization_id == org_id,
            Membership.user_id == target_user.id
        )
    )
    if existing.scalars().first():
        raise HTTPException(
            status_code=400,
            detail="Bu kullanıcı zaten belirtilen organizasyonun bir üyesidir."
        )

    new_mem = Membership(
        user_id=target_user.id,
        organization_id=org_id,
        role=req.role
    )
    db.add(new_mem)
    await db.commit()

    return MemberResponse(
        user_id=target_user.id,
        email=target_user.email,
        full_name=target_user.full_name,
        role=new_mem.role
    )
