import uuid
import json
from urllib.parse import urlparse
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from packages.shared.database import get_db
from packages.shared.models import ChangeSet, ChangeItem, Site, SiteConnector
from packages.contracts.execution import (
    ChangeSetCreateRequest,
    ChangeSetResponse,
    ExecutionResultResponse
)
from apps.api.routes.sites import verify_site_access
from services.security.jwt_auth import get_current_user_payload
from services.executor.executor_service import SafeSiteExecutor
from services.executor.connectors.webhook import GenericWebhookConnector
from services.executor.connectors.wordpress import WordPressConnector
from services.executor.connectors.git import GitBasedConnector
from services.executor.connectors.cloudflare import CloudflareWorkerConnector
from services.security.crypto import decrypt_secret

from services.executor.connector_factory import build_connector_from_record

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
        ci = ChangeItem(
            change_set_id=cs.id,
            target_url=item.target_url,
            operation=item.operation,
            state_before=item.state_before,
            state_after=item.state_after,
            expected_hash_before=item.expected_hash_before,
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
    if not cs:
        raise HTTPException(status_code=404, detail="ChangeSet not found")
    if cs.risk_level in ("HIGH", "CRITICAL") and cs.status != "APPROVED":
        raise HTTPException(status_code=409, detail="High-risk ChangeSet requires explicit approval")
    if cs.status not in ("DRAFT", "APPROVED"):
        raise HTTPException(status_code=409, detail="ChangeSet cannot be executed in its current state")

    res_items = await db.execute(select(ChangeItem).where(ChangeItem.change_set_id == cs.id))
    items = res_items.scalars().all()
    if not items:
        raise HTTPException(status_code=400, detail="ChangeSet has no items to execute")

    connector_record = (await db.execute(select(SiteConnector).where(SiteConnector.site_id == site_id, SiteConnector.is_active.is_(True)))).scalars().first()
    if connector_record:
        connector = build_connector(connector_record)
        if not await connector.verify_connection():
            raise HTTPException(status_code=502, detail="Site connector verification failed")
    else:
        connector = GenericWebhookConnector("mock://endpoint", "secret")
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
