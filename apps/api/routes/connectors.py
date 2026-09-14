import uuid
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from packages.shared.database import get_db
from packages.shared.models import Site, SiteConnector
from packages.contracts.execution import (
    ConnectorCreateRequest,
    ConnectorResponse,
    ConnectorTestRequest,
    ConnectorTestResponse
)
from apps.api.routes.sites import verify_site_access
from services.security.jwt_auth import get_current_user_payload
from services.security.crypto import encrypt_secret, decrypt_secret
from services.executor.connector_factory import build_connector_from_record
from services.executor.connectors.wordpress import WordPressConnector
from services.executor.connectors.webhook import GenericWebhookConnector
from services.executor.connectors.git import GitBasedConnector
from services.executor.connectors.cloudflare import CloudflareWorkerConnector
from services.security.ssrf import validate_safe_url, SSRFSecurityException

router = APIRouter(prefix="/organizations/{org_id}/sites/{site_id}/connectors", tags=["Site Connectors & Integrations"])

def _mask_credentials(connector_type: str, creds: Dict[str, Any]) -> str:
    """Masks secrets for safe user interface display."""
    if connector_type == "WORDPRESS_REST":
        username = creds.get("username", "admin")
        pwd = creds.get("app_password", "")
        masked_pwd = f"{pwd[:4]}••••••••" if len(pwd) >= 4 else "••••••••••••"
        return f"{username} / {masked_pwd}"
    elif connector_type == "GENERIC_WEBHOOK":
        sec = creds.get("secret_key", "")
        return f"whsec_{sec[:4]}••••••••" if len(sec) >= 4 else "whsec_••••••••••••"
    elif connector_type == "GIT_PR":
        repo = creds.get("repo_full_name", "")
        tok = creds.get("access_token", "")
        masked_tok = f"ghp_{tok[:3]}••••" if len(tok) >= 3 else "ghp_••••••••••••"
        return f"{repo} ({masked_tok})"
    elif connector_type == "CLOUDFLARE_WORKER":
        zone = creds.get("zone_id", "")
        return f"Zone {zone[:6]}... (cf_tok_••••)"
    elif connector_type == "GOOGLE_SEARCH_CONSOLE":
        return "ya29.•••••••••••• (OAuth 2.0)"
    return "••••••••••••"

def _build_transient_connector(connector_type: str, base_url: Optional[str], creds: Dict[str, Any]):
    """Instantiates a connector instance from transient test data."""
    c_type = (connector_type or "").upper()
    if c_type in ("WORDPRESS_REST", "WORDPRESS"):
        return WordPressConnector(
            wp_url=base_url or "",
            username=creds.get("username", ""),
            app_password=creds.get("app_password", "")
        )
    elif c_type in ("GENERIC_WEBHOOK", "WEBHOOK"):
        sec = creds.get("secret_key") or creds.get("secret", "")
        return GenericWebhookConnector(
            webhook_url=base_url or "",
            secret_key=sec
        )
    elif c_type in ("GIT_PR", "GIT", "GITHUB"):
        return GitBasedConnector(
            repo_full_name=creds.get("repo_full_name", ""),
            access_token=creds.get("access_token", ""),
            default_branch=creds.get("default_branch", "main")
        )
    elif c_type in ("CLOUDFLARE_WORKER", "CLOUDFLARE"):
        return CloudflareWorkerConnector(
            zone_id=creds.get("zone_id", ""),
            api_token=creds.get("api_token", ""),
            account_id=creds.get("account_id"),
            kv_namespace_id=creds.get("kv_namespace_id"),
            base_url=base_url or ""
        )
    raise ValueError(f"Desteklenmeyen bağlayıcı türü: {connector_type}")

