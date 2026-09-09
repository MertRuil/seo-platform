import uuid
from datetime import datetime, timezone, date
from typing import List, Optional
from sqlalchemy import (
    Boolean, Column, DateTime, Date, Enum, ForeignKey, Integer,
    Numeric, String, Text, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from packages.shared.database import Base

def generate_uuid():
    return str(uuid.uuid4())

def utc_now():
    return datetime.now(timezone.utc)

# Enumerations
UserRoleEnum = Enum('OWNER', 'ADMIN', 'SEO_MANAGER', 'EDITOR', 'VIEWER', name='user_role')
SiteTypeEnum = Enum('LOCAL_BUSINESS', 'ECOMMERCE', 'SAAS', 'BLOG', 'NEWS', 'CORPORATE', 'MARKETPLACE', 'OTHER', name='site_type')
VerificationMethodEnum = Enum('DNS_TXT', 'HTML_FILE', 'META_TAG', 'GSC_OAUTH', name='verification_method')
VerificationStatusEnum = Enum('UNVERIFIED', 'PENDING', 'VERIFIED', 'FAILED', name='verification_status')
CrawlModeEnum = Enum('GOOGLEBOT_SIMULATION', 'OWNER_AUDIT', name='crawl_mode')
CrawlStatusEnum = Enum('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', name='crawl_status')
IssueSeverityEnum = Enum('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', name='issue_severity')
RiskLevelEnum = Enum('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', name='risk_level')
ExecutionModeEnum = Enum('SUGGEST_ONLY', 'REVIEW_ALL', 'AUTO_LOW_RISK', 'AUTO_LOW_AND_APPROVED_MEDIUM', name='execution_mode')
ChangeSetStatusEnum = Enum('DRAFT', 'WAITING_APPROVAL', 'APPROVED', 'EXECUTING', 'SUCCESS', 'FAILED', 'ROLLED_BACK', 'CANCELLED', name='change_set_status')
ConnectorTypeEnum = Enum('WORDPRESS_REST', 'GIT_PR', 'GENERIC_WEBHOOK', name='connector_type')
KnowledgeAuthorityEnum = Enum('LEVEL_1_OFFICIAL', 'LEVEL_2_HIGH_QUALITY', 'LEVEL_3_INDUSTRY', 'LEVEL_4_COMMUNITY', name='knowledge_authority')
KnowledgeStatusEnum = Enum('ACTIVE', 'DEPRECATED', 'REMOVED', 'HISTORICAL', name='knowledge_status')

class User(Base):
    __tablename__ = 'users'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_platform_admin = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    memberships = relationship("Membership", back_populates="user", cascade="all, delete-orphan")

class Organization(Base):
    __tablename__ = 'organizations'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    monthly_token_budget = Column(Integer, default=1000000, nullable=False)
    tokens_used_this_month = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    memberships = relationship("Membership", back_populates="organization", cascade="all, delete-orphan")
    sites = relationship("Site", back_populates="organization", cascade="all, delete-orphan")

class Membership(Base):
    __tablename__ = 'memberships'

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    organization_id = Column(String(36), ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True)
    role = Column(String(50), default='VIEWER', nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("User", back_populates="memberships")
    organization = relationship("Organization", back_populates="memberships")

    __table_args__ = (
        UniqueConstraint('user_id', 'organization_id', name='uq_user_organization'),
        {'extend_existing': True}
    )

class Site(Base):
    __tablename__ = 'sites'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    domain = Column(String(255), nullable=False)
    normalized_domain = Column(String(255), nullable=False, index=True)
    primary_url = Column(Text, nullable=False)
    preferred_protocol = Column(String(10), default='https', nullable=False)
    site_type = Column(String(50), default='OTHER', nullable=False)
    language = Column(String(10), default='tr', nullable=False)
    country = Column(String(10), default='TR', nullable=False)
    timezone = Column(String(50), default='UTC', nullable=False)
    cms_type = Column(String(50), nullable=True)
    execution_mode = Column(String(50), default='REVIEW_ALL', nullable=False)
    verification_status = Column(String(50), default='UNVERIFIED', nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    organization = relationship("Organization", back_populates="sites")
    verifications = relationship("SiteVerification", back_populates="site", cascade="all, delete-orphan")
    connectors = relationship("SiteConnector", back_populates="site", cascade="all, delete-orphan")
    crawl_runs = relationship("CrawlRun", back_populates="site", cascade="all, delete-orphan")
    gsc_metrics = relationship("GscSearchMetric", back_populates="site", cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", back_populates="site", cascade="all, delete-orphan")

class SiteVerification(Base):
    __tablename__ = 'site_verifications'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=generate_uuid)
    site_id = Column(String(36), ForeignKey('sites.id', ondelete='CASCADE'), nullable=False, index=True)
    method = Column(String(50), nullable=False)
    token = Column(String(255), nullable=False)
    status = Column(String(50), default='PENDING', nullable=False)
    last_checked_at = Column(DateTime(timezone=True), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)

    site = relationship("Site", back_populates="verifications")

class SiteConnector(Base):
    __tablename__ = 'site_connectors'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=generate_uuid)
    site_id = Column(String(36), ForeignKey('sites.id', ondelete='CASCADE'), nullable=False, index=True)
    connector_type = Column(String(50), nullable=False)
    encrypted_credentials = Column(Text, nullable=False)
    base_url = Column(Text, nullable=True)
    capabilities = Column(Text, nullable=False, default="[]")
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    site = relationship("Site", back_populates="connectors")

class CrawlRun(Base):
    __tablename__ = 'crawl_runs'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=generate_uuid)
    site_id = Column(String(36), ForeignKey('sites.id', ondelete='CASCADE'), nullable=False, index=True)
    crawl_mode = Column(String(50), default='GOOGLEBOT_SIMULATION', nullable=False)
    status = Column(String(50), default='QUEUED', nullable=False)
    total_urls_discovered = Column(Integer, default=0, nullable=False)
    total_urls_crawled = Column(Integer, default=0, nullable=False)
    total_errors = Column(Integer, default=0, nullable=False)
    max_pages = Column(Integer, default=1000, nullable=False)
    max_depth = Column(Integer, default=5, nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    site = relationship("Site", back_populates="crawl_runs")
    pages = relationship("CrawlPage", back_populates="crawl_run", cascade="all, delete-orphan")

class CrawlPage(Base):
    __tablename__ = 'crawl_pages'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=generate_uuid)
    crawl_run_id = Column(String(36), ForeignKey('crawl_runs.id', ondelete='CASCADE'), nullable=False, index=True)
    site_id = Column(String(36), ForeignKey('sites.id', ondelete='CASCADE'), nullable=False, index=True)
    url = Column(Text, nullable=False)
    normalized_url = Column(Text, nullable=False, index=True)
    depth = Column(Integer, default=0, nullable=False)
    status_code = Column(Integer, nullable=False)
    content_type = Column(String(100), nullable=True)
    response_time_ms = Column(Integer, nullable=True)
    is_fetchable = Column(Boolean, default=True, nullable=False)
    is_crawlable_by_google = Column(Boolean, default=True, nullable=False)
    has_noindex = Column(Boolean, default=False, nullable=False)
    is_indexable_candidate = Column(Boolean, default=True, nullable=False)
    canonical_target = Column(Text, nullable=True)
    is_canonical = Column(Boolean, nullable=True)
    in_sitemap = Column(Boolean, default=False, nullable=False)
    title = Column(Text, nullable=True)
    meta_description = Column(Text, nullable=True)
    word_count = Column(Integer, default=0, nullable=False)
    raw_html_hash = Column(String(64), nullable=True)
    main_content_hash = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    crawl_run = relationship("CrawlRun", back_populates="pages")

# Phase 4 Models: GSC, CrUX, Lighthouse, OAuth
class OAuthCredential(Base):
    __tablename__ = 'oauth_credentials'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True)
    provider = Column(String(50), nullable=False)  # 'GOOGLE'
    encrypted_access_token = Column(Text, nullable=False)
    encrypted_refresh_token = Column(Text, nullable=False)
    token_expiry = Column(DateTime(timezone=True), nullable=False)
    scopes = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

