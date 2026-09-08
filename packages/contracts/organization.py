from pydantic import BaseModel, Field
from typing import Optional, List

class OrganizationCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Organizasyonun görünen adı", json_schema_extra={"example": "Acme SEO Teknolojileri"})
    slug: str = Field(..., min_length=2, max_length=100, pattern=r"^[a-z0-9-]+$", description="Organizasyonun benzersiz URL kod adı (slug)", json_schema_extra={"example": "acme-seo-teknolojileri"})

class OrganizationResponse(BaseModel):
    id: str = Field(..., description="Organizasyonun benzersiz sistem Kimliği (UUID)", json_schema_extra={"example": "b67e3a98-1122-4567-89ab-cdef01234567"})
    name: str = Field(..., description="Organizasyonun adı", json_schema_extra={"example": "Acme SEO Teknolojileri"})
    slug: str = Field(..., description="Organizasyonun benzersiz URL kod adı", json_schema_extra={"example": "acme-seo-teknolojileri"})
    monthly_token_budget: int = Field(..., description="Organizasyonun aylık AI jeton/token bütçesi", json_schema_extra={"example": 1000000})
    tokens_used_this_month: int = Field(..., description="Bu ay harcanan jeton/token miktarı", json_schema_extra={"example": 42000})

class AddMemberRequest(BaseModel):
    email: str = Field(..., description="Organizasyona davet edilecek kullanıcının e-posta adresi", json_schema_extra={"example": "ahmet@acme.com"})
    role: str = Field("VIEWER", pattern=r"^(OWNER|ADMIN|SEO_MANAGER|EDITOR|VIEWER)$", description="Kullanıcıya atanacak rol (OWNER, ADMIN, SEO_MANAGER, EDITOR, VIEWER)", json_schema_extra={"example": "SEO_MANAGER"})

class MemberResponse(BaseModel):
    user_id: str = Field(..., description="Kullanıcının benzersiz sistem Kimliği (UUID)", json_schema_extra={"example": "u98f7e65-4321-8765-4321-000000000000"})
    email: str = Field(..., description="Kullanıcının e-posta adresi", json_schema_extra={"example": "ahmet@acme.com"})
    full_name: Optional[str] = Field(None, description="Kullanıcının adı ve soyadı", json_schema_extra={"example": "Ahmet Yılmaz"})
    role: str = Field(..., description="Kullanıcının organizasyondaki aktif rolü", json_schema_extra={"example": "SEO_MANAGER"})