@router.get("", response_model=List[ConnectorResponse])
async def list_connectors(
    org_id: str,
    site_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    await verify_site_access(org_id, site_id, user_id, db)

    result = await db.execute(
        select(SiteConnector).where(SiteConnector.site_id == site_id).order_by(SiteConnector.created_at.asc())
    )
    records = result.scalars().all()
    responses = []
    for r in records:
        try:
            creds = json.loads(decrypt_secret(r.encrypted_credentials))
        except Exception:
            creds = {}
        
        try:
            caps = json.loads(r.capabilities) if isinstance(r.capabilities, str) else []
        except Exception:
            caps = []

        responses.append(ConnectorResponse(
            id=r.id,
            site_id=r.site_id,
            connector_type=r.connector_type,
            base_url=r.base_url,
            capabilities=caps,
            token_masked=_mask_credentials(r.connector_type, creds),
            is_active=r.is_active,
            created_at=r.created_at
        ))
    return responses

@router.post("", response_model=ConnectorResponse, status_code=status.HTTP_201_CREATED)
async def create_or_update_connector(
    org_id: str,
    site_id: str,
    req: ConnectorCreateRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    await verify_site_access(org_id, site_id, user_id, db, ["OWNER", "ADMIN", "SEO_MANAGER"])

    # Validate URL against SSRF if present
    if req.base_url and not req.base_url.startswith("mock://"):
        try:
            validate_safe_url(req.base_url)
        except SSRFSecurityException as e:
            raise HTTPException(status_code=400, detail=f"Güvenlik kalkanı: {str(e)}")

    # Test capabilities by instantiating connector
    try:
        instance = _build_transient_connector(req.connector_type, req.base_url, req.credentials)
        caps = await instance.get_capabilities()
    except Exception as e:
        caps = []

    # Check if connector of this type already exists for site
    existing = (await db.execute(
        select(SiteConnector).where(SiteConnector.site_id == site_id, SiteConnector.connector_type == req.connector_type)
    )).scalars().first()

    encrypted = encrypt_secret(json.dumps(req.credentials))

    if existing:
        existing.base_url = req.base_url
        if req.credentials:
            existing.encrypted_credentials = encrypted
        existing.capabilities = json.dumps(caps)
        existing.is_active = req.is_active
        await db.commit()
        await db.refresh(existing)
        connector_rec = existing
    else:
        connector_rec = SiteConnector(
            id=str(uuid.uuid4()),
            site_id=site_id,
            connector_type=req.connector_type,
            encrypted_credentials=encrypted,
            base_url=req.base_url,
            capabilities=json.dumps(caps),
            is_active=req.is_active,
            created_at=datetime.now(timezone.utc)
        )
        session = db
        session.add(connector_rec)
        await session.commit()
        await session.refresh(connector_rec)

    return ConnectorResponse(
        id=connector_rec.id,
        site_id=connector_rec.site_id,
        connector_type=connector_rec.connector_type,
        base_url=connector_rec.base_url,
        capabilities=caps,
        token_masked=_mask_credentials(connector_rec.connector_type, req.credentials),
        is_active=connector_rec.is_active,
        created_at=connector_rec.created_at
    )

@router.post("/test", response_model=ConnectorTestResponse)
async def test_connector(
    org_id: str,
    site_id: str,
    req: ConnectorTestRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    await verify_site_access(org_id, site_id, user_id, db)

    creds = req.credentials or {}
    base_url = req.base_url
    conn_type = req.connector_type

    # If connector_id is provided, load existing credentials if none given
    if req.connector_id and not creds:
        existing = (await db.execute(
            select(SiteConnector).where(SiteConnector.id == req.connector_id, SiteConnector.site_id == site_id)
        )).scalars().first()
        if existing:
            conn_type = existing.connector_type
            base_url = existing.base_url
            try:
                creds = json.loads(decrypt_secret(existing.encrypted_credentials))
            except Exception:
                pass

    # SSRF guard on URL
    if base_url and not base_url.startswith("mock://") and not base_url.startswith("https://api.github.com"):
        try:
            validate_safe_url(base_url)
        except SSRFSecurityException as e:
            return ConnectorTestResponse(
                success=False,
                status_code=400,
                message=f"SSRF Kalkanı: Hedef adrese bağlantı engellendi ({str(e)})",
                capabilities=[]
            )

    try:
        instance = _build_transient_connector(conn_type, base_url, creds)
        is_valid = await instance.verify_connection()
        caps = await instance.get_capabilities() if is_valid else []

        if is_valid:
            return ConnectorTestResponse(
                success=True,
                status_code=200,
                message=f"Bağlantı ve kimlik doğrulama başarılı! {len(caps)} yetenek aktif.",
                capabilities=caps
            )
        else:
            return ConnectorTestResponse(
                success=False,
                status_code=401,
                message="Bağlantı doğrulanamadı: Uç nokta yanıt vermedi veya kimlik bilgileri (kullanıcı adı/şifre/token) geçersiz.",
                capabilities=[]
            )
    except Exception as e:
        return ConnectorTestResponse(
            success=False,
            status_code=500,
            message=f"Doğrulama hatası: {str(e)}",
            capabilities=[]
        )

@router.delete("/{connector_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connector(
    org_id: str,
    site_id: str,
    connector_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    await verify_site_access(org_id, site_id, user_id, db, ["OWNER", "ADMIN"])

    res = await db.execute(
        select(SiteConnector).where(SiteConnector.id == connector_id, SiteConnector.site_id == site_id)
    )
    rec = res.scalars().first()
    if not rec:
        raise HTTPException(status_code=404, detail="Connector not found")

    await db.delete(rec)
    await db.commit()
    return None
