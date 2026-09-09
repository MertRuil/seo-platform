import sys
import os
import argparse
import asyncio
from datetime import datetime, timezone
import uuid

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Reconfigure stdout/stderr for Windows UTF-8 compatibility
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select
from packages.config.settings import settings
from packages.shared.database import Base, engine as default_engine
from packages.shared.models import (
    User, Organization, Membership, Site,
    KnowledgeDocument, KnowledgeChunk
)
from services.security.crypto import hash_password
from services.rag.seeds import SEED_DOCUMENTS
from services.rag.chunker import SemanticChunker
from services.rag.hybrid_store import HybridKnowledgeStore

async def seed_initial_data(session: AsyncSession):
    print("[INIT] Checking initial platform seed data...")
    
    # 1. Admin User
    admin_email = "admin@seo-platform.local"
    user_stmt = select(User).where(User.email == admin_email)
    existing_user = (await session.execute(user_stmt)).scalars().first()
    
    if not existing_user:
        admin_user = User(
            id=str(uuid.uuid4()),
            email=admin_email,
            hashed_password=hash_password("AdminPass123!"),
            full_name="Platform Administrator",
            is_active=True,
            is_platform_admin=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        session.add(admin_user)
        await session.flush()
        print(f"   [OK] Created Admin User: {admin_email} (Password: AdminPass123!)")
    else:
        admin_user = existing_user
        print(f"   [INFO] Admin User already exists: {admin_email}")

    # 2. Organization
    org_slug = "acme-digital"
    org_stmt = select(Organization).where(Organization.slug == org_slug)
    existing_org = (await session.execute(org_stmt)).scalars().first()
    
    if not existing_org:
        org = Organization(
            id=str(uuid.uuid4()),
            name="Acme Digital Agency",
            slug=org_slug,
            monthly_token_budget=1_000_000,
            tokens_used_this_month=0,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        session.add(org)
        await session.flush()
        print(f"   [OK] Created Organization: Acme Digital Agency ({org_slug})")
    else:
        org = existing_org
        print(f"   [INFO] Organization already exists: {org.name}")

    # 3. Membership
    mem_stmt = select(Membership).where(
        Membership.user_id == admin_user.id,
        Membership.organization_id == org.id
    )
    existing_mem = (await session.execute(mem_stmt)).scalars().first()
    if not existing_mem:
        membership = Membership(
            id=str(uuid.uuid4()),
            user_id=admin_user.id,
            organization_id=org.id,
            role="OWNER",
            created_at=datetime.now(timezone.utc)
        )
        session.add(membership)
        print("   [OK] Linked Admin User as OWNER of Acme Digital Agency")

    # 4. Demo Site
    site_domain = "example.com"
    site_stmt = select(Site).where(Site.organization_id == org.id, Site.domain == site_domain)
    existing_site = (await session.execute(site_stmt)).scalars().first()
    if not existing_site:
        demo_site = Site(
            id=str(uuid.uuid4()),
            organization_id=org.id,
            name="Acme Global Portal",
            domain=site_domain,
            normalized_domain=site_domain,
            primary_url="https://example.com",
            preferred_protocol="https",
            site_type="ECOMMERCE",
            language="tr",
            country="TR",
            timezone="UTC",
            execution_mode="REVIEW_ALL",
            verification_status="VERIFIED",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        session.add(demo_site)
        print("   [OK] Created Demo Site: Acme Global Portal (https://example.com)")

    # 5. Populate Hybrid Store and DB with Seed SEO Knowledge
    print("[KNOWLEDGE] Ingesting Level-1 SEO Standards into Knowledge Base...")
    chunk_count = 0
    for doc in SEED_DOCUMENTS:
        doc_id = doc["id"]
        # Check DB
        doc_stmt = select(KnowledgeDocument).where(KnowledgeDocument.id == doc_id)
        existing_doc = (await session.execute(doc_stmt)).scalars().first()
        if not existing_doc:
            k_doc = KnowledgeDocument(
                id=doc_id,
                title=doc["title"],
                canonical_url=doc["canonical_url"],
                authority_level=doc["authority_level"],
                status=doc["status"],
                content_hash="seed-v1",
                version=1,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            session.add(k_doc)
            
            chunks = SemanticChunker.chunk_markdown(doc["content"], doc["title"])
            for c in chunks:
                chunk_id = f"{doc_id}-{c.heading_path[-1] if c.heading_path else 'intro'}-{chunk_count}"
                k_chunk = KnowledgeChunk(
                    id=chunk_id,
                    document_id=doc_id,
                    document_title=doc["title"],
                    heading_path=str(c.heading_path),
                    content=c.content,
                    canonical_url=doc["canonical_url"],
                    authority_level="LEVEL_1_OFFICIAL",
                    verification_status="VERIFIED",
                    verification_confidence=1.00,
                    token_count=c.token_count,
                    created_at=datetime.now(timezone.utc)
                )
                session.add(k_chunk)
                chunk_count += 1
    
    # Initialize Hybrid In-Memory & Disk Index as well
    store = HybridKnowledgeStore()
    for doc in SEED_DOCUMENTS:
        chunks = SemanticChunker.chunk_markdown(doc["content"], doc["title"])
        for i, c in enumerate(chunks):
            store.add_chunk(
                chunk_id=f"{doc['id']}-{i}",
                document_title=doc["title"],
                heading_path=c.heading_path,
                content=c.content,
                canonical_url=doc["canonical_url"],
                authority_level=doc["authority_level"]
            )
    rag_dir = os.path.dirname(settings.RAG_STORE_PATH)
    if rag_dir:
        os.makedirs(rag_dir, exist_ok=True)
    store.save_to_disk(settings.RAG_STORE_PATH)
    await session.commit()
    print(f"   [OK] Knowledge Brain initialized with {len(SEED_DOCUMENTS)} documents and {chunk_count} verified chunks.")

async def main():
    parser = argparse.ArgumentParser(description="Initialize SEO Platform Database")
    parser.add_argument("--sqlite", action="store_true", help="Force initialize local SQLite database (dev.db)")
    args = parser.parse_args()

    if args.sqlite or "sqlite" in settings.DATABASE_URL:
        db_url = "sqlite+aiosqlite:///./dev.db"
        print(f"[DB] Initializing SQLite database at: {db_url}")
        target_engine = create_async_engine(db_url, echo=False)
    else:
        db_url = settings.DATABASE_URL
        print(f"[DB] Attempting connection to configured database: {db_url}")
        target_engine = default_engine

    try:
        async with target_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("[SUCCESS] Database schema and tables created successfully.")
    except Exception as e:
        if not args.sqlite and ("ConnectionRefused" in str(e) or "WinError 1225" in str(e)):
            print(f"[WARN] PostgreSQL connection refused ({e}). Falling back to local SQLite './dev.db'...")
            target_engine = create_async_engine("sqlite+aiosqlite:///./dev.db", echo=False)
            async with target_engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            print("[SUCCESS] SQLite schema and tables created successfully at ./dev.db.")
        else:
            raise e

    session_maker = async_sessionmaker(bind=target_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_maker() as session:
        await seed_initial_data(session)

    print("\n[READY] Database initialization complete and ready for use!")

if __name__ == "__main__":
    asyncio.run(main())
