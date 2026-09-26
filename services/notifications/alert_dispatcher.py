import logging
import hmac
import hashlib
import json
import html
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import httpx
from services.security.ssrf import validate_safe_url, SSRFSecurityException

logger = logging.getLogger("notifications.alert_dispatcher")


def _is_mock_url(url: str) -> bool:
    """
    Strictly checks if a URL uses the mock:// scheme or is explicitly 'mock'.
    Prevents false-positive interception of legitimate domains containing 'test' or 'mock'
    (e.g., contest.io, latest-corp.com, fastest-cdn.net, mock-server.corp).
    """
    if not url:
        return False
    u = url.strip()
    return u.startswith("mock://") or u.lower() == "mock"


def _is_mock_bot_token(token: str) -> bool:
    """
    Strictly checks if a bot token is a designated mock token.
    Prevents false-positive substring matching against genuine tokens.
    """
    if not token:
        return False
    t = token.strip()
    return t.startswith("mock_") or t.lower() in ("mock", "mock_token") or t.startswith("mock://")


def _telegram_html_escape(text: str) -> str:
    """
    Escapes HTML special characters (&, <, >) to ensure Telegram HTML parse mode succeeds.
    Prevents HTTP 400 Bad Request: can't parse entities errors.
    """
    if not text:
        return ""
    return html.escape(str(text), quote=False)


