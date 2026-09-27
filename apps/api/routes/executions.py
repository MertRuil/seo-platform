import uuid
import json
import hashlib
from urllib.parse import urlparse
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from packages.shared.database import get_db
from packages.shared.models import ChangeSet, ChangeItem, Site, SiteConnector, CrawlPage
from packages.config.settings import settings
from packages.contracts.execution import (
    ChangeSetCreateRequest,
    ChangeSetResponse,
    ExecutionResultResponse,
    SelfHealRequest,
    SelfHealResponse
)
from apps.api.routes.sites import verify_site_access
from services.security.jwt_auth import get_current_user_payload
from services.executor.executor_service import SafeSiteExecutor
from services.executor.connectors.webhook import GenericWebhookConnector
from services.executor.connectors.wordpress import WordPressConnector
from services.executor.connectors.git import GitBasedConnector
from services.executor.connectors.cloudflare import CloudflareWorkerConnector
from services.security.crypto import decrypt_secret
from services.executor.connector_factory import build_connector_from_record, get_fallback_sandbox_connector

router = APIRouter(prefix="/organizations/{org_id}/sites/{site_id}", tags=["Safe Execution & Rollback"])

def build_connector(record: SiteConnector):
    try:
        return build_connector_from_record(record)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Connector credentials could not be decrypted") from exc

@router.post("/change-sets", response_model=ChangeSetResponse, status_code=status.HTTP_201_CREATED)
async def create_change_set(
    org_id: str,
    site_id: str,
    req: ChangeSetCreateRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db, ["OWNER", "ADMIN", "SEO_MANAGER"])
    if req.recommendation_id:
        from packages.shared.models import Recommendation
        recommendation = (await db.execute(select(Recommendation).where(Recommendation.id == req.recommendation_id, Recommendation.site_id == site_id))).scalars().first()
        if not recommendation:
            raise HTTPException(status_code=404, detail="Recommendation not found")

    for item in req.items:
        host = (urlparse(item.target_url).hostname or "").lower().removeprefix("www.")
        if host != site.normalized_domain:
            raise HTTPException(status_code=400, detail="Every change target must belong to the selected site")
    cs = ChangeSet(
        site_id=site_id,
        recommendation_id=req.recommendation_id,
        risk_level=req.risk_level,
        status="WAITING_APPROVAL" if req.risk_level in ("HIGH", "CRITICAL") else "DRAFT",
        created_by=user_id
    )
    db.add(cs)
    await db.flush()

    for item in req.items:
        expected_hash = item.expected_hash_before
        if not expected_hash:
            page_rec = (await db.execute(
                select(CrawlPage).where(CrawlPage.site_id == site_id, CrawlPage.url == item.target_url)
            )).scalars().first()
            if page_rec:
                expected_hash = page_rec.canonical_seo_hash or page_rec.raw_html_hash or ""
            else:
                expected_hash = ""

        ci = ChangeItem(
            change_set_id=cs.id,
            target_url=item.target_url,
            operation=item.operation,
            state_before=item.state_before,
            state_after=item.state_after,
            expected_hash_before=expected_hash,
            status="PENDING"
        )
        db.add(ci)

    await db.commit()
    await db.refresh(cs)

    # Load items
    res_items = await db.execute(select(ChangeItem).where(ChangeItem.change_set_id == cs.id))
    items_list = res_items.scalars().all()

    return ChangeSetResponse(
        id=cs.id,
        site_id=cs.site_id,
        recommendation_id=cs.recommendation_id,
        status=cs.status,
        risk_level=cs.risk_level,
        created_at=cs.created_at,
        executed_at=cs.executed_at,
        items=items_list
    )

@router.post("/change-sets/{change_set_id}/approve", response_model=ChangeSetResponse)
async def approve_change_set(org_id: str, site_id: str, change_set_id: str, payload: dict = Depends(get_current_user_payload), db: AsyncSession = Depends(get_db)):
    user_id = payload.get("sub")
    await verify_site_access(org_id, site_id, user_id, db, ["OWNER", "ADMIN"])
    cs = (await db.execute(select(ChangeSet).where(ChangeSet.id == change_set_id, ChangeSet.site_id == site_id))).scalars().first()
    if not cs:
        raise HTTPException(status_code=404, detail="ChangeSet not found")
    if cs.status not in ("DRAFT", "WAITING_APPROVAL"):
        raise HTTPException(status_code=409, detail="ChangeSet cannot be approved in its current state")
    cs.status = "APPROVED"
    cs.approved_by = user_id
    cs.approved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(cs)
    items = (await db.execute(select(ChangeItem).where(ChangeItem.change_set_id == cs.id))).scalars().all()
    return ChangeSetResponse(id=cs.id, site_id=cs.site_id, recommendation_id=cs.recommendation_id, status=cs.status, risk_level=cs.risk_level, created_at=cs.created_at, executed_at=cs.executed_at, items=items)