class GscSearchMetric(Base):
    __tablename__ = 'gsc_search_metrics'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=generate_uuid)
    site_id = Column(String(36), ForeignKey('sites.id', ondelete='CASCADE'), nullable=False, index=True)
    metric_date = Column(Date, nullable=False, index=True)
    query = Column(String(500), nullable=False, index=True)
    page = Column(Text, nullable=False, index=True)
    country = Column(String(10), default="all")
    device = Column(String(20), default="all")
    clicks = Column(Integer, default=0, nullable=False)
    impressions = Column(Integer, default=0, nullable=False)
    ctr = Column(Numeric(6, 5), default=0.0, nullable=False)
    position = Column(Numeric(5, 2), default=0.0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    site = relationship("Site", back_populates="gsc_metrics")

class CruxMetric(Base):
    __tablename__ = 'crux_metrics'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=generate_uuid)
    site_id = Column(String(36), ForeignKey('sites.id', ondelete='CASCADE'), nullable=False, index=True)
    url = Column(Text, nullable=False)
    form_factor = Column(String(20), default='PHONE')  # 'PHONE', 'DESKTOP'
    p75_lcp_ms = Column(Integer, nullable=True)
    p75_inp_ms = Column(Integer, nullable=True)
    p75_cls = Column(Numeric(4, 3), nullable=True)
    fetched_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

class LighthouseRun(Base):
    __tablename__ = 'lighthouse_runs'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=generate_uuid)
    site_id = Column(String(36), ForeignKey('sites.id', ondelete='CASCADE'), nullable=False, index=True)
    url = Column(Text, nullable=False)
    score_performance = Column(Integer, nullable=False)
    score_accessibility = Column(Integer, nullable=False)
    score_best_practices = Column(Integer, nullable=False)
    score_seo = Column(Integer, nullable=False)
    report_json = Column(Text, nullable=True)
    audited_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

