import base64
import hashlib
import json
import logging
import uuid
from urllib.parse import urlparse
from typing import Dict, Any, List, Optional
import httpx
from services.executor.base import SiteConnector
from services.security.ssrf import validate_safe_url
from services.crawler.html_extractor import HtmlExtractor

logger = logging.getLogger(__name__)

class GitBasedConnector(SiteConnector):
    """
    Git-based connector that submits SEO changes via Pull Requests on GitHub.
    Ensures safe, version-controlled audit trails for modern headless and JAMstack websites.
    """
    def __init__(self, repo_full_name: str, access_token: str, default_branch: str = "main"):
        import re
        if repo_full_name and not repo_full_name.startswith("mock/") and not re.match(r"^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$", repo_full_name):
            raise ValueError("Geçersiz Git depo adı biçimi: 'sahip/depo' bekleniyor")
        self.repo = repo_full_name  # e.g. "owner/repo"
        self.token = access_token
        self.default_branch = default_branch
        self.base_url = f"https://api.github.com/repos/{self.repo}"

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json"
        }

    async def verify_connection(self) -> bool:
        if self.repo.startswith("mock/"):
            return True
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(self.base_url, headers=self._get_headers())
                return res.status_code == 200
        except Exception as e:
            logger.error(f"Git connector verification error for {self.repo}: {e}")
            return False

    async def get_capabilities(self) -> List[str]:
        return ["CAN_EDIT_TITLE", "CAN_EDIT_META", "CAN_EDIT_CONTENT", "CAN_EDIT_SCHEMA", "CAN_EDIT_ROBOTS"]

    async def read_page_state(self, url: str) -> Dict[str, Any]:
        if self.repo.startswith("mock/"):
            return {
                "url": url,
                "current_hash": "git-mock-head-sha",
                "canonical_seo_hash": "git-mock-head-sha",
                "is_valid": True
            }

        commit_sha = "git-head-commit-hash"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(f"{self.base_url}/commits/{self.default_branch}", headers=self._get_headers())
                if res.status_code == 200:
                    commit_sha = res.json().get("sha", commit_sha)
        except Exception as e:
            logger.warning(f"Could not fetch Git head commit SHA for {self.repo}: {e}")

        # If URL is live, also derive canonical SEO hash
        canonical_seo_hash = commit_sha
        try:
            validate_safe_url(url)
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                page_res = await client.get(url)
                if page_res.status_code == 200:
                    extracted = HtmlExtractor.extract(page_res.text, url)
                    canonical_seo_hash = extracted.canonical_seo_hash
        except Exception:
            pass

        return {
            "url": url,
            "current_hash": commit_sha,
            "canonical_seo_hash": canonical_seo_hash,
            "is_valid": True
        }

    async def apply_change(self, change_item: Dict[str, Any]) -> bool:
        if self.repo.startswith("mock/"):
            return True

        file_path = change_item.get("file_path") or change_item.get("file")
        if not file_path:
            parsed = urlparse(change_item.get("target_url", ""))
            slug = parsed.path.strip("/").replace("/", "_") or "index"
            file_path = f"seo-metadata/{slug}.json"

        state_after = change_item.get("state_after", {})
        if isinstance(state_after, str):
            try:
                state_after = json.loads(state_after)
            except Exception:
                state_after = {"raw": state_after}

        content_str = json.dumps(state_after, indent=2, ensure_ascii=False)
        branch_name = f"seo-opt-{uuid.uuid4().hex[:8]}"
        headers = self._get_headers()

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                # 1. Get base branch commit SHA
                ref_res = await client.get(f"{self.base_url}/git/ref/heads/{self.default_branch}", headers=headers)
                if ref_res.status_code != 200:
                    logger.error(f"Failed to fetch base branch ref for {self.repo}: {ref_res.text}")
                    return False
                base_sha = ref_res.json()["object"]["sha"]

                # 2. Create new branch
                branch_payload = {
                    "ref": f"refs/heads/{branch_name}",
                    "sha": base_sha
                }
                new_branch_res = await client.post(f"{self.base_url}/git/refs", headers=headers, json=branch_payload)
                if new_branch_res.status_code not in (200, 201):
                    logger.error(f"Failed to create branch {branch_name}: {new_branch_res.text}")
                    return False

                # 3. Check if target file already exists in branch
                file_sha: Optional[str] = None
                content_check = await client.get(f"{self.base_url}/contents/{file_path}", params={"ref": branch_name}, headers=headers)
                if content_check.status_code == 200:
                    file_sha = content_check.json().get("sha")

                # 4. Commit file update
                commit_payload: Dict[str, Any] = {
                    "message": f"SEO Optimization: {change_item.get('operation', 'Update metadata')}",
                    "content": base64.b64encode(content_str.encode("utf-8")).decode("utf-8"),
                    "branch": branch_name
                }
                if file_sha:
                    commit_payload["sha"] = file_sha

                put_res = await client.put(f"{self.base_url}/contents/{file_path}", headers=headers, json=commit_payload)
                if put_res.status_code not in (200, 201):
                    logger.error(f"Failed to commit file to {branch_name}: {put_res.text}")
                    return False

                # 5. Open Pull Request
                pr_payload = {
                    "title": f"SEO: {change_item.get('operation', 'Optimization')} for {change_item.get('target_url', 'site')}",
                    "head": branch_name,
                    "base": self.default_branch,
                    "body": (
                        f"Automated SEO optimization generated by Calpeo Autonomous SEO Platform.\n\n"
                        f"- **Target URL**: `{change_item.get('target_url')}`\n"
                        f"- **Operation**: `{change_item.get('operation')}`\n\n"
                        f"### Changes Applied:\n```json\n{content_str}\n```"
                    )
                }
                pr_res = await client.post(f"{self.base_url}/pulls", headers=headers, json=pr_payload)
                if pr_res.status_code in (200, 201):
                    logger.info(f"Successfully created SEO Pull Request for {self.repo}: {pr_res.json().get('html_url')}")
                    return True
                else:
                    logger.error(f"Failed to open Pull Request on {self.repo}: {pr_res.text}")
                    return False
        except Exception as e:
            logger.error(f"Error during Git connector change execution on {self.repo}: {e}")
            return False

    async def rollback_change(self, backup_state: Dict[str, Any]) -> bool:
        return await self.apply_change(backup_state)