def _slack_mrkdwn_escape(text: str) -> str:
    """
    Escapes &, <, > for Slack mrkdwn text to prevent broken formatting.
    """
    if not text:
        return ""
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


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
        if _is_mock_url(webhook_url):
            return {
                "success": True,
                "channel": "SLACK",
                "status_code": 200,
                "message": "Slack mock bildirimi başarılı (mock:// simülasyonu)."
            }

        # SSRF Guard for legitimate outbound webhooks
        try:
            validate_safe_url(webhook_url)
        except SSRFSecurityException as e:
            return {
                "success": False,
                "channel": "SLACK",
                "status_code": 400,
                "message": f"SSRF Kalkanı: Slack webhook adresi engellendi ({e})"
            }

        color = "#EF4444" if alert.severity == "CRITICAL" else "#F59E0B" if alert.severity == "WARNING" else "#10B981"
        emoji_prefix = cls._get_severity_emoji(alert.severity)

        safe_domain = _slack_mrkdwn_escape(alert.site_domain)
        safe_event = _slack_mrkdwn_escape(alert.event_type)
        safe_summary = _slack_mrkdwn_escape(alert.summary)

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
                                "text": f"*Web Sitesi:* `{safe_domain}`\n*Olay:* `{safe_event}`\n\n{safe_summary}"
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

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(webhook_url, json=payload)
                is_ok = 200 <= res.status_code < 300
                return {
                    "success": is_ok,
                    "channel": "SLACK",
                    "status_code": res.status_code,
                    "message": "Slack bildirimi iletildi." if is_ok else f"Slack hatası (HTTP {res.status_code}): {res.text[:200]}"
                }
        except Exception as e:
            logger.error(f"Slack delivery error: {e}")
            return {"success": False, "channel": "SLACK", "status_code": 500, "message": str(e)}

    @classmethod
    async def send_discord_alert(cls, webhook_url: str, alert: AlertPayload) -> Dict[str, Any]:
        """Formats and delivers a Discord embed notification."""
        if _is_mock_url(webhook_url):
            return {
                "success": True,
                "channel": "DISCORD",
                "status_code": 204,
                "message": "Discord mock bildirimi başarılı (mock:// simülasyonu)."
            }

        # SSRF Guard for legitimate outbound webhooks
        try:
            validate_safe_url(webhook_url)
        except SSRFSecurityException as e:
            return {
                "success": False,
                "channel": "DISCORD",
                "status_code": 400,
                "message": f"SSRF Kalkanı: Discord webhook adresi engellendi ({e})"
            }

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

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(webhook_url, json=payload)
                is_ok = res.status_code in (200, 204)
                return {
                    "success": is_ok,
                    "channel": "DISCORD",
                    "status_code": res.status_code,
                    "message": "Discord bildirimi iletildi." if is_ok else f"Discord hatası (HTTP {res.status_code}): {res.text[:200]}"
                }
        except Exception as e:
            logger.error(f"Discord delivery error: {e}")
            return {"success": False, "channel": "DISCORD", "status_code": 500, "message": str(e)}

    @classmethod
    async def send_telegram_alert(cls, bot_token: str, chat_id: str, alert: AlertPayload) -> Dict[str, Any]:
        """
        Formats and delivers a Telegram message via Bot API.
        Escapes HTML special characters to prevent Telegram API 400 parse errors on '<' and '&'.
        Includes auto-fallback to plain text if Telegram rejects entity markup.
        """
        if _is_mock_bot_token(bot_token):
            return {
                "success": True,
                "channel": "TELEGRAM",
                "status_code": 200,
                "message": "Telegram mock bildirimi başarılı (mock simülasyonu)."
            }

        emoji_prefix = cls._get_severity_emoji(alert.severity)

        # Strict HTML escaping to ensure '<', '>', '&' don't break Telegram Bot API
        safe_title = _telegram_html_escape(alert.title)
        safe_domain = _telegram_html_escape(alert.site_domain)
        safe_severity = _telegram_html_escape(alert.severity)
        safe_event = _telegram_html_escape(alert.event_type)
        safe_summary = _telegram_html_escape(alert.summary)
        safe_ts = _telegram_html_escape(alert.timestamp[:19].replace('T', ' '))

        text = (
            f"<b>{emoji_prefix} {safe_title}</b>\n\n"
            f"🌐 <b>Site:</b> <code>{safe_domain}</code>\n"
            f"⚡ <b>Seviye:</b> {safe_severity}\n"
            f"📌 <b>Olay:</b> {safe_event}\n\n"
            f"{safe_summary}\n\n"
            f"<i>Otonom SEO Platformu • {safe_ts} UTC</i>"
        )

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
                data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}

                # Automatic fallback: If Telegram fails due to entity parsing despite escaping, retry as plain text
                if not data.get("ok") and (res.status_code == 400 or "can't parse entities" in str(data.get("description", "")).lower()):
                    logger.warning("Telegram HTML entity parsing failed, retrying delivery with plain text fallback...")
                    plain_text = (
                        f"{emoji_prefix} {alert.title}\n\n"
                        f"🌐 Site: {alert.site_domain}\n"
                        f"⚡ Seviye: {alert.severity}\n"
                        f"📌 Olay: {alert.event_type}\n\n"
                        f"{alert.summary}\n\n"
                        f"Otonom SEO Platformu • {alert.timestamp[:19].replace('T', ' ')} UTC"
                    )
                    plain_payload = {
                        "chat_id": chat_id,
                        "text": plain_text,
                        "disable_web_page_preview": True
                    }
                    retry_res = await client.post(endpoint, json=plain_payload)
                    if retry_res.headers.get("content-type", "").startswith("application/json"):
                        data = retry_res.json()
                    res = retry_res

                is_ok = bool(data.get("ok", False))
                return {
                    "success": is_ok,
                    "channel": "TELEGRAM",
                    "status_code": res.status_code,
                    "message": "Telegram bildirimi iletildi." if is_ok else data.get("description", f"Telegram hatası (HTTP {res.status_code})")
                }
        except Exception as e:
            logger.error(f"Telegram delivery error: {e}")
            return {"success": False, "channel": "TELEGRAM", "status_code": 500, "message": str(e)}

    @classmethod
    async def send_custom_webhook(cls, endpoint_url: str, secret_key: str, alert: AlertPayload) -> Dict[str, Any]:
        """
        Sends an HMAC-SHA256 authenticated webhook payload.
        Ensures legitimate domains containing 'test' (e.g. contest.io, latest-corp.com)
        are properly delivered over HTTP/HTTPS rather than intercepted.
        """
        if _is_mock_url(endpoint_url):
            return {
                "success": True,
                "channel": "WEBHOOK",
                "status_code": 200,
                "message": "Webhook mock bildirimi başarılı (mock:// simülasyonu)."
            }

        # SSRF Guard for legitimate outbound webhooks
        try:
            validate_safe_url(endpoint_url)
        except SSRFSecurityException as e:
            return {
                "success": False,
                "channel": "WEBHOOK",
                "status_code": 400,
                "message": f"SSRF Kalkanı: Webhook adresi engellendi ({e})"
            }

        body_bytes = json.dumps(alert.to_dict(), separators=(",", ":")).encode("utf-8")
        signature = hmac.new(secret_key.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()

        headers = {
            "Content-Type": "application/json",
            "X-Seo-Signature-256": signature,
            "X-Seo-Event": alert.event_type,
            "X-Seo-Timestamp": alert.timestamp,
            "User-Agent": "Autonomous-SEO-Webhook-Dispatcher/1.0"
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(endpoint_url, headers=headers, content=body_bytes)
                is_ok = 200 <= res.status_code < 300
                msg = (
                    f"Webhook başarıyla iletildi (HTTP {res.status_code})."
                    if is_ok else
                    f"Webhook çağrısı başarısız oldu (HTTP {res.status_code}): {res.text[:200]}"
                )
                return {
                    "success": is_ok,
                    "channel": "WEBHOOK",
                    "status_code": res.status_code,
                    "message": msg
                }
        except Exception as e:
            logger.error(f"Webhook delivery error: {e}")
            return {"success": False, "channel": "WEBHOOK", "status_code": 500, "message": str(e)}