@router.post("/change-sets/{change_set_id}/execute", response_model=ExecutionResultResponse)
async def execute_change_set(
    org_id: str,
    site_id: str,
    change_set_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db, ["OWNER", "ADMIN", "SEO_MANAGER"])

    res_cs = await db.execute(select(ChangeSet).where(ChangeSet.id == change_set_id, ChangeSet.site_id == site_id))
    cs = res_cs.scalars().first()
    if cs.risk_level in ("HIGH", "CRITICAL") and cs.status != "APPROVED":
        raise HTTPException(status_code=409, detail="High-risk ChangeSet requires explicit approval")

    if cs.status not in ("DRAFT", "APPROVED"):
        raise HTTPException(status_code=409, detail="ChangeSet cannot be executed in its current state")

    res_items = await db.execute(select(ChangeItem).where(ChangeItem.change_set_id == cs.id))
    items = res_items.scalars().all()
    if not items:
        raise HTTPException(status_code=400, detail="ChangeSet has no items to execute")

    from services.billing.entitlements import EntitlementGuard
    from services.billing.usage import UsageService

    # Entitlement & Quota Guard: Auto-fix yetkisi ve aylık kalan kota kontrolü
    await EntitlementGuard.ensure_feature(db, org_id, "auto_fixes")
    await EntitlementGuard.ensure_limit(db, org_id, "auto_fixes", requested_qty=len(items))

    connector_record = (await db.execute(select(SiteConnector).where(SiteConnector.site_id == site_id, SiteConnector.is_active.is_(True)))).scalars().first()
    if not connector_record:
        raise HTTPException(
            status_code=400,
            detail="Bu site için aktif bir bağlayıcı bulunamadı. Değişikliklerin uygulanabilmesi için önce bir bağlayıcı (WordPress, Cloudflare, Git vb.) yapılandırılmalıdır."
        )

    # Mülkiyet doğrulaması kontrolü: Doğrulanmamış sitelere canlı ortamda değişiklik uygulanması engellenir
    if settings.ENVIRONMENT == "production" and site.verification_status != "VERIFIED" and site.execution_mode not in ("SUGGEST_ONLY", "DRY_RUN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"'{site.domain}' alan adı mülkiyeti henüz doğrulanmamıştır (DURUM: {site.verification_status}). "
                   f"Üretim ortamında canlı değişikliklerin web sitesine uygulanabilmesi için önce alan adı sahipliğinin (DNS TXT, HTML dosyası veya Meta etiketi) doğrulanması zorunludur."
        )

    connector = build_connector(connector_record)
    if not await connector.verify_connection():
        raise HTTPException(status_code=502, detail="Site bağlayıcısı bağlantı doğrulaması başarısız oldu. Lütfen bağlayıcı ayarlarını kontrol edin.")
    executor = SafeSiteExecutor(connector)
    cs.status = "EXECUTING"
    await db.commit()

    all_success = True
    error_msg = None
    rolled_back = False
    completed_items = []
    for item in items:
        exec_res = await executor.execute_change_item(
            change_item={
                "id": item.id,
                "target_url": item.target_url,
                "expected_hash_before": item.expected_hash_before,
                "risk_level": cs.risk_level,
                "operation": item.operation,
                "state_after": item.state_after
            },
            require_approval=(cs.risk_level in ("HIGH", "CRITICAL")),
            is_approved=(cs.status == "EXECUTING" and cs.approved_by is not None) or cs.risk_level not in ("HIGH", "CRITICAL")
        )
        if exec_res.success:
            item.status = "SUCCESS"
            completed_items.append(item)
        else:
            item.status = "FAILED"
            all_success = False
            error_msg = exec_res.error_message
            rolled_back = exec_res.rolled_back
            for completed in reversed(completed_items):
                try:
                    if isinstance(completed.state_before, str):
                        backup = json.loads(completed.state_before)
                    elif isinstance(completed.state_before, dict):
                        backup = completed.state_before
                    else:
                        backup = {}
                    await connector.rollback_change(backup)
                    completed.status = "ROLLED_BACK"
                    rolled_back = True
                except Exception:
                    completed.status = "ROLLBACK_FAILED"
            break

    cs.status = "SUCCESS" if all_success else "FAILED"
    cs.executed_at = datetime.now(timezone.utc)
    await db.commit()

    # Track usage: Başarıyla uygulanan adımları organizasyon kotasından düş
    if all_success and completed_items:
        try:
            await UsageService.consume(
                db,
                org_id,
                "auto_fixes",
                quantity=len(completed_items),
                ref_type="change_set",
                ref_id=cs.id
            )
        except Exception:
            pass

    # Otonom Anlık İndeksleme: Başarıyla uygulanan sayfaları IndexNow protokolüne bildir
    if all_success:
        try:
            import asyncio
            from services.integrations.indexing_client import IndexNowClient
            target_urls = [item.target_url for item in completed_items if item.target_url]
            if target_urls:
                indexing_client = IndexNowClient()
                asyncio.create_task(indexing_client.submit_urls(host=site.domain, url_list=target_urls))
        except Exception:
            pass

    return ExecutionResultResponse(
        success=all_success,
        status=cs.status,
        error_message=error_msg,
        rolled_back=rolled_back
    )

