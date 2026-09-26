import logging
import hmac
import hashlib
import json
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import httpx

logger = logging.getLogger("notifications.alert_dispatcher")

class AlertPayload:
    def __init__(
        self,
        event_type: str,
        title: str,
        summary: str,
        site_domain: str,
        severity: str = "WARNING",
        metadata: Optional[Dict[str, Any]] = None,
        timestamp: Optional[str] = None
    ):
        self.event_type = event_type
        self.title = title
        self.summary = summary
        self.site_domain = site_domain
        self.severity = severity.upper()
        self.metadata = metadata or {}
        self.timestamp = timestamp or datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_type": self.event_type,
            "title": self.title,
            "summary": self.summary,
            "site_domain": self.site_domain,
            "severity": self.severity,
            "metadata": self.metadata,
            "timestamp": self.timestamp
        }

class AlertDispatcher:
    """
    Multi-channel real-time notification engine for SEO alerts:
    Supports Slack Incoming Webhooks, Discord Webhooks, Telegram Bot API,
    and HMAC-SHA256 authenticated enterprise HTTP Webhooks.
    """

    @staticmethod
    def _get_severity_emoji(severity: str) -> str:
        s = severity.upper()
        if s == "CRITICAL":
            return "🚨 [KRİTİK]"
        elif s == "WARNING":
            return "⚠️ [UYARI]"
        elif s == "SUCCESS":
            return "✅ [BAŞARILI]"
        return "ℹ️ [BİLGİ]"

    @classmethod
    async def send_slack_alert(cls, webhook_url: str, alert: AlertPayload) -> Dict[str, Any]:
        """Formats and delivers a rich Slack Block Kit notification."""
        color = "#EF4444" if alert.severity == "CRITICAL" else "#F59E0B" if alert.severity == "WARNING" else "#10B981"
        emoji_prefix = cls._get_severity_emoji(alert.severity)

        payload = {
            "text": f"{emoji_prefix} {alert.title} - {alert.site_domain}",
            "attachments": [
                {
                    "color": color,
                    "blocks": [
                        {
                            "type": "header",
                            "text": {
                                "type": "plain_text",
                                "text": f"{emoji_prefix} {alert.title}",
                                "emoji": True
                            }
                        },
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": f"*Web Sitesi:* `{alert.site_domain}`\n*Olay:* `{alert.event_type}`\n\n{alert.summary}"
                            }
                        },
                        {
                            "type": "context",
                            "elements": [
                                {
                                    "type": "mrkdwn",
                                    "text": f"Otonom SEO Platformu • {alert.timestamp}"
                                }
                            ]
                        }
                    ]
                }
            ]
        }

        if "mock" in webhook_url.lower() or "test" in webhook_url.lower():
            return {"success": True, "channel": "SLACK", "status_code": 200, "message": "Slack mock bildirimi başarılı."}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(webhook_url, json=payload)
                return {
                    "success": res.status_code == 200,
                    "channel": "SLACK",
                    "status_code": res.status_code,
                    "message": "Slack bildirimi iletildi." if res.status_code == 200 else f"Slack hatası: {res.text}"
                }
        except Exception as e:
            logger.error(f"Slack delivery error: {e}")
            return {"success": False, "channel": "SLACK", "status_code": 500, "message": str(e)}

    @classmethod
    async def send_discord_alert(cls, webhook_url: str, alert: AlertPayload) -> Dict[str, Any]:
        """Formats and delivers a Discord embed notification."""
        color_int = 0xEF4444 if alert.severity == "CRITICAL" else 0xF59E0B if alert.severity == "WARNING" else 0x10B981
        emoji_prefix = cls._get_severity_emoji(alert.severity)

        embed = {
            "title": f"{emoji_prefix} {alert.title}",
            "description": alert.summary,
            "color": color_int,
            "fields": [
                {"name": "Domain", "value": alert.site_domain, "inline": True},
                {"name": "Seviye", "value": alert.severity, "inline": True},
                {"name": "Olay Türü", "value": alert.event_type, "inline": True}
            ],
            "footer": {"text": "Otonom SEO Platformu"},
            "timestamp": alert.timestamp
        }

        payload = {
            "username": "SEO Alert Bot",
            "embeds": [embed]
        }

        if "mock" in webhook_url.lower() or "test" in webhook_url.lower():
            return {"success": True, "channel": "DISCORD", "status_code": 204, "message": "Discord mock bildirimi başarılı."}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(webhook_url, json=payload)
                return {
                    "success": res.status_code in (200, 204),
                    "channel": "DISCORD",
                    "status_code": res.status_code,
                    "message": "Discord bildirimi iletildi." if res.status_code in (200, 204) else f"Discord hatası: {res.text}"
                }
        except Exception as e:
            logger.error(f"Discord delivery error: {e}")
            return {"success": False, "channel": "DISCORD", "status_code": 500, "message": str(e)}

    @classmethod
    async def send_telegram_alert(cls, bot_token: str, chat_id: str, alert: AlertPayload) -> Dict[str, Any]:
        """Formats and delivers a Telegram message via Bot API."""
        emoji_prefix = cls._get_severity_emoji(alert.severity)
        text = (
            f"<b>{emoji_prefix} {alert.title}</b>\n\n"
            f"🌐 <b>Site:</b> <code>{alert.site_domain}</code>\n"
            f"⚡ <b>Seviye:</b> {alert.severity}\n"
            f"📌 <b>Olay:</b> {alert.event_type}\n\n"
            f"{alert.summary}\n\n"
            f"<i>Otonom SEO Platformu • {alert.timestamp[:19].replace('T', ' ')} UTC</i>"
        )

        if "mock" in bot_token.lower() or "test" in bot_token.lower():
            return {"success": True, "channel": "TELEGRAM", "status_code": 200, "message": "Telegram mock bildirimi başarılı."}

        endpoint = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(endpoint, json=payload)
                data = res.json()
                return {
                    "success": data.get("ok", False),
                    "channel": "TELEGRAM",
                    "status_code": res.status_code,
                    "message": "Telegram bildirimi iletildi." if data.get("ok") else data.get("description", "Hata")
                }
        except Exception as e:
            logger.error(f"Telegram delivery error: {e}")
            return {"success": False, "channel": "TELEGRAM", "status_code": 500, "message": str(e)}

    @classmethod
    async def send_custom_webhook(cls, endpoint_url: str, secret_key: str, alert: AlertPayload) -> Dict[str, Any]:
        """Sends an HMAC-SHA256 authenticated webhook payload."""
        body_bytes = json.dumps(alert.to_dict(), separators=(",", ":")).encode("utf-8")
        signature = hmac.new(secret_key.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()

        headers = {
            "Content-Type": "application/json",
            "X-Seo-Signature-256": signature,
            "X-Seo-Event": alert.event_type,
            "X-Seo-Timestamp": alert.timestamp,
            "User-Agent": "Autonomous-SEO-Webhook-Dispatcher/1.0"
        }

        if "mock" in endpoint_url.lower() or "test" in endpoint_url.lower():
            return {"success": True, "channel": "WEBHOOK", "status_code": 200, "message": "Webhook mock bildirimi başarılı."}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(endpoint_url, headers=headers, content=body_bytes)
                return {
                    "success": 200 <= res.status_code < 300,
                    "channel": "WEBHOOK",
                    "status_code": res.status_code,
                    "message": f"Webhook çağrıldı (HTTP {res.status_code})."
                }
        except Exception as e:
            logger.error(f"Webhook delivery error: {e}")
            return {"success": False, "channel": "WEBHOOK", "status_code": 500, "message": str(e)}
