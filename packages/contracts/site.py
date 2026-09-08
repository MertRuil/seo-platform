from pydantic import BaseModel, HttpUrl, Field
from typing import Optional

class SiteCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    primary_url: str = Field(..., description="Full URL e.g. https://example.com")
    site_type: str = Field("OTHER", pattern=r"^(LOCAL_BUSINESS|ECOMMERCE|SAAS|BLOG|NEWS|CORPORATE|MARKETPLACE|OTHER)$")
    language: str = Field("tr", max_length=10)
    country: str = Field("TR", max_length=10)
    execution_mode: str = Field("REVIEW_ALL", pattern=r"^(SUGGEST_ONLY|REVIEW_ALL|AUTO_LOW_RISK|AUTO_LOW_AND_APPROVED_MEDIUM)$")

class SiteResponse(BaseModel):
    id: str
    organization_id: str
    name: str
    domain: str
    normalized_domain: str
    primary_url: str
    site_type: str
    language: str
    country: str
    execution_mode: str
    verification_status: str

class SiteVerifyRequest(BaseModel):
    method: str = Field(..., pattern=r"^(DNS_TXT|HTML_FILE|META_TAG|GSC_OAUTH)$")
