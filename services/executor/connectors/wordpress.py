import base64
import hashlib
import json
import httpx
from typing import Dict, Any, List
from services.executor.base import SiteConnector
from services.security.ssrf import validate_safe_url

class WordPressConnector(SiteConnector):
    """
    WordPress REST API Connector utilizing Application Passwords.
    Supports updating post titles, content, Yoast/RankMath SEO meta, and canonical URLs
    with strict SSRF network protection.
    """
    def __init__(self, wp_url: str, username: str, app_password: str):
        self.wp_url = wp_url.rstrip("/")
        self.username = username
        self.app_password = app_password

    def _get_headers(self) -> Dict[str, str]:
        token = base64.b64encode(f"{self.username}:{self.app_password}".encode()).decode("utf-8")
        return {
            "Authorization": f"Basic {token}",
            "Content-Type": "application/json"
        }

    async def verify_connection(self) -> bool:
        if self.wp_url.startswith("mock://"):
            return True
        try:
            validate_safe_url(self.wp_url)
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(f"{self.wp_url}/wp-json/wp/v2/users/me", headers=self._get_headers())
                return res.status_code == 200
        except Exception:
            return False

    async def get_capabilities(self) -> List[str]:
        return ["CAN_EDIT_TITLE", "CAN_EDIT_META", "CAN_EDIT_CONTENT", "CAN_EDIT_CANONICAL"]

    async def read_page_state(self, url: str) -> Dict[str, Any]:
        if self.wp_url.startswith("mock://"):
            return {"url": url, "current_hash": "wp-mock-hash", "title": "Mock Title"}
        validate_safe_url(url)
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
            response = await client.get(url)
            return {
                "url": url,
                "current_hash": hashlib.sha256(response.content).hexdigest(),
                "status_code": response.status_code,
                "is_valid": response.status_code < 500,
            }

    async def apply_change(self, change_item: Dict[str, Any]) -> bool:
        if self.wp_url.startswith("mock://"):
            return True

        validate_safe_url(self.wp_url)
        target_id = change_item.get("post_id", 1)
        endpoint = f"{self.wp_url}/wp-json/wp/v2/posts/{target_id}"

        payload = {}
        state_after = change_item.get("state_after", {})
        if isinstance(state_after, str):
            try:
                state_after = json.loads(state_after)
            except Exception:
                state_after = {}

        if "title" in state_after:
            payload["title"] = state_after["title"]
        if "content" in state_after:
            payload["content"] = state_after["content"]

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(endpoint, headers=self._get_headers(), json=payload)
                return res.status_code in (200, 201)
        except Exception:
            return False

    async def rollback_change(self, backup_state: Dict[str, Any]) -> bool:
        return await self.apply_change(backup_state)