# Phase 5 Models: Knowledge Brain
class KnowledgeSource(Base):
    __tablename__ = 'knowledge_sources'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    authority_level = Column(String(50), default='LEVEL_1_OFFICIAL', nullable=False)
    base_url = Column(Text, nullable=False)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)

    documents = relationship("KnowledgeDocument", back_populates="source", cascade="all, delete-orphan")

class KnowledgeDocument(Base):
    __tablename__ = 'knowledge_documents'
    __table_args__ = {'extend_existing': True}

    id = Column(String(100), primary_key=True, default=generate_uuid)
    source_id = Column(String(36), ForeignKey('knowledge_sources.id', ondelete='SET NULL'), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    canonical_url = Column(Text, nullable=False, unique=True, index=True)
    authority_level = Column(String(50), default='LEVEL_1_OFFICIAL', nullable=False)
    content_hash = Column(String(64), nullable=True)
    source_hash = Column(String(64), nullable=True)
    status = Column(String(50), default='ACTIVE', nullable=False)  # 'ACTIVE', 'DEPRECATED', 'REMOVED', 'HISTORICAL'
    version = Column(Integer, default=1, nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    source = relationship("KnowledgeSource", back_populates="documents")
    chunks = relationship("KnowledgeChunk", back_populates="document", cascade="all, delete-orphan")

class KnowledgeChunk(Base):
    __tablename__ = 'knowledge_chunks'
    __table_args__ = {'extend_existing': True}

    id = Column(String(150), primary_key=True, default=generate_uuid)
    document_id = Column(String(100), ForeignKey('knowledge_documents.id', ondelete='CASCADE'), nullable=False, index=True)
    document_title = Column(String(255), nullable=True)
    heading_path = Column(Text, nullable=False, default="[]")  # JSON-encoded array
    content = Column(Text, nullable=False)
    canonical_url = Column(Text, nullable=True)
    authority_level = Column(String(50), default='LEVEL_1_OFFICIAL', nullable=False)
    verification_status = Column(String(50), default='VERIFIED', nullable=False)
    verified_claims = Column(Text, nullable=False, default="[]")  # JSON-encoded list of claims
    verification_confidence = Column(Numeric(4, 2), default=1.00, nullable=False)
    token_count = Column(Integer, default=0, nullable=False)
    embedding_json = Column(Text, nullable=True)  # JSON-encoded vector float array
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    document = relationship("KnowledgeDocument", back_populates="chunks")

# Phase 6 & 8 Models: Recommendations, ChangeSets, Connectors
class Recommendation(Base):
    __tablename__ = 'recommendations'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=generate_uuid)
    site_id = Column(String(36), ForeignKey('sites.id', ondelete='CASCADE'), nullable=False, index=True)
    issue_id = Column(String(100), nullable=True)
    category = Column(String(100), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    reason = Column(Text, nullable=False)
    expected_impact = Column(Text, nullable=True)
    confidence = Column(Numeric(3, 2), default=1.0, nullable=False)
    priority_score = Column(Numeric(5, 2), default=50.0, nullable=False, index=True)
    risk_level = Column(String(50), default='LOW', nullable=False)
    effort = Column(String(20), default='LOW', nullable=False)
    evidence_json = Column(Text, nullable=False, default="{}")
    rag_sources_json = Column(Text, nullable=False, default="[]")
    status = Column(String(50), default='PENDING', nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    site = relationship("Site", back_populates="recommendations")

class ChangeSet(Base):
    __tablename__ = 'change_sets'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=generate_uuid)
    site_id = Column(String(36), ForeignKey('sites.id', ondelete='CASCADE'), nullable=False, index=True)
    recommendation_id = Column(String(36), ForeignKey('recommendations.id', ondelete='SET NULL'), nullable=True)
    status = Column(String(50), default='DRAFT', nullable=False)
    risk_level = Column(String(50), default='LOW', nullable=False)
    created_by = Column(String(36), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    approved_by = Column(String(36), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    executed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    items = relationship("ChangeItem", back_populates="change_set", cascade="all, delete-orphan")

class ChangeItem(Base):
    __tablename__ = 'change_items'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=generate_uuid)
    change_set_id = Column(String(36), ForeignKey('change_sets.id', ondelete='CASCADE'), nullable=False, index=True)
    target_url = Column(Text, nullable=False)
    operation = Column(String(50), nullable=False)
    state_before = Column(Text, nullable=False)  # JSON-encoded string
    state_after = Column(Text, nullable=False)   # JSON-encoded string
    expected_hash_before = Column(String(64), nullable=False)
    status = Column(String(50), default='PENDING', nullable=False)

    change_set = relationship("ChangeSet", back_populates="items")

class AuditLog(Base):
    __tablename__ = 'audit_logs'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    site_id = Column(String(36), ForeignKey('sites.id', ondelete='CASCADE'), nullable=True, index=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(String(255), nullable=False)
    state_before = Column(Text, nullable=True)
    state_after = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