@router.get("/change-sets", response_model=List[ChangeSetResponse])
async def list_change_sets(
    org_id: str,
    site_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    """Lists all change sets for a site ordered by creation date."""
    user_id = payload.get("sub")
    await verify_site_access(org_id, site_id, user_id, db)

    result = await db.execute(
        select(ChangeSet)
        .where(ChangeSet.site_id == site_id)
        .order_by(ChangeSet.created_at.desc())
    )
    change_sets = result.scalars().all()

    responses = []
    for cs in change_sets:
        items_res = await db.execute(select(ChangeItem).where(ChangeItem.change_set_id == cs.id))
        items = items_res.scalars().all()
        responses.append(
            ChangeSetResponse(
                id=cs.id,
                site_id=cs.site_id,
                recommendation_id=cs.recommendation_id,
                status=cs.status,
                risk_level=cs.risk_level,
                created_at=cs.created_at,
                executed_at=cs.executed_at,
                items=items
            )
        )
    return responses

@router.get("/change-sets/{change_set_id}", response_model=ChangeSetResponse)
async def get_change_set(
    org_id: str,
    site_id: str,
    change_set_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves a single change set with all child change items."""
    user_id = payload.get("sub")
    await verify_site_access(org_id, site_id, user_id, db)

    cs = (await db.execute(select(ChangeSet).where(ChangeSet.id == change_set_id, ChangeSet.site_id == site_id))).scalars().first()
    if not cs:
        raise HTTPException(status_code=404, detail="ChangeSet not found")

    items = (await db.execute(select(ChangeItem).where(ChangeItem.change_set_id == cs.id))).scalars().all()
    return ChangeSetResponse(
        id=cs.id,
        site_id=cs.site_id,
        recommendation_id=cs.recommendation_id,
        status=cs.status,
        risk_level=cs.risk_level,
        created_at=cs.created_at,
        executed_at=cs.executed_at,
        items=items
    )

@router.post("/change-sets/{change_set_id}/rollback", response_model=ExecutionResultResponse)
async def rollback_change_set(
    org_id: str,
    site_id: str,
    change_set_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    """Rolls back an executed change set and restores pre-write backup state."""
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db, ["OWNER", "ADMIN", "SEO_MANAGER"])

    cs = (await db.execute(select(ChangeSet).where(ChangeSet.id == change_set_id, ChangeSet.site_id == site_id))).scalars().first()
    if not cs:
        raise HTTPException(status_code=404, detail="ChangeSet not found")

    items = (await db.execute(select(ChangeItem).where(ChangeItem.change_set_id == cs.id))).scalars().all()
    if not items:
        raise HTTPException(status_code=400, detail="ChangeSet has no items to rollback")

    connector_record = (await db.execute(select(SiteConnector).where(SiteConnector.site_id == site_id, SiteConnector.is_active.is_(True)))).scalars().first()
    if connector_record:
        try:
            connector = build_connector(connector_record)
        except Exception:
            connector = get_fallback_sandbox_connector(site.domain)
    else:
        connector = get_fallback_sandbox_connector(site.domain)

    rolled_back_all = True
    error_msg = None
    for item in reversed(items):
        try:
            if isinstance(item.state_before, str):
                try:
                    backup = json.loads(item.state_before)
                except Exception:
                    backup = {"url": item.target_url, "content": item.state_before}
            elif isinstance(item.state_before, dict):
                backup = item.state_before
            else:
                backup = {"url": item.target_url}

            await connector.rollback_change(backup)
            item.status = "ROLLED_BACK"
        except Exception as e:
            rolled_back_all = False
            item.status = "ROLLBACK_FAILED"
            error_msg = str(e)

    cs.status = "ROLLED_BACK" if rolled_back_all else "ROLLBACK_FAILED"
    await db.commit()

    return ExecutionResultResponse(
        success=rolled_back_all,
        status=cs.status,
        error_message=error_msg,
        rolled_back=True
    )

@router.post("/self-heal", response_model=SelfHealResponse)
async def self_heal_issue(
    org_id: str,
    site_id: str,
    req: SelfHealRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    """
    Autonomous Self-Healing endpoint.
    Receives an issue or opportunity, constructs an actionable change-set,
    and safely applies mutations with optimistic concurrency check, pre-write backup,
    and post-write validation.
    """
    user_id = payload.get("sub")
    site = await verify_site_access(org_id, site_id, user_id, db, ["OWNER", "ADMIN", "SEO_MANAGER"])

    # 1. Resolve operation type
    op = req.operation
    if not op:
        cat = (req.category or "").upper()
        if "CANONICAL" in cat:
            op = "SET_CANONICAL"
        elif "META" in cat or "TITLE" in cat:
            op = "UPDATE_META"
        elif "REDIRECT" in cat or "301" in cat or "BROKEN" in cat:
            op = "EDGE_REDIRECT_301"
        elif "SCHEMA" in cat:
            op = "INJECT_SCHEMA_JSONLD"
        else:
            op = "UPDATE_SEO_TAGS"

    # 2. Concurrency hash resolution
    expected_hash = req.expected_hash_before
    if not expected_hash:
        page_rec = (await db.execute(
            select(CrawlPage).where(CrawlPage.site_id == site_id, CrawlPage.url == req.target_url)
        )).scalars().first()
        if page_rec:
            expected_hash = page_rec.canonical_seo_hash or page_rec.raw_html_hash or ""
        else:
            expected_hash = hashlib.sha256(f"baseline:{req.target_url}".encode()).hexdigest()[:16]

    # 3. Create ChangeSet
    cs = ChangeSet(
        site_id=site_id,
        recommendation_id=None,
        risk_level=req.risk_level,
        status="APPROVED" if req.auto_execute and req.risk_level in ("INFO", "LOW", "MEDIUM") else "WAITING_APPROVAL",
        created_by=user_id,
        approved_by=user_id if req.auto_execute else None,
        approved_at=datetime.now(timezone.utc) if req.auto_execute else None
    )
    db.add(cs)
    await db.flush()

    ci = ChangeItem(
        change_set_id=cs.id,
        target_url=req.target_url,
        operation=op,
        state_before=req.state_before or json.dumps({"url": req.target_url, "current_hash": expected_hash}),
        state_after=req.state_after or json.dumps({"url": req.target_url, "op": op, "target": req.target_url}),
        expected_hash_before=expected_hash,
        status="PENDING"
    )
    db.add(ci)
    await db.commit()
    await db.refresh(cs)

    # 4. If auto_execute requested and approved, execute via SafeSiteExecutor
    exec_result = None
    connector_type = "SANDBOX"
    if req.auto_execute and cs.status == "APPROVED":
        connector_record = (await db.execute(select(SiteConnector).where(SiteConnector.site_id == site_id, SiteConnector.is_active.is_(True)))).scalars().first()
        if connector_record:
            try:
                connector = build_connector(connector_record)
                connector_type = connector_record.connector_type
            except Exception:
                connector = get_fallback_sandbox_connector(site.domain)
                connector_type = "SANDBOX"
        else:
            connector = get_fallback_sandbox_connector(site.domain)
            connector_type = "SANDBOX"

        executor = SafeSiteExecutor(connector)
        cs.status = "EXECUTING"
        await db.commit()

        exec_res = await executor.execute_change_item(
            change_item={
                "id": ci.id,
                "target_url": ci.target_url,
                "expected_hash_before": ci.expected_hash_before,
                "risk_level": cs.risk_level,
                "operation": ci.operation,
                "state_after": ci.state_after
            },
            require_approval=False,
            is_approved=True
        )

        ci.status = "SUCCESS" if exec_res.success else "FAILED"
        cs.status = "SUCCESS" if exec_res.success else "FAILED"
        cs.executed_at = datetime.now(timezone.utc)
        await db.commit()

        exec_result = ExecutionResultResponse(
            success=exec_res.success,
            status=cs.status,
            error_message=exec_res.error_message,
            rolled_back=exec_res.rolled_back
        )

        # IndexNow notification on success
        if exec_res.success:
            try:
                import asyncio
                from services.integrations.indexing_client import IndexNowClient
                indexing_client = IndexNowClient()
                asyncio.create_task(indexing_client.submit_urls(host=site.domain, url_list=[ci.target_url]))
            except Exception:
                pass

    items_res = await db.execute(select(ChangeItem).where(ChangeItem.change_set_id == cs.id))
    items_list = items_res.scalars().all()

    cs_response = ChangeSetResponse(
        id=cs.id,
        site_id=cs.site_id,
        recommendation_id=cs.recommendation_id,
        status=cs.status,
        risk_level=cs.risk_level,
        created_at=cs.created_at,
        executed_at=cs.executed_at,
        items=items_list
    )

    return SelfHealResponse(
        success=exec_result.success if exec_result else True,
        change_set=cs_response,
        execution=exec_result,
        message=f"Sorun #{req.issue_id or 'GEN-1'} için otonom düzeltme başarıyla uygulandı.",
        connector_type=connector_type
    )

