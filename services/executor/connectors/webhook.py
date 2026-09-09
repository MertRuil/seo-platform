import hmac
import hashlib
import json
import time
import httpx
from typing import Dict, Any, List
from services.executor.base import SiteConnector
from services.security.ssrf import validate_safe_url

class GenericWebhookConnector(SiteConnector):
    """
    Connects to custom enterprise CMS via HMAC-SHA256 signed webhooks.
    Includes idempotency keys, timestamp validation, and strict SSRF defenses.
    """
    def __init__(self, webhook_url: str, secret_key: str):
        self.webhook_url = webhook_url
        self.secret_key = secret_key

    def _sign_payload(self, body: str, timestamp: str) -> str:
        data = f"{timestamp}.{body}".encode("utf-8")
        return hmac.new(self.secret_key.encode("utf-8"), data, hashlib.sha256).hexdigest()

    async def verify_connection(self) -> bool:
        if not self.webhook_url or not self.secret_key:
            return False
        if self.webhook_url.startswith("mock://"):
            return True
        try:
            validate_safe_url(self.webhook_url)
            return True
        except Exception:
            return False

    async def get_capabilities(self) -> List[str]:
        return ["CAN_EDIT_TITLE", "CAN_EDIT_META", "CAN_EDIT_SCHEMA", "CAN_EDIT_REDIRECT"]

    async def read_page_state(self, url: str) -> Dict[str, Any]:
        if self.webhook_url.startswith("mock://"):
            return {"url": url, "current_hash": "dummy-hash", "is_valid": True}
        validate_safe_url(url)
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=False) as client:
            response = await client.get(url)
            content_hash = hashlib.sha256(response.content).hexdigest()
            return {"url": url, "current_hash": content_hash, "status_code": response.status_code, "is_valid": response.status_code < 500}

    async def apply_change(self, change_item: Dict[str, Any]) -> bool:
        timestamp = str(int(time.time()))
        body_json = json.dumps(change_item)
        signature = self._sign_payload(body_json, timestamp)

        headers = {
            "Content-Type": "application/json",
            "X-Timestamp": timestamp,
            "X-Signature": signature,
            "X-Idempotency-Key": change_item.get("id", str(time.time()))
        }
        # In mock / unit test mode:
        if self.webhook_url.startswith("mock://"):
            return True

        validate_safe_url(self.webhook_url)
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=False) as client:
            resp = await client.post(self.webhook_url, headers=headers, data=body_json)
            return resp.status_code in (200, 201, 204)

    async def rollback_change(self, backup_state: Dict[str, Any]) -> bool:
        # Dispatches inverse state payload
        return await self.apply_change(backup_state)
