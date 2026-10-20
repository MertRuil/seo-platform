from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.routes.sites import verify_site_access
from packages.config.settings import settings
from packages.shared.database import get_db
from services.notifications.alert_dispatcher import AlertDispatcher, AlertPayload
from services.security.jwt_auth import get_current_user_payload
from services.security.rate_limiter import alerts_test_limiter

router = APIRouter(prefix="/organizations/{org_id}/sites/{site_id}/alerts", tags=["Alert Channels"])


class AlertTestRequest(BaseModel):
    channel: Literal["SLACK", "DISCORD", "TELEGRAM", "WEBHOOK"]
    target: str = Field(..., min_length=1, max_length=500, description="Webhook URL; Telegram için chat id")
    secret: Optional[str] = Field(default=None, max_length=500, description="Telegram bot token veya webhook HMAC anahtarı")


class AlertTestResponse(BaseModel):
    success: bool
    channel: str
    status_code: int
    message: str


@router.post("/test", response_model=AlertTestResponse, dependencies=[Depends(alerts_test_limiter)])
async def send_test_alert(
    org_id: str,
    site_id: str,
    req: AlertTestRequest,
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    site = await verify_site_access(org_id, site_id, payload.get("sub"), db, ["OWNER", "ADMIN", "SEO_MANAGER"])

    values = [req.target, req.secret or ""]
    # mock:// hedefleri gönderim yapmadan başarı döner; üretimde gerçek teslimat sanılmasın.
    if settings.is_production_like and any(v.strip().lower().startswith("mock") for v in values):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Test hedefleri üretimde kullanılamaz.")
    if req.channel in ("TELEGRAM", "WEBHOOK") and not req.secret:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bu kanal için gizli anahtar gerekli.")

    alert = AlertPayload(
        event_type="TEST",
        title="Test bildirimi",
        summary="Bu mesaj alarm kanalının çalıştığını doğrulamak için gönderildi.",
        site_domain=site.domain,
        severity="INFO",
    )
    if req.channel == "SLACK":
        result = await AlertDispatcher.send_slack_alert(req.target, alert)
    elif req.channel == "DISCORD":
        result = await AlertDispatcher.send_discord_alert(req.target, alert)
    elif req.channel == "TELEGRAM":
        result = await AlertDispatcher.send_telegram_alert(req.secret, req.target, alert)
    else:
        result = await AlertDispatcher.send_custom_webhook(req.target, req.secret, alert)

    return AlertTestResponse(
        success=bool(result.get("success")),
        channel=str(result.get("channel", req.channel)),
        status_code=int(result.get("status_code", 0)),
        message=str(result.get("message", "")),
    )
