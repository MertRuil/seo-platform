import base64
import hashlib
import json
import re
from urllib.parse import urlparse
from typing import Dict, Any, List, Optional
import httpx
from services.executor.base import SiteConnector
from services.security.ssrf import validate_safe_url
from services.crawler.html_extractor import HtmlExtractor

class WordPressConnector(SiteConnector):
    """
    WordPress REST API Connector utilizing Application Passwords.
    Supports updating post titles, content, Yoast/RankMath SEO meta, and canonical URLs
    with strict SSRF network protection and dynamic URL-to-post ID resolution.
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

    async def resolve_post_id(self, url: str) -> Optional[int]:
        """
        Resolves the WordPress Post or Page ID corresponding to a given URL.
        1. Extracts slug from URL path and queries /wp-json/wp/v2/posts?slug=...
        2. Queries /wp-json/wp/v2/pages?slug=... if post not found.
        3. Inspects HTML for shortlink (?p=...) or REST link headers as fallback.
        """
        if self.wp_url.startswith("mock://"):
            parsed = urlparse(url)
            slug = parsed.path.strip("/").split("/")[-1]
            return (abs(hash(slug)) % 1000) + 10 if slug else 10

        parsed = urlparse(url)
        path_parts = [p for p in parsed.path.strip("/").split("/") if p]
        slug = path_parts[-1] if path_parts else None

        validate_safe_url(self.wp_url)
        headers = self._get_headers()

        async with httpx.AsyncClient(timeout=10.0) as client:
            if slug:
                # 1. Look up in Posts
                try:
                    res = await client.get(f"{self.wp_url}/wp-json/wp/v2/posts", params={"slug": slug}, headers=headers)
                    if res.status_code == 200:
                        posts = res.json()
                        if isinstance(posts, list) and len(posts) > 0 and "id" in posts[0]:
                            return int(posts[0]["id"])
                except Exception:
                    pass

                # 2. Look up in Pages
                try:
                    res = await client.get(f"{self.wp_url}/wp-json/wp/v2/pages", params={"slug": slug}, headers=headers)
                    if res.status_code == 200:
                        pages = res.json()
                        if isinstance(pages, list) and len(pages) > 0 and "id" in pages[0]:
                            return int(pages[0]["id"])
                except Exception:
                    pass

            # 3. Fallback: inspect page head for shortlink or wp-json link
            try:
                validate_safe_url(url)
                page_res = await client.get(url, follow_redirects=True)
                if page_res.status_code == 200:
                    text = page_res.text
                    m = re.search(r'rel=[\'"]shortlink[\'"][^>]*[\?&]p=(\d+)', text, re.IGNORECASE)
                    if m:
                        return int(m.group(1))
                    m = re.search(r'wp/v2/(?:posts|pages)/(\d+)', text, re.IGNORECASE)
                    if m:
                        return int(m.group(1))
            except Exception:
                pass

        return None

    async def read_page_state(self, url: str) -> Dict[str, Any]:
        if self.wp_url.startswith("mock://"):
            return {
                "url": url,
                "current_hash": "wp-mock-hash",
                "canonical_seo_hash": "wp-mock-hash",
                "title": "Mock Title",
                "is_valid": True
            }
        validate_safe_url(url)
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
            response = await client.get(url)
            extracted = HtmlExtractor.extract(response.text, url)
            return {
                "url": url,
                "current_hash": hashlib.sha256(response.content).hexdigest(),
                "canonical_seo_hash": extracted.canonical_seo_hash,
                "title": extracted.title,
                "status_code": response.status_code,
                "is_valid": response.status_code < 500,
            }

    async def apply_change(self, change_item: Dict[str, Any]) -> bool:
        target_id = change_item.get("post_id")
        if target_id is None:
            target_url = change_item.get("target_url", "")
            if not target_url:
                return False
            target_id = await self.resolve_post_id(target_url)
            if target_id is None:
                # Target post/page cannot be resolved; reject mutation rather than corrupting post 1
                return False

        try:
            target_id = int(target_id)
        except (ValueError, TypeError):
            return False

        if self.wp_url.startswith("mock://"):
            return True

        validate_safe_url(self.wp_url)

        state_after = change_item.get("state_after", {})
        if isinstance(state_after, str):
            try:
                state_after = json.loads(state_after)
            except Exception:
                state_after = {}

        payload: Dict[str, Any] = {}
        if "title" in state_after:
            payload["title"] = state_after["title"]
        if "content" in state_after:
            payload["content"] = state_after["content"]

        # Support Yoast & RankMath meta fields
        meta: Dict[str, Any] = {}
        if "title" in state_after:
            meta["_yoast_wpseo_title"] = state_after["title"]
            meta["rank_math_title"] = state_after["title"]
        if "meta_description" in state_after:
            meta["_yoast_wpseo_metadesc"] = state_after["meta_description"]
            meta["rank_math_description"] = state_after["meta_description"]
        if "canonical" in state_after:
            meta["_yoast_wpseo_canonical"] = state_after["canonical"]
            meta["rank_math_canonical_url"] = state_after["canonical"]
        if meta:
            payload["meta"] = meta

        headers = self._get_headers()
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # First attempt posts endpoint
                endpoint = f"{self.wp_url}/wp-json/wp/v2/posts/{target_id}"
                res = await client.post(endpoint, headers=headers, json=payload)
                if res.status_code in (200, 201):
                    return True
                # Fallback to pages endpoint if 404
                if res.status_code == 404:
                    page_endpoint = f"{self.wp_url}/wp-json/wp/v2/pages/{target_id}"
                    page_res = await client.post(page_endpoint, headers=headers, json=payload)
                    return page_res.status_code in (200, 201)
                return False
        except Exception:
            return False

    async def rollback_change(self, backup_state: Dict[str, Any]) -> bool:
        return await self.apply_change(backup_state)
